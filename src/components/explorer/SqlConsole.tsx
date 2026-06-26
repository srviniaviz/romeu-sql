import { AlertCircle, CheckCircle2, Clock, Code, History, Loader2, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HistoryEntry } from "@/components/DatabaseExplorer";

interface SqlConsoleProps {
  sqlQuery: string;
  onSqlQueryChange: (value: string) => void;
  executing: boolean;
  onExecute: () => void;
  execResult: { success: boolean; message: string } | null;
  history: HistoryEntry[];
  activeTab: "editor" | "history";
  onActiveTabChange: (tab: "editor" | "history") => void;
  onClearHistory: () => void;
  onClearEditor: () => void;
}

export function SqlConsole({
  sqlQuery,
  onSqlQueryChange,
  executing,
  onExecute,
  execResult,
  history,
  activeTab,
  onActiveTabChange,
  onClearHistory,
  onClearEditor,
}: SqlConsoleProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="flex h-11 items-center justify-between border-b border-border bg-muted/35 px-3">
        <div className="flex rounded-md bg-muted p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 rounded px-3 text-[12px] ${activeTab === "editor" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            onClick={() => onActiveTabChange("editor")}
          >
            <Code size={13} className="mr-1.5" />
            Editor
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 rounded px-3 text-[12px] ${activeTab === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            onClick={() => onActiveTabChange("history")}
          >
            <History size={13} className="mr-1.5" />
            History
            {history.length > 0 && <span className="ml-1.5 text-muted-foreground">({history.length})</span>}
          </Button>
        </div>

        {activeTab === "editor" ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-7 rounded text-[12px] text-muted-foreground" onClick={onClearEditor}>
              Clear
            </Button>
            <Button size="sm" className="h-7 rounded bg-primary px-3 text-[12px] text-primary-foreground hover:bg-primary/90" onClick={onExecute} disabled={executing}>
              {executing ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Play size={12} className="mr-1.5" />}
              Run
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 rounded text-[12px] text-muted-foreground hover:text-destructive" onClick={onClearHistory}>
            <Trash2 size={13} className="mr-1.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="p-4">
        {activeTab === "editor" ? (
          <div className="space-y-3">
            <Textarea
              value={sqlQuery}
              onChange={(event) => onSqlQueryChange(event.target.value)}
              placeholder="SELECT * FROM table_name LIMIT 100;"
              className="min-h-28 rounded-md border-border bg-slate-950 font-mono text-[13px] leading-6 text-slate-100 shadow-inner focus-visible:ring-1 focus-visible:ring-primary"
            />
            {execResult && (
              <div className={`flex items-start gap-2 rounded-md border p-3 text-[13px] ${execResult.success ? "border-primary/20 bg-primary/10 text-primary" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
                {execResult.success ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                <span className="whitespace-pre-wrap break-words">{execResult.message}</span>
              </div>
            )}
          </div>
        ) : history.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground/45">
            <Clock size={26} />
            <span className="text-[12px]">No activity</span>
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {history.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-foreground">{entry.action}</span>
                  <span className="text-[11px] text-muted-foreground">{entry.timestamp.toLocaleTimeString()}</span>
                </div>
                {entry.query && <code className="mt-2 block truncate rounded bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-200">{entry.query}</code>}
                <p className={`mt-2 text-[12px] ${entry.status === "success" ? "text-muted-foreground" : "text-destructive"}`}>{entry.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
