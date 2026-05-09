use std::{fs, path::Path};

use serde_json::Value;

#[test]
fn tauri_debian_bundle_declares_license_and_software_center_metadata() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let tauri_conf_path = root.join("src-tauri/tauri.conf.json");
    let tauri_conf: Value = serde_json::from_str(
        &fs::read_to_string(&tauri_conf_path).expect("read Tauri configuration"),
    )
    .expect("valid Tauri configuration JSON");

    let bundle = &tauri_conf["bundle"];
    assert_eq!(bundle["license"], "MIT");
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
            .get("/usr/share/metainfo/com.csvalign.desktop.metainfo.xml")
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
fn appstream_metainfo_exposes_mit_project_license() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let tauri_conf: Value = serde_json::from_str(
        &fs::read_to_string(root.join("src-tauri/tauri.conf.json"))
            .expect("read Tauri configuration"),
    )
    .expect("valid Tauri configuration JSON");
    let version = tauri_conf["version"]
        .as_str()
        .expect("Tauri configuration version");
    let metainfo =
        fs::read_to_string(root.join("src-tauri/appstream/com.csvalign.desktop.metainfo.xml"))
            .expect("read AppStream metainfo");

    assert!(metainfo.contains("<component type=\"desktop-application\">"));
    assert!(metainfo.contains("<id>com.csvalign.desktop</id>"));
    assert!(metainfo.contains("<metadata_license>MIT</metadata_license>"));
    assert!(metainfo.contains("<project_license>MIT</project_license>"));
    assert!(metainfo.contains("<launchable type=\"desktop-id\">CSV Align.desktop</launchable>"));
    assert!(metainfo.contains("<binary>csv-align</binary>"));
    assert!(metainfo.contains(&format!(
        "<release version=\"{version}\" date=\"2026-05-09\" />"
    )));
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
    assert!(copyright.contains("License: MIT"));
}
