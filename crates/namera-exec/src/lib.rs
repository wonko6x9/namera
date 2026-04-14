use anyhow::Result;
use namera_plan::RenamePlan;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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
pub struct ExecutionBatch {
    pub mode: String,
    pub actions: Vec<ExecutionAction>,
    pub summary: String,
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
                "undo" => "reverted".to_string(),
                _ => "planned".to_string(),
            },
            note: Some(match mode {
                "dry-run" => "Dry-run only. No filesystem changes executed.".to_string(),
                "apply" => "Apply contract ready for native filesystem implementation.".to_string(),
                _ => "Undo contract ready once execution logs exist.".to_string(),
            }),
        });
    }

    actions.push(ExecutionAction {
        action_type: "rename".to_string(),
        from_path: Some(PathBuf::from(&plan.source_name)),
        to_path: destination,
        status: match mode {
            "undo" => "reverted".to_string(),
            _ => "planned".to_string(),
        },
        note: Some(match mode {
            "dry-run" => "Dry-run only. No filesystem changes executed.".to_string(),
            "apply" => "Apply contract ready for native filesystem implementation.".to_string(),
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
    }
}
