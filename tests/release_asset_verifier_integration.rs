use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use serde_json::Value;
use tempfile::tempdir;

const TAG: &str = "v9.9.9";
const VERSION: &str = "9.9.9";
const MANIFEST: &str = "release-assets-manifest.json";

type AssetMutation = fn(&ReleaseAssetFixture);
type RejectionCase = (&'static str, AssetMutation, &'static str);

#[test]
fn exact_assets_write_and_verify_deterministic_size_and_sha256_manifest() {
    let fixture = ReleaseAssetFixture::new();
    let output = fixture.run(["--tag", TAG, "--write-manifest"]);

    assert!(output.status.success(), "{output:#?}");

    let manifest_path = fixture.assets.join(MANIFEST);
    let first = fs::read_to_string(&manifest_path).expect("read manifest");
    let document: Value = serde_json::from_str(&first).expect("parse manifest");
    assert_eq!(document["schema_version"], 1);
    assert_eq!(document["tag"], TAG);
    assert_eq!(document["version"], VERSION);

    let assets = document["assets"].as_array().expect("manifest assets");
    assert_eq!(assets.len(), 9);
    let names: Vec<_> = assets
        .iter()
        .map(|asset| asset["name"].as_str().expect("asset name"))
        .collect();
    let mut sorted = names.clone();
    sorted.sort_unstable();
    assert_eq!(names, sorted, "manifest assets must be basename-sorted");
    assert!(assets.iter().all(|asset| {
        asset["size"].as_u64().is_some_and(|size| size > 0)
            && asset["sha256"]
                .as_str()
                .is_some_and(|digest| digest.len() == 64)
    }));

    let verify = fixture.run(["--tag", TAG, "--verify-manifest"]);
    assert!(verify.status.success(), "{verify:#?}");

    fs::remove_file(&manifest_path).expect("remove manifest");
    let rewrite = fixture.run(["--tag", TAG, "--write-manifest"]);
    assert!(rewrite.status.success(), "{rewrite:#?}");
    assert_eq!(
        fs::read_to_string(manifest_path).expect("read rewritten manifest"),
        first
    );
}

#[test]
fn verifier_rejects_missing_extra_duplicate_empty_and_version_mismatched_assets() {
    let cases: &[RejectionCase] = &[
        (
            "missing",
            |fixture| {
                fs::remove_file(fixture.assets.join(format!("CSV.Align_{VERSION}_x64.dmg")))
                    .expect("remove asset");
            },
            "missing:",
        ),
        (
            "extra",
            |fixture| {
                fs::write(fixture.assets.join("unexpected.zip"), b"extra")
                    .expect("write extra asset");
            },
            "extra:",
        ),
        (
            "duplicate",
            |fixture| {
                let nested = fixture.assets.join("nested");
                fs::create_dir(&nested).expect("create nested directory");
                fs::write(
                    nested.join(format!("CSV.Align_{VERSION}_amd64.AppImage")),
                    b"duplicate",
                )
                .expect("write duplicate asset");
            },
            "duplicate release asset basename",
        ),
        (
            "empty",
            |fixture| {
                fs::write(
                    fixture
                        .assets
                        .join(format!("CSV.Align_{VERSION}_aarch64.dmg")),
                    b"",
                )
                .expect("empty asset");
            },
            "release asset is empty",
        ),
        (
            "version",
            |fixture| {
                fs::rename(
                    fixture
                        .assets
                        .join(format!("CSV.Align_{VERSION}_amd64.deb")),
                    fixture.assets.join("CSV.Align_9.9.8_amd64.deb"),
                )
                .expect("rename version-mismatched asset");
            },
            "CSV.Align_9.9.9_amd64.deb",
        ),
    ];

    for (name, mutate, expected_error) in cases {
        let fixture = ReleaseAssetFixture::new();
        mutate(&fixture);
        let output = fixture.run(["--tag", TAG]);
        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(!output.status.success(), "{name} unexpectedly passed");
        assert!(
            stderr.contains(expected_error),
            "{name} stderr did not contain {expected_error:?}: {stderr}"
        );
    }
}

#[test]
fn verifier_rejects_bad_setup_checksum_and_tampered_manifest() {
    let fixture = ReleaseAssetFixture::new();
    fs::write(
        fixture
            .assets
            .join("csv-align-repository-setup_1.0_all.deb.sha256"),
        format!(
            "{}  csv-align-repository-setup_1.0_all.deb\n",
            "0".repeat(64)
        ),
    )
    .expect("tamper setup checksum");

    let bad_checksum = fixture.run(["--tag", TAG]);
    assert!(!bad_checksum.status.success(), "{bad_checksum:#?}");
    assert!(
        String::from_utf8_lossy(&bad_checksum.stderr).contains("SHA-256 sidecar does not match")
    );

    let fixture = ReleaseAssetFixture::new();
    let write = fixture.run(["--tag", TAG, "--write-manifest"]);
    assert!(write.status.success(), "{write:#?}");
    fs::write(
        fixture
            .assets
            .join(format!("CSV.Align_{VERSION}_aarch64.dmg")),
        b"changed after manifest",
    )
    .expect("tamper payload");

    let verify = fixture.run(["--tag", TAG, "--verify-manifest"]);
    assert!(!verify.status.success(), "{verify:#?}");
    assert!(
        String::from_utf8_lossy(&verify.stderr)
            .contains("manifest does not match the exact files, sizes, and SHA-256 hashes")
    );
}

#[test]
fn platform_stages_have_exact_independent_contracts() {
    let fixture = ReleaseAssetFixture::new();
    let linux_dir = fixture.root.path().join("linux");
    let arm_dir = fixture.root.path().join("arm");
    fs::create_dir(&linux_dir).expect("create linux stage");
    fs::create_dir(&arm_dir).expect("create arm stage");

    for name in linux_names() {
        fs::copy(fixture.assets.join(&name), linux_dir.join(name)).expect("copy Linux asset");
    }
    let arm_name = format!("CSV.Align_{VERSION}_aarch64.dmg");
    fs::copy(fixture.assets.join(&arm_name), arm_dir.join(&arm_name)).expect("copy ARM asset");

    let linux = fixture.run_in(&linux_dir, ["--tag", TAG, "--platform", "linux"]);
    assert!(linux.status.success(), "{linux:#?}");
    let arm = fixture.run_in(&arm_dir, ["--tag", TAG, "--platform", "macos-aarch64"]);
    assert!(arm.status.success(), "{arm:#?}");
}

struct ReleaseAssetFixture {
    root: tempfile::TempDir,
    assets: PathBuf,
}

impl ReleaseAssetFixture {
    fn new() -> Self {
        let root = tempdir().expect("temp dir");
        let assets = root.path().join("assets");
        fs::create_dir(&assets).expect("create assets");

        for name in all_names() {
            fs::write(assets.join(&name), format!("fixture bytes for {name}\n"))
                .expect("write asset");
        }
        let setup_path = assets.join("csv-align-repository-setup_1.0_all.deb");
        let digest = sha256sum(&setup_path);
        fs::write(
            assets.join("csv-align-repository-setup_1.0_all.deb.sha256"),
            format!("{digest}  csv-align-repository-setup_1.0_all.deb\n"),
        )
        .expect("write setup checksum");

        Self { root, assets }
    }

    fn run<const N: usize>(&self, args: [&str; N]) -> Output {
        self.run_in(&self.assets, args)
    }

    fn run_in<const N: usize>(&self, assets: &Path, args: [&str; N]) -> Output {
        Command::new("python3")
            .arg(script_path())
            .arg(assets)
            .args(args)
            .output()
            .expect("run release asset verifier")
    }
}

fn all_names() -> Vec<String> {
    let mut names = linux_names();
    names.extend([
        format!("CSV.Align_{VERSION}_aarch64.dmg"),
        format!("CSV.Align_{VERSION}_x64.dmg"),
    ]);
    names
}

fn linux_names() -> Vec<String> {
    vec![
        format!("CSV.Align_{VERSION}_amd64.deb"),
        format!("csv-align-{VERSION}-1.x86_64.rpm"),
        format!("CSV.Align_{VERSION}_amd64.AppImage"),
        "csv-align-repository-setup_1.0_all.deb".into(),
        "csv-align-repository-setup_1.0_all.deb.sha256".into(),
        "csv-align-repository-setup_1.0_all.deb.sha256.asc".into(),
        "install-apt-repo.sh".into(),
    ]
}

fn script_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/verify_release_assets.py")
}

fn sha256sum(path: &Path) -> String {
    let output = Command::new("python3")
        .arg("-c")
        .arg("import hashlib, pathlib, sys; print(hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())")
        .arg(path)
        .output()
        .expect("calculate fixture SHA-256");
    assert!(output.status.success(), "{output:#?}");
    String::from_utf8(output.stdout)
        .expect("SHA-256 output")
        .trim()
        .to_owned()
}
