# Critique: Linux Debian License Metadata Plan

## Context / Scope
Review of `docs/plans/linux-deb-license-metadata-2026-05-09.md`, limited to underspecified seams, contradictions/dependencies, over-planning risk, and ordering-changing questions. Spot-checked only the named packaging/CI files.

## Findings

### 1. Top 3 under-specified seams
1. **Desktop-id contract is the real implementation hinge, but still lacks an owner.** The plan correctly says to compare AppStream launchable and generated desktop basename (`docs/plans/linux-deb-license-metadata-2026-05-09.md:21`) and currently source hard-codes `CSV Align.desktop` (`src-tauri/appstream/com.csvalign.desktop.metainfo.xml:11`). Clarify whether the contract is “accept Tauri output” or “force reverse-DNS desktop id”; otherwise Work Items 2–4 can proceed in the wrong direction.
2. **Validator inputs are too flexible for a release gate.** `expected/allowed desktop-id` (`docs/plans/linux-deb-license-metadata-2026-05-09.md:43`) invites multiple acceptable states. For CI/release, prefer one canonical desktop-id after Work Item 1; keep “allowed” only for investigation mode.
3. **Workflow insertion points need exact package/tool dependencies.** CI currently installs Linux build deps only (`.github/workflows/ci.yml:189-190`) and signs immediately after build (`.github/workflows/ci.yml:232-239`). Release installs only signature tools (`.github/workflows/release.yml:183-186`) before verifying/uploading (`.github/workflows/release.yml:284-293`). The plan says install `appstream` and `desktop-file-utils` if missing (`docs/plans/linux-deb-license-metadata-2026-05-09.md:53`) but should name exact steps/placement to avoid validating after signing or omitting release-job validator dependencies.

### 2. Contradictions or missing dependencies
- **“Open Questions: None blocking” conflicts with implementation-order reality.** The plan itself says the desktop basename changes implementation detail (`docs/plans/linux-deb-license-metadata-2026-05-09.md:74-75`), and Work Item 1 determines the immediate fix (`docs/plans/linux-deb-license-metadata-2026-05-09.md:30-33`). Treat that as blocking for metadata edits and tests, not just informational.
- **`desktopTemplate` is named without proof it is supported in this Tauri config shape.** The plan proposes `bundle.linux.deb.desktopTemplate` or another supported path (`docs/plans/linux-deb-license-metadata-2026-05-09.md:39`), but current config has no such field (`src-tauri/tauri.conf.json:33-40`). Verify support before planning around it.
- **Release validation depends on tools not installed in release job.** The release job installs `dpkg-sig gnupg` only (`.github/workflows/release.yml:183-186`), so `appstreamcli` / `desktop-file-validate` must be added there too if the same validator runs before upload.

### 3. Risk of over-planning — cut or simplify
- Cut most GNOME Software cache/client reproduction from first implementation. Keep it as fallback only after extracted `.deb` + `appstreamcli` prove MIT (`docs/plans/linux-deb-license-metadata-2026-05-09.md:22`, `72`).
- Defer docs expansion until the artifact validator exists. The maintainer reproduction section (`docs/plans/linux-deb-license-metadata-2026-05-09.md:60-63`) can be a short command block, not a parallel workstream.
- Skip optional source-script extension (`docs/plans/linux-deb-license-metadata-2026-05-09.md:49`) unless artifact validation leaves a source-only blind spot.

### 4. Questions that would change implementation order
1. Does extracted v2.1.61 contain `/usr/share/metainfo/...` at all? If no, fix Tauri file mapping before desktop-id work.
2. What exact desktop filename does Tauri generate in the `.deb`? This must be answered before editing AppStream or tests.
3. Can Tauri v2 configure the desktop filename/template cleanly in this repo? If no, validator should enforce observed output rather than pursue reverse-DNS renaming.
4. Should PR CI validate unsigned PR-built `.deb`s, or only main/tag signed artifacts? This decides whether validator dependency setup belongs in all Tauri builds or only release-producing branches.
