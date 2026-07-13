use std::{
    fs,
    path::Path,
    process::{Command, Output},
};

use tempfile::tempdir;

fn run_version_check(candidate: &str, published_tags: &str, packages: Option<&str>) -> Output {
    let root = tempdir().expect("temp dir");
    let published_path = root.path().join("published-tags.txt");
    fs::write(&published_path, published_tags).expect("write published tags");

    let mut command = Command::new("python3");
    command
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/check_release_version_order.py"))
        .args([
            "--candidate",
            candidate,
            "--published-tags-file",
            published_path.to_str().expect("utf-8 path"),
        ]);

    if let Some(packages) = packages {
        let packages_path = root.path().join("Packages");
        fs::write(&packages_path, packages).expect("write Packages");
        command.args([
            "--hosted-packages-file",
            packages_path.to_str().expect("utf-8 path"),
        ]);
    }

    command.output().expect("run release version order check")
}

fn packages(version: &str) -> String {
    format!(
        "Package: csv-align\nVersion: {version}\nArchitecture: amd64\nFilename: pool/csv-align.deb\n"
    )
}

#[test]
fn newer_candidate_is_allowed_against_published_and_hosted_versions() {
    let output = run_version_check("2.2.0", "v2.0.0\nv2.1.99\n", Some(&packages("2.1.99")));

    assert!(output.status.success(), "{output:#?}");
}

#[test]
fn older_candidate_is_rejected_when_a_newer_release_is_published() {
    let output = run_version_check("2.1.0", "v2.2.0\n", None);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(stderr.contains("candidate 2.1.0 is older than public version 2.2.0"));
}

#[test]
fn older_candidate_is_rejected_when_pages_is_newer_than_published_releases() {
    let output = run_version_check("2.1.0", "v2.0.0\n", Some(&packages("2.2.0")));
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(stderr.contains("candidate 2.1.0 is older than public version 2.2.0"));
}

#[test]
fn malformed_public_versions_fail_closed() {
    let output = run_version_check("2.2.0", "not-a-version\n", None);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert_eq!(output.status.code(), Some(2));
    assert!(stderr.contains("must be a stable semantic version"));
}
