use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MediaKind {
    Movie,
    Episode,
    Music,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EpisodeInfo {
    pub season: u32,
    pub episode: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MovieInfo {
    pub year: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParsedMedia {
    pub raw_name: String,
    pub extension: Option<String>,
    pub normalized_name: String,
    pub title: String,
    pub kind: MediaKind,
    pub movie: Option<MovieInfo>,
    pub episode: Option<EpisodeInfo>,
    pub noise_tokens: Vec<String>,
    pub tokens: Vec<String>,
}
