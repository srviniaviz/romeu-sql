# Testing

Romeu SQL is a desktop Tauri app, so the test suite is split by the layer that can run reliably in GitHub Actions.

## Local commands

```bash
npm run test:run
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Postgres integration tests

The Rust pool integration tests are opt-in. They run in CI with a Postgres service container.

Locally:

```bash
$env:ROMEU_SQL_TEST_POSTGRES="1"
$env:ROMEU_SQL_TEST_PG_HOST="localhost"
$env:ROMEU_SQL_TEST_PG_PORT="5432"
$env:ROMEU_SQL_TEST_PG_DATABASE="postgres"
$env:ROMEU_SQL_TEST_PG_USERNAME="postgres"
$env:ROMEU_SQL_TEST_PG_PASSWORD="postgres"
cargo test --manifest-path src-tauri/Cargo.toml postgres_pool -- --nocapture
```

## GitHub Actions jobs

- `frontend`: Vitest, TypeScript, Vite production build.
- `rust`: Rust format, unit tests, `cargo check`.
- `postgres-integration`: real Postgres CRUD through the Rust pool.

The desktop UI itself is not driven by browser-only tests because native Tauri behavior must be validated in the Tauri runtime. Add Tauri/WebDriver E2E later when the core flows stabilize.
