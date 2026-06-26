import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2 } from "lucide-react";
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
  createDatabase,
  createTable,
  executeSql,
  insertRow,
  listColumns,
  listTables,
  selectRows,
} from "@/domain/database/service";

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
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [sqlQuery, setSqlQuery] = useState("");
  const [execResult, setExecResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

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

  const addHistory = (entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory((prev) => [
      {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
      ...prev,
    ]);
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

  const { data: tableData = [], isLoading: loadingRows } = useQuery({
    queryKey: ["tableData", connection.id, connection.database, selectedTable],
    queryFn: () => (selectedTable ? selectRows(connection, selectedTable) : []),
    enabled: !!selectedTable,
  });

  const { data: columns = [] } = useQuery({
    queryKey: ["columns", connection.id, connection.database, selectedTable],
    queryFn: () => (selectedTable ? listColumns(connection, selectedTable) : []),
    enabled: !!selectedTable,
  });

  const executeMutation = useMutation({
    mutationFn: (query: string) => executeSql(connection, query),
    onSuccess: (res) => {
      const msg = t("explorer.sync_success");
      setExecResult({ success: true, message: msg });
      addHistory({ action: t("explorer.sql_editor"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
    },
    onError: (err: unknown, query) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setExecResult({ success: false, message: msg });
      addHistory({ action: t("explorer.sql_editor"), query, status: "error", message: msg });
    },
  });

  const insertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (!selectedTable) throw new Error("No table selected");
      return insertRow(connection, selectedTable, data);
    },
    onSuccess: (res) => {
      const msg = t("explorer.sync_success");
      setExecResult({ success: true, message: msg });
      addHistory({ action: t("explorer.add_document"), query: res.query, status: "success", message: msg });
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setExecResult({ success: false, message: msg });
      addHistory({ action: t("explorer.add_document"), status: "error", message: msg });
    },
  });

  const createTableMutation = useMutation({
    mutationFn: (query: string) => createTable(connection, query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setIsCreateModalOpen(false);
    },
  });

  const createDbMutation = useMutation({
    mutationFn: (name: string) => createDatabase(connection, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
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
      <div className="p-6">
        <div className="max-w-xl rounded-lg border border-destructive/20 bg-destructive/10 p-5 text-destructive">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <AlertCircle size={18} />
            {t("explorer.connection_failed")}
          </div>
          <p className="text-[13px] leading-5">{error}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="destructive" className="h-8 rounded-md text-[12px]" onClick={() => refetchTables()}>
              {t("explorer.try_again")}
            </Button>
            <Button variant="ghost" className="h-8 rounded-md text-[12px]" onClick={onDisconnect}>
              {t("explorer.disconnect")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <ExplorerHeader
        connection={connection}
        selectedTable={selectedTable}
        tableCount={tables.length}
        rowCount={tableData.length}
        refreshing={refreshingTables || loadingRows}
        viewMode={viewMode}
        consoleOpen={isConsoleOpen}
        onViewModeChange={setViewMode}
        onToggleConsole={() => setIsConsoleOpen((open) => !open)}
        onDisconnect={onDisconnect}
      />

      <div className="space-y-4 p-5">
        {isConsoleOpen && (
          <SqlConsole
            sqlQuery={sqlQuery}
            onSqlQueryChange={setSqlQuery}
            executing={executeMutation.isPending}
            onExecute={() => executeMutation.mutate(sqlQuery)}
            execResult={execResult}
            history={history}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onClearHistory={() => setHistory([])}
            onClearEditor={() => setSqlQuery("")}
          />
        )}

        {selectedTable ? (
          <DataPreview
            selectedTable={selectedTable}
            rows={tableData}
            loading={loadingRows}
            viewMode={viewMode}
            onBack={() => onTableSelected?.(null)}
            onInsert={() => setIsInsertModalOpen(true)}
          />
        ) : (
          <TableBrowser tables={tables} onSelectTable={(table) => onTableSelected?.(table)} />
        )}
      </div>

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
