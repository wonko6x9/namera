import type { AppConfig, CorrectionRecord, DiagnosticLogEvent, ExecutionLogEntry, HistoryEntry, LocalBatchRun, WebdavTransferIntent, WebdavTransferQueueSnapshot } from "@namera/core";

export const DEFAULT_CONFIG: AppConfig = {
  destinations: {
    movieRoot: "Movies",
    tvRoot: "TV Shows",
    musicRoot: "Music",
    sourceRoot: ".",
    targetRoot: ".",
    collisionPolicy: "skip",
    webdavMovieRoot: "",
    webdavTvRoot: "",
    webdavMusicRoot: "",
  },
  providers: {
    movieSearchProvider: "imdb",
    tvSearchProvider: "tvmaze",
    musicSearchProvider: "musicbrainz",
  },
};

const CONFIG_KEY = "namera.config";
const HISTORY_KEY = "namera.history";
const EXECUTION_LOG_KEY = "namera.execution-log";
const PROVIDER_CACHE_KEY = "namera.provider-cache";
const CORRECTIONS_KEY = "namera.corrections";
const RECENT_INGEST_ROOTS_KEY = "namera.recent-ingest-roots";
const LOCAL_BATCH_RUNS_KEY = "namera.local-batch-runs";
const DIAGNOSTIC_LOG_KEY = "namera.diagnostic-log";
const WEBDAV_TRANSFER_SNAPSHOTS_KEY = "namera.webdav-transfer-snapshots";
const WEBDAV_TRANSFER_INTENTS_KEY = "namera.webdav-transfer-intents";
const FALLBACK_STORAGE_KEY = "__nameraFallbackMemoryStorage";

function getFallbackMemoryStorage(): Map<string, string> {
  const scope = globalThis as typeof globalThis & { [FALLBACK_STORAGE_KEY]?: Map<string, string> };
  if (!scope[FALLBACK_STORAGE_KEY]) {
    scope[FALLBACK_STORAGE_KEY] = new Map<string, string>();
  }
  return scope[FALLBACK_STORAGE_KEY];
}

function getStorage(): Storage {
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }

  return {
    getItem: (key) => getFallbackMemoryStorage().get(key) ?? null,
    setItem: (key, value) => {
      getFallbackMemoryStorage().set(key, value);
    },
    removeItem: (key) => {
      getFallbackMemoryStorage().delete(key);
    },
    clear: () => {
      getFallbackMemoryStorage().clear();
    },
    key: (index) => Array.from(getFallbackMemoryStorage().keys())[index] ?? null,
    get length() {
      return getFallbackMemoryStorage().size;
    },
  } satisfies Storage;
}

export function loadConfig(storage: Storage = getStorage()): AppConfig {
  try {
    const raw = storage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      destinations: {
        ...DEFAULT_CONFIG.destinations,
        ...parsed.destinations,
      },
      providers: {
        ...DEFAULT_CONFIG.providers,
        ...parsed.providers,
      },
    } as AppConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function resetPersistedState(storage: Storage = getStorage()): void {
  storage.clear();
}

export function saveConfig(config: AppConfig, storage: Storage = getStorage()): void {
  storage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadHistory(storage: Storage = getStorage()): HistoryEntry[] {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[], storage: Storage = getStorage()): void {
  storage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export function pushHistory(entry: HistoryEntry, storage: Storage = getStorage()): HistoryEntry[] {
  const next = [entry, ...loadHistory(storage)].slice(0, 20);
  saveHistory(next, storage);
  return next;
}

export type ProviderCache = Record<string, string>;

export function loadExecutionLog(storage: Storage = getStorage()): ExecutionLogEntry[] {
  try {
    const raw = storage.getItem(EXECUTION_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ExecutionLogEntry[];
  } catch {
    return [];
  }
}

export function saveExecutionLog(entries: ExecutionLogEntry[], storage: Storage = getStorage()): void {
  storage.setItem(EXECUTION_LOG_KEY, JSON.stringify(entries));
}

export function pushExecutionLog(entry: ExecutionLogEntry, storage: Storage = getStorage()): ExecutionLogEntry[] {
  const next = [entry, ...loadExecutionLog(storage)].slice(0, 100);
  saveExecutionLog(next, storage);
  return next;
}

export function markExecutionUndone(id: string, storage: Storage = getStorage()): ExecutionLogEntry[] {
  const next = loadExecutionLog(storage).map((entry) =>
    entry.id === id
      ? {
          ...entry,
          undoneAt: entry.undoneAt ?? new Date().toISOString(),
        }
      : entry,
  );
  saveExecutionLog(next, storage);
  return next;
}

export function loadProviderCache(storage: Storage = getStorage()): ProviderCache {
  try {
    const raw = storage.getItem(PROVIDER_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProviderCache;
  } catch {
    return {};
  }
}

export function saveProviderCache(cache: ProviderCache, storage: Storage = getStorage()): void {
  storage.setItem(PROVIDER_CACHE_KEY, JSON.stringify(cache));
}

export function getProviderCacheEntry(key: string, storage: Storage = getStorage()): string | undefined {
  return loadProviderCache(storage)[key];
}

export function setProviderCacheEntry(key: string, value: string, storage: Storage = getStorage()): ProviderCache {
  const next = {
    ...loadProviderCache(storage),
    [key]: value,
  };
  saveProviderCache(next, storage);
  return next;
}

export type CorrectionStore = Record<string, CorrectionRecord>;

export function loadCorrections(storage: Storage = getStorage()): CorrectionStore {
  try {
    const raw = storage.getItem(CORRECTIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CorrectionStore;
  } catch {
    return {};
  }
}

export function saveCorrections(corrections: CorrectionStore, storage: Storage = getStorage()): void {
  storage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections));
}

export function getCorrection(key: string, storage: Storage = getStorage()): CorrectionRecord | undefined {
  return loadCorrections(storage)[key];
}

export function setCorrection(record: CorrectionRecord, storage: Storage = getStorage()): CorrectionStore {
  const next = {
    ...loadCorrections(storage),
    [record.key]: record,
  };
  saveCorrections(next, storage);
  return next;
}

export function loadRecentIngestRoots(storage: Storage = getStorage()): string[] {
  try {
    const raw = storage.getItem(RECENT_INGEST_ROOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveRecentIngestRoots(roots: string[], storage: Storage = getStorage()): void {
  storage.setItem(RECENT_INGEST_ROOTS_KEY, JSON.stringify(roots));
}

export function pushRecentIngestRoots(roots: string[], storage: Storage = getStorage()): string[] {
  const next = [...roots, ...loadRecentIngestRoots(storage)]
    .map((root) => root.trim())
    .filter(Boolean)
    .filter((root, index, all) => all.indexOf(root) === index)
    .slice(0, 10);
  saveRecentIngestRoots(next, storage);
  return next;
}

export function loadLocalBatchRuns(storage: Storage = getStorage()): LocalBatchRun[] {
  try {
    const raw = storage.getItem(LOCAL_BATCH_RUNS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalBatchRun[];
  } catch {
    return [];
  }
}

export function saveLocalBatchRuns(runs: LocalBatchRun[], storage: Storage = getStorage()): void {
  storage.setItem(LOCAL_BATCH_RUNS_KEY, JSON.stringify(runs));
}

export function pushLocalBatchRun(run: LocalBatchRun, storage: Storage = getStorage()): LocalBatchRun[] {
  const next = [run, ...loadLocalBatchRuns(storage).filter((entry) => entry.id !== run.id)].slice(0, 20);
  saveLocalBatchRuns(next, storage);
  return next;
}

export function updateLocalBatchRun(id: string, patch: Partial<LocalBatchRun>, storage: Storage = getStorage()): LocalBatchRun[] {
  const next = loadLocalBatchRuns(storage).map((run) =>
    run.id === id
      ? {
          ...run,
          ...patch,
          updatedAt: patch.updatedAt ?? new Date().toISOString(),
        }
      : run,
  );
  saveLocalBatchRuns(next, storage);
  return next;
}

export function loadDiagnosticLog(storage: Storage = getStorage()): DiagnosticLogEvent[] {
  try {
    const raw = storage.getItem(DIAGNOSTIC_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DiagnosticLogEvent[];
  } catch {
    return [];
  }
}

export function saveDiagnosticLog(events: DiagnosticLogEvent[], storage: Storage = getStorage()): void {
  storage.setItem(DIAGNOSTIC_LOG_KEY, JSON.stringify(events));
}

export function pushDiagnosticLogEvent(event: DiagnosticLogEvent, storage: Storage = getStorage()): DiagnosticLogEvent[] {
  const next = [event, ...loadDiagnosticLog(storage)].slice(0, 200);
  saveDiagnosticLog(next, storage);
  return next;
}

export function loadWebdavTransferSnapshots(storage: Storage = getStorage()): WebdavTransferQueueSnapshot[] {
  try {
    const raw = storage.getItem(WEBDAV_TRANSFER_SNAPSHOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WebdavTransferQueueSnapshot[];
  } catch {
    return [];
  }
}

export function saveWebdavTransferSnapshots(snapshots: WebdavTransferQueueSnapshot[], storage: Storage = getStorage()): void {
  storage.setItem(WEBDAV_TRANSFER_SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

export function pushWebdavTransferSnapshot(snapshot: WebdavTransferQueueSnapshot, storage: Storage = getStorage()): WebdavTransferQueueSnapshot[] {
  const next = [snapshot, ...loadWebdavTransferSnapshots(storage)].slice(0, 20);
  saveWebdavTransferSnapshots(next, storage);
  return next;
}

export function loadWebdavTransferIntents(storage: Storage = getStorage()): WebdavTransferIntent[] {
  try {
    const raw = storage.getItem(WEBDAV_TRANSFER_INTENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WebdavTransferIntent[];
  } catch {
    return [];
  }
}

export function saveWebdavTransferIntents(intents: WebdavTransferIntent[], storage: Storage = getStorage()): void {
  storage.setItem(WEBDAV_TRANSFER_INTENTS_KEY, JSON.stringify(intents));
}

export function pushWebdavTransferIntent(intent: WebdavTransferIntent, storage: Storage = getStorage()): WebdavTransferIntent[] {
  const next = [intent, ...loadWebdavTransferIntents(storage)].slice(0, 20);
  saveWebdavTransferIntents(next, storage);
  return next;
}

export function recordWebdavTransferIntentStageProgress(
  id: string,
  stage: "mkdir" | "upload" | "verify",
  status: "pending" | "completed" | "blocked",
  note: string,
  storage: Storage = getStorage(),
): WebdavTransferIntent[] {
  const next: WebdavTransferIntent[] = loadWebdavTransferIntents(storage).map((intent) => {
    if (intent.id !== id) return intent;
    const updatedAt = new Date().toISOString();
    return {
      ...intent,
      remoteStageProgress: {
        ...intent.remoteStageProgress,
        [stage]: {
          status,
          updatedAt,
          note,
        },
      },
      lifecycleEvents: [
        {
          at: updatedAt,
          type: "stage-progress-updated",
          detail: `${stage} marked ${status}: ${note}`,
        },
        ...intent.lifecycleEvents,
      ],
    };
  });
  saveWebdavTransferIntents(next, storage);
  return next;
}

export function acknowledgeWebdavTransferIntent(id: string, note: string, storage: Storage = getStorage()): WebdavTransferIntent[] {
  const next: WebdavTransferIntent[] = loadWebdavTransferIntents(storage).map((intent) => {
    if (intent.id !== id) return intent;
    const acknowledgedAt = intent.acknowledgedAt ?? new Date().toISOString();
    return {
      ...intent,
      status: "acknowledged",
      acknowledgedAt,
      acknowledgementNote: note,
      lifecycleEvents: [
        {
          at: acknowledgedAt,
          type: "acknowledged",
          detail: note,
        },
        ...intent.lifecycleEvents,
      ],
    };
  });
  saveWebdavTransferIntents(next, storage);
  return next;
}

export function annotateWebdavTransferIntent(
  id: string,
  handoffOwner: string,
  handoffNote: string,
  storage: Storage = getStorage(),
): WebdavTransferIntent[] {
  const next: WebdavTransferIntent[] = loadWebdavTransferIntents(storage).map((intent) => {
    if (intent.id !== id) return intent;
    const handoffAssignedAt = intent.handoffAssignedAt ?? new Date().toISOString();
    return {
      ...intent,
      handoffOwner,
      handoffNote,
      handoffAssignedAt,
      lifecycleEvents: [
        {
          at: handoffAssignedAt,
          type: "assigned",
          detail: `${handoffOwner}: ${handoffNote}`,
        },
        ...intent.lifecycleEvents,
      ],
    };
  });
  saveWebdavTransferIntents(next, storage);
  return next;
}

export function updateWebdavTransferIntentPrerequisite(
  id: string,
  prerequisiteName: string,
  status: "ready" | "blocked",
  detail: string,
  storage: Storage = getStorage(),
): WebdavTransferIntent[] {
  const next: WebdavTransferIntent[] = loadWebdavTransferIntents(storage).map((intent) => {
    if (intent.id !== id) return intent;

    const prerequisites = intent.prerequisites.map((entry) =>
      entry.name === prerequisiteName
        ? {
            ...entry,
            status,
            detail,
          }
        : entry,
    );
    const blocked = prerequisites.filter((entry) => entry.status === "blocked");
    const at = new Date().toISOString();

    return {
      ...intent,
      prerequisites,
      handoffReadiness: blocked.length ? "blocked" : "ready",
      handoffReadinessReason: blocked.length
        ? blocked.map((entry) => entry.name).join(", ")
        : "All recorded prerequisites are ready for manual handoff.",
      lifecycleEvents: [
        {
          at,
          type: "prerequisite-updated",
          detail: `${prerequisiteName} marked ${status}: ${detail}`,
        },
        ...intent.lifecycleEvents,
      ],
    };
  });
  saveWebdavTransferIntents(next, storage);
  return next;
}
