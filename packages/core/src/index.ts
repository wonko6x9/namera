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

export interface IngestItem {
  source: "text" | "file";
  name: string;
  size?: number;
  pathHint?: string;
}

export interface PreviewResult {
  input: string;
  parsed: ParsedMedia;
  candidate: MatchCandidate;
  plan: RenamePlan;
}

export interface HistoryEntry {
  sourceName: string;
  proposedPath: string;
  confidence: number;
  createdAt: string;
}

export interface DestinationProfile {
  movieRoot: string;
  tvRoot: string;
  musicRoot: string;
}

export interface ProviderConfig {
  tmdbApiKey?: string;
  tvdbApiKey?: string;
  omdbApiKey?: string;
}

export interface AppConfig {
  destinations: DestinationProfile;
  providers: ProviderConfig;
}

export interface Phase3DestinationPlan {
  backend: "local" | "webdav";
  targetPath: string;
  status: "ready" | "stub";
  note: string;
}
