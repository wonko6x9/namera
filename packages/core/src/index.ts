export type MediaKind = "movie" | "episode" | "music" | "unknown";

export interface EpisodeInfo {
  season: number;
  episode: number;
}

export interface MovieInfo {
  year?: number;
}

export interface ParsedMedia {
  rawName: string;
  extension?: string;
  normalizedName: string;
  title: string;
  kind: MediaKind;
  movie?: MovieInfo;
  episode?: EpisodeInfo;
  noiseTokens: string[];
  tokens: string[];
}

export interface MatchCandidate {
  provider: string;
  score: number;
  displayName: string;
  reason: string;
}

export interface RenamePlan {
  sourceName: string;
  proposedPath: string;
  warnings: string[];
  confidence: number;
}

export interface HistoryEntry {
  sourceName: string;
  proposedPath: string;
  confidence: number;
}
