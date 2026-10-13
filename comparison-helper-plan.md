# Run Comparison helper

Scope: hide the footer disabled reason visually while preserving its accessible description and all comparison rules. Pair-preview warnings are unchanged.

- [x] Add regression assertions and observe them fail against the visible footer. Three focused cases failed on the original warning classes.
- [x] Make the footer reason screen-reader-only and pass focused component tests. All 18 MappingConfig tests passed.
- [x] Pass frontend tests, lint and build; inspect compiled hiding CSS and the source diff. 237 tests passed, one existing measurement test skipped; lint and build passed. Compiled sr-only CSS uses absolute positioning, 1px dimensions, clip-path and hidden overflow. Both source files retain mode 100644, with no deletions or renames.

Browser screenshot verification was unavailable in this session. Evidence consists of rendered component tests and the generated production CSS.
