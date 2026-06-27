<p align="center">
  <img src="./src/assets/icon.png" alt="Romeu SQL" width="96" height="96" />
</p>

<h1 align="center">Romeu SQL</h1>

<p align="center">
  Desktop SQL workspace built with Tauri, React, TypeScript and Rust.
</p>

> Status: **alpha / in active development**.
>
> Romeu SQL is not production-ready yet. Core workflows are being built and refined, APIs may change, and some screens still need hardening before a stable release.

## About

Romeu SQL is a local desktop app for managing SQL database connections, browsing database schemas, inspecting table data, running SQL, exporting rows, and reviewing database health/performance.

The project is intentionally desktop-first. It uses Tauri for native capabilities such as window controls, local profile storage, secure password storage, filesystem dialogs, and Rust-backed database access.

## Current Focus

- PostgreSQL-first support.
- Fast connection and schema sync.
- Clean database explorer UI.
- SQL editor and data preview workflows.
- Cluster/user management for supported databases.
- Benchmark analysis for table performance and indexing.
- Light/dark themes and PT/EN localization.

Other database engines may appear in UI placeholders, but PostgreSQL is the only engine currently treated as supported.

## Tech Stack

- Desktop shell: Tauri v2
- Native backend: Rust + sqlx
- Frontend: React 19 + TypeScript + Vite
- Styling: Tailwind CSS v4
- UI primitives: local Radix/shadcn-style components
- Icons: lucide-react
- Forms: react-hook-form + zod
- Data cache: TanStack React Query
- Local storage: Tauri Store
- Secret storage: Tauri Stronghold
- SQL editor: CodeMirror
- i18n: react-i18next
- Tests: Vitest + Rust tests + GitHub Actions

## Features In Progress

- Save and edit PostgreSQL connections.
- Store passwords outside the profile JSON.
- Browse databases and tables.
- View rows in table, card/document, and JSON modes.
- Paginate data and apply WHERE/ORDER/project options.
- Run SQL from the query/editor areas.
- Export query results to CSV or JSON.
- Inspect schema and indexes.
- Manage cluster users and permissions.
- Run benchmark analysis on database tables.
- Switch between Portuguese and English.
- Switch between light and dark mode.

## Development

Install dependencies:

```bash
npm install
```

Run the app in Tauri dev mode:

```bash
npm run tauri -- dev
```

Run only the Vite frontend:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

Build Tauri app:

```bash
npm run tauri -- build
```

Regenerate app icons from the source icon:

```bash
npm run tauri -- icon src\assets\icon.png
```

## Tests

Frontend tests:

```bash
npm run test:run
```

Frontend coverage:

```bash
npm run test:coverage
```

Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Rust check:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Rust format check:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

More details are in [TESTING.md](./TESTING.md).

## GitHub Actions

The CI workflow runs:

- Frontend tests with coverage.
- TypeScript/Vite production build.
- Rust formatting.
- Rust unit tests.
- Rust `cargo check`.
- PostgreSQL-backed integration tests.

Release builds are intentionally gated. They only run from release commits that start with `[RELEASE]` and when the app version differs from the latest GitHub release. See [RELEASE.md](./RELEASE.md).

## Database Support

| Engine | Status |
| --- | --- |
| PostgreSQL | Alpha support |
| MySQL | Coming soon |
| SQLite | Coming soon |
| SQL Server | Coming soon |

## Notes

- This is a desktop app, not a web SaaS.
- Passwords should never be written to `connections.json`.
- Stronghold is used for local secret storage.
- Database access should live in Rust commands under `src-tauri/src/db`.
- Frontend components should call the domain services instead of building backend behavior directly.

## License

Romeu SQL is licensed under the **GNU General Public License v3.0 only**.

See [LICENSE](./LICENSE) for the full license text.
