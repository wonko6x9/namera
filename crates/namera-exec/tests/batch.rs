use namera_exec::create_execution_batch;
use namera_parse::parse_filename;
use namera_plan::build_plan;

#[test]
fn creates_dry_run_batch_for_movie_plan() {
    let parsed = parse_filename("The.Matrix.1999.1080p.BluRay.mkv");
    let plan = build_plan(&parsed, None);
    let batch = create_execution_batch(&plan, "dry-run");

    assert_eq!(batch.mode, "dry-run");
    assert_eq!(batch.actions.len(), 2);
    assert_eq!(batch.summary, "Would run 2 actions");
}

#[test]
fn creates_apply_batch_for_movie_plan() {
    let parsed = parse_filename("The.Matrix.1999.1080p.BluRay.mkv");
    let plan = build_plan(&parsed, None);
    let batch = create_execution_batch(&plan, "apply");

    assert_eq!(batch.mode, "apply");
    assert_eq!(batch.actions[0].status, "ready");
    assert_eq!(batch.summary, "Ready to apply 2 actions");
}
