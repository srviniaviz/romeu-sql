# Release builds

Romeu SQL only builds distributable app artifacts from intentional release commits.

## Version format

While the app is alpha, versions must use:

```text
x.y.z-alpha.n
```

Examples:

```text
0.1.1-alpha.0
0.1.1-alpha.1
0.2.0-alpha.0
```

The version is synchronized in:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

## Bump version

Patch alpha bump:

```bash
npm run version:alpha
```

Minor alpha bump:

```bash
npm run version:alpha -- minor
```

Major alpha bump:

```bash
npm run version:alpha -- major
```

Explicit version:

```bash
npm run version:alpha -- 0.2.0-alpha.0
```

## Trigger a release build

The release workflow runs on pushes to `main`, but it only creates a build when:

1. The head commit message starts with `[RELEASE]`.
2. Fast checks pass.
3. The app version is different from the latest GitHub release tag.

Commit example:

```bash
git commit -m "[RELEASE] 0.1.1-alpha.0"
```

If the latest GitHub release is already `v0.1.1-alpha.0`, the workflow skips the build.

## Fast checks before build

The release workflow runs fast validation before building:

- `npm run test:run`
- `cargo check --manifest-path src-tauri/Cargo.toml`

Only after those checks pass does the Windows Tauri build run.
