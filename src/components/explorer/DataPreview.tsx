import { ChevronLeft, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataPreviewProps {
  selectedTable: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  viewMode: "table" | "json";
  onBack: () => void;
  onInsert: () => void;
}

export function DataPreview({
  selectedTable,
  rows,
  loading,
  viewMode,
  onBack,
  onInsert,
}: DataPreviewProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 rounded-md text-[12px] text-muted-foreground" onClick={onBack}>
          <ChevronLeft size={14} className="mr-1" />
          Tables
        </Button>
        <span className="text-[14px] font-semibold text-foreground">{selectedTable}</span>
        <Button size="sm" className="ml-auto h-8 rounded-md bg-primary px-3 text-[12px] text-primary-foreground hover:bg-primary/90" onClick={onInsert}>
          <Plus size={13} className="mr-1.5" />
          Add row
        </Button>
      </div>

      {loading ? (
        <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border text-muted-foreground">
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-[12px]">Fetching rows</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center text-[13px] text-muted-foreground">
          No rows found
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {Object.keys(rows[0]).map((column) => (
                    <th key={column} className="border-r border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0">
                      <span className="block truncate">{column}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-primary/5">
                    {Object.values(row).map((value, valueIndex) => (
                      <td key={valueIndex} className="border-r border-border px-3 py-2 text-[12px] text-foreground last:border-r-0">
                        <span className="block truncate">
                          {value === null ? <span className="text-muted-foreground/45">NULL</span> : String(value)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {rows.map((row, rowIndex) => (
            <pre key={rowIndex} className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-[12px] leading-5 text-slate-100">
              {JSON.stringify(row, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </section>
  );
}
