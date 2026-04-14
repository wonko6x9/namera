use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub movie_root: Option<String>,
    pub tv_root: Option<String>,
    pub music_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HistoryEntry {
    pub source_name: String,
    pub proposed_path: String,
    pub confidence: u32,
}
