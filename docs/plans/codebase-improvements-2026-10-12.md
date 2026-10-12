# Codebase improvement execution plan

Goal: research and review CSV Align, assess architecture and complexity, and implement the demonstrated improvements. Findings and research are in [the review](../reviews/codebase-review-2026-10-12.md). Each phase is verified and independently reviewed before proceeding. No commits or release publication are included.

- [x] oct-f00: Publish researched review and this checklist; verify source references and establish the whole-repository baseline.
- [x] oct-f01 (OCT-02): Include contract changes in consumer CI filters; first fail then pass contract-only selection and docs-only exclusion tests.
- [x] oct-f02 (OCT-01): Share atomic publication for CSV and desktop text saves; verify failure preservation, formats, permissions, symlinks and cancellation.
- [x] oct-f03 (OCT-03): Apply a 2 MiB UTF-8 pair-order limit at save/load boundaries, bounded reads and escaped HTTP envelope allowance; verify boundaries and round trips.
- [x] oct-f04 (OCT-04): Detect delimiters using a complete logical header record; first fail then pass multiline and escaped-quote regressions.
- [x] oct-f05 (OCT-05): Declare and test Rust 1.88 for both locked crates, add minimum-version CI and correct verification instructions.
- [x] oct-f06 (OCT-06): Move comparison response ownership through commit; first fail then pass allocation-identity, response and stale-operation checks; run final repository gate.

## Validation

Canonical Linux gate, from repository root:

```bash
cargo fmt --check && cargo test && cargo clippy -- -D warnings && npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build && cargo fmt --check --manifest-path src-tauri/Cargo.toml && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings && python3 scripts/check_release_metadata.py
```

Focused commands and acceptance evidence are recorded by Flow for each phase. Re-read this checklist before starting each phase and tick only after verification. GUI interaction, other-platform native builds, signing and release rehearsal are not part of the local evidence.
