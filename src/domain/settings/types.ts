export interface QuerySettings {
  timeoutMs: number;
}

export interface AppSettings {
  query: QuerySettings;
}

export const MIN_QUERY_TIMEOUT_MS = 1_000;
export const MAX_QUERY_TIMEOUT_MS = 600_000;
export const DEFAULT_QUERY_TIMEOUT_MS = 60_000;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  query: {
    timeoutMs: DEFAULT_QUERY_TIMEOUT_MS,
  },
};

export function clampQueryTimeout(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_QUERY_TIMEOUT_MS;
  return Math.round(Math.min(MAX_QUERY_TIMEOUT_MS, Math.max(MIN_QUERY_TIMEOUT_MS, value)));
}
