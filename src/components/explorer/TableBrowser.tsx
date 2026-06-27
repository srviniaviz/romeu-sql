import { Activity, AlertTriangle, BarChart3, Database, Loader2, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BenchmarkAnalyzeResult, TableInfo } from "@/domain/database/types";

interface TableBrowserProps {
  tables: string[];
  tableStats?: TableInfo[];
  benchmark?: BenchmarkAnalyzeResult;
  benchmarking?: boolean;
  benchmarkError?: string | null;
  onBenchmark?: () => void;
  onSelectTable: (table: string) => void;
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatRows(rows: number | null) {
  if (rows === null) return "-";
  return new Intl.NumberFormat().format(rows);
}

function formatMs(value: number) {
  if (value < 1000) return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function scoreColor(score: number) {
  if (score >= 85) return "bg-primary";
  if (score >= 65) return "bg-blue-400";
  if (score >= 45) return "bg-amber-500";
  return "bg-destructive";
}

export function TableBrowser({
  tables,
  tableStats = [],
  benchmark,
  benchmarking = false,
  benchmarkError,
  onBenchmark,
  onSelectTable,
}: TableBrowserProps) {
  const statsByName = new Map(tableStats.map((item) => [item.name, item]));

  if (tables.length === 0) {
    return (
      <div className="rounded-md bg-slate-50 py-20 text-center text-[13px] text-muted-foreground">
        No tables found
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Tables</h3>
          <p className="text-[12px] text-muted-foreground">Objects available in this database.</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-md text-[12px]"
          onClick={onBenchmark}
          disabled={benchmarking}
        >
          {benchmarking ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
          Benchmark analyse
        </Button>
      </div>

      {(benchmark || benchmarking || benchmarkError) && (
        <BenchmarkPanel benchmark={benchmark} benchmarking={benchmarking} error={benchmarkError} />
      )}

      <div className="px-3 pb-3">
        <table className="w-full text-left text-[12px]">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Rows</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="w-20 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => {
              const stats = statsByName.get(table);
              return (
                <tr key={table} className="group cursor-pointer rounded-md hover:bg-slate-50" onClick={() => onSelectTable(table)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {(stats?.type || "table").includes("view") ? <Database size={14} className="text-slate-500" /> : <Table size={14} className="text-slate-500" />}
                      <span className="font-semibold text-slate-900">{table}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{stats?.type || "table"}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{formatRows(stats?.estimatedRows ?? null)}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{formatBytes(stats?.totalBytes ?? null)}</td>
                  <td className="px-3 py-2 text-right text-primary opacity-0 transition-opacity group-hover:opacity-100">Open</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BenchmarkPanel({
  benchmark,
  benchmarking,
  error,
}: {
  benchmark?: BenchmarkAnalyzeResult;
  benchmarking: boolean;
  error?: string | null;
}) {
  const topTables = benchmark?.tables.slice(0, 6) ?? [];

  return (
    <div className="mx-5 rounded-lg bg-muted/20 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          <div>
            <div className="text-[13px] font-semibold text-foreground">Benchmark analyse</div>
            <div className="text-[11px] text-muted-foreground">
              Count, sample read, index scan, size and score per table.
            </div>
          </div>
        </div>
        {benchmarking && (
          <span className="inline-flex items-center gap-1 text-[12px] text-primary">
            <Loader2 size={13} className="animate-spin" />
            Running
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {benchmark && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Average score" value={`${benchmark.averageScore}/100`} />
            <Metric label="Tables tested" value={String(benchmark.tableCount)} />
            <Metric label="Slowest table" value={benchmark.slowestTable || "-"} />
            <Metric label="Total time" value={formatMs(benchmark.totalMs)} />
          </div>

          <div className="mt-4 grid gap-2">
            {topTables.map((table) => (
              <div key={table.tableName} className="rounded-md bg-background/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-foreground">{table.tableName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatRows(table.estimatedRows)} rows · {formatBytes(table.totalBytes)} · {table.indexCount} indexes · {formatMs(table.totalMs)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-foreground">{table.score}</div>
                    <div className="text-[11px] text-muted-foreground">grade {table.grade}</div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${scoreColor(table.score)}`} style={{ width: `${table.score}%` }} />
                </div>
                {table.notes.length > 0 && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {table.notes.slice(0, 2).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/70 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-[15px] font-semibold text-foreground">{value}</div>
    </div>
  );
}
