import type { AppConfig, HistoryEntry } from "@namera/core";

export const DEFAULT_CONFIG: AppConfig = {
  destinations: {
    movieRoot: "Movies",
    tvRoot: "TV Shows",
    musicRoot: "Music",
  },
  providers: {},
};

const CONFIG_KEY = "namera.config";
const HISTORY_KEY = "namera.history";

export function loadConfig(storage: Storage = localStorage): AppConfig {
  try {
    const raw = storage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as AppConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: AppConfig, storage: Storage = localStorage): void {
  storage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadHistory(storage: Storage = localStorage): HistoryEntry[] {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[], storage: Storage = localStorage): void {
  storage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export function pushHistory(entry: HistoryEntry, storage: Storage = localStorage): HistoryEntry[] {
  const next = [entry, ...loadHistory(storage)].slice(0, 20);
  saveHistory(next, storage);
  return next;
}
