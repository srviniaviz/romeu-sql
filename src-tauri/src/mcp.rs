//! Local MCP server that lets AI clients use the connections the user chose to share.
//!
//! The server only listens on 127.0.0.1, requires a bearer token and rejects browser origins.
//! Reads run inside a read-only transaction that is always rolled back. Writes are limited to
//! single INSERT/UPDATE/DELETE statements on connections the user granted write access.

use crate::db::commands::{
    names_from, normalize_column, normalize_foreign_key, normalize_index, tables_from_rows,
    with_query_timeout,
};
use crate::db::dialect;
use crate::db::types::{ConnectionInput, DbEngine};
use crate::db::DbPoolState;
use axum::extract::{Request, State as AxumState};
use axum::http::{header, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{Implementation, ServerCapabilities, ServerConfig};
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use rmcp::{schemars, tool, tool_handler, tool_router, ServerHandler};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tauri::async_runtime::{Mutex, RwLock};
use tokio_util::sync::CancellationToken;

const DEFAULT_MAX_ROWS: usize = 200;
const HARD_MAX_ROWS: usize = 5_000;
const DEFAULT_QUERY_TIMEOUT_MS: u64 = 30_000;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum McpAccess {
    #[default]
    Read,
    Write,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConnectionInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub access: McpAccess,
    #[serde(flatten)]
    pub connection: ConnectionInput,
}

#[derive(Clone, Copy)]
struct McpLimits {
    max_rows: usize,
    query_timeout_ms: u64,
}

struct McpShared {
    pools: DbPoolState,
    connections: RwLock<Vec<McpConnectionInput>>,
    limits: RwLock<McpLimits>,
}

struct RunningServer {
    cancel: CancellationToken,
    port: u16,
}

pub struct McpState {
    shared: Arc<McpShared>,
    running: Mutex<Option<RunningServer>>,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            shared: Arc::new(McpShared {
                pools: DbPoolState::new(),
                connections: RwLock::new(Vec::new()),
                limits: RwLock::new(McpLimits {
                    max_rows: DEFAULT_MAX_ROWS,
                    query_timeout_ms: DEFAULT_QUERY_TIMEOUT_MS,
                }),
            }),
            running: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    running: bool,
    port: Option<u16>,
    url: Option<String>,
}

fn status_of(running: &Option<RunningServer>) -> McpStatus {
    match running {
        Some(server) => McpStatus {
            running: true,
            port: Some(server.port),
            url: Some(format!("http://127.0.0.1:{}/mcp", server.port)),
        },
        None => McpStatus {
            running: false,
            port: None,
            url: None,
        },
    }
}

#[tauri::command]
pub async fn mcp_start(
    state: tauri::State<'_, McpState>,
    port: u16,
    token: String,
    max_rows: Option<usize>,
    query_timeout_ms: Option<u64>,
) -> Result<McpStatus, String> {
    if token.trim().len() < 16 {
        return Err("The MCP access token must have at least 16 characters.".into());
    }
    if port < 1024 {
        return Err("Use a port between 1024 and 65535.".into());
    }

    *state.shared.limits.write().await = McpLimits {
        max_rows: max_rows.unwrap_or(DEFAULT_MAX_ROWS).clamp(1, HARD_MAX_ROWS),
        query_timeout_ms: query_timeout_ms.unwrap_or(DEFAULT_QUERY_TIMEOUT_MS),
    };

    let mut running = state.running.lock().await;
    if let Some(server) = running.take() {
        server.cancel.cancel();
    }

    *running = Some(spawn_server(state.shared.clone(), port, token).await?);
    Ok(status_of(&running))
}

async fn spawn_server(
    shared: Arc<McpShared>,
    port: u16,
    token: String,
) -> Result<RunningServer, String> {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .map_err(|error| format!("Could not listen on 127.0.0.1:{port}: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();

    let cancel = CancellationToken::new();
    let service = StreamableHttpService::new(
        move || Ok(RomeuMcp::new(shared.clone())),
        Arc::new(LocalSessionManager::default()),
        StreamableHttpServerConfig::default()
            .enforce_origin_validation()
            .with_cancellation_token(cancel.child_token()),
    );
    let router =
        axum::Router::new()
            .nest_service("/mcp", service)
            .layer(middleware::from_fn_with_state(
                Arc::new(token),
                require_token,
            ));

    let shutdown = cancel.clone();
    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async move { shutdown.cancelled_owned().await })
            .await;
    });

    Ok(RunningServer { cancel, port })
}

#[tauri::command]
pub async fn mcp_stop(state: tauri::State<'_, McpState>) -> Result<McpStatus, String> {
    let mut running = state.running.lock().await;
    if let Some(server) = running.take() {
        server.cancel.cancel();
    }
    Ok(status_of(&running))
}

#[tauri::command]
pub async fn mcp_status(state: tauri::State<'_, McpState>) -> Result<McpStatus, String> {
    Ok(status_of(&*state.running.lock().await))
}

#[tauri::command]
pub async fn mcp_set_connections(
    state: tauri::State<'_, McpState>,
    connections: Vec<McpConnectionInput>,
) -> Result<usize, String> {
    let count = connections.len();
    *state.shared.connections.write().await = connections;
    Ok(count)
}

async fn require_token(
    AxumState(token): AxumState<Arc<String>>,
    request: Request,
    next: Next,
) -> Response {
    let provided = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    match provided {
        Some(value) if constant_time_eq(value.as_bytes(), token.as_bytes()) => {
            next.run(request).await
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            "Missing or invalid MCP access token",
        )
            .into_response(),
    }
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

struct ScannedSql {
    statement: String,
    lower_code: String,
    first: String,
}

/// Strips strings and comments, enforces a single statement and finds the first keyword.
fn scan_single_statement(sql: &str, engine: DbEngine) -> Result<ScannedSql, String> {
    let mut code = String::with_capacity(sql.len());
    let chars: Vec<char> = sql.chars().collect();
    let mut index = 0;
    while index < chars.len() {
        let current = chars[index];
        let next = chars.get(index + 1).copied();
        match current {
            '\'' | '"' | '`' => {
                let quote = current;
                code.push(' ');
                index += 1;
                while index < chars.len() {
                    if chars[index] == quote {
                        if chars.get(index + 1) == Some(&quote) {
                            index += 2;
                            continue;
                        }
                        break;
                    }
                    if chars[index] == '\\' && engine == DbEngine::Mysql {
                        index += 1;
                    }
                    index += 1;
                }
                if index >= chars.len() {
                    return Err("The query has an unterminated string or identifier.".into());
                }
            }
            '-' if next == Some('-') => {
                while index < chars.len() && chars[index] != '\n' {
                    index += 1;
                }
                code.push(' ');
                continue;
            }
            '#' if engine == DbEngine::Mysql => {
                while index < chars.len() && chars[index] != '\n' {
                    index += 1;
                }
                code.push(' ');
                continue;
            }
            '/' if next == Some('*') => {
                index += 2;
                while index < chars.len()
                    && !(chars[index] == '*' && chars.get(index + 1) == Some(&'/'))
                {
                    index += 1;
                }
                if index >= chars.len() {
                    return Err("The query has an unterminated comment.".into());
                }
                index += 1;
                code.push(' ');
            }
            _ => code.push(current),
        }
        index += 1;
    }

    let trimmed_code = code.trim().trim_end_matches(';').trim_end();
    if trimmed_code.contains(';') {
        return Err("Only one statement per call is allowed.".into());
    }
    if trimmed_code.is_empty() {
        return Err("The query is empty.".into());
    }

    let lower_code = trimmed_code.to_ascii_lowercase();
    let first = lower_code
        .trim_start_matches('(')
        .split(|c: char| !c.is_ascii_alphabetic())
        .find(|word| !word.is_empty())
        .unwrap_or("")
        .to_string();
    let statement = sql.trim();
    Ok(ScannedSql {
        statement: statement
            .strip_suffix(';')
            .unwrap_or(statement)
            .trim_end()
            .to_string(),
        lower_code,
        first,
    })
}

fn sql_words(lower_code: &str) -> Vec<&str> {
    lower_code
        .split(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
        .filter(|word| !word.is_empty())
        .collect()
}

/// Checks that `sql` is a single statement whose first keyword is a read statement.
/// The read-only transaction is the real guard; this rejects obvious misuse early and
/// blocks statements that end a transaction implicitly (such as MySQL DDL).
pub(crate) fn validate_read_only_sql(sql: &str, engine: DbEngine) -> Result<String, String> {
    let ScannedSql {
        statement,
        lower_code,
        first,
    } = scan_single_statement(sql, engine)?;
    let allowed: &[&str] = match engine {
        DbEngine::Postgres => &["select", "with", "explain", "show", "values", "table"],
        DbEngine::Mysql => &[
            "select", "with", "explain", "show", "describe", "desc", "table", "values",
        ],
        DbEngine::Sqlite => &["select", "with", "explain", "values"],
        DbEngine::Sqlserver => &["select", "with"],
    };
    if !allowed.contains(&first.as_str()) {
        return Err(format!(
            "run_query only accepts read statements. Statements starting with '{}' are not allowed; use {}. To change data, use execute_sql on a connection with write access.",
            first.to_ascii_uppercase(),
            allowed.iter().map(|word| word.to_ascii_uppercase()).collect::<Vec<_>>().join(", ")
        ));
    }
    if engine == DbEngine::Mysql
        && (lower_code.contains("outfile") || lower_code.contains("dumpfile"))
    {
        return Err("Writing query results to files is not allowed.".into());
    }
    Ok(statement)
}

/// Checks that `sql` is a single INSERT, UPDATE or DELETE (optionally behind WITH).
/// Schema changes are never allowed, and UPDATE/DELETE must say which rows they touch.
pub(crate) fn validate_write_sql(sql: &str, engine: DbEngine) -> Result<String, String> {
    let ScannedSql {
        statement,
        lower_code,
        first,
    } = scan_single_statement(sql, engine)?;
    let allowed: &[&str] = match engine {
        DbEngine::Mysql => &["insert", "update", "delete", "replace", "with"],
        _ => &["insert", "update", "delete", "with"],
    };
    if !allowed.contains(&first.as_str()) {
        return Err(format!(
            "execute_sql only accepts INSERT, UPDATE or DELETE. '{}' is not allowed; schema changes (CREATE, ALTER, DROP, TRUNCATE...) are never permitted through MCP.",
            first.to_ascii_uppercase()
        ));
    }
    let words = sql_words(&lower_code);
    let changes_existing_rows = first == "update"
        || first == "delete"
        || (first == "with"
            && words
                .iter()
                .any(|word| *word == "update" || *word == "delete"));
    if changes_existing_rows && !words.contains(&"where") {
        return Err("UPDATE and DELETE need a WHERE clause. To change every row on purpose, write WHERE 1 = 1.".into());
    }
    if engine == DbEngine::Mysql
        && (lower_code.contains("outfile") || lower_code.contains("dumpfile"))
    {
        return Err("Writing query results to files is not allowed.".into());
    }
    Ok(statement)
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct ConnectionParams {
    /// Connection id or name, as returned by list_connections.
    pub connection: String,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct DatabaseParams {
    /// Connection id or name, as returned by list_connections.
    pub connection: String,
    /// Database to use instead of the connection's default database (Postgres/MySQL).
    pub database: Option<String>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct TableParams {
    /// Connection id or name, as returned by list_connections.
    pub connection: String,
    /// Table or view name. Use schema.table for non-default Postgres schemas.
    pub table: String,
    /// Database to use instead of the connection's default database (Postgres/MySQL).
    pub database: Option<String>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct SampleRowsParams {
    /// Connection id or name, as returned by list_connections.
    pub connection: String,
    /// Table or view name. Use schema.table for non-default Postgres schemas.
    pub table: String,
    /// Number of rows to return (default 20, capped by the app's row limit).
    pub limit: Option<usize>,
    /// Database to use instead of the connection's default database (Postgres/MySQL).
    pub database: Option<String>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct QueryParams {
    /// Connection id or name, as returned by list_connections.
    pub connection: String,
    /// A single read-only SQL statement (SELECT, WITH, EXPLAIN, SHOW...).
    pub sql: String,
    /// Maximum rows to return (capped by the app's row limit).
    pub max_rows: Option<usize>,
    /// Database to use instead of the connection's default database (Postgres/MySQL).
    pub database: Option<String>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct ExecuteParams {
    /// Connection id or name. Must have write access (see list_connections).
    pub connection: String,
    /// A single INSERT, UPDATE or DELETE statement. UPDATE and DELETE require WHERE.
    pub sql: String,
    /// Database to use instead of the connection's default database (Postgres/MySQL).
    pub database: Option<String>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct ExplainParams {
    /// Connection id or name, as returned by list_connections.
    pub connection: String,
    /// The SELECT statement to explain.
    pub sql: String,
    /// Database to use instead of the connection's default database (Postgres/MySQL).
    pub database: Option<String>,
}

#[derive(Clone)]
pub struct RomeuMcp {
    shared: Arc<McpShared>,
    tool_router: ToolRouter<Self>,
}

impl RomeuMcp {
    fn new(shared: Arc<McpShared>) -> Self {
        Self {
            shared,
            tool_router: Self::tool_router(),
        }
    }

    async fn resolve(
        &self,
        reference: &str,
        database: Option<&str>,
    ) -> Result<ConnectionInput, String> {
        self.resolve_with_access(reference, database)
            .await
            .map(|(connection, _)| connection)
    }

    async fn resolve_with_access(
        &self,
        reference: &str,
        database: Option<&str>,
    ) -> Result<(ConnectionInput, McpAccess), String> {
        let connections = self.shared.connections.read().await;
        let found = connections
            .iter()
            .find(|item| item.id == reference)
            .or_else(|| {
                connections
                    .iter()
                    .find(|item| item.name.eq_ignore_ascii_case(reference))
            });
        let Some(found) = found else {
            let names = connections
                .iter()
                .map(|item| item.name.as_str())
                .collect::<Vec<_>>();
            return Err(if names.is_empty() {
                "No connections are shared with MCP. Enable some in Romeu SQL settings.".into()
            } else {
                format!(
                    "Unknown connection '{reference}'. Available: {}",
                    names.join(", ")
                )
            });
        };
        let mut connection = found.connection.clone();
        if let Some(database) = database.map(str::trim).filter(|value| !value.is_empty()) {
            if connection.engine == DbEngine::Sqlite {
                return Err(
                    "SQLite connections point to a single database file; omit 'database'.".into(),
                );
            }
            connection.database = database.to_string();
        }
        Ok((connection, found.access))
    }

    async fn limits(&self) -> McpLimits {
        *self.shared.limits.read().await
    }

    async fn read_only(
        &self,
        connection: &ConnectionInput,
        sql: &str,
        max_rows: usize,
    ) -> Result<String, String> {
        let limits = self.limits().await;
        let max_rows = max_rows.clamp(1, limits.max_rows);
        let (rows, truncated) = with_query_timeout(Some(limits.query_timeout_ms), async {
            self.shared
                .pools
                .select_read_only(connection, sql, max_rows)
                .await
        })
        .await?;
        to_json(&json!({
            "rowCount": rows.len(),
            "truncated": truncated,
            "note": if truncated { Some(format!("Only the first {max_rows} rows are shown. Add a WHERE or LIMIT to narrow the result.")) } else { None },
            "rows": rows,
        }))
    }
}

fn to_json(value: &serde_json::Value) -> Result<String, String> {
    serde_json::to_string(value).map_err(|error| error.to_string())
}

#[tool_router(router = tool_router)]
impl RomeuMcp {
    #[tool(
        description = "List the database connections the user shared with AI in Romeu SQL, with each one's access level (read or write). Passwords are never returned.",
        annotations(read_only_hint = true)
    )]
    async fn list_connections(&self) -> Result<String, String> {
        let connections = self.shared.connections.read().await;
        let items = connections
            .iter()
            .map(|item| {
                json!({
                    "id": item.id,
                    "name": item.name,
                    "engine": format!("{:?}", item.connection.engine).to_lowercase(),
                    "host": item.connection.host,
                    "port": item.connection.port,
                    "database": item.connection.database,
                    "access": item.access,
                })
            })
            .collect::<Vec<_>>();
        to_json(&json!({ "connections": items }))
    }

    #[tool(
        description = "List databases available on a connection.",
        annotations(read_only_hint = true)
    )]
    async fn list_databases(
        &self,
        Parameters(params): Parameters<ConnectionParams>,
    ) -> Result<String, String> {
        let connection = self.resolve(&params.connection, None).await?;
        let timeout = self.limits().await.query_timeout_ms;
        let rows = with_query_timeout(Some(timeout), async {
            self.shared
                .pools
                .select(&connection, &dialect::list_databases(&connection))
                .await
        })
        .await?;
        to_json(
            &json!({ "databases": names_from(&rows, &["name", "datname", "Database"], &connection.database) }),
        )
    }

    #[tool(
        description = "List tables and views in a database.",
        annotations(read_only_hint = true)
    )]
    async fn list_tables(
        &self,
        Parameters(params): Parameters<DatabaseParams>,
    ) -> Result<String, String> {
        let connection = self
            .resolve(&params.connection, params.database.as_deref())
            .await?;
        let timeout = self.limits().await.query_timeout_ms;
        let rows = with_query_timeout(Some(timeout), async {
            self.shared
                .pools
                .select(&connection, &dialect::list_tables(&connection))
                .await
        })
        .await?;
        let tables = tables_from_rows(&rows)
            .into_iter()
            .map(|table| json!({ "name": table.name, "type": table.table_type }))
            .collect::<Vec<_>>();
        to_json(&json!({ "database": connection.database, "tables": tables }))
    }

    #[tool(
        description = "Describe a table: columns with types, nullability, defaults and primary key, plus foreign keys and indexes.",
        annotations(read_only_hint = true)
    )]
    async fn describe_table(
        &self,
        Parameters(params): Parameters<TableParams>,
    ) -> Result<String, String> {
        let connection = self
            .resolve(&params.connection, params.database.as_deref())
            .await?;
        let timeout = self.limits().await.query_timeout_ms;
        let table = params.table.trim();
        let pools = &self.shared.pools;
        let columns_sql = dialect::list_columns(&connection, table);
        let foreign_keys_sql = dialect::list_foreign_keys(&connection, table);
        let indexes_sql = dialect::list_indexes(&connection, table);
        let (columns, foreign_keys, indexes) = with_query_timeout(Some(timeout), async {
            tokio::try_join!(
                pools.select(&connection, &columns_sql),
                pools.select(&connection, &foreign_keys_sql),
                pools.select(&connection, &indexes_sql),
            )
        })
        .await?;
        if columns.is_empty() {
            return Err(format!("Table '{table}' was not found or has no columns. Use list_tables to see valid names."));
        }
        to_json(&json!({
            "table": table,
            "columns": columns.iter().map(normalize_column).collect::<Vec<_>>(),
            "foreignKeys": foreign_keys.iter().map(normalize_foreign_key).collect::<Vec<_>>(),
            "indexes": indexes.iter().map(normalize_index).collect::<Vec<_>>(),
        }))
    }

    #[tool(
        description = "Return a few rows from a table to see what the data looks like.",
        annotations(read_only_hint = true)
    )]
    async fn sample_rows(
        &self,
        Parameters(params): Parameters<SampleRowsParams>,
    ) -> Result<String, String> {
        let connection = self
            .resolve(&params.connection, params.database.as_deref())
            .await?;
        let limit = params.limit.unwrap_or(20).max(1);
        let sql = dialect::select_rows(
            &connection,
            params.table.trim(),
            limit as i64,
            0,
            None,
            None,
        )?;
        self.read_only(&connection, &sql, limit).await
    }

    #[tool(
        description = "Run one read-only SQL statement (SELECT, WITH, EXPLAIN, SHOW...). It runs inside a read-only transaction that is always rolled back; writes and DDL are rejected. Results are capped to the app's row limit.",
        annotations(read_only_hint = true)
    )]
    async fn run_query(
        &self,
        Parameters(params): Parameters<QueryParams>,
    ) -> Result<String, String> {
        let connection = self
            .resolve(&params.connection, params.database.as_deref())
            .await?;
        let sql = validate_read_only_sql(&params.sql, connection.engine)?;
        let max_rows = params.max_rows.unwrap_or(usize::MAX);
        self.read_only(&connection, &sql, max_rows).await
    }

    #[tool(
        description = "Run one INSERT, UPDATE or DELETE on a connection the user granted write access. UPDATE and DELETE must have a WHERE clause; schema changes are rejected. The change is committed immediately and cannot be undone, so check the affected rows with run_query first.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn execute_sql(
        &self,
        Parameters(params): Parameters<ExecuteParams>,
    ) -> Result<String, String> {
        let (connection, access) = self
            .resolve_with_access(&params.connection, params.database.as_deref())
            .await?;
        if access != McpAccess::Write {
            return Err(format!(
                "Connection '{}' is read-only. The user can grant write access in Romeu SQL > Settings > AI (MCP).",
                params.connection
            ));
        }
        let sql = validate_write_sql(&params.sql, connection.engine)?;
        let timeout = self.limits().await.query_timeout_ms;
        let rows_affected = with_query_timeout(Some(timeout), async {
            self.shared.pools.execute_write(&connection, &sql).await
        })
        .await?;
        to_json(&json!({ "rowsAffected": rows_affected }))
    }

    #[tool(
        description = "Show the execution plan for a SELECT statement without running it.",
        annotations(read_only_hint = true)
    )]
    async fn explain_query(
        &self,
        Parameters(params): Parameters<ExplainParams>,
    ) -> Result<String, String> {
        let connection = self
            .resolve(&params.connection, params.database.as_deref())
            .await?;
        let sql = validate_read_only_sql(&params.sql, connection.engine)?;
        let already_explain = sql.trim_start().to_ascii_lowercase().starts_with("explain");
        let statement = if already_explain {
            sql
        } else {
            match connection.engine {
                DbEngine::Sqlite => format!("EXPLAIN QUERY PLAN {sql}"),
                _ => format!("EXPLAIN {sql}"),
            }
        };
        self.read_only(&connection, &statement, HARD_MAX_ROWS).await
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for RomeuMcp {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("romeu-sql", env!("CARGO_PKG_VERSION")))
            .with_instructions(
                "Access to the user's databases through Romeu SQL. Start with list_connections to see each \
                 connection's access level, then list_tables and describe_table before writing SQL. run_query \
                 runs one read-only statement. execute_sql runs one INSERT, UPDATE or DELETE, only on connections \
                 with write access; schema changes and multiple statements are always rejected.",
            )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_simple_reads() {
        assert!(validate_read_only_sql("select * from users;", DbEngine::Postgres).is_ok());
        assert!(
            validate_read_only_sql("  WITH x AS (SELECT 1) SELECT * FROM x", DbEngine::Mysql)
                .is_ok()
        );
        assert!(validate_read_only_sql("(select 1)", DbEngine::Sqlite).is_ok());
        assert!(validate_read_only_sql("-- note\nSELECT ';' AS semi", DbEngine::Postgres).is_ok());
    }

    #[test]
    fn validates_write_statements() {
        assert!(validate_write_sql(
            "UPDATE users SET name = 'x' WHERE id = 1",
            DbEngine::Postgres
        )
        .is_ok());
        assert!(
            validate_write_sql("insert into users (name) values ('a');", DbEngine::Sqlite).is_ok()
        );
        assert!(validate_write_sql("DELETE FROM users", DbEngine::Postgres).is_err());
        assert!(validate_write_sql("UPDATE users SET name = 'where'", DbEngine::Mysql).is_err());
        assert!(validate_write_sql("DROP TABLE users", DbEngine::Postgres).is_err());
        assert!(validate_write_sql("TRUNCATE users", DbEngine::Mysql).is_err());
        assert!(validate_write_sql(
            "UPDATE t SET a = 1 WHERE id = 1; DROP TABLE t",
            DbEngine::Sqlite
        )
        .is_err());
        assert!(
            validate_write_sql("WITH x AS (SELECT 1) DELETE FROM t", DbEngine::Postgres).is_err()
        );
    }

    #[test]
    fn rejects_writes_and_multiple_statements() {
        assert!(validate_read_only_sql("delete from users", DbEngine::Postgres).is_err());
        assert!(validate_read_only_sql("select 1; delete from users", DbEngine::Postgres).is_err());
        assert!(
            validate_read_only_sql("select 1 /* ; */ ; drop table x", DbEngine::Sqlite).is_err()
        );
        assert!(validate_read_only_sql("pragma query_only = off", DbEngine::Sqlite).is_err());
        assert!(
            validate_read_only_sql("select * from t into outfile '/tmp/x'", DbEngine::Mysql)
                .is_err()
        );
        assert!(validate_read_only_sql("select 'unterminated", DbEngine::Postgres).is_err());
        assert!(validate_read_only_sql("", DbEngine::Postgres).is_err());
    }
    async fn post(
        client: &reqwest::Client,
        url: &str,
        token: &str,
        session: Option<&str>,
        body: serde_json::Value,
    ) -> (
        reqwest::StatusCode,
        Option<String>,
        Option<serde_json::Value>,
    ) {
        let mut request = client
            .post(url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/json, text/event-stream")
            .header("Content-Type", "application/json")
            .json(&body);
        if let Some(session) = session {
            request = request.header("Mcp-Session-Id", session);
        }
        let response = request.send().await.expect("request");
        let status = response.status();
        let session_id = response
            .headers()
            .get("mcp-session-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string);
        let text = response.text().await.unwrap_or_default();
        let message = text
            .lines()
            .filter_map(|line| line.strip_prefix("data:"))
            .filter_map(|data| serde_json::from_str::<serde_json::Value>(data.trim()).ok())
            .find(|value| value.get("id").is_some())
            .or_else(|| serde_json::from_str(&text).ok());
        (status, session_id, message)
    }

    fn tool_text(message: &serde_json::Value) -> (bool, String) {
        let result = &message["result"];
        let is_error = result["isError"].as_bool().unwrap_or(false);
        let text = result["content"][0]["text"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        (is_error, text)
    }

    #[tokio::test]
    async fn serves_tools_over_http() {
        let dir = std::env::temp_dir().join(format!("romeu-mcp-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");
        let _ = std::fs::remove_file(&path);
        let path_str = path.to_string_lossy().replace('\\', "/");

        let setup = sqlx::SqlitePool::connect(&format!("sqlite://{path_str}?mode=rwc"))
            .await
            .unwrap();
        sqlx::query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
            .execute(&setup)
            .await
            .unwrap();
        sqlx::query("INSERT INTO users (name) VALUES ('ana'), ('bia'), ('caio')")
            .execute(&setup)
            .await
            .unwrap();

        let connection = ConnectionInput {
            engine: DbEngine::Sqlite,
            host: path_str.clone(),
            port: String::new(),
            database: "main".into(),
            username: String::new(),
            password: None,
        };
        let shared = Arc::new(McpShared {
            pools: DbPoolState::new(),
            connections: RwLock::new(vec![
                McpConnectionInput {
                    id: "c1".into(),
                    name: "local".into(),
                    access: McpAccess::Read,
                    connection: connection.clone(),
                },
                McpConnectionInput {
                    id: "c2".into(),
                    name: "writable".into(),
                    access: McpAccess::Write,
                    connection: connection.clone(),
                },
            ]),
            limits: RwLock::new(McpLimits {
                max_rows: 2,
                query_timeout_ms: 10_000,
            }),
        });

        // The transaction guard alone must block writes, even if the SQL filter were bypassed.
        assert!(shared
            .pools
            .select_read_only(&connection, "DELETE FROM users", 10)
            .await
            .is_err());

        let token = "test-token-0123456789abcdef".to_string();
        let server = spawn_server(shared.clone(), 0, token.clone())
            .await
            .unwrap();
        let url = format!("http://127.0.0.1:{}/mcp", server.port);
        let client = reqwest::Client::new();

        let unauthorized = client.post(&url).json(&json!({})).send().await.unwrap();
        assert_eq!(unauthorized.status(), reqwest::StatusCode::UNAUTHORIZED);

        let browser = client
            .post(&url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Origin", "https://evil.example")
            .header("Accept", "application/json, text/event-stream")
            .json(&json!({"jsonrpc":"2.0","id":0,"method":"ping"}))
            .send()
            .await
            .unwrap();
        assert!(
            browser.status().is_client_error(),
            "browser origin must be rejected, got {}",
            browser.status()
        );

        let (status, session, init) = post(&client, &url, &token, None, json!({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": { "protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": { "name": "test", "version": "1" } }
        })).await;
        assert!(status.is_success(), "initialize failed: {status} {init:?}");
        let session = session.expect("session id");
        assert_eq!(init.unwrap()["result"]["serverInfo"]["name"], "romeu-sql");
        post(
            &client,
            &url,
            &token,
            Some(&session),
            json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        )
        .await;

        let (_, _, tools) = post(
            &client,
            &url,
            &token,
            Some(&session),
            json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        )
        .await;
        let names: Vec<String> = tools.unwrap()["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .map(|tool| tool["name"].as_str().unwrap().to_string())
            .collect();
        for expected in [
            "list_connections",
            "list_tables",
            "describe_table",
            "sample_rows",
            "run_query",
            "explain_query",
            "execute_sql",
        ] {
            assert!(
                names.contains(&expected.to_string()),
                "missing tool {expected}: {names:?}"
            );
        }

        let call = |id: i64, name: &str, args: serde_json::Value| {
            json!({
                "jsonrpc": "2.0", "id": id, "method": "tools/call", "params": { "name": name, "arguments": args }
            })
        };

        let (_, _, listed) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(3, "list_connections", json!({})),
        )
        .await;
        let (is_error, text) = tool_text(&listed.unwrap());
        assert!(
            !is_error && text.contains("\"local\"") && !text.contains("password"),
            "{text}"
        );

        let (_, _, tables) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(4, "list_tables", json!({"connection":"local"})),
        )
        .await;
        let (is_error, text) = tool_text(&tables.unwrap());
        assert!(!is_error && text.contains("users"), "{text}");

        let (_, _, described) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(
                5,
                "describe_table",
                json!({"connection":"c1","table":"users"}),
            ),
        )
        .await;
        let (is_error, text) = tool_text(&described.unwrap());
        assert!(
            !is_error && text.contains("\"name\"") && text.contains("isPrimaryKey"),
            "{text}"
        );

        let (_, _, rows) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(
                6,
                "run_query",
                json!({"connection":"local","sql":"SELECT * FROM users ORDER BY id"}),
            ),
        )
        .await;
        let (is_error, text) = tool_text(&rows.unwrap());
        let parsed: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert!(!is_error);
        assert_eq!(
            parsed["rowCount"], 2,
            "row limit should cap results: {text}"
        );
        assert_eq!(parsed["truncated"], true);

        let (_, _, sample) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(
                7,
                "sample_rows",
                json!({"connection":"local","table":"users","limit":5}),
            ),
        )
        .await;
        let (is_error, text) = tool_text(&sample.unwrap());
        assert!(!is_error && text.contains("ana"), "{text}");

        for (id, sql) in [
            (8, "DELETE FROM users"),
            (9, "SELECT 1; DELETE FROM users"),
            (10, "PRAGMA query_only = OFF"),
        ] {
            let (_, _, rejected) = post(
                &client,
                &url,
                &token,
                Some(&session),
                call(id, "run_query", json!({"connection":"local","sql":sql})),
            )
            .await;
            let (is_error, text) = tool_text(&rejected.unwrap());
            assert!(is_error, "{sql} should be rejected, got {text}");
        }

        let (_, _, plan) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(
                11,
                "explain_query",
                json!({"connection":"local","sql":"SELECT * FROM users WHERE id = 1"}),
            ),
        )
        .await;
        let (is_error, text) = tool_text(&plan.unwrap());
        assert!(!is_error, "{text}");

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(&setup)
            .await
            .unwrap();
        assert_eq!(count.0, 3, "no rows may be deleted");

        let update = json!({"sql": "UPDATE users SET name = 'ANA' WHERE id = 1"});
        let (_, _, denied) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(
                12,
                "execute_sql",
                json!({"connection":"local","sql":update["sql"]}),
            ),
        )
        .await;
        let (is_error, text) = tool_text(&denied.unwrap());
        assert!(
            is_error && text.contains("read-only"),
            "read connection must refuse writes: {text}"
        );

        let (_, _, updated) = post(
            &client,
            &url,
            &token,
            Some(&session),
            call(
                13,
                "execute_sql",
                json!({"connection":"writable","sql":update["sql"]}),
            ),
        )
        .await;
        let (is_error, text) = tool_text(&updated.unwrap());
        assert!(!is_error && text.contains("\"rowsAffected\":1"), "{text}");

        for (id, sql) in [(14, "DELETE FROM users"), (15, "DROP TABLE users")] {
            let (_, _, rejected) = post(
                &client,
                &url,
                &token,
                Some(&session),
                call(
                    id,
                    "execute_sql",
                    json!({"connection":"writable","sql":sql}),
                ),
            )
            .await;
            let (is_error, text) = tool_text(&rejected.unwrap());
            assert!(is_error, "{sql} should be rejected, got {text}");
        }

        let renamed: (String,) = sqlx::query_as("SELECT name FROM users WHERE id = 1")
            .fetch_one(&setup)
            .await
            .unwrap();
        assert_eq!(renamed.0, "ANA");
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(&setup)
            .await
            .unwrap();
        assert_eq!(count.0, 3, "rejected statements must not run");

        server.cancel.cancel();
        setup.close().await;
    }
}
