use anyhow::Result;
use namera_plan::RenamePlan;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionRecord {
    pub source: PathBuf,
    pub destination: PathBuf,
}

pub fn execute_plan(source_root: &Path, target_root: &Path, plan: &RenamePlan) -> Result<ExecutionRecord> {
    let source = source_root.join(&plan.source_name);
    let destination = target_root.join(&plan.proposed_path);

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }

    Ok(ExecutionRecord { source, destination })
}
