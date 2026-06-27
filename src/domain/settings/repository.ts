import { LazyStore } from "@tauri-apps/plugin-store";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  QuerySettings,
  clampQueryTimeout,
} from "./types";

const store = new LazyStore("settings.json");
const SETTINGS_KEY = "app";

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    query: {
      ...DEFAULT_APP_SETTINGS.query,
      ...value?.query,
      timeoutMs: clampQueryTimeout(value?.query?.timeoutMs ?? DEFAULT_APP_SETTINGS.query.timeoutMs),
    },
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const settings = await store.get<Partial<AppSettings>>(SETTINGS_KEY);
  return normalizeSettings(settings);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  await store.set(SETTINGS_KEY, normalized);
  await store.save();
  return normalized;
}

export async function updateQuerySettings(settings: Partial<QuerySettings>) {
  const current = await loadSettings();
  return saveSettings({
    ...current,
    query: {
      ...current.query,
      ...settings,
      timeoutMs: clampQueryTimeout(settings.timeoutMs ?? current.query.timeoutMs),
    },
  });
}
