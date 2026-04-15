use namera_exec::{apply_execution_batch, create_execution_batch};
use namera_match::rank_candidates;
use namera_parse::parse_filename;
use namera_plan::build_plan;
use serde::Serialize;

#[derive(Serialize)]
struct HealthcheckResponse {
    status: &'static str,
}

#[tauri::command]
fn healthcheck() -> HealthcheckResponse {
    HealthcheckResponse { status: "ok" }
}

#[tauri::command]
fn preview_execution_batch(input: String, mode: Option<String>) -> Result<namera_exec::ExecutionBatch, String> {
    let parsed = parse_filename(&input);
    let candidates = rank_candidates(&parsed);
    let candidate = candidates.first();
    let plan = build_plan(&parsed, candidate);
    let batch = create_execution_batch(&plan, mode.as_deref().unwrap_or("dry-run"));
    Ok(batch)
}

#[tauri::command]
fn apply_execution_batch_command(source_root: String, target_root: String, input: String) -> Result<namera_exec::ExecutionBatch, String> {
    let parsed = parse_filename(&input);
    let candidates = rank_candidates(&parsed);
    let candidate = candidates.first();
    let plan = build_plan(&parsed, candidate);
    apply_execution_batch(std::path::Path::new(&source_root), std::path::Path::new(&target_root), &plan)
        .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![healthcheck, preview_execution_batch, apply_execution_batch_command])
        .run(tauri::generate_context!())
        .expect("error while running Namera desktop");
}
