use super::*;
use csv_align::backend::PairOrderSelection;
use std::sync::Arc;
use tauri::Manager;

fn temp_output_path(test_name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "csv-align-{test_name}-{}.txt",
        uuid::Uuid::new_v4()
    ))
}

#[test]
fn tauri_pair_order_commands_round_trip_saved_selection() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "a.csv".to_string(),
        b"id,name,value\n1,Alice,10\n".to_vec(),
    )
    .unwrap();

    load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "b".to_string(),
        "b.csv".to_string(),
        b"id,full_name,amount\n1,Alice,10\n".to_vec(),
    )
    .unwrap();

    let selection = PairOrderSelection {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string(), "value".to_string()],
        comparison_columns_b: vec!["full_name".to_string(), "amount".to_string()],
    };

    let output_path = temp_output_path("tauri-pair-order");

    save_pair_order(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        selection.clone(),
        output_path.to_string_lossy().into_owned(),
    )
    .unwrap();

    let loaded = load_pair_order(
        app.state::<Arc<SessionStore>>(),
        session_id,
        output_path.to_string_lossy().into_owned(),
    )
    .unwrap();

    std::fs::remove_file(output_path).unwrap();

    assert_eq!(loaded.selection, selection);
}
