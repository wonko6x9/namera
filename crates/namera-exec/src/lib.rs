use anyhow::{anyhow, Result};
use namera_plan::RenamePlan;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_COLLISION_POLICY: &str = "skip";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionRecord {
    pub source: PathBuf,
    pub destination: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionAction {
    pub action_type: String,
    pub from_path: Option<PathBuf>,
    pub to_path: PathBuf,
    pub status: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionLogEntry {
    pub id: String,
    pub mode: String,
    pub source_name: String,
    pub proposed_path: String,
    pub actions: Vec<ExecutionAction>,
    pub created_at: String,
    pub undone_at: Option<String>,
    pub source_size_bytes: Option<u64>,
    pub apply_log_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionBatch {
    pub mode: String,
    pub actions: Vec<ExecutionAction>,
    pub summary: String,
    pub log_entry: Option<ExecutionLogEntry>,
}

pub fn execute_plan(source_root: &Path, target_root: &Path, plan: &RenamePlan) -> Result<ExecutionRecord> {
    let source = source_root.join(&plan.source_name);
    let destination = target_root.join(&plan.proposed_path);

    if let Some(parent) = destination.parent() {
      fs::create_dir_all(parent)?;
    }

    Ok(ExecutionRecord { source, destination })
}

pub fn create_execution_batch(plan: &RenamePlan, mode: &str) -> ExecutionBatch {
    let destination = PathBuf::from(&plan.proposed_path);
    let mut actions = Vec::new();

    if let Some(parent) = destination.parent() {
        actions.push(ExecutionAction {
            action_type: "mkdir".to_string(),
            from_path: None,
            to_path: parent.to_path_buf(),
            status: match mode {
                "apply" => "ready".to_string(),
                "undo" => "reverted".to_string(),
                _ => "planned".to_string(),
            },
            note: Some(match mode {
                "dry-run" => "Dry-run only. No filesystem changes executed.".to_string(),
                "apply" => "Target directory will be created if missing.".to_string(),
                _ => "Undo does not remove directories yet.".to_string(),
            }),
        });
    }

    actions.push(ExecutionAction {
        action_type: "rename".to_string(),
        from_path: Some(PathBuf::from(&plan.source_name)),
        to_path: destination,
        status: match mode {
            "apply" => "ready".to_string(),
            "undo" => "reverted".to_string(),
            _ => "planned".to_string(),
        },
        note: Some(match mode {
            "dry-run" => "Dry-run only. No filesystem changes executed.".to_string(),
            "apply" => "Native rename/move is ready to execute.".to_string(),
            _ => "Undo contract ready once execution logs exist.".to_string(),
        }),
    });

    let summary = match mode {
        "dry-run" => format!("Would run {} actions", actions.len()),
        "apply" => format!("Ready to apply {} actions", actions.len()),
        _ => format!("Would undo {} actions", actions.len()),
    };

    ExecutionBatch {
        mode: mode.to_string(),
        actions,
        summary,
        log_entry: None,
    }
}

pub fn apply_execution_batch(
    source_root: &Path,
    target_root: &Path,
    plan: &RenamePlan,
    collision_policy: Option<&str>,
) -> Result<ExecutionBatch> {
    validate_relative_plan_path(&plan.proposed_path)?;
    let mut record = execute_plan(source_root, target_root, plan)?;
    let collision_policy = collision_policy.unwrap_or(DEFAULT_COLLISION_POLICY);

    if !record.source.exists() {
        return Err(anyhow!("source file does not exist: {}", record.source.display()));
    }

    let source_metadata = fs::metadata(&record.source)?;
    if !source_metadata.is_file() {
        return Err(anyhow!("source path is not a regular file: {}", record.source.display()));
    }

    if record.source == record.destination {
        return Err(anyhow!("source and destination resolve to the same path: {}", record.source.display()));
    }

    let mut collision_note: Option<String> = None;
    if record.destination.exists() {
        if !fs::metadata(&record.destination)?.is_file() {
            return Err(anyhow!("destination exists but is not a regular file: {}", record.destination.display()));
        }

        match collision_policy {
            "skip" => {
                let actions = vec![ExecutionAction {
                    action_type: "rename".to_string(),
                    from_path: Some(record.source.clone()),
                    to_path: record.destination.clone(),
                    status: "skipped".to_string(),
                    note: Some("Skipped because destination already exists and collision policy is skip.".to_string()),
                }];

                return Ok(ExecutionBatch {
                    mode: "apply".to_string(),
                    summary: "Skipped apply because destination already exists".to_string(),
                    log_entry: None,
                    actions,
                });
            }
            "overwrite" => {
                fs::remove_file(&record.destination)?;
                collision_note = Some("Existing destination was replaced because collision policy is overwrite.".to_string());
            }
            "rename-new" => {
                let next_destination = next_available_destination(&record.destination);
                collision_note = Some(format!(
                    "Destination already existed, so collision policy rename-new chose {}.",
                    next_destination.display()
                ));
                record.destination = next_destination;
            }
            other => {
                return Err(anyhow!("unsupported collision policy: {}", other));
            }
        }
    }

    if let Some(parent) = record.destination.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::rename(&record.source, &record.destination)?;

    let actions = vec![
        ExecutionAction {
            action_type: "mkdir".to_string(),
            from_path: None,
            to_path: record
                .destination
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| target_root.to_path_buf()),
            status: "applied".to_string(),
            note: Some("Target directory ensured before move.".to_string()),
        },
        ExecutionAction {
            action_type: "rename".to_string(),
            from_path: Some(record.source.clone()),
            to_path: record.destination.clone(),
            status: "applied".to_string(),
            note: Some(collision_note.unwrap_or_else(|| "Native filesystem rename/move completed.".to_string())),
        },
    ];

    let log_id = create_execution_id_for_paths(&plan.source_name, &record.destination.to_string_lossy());

    Ok(ExecutionBatch {
        mode: "apply".to_string(),
        summary: format!("Applied {} actions", actions.len()),
        log_entry: Some(create_log_entry(
            "apply",
            &plan.source_name,
            &record.destination,
            actions.clone(),
            None,
            Some(source_metadata.len()),
            None,
            Some(log_id),
        )),
        actions,
    })
}

pub fn undo_execution_batch(
    source_root: &Path,
    target_root: &Path,
    plan: &RenamePlan,
    expected_log_id: Option<&str>,
    expected_size_bytes: Option<u64>,
    applied_path: Option<&str>,
) -> Result<ExecutionBatch> {
    validate_relative_plan_path(&plan.proposed_path)?;
    let source = source_root.join(&plan.source_name);
    let destination = match applied_path {
        Some(path) => PathBuf::from(path),
        None => target_root.join(&plan.proposed_path),
    };

    if !destination.exists() {
        return Err(anyhow!("applied destination does not exist: {}", destination.display()));
    }

    let destination_metadata = fs::metadata(&destination)?;
    if !destination_metadata.is_file() {
        return Err(anyhow!("cannot undo because destination is not a regular file: {}", destination.display()));
    }

    if let Some(expected_size) = expected_size_bytes {
        let actual_size = destination_metadata.len();
        if actual_size != expected_size {
            return Err(anyhow!(
                "cannot undo because destination size changed from {} to {} bytes: {}",
                expected_size,
                actual_size,
                destination.display()
            ));
        }
    }

    if source.exists() {
        return Err(anyhow!("cannot undo because source path already exists: {}", source.display()));
    }

    if let Some(parent) = source.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::rename(&destination, &source)?;

    let actions = vec![
        ExecutionAction {
            action_type: "rename".to_string(),
            from_path: Some(destination.clone()),
            to_path: source.clone(),
            status: "reverted".to_string(),
            note: Some("Native filesystem undo completed.".to_string()),
        },
    ];

    Ok(ExecutionBatch {
        mode: "undo".to_string(),
        summary: format!("Undid {} action{}", actions.len(), if actions.len() == 1 { "" } else { "s" }),
        log_entry: Some(create_log_entry(
            "undo",
            &plan.source_name,
            &destination,
            actions.clone(),
            Some(now_iso_like()),
            expected_size_bytes,
            expected_log_id.map(ToOwned::to_owned),
            None,
        )),
        actions,
    })
}

fn create_log_entry(
    mode: &str,
    source_name: &str,
    proposed_path: &Path,
    actions: Vec<ExecutionAction>,
    undone_at: Option<String>,
    source_size_bytes: Option<u64>,
    apply_log_id: Option<String>,
    id: Option<String>,
) -> ExecutionLogEntry {
    ExecutionLogEntry {
        id: id.unwrap_or_else(|| create_execution_id_for_paths(source_name, &proposed_path.to_string_lossy())),
        mode: mode.to_string(),
        source_name: source_name.to_string(),
        proposed_path: proposed_path.to_string_lossy().to_string(),
        actions,
        created_at: now_iso_like(),
        undone_at,
        source_size_bytes,
        apply_log_id,
    }
}

fn validate_relative_plan_path(proposed_path: &str) -> Result<()> {
    let path = Path::new(proposed_path);
    if path.is_absolute() {
        return Err(anyhow!("proposed path must be relative, got absolute path: {}", proposed_path));
    }

    if path.components().any(|component| matches!(component, std::path::Component::ParentDir)) {
        return Err(anyhow!("proposed path must not traverse parent directories: {}", proposed_path));
    }

    Ok(())
}

fn create_execution_id_for_paths(source_name: &str, proposed_path: &str) -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{}=>{}=>{}", source_name, proposed_path, stamp)
}

fn next_available_destination(destination: &Path) -> PathBuf {
    let parent = destination.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = destination
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "renamed".to_string());
    let extension = destination.extension().map(|value| value.to_string_lossy().to_string());

    for index in 1..10_000 {
        let candidate_name = match &extension {
            Some(ext) => format!("{} ({index}).{}", stem, ext),
            None => format!("{} ({index})", stem),
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    destination.to_path_buf()
}

fn now_iso_like() -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}Z", stamp)
}

#[cfg(test)]
mod tests {
    use super::*;
    use namera_plan::RenamePlan;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> PathBuf {
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path = std::env::temp_dir().join(format!("namera-{label}-{unique}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn sample_plan() -> RenamePlan {
        RenamePlan {
            source_name: "The.Matrix.1999.1080p.BluRay.mkv".to_string(),
            proposed_path: "Movies/The Matrix (1999)/The Matrix (1999).mkv".to_string(),
            warnings: vec![],
            confidence: 97,
        }
    }

    #[test]
    fn applies_native_rename_batch() {
        let source_root = temp_dir("source");
        let target_root = temp_dir("target");
        let source_file = source_root.join("The.Matrix.1999.1080p.BluRay.mkv");
        fs::write(&source_file, b"matrix").unwrap();

        let batch = apply_execution_batch(&source_root, &target_root, &sample_plan(), Some("skip")).unwrap();
        let destination = target_root.join("Movies/The Matrix (1999)/The Matrix (1999).mkv");

        assert!(!source_file.exists());
        assert!(destination.exists());
        assert_eq!(batch.mode, "apply");
        assert_eq!(batch.actions[1].status, "applied");
        assert_eq!(batch.log_entry.as_ref().and_then(|entry| entry.source_size_bytes), Some(6));

        let _ = fs::remove_dir_all(&source_root);
        let _ = fs::remove_dir_all(&target_root);
    }

    #[test]
    fn undo_rejects_changed_destination_size() {
        let source_root = temp_dir("source-undo-size");
        let target_root = temp_dir("target-undo-size");
        let plan = sample_plan();
        let destination = target_root.join(&plan.proposed_path);
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::write(&destination, b"changed-content").unwrap();

        let error = undo_execution_batch(&source_root, &target_root, &plan, Some("apply-1"), Some(6), None).unwrap_err();
        assert!(error.to_string().contains("destination size changed"));

        let _ = fs::remove_dir_all(&source_root);
        let _ = fs::remove_dir_all(&target_root);
    }

    #[test]
    fn apply_rejects_parent_traversal_in_plan_path() {
        let source_root = temp_dir("source-traversal");
        let target_root = temp_dir("target-traversal");
        let source_file = source_root.join("The.Matrix.1999.1080p.BluRay.mkv");
        fs::write(&source_file, b"matrix").unwrap();

        let mut plan = sample_plan();
        plan.proposed_path = "../escape.mkv".to_string();

        let error = apply_execution_batch(&source_root, &target_root, &plan, Some("skip")).unwrap_err();
        assert!(error.to_string().contains("must not traverse parent directories"));

        let _ = fs::remove_dir_all(&source_root);
        let _ = fs::remove_dir_all(&target_root);
    }

    #[test]
    fn apply_skip_policy_does_not_clobber_existing_destination() {
        let source_root = temp_dir("source-skip");
        let target_root = temp_dir("target-skip");
        let source_file = source_root.join("The.Matrix.1999.1080p.BluRay.mkv");
        let destination = target_root.join("Movies/The Matrix (1999)/The Matrix (1999).mkv");
        fs::write(&source_file, b"matrix").unwrap();
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::write(&destination, b"existing").unwrap();

        let batch = apply_execution_batch(&source_root, &target_root, &sample_plan(), Some("skip")).unwrap();

        assert!(source_file.exists());
        assert_eq!(fs::read(&destination).unwrap(), b"existing");
        assert_eq!(batch.actions[0].status, "skipped");

        let _ = fs::remove_dir_all(&source_root);
        let _ = fs::remove_dir_all(&target_root);
    }

    #[test]
    fn apply_rename_new_policy_chooses_new_destination_name() {
        let source_root = temp_dir("source-rename-new");
        let target_root = temp_dir("target-rename-new");
        let source_file = source_root.join("The.Matrix.1999.1080p.BluRay.mkv");
        let destination = target_root.join("Movies/The Matrix (1999)/The Matrix (1999).mkv");
        let renamed_destination = target_root.join("Movies/The Matrix (1999)/The Matrix (1999) (1).mkv");
        fs::write(&source_file, b"matrix").unwrap();
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::write(&destination, b"existing").unwrap();

        let batch = apply_execution_batch(&source_root, &target_root, &sample_plan(), Some("rename-new")).unwrap();

        assert!(!source_file.exists());
        assert!(renamed_destination.exists());
        assert_eq!(batch.log_entry.as_ref().map(|entry| entry.proposed_path.clone()), Some(renamed_destination.to_string_lossy().to_string()));

        let _ = fs::remove_dir_all(&source_root);
        let _ = fs::remove_dir_all(&target_root);
    }
}
