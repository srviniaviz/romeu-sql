use sqlx::mysql::{MySqlPoolOptions, MySqlRow};
use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::sqlite::{SqlitePoolOptions, SqliteRow};
use sqlx::{MySqlPool, PgPool, Row, SqlitePool};
use std::env;
use std::time::{Duration, Instant};

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("bench failed: {error}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let config = BenchConfig::from_env()?;
    println!("Romeu SQL DB benchmark");
    println!("engine  : {}", config.engine);
    println!("target  : {}", config.redacted_url());
    println!(
        "count   : {}",
        if config.run_count {
            "enabled"
        } else {
            "disabled"
        }
    );
    println!();

    match config.engine.as_str() {
        "postgres" | "postgresql" => bench_postgres(&config).await,
        "mysql" | "mariadb" => bench_mysql(&config).await,
        "sqlite" => bench_sqlite(&config).await,
        other => Err(format!("unsupported engine: {other}")),
    }
}

struct BenchConfig {
    engine: String,
    url: String,
    table: Option<String>,
    run_count: bool,
}

impl BenchConfig {
    fn from_env() -> Result<Self, String> {
        let engine = env::var("ROMEU_BENCH_ENGINE")
            .or_else(|_| env::var("DB_ENGINE"))
            .unwrap_or_else(|_| "postgres".into())
            .to_ascii_lowercase();

        let url = env::var("ROMEU_BENCH_URL")
            .or_else(|_| env::var("DATABASE_URL"))
            .unwrap_or_else(|_| build_url_from_parts(&engine));

        if url.trim().is_empty() {
            return Err(
                "set ROMEU_BENCH_URL or DB parts: ROMEU_BENCH_ENGINE/HOST/PORT/DATABASE/USER/PASSWORD"
                    .into(),
            );
        }

        Ok(Self {
            engine,
            url,
            table: env::var("ROMEU_BENCH_TABLE").ok(),
            run_count: env::var("ROMEU_BENCH_COUNT").ok().as_deref() == Some("1"),
        })
    }

    fn redacted_url(&self) -> String {
        let Some((scheme, rest)) = self.url.split_once("://") else {
            return self.url.clone();
        };
        let Some((auth, host)) = rest.split_once('@') else {
            return self.url.clone();
        };
        let user = auth.split_once(':').map(|(user, _)| user).unwrap_or(auth);
        format!("{scheme}://{user}:***@{host}")
    }
}

fn build_url_from_parts(engine: &str) -> String {
    let host = env::var("ROMEU_BENCH_HOST").unwrap_or_else(|_| "localhost".into());
    let port = env::var("ROMEU_BENCH_PORT").unwrap_or_else(|_| {
        if engine == "mysql" || engine == "mariadb" {
            "3306".into()
        } else {
            "5432".into()
        }
    });
    let database = env::var("ROMEU_BENCH_DATABASE").unwrap_or_else(|_| "postgres".into());
    let user = env::var("ROMEU_BENCH_USER").unwrap_or_else(|_| "postgres".into());
    let password = env::var("ROMEU_BENCH_PASSWORD").unwrap_or_default();

    match engine {
        "sqlite" => format!("sqlite:{host}"),
        "mysql" | "mariadb" => format!("mysql://{user}:{password}@{host}:{port}/{database}"),
        _ => format!("postgres://{user}:{password}@{host}:{port}/{database}"),
    }
}

async fn bench_postgres(config: &BenchConfig) -> Result<(), String> {
    let pool = step("connect", || async {
        timeout(PgPoolOptions::new().max_connections(5).connect(&config.url)).await
    })
    .await?;

    step("select 1", || async {
        sqlx::query("SELECT 1 as ok")
            .fetch_all(&pool)
            .await
            .map_err(to_error)
    })
    .await?;

    let tables = step("list tables", || async {
        sqlx::query("SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC")
            .fetch_all(&pool)
            .await
            .map(|rows| pg_names(&rows))
            .map_err(to_error)
    })
    .await?;
    print_tables(&tables);

    step("table stats", || async {
        sqlx::query("SELECT c.relname as name, COALESCE(s.n_live_tup, c.reltuples)::bigint as rows, pg_total_relation_size(c.oid) as bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm') ORDER BY c.relname ASC")
            .fetch_all(&pool)
            .await
            .map_err(to_error)
    })
    .await?;

    bench_table_postgres(&pool, config, tables.first()).await
}

async fn bench_mysql(config: &BenchConfig) -> Result<(), String> {
    let pool = step("connect", || async {
        timeout(
            MySqlPoolOptions::new()
                .max_connections(5)
                .connect(&config.url),
        )
        .await
    })
    .await?;

    step("select 1", || async {
        sqlx::query("SELECT 1 as ok")
            .fetch_all(&pool)
            .await
            .map_err(to_error)
    })
    .await?;

    let tables = step("list tables", || async {
        sqlx::query("SHOW TABLES")
            .fetch_all(&pool)
            .await
            .map(|rows| mysql_names(&rows))
            .map_err(to_error)
    })
    .await?;
    print_tables(&tables);

    step("table stats", || async {
        sqlx::query("SELECT table_name as name, table_rows as rows, data_length + index_length as bytes FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name ASC")
            .fetch_all(&pool)
            .await
            .map_err(to_error)
    })
    .await?;

    bench_table_mysql(&pool, config, tables.first()).await
}

async fn bench_sqlite(config: &BenchConfig) -> Result<(), String> {
    let pool = step("connect", || async {
        timeout(
            SqlitePoolOptions::new()
                .max_connections(1)
                .connect(&config.url),
        )
        .await
    })
    .await?;

    step("select 1", || async {
        sqlx::query("SELECT 1 as ok")
            .fetch_all(&pool)
            .await
            .map_err(to_error)
    })
    .await?;

    let tables = step("list tables", || async {
        sqlx::query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC")
            .fetch_all(&pool)
            .await
            .map(|rows| sqlite_names(&rows))
            .map_err(to_error)
    })
    .await?;
    print_tables(&tables);

    bench_table_sqlite(&pool, config, tables.first()).await
}

async fn bench_table_postgres(
    pool: &PgPool,
    config: &BenchConfig,
    first_table: Option<&String>,
) -> Result<(), String> {
    let Some(table) = config.table.as_ref().or(first_table) else {
        return Ok(());
    };
    let table = quote_double(table);
    step("sample 10 rows", || async {
        sqlx::query(&format!("SELECT * FROM {table} LIMIT 10"))
            .fetch_all(pool)
            .await
            .map_err(to_error)
    })
    .await?;
    if config.run_count {
        step("count rows", || async {
            sqlx::query(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_all(pool)
                .await
                .map_err(to_error)
        })
        .await?;
    }
    Ok(())
}

async fn bench_table_mysql(
    pool: &MySqlPool,
    config: &BenchConfig,
    first_table: Option<&String>,
) -> Result<(), String> {
    let Some(table) = config.table.as_ref().or(first_table) else {
        return Ok(());
    };
    let table = quote_backtick(table);
    step("sample 10 rows", || async {
        sqlx::query(&format!("SELECT * FROM {table} LIMIT 10"))
            .fetch_all(pool)
            .await
            .map_err(to_error)
    })
    .await?;
    if config.run_count {
        step("count rows", || async {
            sqlx::query(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_all(pool)
                .await
                .map_err(to_error)
        })
        .await?;
    }
    Ok(())
}

async fn bench_table_sqlite(
    pool: &SqlitePool,
    config: &BenchConfig,
    first_table: Option<&String>,
) -> Result<(), String> {
    let Some(table) = config.table.as_ref().or(first_table) else {
        return Ok(());
    };
    let table = quote_double(table);
    step("sample 10 rows", || async {
        sqlx::query(&format!("SELECT * FROM {table} LIMIT 10"))
            .fetch_all(pool)
            .await
            .map_err(to_error)
    })
    .await?;
    if config.run_count {
        step("count rows", || async {
            sqlx::query(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_all(pool)
                .await
                .map_err(to_error)
        })
        .await?;
    }
    Ok(())
}

async fn step<T, Fut>(name: &str, run: impl FnOnce() -> Fut) -> Result<T, String>
where
    Fut: std::future::Future<Output = Result<T, String>>,
{
    let started = Instant::now();
    let result = run().await;
    let elapsed = started.elapsed();
    match &result {
        Ok(_) => println!("{name:<16} {:>8.2} ms", elapsed.as_secs_f64() * 1000.0),
        Err(error) => println!(
            "{name:<16} FAILED after {:.2} ms: {error}",
            elapsed.as_secs_f64() * 1000.0
        ),
    }
    result
}

async fn timeout<T>(
    future: impl std::future::Future<Output = Result<T, sqlx::Error>>,
) -> Result<T, String> {
    tokio::time::timeout(Duration::from_secs(8), future)
        .await
        .map_err(|_| "timed out after 8s".to_string())?
        .map_err(to_error)
}

fn pg_names(rows: &[PgRow]) -> Vec<String> {
    rows.iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect()
}

fn mysql_names(rows: &[MySqlRow]) -> Vec<String> {
    rows.iter()
        .filter_map(|row| row.try_get::<String, _>(0).ok())
        .collect()
}

fn sqlite_names(rows: &[SqliteRow]) -> Vec<String> {
    rows.iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect()
}

fn print_tables(tables: &[String]) {
    println!("tables          {:>8}", tables.len());
    if !tables.is_empty() {
        println!("first table     {}", tables[0]);
    }
}

fn quote_double(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn quote_backtick(identifier: &str) -> String {
    format!("`{}`", identifier.replace('`', "``"))
}

fn to_error(error: sqlx::Error) -> String {
    error.to_string()
}
