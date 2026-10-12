use crate::backend::CsvAlignError;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

fn contextual_io_error(context: impl std::fmt::Display, error: std::io::Error) -> CsvAlignError {
    CsvAlignError::Io(std::io::Error::new(
        error.kind(),
        format!("{context}: {error}"),
    ))
}

fn resolve_atomic_destination(file_path: &Path, file_kind: &str) -> Result<PathBuf, CsvAlignError> {
    match fs::symlink_metadata(file_path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            fs::canonicalize(file_path).map_err(|error| {
                contextual_io_error(format!("Failed to resolve {file_kind} destination"), error)
            })
        }
        Ok(_) => Ok(file_path.to_path_buf()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(file_path.to_path_buf()),
        Err(error) => Err(contextual_io_error(
            format!("Failed to inspect {file_kind} destination"),
            error,
        )),
    }
}

fn write_atomically_with_sync(
    file_path: &Path,
    file_kind: &str,
    write: impl FnOnce(&mut File) -> Result<(), CsvAlignError>,
    sync: impl FnOnce(&mut File) -> std::io::Result<()>,
) -> Result<(), CsvAlignError> {
    // Resolve an existing symlink once so publication replaces its target and
    // leaves the user-selected link intact. Atomic replacement creates a new
    // inode, so only portable permissions, not ACLs, xattrs, or hard links, are
    // preserved for an existing regular destination.
    let destination = resolve_atomic_destination(file_path, file_kind)?;
    let existing_permissions = match fs::metadata(&destination) {
        Ok(metadata) if metadata.is_file() => Some(metadata.permissions()),
        Ok(_) => None,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => {
            return Err(contextual_io_error(
                format!("Failed to inspect existing {file_kind} permissions"),
                error,
            ));
        }
    };
    let parent = destination
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut temporary = tempfile::Builder::new()
        .prefix(".csv-align-export-")
        .tempfile_in(parent)
        .map_err(|error| {
            contextual_io_error(
                format!(
                    "Failed to create temporary {file_kind} for {}",
                    destination.display()
                ),
                error,
            )
        })?;

    write(temporary.as_file_mut())?;

    if let Some(permissions) = existing_permissions {
        temporary
            .as_file_mut()
            .set_permissions(permissions)
            .map_err(|error| {
                contextual_io_error(format!("Failed to preserve {file_kind} permissions"), error)
            })?;
    }

    sync(temporary.as_file_mut()).map_err(|error| {
        contextual_io_error(
            format!(
                "Failed to synchronize {file_kind} for {}",
                destination.display()
            ),
            error,
        )
    })?;
    temporary.persist(&destination).map_err(|error| {
        contextual_io_error(
            format!("Failed to publish {file_kind} to {}", destination.display()),
            error.error,
        )
    })?;
    Ok(())
}

/// Write and synchronize a same-directory temporary file before replacing the destination.
pub fn write_atomically(
    path: &Path,
    file_kind: &str,
    write: impl FnOnce(&mut File) -> Result<(), CsvAlignError>,
) -> Result<(), CsvAlignError> {
    write_atomically_with_sync(path, file_kind, write, |file| file.sync_all())
}

/// Atomically publish bytes with file-kind-specific I/O error context.
pub fn write_bytes_atomically(
    path: &Path,
    contents: impl AsRef<[u8]>,
    file_kind: &str,
) -> Result<(), CsvAlignError> {
    write_atomically(path, file_kind, |file| {
        file.write_all(contents.as_ref())
            .map_err(|error| contextual_io_error(format!("Failed to write {file_kind}"), error))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_failure_preserves_an_existing_destination() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("results.csv");
        std::fs::write(&destination, b"original export").unwrap();

        let error = write_atomically(&destination, "CSV export", |file| {
            file.write_all(b"partial replacement")?;
            Err(CsvAlignError::Io(std::io::Error::other(
                "injected export failure",
            )))
        })
        .expect_err("the injected export should fail before publication");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert_eq!(std::fs::read(&destination).unwrap(), b"original export");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn atomic_write_create_failures_include_stage_context() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("missing").join("results.csv");

        let error = write_atomically(&destination, "CSV export", |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .expect_err("a missing destination directory should reject the export");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert!(
            error
                .to_string()
                .contains("Failed to create temporary CSV export")
        );
    }

    #[test]
    fn atomic_write_sync_failures_include_context_and_preserve_destination() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("results.csv");
        std::fs::write(&destination, b"original export").unwrap();

        let error = write_atomically_with_sync(
            &destination,
            "CSV export",
            |file| {
                file.write_all(b"replacement")?;
                Ok(())
            },
            |_| Err(std::io::Error::other("injected sync failure")),
        )
        .expect_err("the injected synchronization should fail");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert!(
            error
                .to_string()
                .contains("Failed to synchronize CSV export")
        );
        assert!(error.to_string().contains("injected sync failure"));
        assert_eq!(std::fs::read(&destination).unwrap(), b"original export");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn atomic_write_publish_failures_include_stage_context() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("existing-directory");
        std::fs::create_dir(&destination).unwrap();

        let error = write_atomically(&destination, "CSV export", |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .expect_err("a directory cannot be replaced by the CSV export");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert!(error.to_string().contains("Failed to publish CSV export"));
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn atomic_replacement_preserves_existing_unix_permissions() {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("results.csv");
        std::fs::write(&destination, b"original export").unwrap();
        std::fs::set_permissions(&destination, std::fs::Permissions::from_mode(0o644)).unwrap();

        write_atomically(&destination, "CSV export", |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .unwrap();

        assert_eq!(std::fs::read(&destination).unwrap(), b"replacement");
        assert_eq!(
            std::fs::metadata(&destination).unwrap().mode() & 0o777,
            0o644
        );
    }

    #[cfg(unix)]
    #[test]
    fn atomic_replacement_preserves_symlink_and_read_only_target() {
        use std::os::unix::fs::{MetadataExt, PermissionsExt, symlink};

        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("target.csv");
        let destination = directory.path().join("results.csv");
        std::fs::write(&target, b"original export").unwrap();
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o444)).unwrap();
        symlink(&target, &destination).unwrap();

        write_atomically(&destination, "CSV export", |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .unwrap();

        assert!(
            std::fs::symlink_metadata(&destination)
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert_eq!(std::fs::read(&target).unwrap(), b"replacement");
        assert_eq!(std::fs::metadata(&target).unwrap().mode() & 0o777, 0o444);
    }

    #[test]
    fn additional_file_kinds_preserve_original_and_clean_up_after_partial_write() {
        for file_kind in ["HTML export", "pair-order", "comparison snapshot"] {
            let directory = tempfile::tempdir().unwrap();
            let destination = directory.path().join("destination");
            fs::write(&destination, b"original bytes").unwrap();

            let error = write_atomically_with_sync(
                &destination,
                file_kind,
                |file| {
                    file.write_all(b"partial replacement")?;
                    Err(contextual_io_error(
                        format!("Failed to write {file_kind}"),
                        std::io::Error::other("injected partial-write failure"),
                    ))
                },
                |_| panic!("a failed write must not reach synchronization"),
            )
            .expect_err("the injected partial write must prevent publication");

            assert!(matches!(error, CsvAlignError::Io(_)));
            assert!(error.to_string().contains(file_kind));
            assert!(error.to_string().contains("injected partial-write failure"));
            assert_eq!(fs::read(&destination).unwrap(), b"original bytes");
            assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        }
    }

    #[test]
    fn additional_file_kinds_preserve_original_and_clean_up_after_sync_failure() {
        for file_kind in ["HTML export", "pair-order", "comparison snapshot"] {
            let directory = tempfile::tempdir().unwrap();
            let destination = directory.path().join("destination");
            fs::write(&destination, b"original bytes").unwrap();

            let error = write_atomically_with_sync(
                &destination,
                file_kind,
                |file| {
                    file.write_all(b"replacement")?;
                    Ok(())
                },
                |_| Err(std::io::Error::other("injected sync failure")),
            )
            .expect_err("the injected sync failure must prevent publication");

            assert!(matches!(error, CsvAlignError::Io(_)));
            assert!(
                error
                    .to_string()
                    .contains(&format!("Failed to synchronize {file_kind}"))
            );
            assert!(error.to_string().contains("injected sync failure"));
            assert_eq!(fs::read(&destination).unwrap(), b"original bytes");
            assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        }
    }

    #[test]
    fn byte_helper_creates_and_replaces_destinations_without_temporary_files() {
        for file_kind in [
            "CSV export",
            "HTML export",
            "pair-order",
            "comparison snapshot",
        ] {
            let directory = tempfile::tempdir().unwrap();
            let destination = directory.path().join("destination");

            write_bytes_atomically(&destination, b"initial bytes", file_kind).unwrap();
            assert_eq!(fs::read(&destination).unwrap(), b"initial bytes");
            write_bytes_atomically(&destination, b"replacement bytes", file_kind).unwrap();
            assert_eq!(fs::read(&destination).unwrap(), b"replacement bytes");
            assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        }
    }
}
