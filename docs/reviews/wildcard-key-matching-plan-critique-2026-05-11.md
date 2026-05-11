# Critique: Wildcard Key Matching Plan

## Context / Scope
Review of `docs/plans/wildcard-key-matching-2026-05-11.md`, limited to under-specified seams, contradictions/dependencies, over-planning risk, and ordering-changing questions. Spot-checked only `src/comparison/rows.rs`, `src/comparison/engine.rs`, and `src/comparison/value_compare.rs`; no sensitive example data is reproduced or inferred.

## Findings

### 1. Top 3 under-specified seams
1. **Composite fallback lacks a safe composite-key contract.** The plan says to compare “concatenated normalized key components” if a wildcard crosses selected-key boundaries (`docs/plans/wildcard-key-matching-2026-05-11.md:29`, `:47`), but does not specify delimiter, escaping, or collision rules. This matters because current matching is strictly component-wise (`src/comparison/rows.rs:63-69`); naive concatenation can create false positives between different component splits.
2. **Match strength API is not defined.** `flexible_keys_match` currently returns only `bool` (`src/comparison/rows.rs:63-69`), while candidate ordering currently stores only `exact_match`, literal count, and wildcard count (`src/comparison/engine.rs:171-207`). The plan asks to distinguish exact, component-wise wildcard, and fallback wildcard (`docs/plans/wildcard-key-matching-2026-05-11.md:45`, `:50-52`) but does not define the enum/contract that crosses `rows.rs` into `engine.rs`.
3. **Regression matrix is broader than the unknown seam.** Work Item 1 asks for one failing shape plus guardrails, but the dimensions list includes boundary crossing, normalization, no-wildcard behavior, multi-column differences, and one-sided patterns (`docs/plans/wildcard-key-matching-2026-05-11.md:20`, `:32-36`). Clarify the minimum first failing test; otherwise implementers may build a matrix before knowing which seam failed.

### 2. Contradictions or missing dependencies
- **“Composite fallback” and “equal key component counts” may conflict with the stated failure mode.** If the issue is truly wildcard text crossing selected-key component boundaries, requiring equal component counts (`docs/plans/wildcard-key-matching-2026-05-11.md:47`) may be either essential safety or the wrong constraint; the plan should decide before coding.
- **Normalization diagnosis names `value_compare.rs`, but wildcard matching sees only already-normalized strings.** `normalize_key_value` returns `Option<String>` before row splitting (`src/comparison/value_compare.rs:42-48`; `src/comparison/rows.rs:33-49`). If normalization is the miss (`docs/plans/wildcard-key-matching-2026-05-11.md:41`), implementation likely belongs in tests/config expectations, not wildcard parser changes.
- **No dependency on a concrete privacy-safe abstraction.** The plan forbids sensitive examples (`docs/plans/wildcard-key-matching-2026-05-11.md:6`, `:56`) but still says to assert “the current bad shape directly” (`:35`). That needs a sanitized shape description before Work Item 1 starts.

### 3. Risk of over-planning — cut or simplify
- Cut frontend and auto-pairing references from the first implementation path unless a test proves the flag is dropped. The plan already says frontend should stay out (`docs/plans/wildcard-key-matching-2026-05-11.md:18`, `:42`).
- Collapse Work Items 2 and 3 into “classify from one failing regression, then edit only that seam.” The current branch list invites speculative fixes.
- Defer UI copy/documentation work unless the answer changes from explicit `**` wildcard semantics to implicit/fuzzy matching (`docs/plans/wildcard-key-matching-2026-05-11.md:55`, `:67`).

### 4. Questions that would change implementation order
1. Does the sanitized failing case contain explicit `**` in at least one normalized key component? If no, stop before backend changes and make a product decision.
2. Is the key-component count equal on both sides after selected-column extraction? If no, composite fallback as planned may be the wrong seam.
3. What delimiter/escaping rule, if any, makes composite matching collision-safe? This must be answered before adding fallback matching.
4. Should fallback matches ever reduce maximum-cardinality matching, or only act as weaker tie-break candidates after existing component-wise matches are preserved?
