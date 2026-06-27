use super::types::{ConnectionInput, DbEngine, RowQueryOptions};
use serde_json::Value;
use std::collections::BTreeMap;

fn quote_double(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn quote_backtick(identifier: &str) -> String {
    format!("`{}`", identifier.replace('`', "``"))
}

fn quote_bracket(identifier: &str) -> String {
    format!("[{}]", identifier.replace(']', "]]"))
}

fn quote_qualified(identifier: &str, quote: fn(&str) -> String) -> String {
    identifier
        .split('.')
        .map(|part| quote(&part.replace(['\'', '"', '`', '[', ']'], "")))
        .collect::<Vec<_>>()
        .join(".")
}

fn clean_where(where_clause: Option<&str>) -> Result<String, String> {
    let Some(trimmed) = where_clause
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(String::new());
    };
    let without_where = trimmed
        .strip_prefix("where ")
        .or_else(|| trimmed.strip_prefix("WHERE "))
        .unwrap_or(trimmed)
        .trim();
    if without_where.contains(';') {
        return Err("WHERE clause cannot contain semicolons.".into());
    }
    Ok(format!(" WHERE {without_where}"))
}

fn parse_identifier_list(value: Option<&str>, quote: fn(&str) -> String) -> Result<String, String> {
    let Some(trimmed) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok("*".into());
    };
    if trimmed.contains(';') || trimmed.contains('(') || trimmed.contains(')') {
        return Err("Project only accepts column names separated by commas.".into());
    }
    Ok(trimmed
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(|part| quote_qualified(part, quote))
        .collect::<Vec<_>>()
        .join(", "))
}

fn clean_order_by(value: Option<&str>, quote: fn(&str) -> String) -> Result<String, String> {
    let Some(trimmed) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(String::new());
    };
    if trimmed.contains(';') || trimmed.contains('(') || trimmed.contains(')') {
        return Err("Sort only accepts column names with optional ASC/DESC.".into());
    }

    let mut parts = Vec::new();
    for part in trimmed.split(',') {
        let tokens = part.split_whitespace().collect::<Vec<_>>();
        if tokens.is_empty() || tokens.len() > 2 {
            return Err("Invalid sort option.".into());
        }
        let direction = tokens
            .get(1)
            .map(|value| value.to_ascii_uppercase())
            .unwrap_or_else(|| "ASC".into());
        if direction != "ASC" && direction != "DESC" {
            return Err("Invalid sort option.".into());
        }
        if !tokens[0]
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '.' | '-'))
        {
            return Err("Invalid sort option.".into());
        }
        parts.push(format!(
            "{} {}",
            quote_qualified(tokens[0], quote),
            direction
        ));
    }

    Ok(format!(" ORDER BY {}", parts.join(", ")))
}

fn page_limit(
    default_limit: i64,
    default_offset: i64,
    options: Option<&RowQueryOptions>,
) -> (i64, i64) {
    let option_limit = options.and_then(|opts| opts.limit).unwrap_or(0);
    let option_skip = options.and_then(|opts| opts.skip).unwrap_or(0);
    (
        if option_limit > 0 {
            default_limit.min(option_limit)
        } else {
            default_limit
        },
        default_offset + option_skip.max(0),
    )
}

fn build_select_rows(
    table_name: &str,
    limit: i64,
    offset: i64,
    where_clause: Option<&str>,
    options: Option<&RowQueryOptions>,
    quote: fn(&str) -> String,
    paging: impl Fn(i64, i64, bool) -> String,
) -> Result<String, String> {
    let (next_limit, next_offset) = page_limit(limit, offset, options);
    let project = parse_identifier_list(options.and_then(|opts| opts.project.as_deref()), quote)?;
    let sort = clean_order_by(options.and_then(|opts| opts.sort.as_deref()), quote)?;
    Ok(format!(
        "SELECT {project} FROM {}{}{}{}",
        quote_qualified(table_name, quote),
        clean_where(where_clause)?,
        sort,
        paging(
            next_limit,
            next_offset,
            options.and_then(|opts| opts.sort.as_deref()).is_some()
        )
    ))
}

fn exact_where(
    row: &BTreeMap<String, Value>,
    quote: fn(&str) -> String,
    placeholder: impl Fn(usize) -> String,
    start_index: usize,
) -> String {
    let mut value_index = start_index;
    row.iter()
        .map(|(key, value)| {
            if value.is_null() {
                format!("{} IS NULL", quote(key))
            } else {
                let clause = format!("{} = {}", quote(key), placeholder(value_index));
                value_index += 1;
                clause
            }
        })
        .collect::<Vec<_>>()
        .join(" AND ")
}

fn build_insert(
    table_name: &str,
    data: &BTreeMap<String, Value>,
    quote: fn(&str) -> String,
    placeholder: impl Fn(usize) -> String,
) -> String {
    let columns = data
        .keys()
        .map(|key| quote(key))
        .collect::<Vec<_>>()
        .join(", ");
    let values = data
        .keys()
        .enumerate()
        .map(|(index, _)| placeholder(index + 1))
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "INSERT INTO {} ({columns}) VALUES ({values})",
        quote_qualified(table_name, quote)
    )
}

fn build_update(
    table_name: &str,
    original: &BTreeMap<String, Value>,
    next: &BTreeMap<String, Value>,
    quote: fn(&str) -> String,
    placeholder: impl Fn(usize) -> String + Copy,
) -> String {
    let assignments = next
        .keys()
        .enumerate()
        .map(|(index, key)| format!("{} = {}", quote(key), placeholder(index + 1)))
        .collect::<Vec<_>>()
        .join(", ");
    let where_clause = exact_where(original, quote, placeholder, next.len() + 1);
    format!(
        "UPDATE {} SET {assignments} WHERE {where_clause}",
        quote_qualified(table_name, quote)
    )
}

fn build_delete(
    table_name: &str,
    row: &BTreeMap<String, Value>,
    quote: fn(&str) -> String,
    placeholder: impl Fn(usize) -> String,
) -> String {
    let where_clause = exact_where(row, quote, placeholder, 1);
    format!(
        "DELETE FROM {} WHERE {where_clause}",
        quote_qualified(table_name, quote)
    )
}

pub fn connection_string(connection: &ConnectionInput) -> Result<String, String> {
    let password = connection.password.clone().unwrap_or_default();
    Ok(match connection.engine {
        DbEngine::Postgres => format!(
            "postgres://{}:{}@{}:{}/{}",
            urlencoding::encode(&connection.username),
            urlencoding::encode(&password),
            connection.host,
            connection.port,
            urlencoding::encode(&connection.database)
        ),
        DbEngine::Mysql => format!(
            "mysql://{}:{}@{}:{}/{}",
            urlencoding::encode(&connection.username),
            urlencoding::encode(&password),
            connection.host,
            connection.port,
            urlencoding::encode(&connection.database)
        ),
        DbEngine::Sqlite => format!("sqlite:{}", connection.host),
        DbEngine::Sqlserver => {
            return Err("SQL Server is not supported by the Rust database backend yet.".into())
        }
    })
}

pub fn list_databases(connection: &ConnectionInput) -> String {
    match connection.engine {
        DbEngine::Postgres => "SELECT datname as name FROM pg_database WHERE datistemplate = false ORDER BY datname ASC".into(),
        DbEngine::Mysql => "SHOW DATABASES".into(),
        DbEngine::Sqlite => format!("SELECT '{}' as name", connection.database.replace('\'', "''")),
        DbEngine::Sqlserver => "SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name ASC".into(),
    }
}

pub fn list_tables(connection: &ConnectionInput) -> String {
    match connection.engine {
        DbEngine::Postgres => "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC".into(),
        DbEngine::Mysql => "SHOW TABLES".into(),
        DbEngine::Sqlite => "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC".into(),
        DbEngine::Sqlserver => "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME ASC".into(),
    }
}

pub fn list_columns(connection: &ConnectionInput, table_name: &str) -> String {
    let pure_table = table_name
        .replace(['\'', '"', '`', '[', ']'], "")
        .split('.')
        .last()
        .unwrap_or(table_name)
        .to_string();
    match connection.engine {
        DbEngine::Postgres => format!("SELECT column_name as name, data_type as type, is_nullable as nullable, column_default as \"defaultValue\" FROM information_schema.columns WHERE table_name = '{}' ORDER BY ordinal_position", pure_table.replace('\'', "''")),
        DbEngine::Mysql => format!("DESCRIBE {}", quote_qualified(table_name, quote_backtick)),
        DbEngine::Sqlite => format!("PRAGMA table_info({})", quote_qualified(table_name, quote_double)),
        DbEngine::Sqlserver => format!("SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as nullable, COLUMN_DEFAULT as defaultValue FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{}'", pure_table.replace('\'', "''")),
    }
}

pub fn list_indexes(connection: &ConnectionInput, table_name: &str) -> String {
    let pure_table = table_name
        .replace(['\'', '"', '`', '[', ']'], "")
        .split('.')
        .last()
        .unwrap_or(table_name)
        .to_string();
    match connection.engine {
        DbEngine::Postgres => format!("SELECT indexname as name, indexdef as columns, indexdef ILIKE '%unique%' as unique, 'btree' as type FROM pg_indexes WHERE schemaname = 'public' AND tablename = '{}' ORDER BY indexname", pure_table.replace('\'', "''")),
        DbEngine::Mysql => format!("SHOW INDEX FROM {}", quote_qualified(table_name, quote_backtick)),
        DbEngine::Sqlite => format!("PRAGMA index_list({})", quote_qualified(table_name, quote_double)),
        DbEngine::Sqlserver => format!("SELECT i.name, COL_NAME(ic.object_id, ic.column_id) as columns, i.is_unique as unique, i.type_desc as type FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.tables t ON t.object_id = i.object_id WHERE t.name = '{}' AND i.name IS NOT NULL ORDER BY i.name", pure_table.replace('\'', "''")),
    }
}

pub fn list_table_stats(connection: &ConnectionInput) -> String {
    match connection.engine {
        DbEngine::Postgres => "SELECT c.relname as name, CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' ELSE 'table' END as type, COALESCE(s.n_live_tup, c.reltuples)::bigint as \"estimatedRows\", pg_total_relation_size(c.oid) as \"totalBytes\" FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm') ORDER BY c.relname ASC".into(),
        DbEngine::Mysql => "SELECT table_name as name, table_type as type, table_rows as estimatedRows, data_length + index_length as totalBytes FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name ASC".into(),
        DbEngine::Sqlite => "SELECT name, type, NULL as estimatedRows, NULL as totalBytes FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name ASC".into(),
        DbEngine::Sqlserver => "SELECT t.name, 'table' as type, SUM(p.rows) as estimatedRows, SUM(a.total_pages) * 8192 as totalBytes FROM sys.tables t JOIN sys.indexes i ON t.object_id = i.object_id JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id JOIN sys.allocation_units a ON p.partition_id = a.container_id GROUP BY t.name ORDER BY t.name ASC".into(),
    }
}

pub fn list_cluster_users(connection: &ConnectionInput) -> String {
    match connection.engine {
        DbEngine::Postgres => "SELECT rolname as name, CASE WHEN rolcanlogin THEN 'login role' ELSE 'group role' END as role, rolcanlogin as \"canLogin\", rolsuper as \"isAdmin\" FROM pg_roles ORDER BY rolname ASC".into(),
        DbEngine::Mysql => "SELECT User as name, Host as role, true as canLogin, Super_priv = 'Y' as isAdmin FROM mysql.user ORDER BY User ASC, Host ASC".into(),
        DbEngine::Sqlite => "SELECT 'local file' as name, 'owner' as role, 1 as canLogin, 1 as isAdmin".into(),
        DbEngine::Sqlserver => "SELECT name, type_desc as role, CASE WHEN type IN ('S', 'U', 'G') THEN 1 ELSE 0 END as canLogin, IS_SRVROLEMEMBER('sysadmin', name) as isAdmin FROM sys.server_principals WHERE type IN ('S', 'U', 'G') ORDER BY name ASC".into(),
    }
}

pub fn list_cluster_permissions(connection: &ConnectionInput) -> String {
    match connection.engine {
        DbEngine::Postgres => "SELECT grantee as principal, table_schema || '.' || table_name as \"objectName\", privilege_type as privilege FROM information_schema.role_table_grants WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY grantee, table_schema, table_name, privilege_type".into(),
        DbEngine::Mysql => "SELECT Grantee as principal, Table_schema as objectName, Privilege_type as privilege FROM information_schema.schema_privileges ORDER BY Grantee, Table_schema, Privilege_type".into(),
        DbEngine::Sqlite => "SELECT 'local file' as principal, 'database file' as objectName, 'read/write' as privilege".into(),
        DbEngine::Sqlserver => "SELECT USER_NAME(grantee_principal_id) as principal, DB_NAME() as objectName, permission_name as privilege FROM sys.database_permissions ORDER BY principal, permission_name".into(),
    }
}

pub fn count_rows(
    connection: &ConnectionInput,
    table_name: &str,
    where_clause: Option<&str>,
) -> Result<String, String> {
    let quote = quote_for(connection.engine);
    Ok(format!(
        "SELECT COUNT(*) as count FROM {}{}",
        quote_qualified(table_name, quote),
        clean_where(where_clause)?
    ))
}

pub fn select_rows(
    connection: &ConnectionInput,
    table_name: &str,
    limit: i64,
    offset: i64,
    where_clause: Option<&str>,
    options: Option<&RowQueryOptions>,
) -> Result<String, String> {
    match connection.engine {
        DbEngine::Postgres => build_select_rows(
            table_name,
            limit,
            offset,
            where_clause,
            options,
            quote_double,
            |limit, offset, _| format!(" LIMIT {limit} OFFSET {offset}"),
        ),
        DbEngine::Mysql => build_select_rows(
            table_name,
            limit,
            offset,
            where_clause,
            options,
            quote_backtick,
            |limit, offset, _| format!(" LIMIT {limit} OFFSET {offset}"),
        ),
        DbEngine::Sqlite => build_select_rows(
            table_name,
            limit,
            offset,
            where_clause,
            options,
            quote_double,
            |limit, offset, _| format!(" LIMIT {limit} OFFSET {offset}"),
        ),
        DbEngine::Sqlserver => build_select_rows(
            table_name,
            limit,
            offset,
            where_clause,
            options,
            quote_bracket,
            |limit, offset, has_sort| {
                format!(
                    "{} OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY",
                    if has_sort {
                        ""
                    } else {
                        " ORDER BY (SELECT NULL)"
                    }
                )
            },
        ),
    }
}

pub fn explain_rows(
    connection: &ConnectionInput,
    table_name: &str,
    where_clause: Option<&str>,
) -> Result<String, String> {
    let quote = quote_for(connection.engine);
    let base = format!(
        "SELECT * FROM {}{}",
        quote_qualified(table_name, quote),
        clean_where(where_clause)?
    );
    Ok(match connection.engine {
        DbEngine::Postgres | DbEngine::Mysql => format!("EXPLAIN {base} LIMIT 25"),
        DbEngine::Sqlite => format!("EXPLAIN QUERY PLAN {base} LIMIT 25"),
        DbEngine::Sqlserver => {
            format!("{base} ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY")
        }
    })
}

pub fn insert_row(
    connection: &ConnectionInput,
    table_name: &str,
    data: &BTreeMap<String, Value>,
) -> String {
    match connection.engine {
        DbEngine::Postgres => {
            build_insert(table_name, data, quote_double, |index| format!("${index}"))
        }
        DbEngine::Mysql => build_insert(table_name, data, quote_backtick, |_| "?".into()),
        DbEngine::Sqlite => build_insert(table_name, data, quote_double, |_| "?".into()),
        DbEngine::Sqlserver => build_insert(table_name, data, quote_bracket, |index| {
            format!("@P{index}")
        }),
    }
}

pub fn update_row(
    connection: &ConnectionInput,
    table_name: &str,
    original: &BTreeMap<String, Value>,
    next: &BTreeMap<String, Value>,
) -> String {
    match connection.engine {
        DbEngine::Postgres => build_update(table_name, original, next, quote_double, |index| {
            format!("${index}")
        }),
        DbEngine::Mysql => build_update(table_name, original, next, quote_backtick, |_| "?".into()),
        DbEngine::Sqlite => build_update(table_name, original, next, quote_double, |_| "?".into()),
        DbEngine::Sqlserver => build_update(table_name, original, next, quote_bracket, |index| {
            format!("@P{index}")
        }),
    }
}

pub fn delete_row(
    connection: &ConnectionInput,
    table_name: &str,
    row: &BTreeMap<String, Value>,
) -> String {
    match connection.engine {
        DbEngine::Postgres => {
            build_delete(table_name, row, quote_double, |index| format!("${index}"))
        }
        DbEngine::Mysql => build_delete(table_name, row, quote_backtick, |_| "?".into()),
        DbEngine::Sqlite => build_delete(table_name, row, quote_double, |_| "?".into()),
        DbEngine::Sqlserver => {
            build_delete(table_name, row, quote_bracket, |index| format!("@P{index}"))
        }
    }
}

pub fn create_database(connection: &ConnectionInput, name: &str) -> String {
    match connection.engine {
        DbEngine::Postgres => format!("CREATE DATABASE {}", quote_double(name)),
        DbEngine::Mysql => format!("CREATE DATABASE {}", quote_backtick(name)),
        DbEngine::Sqlite => format!(
            "ATTACH DATABASE {} AS {}",
            quote_double(name),
            quote_double(name)
        ),
        DbEngine::Sqlserver => format!("CREATE SCHEMA {}", quote_bracket(name)),
    }
}

fn quote_for(engine: DbEngine) -> fn(&str) -> String {
    match engine {
        DbEngine::Postgres | DbEngine::Sqlite => quote_double,
        DbEngine::Mysql => quote_backtick,
        DbEngine::Sqlserver => quote_bracket,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn postgres_connection() -> ConnectionInput {
        ConnectionInput {
            engine: DbEngine::Postgres,
            host: "localhost".into(),
            port: "5432".into(),
            database: "postgres".into(),
            username: "postgres".into(),
            password: Some("postgres".into()),
        }
    }

    #[test]
    fn builds_postgres_connection_string_with_encoded_credentials() {
        let connection = ConnectionInput {
            username: "user@example.com".into(),
            password: Some("p@ss word".into()),
            ..postgres_connection()
        };

        let value = connection_string(&connection).expect("connection string");

        assert_eq!(
            value,
            "postgres://user%40example.com:p%40ss%20word@localhost:5432/postgres"
        );
    }

    #[test]
    fn builds_paginated_select_with_where_project_sort_and_skip() {
        let connection = postgres_connection();
        let options = RowQueryOptions {
            project: Some("id, profile.name".into()),
            sort: Some("created_at desc, id asc".into()),
            skip: Some(5),
            limit: Some(10),
        };

        let sql = select_rows(
            &connection,
            "public.users",
            25,
            20,
            Some("WHERE active = true"),
            Some(&options),
        )
        .expect("select sql");

        assert_eq!(
            sql,
            "SELECT \"id\", \"profile\".\"name\" FROM \"public\".\"users\" WHERE active = true ORDER BY \"created_at\" DESC, \"id\" ASC LIMIT 10 OFFSET 25"
        );
    }

    #[test]
    fn rejects_semicolons_in_where_clauses() {
        let connection = postgres_connection();

        let error = count_rows(&connection, "users", Some("id = 1; DROP TABLE users"))
            .expect_err("where clause should be rejected");

        assert!(error.contains("semicolons"));
    }

    #[test]
    fn builds_mutation_sql_with_null_safe_exact_where() {
        let connection = postgres_connection();
        let original = BTreeMap::from([
            ("id".to_string(), Value::from(1)),
            ("deleted_at".to_string(), Value::Null),
        ]);
        let next = BTreeMap::from([
            ("id".to_string(), Value::from(1)),
            ("name".to_string(), Value::from("Romeu")),
        ]);

        let sql = update_row(&connection, "users", &original, &next);

        assert_eq!(
            sql,
            "UPDATE \"users\" SET \"id\" = $1, \"name\" = $2 WHERE \"deleted_at\" IS NULL AND \"id\" = $3"
        );
    }

    #[test]
    fn quotes_identifier_parts_and_strips_dangerous_delimiters() {
        let connection = postgres_connection();

        let sql =
            select_rows(&connection, "public.\"users\"", 10, 0, None, None).expect("select sql");

        assert_eq!(sql, "SELECT * FROM \"public\".\"users\" LIMIT 10 OFFSET 0");
    }
}
