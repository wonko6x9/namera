use namera_parse::parse_filename;
use namera_plan::build_plan;

#[test]
fn builds_movie_plan() {
    let parsed = parse_filename("The.Matrix.1999.1080p.BluRay.mkv");
    let plan = build_plan(&parsed, None);
    assert_eq!(plan.proposed_path, "Movies/The Matrix (1999)/The Matrix (1999).mkv");
}

#[test]
fn builds_tv_plan() {
    let parsed = parse_filename("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    let plan = build_plan(&parsed, None);
    assert_eq!(plan.proposed_path, "TV Shows/Severance Good News About Hell/Season 01/Severance Good News About Hell - S01E01.mkv");
}
