use namera_parse::parse_filename;
use namera_match::rank_candidates;

#[test]
fn ranks_movie_candidate_from_parse() {
    let parsed = parse_filename("The.Matrix.1999.1080p.BluRay.mkv");
    let ranked = rank_candidates(&parsed);
    assert_eq!(ranked[0].display_name, "The Matrix (1999)");
    assert!(ranked[0].score >= 90);
}
