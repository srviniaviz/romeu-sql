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
import { Connection } from "../lib/useConnections";
import {
  benchmarkAnalyze,
  countRows,
  createDatabase,
  createTable,
  clearDatabaseMetadataCache,
  deleteRow,
  executeSql,
  exportQuery,
  insertRow,
  listColumns,
  listIndexes,
  listTables,
  listTableStats,
  selectQuery,
  selectRowsPage,
  updateRow,
} from "@/domain/database/service";
import type { DataViewMode } from "./explorer/DataPreview";
import type { RowQueryOptions } from "@/domain/database/types";
import { useSettings } from "@/domain/settings/useSettings";
import { DEFAULT_APP_SETTINGS } from "@/domain/settings/types";

interface Props {
  connection: Connection;
  onDisconnect: () => void;
  openCreateOnMount?: boolean;
  openCreateDbOnMount?: boolean;
  onModalOpened?: () => void;
  selectedTable?: string | null;
  onTableSelected?: (tableName: string | null) => void;
}

export interface HistoryEntry {
  id: string;
  action: string;
  query?: string;
  status: "success" | "error";
  message: string;
  timestamp: Date;
}

export function DatabaseExplorer({
  connection,
  onDisconnect,
  openCreateOnMount,
  openCreateDbOnMount,
  onModalOpened,
  selectedTable,
  onTableSelected,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const appSettings = settings ?? DEFAULT_APP_SETTINGS;
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [sqlQuery, setSqlQuery] = useState("");
  const [execResult, setExecResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");
  const [viewMode, setViewMode] = useState<DataViewMode>("list");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [whereClause, setWhereClause] = useState("");
  const [rowOptions, setRowOptions] = useState<RowQueryOptions>({});
  const [queryRows, setQueryRows] = useState<Record<string, unknown>[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const emptyRowsRecoveryKey = useRef<string | null>(null);

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
    setPage(0);
    setWhereClause("");
    setRowOptions({});
  }, [selectedTable, connection.id, connection.database]);

  useEffect(() => {
    if (settings?.dataView.defaultPageSize) {
      setPageSize(settings.dataView.defaultPageSize);
    }
    if (settings?.dataView.defaultViewMode) {
      setViewMode(settings.dataView.defaultViewMode);
    }
  }, [settings?.dataView.defaultPageSize, settings?.dataView.defaultViewMode]);

  const addHistory = (entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory((prev) => [
      {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
      ...prev,
    ].slice(0, appSettings.editor.historyLimit));
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

  const { data: indexes = [] } = useQuery({
    queryKey: ["indexes", connection.id, connection.database, selectedTable],
    queryFn: () => (selectedTable ? listIndexes(connection, selectedTable) : []),
    enabled: !!selectedTable,
  });

  const executeMutation = useMutation({
    mutationFn: (query: string) => executeSql(connection, query),
    onSuccess: (res) => {
      const msg = t("explorer.sync_success");
      setExecResult({ success: true, message: msg });
      addHistory({ action: t("explorer.sql_editor"), query: res.query, status: "success", message: msg });
      clearDatabaseMetadataCache(connection);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["tableStats"] });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
    },
    onError: (err: unknown, query) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setExecResult({ success: false, message: msg });
      addHistory({ action: t("explorer.sql_editor"), query, status: "error", message: msg });
    },
  });

  const insertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (!selectedTable) throw new Error(t("data_preview.no_rows"));
      return insertRow(connection, selectedTable, data);
    },
    onSuccess: (res) => {
      const msg = t("explorer.sync_success");
      setExecResult({ success: true, message: msg });
      addHistory({ action: t("explorer.add_document"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setExecResult({ success: false, message: msg });
      addHistory({ action: t("explorer.add_document"), status: "error", message: msg });
    },
  });

  const queryMutation = useMutation({
    mutationFn: (query: string) => selectQuery(connection, query),
    onSuccess: (rows, query) => {
      setQueryRows(rows);
      setQueryError(null);
      addHistory({ action: t("data_preview.query"), query, status: "success", message: `${rows.length} rows returned` });
    },
    onError: (err: unknown, query) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setQueryRows([]);
      setQueryError(msg);
      addHistory({ action: t("data_preview.query"), query, status: "error", message: msg });
    },
  });

  const benchmarkMutation = useMutation({
    mutationFn: () => benchmarkAnalyze(connection),
    onMutate: () => setActiveTask(t("table_browser.benchmark")),
    onSettled: () => setActiveTask(null),
  });

  const updateRowMutation = useMutation({
    mutationFn: ({ original, next }: { original: Record<string, unknown>; next: Record<string, unknown> }) => {
      if (!selectedTable) throw new Error(t("data_preview.no_rows"));
      return updateRow(connection, selectedTable, original, next);
    },
    onSuccess: (res) => {
      const msg = t("explorer.sync_success");
      setExecResult({ success: true, message: msg });
      addHistory({ action: t("data_preview.edit_row"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setExecResult({ success: false, message: msg });
      addHistory({ action: t("data_preview.edit_row"), status: "error", message: msg });
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => {
      if (!selectedTable) throw new Error(t("data_preview.no_rows"));
      return deleteRow(connection, selectedTable, row);
    },
    onSuccess: (res) => {
      const msg = t("explorer.sync_success");
      setExecResult({ success: true, message: msg });
      addHistory({ action: t("data_preview.delete_row"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
      queryClient.invalidateQueries({ queryKey: ["tableRowsCount"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setExecResult({ success: false, message: msg });
      addHistory({ action: t("data_preview.delete_row"), status: "error", message: msg });
    },
  });

  const createTableMutation = useMutation({
    mutationFn: (query: string) => createTable(connection, query),
    onSuccess: () => {
      clearDatabaseMetadataCache(connection);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["tableStats"] });
      setIsCreateModalOpen(false);
    },
  });

  const createDbMutation = useMutation({
    mutationFn: (name: string) => createDatabase(connection, name),
    onSuccess: () => {
      clearDatabaseMetadataCache(connection);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["tableStats"] });
      setIsCreateDbModalOpen(false);
    },
  });

  const error = fetchError instanceof Error ? fetchError.message : fetchError ? String(fetchError) : null;

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
        selectedTable={selectedTable}
        tableCount={tables.length}
        rowCount={totalRows}
        refreshing={refreshingTables || fetchingRows || countingRows}
        onDisconnect={onDisconnect}
      />

      <div className={selectedTable ? "min-h-0 flex-1 overflow-hidden p-5" : "min-h-0 flex-1 space-y-4 overflow-auto p-5"}>
        {selectedTable ? (
          <DataPreview
            selectedTable={selectedTable}
            rows={tableData}
            loading={loadingRows}
            viewMode={viewMode}
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            columnCount={columns.length}
            columns={columns}
            indexes={indexes}
            refreshing={fetchingRows || countingRows}
            whereClause={whereClause}
            rowOptions={rowOptions}
            queryRows={queryRows}
            queryLoading={queryMutation.isPending}
            queryError={queryError}
            onBack={() => onTableSelected?.(null)}
            onInsert={() => setIsInsertModalOpen(true)}
            onFilterApply={(nextWhereClause) => {
              setWhereClause(nextWhereClause);
              setPage(0);
            }}
            onFilterReset={() => {
              setWhereClause("");
              setRowOptions({});
              setPage(0);
            }}
            onOptionsApply={(options) => {
              setRowOptions(options);
              setPage(0);
            }}
            onFind={() => {
              queryClient.invalidateQueries({ queryKey: ["tableRowsCount", connection.id, connection.database, selectedTable] });
              queryClient.invalidateQueries({ queryKey: ["tableData", connection.id, connection.database, selectedTable] });
            }}
            onRunQuery={(query) => queryMutation.mutateAsync(query)}
            onExportQuery={(query, path, format) => exportQuery(connection, query, path, format)}
            onExportStatusChange={setActiveTask}
            onUpdateRow={(original, next) => updateRowMutation.mutateAsync({ original, next })}
            onDeleteRow={(row) => deleteRowMutation.mutateAsync(row)}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["tableRowsCount", connection.id, connection.database, selectedTable] });
              refetchRows();
            }}
            onViewModeChange={setViewMode}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(0);
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

      {isConsoleOpen && (
        <div className="shrink-0">
          <SqlConsole
            sqlQuery={sqlQuery}
            onSqlQueryChange={setSqlQuery}
            executing={executeMutation.isPending}
            onExecute={() => executeMutation.mutate(appSettings.editor.formatOnRun ? sqlQuery.trim() : sqlQuery)}
            execResult={execResult}
            history={history}
            activeTab={activeTab}
            editorSettings={appSettings.editor}
            onActiveTabChange={setActiveTab}
            onClearHistory={() => setHistory([])}
            onClearEditor={() => setSqlQuery("")}
          />
        </div>
      )}

      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border/30 bg-background px-3 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{connection.database || connection.name}</span>
          <span className="text-muted-foreground/40">•</span>
          <span>{connection.type}</span>
          {(activeTask || executeMutation.isPending || queryMutation.isPending || benchmarkMutation.isPending || insertMutation.isPending || updateRowMutation.isPending || deleteRowMutation.isPending || createTableMutation.isPending || createDbMutation.isPending || refreshingTables || fetchingRows || countingRows) ? (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <Loader2 size={10} className="animate-spin" />
                {activeTask ||
                  (executeMutation.isPending && t("explorer.run_script")) ||
                  (queryMutation.isPending && t("data_preview.running")) ||
                  (insertMutation.isPending && t("data_preview.saving")) ||
                  (updateRowMutation.isPending && t("data_preview.saving")) ||
                  (deleteRowMutation.isPending && t("data_preview.delete_row")) ||
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
            onClick={() => setIsConsoleOpen((open) => !open)}
            className="inline-flex h-5 items-center gap-1.5 rounded px-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isConsoleOpen ? <X size={13} /> : <Terminal size={13} />}
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
          await insertMutation.mutateAsync(data);
        }}
      />
    </div>
  );
}
