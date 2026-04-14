use namera_core::media::{MediaKind, ParsedMedia};
use namera_match::MatchCandidate;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenamePlan {
    pub source_name: String,
    pub proposed_path: String,
    pub warnings: Vec<String>,
    pub confidence: u32,
}

pub fn build_plan(parsed: &ParsedMedia, candidate: Option<&MatchCandidate>) -> RenamePlan {
    let proposed_path = match parsed.kind {
        MediaKind::Movie => {
            let year = parsed
                .movie
                .as_ref()
                .and_then(|movie| movie.year)
                .map(|year| format!(" ({year})"))
                .unwrap_or_default();
            let ext = parsed.extension.as_deref().unwrap_or("mkv");
            format!(
                "Movies/{}{}/{}{}.{}",
                parsed.title, year, parsed.title, year, ext
            )
        }
        MediaKind::Episode => {
            let ext = parsed.extension.as_deref().unwrap_or("mkv");
            if let Some(episode) = &parsed.episode {
                format!(
                    "TV Shows/{}/Season {:02}/{} - S{:02}E{:02}.{}",
                    parsed.title, episode.season, parsed.title, episode.season, episode.episode, ext
                )
            } else {
                format!("TV Shows/{}/{}.{}", parsed.title, parsed.title, ext)
            }
        }
        _ => {
            let ext = parsed.extension.as_deref().unwrap_or("bin");
            format!("Unsorted/{}.{}", parsed.title, ext)
        }
    };

    let mut warnings = Vec::new();
    if parsed.kind == MediaKind::Unknown {
        warnings.push("Low-confidence parse, manual review required".to_string());
    }
    if candidate.is_none() {
        warnings.push("No metadata provider candidate selected, using local heuristic only".to_string());
    }

    RenamePlan {
        source_name: parsed.raw_name.clone(),
        proposed_path,
        warnings,
        confidence: candidate.map(|c| c.score).unwrap_or(30),
    }
}
