import { LazyStore } from "@tauri-apps/plugin-store";
import {
  type AppSettings,
  DEFAULT_APP_SETTINGS,
  type McpAccess,
  type QuerySettings,
  clampNumber,
  clampQueryTimeout,
} from "./types";

const store = new LazyStore("settings.json");
const SETTINGS_KEY = "app";

function normalizeMcpPermissions(value: unknown): Record<string, McpAccess> {
  const mcp = (value ?? {}) as { permissions?: unknown; connectionIds?: unknown };
  const permissions: Record<string, McpAccess> = {};
  // Earlier builds stored a plain list of shared ids; those were read-only.
  if (Array.isArray(mcp.connectionIds)) {
    for (const id of mcp.connectionIds) if (typeof id === "string") permissions[id] = "read";
  }
  if (mcp.permissions && typeof mcp.permissions === "object") {
    for (const [id, access] of Object.entries(mcp.permissions as Record<string, unknown>)) {
      if (access === "read" || access === "write") permissions[id] = access;
    }
  }
  return permissions;
}

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    query: {
      ...DEFAULT_APP_SETTINGS.query,
      ...value?.query,
      timeoutMs: clampQueryTimeout(value?.query?.timeoutMs ?? DEFAULT_APP_SETTINGS.query.timeoutMs),
      defaultLimit: clampNumber(value?.query?.defaultLimit ?? DEFAULT_APP_SETTINGS.query.defaultLimit, DEFAULT_APP_SETTINGS.query.defaultLimit, 1, 10_000),
    },
    editor: {
      ...DEFAULT_APP_SETTINGS.editor,
      ...value?.editor,
      fontSize: clampNumber(value?.editor?.fontSize ?? DEFAULT_APP_SETTINGS.editor.fontSize, DEFAULT_APP_SETTINGS.editor.fontSize, 10, 22),
      historyLimit: clampNumber(value?.editor?.historyLimit ?? DEFAULT_APP_SETTINGS.editor.historyLimit, DEFAULT_APP_SETTINGS.editor.historyLimit, 10, 1_000),
    },
    dataView: {
      ...DEFAULT_APP_SETTINGS.dataView,
      ...value?.dataView,
      defaultPageSize: clampNumber(value?.dataView?.defaultPageSize ?? DEFAULT_APP_SETTINGS.dataView.defaultPageSize, DEFAULT_APP_SETTINGS.dataView.defaultPageSize, 10, 250),
      maxCardFields: clampNumber(value?.dataView?.maxCardFields ?? DEFAULT_APP_SETTINGS.dataView.maxCardFields, DEFAULT_APP_SETTINGS.dataView.maxCardFields, 4, 100),
      truncateLength: clampNumber(value?.dataView?.truncateLength ?? DEFAULT_APP_SETTINGS.dataView.truncateLength, DEFAULT_APP_SETTINGS.dataView.truncateLength, 40, 1_000),
    },
    connections: {
      ...DEFAULT_APP_SETTINGS.connections,
      ...value?.connections,
    },
    security: {
      ...DEFAULT_APP_SETTINGS.security,
      ...value?.security,
    },
    appearance: {
      ...DEFAULT_APP_SETTINGS.appearance,
      ...value?.appearance,
      fontSize: clampNumber(value?.appearance?.fontSize ?? DEFAULT_APP_SETTINGS.appearance.fontSize, DEFAULT_APP_SETTINGS.appearance.fontSize, 11, 18),
    },
    updates: {
      ...DEFAULT_APP_SETTINGS.updates,
      ...value?.updates,
    },
    advanced: {
      ...DEFAULT_APP_SETTINGS.advanced,
      ...value?.advanced,
    },
    mcp: {
      ...DEFAULT_APP_SETTINGS.mcp,
      ...value?.mcp,
      port: clampNumber(value?.mcp?.port ?? DEFAULT_APP_SETTINGS.mcp.port, DEFAULT_APP_SETTINGS.mcp.port, 1024, 65535),
      maxRows: clampNumber(value?.mcp?.maxRows ?? DEFAULT_APP_SETTINGS.mcp.maxRows, DEFAULT_APP_SETTINGS.mcp.maxRows, 1, 5000),
      permissions: normalizeMcpPermissions(value?.mcp),
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
  return updateSettings({ query: { ...current.query, ...settings } });
}

export async function updateSettings(settings: Partial<AppSettings>) {
  const current = await loadSettings();
  return saveSettings({
    ...current,
    ...settings,
    query: { ...current.query, ...settings.query },
    editor: { ...current.editor, ...settings.editor },
    dataView: { ...current.dataView, ...settings.dataView },
    connections: { ...current.connections, ...settings.connections },
    security: { ...current.security, ...settings.security },
    appearance: { ...current.appearance, ...settings.appearance },
    updates: { ...current.updates, ...settings.updates },
    advanced: { ...current.advanced, ...settings.advanced },
  });
}

export async function resetSettings() {
  return saveSettings(DEFAULT_APP_SETTINGS);
}
