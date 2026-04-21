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

fn lockfile_entry(package_name: &str, version: &str) -> String {
    format!("[[package]]\nname = \"{package_name}\"\nversion = \"{version}\"\n")
}
