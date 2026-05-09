use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use serde_json::Value;
use tempfile::tempdir;

const APPSTREAM_ID: &str = "com.csvalign.desktop";
const DESKTOP_ID: &str = "CSV Align.desktop";
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
    assert!(report.contains("\"launchable\": \"CSV Align.desktop\""));
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
    let fixture = DebMetadataFixture::new("com.csvalign.desktop.desktop", DESKTOP_ID);

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

fn python3_path() -> PathBuf {
    let output = Command::new("python3")
        .arg("-c")
        .arg("import sys; print(sys.executable)")
        .output()
        .expect("resolve python3 path");
    assert!(output.status.success(), "{output:#?}");
    PathBuf::from(String::from_utf8_lossy(&output.stdout).trim())
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

const CREATE_DEB_FIXTURE_PY: &str = r#"
import io
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
    ar_member('data.tar.gz', tar_buffer.getvalue())
)
"#;
