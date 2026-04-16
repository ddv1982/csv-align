# CSV Align

CSV Align is a desktop and web app for comparing two CSV files side by side.

It is designed for practical reconciliation work: matching rows by selected keys, comparing chosen columns in a controlled order, highlighting differences clearly, and exporting the results.

## Core features

- Load two local CSV files
- Auto-detect headers and column types
- Select key columns for row matching
- Pair comparison columns manually in left/right order
- Save and load pair-order selections for repeat work
- Auto-pair confident comparison columns when reliable matches are available
- Review matches, mismatches, missing rows, ignored rows, and duplicate keys
- Filter results and export the final comparison to CSV
- Run as either a local web app or a native desktop app

## Download

Desktop builds are published on the GitHub Releases page:

- [Releases](https://github.com/ddv1982/csv-align/releases)

Typical release assets include:

- macOS Apple Silicon: `csv-align-macos-arm64.dmg`
- macOS Intel: `csv-align-macos-x86_64.dmg`
- Linux: `.AppImage` and `.deb`

Linux note: Tauri v2 Linux builds require a distro with **WebKitGTK 4.1**.

## Quick start

### Prerequisites

- Rust 1.70+
- Node.js 18+
- npm

### Run the web app locally

1. Clone the repository:

   ```bash
   git clone https://github.com/ddv1982/csv-align.git
   cd csv-align
   ```

2. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. Build the frontend:

   ```bash
   cd frontend && npm run build
   cd ..
   ```

4. Start the local server:

   ```bash
   cargo run
   ```

5. Open `http://127.0.0.1:3000`

### Run the desktop app locally

Make sure you have already installed the frontend dependencies with `cd frontend && npm install`.

Install the Tauri CLI first:

```bash
cargo install tauri-cli --locked --version "^2"
```

```bash
cargo tauri dev
```

## How it works

1. Load File A and File B.
2. Choose matching key columns.
3. Choose comparison columns manually or use auto-pair when confident matches are available.
4. Run the comparison.
5. Review the results and export if needed.

## Auto-pairing

Auto-pairing is intentionally conservative. It helps fill in confident one-to-one comparison matches, but it does not force weak guesses.

See [docs/auto-pairing.md](docs/auto-pairing.md).

## Build and test

If you want the frontend dev server for UI work, run `cd frontend && npm run dev`. The main local app flow above uses the built frontend served by the Rust app.

### Tests

```bash
# Core Rust tests
cargo test

# Desktop wrapper tests
cd src-tauri && cargo test

# Frontend tests
cd frontend && npm test
```

### Production builds

```bash
# Frontend build
cd frontend && npm run build

# Rust backend build
cargo build --release

# Desktop build
cd src-tauri && cargo tauri build
```

Desktop bundles are written to `src-tauri/target/release/bundle/`.

## Project structure

```text
csv-align/
├── src/          # Shared Rust backend and comparison logic
├── src-tauri/    # Native desktop wrapper
├── frontend/     # React + TypeScript UI
├── tests/        # Rust integration/regression tests for public workflows and APIs
├── docs/         # Supporting documentation
└── samples/      # Example CSV files
```

Top-level `tests/` is for public Rust integration coverage; frontend Vitest files stay colocated under `frontend/src/`.

## Documentation

- [Auto-pairing](docs/auto-pairing.md)
- [Release workflow](docs/releasing.md)
- [Changelog](CHANGELOG.md)

## Notes for maintainers

Documentation-only updates do **not** require a version bump or a tagged release. They can be committed and pushed directly to `main`.

## License

Licensed under the [MIT License](LICENSE).
