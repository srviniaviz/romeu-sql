import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDatabaseModal } from "./CreateDatabaseModal";
import { CreateTableModal } from "./CreateTableModal";
import { InsertDataModal } from "./InsertDataModal";
import { ExplorerHeader } from "./explorer/ExplorerHeader";
import { SqlConsole } from "./explorer/SqlConsole";
import { TableBrowser } from "./explorer/TableBrowser";
import { DataPreview } from "./explorer/DataPreview";
import { SchemaDiagram } from "./explorer/SchemaDiagram";
import { toast } from "@/components/ui/toast";
import type { Connection } from "../lib/useConnections";
import {
  benchmarkAnalyze,
  countRows,
  createDatabase,
  createTable,
  clearDatabaseMetadataCache,
  deleteRow,
  executeSql,
  explainRows,
  exportQuery,
  getDatabaseSize,
  insertRow,
  loadSchemaDiagram,
  listColumns,
  listForeignKeys,
  listDeleteCascadeImpacts,
  listIndexes,
  listTables,
  listTableStats,
  selectQuery,
  selectRowsPage,
  updateRow,
} from "@/domain/database/service";
import type { ForeignKeyInfo } from "@/domain/database/types";
import type {
  ConsoleTab,
  DataTab,
  HistoryEntry,
  RowQueryDraft,
  WorkspaceOperation,
  WorkspaceTab,
  WorkspaceTabState,
  WorkspaceTabStatePatch,
} from "@/domain/workspace/types";
import { createWorkspaceTab } from "@/domain/workspace/types";
import { useSettings } from "@/domain/settings/useSettings";
import { DEFAULT_APP_SETTINGS } from "@/domain/settings/types";

interface Props {
  connection: Connection;
  onDisconnect: () => void;
  openCreateOnMount?: boolean;
  openCreateDbOnMount?: boolean;
  onModalOpened?: () => void;
  workspaceTab: WorkspaceTab | null;
  onTableSelected?: (tableName: string | null) => void;
  onWorkspaceTabChange: (tabId: string, patch: WorkspaceTabStatePatch) => void;
  foreignKeyNavigation?: { tableName: string; whereClause: string; token: number } | null;
  onForeignKeyNavigate?: (tableName: string, whereClause: string) => void;
}

function foreignKeyWhereClause(column: string, value: unknown, engine: string) {
  const quote = engine === "mysql" ? "`" : "\"";
  const quotedColumn = column.split(".").map((part) => `${quote}${part.split(quote).join(quote + quote)}${quote}`).join(".");
  if (typeof value === "number" && Number.isFinite(value)) return `${quotedColumn} = ${value}`;
  if (typeof value === "boolean") return `${quotedColumn} = ${value ? "TRUE" : "FALSE"}`;
  return `${quotedColumn} = '${String(value).replace(/'/g, "''")}'`;
}

export function DatabaseExplorer({
  connection,
  onDisconnect,
  openCreateOnMount,
  openCreateDbOnMount,
  onModalOpened,
  workspaceTab,
  onTableSelected,
  onWorkspaceTabChange,
  foreignKeyNavigation,
  onForeignKeyNavigate,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const appSettings = settings ?? DEFAULT_APP_SETTINGS;
  const selectedTable = workspaceTab?.tableName ?? null;
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [browserState, setBrowserState] = useState<WorkspaceTabState>(() => createWorkspaceTab("", {
    pageSize: appSettings.dataView.defaultPageSize,
    viewMode: appSettings.dataView.defaultViewMode,
    queryLimit: appSettings.query.defaultLimit,
  }).state);
  const session = workspaceTab?.state ?? browserState;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const emptyRowsRecoveryKey = useRef<string | null>(null);
  const page = session.page;
  const pageSize = session.pageSize;
  const whereClause = session.whereClause;
  const whereDraft = session.whereDraft;
  const rowOptions = session.rowOptions;
  const rowOptionsDraft: RowQueryDraft = session.rowOptionsDraft ?? {
    project: rowOptions.project ?? "",
    sort: rowOptions.sort ?? "",
    skip: rowOptions.skip ? String(rowOptions.skip) : "",
    limit: rowOptions.limit ? String(rowOptions.limit) : "",
  };
  const viewMode = session.viewMode;
  const activeDataTab: DataTab = session.activeDataTab;
  const querySql = session.querySql;
  const lastQuerySql = session.lastQuerySql;
  const queryRows = session.queryRows;
  const queryError = session.queryError;
  const consoleOpen = session.consoleOpen;
  const consoleTab: ConsoleTab = session.consoleTab;
  const sqlQuery = session.sqlQuery;
  const execResult = session.execResult;
  const history = session.history;
  const activeTask = session.activeTask;
  const pendingOperation: WorkspaceOperation = session.pendingOperation;

  const updateWorkspaceState = (tabId: string | null, patch: WorkspaceTabStatePatch) => {
    if (tabId) {
      onWorkspaceTabChange(tabId, patch);
      return;
    }
    setBrowserState((state) => ({
      ...state,
      ...(typeof patch === "function" ? patch(state) : patch),
    }));
  };

  const updateCurrentTab = (patch: WorkspaceTabStatePatch) => {
    updateWorkspaceState(workspaceTab?.id ?? null, patch);
  };

  useEffect(() => {
    let mounted = true;

    void import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((version) => {
        if (mounted) setAppVersion(version);
      })
      .catch(() => {
        if (mounted) setAppVersion("");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (openCreateOnMount) {
      setIsCreateModalOpen(true);
      onModalOpened?.();
    } else if (openCreateDbOnMount) {
      setIsCreateDbModalOpen(true);
      onModalOpened?.();
    }
  }, [openCreateOnMount, openCreateDbOnMount, onModalOpened]);

  useEffect(() => {
    onModalOpened?.();
  }, [isCreateModalOpen, isCreateDbModalOpen, isInsertModalOpen, onModalOpened]);

  useEffect(() => {
    setIsDiagramOpen(false);
  }, [connection.id, connection.database]);

  useEffect(() => {
    setIsDiagramOpen(false);
  }, [selectedTable]);

  useEffect(() => {
    if (!foreignKeyNavigation || foreignKeyNavigation.tableName !== selectedTable || !workspaceTab) return;
    updateWorkspaceState(workspaceTab.id, {
      whereClause: foreignKeyNavigation.whereClause,
      whereDraft: foreignKeyNavigation.whereClause,
      rowOptions: {},
      rowOptionsDraft: { project: "", sort: "", skip: "", limit: "" },
      page: 0,
    });
  }, [foreignKeyNavigation, selectedTable, workspaceTab?.id]);

  const addHistory = (tabId: string | null, entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    updateWorkspaceState(tabId, (state) => ({
      history: [
        {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        ...state.history,
      ].slice(0, appSettings.editor.historyLimit),
    }));
  };

  const {
    data: tables = [],
    isLoading: loadingTables,
    error: fetchError,
    refetch: refetchTables,
    isFetching: refreshingTables,
  } = useQuery({
    queryKey: ["tables", connection.id, connection.database],
    queryFn: () => listTables(connection),
    enabled: !!connection.id,
  });

  const { data: tableStats = [] } = useQuery({
    queryKey: ["tableStats", connection.id, connection.database],
    queryFn: () => listTableStats(connection),
    enabled: !!connection.id && tables.length > 0 && !loadingTables,
  });

  const schemaDiagramQuery = useQuery({
    queryKey: ["schemaDiagram", connection.id, connection.database, tables.map((table) => table.name)],
    queryFn: () => loadSchemaDiagram(connection, tables),
    enabled: isDiagramOpen && !!connection.id && tables.length > 0 && !loadingTables,
  });

  const { data: databaseSizeBytes = null, isFetching: fetchingDatabaseSize } = useQuery({
    queryKey: ["databaseSize", connection.id, connection.database],
    queryFn: () => getDatabaseSize(connection),
    enabled: !!connection.id,
  });

  const { data: totalRows = 0, isFetching: countingRows } = useQuery({
    queryKey: ["tableRowsCount", connection.id, connection.database, selectedTable, whereClause],
    queryFn: () => (selectedTable ? countRows(connection, selectedTable, whereClause) : 0),
    enabled: !!selectedTable,
  });

  const {
    data: tableData = [],
    isLoading: loadingRows,
    isFetching: fetchingRows,
    refetch: refetchRows,
  } = useQuery({
    queryKey: ["tableData", connection.id, connection.database, selectedTable, page, pageSize, whereClause, rowOptions],
    queryFn: () => (selectedTable ? selectRowsPage(connection, selectedTable, pageSize, page * pageSize, whereClause, rowOptions) : []),
    enabled: !!selectedTable,
  });

  useEffect(() => {
    const hasOptions = Boolean(rowOptions.project || rowOptions.sort || rowOptions.skip || rowOptions.limit);
    const recoveryKey = `${connection.id}:${connection.database}:${selectedTable}:${page}:${pageSize}:${whereClause}:${JSON.stringify(rowOptions)}`;
    if (
      selectedTable &&
      page === 0 &&
      totalRows > 0 &&
      tableData.length === 0 &&
      !loadingRows &&
      !fetchingRows &&
      !countingRows &&
      !whereClause &&
      !hasOptions &&
      emptyRowsRecoveryKey.current !== recoveryKey
    ) {
      emptyRowsRecoveryKey.current = recoveryKey;
      refetchRows();
    }
  }, [
    connection.database,
    connection.id,
    countingRows,
    fetchingRows,
    loadingRows,
    page,
    pageSize,
    refetchRows,
    rowOptions,
    selectedTable,
    tableData.length,
    totalRows,
    whereClause,
  ]);

  const { data: columns = [] } = useQuery({
    queryKey: ["columns", connection.id, connection.database, selectedTable],
    queryFn: () => (selectedTable ? listColumns(connection, selectedTable) : []),
    enabled: !!selectedTable,
  });

  const { data: foreignKeys = [] } = useQuery<ForeignKeyInfo[]>({
    queryKey: ["foreignKeys", connection.id, connection.database, selectedTable],
    queryFn: () => (selectedTable ? listForeignKeys(connection, selectedTable) : []),
    enabled: !!selectedTable,
  });

  const { data: indexes = [] } = useQuery({
    queryKey: ["indexes", connection.id, connection.database, selectedTable],
    queryFn: () => (selectedTable ? listIndexes(connection, selectedTable) : []),
    enabled: !!selectedTable,
  });

  const { data: deleteCascadeImpacts = [], isFetching: loadingDeleteCascadeImpacts } = useQuery({
    queryKey: ["deleteCascadeImpacts", connection.id, connection.database, selectedTable],
    queryFn: () => (selectedTable ? listDeleteCascadeImpacts(connection, selectedTable) : []),
    enabled: !!selectedTable,
  });

  const executeMutation = useMutation({
    mutationFn: ({ query }: { tabId: string | null; query: string }) => executeSql(connection, query),
    onMutate: ({ tabId }) => {
      updateWorkspaceState(tabId, { pendingOperation: "execute" });
    },
    onSuccess: (res, { tabId }) => {
      const msg = t("explorer.sync_success");
      updateWorkspaceState(tabId, {
        execResult: { success: true, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("explorer.sql_editor"), query: res.query, status: "success", message: msg });
      clearDatabaseMetadataCache(connection);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["tableStats"] });
      queryClient.invalidateQueries({ queryKey: ["databaseSize"] });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
      queryClient.invalidateQueries({ queryKey: ["schemaDiagram"] });
    },
    onError: (err: unknown, { tabId, query }) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      updateWorkspaceState(tabId, {
        execResult: { success: false, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("explorer.sql_editor"), query, status: "error", message: msg });
    },
    onSettled: (_data, _error, variables) => {
      if (variables) updateWorkspaceState(variables.tabId, { pendingOperation: null });
    },
  });

  const insertMutation = useMutation({
    mutationFn: ({ tableName, data }: { tabId: string; tableName: string; data: Record<string, unknown> }) => {
      return insertRow(connection, tableName, data);
    },
    onMutate: ({ tabId }) => {
      updateWorkspaceState(tabId, { pendingOperation: "insert" });
    },
    onSuccess: (res, { tabId }) => {
      const msg = t("explorer.sync_success");
      updateWorkspaceState(tabId, {
        execResult: { success: true, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("explorer.add_document"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
      queryClient.invalidateQueries({ queryKey: ["databaseSize"] });
      queryClient.invalidateQueries({ queryKey: ["schemaDiagram"] });
    },
    onError: (err: unknown, { tabId }) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      updateWorkspaceState(tabId, {
        execResult: { success: false, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("explorer.add_document"), status: "error", message: msg });
    },
    onSettled: (_data, _error, variables) => {
      if (variables) updateWorkspaceState(variables.tabId, { pendingOperation: null });
    },
  });

  const queryMutation = useMutation({
    mutationFn: ({ query }: { tabId: string; query: string }) => selectQuery(connection, query),
    onMutate: ({ tabId, query }) => {
      updateWorkspaceState(tabId, {
        lastQuerySql: query,
        pendingOperation: "query",
      });
    },
    onSuccess: (rows, { tabId, query }) => {
      updateWorkspaceState(tabId, {
        queryRows: rows,
        queryError: null,
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("data_preview.query"), query, status: "success", message: `${rows.length} rows returned` });
    },
    onError: (err: unknown, { tabId, query }) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      updateWorkspaceState(tabId, {
        queryRows: [],
        queryError: msg,
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("data_preview.query"), query, status: "error", message: msg });
    },
    onSettled: (_data, _error, variables) => {
      if (variables) updateWorkspaceState(variables.tabId, { pendingOperation: null });
    },
  });

  const benchmarkMutation = useMutation({
    mutationFn: () => benchmarkAnalyze(connection),
    onMutate: () => {
      if (workspaceTab) updateWorkspaceState(workspaceTab.id, {
        activeTask: t("table_browser.benchmark"),
        pendingOperation: "benchmark",
      });
    },
    onSettled: () => {
      if (workspaceTab) updateWorkspaceState(workspaceTab.id, {
        activeTask: null,
        pendingOperation: null,
      });
    },
  });

  const updateRowMutation = useMutation({
    mutationFn: ({ tableName, original, next }: { tabId: string; tableName: string; original: Record<string, unknown>; next: Record<string, unknown> }) => {
      return updateRow(connection, tableName, original, next);
    },
    onMutate: ({ tabId }) => {
      updateWorkspaceState(tabId, { pendingOperation: "update" });
    },
    onSuccess: (res, { tabId }) => {
      const msg = t("explorer.sync_success");
      updateWorkspaceState(tabId, {
        execResult: { success: true, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("data_preview.edit_row"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
      queryClient.invalidateQueries({ queryKey: ["databaseSize"] });
      queryClient.invalidateQueries({ queryKey: ["schemaDiagram"] });
    },
    onError: (err: unknown, { tabId }) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      updateWorkspaceState(tabId, {
        execResult: { success: false, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("data_preview.edit_row"), status: "error", message: msg });
    },
    onSettled: (_data, _error, variables) => {
      if (variables) updateWorkspaceState(variables.tabId, { pendingOperation: null });
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: ({ tableName, row }: { tabId: string; tableName: string; row: Record<string, unknown> }) => {
      return deleteRow(connection, tableName, row);
    },
    onMutate: ({ tabId }) => {
      updateWorkspaceState(tabId, { pendingOperation: "delete" });
    },
    onSuccess: (res, { tabId }) => {
      const msg = t("explorer.sync_success");
      updateWorkspaceState(tabId, {
        execResult: { success: true, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("data_preview.delete_row"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
      queryClient.invalidateQueries({ queryKey: ["databaseSize"] });
      queryClient.invalidateQueries({ queryKey: ["schemaDiagram"] });
    },
    onError: (err: unknown, { tabId }) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      updateWorkspaceState(tabId, {
        execResult: { success: false, message: msg },
        pendingOperation: null,
      });
      addHistory(tabId, { action: t("data_preview.delete_row"), status: "error", message: msg });
    },
    onSettled: (_data, _error, variables) => {
      if (variables) updateWorkspaceState(variables.tabId, { pendingOperation: null });
    },
  });

  const createTableMutation = useMutation({
    mutationFn: (query: string) => createTable(connection, query),
    onSuccess: () => {
      clearDatabaseMetadataCache(connection);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["tableStats"] });
      queryClient.invalidateQueries({ queryKey: ["databaseSize"] });
      queryClient.invalidateQueries({ queryKey: ["schemaDiagram"] });
      setIsCreateModalOpen(false);
    },
  });

  const createDbMutation = useMutation({
    mutationFn: (name: string) => createDatabase(connection, name),
    onSuccess: () => {
      clearDatabaseMetadataCache(connection);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["tableStats"] });
      queryClient.invalidateQueries({ queryKey: ["databaseSize"] });
      queryClient.invalidateQueries({ queryKey: ["schemaDiagram"] });
      setIsCreateDbModalOpen(false);
    },
  });

  const error = fetchError instanceof Error ? fetchError.message : fetchError ? String(fetchError) : null;
  const schemaDiagramError = schemaDiagramQuery.error instanceof Error
    ? schemaDiagramQuery.error.message
    : schemaDiagramQuery.error
      ? String(schemaDiagramQuery.error)
      : null;

  const refreshSchemaDiagram = async () => {
    clearDatabaseMetadataCache(connection);
    await refetchTables();
    await queryClient.invalidateQueries({ queryKey: ["schemaDiagram"] });
  };

  if (loadingTables) {
    return (
      <div className="flex h-[calc(100vh-6rem)] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin" size={26} />
        <span className="text-[12px] font-medium">Connecting to {connection.name}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div className="flex max-w-xl flex-col items-center text-center">
          <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={19} />
          </div>
          <h2 className="text-[16px] font-semibold text-destructive">
            {t("explorer.connection_failed")}
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{error}</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="destructive"
              className="h-8 rounded-md px-4 text-[12px]"
              onClick={() => {
                clearDatabaseMetadataCache(connection);
                refetchTables();
              }}
            >
              {t("explorer.try_again")}
            </Button>
            <Button variant="ghost" className="h-8 rounded-md px-4 text-[12px]" onClick={onDisconnect}>
              {t("explorer.disconnect")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ExplorerHeader
        connection={connection}
        selectedTable={isDiagramOpen ? null : selectedTable}
        tableCount={tables.length}
        rowCount={totalRows}
        databaseSizeBytes={databaseSizeBytes}
        refreshing={refreshingTables || fetchingRows || countingRows || fetchingDatabaseSize || (isDiagramOpen && schemaDiagramQuery.isFetching)}
        diagramOpen={isDiagramOpen}
        onToggleDiagram={() => setIsDiagramOpen((open) => !open)}
        onDisconnect={onDisconnect}
      />

      <div className={isDiagramOpen ? "min-h-0 flex-1 overflow-hidden" : selectedTable ? "min-h-0 flex-1 overflow-hidden p-5" : "min-h-0 flex-1 space-y-4 overflow-auto p-5"}>
        {isDiagramOpen ? (
          <SchemaDiagram
            data={schemaDiagramQuery.data}
            loading={schemaDiagramQuery.isLoading}
            fetching={schemaDiagramQuery.isFetching}
            error={schemaDiagramError}
            onRefresh={() => { void refreshSchemaDiagram(); }}
            onOpenTable={(tableName) => {
              setIsDiagramOpen(false);
              onTableSelected?.(tableName);
            }}
          />
        ) : selectedTable ? (
          <DataPreview
            key={workspaceTab?.id}
            selectedTable={selectedTable}
            rows={tableData}
            loading={loadingRows}
            viewMode={viewMode}
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            columnCount={columns.length}
            columns={columns}
            foreignKeys={foreignKeys}
            indexes={indexes}
            deleteCascadeImpacts={deleteCascadeImpacts}
            loadingDeleteCascadeImpacts={loadingDeleteCascadeImpacts}
            refreshing={fetchingRows || countingRows}
            whereClause={whereClause}
            queryRows={queryRows}
            queryLoading={queryMutation.isPending && pendingOperation === "query"}
            queryError={queryError}
            activeTab={activeDataTab}
            sql={querySql}
            lastQuerySql={lastQuerySql}
            whereDraft={whereDraft}
            rowOptionsDraft={rowOptionsDraft}
            onBack={() => onTableSelected?.(null)}
            onNavigateForeignKey={(foreignKey, value) => {
              if (value === null || value === undefined) return;
              onForeignKeyNavigate?.(
                foreignKey.targetTable,
                foreignKeyWhereClause(foreignKey.targetColumn, value, connection.type)
              );
            }}
            onInsert={() => setIsInsertModalOpen(true)}
            onActiveTabChange={(nextTab) => updateCurrentTab({ activeDataTab: nextTab })}
            onSqlChange={(nextSql) => updateCurrentTab({ querySql: nextSql })}
            onWhereDraftChange={(nextWhereDraft) => updateCurrentTab({ whereDraft: nextWhereDraft })}
            onRowOptionsDraftChange={(nextDraft) => updateCurrentTab({ rowOptionsDraft: nextDraft })}
            onFilterApply={(nextWhereClause) => {
              updateCurrentTab({
                whereClause: nextWhereClause,
                whereDraft: nextWhereClause,
                page: 0,
              });
            }}
            onFilterReset={() => {
              updateCurrentTab({
                whereClause: "",
                whereDraft: "",
                rowOptions: {},
                rowOptionsDraft: { project: "", sort: "", skip: "", limit: "" },
                page: 0,
              });
            }}
            onOptionsApply={(options) => {
              updateCurrentTab({ rowOptions: options, page: 0 });
            }}
            onFind={() => {
              queryClient.invalidateQueries({ queryKey: ["tableRowsCount", connection.id, connection.database, selectedTable] });
              queryClient.invalidateQueries({ queryKey: ["tableData", connection.id, connection.database, selectedTable] });
            }}
            onValidateWhere={(nextWhereClause) => explainRows(connection, selectedTable, nextWhereClause)}
            onRunQuery={(query) => {
              if (!workspaceTab) return Promise.resolve([]);
              return queryMutation.mutateAsync({ tabId: workspaceTab.id, query });
            }}
            onExportQuery={(query, path, format) => exportQuery(connection, query, path, format)}
            onExportStatusChange={(status) => updateCurrentTab({
              activeTask: status,
              pendingOperation: status ? "export" : null,
            })}
            onUpdateRow={(original, next) => {
              if (!workspaceTab || !selectedTable) return Promise.reject(new Error(t("data_preview.no_rows")));
              return updateRowMutation.mutateAsync({
                tabId: workspaceTab.id,
                tableName: selectedTable,
                original,
                next,
              });
            }}
            onDeleteRow={(row) => {
              if (!workspaceTab || !selectedTable) return Promise.reject(new Error(t("data_preview.no_rows")));
              return deleteRowMutation.mutateAsync({ tabId: workspaceTab.id, tableName: selectedTable, row });
            }}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["tableRowsCount", connection.id, connection.database, selectedTable] });
              refetchRows();
            }}
            onViewModeChange={(nextViewMode) => updateCurrentTab({ viewMode: nextViewMode })}
            onPageChange={(nextPage) => updateCurrentTab({ page: nextPage })}
            onPageSizeChange={(nextPageSize) => {
              updateCurrentTab({ pageSize: nextPageSize, page: 0 });
            }}
          />
        ) : (
          <TableBrowser
            tables={tables}
            tableStats={tableStats}
            benchmark={benchmarkMutation.data}
            benchmarking={benchmarkMutation.isPending}
            benchmarkError={benchmarkMutation.error instanceof Error ? benchmarkMutation.error.message : null}
            onBenchmark={() => benchmarkMutation.mutate()}
            onSelectTable={(table) => onTableSelected?.(table)}
          />
        )}
      </div>

      {consoleOpen && (
        <div className="shrink-0">
          <SqlConsole
            key={workspaceTab?.id ?? "browser-console"}
            sqlQuery={sqlQuery}
            onSqlQueryChange={(nextSql) => updateCurrentTab({ sqlQuery: nextSql })}
            executing={executeMutation.isPending && pendingOperation === "execute"}
            onExecute={() => {
              executeMutation.mutate({
                tabId: workspaceTab?.id ?? null,
                query: appSettings.editor.formatOnRun ? sqlQuery.trim() : sqlQuery,
              });
            }}
            execResult={execResult}
            history={history}
            activeTab={consoleTab}
            editorSettings={appSettings.editor}
            onActiveTabChange={(nextTab) => updateCurrentTab({ consoleTab: nextTab })}
            onClearHistory={() => updateCurrentTab({ history: [] })}
            onClearEditor={() => updateCurrentTab({ sqlQuery: "" })}
          />
        </div>
      )}

      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border/30 bg-background px-3 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{connection.database || connection.name}</span>
          <span className="text-muted-foreground/40">•</span>
          <span>{connection.type}</span>
          {(activeTask || pendingOperation || benchmarkMutation.isPending || createTableMutation.isPending || createDbMutation.isPending || refreshingTables || fetchingRows || countingRows) ? (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <Loader2 size={10} className="animate-spin" />
                {activeTask ||
                   (pendingOperation === "execute" && t("explorer.run_script")) ||
                   (pendingOperation === "query" && t("data_preview.running")) ||
                   (pendingOperation === "insert" && t("data_preview.saving")) ||
                   (pendingOperation === "update" && t("data_preview.saving")) ||
                   (pendingOperation === "delete" && t("data_preview.delete_row")) ||
                  (createTableMutation.isPending && t("modal_create_table.submit")) ||
                  (createDbMutation.isPending && t("modal_create_db.submit")) ||
                  t("data_preview.syncing_rows")}
              </span>
            </>
          ) : execResult && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className={execResult.success ? "text-primary" : "text-destructive"}>
                {execResult.success ? t("common.success") : t("common.error")}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {appVersion && (
            <span className="font-mono text-[10px] text-muted-foreground/70">
              v{appVersion}
            </span>
          )}
          <button
            type="button"
            onClick={() => updateCurrentTab({ consoleOpen: !consoleOpen })}
            className="inline-flex h-5 items-center gap-1.5 rounded px-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {consoleOpen ? <X size={13} /> : <Terminal size={13} />}
            Console
            {history.length > 0 && <span className="rounded bg-muted px-1 text-[10px]">{history.length}</span>}
          </button>
        </div>
      </footer>

      <CreateTableModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        dbType={connection.type}
        onCreate={(query) => createTableMutation.mutateAsync(query)}
      />

      <CreateDatabaseModal
        isOpen={isCreateDbModalOpen}
        onClose={() => setIsCreateDbModalOpen(false)}
        onCreate={(name) => createDbMutation.mutateAsync(name)}
      />

      <InsertDataModal
        isOpen={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
        tableName={selectedTable || ""}
        columns={columns}
        onInsert={async (data) => {
          if (!workspaceTab || !selectedTable) throw new Error(t("data_preview.no_rows"));
          await insertMutation.mutateAsync({ tabId: workspaceTab.id, tableName: selectedTable, data });
          toast({ title: t("toast.row_inserted"), variant: "success" });
        }}
      />
    </div>
  );
}
