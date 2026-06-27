use super::dialect::connection_string;
use super::types::{ConnectionInput, DbEngine, JsonRow};
use serde_json::{json, Value};
use sqlx::mysql::{MySqlPoolOptions, MySqlRow};
use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::sqlite::{SqlitePoolOptions, SqliteRow};
use sqlx::{Column, MySqlPool, PgPool, Row, SqlitePool, TypeInfo, ValueRef};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::async_runtime::RwLock;

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
                let rows = sqlx::query(sql).fetch_all(&pool).await.map_err(to_error)?;
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
