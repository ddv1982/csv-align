# AGENTS

## Architecture
- `src/` is the shared Rust library crate (`csv_align`) used by both runtimes.
- `src/main.rs` is the local web app entrypoint: it serves the API and static `frontend/dist` on `127.0.0.1:3001`.
- `src-tauri/src/main.rs` is the desktop wrapper: Tauri commands call into the same shared backend workflows from `src/`.
- `frontend/src/services/tauri.ts` is the frontend transport switch: browser mode calls HTTP `/api`, Tauri mode uses `invoke(...)`.

## Run And Verify
- Web app: build the frontend first, then run `cargo run`. `cargo run` serves `frontend/dist`; it does not build the frontend for you.
- Desktop dev: `cargo tauri dev`. `src-tauri/tauri.conf.json` already runs `cd frontend && npm run dev` first.
- Root Rust validation for code changes: `cargo fmt --check && cargo test && cargo clippy -- -D warnings`.
- Tauri wrapper tests: `cd src-tauri && cargo test`.
- Frontend validation: `cd frontend && npm run build`. Frontend tests exist (`npm test`), but CI currently gates on build, not Vitest.

## Testing Layout
- Top-level `tests/*.rs` are the shared library's public integration/regression tests.
- `src-tauri/src/*tests*.rs` cover the desktop wrapper commands; keep Tauri-specific tests there.
- Frontend tests are colocated under `frontend/src/`.

## CI And Release Gotchas
- CI skips full jobs for docs-only changes (`**/*.md`, `LICENSE`) via `.github/workflows/ci.yml`; docs-only updates do not need a release.
- Non-doc Rust changes should be rustfmt-clean before commit; CI runs `cargo fmt --check` on both Ubuntu and macOS.
- CI also runs `cargo clippy -- -D warnings`, so new Rust warnings fail the build.
- Release tags are `v*` only. The release workflow requires a matching `CHANGELOG.md` section with the exact heading format `## vX.Y.Z - YYYY-MM-DD`, or the GitHub Release job fails.
- Real releases must bump version metadata in all of: `Cargo.toml`, `Cargo.lock`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `frontend/package.json`, `frontend/package-lock.json`.

## Commit Conventions
- Use Conventional Commits. Allowed types: `feat`, `fix`, `refactor`, `chore`, `perf`, `docs`, `test`, `build`, `ci`.
- `chore(deps): …` is the expected type for dependency/tooling-only changes.

## Mission .factory/ Edits
- Workers MAY edit files under `.factory/library/` when a feature description or skill explicitly requires it (e.g., recording a library note). For other infra files (`.factory/services.yaml`, `.factory/init.sh`, `.factory/skills/`) workers should propose changes in their handoff rather than editing directly, unless the feature scope authorizes the edit.

## Logging Policy
- Prefer `tracing::{info,warn,error,debug,trace}` over `println!`/`eprintln!` in production code. Tests and CLI tools may still use `println!` for explicit output. When a feature explicitly freezes startup strings, honor the scope freeze; otherwise, eliminate stray `println!` opportunistically as part of in-scope edits.

## Tauri Invoke Parity
- Every frontend `invoke('<cmd>', ...)` MUST have a matching `#[tauri::command]` handler in `src-tauri/src/` AND be registered in the `tauri::generate_handler![...]` list in `src-tauri/src/main.rs`. Adding, renaming, or removing an invoke call without the corresponding backend change is a regression and will break desktop mode silently (browser tests still pass).

## Validation-Only Features
- A feature that explicitly forbids source edits (e.g., full-surface manual UI sweeps) CANNOT be reported with `successState: "success"` under the normal commit contract because it has nothing to commit. Two sanctioned options:
  1. Emit a structured validation report to `.factory/validation/<milestone>/<feature-id>/report.json` and commit that report (`chore(validation): …`). This satisfies the commit requirement and produces per-assertion evidence.
  2. Cancel the validation-only feature and rely on the auto-injected `user-testing-validator` for that milestone, which produces per-assertion evidence natively. The assertions remain covered via `fulfills` on the implementation features.
- Do NOT mark a validation-only feature completed through an orchestrator override that leaves no audit trail and no per-assertion evidence. Prefer option 1 or 2.

