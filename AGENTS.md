# AGENTS.md

## Project Summary

Romeu SQL is a desktop-only Tauri application for managing SQL database connections and browsing database objects. The frontend is React + Vite + TypeScript + Tailwind CSS. Native desktop capabilities are provided by Tauri v2 plugins.

This is not a web SaaS project. Treat it as a local desktop app: window controls, local storage, local secret storage, and SQL plugin behavior matter.

## Tech Stack

- Runtime/UI: React 19, Vite, TypeScript
- Styling: Tailwind CSS v4 tokens in `src/index.css`
- UI primitives: Radix/shadcn-style local components in `src/components/ui`
- Icons: `lucide-react`
- Data fetching/cache: TanStack React Query
- Forms: `react-hook-form` + `zod`
- Desktop shell: Tauri v2
- Local profile storage: `@tauri-apps/plugin-store`
- Secret storage: `@tauri-apps/plugin-stronghold`
- SQL access: Rust `sqlx` commands under `src-tauri/src/db`
- i18n: `react-i18next`, locale files in `src/i18n/locales`

## Important Commands

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri -- dev
npm run tauri -- build
npm run tauri -- icon src\assets\logo.png
```

Use `npm run build` for frontend/type validation. Use `cargo check` after changing anything under `src-tauri`.

## Directory Map

- `src/App.tsx`: top-level orchestration only. Keep it thin.
- `src/components/layout`: application shell pieces:
  - `AppSidebar.tsx`
  - `WorkspacePanel.tsx`
  - `EmptyWorkspace.tsx`
  - `DeleteConnectionDialog.tsx`
- `src/components/explorer`: database workspace pieces:
  - `ExplorerHeader.tsx`
  - `TableBrowser.tsx`
  - `DataPreview.tsx`
  - `SqlConsole.tsx`
- `src/components/ui`: reusable Radix/shadcn-style primitives.
- `src/domain/connections`: connection profile persistence and secrets.
- `src/domain/database`: frontend-facing database API wrappers. These call Rust commands with `invoke`.
- `src/lib/useConnections.ts`: compatibility re-export for the domain hook.
- `src/context/ThemeContext.tsx`: light/dark theme state.
- `src-tauri`: Tauri native app, capabilities, icons, Rust plugin setup.

## Architecture

The app is organized around domain modules rather than keeping logic in components.

Connection flow:

1. UI opens `CreateConnectionModal` from `src/components/CreateConnection.tsx`.
2. Form validation is handled with `react-hook-form` and Zod.
3. The modal calls `useConnections()` from `src/domain/connections/useConnections.ts`.
4. `repository.ts` stores non-secret connection profile data in `connections.json` via `LazyStore`.
5. `secretsRepository.ts` stores passwords in Stronghold.
6. React Query invalidates the connection list after mutations.

Database flow:

1. Components call `src/domain/database/service.ts`.
2. `service.ts` hydrates saved passwords when needed and calls Rust commands with `invoke`.
3. Rust commands live in `src-tauri/src/db/commands.rs`.
4. SQL dialect construction lives in `src-tauri/src/db/dialect.rs`.
5. Connection pools and row-to-JSON conversion live in `src-tauri/src/db/pool.rs`.
6. Shared Rust DTOs live in `src-tauri/src/db/types.rs`.

Keep database-specific SQL inside Rust `src-tauri/src/db/dialect.rs`. Do not scatter SQL syntax differences through UI components or frontend service code.

## Connection Secrets

Passwords must stay out of `connections.json`.

Current Stronghold setup:

- JS wrapper: `src/domain/connections/secretsRepository.ts`
- Snapshot file: `romeu-secrets-v6.stronghold`
- Client name: `romeu-sql`
- Rust key derivation: `src-tauri/src/lib.rs` uses SHA-256 over the vault password string.

Do not add timeout-based workarounds around Stronghold. It is local storage. If Stronghold errors, surface the real error and fix the underlying call or vault lifecycle.

Do not silently save a connection without its password when `savePassword` is true. That creates profiles that look valid but fail later with database authentication errors.

Existing profiles may have `hasSavedPassword: false` if they were saved during earlier failed attempts. Those must be edited and saved again with the password.

## Tauri Notes

The app uses a custom titlebar and undecorated window:

- `decorations: false` in `src-tauri/tauri.conf.json`
- Window permissions are in `src-tauri/capabilities/default.json`
- `Titlebar.tsx` uses Tauri window APIs for minimize/maximize/close/drag.

If native code or Tauri plugin setup changes, hot reload is not enough. Restart `npm run tauri -- dev`.

Capabilities currently include store, stronghold, dialog, fs, opener, and window controls. SQL no longer uses the Tauri SQL plugin or frontend plugin permissions.

## UI Guidelines

The desired UI is a clean desktop SQL workspace inspired by database clients, but it should not copy MongoDB Compass. The primary color is blue. Avoid green as primary.

General UI principles:

- Dense, calm, desktop-tool layout.
- Avoid landing-page or marketing patterns.
- Avoid decorative gradients/orbs.
- Avoid fake actions that do nothing.
- Do not duplicate the same action with multiple unexplained plus buttons.
- Use icons for tool actions, but keep labels where ambiguity matters.
- Keep App.tsx as orchestration; componentize views and dialogs.

Forms and modals:

- Labels should use the shared `Label` component style: small, medium weight, muted text.
- Avoid `font-black`, uppercase, and wide letter spacing for normal labels.
- Dialogs must not close when clicking outside. This is enforced in `src/components/ui/dialog.tsx` via `onInteractOutside`.
- Dialogs should still close through explicit actions: close button, cancel button, or successful submit.

Theme:

- Theme is managed in `ThemeContext`.
- Support light/dark switching from the titlebar.
- Default should remain light unless explicitly changed.

## Forms

Use React Hook Form + Zod for forms.

`CreateConnection.tsx` details:

- `name` is optional. If empty, it is generated as `database@host`.
- Required connection fields are host, port, database, username, password, engine, and SSL mode.
- Validation errors should be visible. If a validation error is on another tab, switch to that tab.
- In edit mode, title should be `Edit connection` and submit button should be `Save changes`.

Avoid hidden validation failures that block submit with no visible message.

## React Query

Connection list uses `connectionsQueryKey = ["connections"]`.

Mutations should invalidate the connection list, but avoid making modal submit UX wait forever on a refetch. Save operations should resolve when persistence finishes.

Database queries are keyed by connection id, database name, and selected table where relevant.

## SQL Dialects

Supported engines:

- PostgreSQL
- MySQL
- SQLite
- SQL Server enum exists in UI/types, but verify actual SQL plugin support before expanding behavior.

Dialect-specific behavior belongs in `src-tauri/src/db/dialect.rs`.

Use frontend `src/domain/database/service.ts` as the UI-facing API. Components should not build raw dialect-specific SQL except via user-entered SQL console content. Database execution and pooling belong in Rust.

## Icons

Source logo is `src/assets/logo.png`.

Regenerate Tauri icon outputs with:

```bash
npm run tauri -- icon src\assets\logo.png
```

This updates `src-tauri/icons` outputs used by the bundle. Restart/rebuild Tauri to see desktop icon changes.

## Known Cleanup/Risk Areas

- Some older UI components may still contain unused tabs or legacy fields. Remove dead UI instead of leaving controls that do not work.
- Stronghold behavior should be tested in the actual Tauri runtime, not only browser/Vite.
- Existing bad connection profiles may need re-saving because previous versions could store the profile without a password.
- Vite build currently warns about a large JS chunk. It is not fatal, but future cleanup could add route/component splitting.

## Coding Conventions

- Prefer existing local components over introducing new UI libraries.
- Use `apply_patch` for code edits.
- Keep changes scoped.
- Do not revert user changes.
- Use Tailwind utility classes consistent with current tokens.
- Keep comments rare and useful.
- Use ASCII unless the touched file already clearly needs non-ASCII.

## Validation Checklist

Before handing work back:

1. Run `npm run build` for frontend/type changes.
2. Run `cargo check --manifest-path src-tauri/Cargo.toml` for native/Tauri changes.
3. For connection persistence changes, test in a real Tauri runtime when possible.
4. Confirm modals still close through explicit buttons and do not close from outside clicks.
5. Confirm connection edits do not spin forever and show real errors if persistence fails.
