use super::dialect;
use super::pool::DbPoolState;
use super::types::{
    BenchmarkAnalyzeResult, BenchmarkTableResult, ClusterPermissionInfo, ClusterUserInfo,
    ColumnInfo, ConnectionInput, ExportFormat, ExportResult, IndexInfo, JsonRow, RowQueryOptions,
    TableInfo,
};
use serde_json::Value;
use std::collections::BTreeMap;
use std::future::Future;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::time::timeout;

type DbResult<T> = Result<T, String>;
const DEFAULT_QUERY_TIMEOUT_MS: u64 = 60_000;
const MIN_QUERY_TIMEOUT_MS: u64 = 1_000;
const MAX_QUERY_TIMEOUT_MS: u64 = 600_000;

fn normalized_timeout_ms(query_timeout_ms: Option<u64>) -> u64 {
    query_timeout_ms
        .unwrap_or(DEFAULT_QUERY_TIMEOUT_MS)
        .clamp(MIN_QUERY_TIMEOUT_MS, MAX_QUERY_TIMEOUT_MS)
}

async fn with_query_timeout<T, F>(query_timeout_ms: Option<u64>, future: F) -> DbResult<T>
where
    F: Future<Output = DbResult<T>>,
{
    let ms = normalized_timeout_ms(query_timeout_ms);
    match timeout(Duration::from_millis(ms), future).await {
        Ok(result) => result,
        Err(_) => Err(format!("Query timed out after {ms} ms")),
    }
}

#[tauri::command]
pub async fn db_test_connection(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
) -> DbResult<()> {
    let sql = match connection.engine {
        super::types::DbEngine::Postgres | super::types::DbEngine::Mysql => "SELECT 1 as ok",
        super::types::DbEngine::Sqlite => "SELECT 1 as ok",
        super::types::DbEngine::Sqlserver => {
            return Err("SQL Server is not supported by the Rust database backend yet.".into())
        }
    };
    with_query_timeout(query_timeout_ms, async {
        state.select(&connection, sql).await?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn db_list_databases(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
) -> DbResult<Vec<String>> {
    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .select(&connection, &dialect::list_databases(&connection))
            .await?;
        Ok(names_from(
            &rows,
            &["name", "datname", "Database"],
            &connection.database,
        ))
    })
    .await
}

#[tauri::command]
pub async fn db_list_tables(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
) -> DbResult<Vec<String>> {
    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .select(&connection, &dialect::list_tables(&connection))
            .await?;
        Ok(names_from(&rows, &["name", "table_name", "TABLE_NAME"], ""))
    })
    .await
}

#[tauri::command]
pub async fn db_list_table_stats(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
) -> DbResult<Vec<TableInfo>> {
    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .select(&connection, &dialect::list_table_stats(&connection))
            .await?;
        Ok(rows.iter().map(normalize_table_stats).collect())
    })
    .await
}

#[tauri::command]
pub async fn db_benchmark_analyze(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
) -> DbResult<BenchmarkAnalyzeResult> {
    with_query_timeout(query_timeout_ms, async {
        let started = Instant::now();
        let stats_rows = state
            .select(&connection, &dialect::list_table_stats(&connection))
            .await?;
        let stats = stats_rows
            .iter()
            .map(normalize_table_stats)
            .collect::<Vec<_>>();
        let mut tables = Vec::new();

        for table in stats
            .iter()
            .filter(|table| !table.table_type.contains("view"))
        {
            let table_started = Instant::now();
            let mut notes = Vec::new();

            let index_started = Instant::now();
            let index_count = match state
                .select(
                    &connection,
                    &dialect::list_indexes(&connection, &table.name),
                )
                .await
            {
                Ok(rows) => rows.len() as i64,
                Err(error) => {
                    notes.push(format!("Index scan failed: {error}"));
                    0
                }
            };
            let index_ms = index_started.elapsed().as_secs_f64() * 1000.0;

            let count_started = Instant::now();
            let count_ms = match dialect::count_rows(&connection, &table.name, None) {
                Ok(sql) => match state.select(&connection, &sql).await {
                    Ok(_) => count_started.elapsed().as_secs_f64() * 1000.0,
                    Err(error) => {
                        notes.push(format!("Count failed: {error}"));
                        0.0
                    }
                },
                Err(error) => {
                    notes.push(format!("Count SQL failed: {error}"));
                    0.0
                }
            };

            let sample_started = Instant::now();
            let sample_ms = match dialect::select_rows(&connection, &table.name, 25, 0, None, None)
            {
                Ok(sql) => match state.select(&connection, &sql).await {
                    Ok(_) => sample_started.elapsed().as_secs_f64() * 1000.0,
                    Err(error) => {
                        notes.push(format!("Sample failed: {error}"));
                        0.0
                    }
                },
                Err(error) => {
                    notes.push(format!("Sample SQL failed: {error}"));
                    0.0
                }
            };

            if index_count == 0 && table.estimated_rows.unwrap_or_default() > 10_000 {
                notes.push("Large table without visible indexes".into());
            }
            if count_ms > 750.0 {
                notes.push("COUNT scan is slow".into());
            }
            if sample_ms > 250.0 {
                notes.push("Sample read is slow".into());
            }
            if index_ms > 250.0 {
                notes.push("Index metadata scan is slow".into());
            }

            let score = table_score(table.estimated_rows, index_count, count_ms, sample_ms);
            tables.push(BenchmarkTableResult {
                table_name: table.name.clone(),
                estimated_rows: table.estimated_rows,
                total_bytes: table.total_bytes,
                index_count,
                count_ms,
                sample_ms,
                total_ms: table_started.elapsed().as_secs_f64() * 1000.0,
                score,
                grade: score_grade(score),
                notes,
            });
        }

        tables.sort_by(|left, right| {
            left.score
                .cmp(&right.score)
                .then_with(|| right.total_ms.total_cmp(&left.total_ms))
        });

        let average_score = if tables.is_empty() {
            0
        } else {
            tables.iter().map(|table| table.score).sum::<i64>() / tables.len() as i64
        };
        let slowest_table = tables
            .iter()
            .max_by(|left, right| left.total_ms.total_cmp(&right.total_ms))
            .map(|table| table.table_name.clone());

        Ok(BenchmarkAnalyzeResult {
            database: connection.database,
            table_count: tables.len() as i64,
            average_score,
            slowest_table,
            total_ms: started.elapsed().as_secs_f64() * 1000.0,
            tables,
        })
    })
    .await
}

#[tauri::command]
pub async fn db_list_cluster_users(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
) -> DbResult<Vec<ClusterUserInfo>> {
    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .select(&connection, &dialect::list_cluster_users(&connection))
            .await?;
        Ok(rows.iter().map(normalize_cluster_user).collect())
    })
    .await
}

#[tauri::command]
pub async fn db_list_cluster_permissions(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
) -> DbResult<Vec<ClusterPermissionInfo>> {
    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .select(&connection, &dialect::list_cluster_permissions(&connection))
            .await?;
        Ok(rows.iter().map(normalize_cluster_permission).collect())
    })
    .await
}

#[tauri::command]
pub async fn db_select_rows_page(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
    limit: i64,
    offset: i64,
    where_clause: Option<String>,
    options: Option<RowQueryOptions>,
) -> DbResult<Vec<JsonRow>> {
    with_query_timeout(query_timeout_ms, async {
        let sql = dialect::select_rows(
            &connection,
            &table_name,
            limit,
            offset,
            where_clause.as_deref(),
            options.as_ref(),
        )?;
        state.select(&connection, &sql).await
    })
    .await
}

#[tauri::command]
pub async fn db_count_rows(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
    where_clause: Option<String>,
) -> DbResult<i64> {
    with_query_timeout(query_timeout_ms, async {
        let sql = dialect::count_rows(&connection, &table_name, where_clause.as_deref())?;
        let rows = state.select(&connection, &sql).await?;
        Ok(rows.first().and_then(first_number).unwrap_or(0))
    })
    .await
}

#[tauri::command]
pub async fn db_explain_rows(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
    where_clause: Option<String>,
) -> DbResult<Vec<JsonRow>> {
    with_query_timeout(query_timeout_ms, async {
        let sql = dialect::explain_rows(&connection, &table_name, where_clause.as_deref())?;
        state.select(&connection, &sql).await
    })
    .await
}

#[tauri::command]
pub async fn db_list_columns(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
) -> DbResult<Vec<ColumnInfo>> {
    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .select(
                &connection,
                &dialect::list_columns(&connection, &table_name),
            )
            .await?;
        Ok(rows.iter().map(normalize_column).collect())
    })
    .await
}

#[tauri::command]
pub async fn db_list_indexes(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
) -> DbResult<Vec<IndexInfo>> {
    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .select(
                &connection,
                &dialect::list_indexes(&connection, &table_name),
            )
            .await?;
        Ok(rows.iter().map(normalize_index).collect())
    })
    .await
}

#[tauri::command]
pub async fn db_execute_sql(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    query: String,
) -> DbResult<String> {
    with_query_timeout(query_timeout_ms, async {
        state.execute(&connection, &query, &[]).await?;
        Ok(query)
    })
    .await
}

#[tauri::command]
pub async fn db_select_query(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    query: String,
) -> DbResult<Vec<JsonRow>> {
    let trimmed = query.trim();
    let lower = trimmed.to_ascii_lowercase();
    if !lower.starts_with("select ") && !lower.starts_with("with ") {
        return Err("Query tab only runs SELECT/WITH statements.".into());
    }
    with_query_timeout(query_timeout_ms, async {
        state.select(&connection, trimmed).await
    })
    .await
}

#[tauri::command]
pub async fn db_export_query(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    query: String,
    path: String,
    format: ExportFormat,
) -> DbResult<ExportResult> {
    let trimmed = query.trim();
    let lower = trimmed.to_ascii_lowercase();
    if !lower.starts_with("select ") && !lower.starts_with("with ") {
        return Err("Export only runs SELECT/WITH statements.".into());
    }

    with_query_timeout(query_timeout_ms, async {
        let rows = state
            .export_query(&connection, trimmed, &path, format)
            .await?;
        Ok(ExportResult { path, rows })
    })
    .await
}

#[tauri::command]
pub async fn db_insert_row(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
    data: BTreeMap<String, Value>,
) -> DbResult<String> {
    with_query_timeout(query_timeout_ms, async {
        let sql = dialect::insert_row(&connection, &table_name, &data);
        let values = data.values().cloned().collect::<Vec<_>>();
        state.execute(&connection, &sql, &values).await?;
        Ok(sql)
    })
    .await
}

#[tauri::command]
pub async fn db_update_row(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
    original: BTreeMap<String, Value>,
    next: BTreeMap<String, Value>,
) -> DbResult<String> {
    with_query_timeout(query_timeout_ms, async {
        let sql = dialect::update_row(&connection, &table_name, &original, &next);
        let mut values = next.values().cloned().collect::<Vec<_>>();
        values.extend(original.values().filter(|value| !value.is_null()).cloned());
        state.execute(&connection, &sql, &values).await?;
        Ok(sql)
    })
    .await
}

#[tauri::command]
pub async fn db_delete_row(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    table_name: String,
    row: BTreeMap<String, Value>,
) -> DbResult<String> {
    with_query_timeout(query_timeout_ms, async {
        let sql = dialect::delete_row(&connection, &table_name, &row);
        let values = row
            .values()
            .filter(|value| !value.is_null())
            .cloned()
            .collect::<Vec<_>>();
        state.execute(&connection, &sql, &values).await?;
        Ok(sql)
    })
    .await
}

#[tauri::command]
pub async fn db_create_table(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    query: String,
) -> DbResult<()> {
    with_query_timeout(query_timeout_ms, async {
        state.execute(&connection, &query, &[]).await?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn db_create_database(
    state: State<'_, DbPoolState>,
    connection: ConnectionInput,
    query_timeout_ms: Option<u64>,
    name: String,
) -> DbResult<()> {
    with_query_timeout(query_timeout_ms, async {
        let sql = dialect::create_database(&connection, &name);
        state.execute(&connection, &sql, &[]).await?;
        Ok(())
    })
    .await
}

fn names_from(rows: &[JsonRow], keys: &[&str], fallback: &str) -> Vec<String> {
    let names = rows
        .iter()
        .filter_map(|row| {
            keys.iter()
                .find_map(|key| row.get(*key))
                .or_else(|| row.values().next())
                .and_then(value_to_string)
        })
        .collect::<Vec<_>>();
    if names.is_empty() && !fallback.is_empty() {
        vec![fallback.to_string()]
    } else {
        names
    }
}

fn normalize_column(row: &JsonRow) -> ColumnInfo {
    let default_value = get_value(row, &["defaultValue", "Default", "COLUMN_DEFAULT"]);
    let is_primary_key = number_eq(row.get("pk"), 1)
        || string_eq(row.get("Key"), "PRI")
        || number_eq(row.get("is_identity"), 1)
        || default_value
            .as_ref()
            .and_then(value_to_string)
            .is_some_and(|value| value.to_ascii_lowercase().contains("nextval"));

    ColumnInfo {
        name: get_string(row, &["name", "column_name", "Field", "COLUMN_NAME"]),
        data_type: get_string(row, &["type", "data_type", "Type", "DATA_TYPE"]),
        nullable: string_eq(row.get("nullable"), "YES")
            || string_eq(row.get("Null"), "YES")
            || string_eq(row.get("IS_NULLABLE"), "YES")
            || number_eq(row.get("notnull"), 0)
            || number_eq(row.get("pk"), 0),
        default_value: default_value.unwrap_or(Value::Null),
        is_primary_key,
    }
}

fn normalize_index(row: &JsonRow) -> IndexInfo {
    let non_unique = row.get("Non_unique").and_then(value_to_i64);
    IndexInfo {
        name: get_string(row, &["name", "indexname", "Key_name", "INDEX_NAME"]),
        columns: get_string(row, &["columns", "indexdef", "Column_name", "COLUMN_NAME"]),
        unique: non_unique
            .map(|value| value == 0)
            .unwrap_or_else(|| get_bool(row, &["unique", "is_unique"]).unwrap_or(false)),
        index_type: get_string(row, &["type", "index_type", "Index_type", "type_desc"]),
    }
}

fn normalize_table_stats(row: &JsonRow) -> TableInfo {
    TableInfo {
        name: get_string(row, &["name", "table_name", "TABLE_NAME"]),
        table_type: get_string(row, &["type", "table_type", "TABLE_TYPE"]).to_ascii_lowercase(),
        estimated_rows: get_number(row, &["estimatedRows", "table_rows", "TABLE_ROWS", "rows"]),
        total_bytes: get_number(row, &["totalBytes", "total_bytes", "bytes"]),
    }
}

fn normalize_cluster_user(row: &JsonRow) -> ClusterUserInfo {
    ClusterUserInfo {
        name: get_string(row, &["name", "user", "User", "username", "principal"]),
        role: get_string(row, &["role", "type", "Type", "principal_type"]),
        can_login: get_bool(row, &["canLogin", "can_login", "login", "can_connect"])
            .unwrap_or(true),
        is_admin: get_bool(
            row,
            &["isAdmin", "is_admin", "admin", "superuser", "rolsuper"],
        )
        .unwrap_or(false),
    }
}

fn normalize_cluster_permission(row: &JsonRow) -> ClusterPermissionInfo {
    ClusterPermissionInfo {
        principal: get_string(row, &["principal", "grantee", "user", "User", "name"]),
        object_name: get_string(
            row,
            &["objectName", "object_name", "table_name", "database", "Db"],
        ),
        privilege: get_string(
            row,
            &[
                "privilege",
                "privilege_type",
                "permission_name",
                "Privilege",
                "permission",
            ],
        ),
    }
}

fn table_score(
    estimated_rows: Option<i64>,
    index_count: i64,
    count_ms: f64,
    sample_ms: f64,
) -> i64 {
    let mut score = 100.0;
    score -= (count_ms / 25.0).min(35.0);
    score -= (sample_ms / 10.0).min(30.0);
    if estimated_rows.unwrap_or_default() > 10_000 && index_count == 0 {
        score -= 25.0;
    }
    if estimated_rows.unwrap_or_default() > 100_000 && index_count < 2 {
        score -= 10.0;
    }
    score.round().clamp(0.0, 100.0) as i64
}

fn score_grade(score: i64) -> String {
    match score {
        90..=100 => "A".into(),
        75..=89 => "B".into(),
        60..=74 => "C".into(),
        40..=59 => "D".into(),
        _ => "E".into(),
    }
}

fn get_value(row: &JsonRow, keys: &[&str]) -> Option<Value> {
    keys.iter().find_map(|key| row.get(*key)).cloned()
}

fn get_string(row: &JsonRow, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| row.get(*key))
        .and_then(value_to_string)
        .unwrap_or_default()
}

fn get_number(row: &JsonRow, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| row.get(*key))
        .and_then(value_to_i64)
}

fn get_bool(row: &JsonRow, keys: &[&str]) -> Option<bool> {
    keys.iter()
        .find_map(|key| row.get(*key))
        .and_then(value_to_bool)
}

fn first_number(row: &JsonRow) -> Option<i64> {
    row.get("count")
        .or_else(|| row.get("COUNT"))
        .or_else(|| row.get("COUNT(*)"))
        .or_else(|| row.values().next())
        .and_then(value_to_i64)
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(value) => Some(value.clone()),
        Value::Bool(value) => Some(value.to_string()),
        Value::Number(value) => Some(value.to_string()),
        other => Some(other.to_string()),
    }
}

fn value_to_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(value) => value
            .as_i64()
            .or_else(|| value.as_u64().map(|value| value as i64)),
        Value::String(value) => value.parse::<i64>().ok(),
        Value::Bool(value) => Some(if *value { 1 } else { 0 }),
        _ => None,
    }
}

fn value_to_bool(value: &Value) -> Option<bool> {
    match value {
        Value::Bool(value) => Some(*value),
        Value::Number(value) => Some(value.as_i64().unwrap_or_default() != 0),
        Value::String(value) => {
            let lower = value.to_ascii_lowercase();
            Some(matches!(lower.as_str(), "true" | "t" | "yes" | "y" | "1"))
        }
        _ => None,
    }
}

fn number_eq(value: Option<&Value>, expected: i64) -> bool {
    value.and_then(value_to_i64) == Some(expected)
}

fn string_eq(value: Option<&Value>, expected: &str) -> bool {
    value.and_then(value_to_string).as_deref() == Some(expected)
}
