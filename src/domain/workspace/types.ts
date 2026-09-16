import type { RowQueryOptions } from "@/domain/database/types";

export type WorkspaceTabType = "table";
export type DataViewMode = "list" | "json" | "table";
export type DataTab = "rows" | "query" | "schema" | "indexes";
export type ConsoleTab = "editor" | "history";
export type WorkspaceOperation =
  | "execute"
  | "query"
  | "benchmark"
  | "insert"
  | "update"
  | "delete"
  | "create_table"
  | "create_database"
  | "export"
  | null;

export interface RowQueryDraft {
  project: string;
  sort: string;
  skip: string;
  limit: string;
}

export interface HistoryEntry {
  id: string;
  action: string;
  query?: string;
  status: "success" | "error";
  message: string;
  timestamp: Date;
}

export interface ExecResult {
  success: boolean;
  message: string;
}

export interface WorkspaceTabState {
  page: number;
  pageSize: number;
  whereClause: string;
  whereDraft: string;
  rowOptions: RowQueryOptions;
  rowOptionsDraft: RowQueryDraft;
  viewMode: DataViewMode;
  activeDataTab: DataTab;
  querySql: string;
  lastQuerySql: string;
  queryRows: Record<string, unknown>[];
  queryError: string | null;
  consoleOpen: boolean;
  consoleTab: ConsoleTab;
  sqlQuery: string;
  execResult: ExecResult | null;
  history: HistoryEntry[];
  activeTask: string | null;
  pendingOperation: WorkspaceOperation;
}

export interface WorkspaceTab {
  id: string;
  type: WorkspaceTabType;
  tableName: string;
  state: WorkspaceTabState;
}

export interface WorkspaceTabDefaults {
  pageSize: number;
  viewMode: DataViewMode;
  queryLimit?: number;
}

export type WorkspaceTabStatePatch =
  | Partial<WorkspaceTabState>
  | ((state: WorkspaceTabState) => Partial<WorkspaceTabState>);

const DEFAULT_TAB_PAGE_SIZE = 10;
const DEFAULT_TAB_VIEW_MODE: DataViewMode = "list";
const DEFAULT_QUERY_LIMIT = 100;

export function createWorkspaceTab(
  tableName: string,
  defaults: Partial<WorkspaceTabDefaults> = {},
): WorkspaceTab {
  const pageSize = defaults.pageSize ?? DEFAULT_TAB_PAGE_SIZE;
  const viewMode = defaults.viewMode ?? DEFAULT_TAB_VIEW_MODE;
  const queryLimit = defaults.queryLimit ?? DEFAULT_QUERY_LIMIT;

  return {
    id: crypto.randomUUID(),
    type: "table",
    tableName,
    state: {
      page: 0,
      pageSize,
      whereClause: "",
      whereDraft: "",
      rowOptions: {},
      rowOptionsDraft: {
        project: "",
        sort: "",
        skip: "",
        limit: "",
      },
      viewMode,
      activeDataTab: "rows",
      querySql: `SELECT * FROM ${tableName} LIMIT ${queryLimit}`,
      lastQuerySql: "",
      queryRows: [],
      queryError: null,
      consoleOpen: false,
      consoleTab: "editor",
      sqlQuery: "",
      execResult: null,
      history: [],
      activeTask: null,
      pendingOperation: null,
    },
  };
}

