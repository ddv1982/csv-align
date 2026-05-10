# GitHub-Hosted APT Setup Install Plan Critique

## Context / Scope
Review target: `docs/plans/github-hosted-apt-setup-install-2026-05-10.md`. Scope intentionally limited to underspecified seams, contradictions/dependencies, over-planning risk, and order-changing questions.

## Findings

### Top 3 under-specified seams
1. **Live URL validation timing is ambiguous.** The plan says implementation can proceed docs-only unless direct URL validation reveals an asset-name mismatch (`docs/plans/github-hosted-apt-setup-install-2026-05-10.md:51-55`, `:77-82`, `:84`). It does not separate what can be proven now from what is only provable after the next release. Current workflow hardcodes `setup_package="csv-align-repository-setup_1.0_all.deb"` and uploads `csv-align-repository-setup_*.deb` (`.github/workflows/release.yml:426`, `:475-484`), but the `latest/download` URL depends on the current latest release having that asset.
2. **README vs maintainer-doc drift prevention is stated but not mechanized.** Work item 2 says to mirror the README command block (`docs/plans/github-hosted-apt-setup-install-2026-05-10.md:60-62`), but verification is only a static docs check (`:73`). That is fine for docs-only work, but the seam should be clarified as “manual review only” rather than implying durable enforcement.
3. **Setup version bump policy has too many triggers for a docs-only change.** The plan lists repository URL, keyring path, source path, suite/component, architecture policy, or installed source semantics (`docs/plans/github-hosted-apt-setup-install-2026-05-10.md:64-65`). That is useful, but it is broader than the current implementation need and may distract from the direct URL install fix.

### Contradictions or missing dependencies
- No direct contradiction found. The plan’s “no workflow change required” decision (`docs/plans/github-hosted-apt-setup-install-2026-05-10.md:45-46`) is consistent with the workflow’s exact filename assignment and upload glob (`.github/workflows/release.yml:426`, `:475-484`).
- Missing dependency to name explicitly: the GitHub Releases `latest/download` URL only works after a release exists with `csv-align-repository-setup_1.0_all.deb` attached. That is outside docs-only implementation and belongs in release verification, not as a pre-edit blocker.

### Risk of over-planning: cut or simplify
- Cut the “add a release-side alias” branch unless validation proves a mismatch (`docs/plans/github-hosted-apt-setup-install-2026-05-10.md:69-71`). The workflow currently emits the exact filename, so this is speculative.
- Simplify the package-field checklist to a maintainer verification snippet only (`docs/plans/github-hosted-apt-setup-install-2026-05-10.md:65-66`, `:78-82`); avoid turning docs-only work into release automation work.
- Remove broad external references that do not affect this edit, especially GitHub Pages/Releases limits (`docs/plans/github-hosted-apt-setup-install-2026-05-10.md:88-90`).

### Questions that would change implementation order
1. Has the current latest GitHub Release already attached `csv-align-repository-setup_1.0_all.deb`? If no, update docs with a note that the direct URL becomes valid on the next release, or do release validation before announcing.
2. Should README changes be allowed before the direct URL is live? If no, release/upload validation must precede docs publication.
3. Is the setup package filename intended to remain fixed across setup-package version bumps? If no, docs should avoid a hardcoded `1.0` URL or the release workflow needs an alias first.
