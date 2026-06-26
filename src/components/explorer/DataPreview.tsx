import { useEffect, useMemo, useState } from "react";
import {
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  Edit3,
  Filter,
  List,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnInfo, IndexInfo, RowQueryOptions } from "@/domain/database/types";
import { saveTextFile } from "@/lib/exportFile";
import { SqlEditor } from "@/components/ui/SqlEditor";

export type DataViewMode = "list" | "json" | "table";
type DataTab = "rows" | "query" | "schema" | "indexes";

interface DataPreviewProps {
  selectedTable: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  viewMode: DataViewMode;
  page: number;
  pageSize: number;
  totalRows: number;
  columnCount?: number;
  columns?: ColumnInfo[];
  indexes?: IndexInfo[];
  refreshing: boolean;
  whereClause: string;
  rowOptions: RowQueryOptions;
  queryRows: Record<string, unknown>[];
  queryLoading: boolean;
  queryError: string | null;
  onBack: () => void;
  onInsert: () => void;
  onRefresh: () => void;
  onViewModeChange: (mode: DataViewMode) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFilterApply: (whereClause: string) => void;
  onFilterReset: () => void;
  onOptionsApply: (options: RowQueryOptions) => void;
  onFind: () => void;
  onRunQuery: (query: string) => Promise<unknown>;
  onExportQuery: (query: string) => Promise<Record<string, unknown>[]>;
  onExportStatusChange: (status: string | null) => void;
  onUpdateRow: (original: Record<string, unknown>, next: Record<string, unknown>) => Promise<unknown>;
  onDeleteRow: (row: Record<string, unknown>) => Promise<unknown>;
}

const CARD_FIELD_LIMIT = 8;

function looksLikeDate(value: string, fieldName?: string) {
  const nameHint = fieldName ? /(date|time|created|updated|deleted|at)$/i.test(fieldName) : false;
  return nameHint && !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stringKind(value: string, fieldName?: string) {
  if (looksLikeDate(value, fieldName)) return "date";
  if (looksLikeUuid(value)) return "id";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
  if (/^https?:\/\//i.test(value)) return "url";
  if (fieldName && /(status|state|type|method)$/i.test(fieldName)) return "enum";
  if (fieldName && /(amount|price|cost|total|subtotal|tax|discount|shipping|unitprice)$/i.test(fieldName)) return "money";
  return "text";
}

function FieldValue({ value, fieldName }: { value: unknown; fieldName?: string }) {
  if (value === null) return <span className="text-slate-400">null</span>;
  if (value === undefined) return <span className="text-slate-400">undefined</span>;
  if (typeof value === "boolean") {
    return <span className={cn("font-semibold", value ? "text-blue-700" : "text-slate-500")}>{String(value)}</span>;
  }
  if (typeof value === "number") {
    const isMoney = fieldName && /(amount|price|cost|total|subtotal|tax|discount|shipping|unitprice)$/i.test(fieldName);
    return <span className={cn("tabular-nums", isMoney ? "text-blue-700" : "text-indigo-700")}>{isMoney ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}</span>;
  }
  if (typeof value === "string") {
    const kind = stringKind(value, fieldName);
    if (kind === "date") return <span className="text-sky-700">{value}</span>;
    if (kind === "id") return <span className="text-slate-600">"{value}"</span>;
    if (kind === "email") return <span className="text-cyan-700">"{value}"</span>;
    if (kind === "url") return <span className="text-cyan-700">"{value}"</span>;
    if (kind === "enum") return <span className="rounded bg-blue-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-blue-700">{value}</span>;
    if (kind === "money") return <span className="text-blue-700">"{value}"</span>;
    return <span className="text-emerald-700">"{value}"</span>;
  }
  if (Array.isArray(value)) return <span className="text-amber-700">Array({value.length})</span>;
  return <span className="text-amber-700">{JSON.stringify(value)}</span>;
}

function serializeValue(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${serializeValue(value).replace(/"/g, '""')}"`;
  return [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(",")),
  ].join("\n");
}

function ToolbarButton({
  children,
  primary,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  title,
  children,
  active,
  disabled,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function ViewToggle({ value, onChange }: { value: DataViewMode; onChange: (mode: DataViewMode) => void }) {
  const items: Array<{ value: DataViewMode; title: string; icon: typeof List }> = [
    { value: "list", title: "Document list", icon: List },
    { value: "json", title: "JSON", icon: Braces },
    { value: "table", title: "Table", icon: Table2 },
  ];

  return (
    <div className="inline-flex h-7 items-center rounded-md bg-slate-50 p-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            title={item.title}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex size-6 items-center justify-center rounded text-slate-600 hover:bg-slate-100",
              value === item.value && "bg-slate-900 text-white hover:bg-slate-900"
            )}
          >
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}

function RowActions({
  row,
  busy,
  onEdit,
  onDelete,
}: {
  row: Record<string, unknown>;
  busy: boolean;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover/row:opacity-100">
      <IconButton title="Edit row" disabled={busy} onClick={() => onEdit(row)}>
        <Edit3 size={12} />
      </IconButton>
      <IconButton title="Copy JSON" onClick={() => navigator.clipboard?.writeText(JSON.stringify(row, null, 2))}>
        <Copy size={12} />
      </IconButton>
      <IconButton title="Delete row" disabled={busy} onClick={() => onDelete(row)}>
        <Trash2 size={12} />
      </IconButton>
    </div>
  );
}

function DocumentRow({
  row,
  busy,
  onEdit,
  onDelete,
}: {
  row: Record<string, unknown>;
  busy: boolean;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(row);
  const hiddenCount = Math.max(0, entries.length - CARD_FIELD_LIMIT);
  const visibleEntries = expanded ? entries : entries.slice(0, CARD_FIELD_LIMIT);

  return (
    <article className="group/row relative overflow-hidden rounded-md bg-slate-50/70 hover:bg-slate-100/70">
      <div className="absolute right-3 top-3 z-10">
        <RowActions row={row} busy={busy} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="overflow-auto px-3 py-2 font-mono text-[12px] leading-[1.45]">
        <div className="flex">
          <button
            type="button"
            disabled={hiddenCount === 0}
            onClick={() => setExpanded((value) => !value)}
            className="mr-3 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-600 disabled:opacity-0"
          >
            <ChevronRight size={12} className={cn("transition-transform", expanded && "rotate-90")} />
          </button>
          <div className="min-w-0 flex-1 pr-28">
            {visibleEntries.map(([key, value], index) => (
              <div key={key} className={cn("flex min-w-0 gap-1 rounded px-1", index === 2 && "bg-slate-100")}>
                <span className="shrink-0 font-semibold text-slate-700">{key}</span>
                <span className="shrink-0 text-slate-500">:</span>
                <span className="min-w-0 truncate">
                  <FieldValue value={value} fieldName={key} />
                </span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-1 px-1 text-[12px] font-medium text-primary hover:underline"
              >
                {expanded ? `Hide ${hiddenCount} fields` : `Show ${hiddenCount} more fields`}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function RowsTable({
  rows,
  page,
  pageSize,
  busy,
  readOnly,
  fill,
  onEdit,
  onDelete,
}: {
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  busy: boolean;
  readOnly?: boolean;
  fill?: boolean;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}) {
  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);
  return (
    <div className={cn("w-full max-w-full rounded-md bg-background", fill ? "h-full" : "h-full overflow-auto")}>
      <table className="min-w-max border-collapse text-left text-[12px]">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            <th className="w-10 min-w-10 px-2 py-2 text-slate-500">#</th>
            {columns.map((column) => (
              <th key={column} className="min-w-[150px] max-w-[260px] px-3 py-2 font-medium text-slate-700">
                {column}
              </th>
            ))}
            {!readOnly && <th className="w-[116px] min-w-[116px] px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="group/row hover:bg-slate-50">
              <td className="px-2 py-1.5 font-mono text-slate-500">{page * pageSize + rowIndex + 1}</td>
              {columns.map((column) => (
                <td key={column} className="max-w-[260px] truncate px-3 py-1.5 font-mono">
                  <FieldValue value={row[column]} fieldName={column} />
                </td>
              ))}
              {!readOnly && (
                <td className="px-2 py-1.5">
                  <RowActions row={row} busy={busy} onEdit={onEdit} onDelete={onDelete} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowEditor({
  row,
  saving,
  onClose,
  onSave,
}: {
  row: Record<string, unknown>;
  saving: boolean;
  onClose: () => void;
  onSave: (next: Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState(() => JSON.stringify(row, null, 2));
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Row must be a JSON object.");
      setError(null);
      await onSave(parsed as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div className="flex h-12 items-center justify-between px-4">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-950">Edit row</h2>
            <p className="text-[12px] text-slate-500">Update the JSON object and save.</p>
          </div>
          <IconButton title="Close" disabled={saving} onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <div className="p-4">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            spellCheck={false}
            className="h-[360px] w-full resize-none rounded-md bg-slate-50 p-3 font-mono text-[12px] leading-5 outline-none focus:ring-2 focus:ring-primary/15"
          />
          {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
        </div>
        <div className="flex h-14 items-center justify-end gap-2 px-4">
          <ToolbarButton disabled={saving} onClick={onClose}>Cancel</ToolbarButton>
          <ToolbarButton primary disabled={saving} onClick={handleSave}>{saving ? "Saving..." : "Save"}</ToolbarButton>
        </div>
      </div>
    </div>
  );
}

function ExportModal({
  tableName,
  defaultQuery,
  completions,
  exporting,
  error,
  message,
  onClose,
  onExport,
}: {
  tableName: string;
  defaultQuery: string;
  completions: string[];
  exporting: boolean;
  error: string | null;
  message: string | null;
  onClose: () => void;
  onExport: (query: string, format: "csv" | "json") => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [format, setFormat] = useState<"csv" | "json">("csv");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div className="flex h-12 items-center justify-between px-4">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-950">Export {tableName}</h2>
            <p className="text-[12px] text-slate-500">Use a SELECT query or leave empty to export the current page.</p>
          </div>
          <IconButton title="Close" disabled={exporting} onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <div className="space-y-3 p-4">
          <SqlEditor
            value={query}
            onChange={setQuery}
            placeholder="SELECT * FROM table_name LIMIT 1000"
            minHeight="min-h-44"
            completions={completions}
          />
          <label className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
            Format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as "csv" | "json")}
              className="h-8 rounded-md bg-slate-50 px-2 text-[12px] outline-none"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          {message && <p className="text-[12px] text-primary">{message}</p>}
        </div>
        <div className="flex h-14 items-center justify-end gap-2 px-4">
          <ToolbarButton disabled={exporting} onClick={onClose}>Cancel</ToolbarButton>
          <ToolbarButton primary disabled={exporting} onClick={() => onExport(query, format)}>
            {exporting ? "Exporting..." : "Export"}
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
}

export function DataPreview({
  selectedTable,
  rows,
  loading,
  viewMode,
  page,
  pageSize,
  totalRows,
  columnCount = 0,
  columns: schemaColumns = [],
  indexes = [],
  refreshing,
  whereClause,
  rowOptions,
  queryRows,
  queryLoading,
  queryError,
  onBack,
  onInsert,
  onRefresh,
  onViewModeChange,
  onPageChange,
  onPageSizeChange,
  onFilterApply,
  onFilterReset,
  onOptionsApply,
  onFind,
  onRunQuery,
  onExportQuery,
  onExportStatusChange,
  onUpdateRow,
  onDeleteRow,
}: DataPreviewProps) {
  const [query, setQuery] = useState(whereClause);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [project, setProject] = useState(rowOptions.project || "");
  const [sort, setSort] = useState(rowOptions.sort || "");
  const [skip, setSkip] = useState(String(rowOptions.skip || ""));
  const [limit, setLimit] = useState(String(rowOptions.limit || ""));
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<DataTab>("rows");
  const [sql, setSql] = useState(() => `SELECT * FROM ${selectedTable} LIMIT 100`);
  const [busy, setBusy] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startRow = totalRows === 0 ? 0 : page * pageSize + 1;
  const endRow = Math.min(totalRows, (page + 1) * pageSize);

  useEffect(() => setQuery(whereClause), [whereClause]);
  useEffect(() => {
    setProject(rowOptions.project || "");
    setSort(rowOptions.sort || "");
    setSkip(String(rowOptions.skip || ""));
    setLimit(String(rowOptions.limit || ""));
  }, [rowOptions]);
  useEffect(() => setSql(`SELECT * FROM ${selectedTable} LIMIT 100`), [selectedTable]);

  function applyRows() {
    onOptionsApply({
      project: project.trim() || undefined,
      sort: sort.trim() || undefined,
      skip: Number(skip) > 0 ? Number(skip) : undefined,
      limit: Number(limit) > 0 ? Number(limit) : undefined,
    });
    onFilterApply(query.trim());
    onFind();
    setMessage(null);
  }

  function resetRows() {
    setQuery("");
    setProject("");
    setSort("");
    setSkip("");
    setLimit("");
    setMessage(null);
    onFilterReset();
    onFind();
  }

  async function handleExport(query: string, format: "csv" | "json") {
    setExporting(true);
    setExportError(null);
    setExportMessage(null);
    onExportStatusChange("Exporting data");
    try {
      const exportRows = query.trim() ? await onExportQuery(query) : rows;
      const filename = `${selectedTable}-export.${format}`;
      const saved = await saveTextFile({
        defaultPath: filename,
        contents: format === "csv" ? toCsv(exportRows) : JSON.stringify(exportRows, null, 2),
        format,
      });
      setExportMessage(saved ? `Exported ${exportRows.length} rows as ${format.toUpperCase()}.` : "Export canceled.");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
      onExportStatusChange(null);
    }
  }

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage("Done.");
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(row: Record<string, unknown>) {
    if (!window.confirm("Delete this row?")) return;
    void runAction(() => onDeleteRow(row));
  }

  const tabs: Array<{ id: DataTab; label: string; count?: number }> = [
    { id: "rows", label: "Rows", count: totalRows },
    { id: "query", label: "Query" },
    { id: "schema", label: "Schema", count: columnCount },
    { id: "indexes", label: "Indexes", count: indexes.length },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-background">
      <div className="z-20 shrink-0 bg-background pb-1">
        <div className="flex h-10 items-center gap-2 px-5">
          <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-900">
            <ChevronLeft size={14} />
          </button>
          <Database size={15} className="text-slate-700" />
          <span className="font-mono text-[13px] font-semibold text-slate-950">{selectedTable}</span>
        </div>

        <div className="flex h-11 items-end gap-7 px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-11 border-b-2 px-0 text-[13px] font-semibold",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-slate-600"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "rows" && (
          <>
            <div className="space-y-2 px-5 py-2">
              <div className="flex min-h-8 items-center gap-3">
                <div className="flex h-8 flex-1 items-center rounded-md bg-slate-50 px-2 text-[12px]">
                  <Search size={14} className="mr-2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && applyRows()}
                    placeholder="Type a SQL WHERE clause preview, e.g. price > 100"
                    className="min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:text-slate-400"
                  />
                  {query || whereClause || project || sort || skip || limit ? (
                    <button type="button" title="Reset" onClick={resetRows} className="ml-2 text-slate-400 hover:text-slate-700">
                      <X size={13} />
                    </button>
                  ) : (
                    <Filter size={13} className="ml-2 text-slate-400" />
                  )}
                </div>
                <ToolbarButton primary disabled={busy} onClick={applyRows}>Find</ToolbarButton>
                <ToolbarButton disabled={busy} onClick={() => setOptionsOpen((open) => !open)}>
                  Options
                  <ChevronDown size={12} className={cn("transition-transform", optionsOpen && "rotate-180")} />
                </ToolbarButton>
              </div>
              {message && <pre className="max-h-32 overflow-auto rounded-md bg-slate-50 p-2 font-mono text-[11px] leading-4 text-slate-700">{message}</pre>}
              {optionsOpen && (
                <div className="grid gap-3 rounded-md bg-slate-50 p-3 text-[12px] md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700">Project</span>
                    <input
                      value={project}
                      onChange={(event) => setProject(event.target.value)}
                      placeholder="id, name, createdAt"
                      className="h-8 w-full rounded bg-background px-2 font-mono outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700">Sort</span>
                    <input
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                      placeholder="createdAt desc"
                      className="h-8 w-full rounded bg-background px-2 font-mono outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700">Skip</span>
                    <input
                      value={skip}
                      onChange={(event) => setSkip(event.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      className="h-8 w-full rounded bg-background px-2 font-mono outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700">Limit</span>
                    <input
                      value={limit}
                      onChange={(event) => setLimit(event.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      className="h-8 w-full rounded bg-background px-2 font-mono outline-none"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex h-11 items-center justify-between px-5">
              <div className="flex items-center gap-2">
                <ToolbarButton primary disabled={busy} onClick={onInsert}>
                  <Plus size={13} />
                  Add row
                  <ChevronDown size={12} />
                </ToolbarButton>
                <ToolbarButton onClick={() => setExportOpen(true)} disabled={!rows.length}>
                  <Download size={13} />
                  Export
                </ToolbarButton>
              </div>

              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-7 rounded-md bg-slate-50 px-2 text-[12px] outline-none">
                  {[10, 25, 50, 100, 250].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <span className="min-w-[104px] text-right text-[12px] text-slate-700">{startRow} - {endRow} of {totalRows}</span>
                <button type="button" onClick={onRefresh} disabled={refreshing} className="text-slate-600 disabled:opacity-40">
                  <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
                </button>
                <button type="button" disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)} className="text-slate-600 disabled:opacity-35">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" disabled={page >= totalPages - 1 || loading} onClick={() => onPageChange(page + 1)} className="text-slate-600 disabled:opacity-35">
                  <ChevronRight size={16} />
                </button>
                <ViewToggle value={viewMode} onChange={onViewModeChange} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className={cn("min-h-0 flex-1 p-3", (activeTab === "rows" && viewMode === "table") || activeTab === "query" ? "overflow-hidden" : "overflow-auto")}>
        {activeTab === "query" ? (
          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <div className="flex min-h-0 flex-col rounded-md bg-slate-50 p-3">
              <SqlEditor
                value={sql}
                onChange={setSql}
                minHeight="min-h-full"
                className="min-h-0 flex-1"
                completions={[selectedTable, ...schemaColumns.map((column) => column.name)]}
              />
              <div className="mt-3 flex justify-end">
                <ToolbarButton primary disabled={queryLoading || !sql.trim()} onClick={() => void onRunQuery(sql)}>
                  {queryLoading ? "Running..." : "Run query"}
                </ToolbarButton>
              </div>
            </div>
            <div className="flex min-h-0 flex-col rounded-md bg-slate-50 p-3">
              <div className="mb-2 shrink-0 text-[12px] font-semibold text-slate-800">Result preview</div>
              {queryError ? (
                <p className="text-[12px] text-destructive">{queryError}</p>
              ) : queryRows.length ? (
                <div className="min-h-0 flex-1 overflow-auto">
                  <RowsTable rows={queryRows} page={0} pageSize={queryRows.length} busy={false} readOnly fill onEdit={setEditingRow} onDelete={handleDelete} />
                </div>
              ) : (
                <p className="py-10 text-center text-[12px] text-muted-foreground">Run a SELECT query to preview rows.</p>
              )}
            </div>
          </div>
        ) : activeTab === "schema" ? (
          <div className="rounded-md bg-slate-50/70 p-2">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Nullable</th>
                  <th className="px-3 py-2 font-medium">Default</th>
                  <th className="px-3 py-2 font-medium">Key</th>
                </tr>
              </thead>
              <tbody>
                {schemaColumns.map((column) => (
                  <tr key={column.name} className="hover:bg-background">
                    <td className="px-3 py-2 font-mono font-semibold text-slate-800">{column.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{column.type}</td>
                    <td className="px-3 py-2 text-slate-600">{column.nullable ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{column.defaultValue == null ? "-" : String(column.defaultValue)}</td>
                    <td className="px-3 py-2 text-slate-600">{column.isPrimaryKey ? "Primary" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === "indexes" ? (
          <div className="rounded-md bg-slate-50/70 p-2">
            {indexes.length ? (
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Index</th>
                    <th className="px-3 py-2 font-medium">Columns</th>
                    <th className="px-3 py-2 font-medium">Unique</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {indexes.map((index) => (
                    <tr key={`${index.name}-${index.columns}`} className="hover:bg-background">
                      <td className="px-3 py-2 font-mono font-semibold">{index.name}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{index.columns || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{index.unique ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-slate-600">{index.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-16 text-center text-[12px] text-muted-foreground">No indexes found.</p>
            )}
          </div>
        ) : loading ? (
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-md text-slate-500">
            <RefreshCw size={24} className="animate-spin" />
            <span className="text-[12px]">Fetching rows</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md bg-slate-50 py-20 text-center text-[13px] text-slate-500">No rows found</div>
        ) : viewMode === "table" ? (
          <RowsTable rows={rows} page={page} pageSize={pageSize} busy={busy} onEdit={setEditingRow} onDelete={handleDelete} />
        ) : viewMode === "json" ? (
          <div className="rounded-md bg-slate-50">
            <pre className="max-h-[calc(100vh-300px)] overflow-auto p-3 font-mono text-[12px] leading-5 text-slate-800">{JSON.stringify(rows, null, 2)}</pre>
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map((row, rowIndex) => (
              <DocumentRow key={rowIndex} row={row} busy={busy} onEdit={setEditingRow} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {editingRow && (
        <RowEditor
          row={editingRow}
          saving={busy}
          onClose={() => setEditingRow(null)}
          onSave={async (next) => {
            const saved = await runAction(() => onUpdateRow(editingRow, next));
            if (saved) setEditingRow(null);
          }}
        />
      )}
      {exportOpen && (
        <ExportModal
          tableName={selectedTable}
          defaultQuery={`SELECT * FROM ${selectedTable} LIMIT 1000`}
          completions={[selectedTable, ...schemaColumns.map((column) => column.name)]}
          exporting={exporting}
          error={exportError}
          message={exportMessage}
          onClose={() => {
            if (!exporting) setExportOpen(false);
          }}
          onExport={(query, format) => void handleExport(query, format)}
        />
      )}
    </section>
  );
}
