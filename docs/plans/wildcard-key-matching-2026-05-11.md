# Wildcard Key Matching Plan

## Goal
Fix wildcard-enabled row-key matching for a currently failing key-shape case while preserving the existing exact-match default, deterministic flexible-match ordering, nullish-key handling, duplicate handling, and frontend transport contract.

The implementation must not encode, paraphrase, or resemble the sensitive example data. Tests should use neutral synthetic values that exercise the same abstract wildcard mechanics without copying tokens, structure, identifiers, or domain hints from the screenshot.

## Background
- Flexible row-key matching is already feature-gated by `normalization.flexible_key_matching`; exact matching remains the default path (`src/comparison/engine.rs:51-55`).
- Rows are split into keyed vs nullish before exact or flexible matching. Any selected key component that normalizes to null becomes an unkeyed row and is excluded from wildcard matching (`src/comparison/engine.rs:28-49`, `src/comparison/rows.rs:29-60`).
- Current wildcard semantics are implemented in `flexible_keys_match`: each key component must match its counterpart, `**` is the wildcard token, single `*` remains literal, and both-sided wildcard patterns are checked for intersection (`src/comparison/rows.rs:63-171`).
- Flexible candidates are selected with deterministic preferences: exact match first, then more literal wildcard content, fewer wildcard tokens, source row order, and key ordering (`src/comparison/engine.rs:109-215`).
- The frontend exposes the feature through `Enable ** wildcard matching for row keys` and passes the normalization flag through; it does not implement row matching locally (`frontend/src/components/mapping-config/NormalizationPanel.tsx:72-81`, `frontend/src/hooks/useComparisonWorkflow.reducer.ts:105-127`).
- Auto-pairing is a separate comparison-column helper and should not be changed for this row-key fix (`docs/auto-pairing.md:7-25`, `docs/auto-pairing.md:47`, `frontend/src/features/mapping/autoPair.ts:16-52`).
- Existing tests already cover disabled-literal behavior, one-sided `**`, single `*` literal behavior, zero-character/infix patterns, File B patterns, both-sided patterns, overlapping candidates, multi-column keys, normalization, and ambiguity ordering (`tests/comparison_engine_integration.rs:604-1009`).

## Approach
Start with one privacy-safe failing regression, not a broad matrix. The regression should abstract the failure into neutral terms and answer two ordering questions before implementation begins:

1. Does at least one normalized key component contain explicit `**`?
2. Do both sides still have the same selected-key component count after extraction?

If the answer to either is no, do not silently broaden wildcard behavior. That becomes a product decision about implicit/fuzzy row-key matching or selected-key shape, not a small backend wildcard fix.

If the failing shape does contain explicit `**` and equal component counts, keep the fix inside the Rust flexible-matching seam. Preserve current component-wise matching first. Only if component-wise matching fails should a fallback consider wildcard text that spans selected-key component boundaries.

That fallback must be boundary-aware, not a naive string concatenation. Represent keys as structured token streams with explicit component-boundary tokens, and let `**` consume literal characters and boundaries while literal characters cannot match a boundary. This avoids delimiter/escaping collisions while allowing the intended cross-boundary wildcard case.

Keep the first implementation narrow:
- Exact mode remains unchanged.
- `**` remains the only wildcard token; single `*` remains literal.
- Nullish selected-key components continue to produce unkeyed rows before flexible matching.
- Existing duplicate handling and maximum-cardinality candidate selection remain intact.
- No frontend, API, snapshot, or auto-pairing change unless a regression proves the flag is not reaching the backend.

## Work Items
1. **Add one neutral failing regression.**
   - Place it near the existing flexible-key coverage in `tests/comparison_engine_integration.rs:604-1009`.
   - Use generic synthetic tokens only, such as `GROUP`, `001`, `TAIL`, `CODE`, `same`, `left`, and `right`.
   - Assert that, with `flexible_key_matching: true`, the abstracted rows produce one paired result instead of one `MissingRight` plus one `MissingLeft`.
   - Add only the minimum guardrails needed for the chosen abstraction: non-wildcard redistributed components do not match, and single `*` remains literal.

2. **Classify the seam from that regression.**
   - Explicit `**` + equal component counts + component-wise miss: proceed with a backend wildcard fallback.
   - Explicit `**` + normalization surprise: add/adjust tests around `src/comparison/value_compare.rs` expectations before changing wildcard parsing.
   - No explicit `**`: stop and revise the product contract before implementing implicit substring/fuzzy row-key matching.
   - Payload flag missing: add a frontend reducer/transport regression around `frontend/src/hooks/useComparisonWorkflow.reducer.ts:105-127`; otherwise leave frontend code unchanged.

3. **Implement the smallest backend fallback if needed.**
   - In `src/comparison/rows.rs`, split matching into a private classification helper that can return exact, component-wise wildcard, boundary-aware fallback wildcard, or no match.
   - Reuse the existing wildcard tokenizer/matcher concepts; do not duplicate normalization or comparison logic.
   - For fallback matching, use structured boundary tokens rather than joined strings so there is no delimiter collision.
   - Keep `flexible_keys_match` as a boolean wrapper if existing callers still need it.

4. **Preserve candidate ordering.**
   - In `src/comparison/engine.rs`, store match strength on `FlexibleCandidate` if fallback matching is added.
   - Preserve maximum-cardinality selection first.
   - Then prefer exact matches, component-wise wildcard matches, fallback wildcard matches, more literal wildcard content, fewer wildcard tokens, row order, and key order.
   - Add a guardrail where an existing component-wise match beats a fallback match when both are possible.

5. **Keep the user-facing contract explicit.**
   - Leave UI copy and API shape unchanged for an explicit-`**` fix.
   - Do not add fuzzy row-key matching, implicit contains matching, or single-`*` wildcard semantics in this pass.
   - Keep all tests, comments, docs, snapshots, and commit messages free of the sensitive example or lookalike data.

## Verification Plan
- Targeted regression first: `cargo test --test comparison_engine_integration flexible`.
- Nullish-key guardrail: `cargo test --test nullish_key_handling_integration`.
- Full shared Rust validation after implementation: `cargo fmt --check && cargo test && cargo clippy -- -D warnings`.
- Frontend validation only if request construction, UI copy, or payload tests change: `cd frontend && npm run build` plus targeted Vitest for mapping/workflow tests.

## Open Questions
- The exact sensitive key values are intentionally excluded. Implementation should proceed only from a privacy-safe abstraction of the failure.
- If the sanitized failing case has no explicit `**`, should CSV Align expand beyond wildcard semantics into implicit contains/fuzzy row-key matching, or should the UI make the explicit `**` requirement clearer?

## References
- `src/comparison/engine.rs`
- `src/comparison/rows.rs`
- `src/comparison/value_compare.rs`
- `src/backend/validation.rs`
- `frontend/src/components/mapping-config/NormalizationPanel.tsx`
- `frontend/src/hooks/useComparisonWorkflow.reducer.ts`
- `frontend/src/features/mapping/autoPair.ts`
- `docs/auto-pairing.md`
- `tests/comparison_engine_integration.rs`
- `tests/nullish_key_handling_integration.rs`
