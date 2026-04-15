use namera_core::media::{EpisodeInfo, MediaKind, MovieInfo, ParsedMedia};

const KNOWN_NOISE: &[&str] = &[
    "2160p", "1080p", "720p", "480p", "web", "webrip", "web-dl", "webdl", "dl", "bluray",
    "brrip", "dvdrip", "hdrip", "x264", "x265", "h264", "h265", "hevc", "aac", "ddp5",
    "ddp5.1", "atmos", "dts", "proper", "repack", "remux", "nf", "amzn", "yts", "rarbg",
];

pub fn parse_filename(input: &str) -> ParsedMedia {
    let (base_name, extension) = split_extension(input);
    let normalized = normalize_separators(base_name);
    let tokens = normalized
        .split_whitespace()
        .map(|token| token.to_string())
        .collect::<Vec<_>>();

    let episode = detect_episode(&tokens);
    let year = detect_year(&tokens);
    let noise_tokens = tokens
        .iter()
        .filter(|token| is_noise_token(token))
        .cloned()
        .collect::<Vec<_>>();

    let title_tokens = tokens
        .iter()
        .filter(|token| !is_noise_token(token))
        .filter(|token| !looks_like_extension(token))
        .filter(|token| !is_year_token(token, year))
        .filter(|token| !is_episode_token(token))
        .cloned()
        .collect::<Vec<_>>();

    let title = cleanup_title(title_tokens.join(" "));

    let kind = if episode.is_some() {
        MediaKind::Episode
    } else if year.is_some() {
        MediaKind::Movie
    } else {
        MediaKind::Unknown
    };

    ParsedMedia {
        raw_name: input.to_string(),
        extension,
        normalized_name: normalized,
        title,
        kind,
        movie: year.map(|year| MovieInfo { year: Some(year) }),
        episode,
        noise_tokens,
        tokens,
    }
}

fn split_extension(input: &str) -> (&str, Option<String>) {
    match input.rsplit_once('.') {
        Some((base, ext)) if !base.is_empty() && !ext.contains(['/', '\\']) => {
            (base, Some(ext.to_ascii_lowercase()))
        }
        _ => (input, None),
    }
}

fn normalize_separators(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut last_was_space = false;

    for ch in input.chars() {
        let separator = matches!(ch, '.' | '_' | '-' | '[' | ']' | '(' | ')' | '{' | '}' | ',');
        if separator || ch.is_whitespace() {
            if !last_was_space {
                out.push(' ');
                last_was_space = true;
            }
        } else {
            out.push(ch);
            last_was_space = false;
        }
    }

    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn detect_episode(tokens: &[String]) -> Option<EpisodeInfo> {
    for token in tokens {
        let upper = token.to_ascii_uppercase();
        let bytes = upper.as_bytes();
        if bytes.len() == 6 && bytes[0] == b'S' && bytes[3] == b'E' {
            let season = upper[1..3].parse::<u32>().ok()?;
            let episode = upper[4..6].parse::<u32>().ok()?;
            return Some(EpisodeInfo { season, episode });
        }
    }
    None
}

fn detect_year(tokens: &[String]) -> Option<u32> {
    tokens.iter().find_map(|token| {
        if token.len() == 4 {
            let year = token.parse::<u32>().ok()?;
            if (1900..=2099).contains(&year) {
                return Some(year);
            }
        }
        None
    })
}

fn is_noise_token(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    KNOWN_NOISE.contains(&lower.as_str())
}

fn looks_like_extension(token: &str) -> bool {
    matches!(token.to_ascii_lowercase().as_str(), "mkv" | "mp4" | "avi" | "mov")
}

fn is_year_token(token: &str, year: Option<u32>) -> bool {
    matches!(year, Some(found) if token == found.to_string())
}

fn is_episode_token(token: &str) -> bool {
    let upper = token.to_ascii_uppercase();
    let bytes = upper.as_bytes();
    bytes.len() == 6 && bytes[0] == b'S' && bytes[3] == b'E'
}

fn cleanup_title(title: String) -> String {
    title
        .split_whitespace()
        .map(capitalize_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn capitalize_token(token: &str) -> String {
    let lower = token.to_ascii_lowercase();
    match lower.as_str() {
        "ii" | "iii" | "iv" | "vi" | "vii" | "viii" | "ix" | "x" => lower.to_ascii_uppercase(),
        _ => {
            let mut chars = lower.chars();
            match chars.next() {
                Some(first) => first.to_ascii_uppercase().to_string() + chars.as_str(),
                None => String::new(),
            }
        }
    }
}
