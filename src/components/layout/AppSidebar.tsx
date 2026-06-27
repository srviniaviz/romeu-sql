import {
  Database,
  RefreshCw,
  Search,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarConnection } from "@/components/SidebarConnection";
import { Connection } from "@/lib/useConnections";

interface AppSidebarProps {
  width: number;
  connections: Connection[];
  loading: boolean;
  selectedConn: Connection | null;
  selectedTable: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onCreateConnection: () => void;
  onRefresh: () => void;
  onSelectConnection: (conn: Connection) => void;
  onSelectTable: (tableName: string | null) => void;
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
  loading,
  selectedConn,
  selectedTable,
  search,
  onSearchChange,
  onCreateConnection,
  onRefresh,
  onSelectConnection,
  onSelectTable,
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
      className="hidden shrink-0 bg-muted/25 lg:flex lg:flex-col"
      style={{ width }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">{t("shell.workspace")}</h1>
          <p className="text-[11px] text-muted-foreground">{t("shell.workspace_desc")}</p>
        </div>
        <Database size={18} className="text-primary" />
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-foreground">
            Connections
          </span>
          <span className="rounded bg-background/70 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {connections.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onRefresh}>
            <RefreshCw size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-primary" onClick={onCreateConnection}>
            {t("shell.new")}
          </Button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("shell.search_connections")}
              className="h-9 rounded-md border-border/60 bg-background/80 pl-8 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 pb-8">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" />
              {t("shell.loading_connections")}
            </div>
          ) : connections.length === 0 ? (
            <button
              className="mx-2 flex w-[calc(100%-1rem)] flex-col items-start rounded-md bg-background/60 px-3 py-4 text-left text-muted-foreground hover:text-foreground"
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
                onSelect={onSelectConnection}
                onSelectTable={onSelectTable}
                onEdit={onEdit}
                onDelete={onDelete}
                onDisconnect={onDisconnect}
                onCreateAction={onCreateTable}
                onCreateDatabase={onCreateDatabase}
                onManage={onManageConnection}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
