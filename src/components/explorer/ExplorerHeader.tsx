import { Database, LogOut, Network, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Connection } from "@/lib/useConnections";

interface ExplorerHeaderProps {
  connection: Connection;
  selectedTable?: string | null;
  tableCount: number;
  rowCount: number;
  databaseSizeBytes: number | null;
  refreshing: boolean;
  diagramOpen: boolean;
  onToggleDiagram: () => void;
  onDisconnect: () => void;
}

function formatDatabaseSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function ExplorerHeader({
  connection,
  selectedTable,
  tableCount,
  rowCount,
  databaseSizeBytes,
  refreshing,
  diagramOpen,
  onToggleDiagram,
  onDisconnect,
}: ExplorerHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Database size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
              {connection.database || connection.name}
            </h2>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate font-mono">{connection.host}:{connection.port}</span>
              <span className="rounded bg-muted px-1.5 py-px text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                {connection.type}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 items-center divide-x divide-border rounded-md border border-border bg-card text-[12px] shadow-xs">
            <div className="flex items-center gap-1.5 px-2.5 text-muted-foreground">
              <span>{selectedTable ? t("data_preview.rows") : t("table_browser.title")}</span>
              <strong className="font-semibold tabular-nums text-foreground">{selectedTable ? rowCount : tableCount}</strong>
              {refreshing && <RefreshCw size={12} className="animate-spin text-primary" />}
            </div>
            {databaseSizeBytes !== null && (
              <div className="flex items-center gap-1.5 px-2.5 text-muted-foreground">
                <span>{t("table_browser.size")}</span>
                <strong className="font-semibold tabular-nums text-foreground">{formatDatabaseSize(databaseSizeBytes)}</strong>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className={diagramOpen ? "h-8 border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary" : "h-8"}
            onClick={onToggleDiagram}
            aria-pressed={diagramOpen}
          >
            <Network size={14} />
            {t("explorer.diagram")}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onDisconnect}
            title={t("explorer.disconnect")}
            aria-label={t("explorer.disconnect")}
          >
            <LogOut size={15} />
          </Button>
        </div>
      </div>
    </header>
  );
}
