use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use tempfile::tempdir;

const VERSION: &str = "9.9.9";

#[test]
fn expected_version_accepts_non_empty_matching_changelog_entry() {
    let fixture = ReleaseMetadataFixture::new(
        "# Changelog\n\n## v9.9.9 - 2026-04-21\n\n- Prepare a release.\n",
    );

    let output = fixture.run(["--expected-version", VERSION]);

    assert!(output.status.success(), "{output:#?}");
    assert!(String::from_utf8_lossy(&output.stdout).contains(VERSION));
}

#[test]
fn expected_version_rejects_missing_changelog_entry() {
    let fixture = ReleaseMetadataFixture::new(
        "# Changelog\n\n## v9.9.8 - 2026-04-21\n\n- Previous release.\n",
    );

    let output = fixture.run(["--expected-version", VERSION]);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(stderr.contains("No CHANGELOG.md section found for tag v9.9.9"));
}

#[test]
fn expected_version_rejects_empty_changelog_entry() {
    let fixture = ReleaseMetadataFixture::new(
        "# Changelog\n\n## v9.9.9 - 2026-04-21\n\n## v9.9.8 - 2026-04-20\n\n- Previous release.\n",
    );

    let output = fixture.run(["--expected-version", VERSION]);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(stderr.contains("CHANGELOG.md section for tag v9.9.9 is empty"));
}

#[test]
fn plain_metadata_check_does_not_require_changelog_entry() {
    let fixture = ReleaseMetadataFixture::new(
        "# Changelog\n\n## v9.9.8 - 2026-04-21\n\n- Previous release.\n",
    );

    let output = fixture.run(std::iter::empty::<&str>());

    assert!(output.status.success(), "{output:#?}");
}

#[test]
fn metadata_check_rejects_appstream_latest_release_version_drift() {
    let fixture = ReleaseMetadataFixture::new(
        "# Changelog\n\n## v9.9.9 - 2026-04-21\n\n- Prepare a release.\n",
    );
    fs::write(
        fixture
            .root
            .path()
            .join("src-tauri/appstream/com.csvalign.desktop.metainfo.xml"),
        "<component><releases><release version=\"9.9.8\" date=\"2026-04-21\" /></releases></component>",
    )
    .expect("write appstream drift");

    let output = fixture.run(std::iter::empty::<&str>());
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(
        stderr.contains(
            "src-tauri/appstream/com.csvalign.desktop.metainfo.xml latest release: 9.9.8"
        )
    );
}

#[test]
fn release_docs_list_all_enforced_version_metadata_files() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let docs = fs::read_to_string(root.join("docs/releasing.md")).expect("read release docs");

    for path in [
        "Cargo.toml",
        "Cargo.lock",
        "src-tauri/Cargo.toml",
        "src-tauri/Cargo.lock",
        "src-tauri/tauri.conf.json",
        "src-tauri/appstream/com.csvalign.desktop.metainfo.xml",
        "frontend/package.json",
        "frontend/package-lock.json",
    ] {
        assert!(docs.contains(path), "release docs should list {path}");
    }
}

#[test]
fn macos_release_build_keeps_dmg_bundling_ci_safe_and_verbose() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let workflow = fs::read_to_string(root.join(".github/workflows/release.yml"))
        .expect("read release workflow");
    let docs = fs::read_to_string(root.join("docs/releasing.md")).expect("read release docs");

    assert!(
        workflow.contains("TAURI_BUNDLER_DMG_IGNORE_CI: 'false'"),
        "macOS release workflow should keep Tauri DMG bundling in CI-safe mode"
    );
    assert!(
        workflow.contains("cargo tauri build --verbose --target ${{ matrix.target }}"),
        "macOS release workflow should expose generated bundle_dmg.sh stderr"
    );
    assert!(
        docs.contains("TAURI_BUNDLER_DMG_IGNORE_CI=false"),
        "release docs should explain the macOS DMG CI setting"
    );
}

#[test]
fn release_workflow_stages_every_platform_and_centralizes_publication() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let workflow = fs::read_to_string(root.join(".github/workflows/release.yml"))
        .expect("read release workflow");

    assert!(workflow.contains("cancel-in-progress: false"));
    assert!(!workflow.contains("\n  create-release:"));

    let linux = workflow_job(&workflow, "stage-linux-release");
    assert!(linux.contains("needs: validate-release"));
    assert!(linux.contains("Upload uniquely named Linux release stage"));
    assert!(linux.contains("Upload uniquely named APT Pages stage"));
    assert!(linux.contains("version=\"${GITHUB_REF_NAME#v}\""));
    assert!(linux.contains(
        "cp \"${deb_assets[0]}\" \"staged-linux-assets/CSV.Align_${version}_amd64.deb\""
    ));
    assert!(linux.contains(
        "cp \"${appimage_assets[0]}\" \"staged-linux-assets/CSV.Align_${version}_amd64.AppImage\""
    ));
    assert!(!linux.contains("gh release"));
    assert!(!linux.contains("actions/deploy-pages"));

    let macos = workflow_job(&workflow, "stage-macos-release");
    assert!(macos.contains("aarch64-apple-darwin"));
    assert!(macos.contains("x86_64-apple-darwin"));
    assert!(macos.contains("Upload uniquely named macOS release stage"));
    assert!(macos.contains("cp \"${assets[0]}\" \"staged-macos-assets/${expected_name}\""));
    assert!(!macos.contains("macOS asset basename/version mismatch"));
    assert!(!macos.contains("gh release"));
    assert!(!macos.contains("actions/deploy-pages"));

    let publish = workflow_job(&workflow, "publish-release");
    assert!(
        publish.contains("needs: [validate-release, stage-linux-release, stage-macos-release]")
    );
    assert!(publish.contains("--write-manifest"));
    assert!(publish.contains("group: csv-align-release-publication"));
    assert!(publish.contains("state=\"published\""));
    assert!(publish.contains("Immutable release mismatch"));
    assert!(publish.contains("if: steps.release_state.outputs.state != 'published'"));
    assert!(publish.contains("(.draft | type == \"boolean\")"));
    assert!(publish.contains("immutable release metadata mismatch"));
    assert!(publish.contains("remaining_assets="));
    assert!(!publish.contains("done < <(gh api"));
    assert!(publish.contains("pool/main/c/csv-align/csv-align_${version}_amd64.deb"));
    assert!(publish.contains("dists/stable/main/binary-amd64/Packages"));
    assert!(publish.contains("dists/stable/main/dep11/Components-amd64.yml"));
    assert!(publish.contains("scripts/check_release_version_order.py"));
    assert!(publish.contains(
        "gh api --paginate \"repos/${REPOSITORY}/releases/${release_id}/assets?per_page=100\""
    ));
    assert!(publish.contains(
        "GitHub Pages is not enabled. Configure Pages to use GitHub Actions before the first release."
    ));
    assert!(publish.contains("steps.deploy_apt_pages.outputs.page_url"));
    assert!(!publish.contains("https://ddv1982.github.io/csv-align/apt"));

    let local_verify = publish
        .find("Assemble and verify complete managed release set")
        .expect("local complete-set verification");
    let classify = publish
        .find("Classify existing release")
        .expect("release classification");
    let rollback_guard = publish
        .find("Reject release and APT version rollback")
        .expect("monotonic release and APT guard");
    let replace = publish
        .find("Replace complete draft asset set")
        .expect("draft asset replacement");
    let draft_verify = publish
        .find("Redownload and verify exact draft assets")
        .expect("draft asset verification");
    let deploy = publish
        .find("Deploy verified APT repository to GitHub Pages")
        .expect("Pages deployment");
    let public_verify = publish
        .find("Verify public APT repository matches the staged site")
        .expect("public Pages verification");
    let undraft = publish
        .find("Publish GitHub Release after Pages verification")
        .expect("final undraft");

    assert!(local_verify < classify);
    assert!(classify < rollback_guard);
    assert!(rollback_guard < replace);
    assert!(replace < draft_verify);
    assert!(draft_verify < deploy);
    assert!(deploy < public_verify);
    assert!(public_verify < undraft);
    assert!(
        publish.trim_end().ends_with(
            "run: gh release edit \"${{ github.ref_name }}\" --repo \"${{ github.repository }}\" --draft=false --prerelease=false"
        ),
        "undrafting must remain the final publication operation"
    );
}

#[test]
fn release_workflow_pins_actionlint_and_setup_go() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let workflow = fs::read_to_string(root.join(".github/workflows/release.yml"))
        .expect("read release workflow");

    assert!(workflow.contains("actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16"));
    assert!(workflow.contains("go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12"));
    assert!(workflow.contains("\"$(go env GOPATH)/bin/actionlint\" .github/workflows/release.yml"));
}

struct ReleaseMetadataFixture {
    root: tempfile::TempDir,
    script_path: PathBuf,
}

impl ReleaseMetadataFixture {
    fn new(changelog: &str) -> Self {
        let root = tempdir().expect("temp dir");
        let script_path = root.path().join("scripts/check_release_metadata.py");

        fs::create_dir_all(root.path().join("scripts")).expect("create scripts dir");
        fs::create_dir_all(root.path().join("src-tauri")).expect("create src-tauri dir");
        fs::create_dir_all(root.path().join("src-tauri/appstream")).expect("create appstream dir");
        fs::create_dir_all(root.path().join("frontend")).expect("create frontend dir");

        fs::write(&script_path, release_script_source()).expect("write script");
        fs::write(
            root.path().join("Cargo.toml"),
            format!("[package]\nname = \"csv-align\"\nversion = \"{VERSION}\"\n"),
        )
        .expect("write Cargo.toml");
        fs::write(
            root.path().join("Cargo.lock"),
            lockfile_entry("csv-align", VERSION),
        )
        .expect("write Cargo.lock");
        fs::write(
            root.path().join("src-tauri/Cargo.toml"),
            format!("[package]\nname = \"csv-align-app\"\nversion = \"{VERSION}\"\n"),
        )
        .expect("write src-tauri Cargo.toml");
        fs::write(
            root.path().join("src-tauri/Cargo.lock"),
            format!(
                "{}\n{}",
                lockfile_entry("csv-align", VERSION),
                lockfile_entry("csv-align-app", VERSION),
            ),
        )
        .expect("write src-tauri Cargo.lock");
        fs::write(
            root.path().join("src-tauri/tauri.conf.json"),
            format!("{{\"version\":\"{VERSION}\"}}"),
        )
        .expect("write tauri conf");
        fs::write(
            root.path().join("src-tauri/appstream/com.csvalign.desktop.metainfo.xml"),
            format!(
                "<component><releases><release version=\"{VERSION}\" date=\"2026-04-21\" /></releases></component>"
            ),
        )
        .expect("write appstream metadata");
        fs::write(
            root.path().join("frontend/package.json"),
            format!("{{\"version\":\"{VERSION}\"}}"),
        )
        .expect("write package.json");
        fs::write(
            root.path().join("frontend/package-lock.json"),
            format!(
                "{{\"version\":\"{VERSION}\",\"packages\":{{\"\":{{\"version\":\"{VERSION}\"}}}}}}"
            ),
        )
        .expect("write package-lock.json");
        fs::write(root.path().join("CHANGELOG.md"), changelog).expect("write changelog");

        Self { root, script_path }
    }

    fn run<I, S>(&self, args: I) -> std::process::Output
    where
        I: IntoIterator<Item = S>,
        S: AsRef<std::ffi::OsStr>,
    {
        Command::new("python3")
            .arg(&self.script_path)
            .args(args)
            .current_dir(self.root.path())
            .output()
            .expect("run script")
    }
}

fn release_script_source() -> String {
    fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/check_release_metadata.py"),
    )
    .expect("read release metadata script")
}

fn workflow_job<'a>(workflow: &'a str, job: &str) -> &'a str {
    let marker = format!("  {job}:\n");
    let tail = workflow
        .split_once(&marker)
        .unwrap_or_else(|| panic!("missing workflow job {job}"))
        .1;
    tail.match_indices("\n  ")
        .find_map(|(index, _)| {
            tail[index + 3..]
                .chars()
                .next()
                .is_some_and(|character| !character.is_whitespace())
                .then_some(&tail[..index])
        })
        .unwrap_or(tail)
}

fn lockfile_entry(package_name: &str, version: &str) -> String {
    format!("[[package]]\nname = \"{package_name}\"\nversion = \"{version}\"\n")
}
