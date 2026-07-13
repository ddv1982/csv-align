use super::test_support::REGISTERED_TAURI_COMMAND_NAMES;
use super::*;
use crate::commands::{
    export_results_html_to_path, export_results_to_path, load_csv, load_csv_bytes_async_with_args,
    load_csv_bytes_with_args, run_blocking, validate_html_export_document,
};
use csv_align::backend::limits::MAX_HTML_EXPORT_DOCUMENT_BYTES;
use csv_align::backend::{CompareRequest, CsvAlignError, MappingRequest, SuggestMappingsRequest};
use csv_align::data::types::{
    ComparisonConfig, ComparisonNormalizationConfig, RowComparisonResult,
};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use std::{env, fs};
use tauri::Manager;

fn read_json_fixture(path: &str) -> serde_json::Value {
    serde_json::from_str(path).unwrap()
}

fn csp_directives(csp: &str) -> HashMap<&str, Vec<&str>> {
    csp.split(';')
        .filter_map(|directive| {
            let mut tokens = directive.split_whitespace();
            let name = tokens.next()?;
            Some((name, tokens.collect::<Vec<_>>()))
        })
        .collect()
}

fn temp_output_path(test_name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("csv-align-{test_name}-{}", uuid::Uuid::new_v4()))
}

#[test]
fn tauri_spawn_blocking_runs_owned_work_on_a_worker_thread() {
    let command_thread = std::thread::current().id();
    let worker_thread =
        tauri::async_runtime::block_on(run_blocking(move || Ok(std::thread::current().id())))
            .unwrap();

    assert_ne!(worker_thread, command_thread);
}

#[test]
fn tauri_spawn_blocking_join_failure_keeps_the_typed_internal_error_shape() {
    let error = tauri::async_runtime::block_on(run_blocking::<()>(|| {
        panic!("intentional blocking worker panic")
    }))
    .unwrap_err();

    assert!(matches!(error, CsvAlignError::Internal(_)));
    assert!(error.to_string().contains("Blocking task failed"));
}

#[test]
fn tauri_spawn_blocking_preserves_write_errors() {
    let directory = temp_output_path("blocking-write-error");
    fs::create_dir(&directory).unwrap();
    let worker_path = directory.clone();

    let error = tauri::async_runtime::block_on(run_blocking(move || {
        export_results_html_to_path(&worker_path, "<html></html>")
    }))
    .unwrap_err();

    fs::remove_dir(directory).unwrap();
    assert!(matches!(error, CsvAlignError::Io(_)));
    assert!(
        error
            .to_string()
            .contains("Failed to save HTML export file")
    );
}

#[test]
fn tauri_csv_export_reports_direct_write_failures() {
    let store = SessionStore::default();
    let session_id = store.create();
    store
        .with_session_mut(&session_id, |session| {
            session.comparison_results = vec![RowComparisonResult::Match {
                key: vec!["1".to_string()],
                values_a: vec!["Alice".to_string()],
                values_b: vec!["Alice".to_string()],
            }];
            session.comparison_config = Some(ComparisonConfig {
                key_columns_a: vec!["id".to_string()],
                key_columns_b: vec!["id".to_string()],
                comparison_columns_a: vec!["name".to_string()],
                comparison_columns_b: vec!["name".to_string()],
                column_mappings: Vec::new(),
                normalization: ComparisonNormalizationConfig::default(),
            });
        })
        .unwrap();

    let output_directory = temp_output_path("direct-csv-write-error");
    fs::create_dir(&output_directory).unwrap();
    let error = export_results_to_path(&store, &session_id, &output_directory)
        .expect_err("writing a CSV to a directory should fail");
    fs::remove_dir(output_directory).unwrap();

    assert!(matches!(error, CsvAlignError::Io(_)));
}

#[test]
fn tauri_async_csv_load_captures_owned_input_and_commits() {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();

    let response = tauri::async_runtime::block_on(load_csv_bytes_async_with_args(
        Arc::clone(&store),
        session_id.clone(),
        "a".to_string(),
        "async.csv".to_string(),
        b"id,name\n1,Alice\n".to_vec(),
    ))
    .unwrap();

    assert_eq!(response.file_name, "async.csv");
    assert_eq!(
        store.with_session(&session_id, |session| session.csv_a.is_some()),
        Some(true)
    );
}

#[test]
fn measure_representative_tauri_mapping_command() {
    const COLUMN_COUNT: usize = 64;
    const ITERATIONS: u32 = 25;

    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));
    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;
    let columns = (0..COLUMN_COUNT)
        .map(|index| format!("column_{index:03}"))
        .collect::<Vec<_>>();
    let started = Instant::now();
    let mut last_mapping_count = 0;
    for _ in 0..ITERATIONS {
        last_mapping_count = suggest_mappings(
            app.state::<Arc<SessionStore>>(),
            session_id.clone(),
            SuggestMappingsRequest {
                columns_a: columns.clone(),
                columns_b: columns.clone(),
            },
        )
        .unwrap()
        .mappings
        .len();
    }
    let elapsed = started.elapsed();
    let average = elapsed / ITERATIONS;
    eprintln!(
        "representative mapping command: {COLUMN_COUNT}x{COLUMN_COUNT}, average {average:?} over {ITERATIONS} iterations"
    );

    assert_eq!(last_mapping_count, COLUMN_COUNT);
}

#[test]
fn frontend_tauri_command_map_matches_registered_backend_commands() {
    let frontend_commands = include_str!("../../frontend/src/services/tauriCommands.ts")
        .lines()
        .filter_map(|line| line.split('\'').nth(1))
        .collect::<Vec<_>>();

    assert_eq!(frontend_commands, REGISTERED_TAURI_COMMAND_NAMES);
}

#[test]
fn tauri_dialog_cancellation_wire_value_remains_stable() {
    assert_eq!(
        serde_json::to_string(&crate::commands::SaveDialogOutcome::Cancelled).unwrap(),
        "\"cancelled\""
    );
}

#[test]
fn checked_contract_matches_registered_backend_commands() {
    let contract = read_json_fixture(include_str!("../../contracts/transport-contract.json"));
    let contract_commands = contract["operations"]
        .as_array()
        .expect("contract operations should be an array")
        .iter()
        .map(|operation| {
            operation["tauriCommand"]
                .as_str()
                .expect("every operation should declare a Tauri command")
        })
        .collect::<Vec<_>>();

    assert_eq!(contract_commands, REGISTERED_TAURI_COMMAND_NAMES);
}

#[test]
fn tauri_config_defines_restrictive_content_security_policy() {
    let config = read_json_fixture(include_str!("../tauri.conf.json"));
    let security = &config["app"]["security"];
    let csp = security["csp"].as_str().unwrap();
    let dev_csp = security["devCsp"].as_str().unwrap();
    let directives = csp_directives(csp);
    let dev_directives = csp_directives(dev_csp);

    assert_eq!(directives["default-src"], ["'self'"]);
    assert_eq!(directives["script-src"], ["'self'"]);
    assert_eq!(directives["object-src"], ["'none'"]);
    assert_eq!(directives["frame-ancestors"], ["'none'"]);
    assert_eq!(
        directives["connect-src"],
        ["'self'", "ipc:", "http://ipc.localhost"]
    );
    assert!(!directives.values().flatten().any(|source| *source == "*"));
    assert!(dev_directives["connect-src"].contains(&"http://localhost:5173"));
    assert!(dev_directives["connect-src"].contains(&"ws://localhost:5173"));
}

#[test]
fn tauri_capability_is_limited_to_app_window_labels_and_required_permissions() {
    let capability = read_json_fixture(include_str!("../capabilities/default.json"));
    let windows = capability["windows"]
        .as_array()
        .unwrap()
        .iter()
        .map(|window| window.as_str().unwrap())
        .collect::<Vec<_>>();
    let permissions = capability["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|permission| permission.as_str().unwrap())
        .collect::<Vec<_>>();

    assert_eq!(windows, ["main", "app-*"]);
    assert!(!windows.contains(&"*"));
    assert_eq!(
        permissions,
        [
            "core:default",
            "core:webview:allow-create-webview-window",
            "dialog:allow-open",
            "dialog:allow-save"
        ]
    );
}

#[test]
fn tauri_command_wrappers_compare_then_export_use_stored_comparison_labels() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    load_csv_bytes_with_args(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "a.csv".to_string(),
        b"id,full_name\n1,Alice\n2,Bob\n".to_vec(),
    )
    .unwrap();

    load_csv_bytes_with_args(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "b".to_string(),
        "b.csv".to_string(),
        b"record_id,display_name\n1,Alice\n2,Robert\n".to_vec(),
    )
    .unwrap();

    let response = tauri::async_runtime::block_on(compare(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["record_id".to_string()],
            comparison_columns_a: vec!["full_name".to_string()],
            comparison_columns_b: vec!["display_name".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "full_name".to_string(),
                file_b_column: "display_name".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        },
    ))
    .unwrap();

    assert_eq!(response.summary.matches, 1);
    assert_eq!(response.summary.mismatches, 1);

    let output_path = temp_output_path("tauri-export-labels.csv");

    export_results_to_path(
        app.state::<Arc<SessionStore>>().inner().as_ref(),
        &session_id,
        &output_path,
    )
    .unwrap();

    let exported = std::fs::read_to_string(&output_path).unwrap();
    std::fs::remove_file(&output_path).unwrap();

    assert!(exported.contains("Key: id / record_id"));
    assert!(exported.contains("File A: full_name"));
    assert!(exported.contains("File B: display_name"));
    assert!(exported.contains("Mismatch,2,Bob,Robert"));
}

#[test]
fn tauri_export_results_html_writes_the_supplied_document() {
    let output_path = temp_output_path("tauri-export-results.html");
    let html_contents = "<!DOCTYPE html><html><body><h1>Exported Results</h1></body></html>";

    export_results_html_to_path(&output_path, html_contents).unwrap();

    let exported = std::fs::read_to_string(&output_path).unwrap();
    std::fs::remove_file(&output_path).unwrap();

    assert_eq!(exported, html_contents);
}

#[test]
fn tauri_html_export_enforces_utf8_document_bytes() {
    let exact_ascii = "x".repeat(MAX_HTML_EXPORT_DOCUMENT_BYTES);
    validate_html_export_document(&exact_ascii).expect("exact limit should pass");

    let oversized_unicode = format!("{}é", "x".repeat(MAX_HTML_EXPORT_DOCUMENT_BYTES - 1));
    let error = validate_html_export_document(&oversized_unicode)
        .expect_err("UTF-8 limit plus one should fail");

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert!(error.to_string().contains("40 MiB limit"));
    assert!(
        error
            .to_string()
            .contains("Use CSV export or reduce the result set.")
    );
}

#[test]
fn tauri_html_export_rejects_oversized_documents_before_writing() {
    let output_path = temp_output_path("tauri-oversized-export-results.html");
    let oversized = "x".repeat(MAX_HTML_EXPORT_DOCUMENT_BYTES + 1);

    let error = export_results_html_to_path(&output_path, &oversized)
        .expect_err("oversized document should fail");

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert!(!output_path.exists());
}

#[test]
fn tauri_commands_share_the_backend_session_store() {
    let app = tauri::test::mock_app();
    let store = Arc::new(SessionStore::default());
    app.manage(store.clone());

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    let observed = store.with_session(&session_id, |session| {
        (
            session.csv_a.is_none(),
            session.csv_b.is_none(),
            session.columns_a.len(),
            session.columns_b.len(),
        )
    });
    assert_eq!(observed, Some((true, true, 0, 0)));

    load_csv_bytes_with_args(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "shared.csv".to_string(),
        b"id,name\n1,Alice\n".to_vec(),
    )
    .unwrap();

    let loaded = store.with_session(&session_id, |session| {
        (
            session.csv_a.as_ref().and_then(|csv| csv.file_path.clone()),
            session
                .columns_a
                .iter()
                .map(|column| column.name.clone())
                .collect::<Vec<_>>(),
        )
    });

    assert_eq!(
        loaded,
        Some((
            Some("shared.csv".to_string()),
            vec!["id".to_string(), "name".to_string()]
        ))
    );
    delete_session(app.state::<Arc<SessionStore>>(), session_id.clone());
    assert_eq!(
        store.with_session(&session_id, |session| session.columns_a.len()),
        None
    );
}

#[test]
fn tauri_suggest_mappings_returns_not_found_for_unknown_sessions() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let error = suggest_mappings(
        app.state::<Arc<SessionStore>>(),
        "missing-session".to_string(),
        SuggestMappingsRequest {
            columns_a: vec!["FirstName".to_string()],
            columns_b: vec!["first_name".to_string()],
        },
    )
    .unwrap_err();

    assert!(matches!(error, CsvAlignError::NotFound { .. }));
    assert_eq!(error.to_string(), "Session not found");
}

#[test]
fn tauri_delete_session_is_a_no_op_for_unknown_ids() {
    let app = tauri::test::mock_app();
    let store = Arc::new(SessionStore::default());
    app.manage(store.clone());

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;
    let unknown_id = uuid::Uuid::new_v4().to_string();

    delete_session(app.state::<Arc<SessionStore>>(), unknown_id);

    assert!(store.with_session(&session_id, |_| ()).is_some());
}

#[test]
fn tauri_load_csv_variants_reject_empty_csv_payloads() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    let bytes_error = load_csv_bytes_with_args(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "empty.csv".to_string(),
        Vec::new(),
    )
    .unwrap_err();
    assert!(matches!(bytes_error, CsvAlignError::BadInput(_)));
    assert_eq!(bytes_error.to_string(), "CSV file is empty");

    let file_path = env::temp_dir()
        .join(format!(
            "csv-align-empty-file-test-{}",
            uuid::Uuid::new_v4()
        ))
        .join("picked-empty.csv");
    fs::create_dir_all(file_path.parent().unwrap()).unwrap();
    fs::write(&file_path, b"").unwrap();

    let path_error = tauri::async_runtime::block_on(load_csv(
        app.state::<Arc<SessionStore>>(),
        session_id,
        "b".to_string(),
        file_path.to_string_lossy().into_owned(),
    ))
    .unwrap_err();
    fs::remove_file(&file_path).unwrap();

    assert!(matches!(path_error, CsvAlignError::BadInput(_)));
    assert_eq!(path_error.to_string(), "CSV file is empty");
}

#[test]
fn tauri_load_csv_variants_return_base_file_name_in_response() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    let bytes_response = load_csv_bytes_with_args(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "nested/uploaded-a.csv".to_string(),
        b"id,name\n1,Alice\n".to_vec(),
    )
    .unwrap();
    assert_eq!(bytes_response.file_name, "uploaded-a.csv");

    let file_path = env::temp_dir()
        .join(format!("csv-align-file-name-test-{}", uuid::Uuid::new_v4()))
        .join("picked-b.csv");
    fs::create_dir_all(file_path.parent().unwrap()).unwrap();
    fs::write(&file_path, b"id,name\n1,Alice\n").unwrap();

    let path_response = tauri::async_runtime::block_on(load_csv(
        app.state::<Arc<SessionStore>>(),
        session_id,
        "b".to_string(),
        file_path.to_string_lossy().into_owned(),
    ))
    .unwrap();
    fs::remove_file(&file_path).unwrap();
    assert_eq!(path_response.file_name, "picked-b.csv");
}

#[test]
fn percent_decode_restores_non_ascii_file_names() {
    use crate::commands::percent_decode;

    assert_eq!(percent_decode("plain.csv"), "plain.csv");
    assert_eq!(percent_decode("with%20space.csv"), "with space.csv");
    assert_eq!(
        percent_decode("r%C3%A9sultats%20d%27avril.csv"),
        "résultats d'avril.csv"
    );
    assert_eq!(percent_decode("trailing%2"), "trailing%2");
}
