import { Database, LayoutGrid, LogOut, RefreshCw, Rows3, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Connection } from "@/lib/useConnections";

interface ExplorerHeaderProps {
  connection: Connection;
  selectedTable?: string | null;
  tableCount: number;
  rowCount: number;
  refreshing: boolean;
  viewMode: "table" | "json";
  consoleOpen: boolean;
  onViewModeChange: (mode: "table" | "json") => void;
  onToggleConsole: () => void;
  onDisconnect: () => void;
}

export function ExplorerHeader({
  connection,
  selectedTable,
  tableCount,
  rowCount,
  refreshing,
  viewMode,
  consoleOpen,
  onViewModeChange,
  onToggleConsole,
  onDisconnect,
}: ExplorerHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
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
            <span>{selectedTable ? "Rows" : "Tables"}</span>
            <strong className="text-foreground">{selectedTable ? rowCount : tableCount}</strong>
            {refreshing && <RefreshCw size={12} className="animate-spin text-primary" />}
          </div>

          {selectedTable && (
            <div className="flex rounded-md border border-border bg-muted/40 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 rounded px-2 text-[12px] ${viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => onViewModeChange("table")}
              >
                <Rows3 size={13} className="mr-1.5" />
                Table
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 rounded px-2 text-[12px] ${viewMode === "json" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => onViewModeChange("json")}
              >
                <LayoutGrid size={13} className="mr-1.5" />
                JSON
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            className={`h-8 rounded-md px-3 text-[12px] ${consoleOpen ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            onClick={onToggleConsole}
          >
            <Terminal size={14} className="mr-1.5" />
            Console
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onDisconnect}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}
