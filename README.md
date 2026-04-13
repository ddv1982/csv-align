# CSV Align - Compare CSV Files

A modern application to compare two CSV files with visual difference highlighting, filtering, and export capabilities. Available as both a **web application** and a **native desktop app**.

## Features

- **Drag-and-drop local file selection** with visual feedback
- **Auto-detect columns** and data types
- **Manual column pairing** for precise comparisons
- **Select key columns** for row matching
- **Select comparison columns** to compare
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
├── Cargo.toml              # Rust project config
├── src/
│   ├── main.rs             # Web server entry point
│   ├── lib.rs              # Library root
│   ├── api/                # Web API handlers
│   │   ├── mod.rs
│   │   ├── handlers.rs     # HTTP endpoints
│   │   └── state.rs        # Session state
│   ├── comparison/         # Comparison engine
│   │   ├── mod.rs
│   │   ├── engine.rs       # Core comparison logic
│   │   └── mapping.rs      # Column mapping logic
│   └── data/               # Data structures and I/O
│       ├── mod.rs
│       ├── types.rs        # Data types
│       ├── csv_loader.rs   # CSV loading
│       └── export.rs       # CSV export
├── src-tauri/              # Tauri desktop app wrapper
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/main.rs
├── frontend/               # React frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx         # Main app component
│   │   ├── components/     # UI components
│   │   ├── services/       # API service (web + Tauri)
│   │   └── types/          # TypeScript types
│   └── dist/               # Built frontend
├── .github/workflows/      # CI/CD workflows
│   ├── ci.yml              # Test & build
│   └── release.yml         # Release packaging
└── samples/                # Sample CSV files
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
- frontend structural cleanup is gated because `frontend/package.json` currently has no test script/tooling
- dead-code removal must be re-verified with search evidence plus passing `cargo check`, `cargo test`, and `cd frontend && npm run build`

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
# - src-tauri/Cargo.toml  
# - src-tauri/tauri.conf.json
# - frontend/package.json

# Add release notes in CHANGELOG.md using this exact heading format:
# ## v0.2.3 - YYYY-MM-DD
# - First release note bullet

# Commit and tag
git add -A
git commit -m "Release v0.2.3"
git tag v0.2.3
git push origin main
git push origin v0.2.3
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
| `/api/sessions/:id/export` | GET | Export results as CSV |

## Usage

1. **Select Files**: Drag and drop or click to choose two local CSV files.

2. **Configure Comparison**: 
   - Select key columns (used to match rows between files)
   - Select comparison columns (values to compare)
   - Pair columns manually in the order you want to compare them

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
# Rust tests
cargo test

# Check formatting
cargo fmt --check

# Run linter
cargo clippy
```

## License

This project is licensed under the [MIT License](LICENSE).
