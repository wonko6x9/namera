use namera_exec::{apply_execution_batch, create_execution_batch, undo_execution_batch};
use namera_parse::parse_filename;
use namera_plan::build_plan;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

fn movie_plan() -> namera_plan::RenamePlan {
    let parsed = parse_filename("The.Matrix.1999.1080p.BluRay.mkv");
    build_plan(&parsed, None)
}

fn temp_dir(label: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("namera-exec-{label}-{unique}"));
    fs::create_dir_all(&path).unwrap();
    path
}

fn write_source_file(root: &Path, relative: &str, contents: &[u8]) -> PathBuf {
    let path = root.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(&path, contents).unwrap();
    path
}

#[test]
fn creates_dry_run_batch_for_movie_plan() {
    let plan = movie_plan();
    let batch = create_execution_batch(&plan, "dry-run");

    assert_eq!(batch.mode, "dry-run");
    assert_eq!(batch.actions.len(), 2);
    assert_eq!(batch.summary, "Would run 2 actions");
}

#[test]
fn creates_apply_batch_for_movie_plan() {
    let plan = movie_plan();
    let batch = create_execution_batch(&plan, "apply");

    assert_eq!(batch.mode, "apply");
    assert_eq!(batch.actions[0].status, "ready");
    assert_eq!(batch.summary, "Ready to apply 2 actions");
}

#[test]
fn apply_undo_and_reapply_cycle_stays_recoverable() {
    let source_root = temp_dir("cycle-source");
    let target_root = temp_dir("cycle-target");
    let plan = movie_plan();

    write_source_file(&source_root, &plan.source_name, b"matrix");

    let apply_batch = apply_execution_batch(&source_root, &target_root, &plan, Some("skip")).unwrap();
    let apply_log = apply_batch.log_entry.as_ref().unwrap();
    let applied_path = PathBuf::from(&apply_log.proposed_path);

    assert!(applied_path.exists());
    assert!(!source_root.join(&plan.source_name).exists());

    let undo_batch = undo_execution_batch(
        &source_root,
        &target_root,
        &plan,
        Some(&apply_log.id),
        apply_log.source_size_bytes,
        Some(&apply_log.proposed_path),
    )
    .unwrap();

    assert_eq!(undo_batch.mode, "undo");
    assert!(source_root.join(&plan.source_name).exists());
    assert!(!applied_path.exists());

    let reapply_batch = apply_execution_batch(&source_root, &target_root, &plan, Some("skip")).unwrap();
    assert_eq!(reapply_batch.mode, "apply");
    assert!(PathBuf::from(&reapply_batch.log_entry.unwrap().proposed_path).exists());

    fs::remove_dir_all(source_root).unwrap();
    fs::remove_dir_all(target_root).unwrap();
}

#[test]
fn rename_new_skips_taken_suffixes_and_chooses_next_available_name() {
    let source_root = temp_dir("rename-new-source");
    let target_root = temp_dir("rename-new-target");
    let plan = movie_plan();
    let destination = target_root.join(&plan.proposed_path);
    let parent = destination.parent().unwrap();

    write_source_file(&source_root, &plan.source_name, b"fresh");
    write_source_file(&target_root, &plan.proposed_path, b"existing");
    write_source_file(parent, "The Matrix (1999) (1).mkv", b"existing-1");

    let batch = apply_execution_batch(&source_root, &target_root, &plan, Some("rename-new")).unwrap();
    let renamed_path = PathBuf::from(&batch.log_entry.unwrap().proposed_path);

    assert!(renamed_path.ends_with("The Matrix (1999) (2).mkv"));
    assert!(renamed_path.exists());
    assert!(destination.exists());

    fs::remove_dir_all(source_root).unwrap();
    fs::remove_dir_all(target_root).unwrap();
}

#[test]
fn undo_refuses_when_original_source_path_has_been_recreated() {
    let source_root = temp_dir("undo-source-exists-source");
    let target_root = temp_dir("undo-source-exists-target");
    let plan = movie_plan();

    write_source_file(&source_root, &plan.source_name, b"matrix");
    let apply_batch = apply_execution_batch(&source_root, &target_root, &plan, Some("skip")).unwrap();
    let apply_log = apply_batch.log_entry.unwrap();

    write_source_file(&source_root, &plan.source_name, b"replacement");

    let error = undo_execution_batch(
        &source_root,
        &target_root,
        &plan,
        Some(&apply_log.id),
        apply_log.source_size_bytes,
        Some(&apply_log.proposed_path),
    )
    .unwrap_err();

    assert!(error
        .to_string()
        .contains("cannot undo because source path already exists"));

    fs::remove_dir_all(source_root).unwrap();
    fs::remove_dir_all(target_root).unwrap();
}
