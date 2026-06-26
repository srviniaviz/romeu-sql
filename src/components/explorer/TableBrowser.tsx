import { Database, Table } from "lucide-react";
import type { TableInfo } from "@/domain/database/types";

interface TableBrowserProps {
  tables: string[];
  tableStats?: TableInfo[];
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

export function TableBrowser({ tables, tableStats = [], onSelectTable }: TableBrowserProps) {
  const statsByName = new Map(tableStats.map((item) => [item.name, item]));

  if (tables.length === 0) {
    return (
      <div className="rounded-md bg-slate-50 py-20 text-center text-[13px] text-muted-foreground">
        No tables found
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg bg-background">
      <div className="px-5 py-4">
        <h3 className="text-[14px] font-semibold text-foreground">Tables</h3>
        <p className="text-[12px] text-muted-foreground">Objects available in this database.</p>
      </div>
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
