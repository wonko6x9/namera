use namera_core::media::{MediaKind, ParsedMedia};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchCandidate {
    pub provider: String,
    pub score: u32,
    pub display_name: String,
    pub reason: String,
}

pub fn rank_candidates(parsed: &ParsedMedia) -> Vec<MatchCandidate> {
    let mut candidates = Vec::new();

    match parsed.kind {
        MediaKind::Movie => {
            let year = parsed.movie.as_ref().and_then(|m| m.year);
            candidates.push(MatchCandidate {
                provider: "local-heuristic".to_string(),
                score: 92,
                display_name: match year {
                    Some(year) => format!("{} ({year})", parsed.title),
                    None => parsed.title.clone(),
                },
                reason: "Title and year extracted from filename".to_string(),
            });
        }
        MediaKind::Episode => {
            if let Some(episode) = &parsed.episode {
                candidates.push(MatchCandidate {
                    provider: "local-heuristic".to_string(),
                    score: 90,
                    display_name: format!(
                        "{} - S{:02}E{:02}",
                        parsed.title, episode.season, episode.episode
                    ),
                    reason: "Series title and episode pattern extracted from filename".to_string(),
                });
            }
        }
        _ => {
            candidates.push(MatchCandidate {
                provider: "local-heuristic".to_string(),
                score: 25,
                display_name: parsed.title.clone(),
                reason: "Insufficient structure for confident match".to_string(),
            });
        }
    }

    candidates
}
