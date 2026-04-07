# CSV Align - Compare CSV Files

A simple Rust desktop app to compare two CSV files with visual difference highlighting, filtering, and export capabilities.

## Features

- Load and parse two CSV files
- Detect and display columns from both files
- Select key columns for row matching
- Select comparison columns
- Auto-suggest column mappings based on name similarity
- Manual column mapping support
- Compare rows side by side
- Show:
  - Exact matches
  - Mismatched values (with highlighted differences)
  - Rows missing from left file
  - Rows missing from right file
  - Duplicate keys
- Summary with counts
- Filter by result type
- Export results to CSV

## Tech Stack

- Rust
- egui/eframe for UI
- csv crate for parsing
- serde for data structures
- rfd for file dialogs
- strsim for string similarity

## Project Structure

```
csv-align/
├── Cargo.toml
├── src/
│   ├── main.rs           # Application entry point
│   ├── lib.rs            # Library root
│   ├── comparison/       # Comparison engine
│   │   ├── mod.rs
│   │   ├── engine.rs     # Core comparison logic
│   │   └── mapping.rs    # Column mapping logic
│   ├── data/             # Data structures and I/O
│   │   ├── mod.rs
│   │   ├── types.rs      # Data types
│   │   ├── csv_loader.rs # CSV loading
│   │   └── export.rs     # CSV export
│   └── ui/               # User interface
│       ├── mod.rs
│       ├── app.rs        # Main application
│       ├── config_panel.rs
│       ├── results_panel.rs
│       └── export_dialog.rs
└── samples/              # Sample CSV files
    ├── file_a.csv
    └── file_b.csv
```

## Setup Instructions

### Prerequisites

- Rust (1.70 or later)
- Cargo

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd csv-align
   ```

2. Build the project:
   ```bash
   cargo build --release
   ```

3. Run the application:
   ```bash
   cargo run --release
   ```

### Development

To run in development mode:
```bash
cargo run
```

To run tests:
```bash
cargo test
```

To check for linting issues:
```bash
cargo clippy
```

## Usage

1. **Load Files**: Click "Load File A" and "Load File B" to select your CSV files.

2. **Configure Comparison**: 
   - Select key columns (used to match rows between files)
   - Select comparison columns (values to compare)
   - Review and adjust column mappings

3. **Run Comparison**: Click "Run Comparison" to compare the files.

4. **View Results**:
   - Results are displayed in a table with color coding
   - Use filters to show specific result types
   - View summary statistics

5. **Export**: Click "Export Results" to save the comparison results to a CSV file.

## Sample CSV Files

The `samples/` directory contains example CSV files:

- `file_a.csv`: Sample data with id, name, email, amount columns
- `file_b.csv`: Sample data with id, full_name, email_address, value columns (with some differences)

## Comparison Logic

The comparison engine:
1. Maps columns between files based on name similarity
2. Selects rows by key columns
3. Compares values in mapped columns
4. Categorizes results as:
   - **Match**: All values match
   - **Mismatch**: Some values differ
   - **Missing Left**: Row exists only in File B
   - **Missing Right**: Row exists only in File A
   - **Duplicate**: Multiple rows with the same key

## Unit Tests

The project includes comprehensive unit tests:
- CSV loading and parsing
- Column detection
- Column mapping (exact and fuzzy matching)
- Comparison logic (matches, mismatches, missing rows, duplicates)
- Summary statistics generation
- CSV export

Run tests with:
```bash
cargo test
```

## Architecture Decisions

1. **egui/eframe**: Chosen for its simplicity, Rust-native approach, and cross-platform support.

2. **Modular Structure**: Separated into core engine, data types, and UI for testability and maintainability.

3. **Comparison Engine**: Designed as a library crate with no UI dependencies for easy testing.

4. **String-based Comparison**: Uses string comparison for simplicity; could be enhanced with type-aware comparison.

5. **Fuzzy Matching**: Uses Levenshtein distance for column name matching with a 70% similarity threshold.

## Future Enhancements

- Type-aware comparison (numeric, date, etc.)
- Performance optimization for large files
- Advanced filtering options
- Custom comparison rules
- Batch processing
- Command-line interface

## License

MIT