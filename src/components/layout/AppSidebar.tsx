import {
  Database,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarConnection } from "@/components/SidebarConnection";
import type { Connection } from "@/lib/useConnections";

interface AppSidebarProps {
  width: number;
  connections: Connection[];
  totalConnections: number;
  loading: boolean;
  selectedConn: Connection | null;
  selectedTable: string | null;
  search: string;
  collapseToken: number;
  onSearchChange: (value: string) => void;
  onCreateConnection: () => void;
  onRefresh: () => void;
  onSelectConnection: (conn: Connection) => void;
  onSelectTable: (tableName: string | null, conn?: Connection) => void;
  onOpenTableInNewTab: (conn: Connection, tableName: string) => void;
  onEdit: (conn: Connection, event: MouseEvent) => void;
  onDelete: (id: string, event: MouseEvent) => void;
  onDisconnect: (event: MouseEvent) => void;
  onCreateTable: (conn: Connection) => void;
  onCreateDatabase: (conn: Connection) => void;
  onManageConnection: (conn: Connection, event: MouseEvent) => void;
}

export function AppSidebar({
  width,
  connections,
  totalConnections,
  loading,
  selectedConn,
  selectedTable,
  search,
  collapseToken,
  onSearchChange,
  onCreateConnection,
  onRefresh,
  onSelectConnection,
  onSelectTable,
  onOpenTableInNewTab,
  onEdit,
  onDelete,
  onDisconnect,
  onCreateTable,
  onCreateDatabase,
  onManageConnection,
}: AppSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside
      className="hidden shrink-0 bg-sidebar lg:flex lg:flex-col"
      style={{ width }}
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Database size={15} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold leading-tight tracking-tight">{t("shell.workspace")}</h1>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{t("shell.workspace_desc")}</p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-7 shrink-0 gap-1 rounded-md px-2.5 text-[12px] font-medium"
          onClick={onCreateConnection}
        >
          <Plus size={14} />
          {t("shell.new")}
        </Button>
      </div>

      <div className="px-3 pb-2 pt-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("shell.search_connections")}
            className="h-8 rounded-md border-border bg-card pl-8 text-[12.5px]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-1 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t("shell.connections")}
          </span>
          <span className="rounded-full bg-foreground/[0.06] px-1.5 text-[10.5px] font-semibold tabular-nums leading-4 text-muted-foreground">
            {totalConnections}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          onClick={onRefresh}
          title={t("shell.refresh_connections")}
          aria-label={t("shell.refresh_connections")}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : undefined} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 pb-6">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" />
              {t("shell.loading_connections")}
            </div>
          ) : connections.length === 0 ? (
            <button
              type="button"
              className="mx-1 mt-1 flex w-[calc(100%-0.5rem)] flex-col items-start rounded-lg border border-dashed border-border px-3 py-4 text-left text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground"
              onClick={onCreateConnection}
            >
              <span className="text-[13px] font-semibold">{t("shell.no_connections")}</span>
              <span className="mt-1 text-[12px]">{t("shell.create_first_connection")}</span>
            </button>
          ) : (
            connections.map((conn) => (
              <SidebarConnection
                key={conn.id}
                conn={conn}
                isActive={selectedConn?.id === conn.id}
                activeDatabase={selectedConn?.id === conn.id ? selectedConn.database : undefined}
                activeTable={selectedTable || undefined}
                collapseToken={collapseToken}
                onSelect={onSelectConnection}
                onSelectTable={onSelectTable}
                onOpenTableInNewTab={onOpenTableInNewTab}
                onEdit={onEdit}
                onDelete={onDelete}
                onDisconnect={onDisconnect}
                onCreateAction={onCreateTable}
                onCreateDatabase={onCreateDatabase}
                onManage={onManageConnection}
                search={search}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
