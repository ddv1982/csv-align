use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use serde_json::Value;
use tempfile::tempdir;

const APPSTREAM_ID: &str = "com.csvalign.desktop";
const DESKTOP_ID: &str = "com.csvalign.desktop.desktop";
const LEGACY_TAURI_DESKTOP_ID: &str = "CSV Align.desktop";
const MAIN_BINARY: &str = "csv-align";
const PROJECT_LICENSE: &str = "MIT";

#[test]
fn tauri_debian_bundle_declares_license_and_software_center_metadata() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let tauri_conf = read_tauri_conf(root);

    let bundle = &tauri_conf["bundle"];
    assert_eq!(bundle["license"], PROJECT_LICENSE);
    assert_eq!(bundle["licenseFile"], "../LICENSE");

    let deb_files = bundle["linux"]["deb"]["files"]
        .as_object()
        .expect("Debian custom files map");

    assert_eq!(
        deb_files
            .get("/usr/share/doc/csv-align/copyright")
            .and_then(Value::as_str),
        Some("debian/copyright")
    );
    assert_eq!(
        deb_files
            .get(&format!("/usr/share/metainfo/{APPSTREAM_ID}.metainfo.xml"))
            .and_then(Value::as_str),
        Some("appstream/com.csvalign.desktop.metainfo.xml")
    );

    for source in deb_files.values().filter_map(Value::as_str) {
        assert!(
            root.join("src-tauri").join(source).exists(),
            "Debian bundle source file should exist: {source}"
        );
    }
}

#[test]
fn appstream_metainfo_matches_tauri_package_contracts() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let tauri_conf = read_tauri_conf(root);
    let metainfo =
        fs::read_to_string(root.join("src-tauri/appstream/com.csvalign.desktop.metainfo.xml"))
            .expect("read AppStream metainfo");

    let tauri_version = tauri_conf["version"]
        .as_str()
        .expect("Tauri configuration version");
    let tauri_identifier = tauri_conf["identifier"].as_str().expect("Tauri identifier");
    let tauri_binary = tauri_conf["mainBinaryName"]
        .as_str()
        .expect("Tauri main binary");

    assert!(metainfo.contains("<component type=\"desktop-application\">"));
    assert_eq!(xml_tag_text(&metainfo, "id"), tauri_identifier);
    assert_eq!(tauri_identifier, APPSTREAM_ID);
    assert_eq!(xml_tag_text(&metainfo, "metadata_license"), PROJECT_LICENSE);
    assert_eq!(xml_tag_text(&metainfo, "project_license"), PROJECT_LICENSE);
    assert_eq!(xml_tag_text(&metainfo, "binary"), tauri_binary);
    assert_eq!(tauri_binary, MAIN_BINARY);

    let launchable = xml_tag_text(&metainfo, "launchable");
    assert_eq!(launchable, DESKTOP_ID);
    assert!(
        metainfo.contains(&format!(
            "<launchable type=\"desktop-id\">{DESKTOP_ID}</launchable>"
        )),
        "AppStream launchable must stay on the observed Tauri desktop-id contract"
    );

    assert_eq!(release_version(&metainfo), tauri_version);
    assert_eq!(
        parse_package_version(&root.join("Cargo.toml")),
        tauri_version
    );
    assert_eq!(
        parse_package_version(&root.join("src-tauri/Cargo.toml")),
        tauri_version
    );
}

#[test]
fn debian_copyright_file_exposes_mit_license() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let copyright =
        fs::read_to_string(root.join("src-tauri/debian/copyright")).expect("read copyright file");

    assert!(
        copyright
            .contains("Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/")
    );
    assert!(copyright.contains("Upstream-Name: CSV Align"));
    assert!(copyright.contains("Source: https://github.com/ddv1982/csv-align"));
    assert!(copyright.contains(&format!("License: {PROJECT_LICENSE}")));
}

#[test]
fn linux_deb_metadata_validator_accepts_metadata_fixture() {
    let fixture = DebMetadataFixture::new(DESKTOP_ID, DESKTOP_ID);
    let report_path = fixture.root.path().join("report.json");

    let output = fixture.run([
        "--skip-external-tools".into(),
        "--json-report".into(),
        report_path.display().to_string(),
    ]);

    assert!(output.status.success(), "{output:#?}");
    let report = fs::read_to_string(report_path).expect("read JSON report");
    assert!(report.contains("\"project_license\": \"MIT\""));
    assert!(report.contains("\"launchable\": \"com.csvalign.desktop.desktop\""));
}

#[test]
fn apt_repository_builder_generates_unsigned_packages_release_and_dep11() {
    let fixture = DebMetadataFixture::new(DESKTOP_ID, DESKTOP_ID);
    let repo_dir = fixture.root.path().join("apt-repo");
    let spaced_source_deb = fixture.root.path().join("CSV Align_9.9.9_amd64.deb");
    fs::copy(&fixture.deb_path, &spaced_source_deb).expect("copy fixture to spaced source path");

    let output = Command::new(python3_path())
        .arg(apt_repository_script_path())
        .arg("--unsigned")
        .arg("--suite")
        .arg("test")
        .arg("--output")
        .arg(&repo_dir)
        .arg(&spaced_source_deb)
        .output()
        .expect("run APT repository builder");
    assert!(output.status.success(), "{output:#?}");

    let packages = fs::read_to_string(repo_dir.join("dists/test/main/binary-amd64/Packages"))
        .expect("read Packages");
    assert!(packages.contains("Package: csv-align"));
    assert!(packages.contains("Filename: pool/main/c/csv-align/csv-align_9.9.9_amd64.deb"));
    assert!(!packages.contains("CSV Align_9.9.9_amd64.deb"));
    assert!(
        repo_dir
            .join("dists/test/main/binary-amd64/Packages.gz")
            .is_file()
    );

    let release = fs::read_to_string(repo_dir.join("dists/test/Release")).expect("read Release");
    assert!(release.contains("Suite: test"));
    assert!(release.contains("Architectures: amd64"));
    assert!(release.contains("Date: "));
    assert!(release.contains("MD5Sum:"));
    assert!(release.contains("SHA1:"));
    assert!(release.contains("SHA256:"));
    assert!(release.contains("main/binary-amd64/Packages"));
    assert!(release.contains("main/dep11/Components-amd64.yml"));

    let dep11 = fs::read_to_string(repo_dir.join("dists/test/main/dep11/Components-amd64.yml"))
        .expect("read DEP-11 metadata");
    assert!(dep11.contains("File: DEP-11"));
    assert!(dep11.contains("Version: '1.0'"));
    assert!(dep11.contains("Architecture: 'amd64'"));
    assert!(dep11.contains("Package: 'csv-align'"));
    assert!(dep11.contains("ProjectLicense: 'MIT'"));
    assert!(dep11.contains("Launchable:\n  desktop-id:\n    - 'com.csvalign.desktop.desktop'"));
    assert!(
        repo_dir
            .join("dists/test/main/dep11/Components-amd64.yml.gz")
            .is_file()
    );
    assert!(
        repo_dir
            .join("pool/main/c/csv-align/csv-align_9.9.9_amd64.deb")
            .is_file()
    );
    assert!(
        !repo_dir
            .join("pool/main/c/csv-align/CSV Align_9.9.9_amd64.deb")
            .exists()
    );
    assert!(!repo_dir.join("dists/test/InRelease").exists());
    assert!(!repo_dir.join("dists/test/Release.gpg").exists());
}

#[test]
fn apt_repository_builder_generates_repository_setup_package() {
    let fixture = DebMetadataFixture::new(DESKTOP_ID, DESKTOP_ID);
    let repo_dir = fixture.root.path().join("apt-repo");
    let keyring_path = fixture.root.path().join("csv-align-archive-keyring.pgp");
    let setup_deb_path = fixture
        .root
        .path()
        .join("csv-align-repository-setup_1.0_all.deb");
    fs::write(&keyring_path, "fake test keyring\n").expect("write fake keyring");

    let output = Command::new(python3_path())
        .arg(apt_repository_script_path())
        .arg("--unsigned")
        .arg("--suite")
        .arg("stable")
        .arg("--output")
        .arg(&repo_dir)
        .arg("--setup-public-key")
        .arg(&keyring_path)
        .arg("--setup-package-out")
        .arg(&setup_deb_path)
        .arg(&fixture.deb_path)
        .output()
        .expect("run APT repository builder with setup package output");
    assert!(output.status.success(), "{output:#?}");
    assert!(setup_deb_path.is_file());

    let setup_package = inspect_deb_package(&setup_deb_path);
    let control = setup_package["control"].as_str().expect("control text");
    assert!(control.contains("Package: csv-align-repository-setup"));
    assert!(control.contains("Version: 1.0"));
    assert!(control.contains("Architecture: all"));
    assert!(control.contains("Depends: apt, ca-certificates"));

    let files = setup_package["files"].as_array().expect("file list");
    assert!(
        files
            .iter()
            .any(|file| file == "usr/share/keyrings/csv-align-archive-keyring.pgp")
    );
    assert!(
        files
            .iter()
            .any(|file| file == "etc/apt/sources.list.d/csv-align.sources")
    );
    assert_eq!(
        setup_package["keyring"].as_str(),
        Some("fake test keyring\n")
    );

    let sources = setup_package["sources"].as_str().expect("sources text");
    assert!(sources.contains("Types: deb"));
    assert!(sources.contains("URIs: https://ddv1982.github.io/csv-align/apt/"));
    assert!(sources.contains("Suites: stable"));
    assert!(sources.contains("Components: main"));
    assert!(sources.contains("Architectures: amd64"));
    assert!(sources.contains("Signed-By: /usr/share/keyrings/csv-align-archive-keyring.pgp"));

    assert_eq!(
        setup_package["conffiles"].as_str(),
        Some("/etc/apt/sources.list.d/csv-align.sources\n")
    );
}

#[test]
fn apt_repository_builder_signs_release_when_gpg_is_available() {
    let Some(gpg) = gpg_path() else {
        eprintln!("skipping APT repository signing test because gpg is unavailable");
        return;
    };

    let fixture = DebMetadataFixture::new(DESKTOP_ID, DESKTOP_ID);
    let gpg_home = fixture.root.path().join("gnupg");
    fs::create_dir(&gpg_home).expect("create gpg home");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&gpg_home, fs::Permissions::from_mode(0o700)).expect("chmod gpg home");
    }

    let key_id = "CSV Align Apt Repo Test <apt-repo-test@example.invalid>";
    let key_output = Command::new(&gpg)
        .arg("--batch")
        .arg("--homedir")
        .arg(&gpg_home)
        .arg("--passphrase")
        .arg("")
        .arg("--quick-gen-key")
        .arg(key_id)
        .arg("default")
        .arg("default")
        .arg("never")
        .output()
        .expect("create temporary gpg key");
    assert!(key_output.status.success(), "{key_output:#?}");

    let repo_dir = fixture.root.path().join("signed-apt-repo");
    let public_key_path = repo_dir.join("csv-align-archive-keyring.pgp");
    let output = Command::new(python3_path())
        .arg(apt_repository_script_path())
        .arg("--suite")
        .arg("test")
        .arg("--output")
        .arg(&repo_dir)
        .arg("--gpg-homedir")
        .arg(&gpg_home)
        .arg("--gpg-key")
        .arg(key_id)
        .arg("--public-key-out")
        .arg(&public_key_path)
        .arg(&fixture.deb_path)
        .output()
        .expect("run signed APT repository builder");
    assert!(output.status.success(), "{output:#?}");

    let in_release = repo_dir.join("dists/test/InRelease");
    let release_gpg = repo_dir.join("dists/test/Release.gpg");
    let release = repo_dir.join("dists/test/Release");
    assert!(in_release.is_file());
    assert!(release_gpg.is_file());
    assert!(release.is_file());
    assert!(public_key_path.is_file());

    let verify_inrelease = Command::new(&gpg)
        .arg("--batch")
        .arg("--homedir")
        .arg(&gpg_home)
        .arg("--verify")
        .arg(&in_release)
        .output()
        .expect("verify InRelease signature");
    assert!(verify_inrelease.status.success(), "{verify_inrelease:#?}");

    let verify_release_gpg = Command::new(&gpg)
        .arg("--batch")
        .arg("--homedir")
        .arg(&gpg_home)
        .arg("--verify")
        .arg(&release_gpg)
        .arg(&release)
        .output()
        .expect("verify Release.gpg signature");
    assert!(
        verify_release_gpg.status.success(),
        "{verify_release_gpg:#?}"
    );
}

#[test]
fn linux_deb_desktop_id_normalizer_rewrites_tauri_product_name_desktop_file() {
    let fixture = DebMetadataFixture::new(LEGACY_TAURI_DESKTOP_ID, LEGACY_TAURI_DESKTOP_ID);

    let normalize_output = Command::new(python3_path())
        .arg(normalizer_script_path())
        .arg(&fixture.deb_path)
        .output()
        .expect("run Linux deb desktop id normalizer");
    assert!(normalize_output.status.success(), "{normalize_output:#?}");

    let report_path = fixture.root.path().join("normalized-report.json");
    let validator_output = fixture.run([
        "--skip-external-tools".into(),
        "--json-report".into(),
        report_path.display().to_string(),
    ]);
    assert!(validator_output.status.success(), "{validator_output:#?}");

    let report = fs::read_to_string(report_path).expect("read JSON report");
    assert!(report.contains("\"launchable\": \"com.csvalign.desktop.desktop\""));
    assert!(
        report
            .contains("\"desktop_path\": \"/usr/share/applications/com.csvalign.desktop.desktop\"")
    );
    assert!(!report.contains("\"CSV Align.desktop\""));
}

#[test]
fn linux_deb_metadata_validator_requires_external_tools_in_gate_mode() {
    let fixture = DebMetadataFixture::new(DESKTOP_ID, DESKTOP_ID);
    let empty_path = tempdir().expect("empty PATH dir");

    let output = fixture.run_with_path(std::iter::empty::<String>(), empty_path.path());
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(
        stderr.contains("appstreamcli is required for gate validation but was not found"),
        "stderr should explain missing appstreamcli, got: {stderr}"
    );
    assert!(
        stderr.contains("desktop-file-validate is required for gate validation but was not found"),
        "stderr should explain missing desktop-file-validate, got: {stderr}"
    );
}

#[test]
fn linux_deb_metadata_validator_rejects_launchable_desktop_id_drift() {
    let fixture = DebMetadataFixture::new(LEGACY_TAURI_DESKTOP_ID, DESKTOP_ID);

    let output = fixture.run(["--skip-external-tools".to_string()]);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(
        stderr.contains("AppStream desktop launchable mismatch"),
        "stderr should explain launchable drift, got: {stderr}"
    );
}

#[test]
fn linux_deb_metadata_validator_rejects_missing_launchable() {
    let fixture = DebMetadataFixture::new("", DESKTOP_ID);

    let output = fixture.run(["--skip-external-tools".to_string()]);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(!output.status.success(), "{output:#?}");
    assert!(
        stderr.contains("AppStream desktop launchable is missing"),
        "stderr should explain missing launchable, got: {stderr}"
    );
}

struct DebMetadataFixture {
    root: tempfile::TempDir,
    deb_path: PathBuf,
}

impl DebMetadataFixture {
    fn new(launchable: &str, desktop_id: &str) -> Self {
        let root = tempdir().expect("temp dir");
        let deb_path = root.path().join("CSV.Align_9.9.9_amd64.deb");
        let output = Command::new(python3_path())
            .arg("-c")
            .arg(CREATE_DEB_FIXTURE_PY)
            .arg(&deb_path)
            .arg(launchable)
            .arg(desktop_id)
            .output()
            .expect("create deb fixture");
        assert!(output.status.success(), "{output:#?}");
        Self { root, deb_path }
    }

    fn run<I, S>(&self, args: I) -> Output
    where
        I: IntoIterator<Item = S>,
        S: AsRef<std::ffi::OsStr>,
    {
        self.run_command(args, None)
    }

    fn run_with_path<I, S>(&self, args: I, path: &Path) -> Output
    where
        I: IntoIterator<Item = S>,
        S: AsRef<std::ffi::OsStr>,
    {
        self.run_command(args, Some(path))
    }

    fn run_command<I, S>(&self, args: I, path: Option<&Path>) -> Output
    where
        I: IntoIterator<Item = S>,
        S: AsRef<std::ffi::OsStr>,
    {
        let mut command = Command::new(python3_path());
        command
            .arg(validator_script_path())
            .arg(&self.deb_path)
            .args(args);
        if let Some(path) = path {
            command.env("PATH", path);
        }
        command.output().expect("run Linux deb metadata validator")
    }
}

fn read_tauri_conf(root: &Path) -> Value {
    serde_json::from_str(
        &fs::read_to_string(root.join("src-tauri/tauri.conf.json"))
            .expect("read Tauri configuration"),
    )
    .expect("valid Tauri configuration JSON")
}

fn validator_script_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/validate_linux_deb_metadata.py")
}

fn normalizer_script_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/normalize_linux_deb_desktop_id.py")
}

fn apt_repository_script_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/build_apt_repository.py")
}

fn python3_path() -> PathBuf {
    let output = Command::new("python3")
        .arg("-c")
        .arg("import sys; print(sys.executable)")
        .output()
        .expect("resolve python3 path");
    assert!(output.status.success(), "{output:#?}");
    PathBuf::from(String::from_utf8_lossy(&output.stdout).trim())
}

fn inspect_deb_package(path: &Path) -> Value {
    let output = Command::new(python3_path())
        .arg("-c")
        .arg(INSPECT_DEB_PACKAGE_PY)
        .arg(path)
        .output()
        .expect("inspect deb package");
    assert!(output.status.success(), "{output:#?}");
    serde_json::from_slice(&output.stdout).expect("inspection JSON")
}

fn gpg_path() -> Option<PathBuf> {
    let output = Command::new("python3")
        .arg("-c")
        .arg("import shutil; print(shutil.which('gpg') or '')")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

fn xml_tag_text<'a>(xml: &'a str, tag: &str) -> &'a str {
    let start = format!("<{tag}>");
    let attr_start = format!("<{tag} ");
    let start_index = xml
        .find(&start)
        .map(|index| index + start.len())
        .or_else(|| {
            xml.find(&attr_start).map(|index| {
                xml[index..]
                    .find('>')
                    .map(|offset| index + offset + 1)
                    .expect("tag with attributes closes")
            })
        })
        .unwrap_or_else(|| panic!("missing <{tag}> tag"));
    let end = format!("</{tag}>");
    let end_index = xml[start_index..]
        .find(&end)
        .map(|offset| start_index + offset)
        .unwrap_or_else(|| panic!("missing </{tag}> tag"));
    xml[start_index..end_index].trim()
}

fn release_version(xml: &str) -> &str {
    let release_index = xml.find("<release ").expect("release element");
    attribute_value(&xml[release_index..], "version")
}

fn attribute_value<'a>(text: &'a str, attribute: &str) -> &'a str {
    let needle = format!("{attribute}=\"");
    let start = text.find(&needle).expect("attribute exists") + needle.len();
    let end = text[start..]
        .find('"')
        .map(|offset| start + offset)
        .expect("attribute closes");
    &text[start..end]
}

fn parse_package_version(path: &Path) -> String {
    let content = fs::read_to_string(path).unwrap_or_else(|error| panic!("read {path:?}: {error}"));
    let package_start = content.find("[package]").expect("[package] section");
    for line in content[package_start..].lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("version = ") {
            return rest.trim_matches('"').to_string();
        }
    }
    panic!("missing package version in {path:?}")
}

const INSPECT_DEB_PACKAGE_PY: &str = r#"
import io
import json
import pathlib
import sys
import tarfile

path = pathlib.Path(sys.argv[1])
entries = {}
with path.open('rb') as handle:
    if handle.read(8) != b'!<arch>\n':
        raise SystemExit('not a deb ar archive')
    while True:
        header = handle.read(60)
        if not header:
            break
        name = header[:16].decode('utf-8').strip().rstrip('/')
        size = int(header[48:58].decode('ascii').strip())
        data = handle.read(size)
        if size % 2:
            handle.read(1)
        entries[name] = data

result = {'files': []}
for archive_name, prefix in [('control.tar.gz', 'control'), ('data.tar.gz', 'data')]:
    with tarfile.open(fileobj=io.BytesIO(entries[archive_name]), mode='r:gz') as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            normalized = member.name.removeprefix('./')
            data = tar.extractfile(member).read()
            if archive_name == 'data.tar.gz':
                result['files'].append(normalized)
            if normalized == 'control':
                result['control'] = data.decode('utf-8')
            elif normalized == 'conffiles':
                result['conffiles'] = data.decode('utf-8')
            elif normalized == 'usr/share/keyrings/csv-align-archive-keyring.pgp':
                result['keyring'] = data.decode('utf-8')
            elif normalized == 'etc/apt/sources.list.d/csv-align.sources':
                result['sources'] = data.decode('utf-8')

print(json.dumps(result, sort_keys=True))
"#;

const CREATE_DEB_FIXTURE_PY: &str = r#"
import io
import hashlib
import pathlib
import sys
import tarfile

out_path = pathlib.Path(sys.argv[1])
launchable = sys.argv[2]
desktop_id = sys.argv[3]

metainfo = f'''<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>com.csvalign.desktop</id>
  <metadata_license>MIT</metadata_license>
  <project_license>MIT</project_license>
  <name>CSV Align</name>
  <summary>CSV file comparison tool</summary>
  <description>
    <p>CSV Align compares two CSV files, highlights matching and differing rows, supports configurable column mapping, and exports comparison results.</p>
  </description>
  <launchable type="desktop-id">{launchable}</launchable>
  <provides>
    <binary>csv-align</binary>
  </provides>
  <url type="homepage">https://github.com/ddv1982/csv-align</url>
  <developer id="com.csvalign">
    <name>Douwe de Vries</name>
  </developer>
  <releases>
    <release version="9.9.9" date="2026-05-09" />
  </releases>
</component>
'''

desktop = '''[Desktop Entry]
Type=Application
Name=CSV Align
Exec=csv-align
Icon=csv-align
StartupWMClass=csv-align
Categories=Utility;
'''

copyright = '''Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: CSV Align
Source: https://github.com/ddv1982/csv-align
License: MIT
'''

files = {
    './usr/share/metainfo/com.csvalign.desktop.metainfo.xml': metainfo,
    f'./usr/share/applications/{desktop_id}': desktop,
    './usr/share/doc/csv-align/copyright': copyright,
}

tar_buffer = io.BytesIO()
with tarfile.open(fileobj=tar_buffer, mode='w:gz') as tar:
    for name, content in files.items():
        data = content.encode('utf-8')
        info = tarfile.TarInfo(name)
        info.size = len(data)
        info.mode = 0o644
        info.mtime = 0
        tar.addfile(info, io.BytesIO(data))

md5sums = ''.join(
    f'{hashlib.md5(content.encode("utf-8")).hexdigest()}  {name.removeprefix("./")}\n'
    for name, content in sorted(files.items())
)
control = '''Package: csv-align
Version: 9.9.9
Architecture: amd64
Maintainer: CSV Align <noreply@example.invalid>
Description: CSV file comparison tool
'''

control_files = {
    './control': control,
    './md5sums': md5sums,
}

control_buffer = io.BytesIO()
with tarfile.open(fileobj=control_buffer, mode='w:gz') as tar:
    for name, content in control_files.items():
        data = content.encode('utf-8')
        info = tarfile.TarInfo(name)
        info.size = len(data)
        info.mode = 0o644
        info.mtime = 0
        tar.addfile(info, io.BytesIO(data))

def ar_member(name, data):
    encoded_name = f'{name}/'.encode('ascii')
    header = (
        encoded_name.ljust(16, b' ') +
        b'0'.ljust(12, b' ') +
        b'0'.ljust(6, b' ') +
        b'0'.ljust(6, b' ') +
        b'100644'.ljust(8, b' ') +
        str(len(data)).encode('ascii').ljust(10, b' ') +
        b'`\n'
    )
    padding = b'\n' if len(data) % 2 else b''
    return header + data + padding

out_path.write_bytes(
    b'!<arch>\n' +
    ar_member('debian-binary', b'2.0\n') +
    ar_member('control.tar.gz', control_buffer.getvalue()) +
    ar_member('data.tar.gz', tar_buffer.getvalue())
)
"#;
