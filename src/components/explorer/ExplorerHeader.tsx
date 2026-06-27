import { Database, LogOut, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Connection } from "@/lib/useConnections";

interface ExplorerHeaderProps {
  connection: Connection;
  selectedTable?: string | null;
  tableCount: number;
  rowCount: number;
  refreshing: boolean;
  onDisconnect: () => void;
}

export function ExplorerHeader({
  connection,
  selectedTable,
  tableCount,
  rowCount,
  refreshing,
  onDisconnect,
}: ExplorerHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="border-b border-border/40 bg-background">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Database size={18} className="shrink-0 text-primary" />
            <h2 className="truncate text-[18px] font-semibold tracking-tight text-foreground">
              {connection.database || connection.name}
            </h2>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>{connection.host}:{connection.port}</span>
            <span>•</span>
            <span>{connection.type}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-[12px] text-muted-foreground">
            <span>{selectedTable ? t("data_preview.rows") : t("table_browser.title")}</span>
            <strong className="text-foreground">{selectedTable ? rowCount : tableCount}</strong>
            {refreshing && <RefreshCw size={12} className="animate-spin text-primary" />}
          </div>

          <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onDisconnect}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}
