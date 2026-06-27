export interface QuerySettings {
  timeoutMs: number;
  defaultLimit: number;
  cancelOnNavigate: boolean;
  exportFormat: "csv" | "json" | "xls";
}

export interface EditorSettings {
  fontSize: number;
  autocomplete: boolean;
  formatOnRun: boolean;
  historyLimit: number;
}

export interface DataViewSettings {
  defaultPageSize: number;
  defaultViewMode: "list" | "json" | "table";
  maxCardFields: number;
  truncateLength: number;
  dateDisplay: "raw" | "local";
}

export interface ConnectionSettings {
  autoConnect: boolean;
  rememberLastWorkspace: boolean;
  schemaCache: boolean;
  refreshMetadataOnConnect: boolean;
}

export interface SecuritySettings {
  maskSensitiveFields: boolean;
  confirmDestructiveActions: boolean;
  allowExports: boolean;
  clearSecretsOnDisconnect: boolean;
}

export interface AppearanceSettings {
  theme: "light" | "dark";
  density: "comfortable" | "compact";
  fontSize: number;
}

export interface UpdateSettings {
  autoCheck: boolean;
  channel: "alpha" | "stable";
}

export interface AdvancedSettings {
  debugLogs: boolean;
}

export interface AppSettings {
  query: QuerySettings;
  editor: EditorSettings;
  dataView: DataViewSettings;
  connections: ConnectionSettings;
  security: SecuritySettings;
  appearance: AppearanceSettings;
  updates: UpdateSettings;
  advanced: AdvancedSettings;
}

export const MIN_QUERY_TIMEOUT_MS = 1_000;
export const MAX_QUERY_TIMEOUT_MS = 600_000;
export const DEFAULT_QUERY_TIMEOUT_MS = 60_000;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  query: {
    timeoutMs: DEFAULT_QUERY_TIMEOUT_MS,
    defaultLimit: 100,
    cancelOnNavigate: true,
    exportFormat: "csv",
  },
  editor: {
    fontSize: 13,
    autocomplete: true,
    formatOnRun: false,
    historyLimit: 100,
  },
  dataView: {
    defaultPageSize: 10,
    defaultViewMode: "list",
    maxCardFields: 24,
    truncateLength: 120,
    dateDisplay: "raw",
  },
  connections: {
    autoConnect: false,
    rememberLastWorkspace: true,
    schemaCache: true,
    refreshMetadataOnConnect: false,
  },
  security: {
    maskSensitiveFields: true,
    confirmDestructiveActions: true,
    allowExports: true,
    clearSecretsOnDisconnect: false,
  },
  appearance: {
    theme: "light",
    density: "comfortable",
    fontSize: 13,
  },
  updates: {
    autoCheck: true,
    channel: "alpha",
  },
  advanced: {
    debugLogs: false,
  },
};

export function clampQueryTimeout(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_QUERY_TIMEOUT_MS;
  return Math.round(Math.min(MAX_QUERY_TIMEOUT_MS, Math.max(MIN_QUERY_TIMEOUT_MS, value)));
}

export function clampNumber(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)));
}
