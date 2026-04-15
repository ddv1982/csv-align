# CSV Align - Compare CSV Files

A modern application to compare two CSV files with visual difference highlighting, filtering, and export capabilities. Available as both a **web application** and a **native desktop app**.

## Features

- **Drag-and-drop local file selection** with visual feedback
- **Auto-detect columns** and data types
- **Manual column pairing** for precise comparisons
- **Select key columns** for row matching
- **Select comparison columns** to compare in a manual left/right pair order
- **Save and load pair-order files** to reuse the same comparison setup with matching CSV headers
- **Auto-pair confident comparison columns** after selecting matching key columns, generating a comparison order from File A or File B when reliable one-to-one matches are available
- **Compare rows side by side** with results showing:
  - Exact matches
  - Mismatched values (with highlighted differences)
  - Rows missing from left file
  - Rows missing from right file
  - Duplicate keys
- **Summary statistics** with match rate progress bar
- **Filter results** by type
- **Export results** to CSV

## Download

### Desktop App (Recommended)

Download the native desktop app for your platform:

- **macOS (Apple Silicon)**: `csv-align-macos-arm64.dmg`
- **macOS (Intel)**: `csv-align-macos-x86_64.dmg`
- **Linux**: `csv-align-linux-x86_64.AppImage` or `.deb`

Linux compatibility note: the desktop app is built on Ubuntu 22.04 and requires a distro with **WebKitGTK 4.1** (for example Ubuntu 22.04+/Zorin 17+). Older bases like Ubuntu 20.04/Zorin 16 are not supported by Tauri v2 Linux binaries.

Check the [Releases](https://github.com/YOUR_USERNAME/csv-align/releases) page for downloads.

### Web Application

Run the web server locally (see Development section below).

## Tech Stack

### Backend (Rust)
- **Axum** - Modern async web framework
- **Tokio** - Async runtime
- **CSV crate** - CSV parsing
- **Serde** - Data serialization
- **strsim** - String similarity for column matching

### Frontend (TypeScript)
- **Vite** - Fast build tool
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling

### Desktop App
- **Tauri** - Lightweight native wrapper (uses system webview)

## Project Structure

```
csv-align/
├── Cargo.toml / Cargo.lock       # Core Rust crate metadata
├── CHANGELOG.md                  # Release notes
├── README.md                     # Project documentation
├── docs/                         # Supporting project docs
├── src/                          # Shared Rust application/library code
│   ├── api/                      # Axum HTTP layer
│   ├── backend/                  # Shared workflows, validation, session logic
│   ├── comparison/               # Core comparison engine
│   ├── data/                     # CSV loading/export and domain types
│   └── presentation/             # Shared response shaping
├── tests/                        # Rust integration/regression tests
├── src-tauri/                    # Tauri desktop wrapper and config
│   ├── src/                      # Desktop commands/tests
│   └── tauri.conf.json
├── frontend/                     # React + TypeScript frontend
│   ├── src/
│   │   ├── components/           # UI components
│   │   ├── config/               # Frontend defaults
│   │   ├── features/             # Feature-specific helpers
│   │   ├── hooks/                # Workflow/theme hooks
│   │   ├── services/             # Web + Tauri transport helpers
│   │   ├── test/                 # Frontend test setup
│   │   └── types/                # Frontend API/UI types
│   └── package.json
├── .github/workflows/
│   ├── ci.yml                    # Test and build workflow
│   └── release.yml               # Tagged release packaging workflow
└── samples/
    ├── file_a.csv
    └── file_b.csv
```

## Setup Instructions

### Prerequisites

- Rust (1.70 or later)
- Node.js (18 or later)
- npm

### Development - Web Application

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/csv-align.git
   cd csv-align
   ```

2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. Run in development mode:
   ```bash
   # Terminal 1: Start the Rust backend
   cargo run

   # Terminal 2: Start the Vite dev server
   cd frontend && npm run dev
   ```

4. Open http://localhost:5173 in your browser

### Development - Desktop App

1. Follow steps 1-2 above

2. Install Tauri CLI:
   ```bash
   cargo install tauri-cli --version "^2"
   ```

3. Run in development mode:
   ```bash
   cargo tauri dev
   ```

### Building for Production

#### Web Application
```bash
cd frontend && npm run build && cd ..
cargo build --release
./target/release/csv-align
```

#### Desktop App
```bash
cd frontend && npm run build && cd ..
cd src-tauri && cargo tauri build
```

The packaged app will be in `src-tauri/target/release/bundle/`.

## Maintenance / cleanup guidance

The approved cleanup pass is intentionally conservative:

- backend response-contract changes must be protected by characterization tests before DTO/mapping dedupe
- frontend structural cleanup should preserve the current Vitest coverage and production build path
- dead-code removal must be re-verified with search evidence plus passing `cargo check`, `cargo test`, `cd src-tauri && cargo test`, `cd frontend && npm test`, and `cd frontend && npm run build`

See [`docs/cleanup-review.md`](docs/cleanup-review.md) for the current review findings and execution guardrails.

## CI/CD

This project uses GitHub Actions for continuous integration and delivery:

### CI Workflow (`ci.yml`)
- Runs on every push and PR to `main`
- Tests Rust code on Ubuntu and macOS
- Tests and builds the frontend
- Builds Tauri apps for all platforms

### Release Workflow (`release.yml`)
- Triggered by pushing a version tag matching `v*` (for example `v0.2.3`)
- Creates a GitHub Release using the matching `CHANGELOG.md` section as the release notes instead of auto-generated notes
- Builds and uploads:
  - macOS DMG (ARM64 + Intel)
  - Linux AppImage and .deb
- Fails if the pushed tag does not have a matching non-empty changelog section headed `## vX.Y.Z - YYYY-MM-DD`

### Creating a Release

```bash
# Update version in:
# - Cargo.toml
# - Cargo.lock
# - src-tauri/Cargo.toml
# - src-tauri/Cargo.lock
# - src-tauri/tauri.conf.json
# - frontend/package.json
# - frontend/package-lock.json

# Add release notes in CHANGELOG.md using this exact heading format:
# ## v1.0.8 - YYYY-MM-DD
# - First release note bullet

# Commit and tag
git add -A
git commit -m "Release v1.0.8"
git tag v1.0.8
git push origin main
git push origin v1.0.8
```

Pushing the `v*` tag triggers the release workflow. If `CHANGELOG.md` is missing, the tag heading does not exactly match, or the section has no release-note content, the workflow fails before creating the GitHub Release.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/sessions` | POST | Create a new session |
| `/api/sessions/:id` | DELETE | Delete a session |
| `/api/sessions/:id/files/:letter` | POST | Load CSV file (a or b) into the session |
| `/api/sessions/:id/mappings` | POST | Get column mappings |
| `/api/sessions/:id/compare` | POST | Run comparison |
| `/api/sessions/:id/pair-order/save` | POST | Save the current key/comparison pair order as a text file |
| `/api/sessions/:id/pair-order/load` | POST | Load a saved pair order when the current file headers are compatible |
| `/api/sessions/:id/export` | GET | Export results as CSV |

## Usage

1. **Select Files**: Drag and drop or click to choose two local CSV files.

2. **Configure Comparison**:
   - Select key columns (used to match rows between files)
   - Select comparison columns (values to compare)
   - Pair columns manually in the order you want to compare them or use **Auto-pair from File A/File B** to fill in confident one-to-one matches after the selected key pairs
   - Use **Save pair order** to download the current key/comparison selection and **Load pair order** to restore it when the same File A/File B headers are loaded

### Auto-pair support

CSV Align supports guided auto-pairing for comparison columns. After you pick the same number of key columns in File A and File B, the app can build a comparison order from File A or File B when it finds reliable one-to-one matches. In those cases it starts from the selected key pairs and then appends only the remaining confident comparison matches.

See [docs/auto-pairing.md](docs/auto-pairing.md) for a concise explanation of how the auto-pairing logic works and what it intentionally leaves unmatched.

3. **Run Comparison**: Click "Run Comparison" to compare the files.

4. **View Results**:
   - Results are displayed in a color-coded table
   - Use filters to show specific result types
   - View summary statistics with match rate

5. **Export**: Click "Export CSV" to download the comparison results.

## Sample CSV Files

The `samples/` directory contains example CSV files:

- `file_a.csv`: Sample data with id, name, email, amount columns
- `file_b.csv`: Sample data with id, full_name, email_address, value columns (with some differences)

## Running Tests

```bash
# Core Rust tests
cargo test

# Desktop wrapper tests
cd src-tauri && cargo test

# Frontend tests
cd frontend && npm test

# Frontend production build
cd frontend && npm run build

# Optional formatting/lint checks
cargo fmt --check
cargo clippy
```

## License

This project is licensed under the [MIT License](LICENSE).
