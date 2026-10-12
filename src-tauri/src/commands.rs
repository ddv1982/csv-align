use std::sync::Arc;
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use tauri_plugin_dialog::{DialogExt, FilePath};
use tracing::instrument;

use csv_align::backend::limits::{
    MAX_HTML_EXPORT_DOCUMENT_BYTES, MAX_PAIR_ORDER_BYTES, MAX_SNAPSHOT_BYTES,
};
use csv_align::backend::{
    CompareRequest, CsvAlignError, CsvLoadSource, LoadComparisonSnapshotResponse,
    LoadPairOrderResponse, OperationToken, PairOrderSelection, SessionResponse, SessionStore,
    SuggestMappingsRequest, begin_comparison_for_session,
    begin_comparison_snapshot_load_for_session, begin_file_load_for_session,
    commit_comparison_for_session, commit_comparison_snapshot_load_for_session,
    commit_file_load_for_session, ensure_pair_order_size, ensure_snapshot_size,
    execute_comparison_for_session, load_csv_workflow, load_pair_order_for_session,
    parse_file_side, prepare_comparison_snapshot_load_bytes, save_comparison_snapshot_for_session,
    save_pair_order_for_session, suggest_mappings_for_session, validate_file_letter,
    write_export_results_for_session,
};
use csv_align::presentation::responses::{
    CompareResponse, FileLoadResponse, SuggestMappingsResponse,
};

/// Result of a save/export command that goes through a native save dialog.
///
/// `Option<()>` cannot express this over IPC: serde serializes both `Some(())`
/// and `None` to `null`, so the frontend could not tell saved from cancelled.
#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SaveDialogOutcome {
    Saved,
    Cancelled,
}

pub(crate) async fn run_blocking<T>(
    task: impl FnOnce() -> Result<T, CsvAlignError> + Send + 'static,
) -> Result<T, CsvAlignError>
where
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| CsvAlignError::Internal(format!("Blocking task failed: {error}")))?
}

fn write_output_file(
    output_path: &Path,
    contents: impl AsRef<[u8]>,
    file_kind: &str,
) -> Result<(), CsvAlignError> {
    csv_align::data::atomic_write::write_bytes_atomically(output_path, contents, file_kind).map_err(
        |error| match error {
            CsvAlignError::Io(error) => CsvAlignError::Io(std::io::Error::new(
                error.kind(),
                format!("Failed to save {file_kind} file: {error}"),
            )),
            other => other,
        },
    )
}

#[cfg(test)]
mod atomic_save_tests {
    use super::*;

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("csv-align-atomic-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    // Exercise the real path wrappers with valid backend state, not just the
    // common byte writer. Serialization round trips are covered separately.
    fn for_each_native_save(
        mut check: impl FnMut(&str, &[u8], &dyn Fn(&Path) -> Result<(), CsvAlignError>),
    ) {
        use csv_align::data::types::{ComparisonNormalizationConfig, FileSide};

        let store = SessionStore::default();
        let session_id = store.create();
        for (side, letter) in [(FileSide::A, "a"), (FileSide::B, "b")] {
            let token = begin_file_load_for_session(&store, &session_id, side).unwrap();
            let loaded = load_csv_workflow(
                letter,
                Some(format!("{letter}.csv")),
                CsvLoadSource::Bytes(b"id,name\n1,Alice\n".to_vec()),
            )
            .unwrap();
            commit_file_load_for_session(&store, &session_id, token, side, loaded).unwrap();
        }
        let selection = PairOrderSelection {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["name".to_string()],
            comparison_columns_b: vec!["name".to_string()],
        };
        let pending = begin_comparison_for_session(
            &store,
            &session_id,
            CompareRequest {
                key_columns_a: selection.key_columns_a.clone(),
                key_columns_b: selection.key_columns_b.clone(),
                comparison_columns_a: selection.comparison_columns_a.clone(),
                comparison_columns_b: selection.comparison_columns_b.clone(),
                column_mappings: vec![],
                normalization: ComparisonNormalizationConfig::default(),
            },
        )
        .unwrap();
        let execution = execute_comparison_for_session(&pending).unwrap();
        commit_comparison_for_session(&store, &session_id, pending, execution).unwrap();

        let html = "<!doctype html><html><body>Saved café</body></html>";
        check("HTML export", html.as_bytes(), &|path| {
            export_results_html_to_path(path, html)
        });
        let pair_order =
            save_pair_order_for_session(&store, &session_id, selection.clone()).unwrap();
        check("pair-order", pair_order.as_bytes(), &|path| {
            save_pair_order_to_path(&store, &session_id, selection.clone(), path)
        });
        let snapshot = save_comparison_snapshot_for_session(&store, &session_id).unwrap();
        check("comparison snapshot", snapshot.as_bytes(), &|path| {
            save_comparison_snapshot_to_path(&store, &session_id, path)
        });
    }

    #[cfg(unix)]
    #[test]
    fn native_text_saves_publish_a_new_file_instead_of_truncating_the_old_inode() {
        for kind in ["HTML export", "pair-order", "comparison snapshot"] {
            let directory = TestDirectory::new();
            let output = directory.0.join("output");
            let old_inode = directory.0.join("old-inode");
            fs::write(&output, b"original saved work").unwrap();
            fs::hard_link(&output, &old_inode).unwrap();
            write_output_file(&output, b"replacement", kind).unwrap();
            assert_eq!(fs::read(&output).unwrap(), b"replacement");
            let old_bytes = fs::read(&old_inode).unwrap();
            assert_eq!(old_bytes, b"original saved work", "{kind}");
        }
    }

    #[test]
    fn native_save_path_wrappers_create_and_replace_complete_documents() {
        for_each_native_save(|kind, expected, save| {
            let directory = TestDirectory::new();
            let output = directory.0.join("output");
            save(&output).unwrap();
            assert_eq!(fs::read(&output).unwrap(), expected, "{kind}: create");
            fs::write(&output, b"original saved work").unwrap();
            #[cfg(unix)]
            let old_inode = {
                let path = directory.0.join("old-inode");
                fs::hard_link(&output, &path).unwrap();
                path
            };
            save(&output).unwrap();
            assert_eq!(fs::read(&output).unwrap(), expected, "{kind}: overwrite");
            #[cfg(unix)]
            assert_eq!(
                fs::read(&old_inode).unwrap(),
                b"original saved work",
                "{kind}: old inode"
            );
            let mut names: Vec<_> = fs::read_dir(&directory.0)
                .unwrap()
                .map(|entry| entry.unwrap().file_name())
                .collect();
            names.sort();
            #[cfg(unix)]
            assert_eq!(names, ["old-inode", "output"].map(std::ffi::OsString::from));
            #[cfg(not(unix))]
            assert_eq!(names, [std::ffi::OsString::from("output")]);
        });
    }

    #[test]
    fn native_save_path_wrappers_report_missing_parents_without_side_effects() {
        for_each_native_save(|kind, _, save| {
            let directory = TestDirectory::new();
            let existing = directory.0.join("saved-work");
            fs::write(&existing, b"original saved work").unwrap();
            let output = directory.0.join("missing").join("output");
            let error = save(&output).unwrap_err();
            match error {
                CsvAlignError::Io(error) => {
                    assert_eq!(error.kind(), std::io::ErrorKind::NotFound, "{kind}");
                    assert!(error.to_string().contains(kind), "{error}");
                }
                other => panic!("{kind}: expected contextual I/O error, got {other:?}"),
            }
            assert!(!output.exists(), "{kind}");
            assert!(!directory.0.join("missing").exists(), "{kind}");
            assert_eq!(
                fs::read(&existing).unwrap(),
                b"original saved work",
                "{kind}"
            );
            assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1, "{kind}");

            #[cfg(unix)]
            {
                // A dangling destination link must survive a resolution failure.
                let link = directory.0.join("output-link");
                std::os::unix::fs::symlink("missing/output", &link).unwrap();
                match save(&link).unwrap_err() {
                    CsvAlignError::Io(error) => {
                        assert_eq!(error.kind(), std::io::ErrorKind::NotFound, "{kind}");
                        assert!(error.to_string().contains(kind), "{error}");
                    }
                    other => panic!("{kind}: expected contextual I/O error, got {other:?}"),
                }
                assert_eq!(fs::read_link(&link).unwrap(), Path::new("missing/output"));
                assert_eq!(
                    fs::read(&existing).unwrap(),
                    b"original saved work",
                    "{kind}"
                );
                assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 2, "{kind}");
            }
        });
    }

    #[cfg(unix)]
    #[test]
    fn native_save_path_wrappers_preserve_symlinks_and_target_permissions() {
        use std::os::unix::fs::{PermissionsExt, symlink};

        for_each_native_save(|kind, expected, save| {
            let directory = TestDirectory::new();
            let target = directory.0.join("target");
            let output = directory.0.join("output");
            fs::write(&target, b"original saved work").unwrap();
            fs::set_permissions(&target, fs::Permissions::from_mode(0o444)).unwrap();
            let old_inode = directory.0.join("old-inode");
            fs::hard_link(&target, &old_inode).unwrap();
            symlink("target", &output).unwrap();
            save(&output).unwrap();
            assert!(
                fs::symlink_metadata(&output)
                    .unwrap()
                    .file_type()
                    .is_symlink(),
                "{kind}"
            );
            assert_eq!(
                fs::read_link(&output).unwrap(),
                Path::new("target"),
                "{kind}"
            );
            assert_eq!(fs::read(&target).unwrap(), expected, "{kind}");
            assert_eq!(fs::read(&output).unwrap(), expected, "{kind}");
            assert_eq!(
                fs::read(&old_inode).unwrap(),
                b"original saved work",
                "{kind}"
            );
            assert_eq!(
                fs::metadata(&target).unwrap().permissions().mode() & 0o777,
                0o444,
                "{kind}"
            );
            assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 3, "{kind}");
        });
    }
}

fn selected_dialog_path(path: FilePath, file_kind: &str) -> Result<PathBuf, CsvAlignError> {
    path.into_path()
        .map_err(|error| CsvAlignError::BadInput(format!("Unsupported {file_kind} path: {error}")))
}

fn pick_file_path(
    app: &tauri::AppHandle,
    title: &str,
    filter_name: &str,
    extensions: &[&str],
    file_kind: &str,
) -> Result<Option<PathBuf>, CsvAlignError> {
    app.dialog()
        .file()
        .set_title(title)
        .add_filter(filter_name, extensions)
        .blocking_pick_file()
        .map(|path| selected_dialog_path(path, file_kind))
        .transpose()
}

fn save_file_path(
    app: &tauri::AppHandle,
    default_name: &str,
    filter_name: &str,
    extensions: &[&str],
    file_kind: &str,
) -> Result<Option<PathBuf>, CsvAlignError> {
    app.dialog()
        .file()
        .set_file_name(default_name)
        .add_filter(filter_name, extensions)
        .blocking_save_file()
        .map(|path| selected_dialog_path(path, file_kind))
        .transpose()
}

pub(crate) fn export_results_to_path(
    state: &SessionStore,
    session_id: &str,
    output_path: &Path,
) -> Result<(), CsvAlignError> {
    write_export_results_for_session(state, session_id, output_path)
}

pub(crate) fn validate_html_export_document(html_contents: &str) -> Result<(), CsvAlignError> {
    let byte_length = html_contents.len();
    if byte_length > MAX_HTML_EXPORT_DOCUMENT_BYTES {
        return Err(CsvAlignError::BadInput(format!(
            "HTML export document exceeds the {} MiB limit ({byte_length} UTF-8 bytes). Use CSV export or reduce the result set.",
            MAX_HTML_EXPORT_DOCUMENT_BYTES / 1024 / 1024
        )));
    }

    Ok(())
}

pub(crate) fn export_results_html_to_path(
    output_path: &Path,
    html_contents: &str,
) -> Result<(), CsvAlignError> {
    validate_html_export_document(html_contents)?;
    write_output_file(output_path, html_contents, "HTML export")
}

pub(crate) fn save_pair_order_to_path(
    state: &SessionStore,
    session_id: &str,
    selection: PairOrderSelection,
    output_path: &Path,
) -> Result<(), CsvAlignError> {
    let contents = save_pair_order_for_session(state, session_id, selection)?;
    write_output_file(output_path, contents, "pair-order")
}

pub(crate) fn load_pair_order_from_path(
    state: &SessionStore,
    session_id: &str,
    file_path: &Path,
) -> Result<LoadPairOrderResponse, CsvAlignError> {
    let file = fs::File::open(file_path).map_err(pair_order_read_error)?;
    validate_pair_order_file_metadata(&file)?;
    let contents = read_pair_order_contents(file)?;

    load_pair_order_for_session(state, session_id, &contents)
}

fn pair_order_read_error(error: std::io::Error) -> CsvAlignError {
    CsvAlignError::Io(std::io::Error::new(
        error.kind(),
        format!("Failed to read pair-order file: {error}"),
    ))
}

fn validate_pair_order_file_metadata(file: &fs::File) -> Result<(), CsvAlignError> {
    let metadata = file.metadata().map_err(pair_order_read_error)?;
    if metadata.len() > MAX_PAIR_ORDER_BYTES as u64 {
        ensure_pair_order_size(MAX_PAIR_ORDER_BYTES + 1)?;
    }
    Ok(())
}

fn read_pair_order_contents(reader: impl Read) -> Result<String, CsvAlignError> {
    let contents = read_limited(reader, MAX_PAIR_ORDER_BYTES).map_err(pair_order_read_error)?;
    ensure_pair_order_size(contents.len())?;
    String::from_utf8(contents).map_err(|error| {
        pair_order_read_error(std::io::Error::new(std::io::ErrorKind::InvalidData, error))
    })
}

#[cfg(test)]
mod pair_order_read_tests {
    use super::*;
    use std::io::{Cursor, Write};

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("csv-align-pair-order-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn pair_order_reader_accepts_exact_byte_limit_and_rejects_plus_one() {
        let exact = vec![b'a'; MAX_PAIR_ORDER_BYTES];
        assert_eq!(
            read_pair_order_contents(exact.as_slice()).unwrap().len(),
            exact.len()
        );
        let oversized = vec![b'a'; MAX_PAIR_ORDER_BYTES + 1];
        assert!(matches!(
            read_pair_order_contents(oversized.as_slice()),
            Err(CsvAlignError::BadInput(_))
        ));
    }

    #[test]
    fn pair_order_reader_counts_non_ascii_utf8_bytes_not_characters() {
        let exact = "é".repeat(MAX_PAIR_ORDER_BYTES / 2);
        assert_eq!(exact.len(), MAX_PAIR_ORDER_BYTES);
        assert_eq!(read_pair_order_contents(exact.as_bytes()).unwrap(), exact);
        let oversized = format!("{exact}a");
        assert!(oversized.chars().count() < MAX_PAIR_ORDER_BYTES);
        assert!(matches!(
            read_pair_order_contents(oversized.as_bytes()),
            Err(CsvAlignError::BadInput(_))
        ));
    }

    #[test]
    fn pair_order_reader_consumes_only_limit_plus_one_even_without_reliable_metadata() {
        let mut reader = Cursor::new(vec![b'a'; MAX_PAIR_ORDER_BYTES + 100]);
        assert!(matches!(
            read_pair_order_contents(&mut reader),
            Err(CsvAlignError::BadInput(_))
        ));
        assert_eq!(reader.position(), (MAX_PAIR_ORDER_BYTES + 1) as u64);
    }

    #[test]
    fn pair_order_reader_rejects_file_growth_after_metadata_precheck() {
        let directory = TestDirectory::new();
        let path = directory.0.join("pair-order.txt");
        fs::write(&path, b"small").unwrap();
        let mut file = fs::File::open(&path).unwrap();
        validate_pair_order_file_metadata(&file).unwrap();
        fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap()
            .write_all(&vec![b'a'; MAX_PAIR_ORDER_BYTES])
            .unwrap();
        assert!(matches!(
            read_pair_order_contents(&mut file),
            Err(CsvAlignError::BadInput(_))
        ));
        assert_eq!(
            std::io::Seek::stream_position(&mut file).unwrap(),
            (MAX_PAIR_ORDER_BYTES + 1) as u64
        );
    }

    #[test]
    fn pair_order_path_loader_reports_invalid_utf8_as_contextual_io_error() {
        let directory = TestDirectory::new();
        let path = directory.0.join("pair-order.txt");
        fs::write(&path, [0xff]).unwrap();
        let store = SessionStore::default();
        let session_id = store.create();
        match load_pair_order_from_path(&store, &session_id, &path).unwrap_err() {
            CsvAlignError::Io(error) => {
                assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
                assert!(error.to_string().contains("Failed to read pair-order file"));
            }
            other => panic!("expected invalid UTF-8 I/O error, got {other:?}"),
        }
    }

    #[test]
    fn pair_order_path_loader_accepts_saved_file_and_rejects_oversize_without_session_changes() {
        use csv_align::data::types::FileSide;

        let directory = TestDirectory::new();
        let path = directory.0.join("pair-order.txt");
        let store = SessionStore::default();
        let session_id = store.create();
        for (side, letter) in [(FileSide::A, "a"), (FileSide::B, "b")] {
            let token = begin_file_load_for_session(&store, &session_id, side).unwrap();
            let loaded = load_csv_workflow(
                letter,
                Some(format!("{letter}.csv")),
                CsvLoadSource::Bytes("id,名\n1,café\n".as_bytes().to_vec()),
            )
            .unwrap();
            commit_file_load_for_session(&store, &session_id, token, side, loaded).unwrap();
        }
        let selection = PairOrderSelection {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["名".to_string()],
            comparison_columns_b: vec!["名".to_string()],
        };
        save_pair_order_to_path(&store, &session_id, selection.clone(), &path).unwrap();
        let before = store
            .with_session(&session_id, |data| format!("{data:?}"))
            .unwrap();
        assert_eq!(
            load_pair_order_from_path(&store, &session_id, &path)
                .unwrap()
                .selection,
            selection
        );
        fs::write(&path, vec![b'a'; MAX_PAIR_ORDER_BYTES + 1]).unwrap();
        assert!(matches!(
            load_pair_order_from_path(&store, &session_id, &path),
            Err(CsvAlignError::BadInput(_))
        ));
        assert_eq!(
            store.with_session(&session_id, |data| format!("{data:?}")),
            Some(before)
        );
    }
}

pub(crate) fn save_comparison_snapshot_to_path(
    state: &SessionStore,
    session_id: &str,
    output_path: &Path,
) -> Result<(), CsvAlignError> {
    let contents = save_comparison_snapshot_for_session(state, session_id)?;
    write_output_file(output_path, contents, "comparison snapshot")
}

pub(crate) fn begin_comparison_snapshot_before_selection(
    state: &SessionStore,
    session_id: &str,
    select_file: impl FnOnce() -> Result<Option<PathBuf>, CsvAlignError>,
) -> Result<Option<(OperationToken, PathBuf)>, CsvAlignError> {
    let token = begin_comparison_snapshot_load_for_session(state, session_id)?;
    Ok(select_file()?.map(|file_path| (token, file_path)))
}

#[cfg(test)]
pub(crate) fn load_comparison_snapshot_from_path(
    state: &SessionStore,
    session_id: &str,
    file_path: &Path,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let selection = begin_comparison_snapshot_before_selection(state, session_id, || {
        Ok(Some(file_path.to_path_buf()))
    })?
    .expect("the test path is always selected");
    load_claimed_comparison_snapshot_from_path(state, session_id, selection.0, &selection.1)
}

fn load_claimed_comparison_snapshot_from_path(
    state: &SessionStore,
    session_id: &str,
    token: OperationToken,
    file_path: &Path,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let contents = read_comparison_snapshot_file(file_path)?;
    let prepared = prepare_comparison_snapshot_load_bytes(&contents)?;

    commit_comparison_snapshot_load_for_session(state, session_id, token, prepared)
}

fn snapshot_read_error(error: std::io::Error) -> CsvAlignError {
    CsvAlignError::Io(std::io::Error::new(
        error.kind(),
        format!("Failed to read comparison snapshot file: {error}"),
    ))
}

pub(crate) fn read_limited(mut reader: impl Read, limit: usize) -> Result<Vec<u8>, std::io::Error> {
    let mut contents = Vec::new();
    reader
        .by_ref()
        .take(limit.saturating_add(1) as u64)
        .read_to_end(&mut contents)?;
    Ok(contents)
}

pub(crate) fn validate_snapshot_file_metadata(file: &fs::File) -> Result<(), CsvAlignError> {
    let metadata = file.metadata().map_err(snapshot_read_error)?;
    if metadata.len() > MAX_SNAPSHOT_BYTES as u64 {
        ensure_snapshot_size(MAX_SNAPSHOT_BYTES + 1)?;
    }
    Ok(())
}

pub(crate) fn read_comparison_snapshot_file(file_path: &Path) -> Result<Vec<u8>, CsvAlignError> {
    let file = fs::File::open(file_path).map_err(snapshot_read_error)?;
    validate_snapshot_file_metadata(&file)?;
    let contents = read_limited(file, MAX_SNAPSHOT_BYTES).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to read comparison snapshot file: {error}"),
        ))
    })?;
    ensure_snapshot_size(contents.len())?;
    Ok(contents)
}

/// Create a new session
#[tauri::command]
#[instrument(skip(state))]
pub(crate) fn create_session(state: tauri::State<Arc<SessionStore>>) -> SessionResponse {
    SessionResponse {
        session_id: state.create(),
    }
}

#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn delete_session(state: tauri::State<Arc<SessionStore>>, session_id: String) {
    state.delete(&session_id);
}

/// Load a CSV file from a local path
#[cfg(test)]
#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) async fn load_csv(
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
    file_letter: String,
    file_path: String,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let state = Arc::clone(state.inner());
    let token = begin_file_load_for_session(state.as_ref(), &session_id, file_side)?;
    run_blocking(move || {
        let loaded = load_csv_workflow(
            &file_letter,
            Some(file_path.clone()),
            CsvLoadSource::FilePath(file_path),
        )?;
        commit_file_load_for_session(state.as_ref(), &session_id, token, file_side, loaded)
    })
    .await
}

/// Load a CSV file from raw bytes (desktop/webview file selection)
///
/// The frontend sends the file contents as a raw IPC body with metadata in
/// request headers. Serializing 25 MiB of bytes as a JSON number array made
/// desktop uploads allocate and parse an order of magnitude more data.
#[tauri::command]
#[instrument(skip(state, request))]
pub(crate) async fn load_csv_bytes(
    state: tauri::State<'_, Arc<SessionStore>>,
    request: tauri::ipc::Request<'_>,
) -> Result<FileLoadResponse, CsvAlignError> {
    let tauri::ipc::InvokeBody::Raw(file_bytes) = request.body() else {
        return Err(CsvAlignError::BadInput(
            "CSV upload must send the file contents as a raw request body".to_string(),
        ));
    };

    let session_id = required_request_header(&request, "session-id")?;
    let file_letter = required_request_header(&request, "file-letter")?;
    let encoded_file_name = required_request_header(&request, "file-name")?;
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let state = Arc::clone(state.inner());
    let token = begin_file_load_for_session(state.as_ref(), &session_id, file_side)?;

    load_csv_bytes_async_with_claim(
        state,
        session_id,
        file_letter,
        percent_decode(&encoded_file_name),
        file_side,
        token,
        file_bytes.clone(),
    )
    .await
}

#[cfg(test)]
pub(crate) async fn load_csv_bytes_async_with_args(
    state: Arc<SessionStore>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let token = begin_file_load_for_session(state.as_ref(), &session_id, file_side)?;

    load_csv_bytes_async_with_claim(
        state,
        session_id,
        file_letter,
        file_name,
        file_side,
        token,
        file_bytes,
    )
    .await
}

async fn load_csv_bytes_async_with_claim(
    state: Arc<SessionStore>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_side: csv_align::data::types::FileSide,
    token: OperationToken,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, CsvAlignError> {
    run_blocking(move || {
        let loaded = load_csv_workflow(
            &file_letter,
            Some(file_name),
            CsvLoadSource::Bytes(file_bytes),
        )?;
        commit_file_load_for_session(state.as_ref(), &session_id, token, file_side, loaded)
    })
    .await
}

#[cfg(test)]
pub(crate) fn load_csv_bytes_with_args(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let token = begin_file_load_for_session(state.inner().as_ref(), &session_id, file_side)?;
    let loaded = load_csv_workflow(
        &file_letter,
        Some(file_name),
        CsvLoadSource::Bytes(file_bytes),
    )?;

    commit_file_load_for_session(
        state.inner().as_ref(),
        &session_id,
        token,
        file_side,
        loaded,
    )
}

fn required_request_header(
    request: &tauri::ipc::Request<'_>,
    name: &'static str,
) -> Result<String, CsvAlignError> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
        .ok_or_else(|| CsvAlignError::BadInput(format!("Missing {name} header on CSV upload")))
}

/// Decode the percent-encoded file-name header; HTTP header values are
/// ASCII-only while CSV file names are not.
pub(crate) fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        let is_escape = bytes[index] == b'%' && index + 2 < bytes.len();
        let escaped = is_escape
            .then(|| u8::from_str_radix(&value[index + 1..index + 3], 16).ok())
            .flatten();

        match escaped {
            Some(byte) => {
                decoded.push(byte);
                index += 3;
            }
            None => {
                decoded.push(bytes[index]);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&decoded).into_owned()
}

/// Get suggested column mappings
#[tauri::command]
#[instrument(skip(state, request), fields(session_id = %session_id))]
pub(crate) fn suggest_mappings(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    request: SuggestMappingsRequest,
) -> Result<SuggestMappingsResponse, CsvAlignError> {
    suggest_mappings_for_session(state.inner().as_ref(), &session_id, &request)
}

/// Run comparison
#[tauri::command]
#[instrument(skip(state, request), fields(session_id = %session_id))]
pub(crate) async fn compare(
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
    request: CompareRequest,
) -> Result<CompareResponse, CsvAlignError> {
    let state = Arc::clone(state.inner());
    let pending = begin_comparison_for_session(state.as_ref(), &session_id, request)?;
    run_blocking(move || {
        let execution = execute_comparison_for_session(&pending)?;
        commit_comparison_for_session(state.as_ref(), &session_id, pending, execution)
    })
    .await
}

/// Export comparison results to a CSV file path
#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) async fn export_results(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    let Some(output_path) = save_file_path(
        &app,
        "comparison-results.csv",
        "CSV Files",
        &["csv"],
        "CSV export",
    )?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    let state = Arc::clone(state.inner());
    run_blocking(move || export_results_to_path(state.as_ref(), &session_id, &output_path)).await?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, html_contents))]
pub(crate) async fn export_results_html(
    app: tauri::AppHandle,
    html_contents: String,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    validate_html_export_document(&html_contents)?;

    let Some(output_path) = save_file_path(
        &app,
        "comparison-results.html",
        "HTML Files",
        &["html"],
        "HTML export",
    )?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    run_blocking(move || export_results_html_to_path(&output_path, &html_contents)).await?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, state, selection), fields(session_id = %session_id))]
pub(crate) async fn save_pair_order(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
    selection: PairOrderSelection,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    let Some(output_path) =
        save_file_path(&app, "pair-order.txt", "Text Files", &["txt"], "pair-order")?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        save_pair_order_to_path(state.as_ref(), &session_id, selection, &output_path)
    })
    .await?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, state), fields(session_id = %session_id))]
pub(crate) async fn load_pair_order(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<Option<LoadPairOrderResponse>, CsvAlignError> {
    let Some(file_path) = pick_file_path(
        &app,
        "Load pair-order file",
        "Text Files",
        &["txt"],
        "pair-order",
    )?
    else {
        return Ok(None);
    };

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        load_pair_order_from_path(state.as_ref(), &session_id, &file_path).map(Some)
    })
    .await
}

#[tauri::command]
#[instrument(skip(app, state), fields(session_id = %session_id))]
pub(crate) async fn save_comparison_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    let Some(output_path) = save_file_path(
        &app,
        "comparison-snapshot.json",
        "JSON Files",
        &["json"],
        "comparison snapshot",
    )?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        save_comparison_snapshot_to_path(state.as_ref(), &session_id, &output_path)
    })
    .await?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, state), fields(session_id = %session_id))]
pub(crate) async fn load_comparison_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<Option<LoadComparisonSnapshotResponse>, CsvAlignError> {
    let Some((token, file_path)) =
        begin_comparison_snapshot_before_selection(state.inner().as_ref(), &session_id, || {
            pick_file_path(
                &app,
                "Load comparison snapshot",
                "JSON Files",
                &["json"],
                "comparison snapshot",
            )
        })?
    else {
        return Ok(None);
    };

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        load_claimed_comparison_snapshot_from_path(state.as_ref(), &session_id, token, &file_path)
            .map(Some)
    })
    .await
}
