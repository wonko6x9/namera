export type MediaKind = "movie" | "episode" | "music" | "unknown";

export interface EpisodeInfo {
  season: number;
  episode: number;
  seriesTitle?: string;
  episodeTitle?: string;
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
  qualifierSuffix?: string;
}

export interface MatchCandidate {
  provider: string;
  score: number;
  displayName: string;
  reason: string;
  providerId?: string;
  confidenceLabel?: "high" | "medium" | "low";
}

export interface RenamePlan {
  sourceName: string;
  proposedPath: string;
  warnings: string[];
  confidence: number;
}

export type CollisionPolicy = "skip" | "overwrite" | "rename-new";

export interface PlanOptions {
  movieRoot?: string;
  tvRoot?: string;
  musicRoot?: string;
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
  candidates?: MatchCandidate[];
}

export interface ReviewSummary {
  total: number;
  lowConfidence: number;
  providerBacked: number;
  heuristicOnly: number;
}

export interface HistoryEntry {
  sourceName: string;
  proposedPath: string;
  confidence: number;
  createdAt: string;
}

export interface ExecutionAction {
  type: "rename" | "move" | "mkdir";
  fromPath?: string;
  toPath: string;
  status: "planned" | "applied" | "failed" | "reverted" | "skipped";
  note?: string;
}

export interface ExecutionLogEntry {
  id: string;
  mode: "apply" | "undo";
  sourceName: string;
  proposedPath: string;
  actions: ExecutionAction[];
  createdAt: string;
  undoneAt?: string;
  sourceSizeBytes?: number;
  applyLogId?: string;
}

export interface ExecutionBatch {
  mode: "dry-run" | "apply" | "undo";
  actions: ExecutionAction[];
  summary: string;
  logEntry?: ExecutionLogEntry;
}

export interface DestinationProfile {
  movieRoot: string;
  tvRoot: string;
  musicRoot: string;
  sourceRoot?: string;
  targetRoot?: string;
  collisionPolicy?: CollisionPolicy;
  webdavMovieRoot?: string;
  webdavTvRoot?: string;
  webdavMusicRoot?: string;
}

export interface ProviderConfig {
  tmdbApiKey?: string;
  tvdbApiKey?: string;
  omdbApiKey?: string;
}

export interface ProviderDiagnostic {
  provider: string;
  status: "idle" | "configured" | "ok" | "empty" | "error";
  detail: string;
  cached?: boolean;
}

export interface CorrectionRecord {
  key: string;
  candidateKey: string;
  displayName: string;
  provider: string;
  updatedAt: string;
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
