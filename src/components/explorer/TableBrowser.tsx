import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Loader2, Table, Eye, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BenchmarkAnalyzeResult, TableInfo } from "@/domain/database/types";

interface TableBrowserProps {
  tables: TableInfo[];
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
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const statsByName = new Map(tableStats.map((item) => [item.name, item]));
  const filteredTables = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return tables;
    return tables.filter((table) => table.name.toLocaleLowerCase().includes(query));
  }, [search, tables]);

  if (tables.length === 0) {
    return (
      <div className="rounded-md bg-muted/25 py-20 text-center text-[13px] text-muted-foreground">
        {t("table_browser.no_tables")}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">{t("table_browser.title")}</h3>
          <p className="text-[12px] text-muted-foreground">{t("table_browser.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-60 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("shell.search_tables")}
              aria-label={t("shell.search_tables")}
              className="h-8 border-border/50 bg-background pl-8 text-[12px] shadow-none"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md text-[12px]"
            onClick={onBenchmark}
            disabled={benchmarking}
          >
            {benchmarking ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            {t("table_browser.benchmark")}
          </Button>
        </div>
      </div>

      {(benchmark || benchmarking || benchmarkError) && (
        <BenchmarkPanel benchmark={benchmark} benchmarking={benchmarking} error={benchmarkError} />
      )}

      <div className="px-3 pb-3">
        <table className="w-full text-left text-[12px]">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("table_browser.name")}</th>
              <th className="px-3 py-2 font-medium">{t("table_browser.type")}</th>
              <th className="px-3 py-2 font-medium">{t("table_browser.rows")}</th>
              <th className="px-3 py-2 font-medium">{t("table_browser.size")}</th>
              <th className="w-20 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filteredTables.map((table) => {
              const stats = statsByName.get(table.name);
              const tableType = table.type || stats?.type || "table";
              const isView = tableType.includes("view");
              return (
                <tr key={table.name} className="group cursor-pointer rounded-md hover:bg-muted/25" onClick={() => onSelectTable(table.name)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {isView ? <Eye size={14} className="text-muted-foreground" /> : <Table size={14} className="text-muted-foreground" />}
                      <span className="font-semibold text-foreground">{table.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{tableType}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{formatRows(stats?.estimatedRows ?? null)}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{formatBytes(stats?.totalBytes ?? null)}</td>
                  <td className="px-3 py-2 text-right text-primary opacity-0 transition-opacity group-hover:opacity-100">{t("table_browser.open")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredTables.length === 0 && (
          <div className="py-12 text-center text-[13px] text-muted-foreground">
            {t("table_browser.no_matching_tables")}
          </div>
        )}
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
  const { t } = useTranslation();
  const topTables = benchmark?.tables.slice(0, 6) ?? [];

  return (
    <div className="mx-5 rounded-lg bg-muted/20 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          <div>
            <div className="text-[13px] font-semibold text-foreground">{t("table_browser.benchmark")}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("table_browser.benchmark_desc")}
            </div>
          </div>
        </div>
        {benchmarking && (
          <span className="inline-flex items-center gap-1 text-[12px] text-primary">
            <Loader2 size={13} className="animate-spin" />
            {t("table_browser.running")}
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
            <Metric label={t("table_browser.average_score")} value={`${benchmark.averageScore}/100`} />
            <Metric label={t("table_browser.tables_tested")} value={String(benchmark.tableCount)} />
            <Metric label={t("table_browser.slowest_table")} value={benchmark.slowestTable || "-"} />
            <Metric label={t("table_browser.total_time")} value={formatMs(benchmark.totalMs)} />
          </div>

          <div className="mt-4 grid gap-2">
            {topTables.map((table) => (
              <div key={table.tableName} className="rounded-md bg-background/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-foreground">{table.tableName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("table_browser.table_summary", {
                        rows: formatRows(table.estimatedRows),
                        size: formatBytes(table.totalBytes),
                        indexes: table.indexCount,
                        time: formatMs(table.totalMs),
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-foreground">{table.score}</div>
                    <div className="text-[11px] text-muted-foreground">{t("table_browser.grade")} {table.grade}</div>
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
