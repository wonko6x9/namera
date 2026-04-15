import type { AppConfig, CorrectionRecord, ExecutionLogEntry, HistoryEntry } from "@namera/core";

export const DEFAULT_CONFIG: AppConfig = {
  destinations: {
    movieRoot: "Movies",
    tvRoot: "TV Shows",
    musicRoot: "Music",
    sourceRoot: ".",
    targetRoot: ".",
    collisionPolicy: "skip",
  },
  providers: {},
};

const CONFIG_KEY = "namera.config";
const HISTORY_KEY = "namera.history";
const EXECUTION_LOG_KEY = "namera.execution-log";
const PROVIDER_CACHE_KEY = "namera.provider-cache";
const CORRECTIONS_KEY = "namera.corrections";
const fallbackMemoryStorage = new Map<string, string>();

function getStorage(): Storage {
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }

  return {
    getItem: (key) => fallbackMemoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      fallbackMemoryStorage.set(key, value);
    },
    removeItem: (key) => {
      fallbackMemoryStorage.delete(key);
    },
    clear: () => {
      fallbackMemoryStorage.clear();
    },
    key: (index) => Array.from(fallbackMemoryStorage.keys())[index] ?? null,
    get length() {
      return fallbackMemoryStorage.size;
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
