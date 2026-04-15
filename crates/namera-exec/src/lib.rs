use anyhow::{anyhow, Result};
use namera_plan::RenamePlan;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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

pub fn apply_execution_batch(source_root: &Path, target_root: &Path, plan: &RenamePlan) -> Result<ExecutionBatch> {
    let record = execute_plan(source_root, target_root, plan)?;

    if !record.source.exists() {
        return Err(anyhow!("source file does not exist: {}", record.source.display()));
    }

    if record.destination.exists() {
        return Err(anyhow!("destination already exists: {}", record.destination.display()));
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
            note: Some("Native filesystem rename/move completed.".to_string()),
        },
    ];

    Ok(ExecutionBatch {
        mode: "apply".to_string(),
        summary: format!("Applied {} actions", actions.len()),
        log_entry: Some(create_log_entry("apply", plan, actions.clone(), None)),
        actions,
    })
}

pub fn undo_execution_batch(source_root: &Path, target_root: &Path, plan: &RenamePlan) -> Result<ExecutionBatch> {
    let source = source_root.join(&plan.source_name);
    let destination = target_root.join(&plan.proposed_path);

    if !destination.exists() {
        return Err(anyhow!("applied destination does not exist: {}", destination.display()));
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
        log_entry: Some(create_log_entry("undo", plan, actions.clone(), Some(now_iso_like()))),
        actions,
    })
}

fn create_log_entry(mode: &str, plan: &RenamePlan, actions: Vec<ExecutionAction>, undone_at: Option<String>) -> ExecutionLogEntry {
    ExecutionLogEntry {
        id: create_execution_id(plan),
        mode: mode.to_string(),
        source_name: plan.source_name.clone(),
        proposed_path: plan.proposed_path.clone(),
        actions,
        created_at: now_iso_like(),
        undone_at,
    }
}

fn create_execution_id(plan: &RenamePlan) -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{}=>{}=>{}", plan.source_name, plan.proposed_path, stamp)
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

        let batch = apply_execution_batch(&source_root, &target_root, &sample_plan()).unwrap();
        let destination = target_root.join("Movies/The Matrix (1999)/The Matrix (1999).mkv");

        assert!(!source_file.exists());
        assert!(destination.exists());
        assert_eq!(batch.mode, "apply");
        assert_eq!(batch.actions[1].status, "applied");

        let _ = fs::remove_dir_all(&source_root);
        let _ = fs::remove_dir_all(&target_root);
    }
}
