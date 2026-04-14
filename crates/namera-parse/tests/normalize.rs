use namera_core::media::MediaKind;
use namera_parse::parse_filename;

#[test]
fn parses_dotted_movie_name() {
    let parsed = parse_filename("The.Matrix.1999.1080p.BluRay.mkv");
    assert_eq!(parsed.kind, MediaKind::Movie);
    assert_eq!(parsed.title, "The Matrix");
    assert_eq!(parsed.movie.and_then(|m| m.year), Some(1999));
    assert_eq!(parsed.extension.as_deref(), Some("mkv"));
    assert!(parsed.noise_tokens.iter().any(|t| t == "1080p"));
    assert!(parsed.noise_tokens.iter().any(|t| t == "BluRay"));
}

#[test]
fn parses_tv_episode_pattern() {
    let parsed = parse_filename("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    assert_eq!(parsed.kind, MediaKind::Episode);
    assert_eq!(parsed.title, "Severance Good News About Hell");
    let episode = parsed.episode.expect("episode metadata");
    assert_eq!(episode.season, 1);
    assert_eq!(episode.episode, 1);
    assert!(parsed.noise_tokens.iter().any(|t| t == "2160p"));
}

#[test]
fn collapses_repeated_separators() {
    let parsed = parse_filename("Andor__S01E03---Reckoning..WEBRip.mp4");
    assert_eq!(parsed.normalized_name, "Andor S01E03 Reckoning WEBRip");
    assert_eq!(parsed.title, "Andor Reckoning");
    assert_eq!(parsed.extension.as_deref(), Some("mp4"));
}
