# User Testing

Validation knowledge for the csv-align v2 mission.

## Validation Surface

- **Primary surface:** web app served by Axum on `http://127.0.0.1:3001` (post-M1) or `http://127.0.0.1:3000` (pre-M1 milestones).
- **Tool:** `agent-browser` 0.17.1 with Chromium already installed.
- **Required setup before UI validation:**
  1. `cd frontend && npm run build` (ensures `frontend/dist/index.html` exists).
  2. `cargo run &` (starts Axum server; health via `/api/health`).
  3. Verify `curl -sf http://127.0.0.1:{3000|3001}/api/health` returns 200 before opening the browser.
- **Test fixtures:** `/Users/vriesd/projects/csv-align/samples/file_a.csv` and `samples/file_b.csv` (4 rows × 4 columns each). Larger fixtures (≥50k rows) and edge-case files (empty, header-only, UTF-16, malformed) must be generated on-the-fly by validators and written to `/tmp/` or a scratch dir.
- **Read-only snapshot fixture:** when validating read-only snapshot UI, create a v2 snapshot by running a normal compare and using **Save result** first; then reuse that downloaded JSON as the load fixture. Do not hand-craft partial JSON blobs because missing `selection.columns` and related fields trigger parser errors before read-only rendering.
- **Explicitly out of scope:** Tauri desktop e2e. Tauri correctness is covered by `cd src-tauri && cargo test`. agent-browser cannot drive Tauri's wkwebview.

## Library / Wrapper Test Surface (non-UI)

- Runs entirely via test commands — no services required, no UI.
- Tools: `cargo test`, `cargo fmt --check`, `cargo clippy -- -D warnings`, `cd src-tauri && cargo test`, `cd frontend && npm run build`, `cd frontend && npm test -- --run`, `cd frontend && npm run lint` (oxlint, post-M1).

## Release Readiness Surface

- Tools: `grep` / `file` / `jq` for version-bump checks, `gh` for CI run inspection, `git` for tag creation.
- `gh auth status` should be confirmed before M7 starts; escalate to user if missing.

## Validation Concurrency

Machine: 16 GB RAM, 10 CPU cores (macOS darwin 25.3).

- **Web surface (agent-browser):** each instance ~300 MB RAM + ~200 MB for the shared Axum server. Usable headroom ~8.4 GB (70% of ~12 GB free). Max concurrent agent-browser validators: **5**.
- **Rust/Node build + test:** CPU-bound (warm cargo ~2 s, cold build ~90 s). Serialize to a single builder at a time to avoid trashing `target/`. Max concurrent: **1**.
- **Library / release-gate validators (read-only grep/jq/gh):** lightweight; can run in parallel with anything. Max concurrent: **5**.

Validators must never start Axum on a port outside the 3000-3001 range. All builds/tests use the baseline `target/` and `frontend/node_modules/` in the repo — do not create alternate build outputs.

## Known Constraints

- Vite dev server (`npm run dev`) is NOT part of validation — the built `frontend/dist/` served by Axum is the tested surface.
- The port change from 3000 → 3001 happens inside M1; pre-M1 milestones validate against 3000, post-M1 against 3001. Validators should consult AGENTS.md / services.yaml for the current port.
- `handleReset` in the pre-refactor code does not issue `DELETE /api/sessions/{id}` — VAL-SHELL-005 requires M6 to wire it.
- `agent-browser` download path is fixed at daemon/session startup; if deterministic artifact names are needed, copy the downloaded file into the evidence directory after download.
- `agent-browser upload` cannot target csv dropzone `div[role="button"]` directly; validators must upload via the hidden `input[type="file"]` elements (IDs may change after rerenders).
- In headless browser automation, true native OS file-picker cancel and external drag-leave gestures are not reliably reproducible. For assertions that explicitly require those OS gestures, prefer manual validation or mark `blocked` with evidence of the nearest observable state.

## Flow Validator Guidance: web

- Use the shared app instance at `http://127.0.0.1:3001` for this milestone.
- Do not start additional web servers or use ports outside `3000`, `3001`, or `5173`.
- Keep actions scoped to validation flows only; do not mutate repository files from web-flow validators.
- Save all screenshots/network artifacts under the assigned evidence directory only.
- If a setup fault blocks browser checks, report it as `blocked` with the failing request/health detail.

## Flow Validator Guidance: repo-checks

- Run read-only contract checks from repository root (`grep`, `jq`, `npm run lint`, `curl`).
- Do not run commands that alter dependency lockfiles (for example `npm ci`).
- Do not edit project files from this surface; report only observed validation outcomes.
