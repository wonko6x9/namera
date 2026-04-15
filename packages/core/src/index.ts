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
  movieSearchProvider?: "google" | "imdb";
  tvSearchProvider?: "google" | "tvmaze";
  musicSearchProvider?: "google" | "musicbrainz";
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

export interface Phase3TransferPlan {
  backend: "webdav";
  status: "planned" | "blocked";
  actions: string[];
  summary: string;
}

export interface ReviewPlanExportItem {
  input: string;
  detectedKind: MediaKind;
  match: {
    provider: string;
    displayName: string;
    confidenceLabel?: "high" | "medium" | "low";
    score: number;
  };
  renamePlan: RenamePlan;
  destinationPlan: Phase3DestinationPlan;
  transferPlan?: Phase3TransferPlan;
}

export interface WebdavTransferQueueItem {
  input: string;
  detectedKind: MediaKind;
  targetPath: string;
  state: "ready" | "blocked";
  actions: string[];
  reason: string;
}

export interface WebdavTransferQueueSummary {
  ready: number;
  blocked: number;
  byKind: Array<{
    kind: MediaKind;
    ready: number;
    blocked: number;
  }>;
  blockedReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface WebdavTransferQueueSnapshot {
  id: string;
  createdAt: string;
  backend: "webdav";
  filter: string;
  summary: WebdavTransferQueueSummary;
  items: WebdavTransferQueueItem[];
}

export interface WebdavTransferIntent {
  id: string;
  createdAt: string;
  snapshotId: string;
  snapshotCreatedAt: string;
  filter: string;
  status: "pending" | "acknowledged";
  handoffReadiness: "ready" | "blocked";
  handoffReadinessReason: string;
  summary: WebdavTransferQueueSummary;
  itemCount: number;
  nextActions: Array<{
    action: string;
    count: number;
  }>;
  blockers: Array<{
    reason: string;
    count: number;
  }>;
  prerequisites: Array<{
    name: string;
    status: "ready" | "blocked";
    detail: string;
  }>;
  handoffOwner?: string;
  handoffNote?: string;
  handoffAssignedAt?: string;
  acknowledgedAt?: string;
  acknowledgementNote?: string;
  lifecycleEvents: Array<{
    at: string;
    type: "created" | "assigned" | "acknowledged";
    detail: string;
  }>;
}
