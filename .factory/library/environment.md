# Environment

What lives here: env vars, external deps, setup notes, platform-specific quirks.
What does NOT live here: service ports/commands (use `.factory/services.yaml`).

## Toolchain

- **Rust:** stable (≥ 1.85 required for edition 2024, enforced in M2). `rustup update stable` via `.factory/init.sh`.
- **Node:** ≥ 22 (Node 25.8.1 in dev; CI pins 22).
- **npm:** 10+ (11.11.0 in dev).
- **tauri-cli:** v2.x (`cargo install tauri-cli --locked --version "^2"`). Desktop wrapper builds only; not required for every mission feature.

## Environment variables

- `RUST_LOG` — controls `tracing-subscriber` filter once M1 lands. Example: `RUST_LOG=csv_align=info,tower_http=debug`.
- No API keys or secrets. This project is fully local.

## External dependencies

- **Chromium** (already installed) — used by `agent-browser` for UI validation. No separate install.
- **No databases.** Sessions are in-memory.

## Platform notes

- macOS is the dev environment; CI runs Ubuntu 22.04 + macOS latest.
- Tauri Linux builds require libwebkit2gtk-4.1 + libayatana-appindicator3 + librsvg2 + patchelf (CI already installs).
- Tauri v2 Linux builds need WebKitGTK 4.1 at runtime.

## Frontend linting

- `frontend` uses `oxlint` via `npm run lint`.
- The current setup runs `oxlint . --deny-warnings` from `frontend/` and relies on oxlint's built-in sensible defaults; no separate config file is needed yet.
