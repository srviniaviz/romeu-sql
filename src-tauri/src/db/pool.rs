use super::dialect::connection_string;
use super::types::{ConnectionInput, DbEngine, ExportFormat, JsonRow};
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use futures_util::TryStreamExt;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::mysql::{MySqlPoolOptions, MySqlRow};
use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::sqlite::{SqlitePoolOptions, SqliteRow};
use sqlx::types::{Json, Uuid};
use sqlx::{Column, MySqlPool, PgPool, Row, SqlitePool, TypeInfo, ValueRef};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::async_runtime::RwLock;
use tokio::fs::File;
use tokio::io::{AsyncWriteExt, BufWriter};

#[derive(Clone)]
pub struct DbPoolState {
    pools: Arc<RwLock<HashMap<String, DatabasePool>>>,
}

#[derive(Clone)]
enum DatabasePool {
    Postgres(PgPool),
    Mysql(MySqlPool),
    Sqlite(SqlitePool),
}

impl DbPoolState {
    pub fn new() -> Self {
        Self {
            pools: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn get(&self, connection: &ConnectionInput) -> Result<DatabasePool, String> {
        let key = connection_string(connection)?;
        if let Some(pool) = self.pools.read().await.get(&key).cloned() {
            return Ok(pool);
        }

        let started = Instant::now();
        let pool = match connection.engine {
            DbEngine::Postgres => DatabasePool::Postgres(
                PgPoolOptions::new()
                    .max_connections(5)
                    .connect(&key)
                    .await
                    .map_err(to_error)?,
            ),
            DbEngine::Mysql => DatabasePool::Mysql(
                MySqlPoolOptions::new()
                    .max_connections(5)
                    .connect(&key)
                    .await
                    .map_err(to_error)?,
            ),
            DbEngine::Sqlite => DatabasePool::Sqlite(
                SqlitePoolOptions::new()
                    .max_connections(1)
                    .connect(&key)
                    .await
                    .map_err(to_error)?,
            ),
            DbEngine::Sqlserver => {
                return Err("SQL Server is not supported by the Rust database backend yet.".into())
            }
        };
        log_slow("connect", started, &key);

        self.pools.write().await.insert(key, pool.clone());
        Ok(pool)
    }

    pub async fn select(
        &self,
        connection: &ConnectionInput,
        sql: &str,
    ) -> Result<Vec<JsonRow>, String> {
        let started = Instant::now();
        match self.get(connection).await? {
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(&postgres_text_wrapped_query(sql))
                    .fetch_all(&pool)
                    .await
                    .map_err(to_error)?;
                log_slow("select", started, sql);
                rows.iter().map(pg_row_to_json).collect()
            }
            DatabasePool::Mysql(pool) => {
                let rows = sqlx::query(sql).fetch_all(&pool).await.map_err(to_error)?;
                log_slow("select", started, sql);
                rows.iter().map(mysql_row_to_json).collect()
            }
            DatabasePool::Sqlite(pool) => {
                let rows = sqlx::query(sql).fetch_all(&pool).await.map_err(to_error)?;
                log_slow("select", started, sql);
                rows.iter().map(sqlite_row_to_json).collect()
            }
        }
    }

    pub async fn execute(
        &self,
        connection: &ConnectionInput,
        sql: &str,
        values: &[Value],
    ) -> Result<u64, String> {
        let started = Instant::now();
        match self.get(connection).await? {
            DatabasePool::Postgres(pool) => {
                let mut query = sqlx::query(sql);
                for value in values {
                    query = bind_pg(query, value);
                }
                let rows = query
                    .execute(&pool)
                    .await
                    .map(|done| done.rows_affected())
                    .map_err(to_error)?;
                log_slow("execute", started, sql);
                Ok(rows)
            }
            DatabasePool::Mysql(pool) => {
                let mut query = sqlx::query(sql);
                for value in values {
                    query = bind_mysql(query, value);
                }
                let rows = query
                    .execute(&pool)
                    .await
                    .map(|done| done.rows_affected())
                    .map_err(to_error)?;
                log_slow("execute", started, sql);
                Ok(rows)
            }
            DatabasePool::Sqlite(pool) => {
                let mut query = sqlx::query(sql);
                for value in values {
                    query = bind_sqlite(query, value);
                }
                let rows = query
                    .execute(&pool)
                    .await
                    .map(|done| done.rows_affected())
                    .map_err(to_error)?;
                log_slow("execute", started, sql);
                Ok(rows)
            }
        }
    }

    pub async fn export_query(
        &self,
        connection: &ConnectionInput,
        sql: &str,
        path: &str,
        format: ExportFormat,
    ) -> Result<u64, String> {
        let started = Instant::now();
        let file = File::create(path).await.map_err(|error| error.to_string())?;
        let mut writer = ExportWriter::new(BufWriter::new(file), format);

        let rows = match self.get(connection).await? {
            DatabasePool::Postgres(pool) => {
                let wrapped_sql = postgres_text_wrapped_query(sql);
                let mut rows = sqlx::query(&wrapped_sql).fetch(&pool);
                let mut count = 0;
                while let Some(row) = rows.try_next().await.map_err(to_error)? {
                    writer.write_row(&pg_row_to_json(&row)?).await?;
                    count += 1;
                }
                count
            }
            DatabasePool::Mysql(pool) => {
                let mut rows = sqlx::query(sql).fetch(&pool);
                let mut count = 0;
                while let Some(row) = rows.try_next().await.map_err(to_error)? {
                    writer.write_row(&mysql_row_to_json(&row)?).await?;
                    count += 1;
                }
                count
            }
            DatabasePool::Sqlite(pool) => {
                let mut rows = sqlx::query(sql).fetch(&pool);
                let mut count = 0;
                while let Some(row) = rows.try_next().await.map_err(to_error)? {
                    writer.write_row(&sqlite_row_to_json(&row)?).await?;
                    count += 1;
                }
                count
            }
        };

        writer.finish().await?;
        log_slow("export", started, sql);
        Ok(rows)
    }
}

struct ExportWriter {
    writer: BufWriter<File>,
    format: ExportFormat,
    columns: Vec<String>,
    rows: u64,
}

impl ExportWriter {
    fn new(writer: BufWriter<File>, format: ExportFormat) -> Self {
        Self {
            writer,
            format,
            columns: Vec::new(),
            rows: 0,
        }
    }

    async fn write_row(&mut self, row: &JsonRow) -> Result<(), String> {
        if self.columns.is_empty() {
            self.columns = row.keys().cloned().collect();
            self.write_header().await?;
        }

        match self.format {
            ExportFormat::Csv => self.write_csv_row(row).await?,
            ExportFormat::Json => self.write_json_row(row).await?,
            ExportFormat::Xls => self.write_xls_row(row).await?,
        }
        self.rows += 1;
        Ok(())
    }

    async fn write_header(&mut self) -> Result<(), String> {
        match self.format {
            ExportFormat::Csv => {
                let line = self
                    .columns
                    .iter()
                    .map(|column| escape_csv(column))
                    .collect::<Vec<_>>()
                    .join(",");
                self.write_line(&line).await
            }
            ExportFormat::Json => self.write_raw("[\n").await,
            ExportFormat::Xls => {
                self.write_raw("<!doctype html><html><head><meta charset=\"utf-8\" /></head><body><table><thead><tr>").await?;
                let header = self
                    .columns
                    .iter()
                    .map(|column| format!("<th>{}</th>", escape_html(column)))
                    .collect::<Vec<_>>()
                    .join("");
                self.write_raw(&header).await?;
                self.write_raw("</tr></thead><tbody>\n").await
            }
        }
    }

    async fn write_csv_row(&mut self, row: &JsonRow) -> Result<(), String> {
        let line = self
            .columns
            .iter()
            .map(|column| escape_csv(&value_to_export_string(row.get(column).unwrap_or(&Value::Null))))
            .collect::<Vec<_>>()
            .join(",");
        self.write_line(&line).await
    }

    async fn write_json_row(&mut self, row: &JsonRow) -> Result<(), String> {
        if self.rows > 0 {
            self.write_raw(",\n").await?;
        }
        self.write_raw(&serde_json::to_string(row).map_err(|error| error.to_string())?)
            .await
    }

    async fn write_xls_row(&mut self, row: &JsonRow) -> Result<(), String> {
        self.write_raw("<tr>").await?;
        let cells = self
            .columns
            .iter()
            .map(|column| {
                format!(
                    "<td>{}</td>",
                    escape_html(&value_to_export_string(row.get(column).unwrap_or(&Value::Null)))
                )
            })
            .collect::<Vec<_>>()
            .join("");
        self.write_raw(&cells).await?;
        self.write_raw("</tr>\n").await
    }

    async fn finish(&mut self) -> Result<(), String> {
        if self.columns.is_empty() {
            match self.format {
                ExportFormat::Json => self.write_raw("[]").await?,
                ExportFormat::Xls => {
                    self.write_raw("<!doctype html><html><head><meta charset=\"utf-8\" /></head><body><table></table></body></html>").await?;
                }
                ExportFormat::Csv => {}
            }
        } else {
            match self.format {
                ExportFormat::Json => self.write_raw("\n]").await?,
                ExportFormat::Xls => self.write_raw("</tbody></table></body></html>").await?,
                ExportFormat::Csv => {}
            }
        }
        self.writer.flush().await.map_err(|error| error.to_string())
    }

    async fn write_line(&mut self, value: &str) -> Result<(), String> {
        self.write_raw(value).await?;
        self.write_raw("\n").await
    }

    async fn write_raw(&mut self, value: &str) -> Result<(), String> {
        self.writer
            .write_all(value.as_bytes())
            .await
            .map_err(|error| error.to_string())
    }
}

fn value_to_export_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        other => other.to_string(),
    }
}

fn escape_csv(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn log_slow(kind: &str, started: Instant, detail: &str) {
    let elapsed = started.elapsed();
    if elapsed.as_millis() >= 250 {
        let compact = detail
            .split_whitespace()
            .take(18)
            .collect::<Vec<_>>()
            .join(" ");
        eprintln!("[romeu-sql][db:{kind}] {}ms {compact}", elapsed.as_millis());
    }
}

fn postgres_text_wrapped_query(sql: &str) -> String {
    let trimmed = sql.trim();
    let lower = trimmed.to_ascii_lowercase();
    if !lower.starts_with("select ") && !lower.starts_with("with ") {
        return trimmed.to_string();
    }

    format!("SELECT to_jsonb(row_data) AS row FROM ({trimmed}) AS row_data")
}

fn to_error(error: sqlx::Error) -> String {
    error.to_string()
}

fn bind_pg<'q>(
    query: sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments>,
    value: &'q Value,
) -> sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments> {
    match value {
        Value::Null => query.bind(Option::<String>::None),
        Value::Bool(value) => query.bind(*value),
        Value::Number(value) if value.is_i64() => query.bind(value.as_i64()),
        Value::Number(value) if value.is_u64() => query.bind(value.as_u64().map(|v| v as i64)),
        Value::Number(value) => query.bind(value.as_f64()),
        Value::String(value) => query.bind(value),
        other => query.bind(other.to_string()),
    }
}

fn bind_mysql<'q>(
    query: sqlx::query::Query<'q, sqlx::MySql, sqlx::mysql::MySqlArguments>,
    value: &'q Value,
) -> sqlx::query::Query<'q, sqlx::MySql, sqlx::mysql::MySqlArguments> {
    match value {
        Value::Null => query.bind(Option::<String>::None),
        Value::Bool(value) => query.bind(*value),
        Value::Number(value) if value.is_i64() => query.bind(value.as_i64()),
        Value::Number(value) if value.is_u64() => query.bind(value.as_u64().map(|v| v as i64)),
        Value::Number(value) => query.bind(value.as_f64()),
        Value::String(value) => query.bind(value),
        other => query.bind(other.to_string()),
    }
}

fn bind_sqlite<'q>(
    query: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    value: &'q Value,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
    match value {
        Value::Null => query.bind(Option::<String>::None),
        Value::Bool(value) => query.bind(*value),
        Value::Number(value) if value.is_i64() => query.bind(value.as_i64()),
        Value::Number(value) if value.is_u64() => query.bind(value.as_u64().map(|v| v as i64)),
        Value::Number(value) => query.bind(value.as_f64()),
        Value::String(value) => query.bind(value),
        other => query.bind(other.to_string()),
    }
}

fn pg_row_to_json(row: &PgRow) -> Result<JsonRow, String> {
    if row.len() == 1 && row.column(0).name() == "row" {
        if let Ok(value) = row.try_get::<Json<Value>, _>(0) {
            if let Value::Object(map) = value.0 {
                return Ok(map.into_iter().collect());
            }
        }
    }

    let mut out = JsonRow::new();
    for (index, column) in row.columns().iter().enumerate() {
        out.insert(column.name().to_string(), pg_value(row, index)?);
    }
    Ok(out)
}

fn mysql_row_to_json(row: &MySqlRow) -> Result<JsonRow, String> {
    let mut out = JsonRow::new();
    for (index, column) in row.columns().iter().enumerate() {
        out.insert(column.name().to_string(), mysql_value(row, index)?);
    }
    Ok(out)
}

fn sqlite_row_to_json(row: &SqliteRow) -> Result<JsonRow, String> {
    let mut out = JsonRow::new();
    for (index, column) in row.columns().iter().enumerate() {
        out.insert(column.name().to_string(), sqlite_value(row, index)?);
    }
    Ok(out)
}

fn pg_value(row: &PgRow, index: usize) -> Result<Value, String> {
    if row.try_get_raw(index).map_err(to_error)?.is_null() {
        return Ok(Value::Null);
    }
    if let Ok(value) = row.try_get::<Json<Value>, _>(index) {
        return Ok(value.0);
    }
    if let Ok(value) = row.try_get::<Uuid, _>(index) {
        return Ok(Value::String(value.to_string()));
    }
    if let Ok(value) = row.try_get::<DateTime<Utc>, _>(index) {
        return Ok(Value::String(value.to_rfc3339()));
    }
    if let Ok(value) = row.try_get::<NaiveDateTime, _>(index) {
        return Ok(Value::String(value.to_string()));
    }
    if let Ok(value) = row.try_get::<NaiveDate, _>(index) {
        return Ok(Value::String(value.to_string()));
    }
    if let Ok(value) = row.try_get::<NaiveTime, _>(index) {
        return Ok(Value::String(value.to_string()));
    }
    if let Ok(value) = row.try_get::<Decimal, _>(index) {
        return Ok(value
            .to_string()
            .parse::<f64>()
            .map(Value::from)
            .unwrap_or_else(|_| Value::String(value.to_string())));
    }
    if let Ok(value) = row.try_get::<Vec<u8>, _>(index) {
        return Ok(Value::String(format!("<bytea {} bytes>", value.len())));
    }
    if let Ok(value) = row.try_get::<&str, _>(index) {
        return Ok(Value::String(value.to_string()));
    }
    if let Ok(value) = row.try_get::<String, _>(index) {
        return Ok(Value::String(value));
    }
    if let Ok(value) = row.try_get::<i64, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<i32, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<f64, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<bool, _>(index) {
        return Ok(json!(value));
    }
    Ok(Value::String(format!(
        "<{}>",
        row.column(index).type_info().name()
    )))
}

fn mysql_value(row: &MySqlRow, index: usize) -> Result<Value, String> {
    if row.try_get_raw(index).map_err(to_error)?.is_null() {
        return Ok(Value::Null);
    }
    if let Ok(value) = row.try_get::<String, _>(index) {
        return Ok(Value::String(value));
    }
    if let Ok(value) = row.try_get::<i64, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<i32, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<f64, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<bool, _>(index) {
        return Ok(json!(value));
    }
    Ok(Value::String(format!(
        "<{}>",
        row.column(index).type_info().name()
    )))
}

fn sqlite_value(row: &SqliteRow, index: usize) -> Result<Value, String> {
    if row.try_get_raw(index).map_err(to_error)?.is_null() {
        return Ok(Value::Null);
    }
    if let Ok(value) = row.try_get::<String, _>(index) {
        return Ok(Value::String(value));
    }
    if let Ok(value) = row.try_get::<i64, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<f64, _>(index) {
        return Ok(json!(value));
    }
    if let Ok(value) = row.try_get::<bool, _>(index) {
        return Ok(json!(value));
    }
    Ok(Value::String(format!(
        "<{}>",
        row.column(index).type_info().name()
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn postgres_connection_from_env() -> Option<ConnectionInput> {
        if std::env::var("ROMEU_SQL_TEST_POSTGRES").ok().as_deref() != Some("1") {
            return None;
        }

        Some(ConnectionInput {
            engine: DbEngine::Postgres,
            host: std::env::var("ROMEU_SQL_TEST_PG_HOST").unwrap_or_else(|_| "localhost".into()),
            port: std::env::var("ROMEU_SQL_TEST_PG_PORT").unwrap_or_else(|_| "5432".into()),
            database: std::env::var("ROMEU_SQL_TEST_PG_DATABASE")
                .unwrap_or_else(|_| "postgres".into()),
            username: std::env::var("ROMEU_SQL_TEST_PG_USERNAME")
                .unwrap_or_else(|_| "postgres".into()),
            password: Some(
                std::env::var("ROMEU_SQL_TEST_PG_PASSWORD").unwrap_or_else(|_| "postgres".into()),
            ),
        })
    }

    #[tokio::test]
    async fn postgres_pool_executes_parameterized_crud_when_enabled() {
        let Some(connection) = postgres_connection_from_env() else {
            eprintln!(
                "skipping postgres integration test; set ROMEU_SQL_TEST_POSTGRES=1 to enable"
            );
            return;
        };

        let state = DbPoolState::new();
        state
            .execute(
                &connection,
                "CREATE TABLE IF NOT EXISTS romeu_sql_ci_items (id INT PRIMARY KEY, name TEXT NOT NULL, active BOOLEAN NOT NULL)",
                &[],
            )
            .await
            .expect("create test table");
        state
            .execute(&connection, "TRUNCATE TABLE romeu_sql_ci_items", &[])
            .await
            .expect("truncate test table");
        state
            .execute(
                &connection,
                "INSERT INTO romeu_sql_ci_items (id, name, active) VALUES ($1, $2, $3)",
                &[json!(1), json!("alpha"), json!(true)],
            )
            .await
            .expect("insert test row");

        let rows = state
            .select(
                &connection,
                "SELECT id, name, active FROM romeu_sql_ci_items WHERE id = 1",
            )
            .await
            .expect("select test row");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].get("id"), Some(&json!(1)));
        assert_eq!(rows[0].get("name"), Some(&json!("alpha")));
        assert_eq!(rows[0].get("active"), Some(&json!(true)));

        state
            .execute(&connection, "DROP TABLE romeu_sql_ci_items", &[])
            .await
            .expect("drop test table");
    }
}
