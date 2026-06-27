import { useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  Edit3,
  FileJson,
  FileSpreadsheet,
  List,
  Play,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { ColumnInfo, DeleteCascadeImpact, ExportFormat, IndexInfo, RowQueryOptions } from "@/domain/database/types";
import { pickSaveFile, saveTextFile } from "@/lib/exportFile";
import { SqlEditor } from "@/components/ui/SqlEditor";
import { RowDataEditor } from "@/components/explorer/RowDataEditor";
import { toast } from "@/components/ui/toast";
import { useSettings } from "@/domain/settings/useSettings";
import { DEFAULT_APP_SETTINGS } from "@/domain/settings/types";
import type { AppSettings } from "@/domain/settings/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  deleteCascadeImpacts?: DeleteCascadeImpact[];
  loadingDeleteCascadeImpacts?: boolean;
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
  onValidateWhere: (whereClause: string) => Promise<unknown>;
  onRunQuery: (query: string) => Promise<unknown>;
  onExportQuery: (query: string, path: string, format: ExportFormat) => Promise<{ rows: number }>;
  onExportStatusChange: (status: string | null) => void;
  onUpdateRow: (original: Record<string, unknown>, next: Record<string, unknown>) => Promise<unknown>;
  onDeleteRow: (row: Record<string, unknown>) => Promise<unknown>;
}

const CARD_FIELD_LIMIT = 8;
const FIELD_PRIORITY = [
  "_id",
  "id",
  "uuid",
  "key",
  "code",
  "orderNumber",
  "name",
  "title",
  "email",
  "username",
  "status",
  "state",
  "type",
  "createdAt",
  "updatedAt",
  "deletedAt",
];

function fieldRank(key: string) {
  const exact = FIELD_PRIORITY.findIndex((field) => field.toLowerCase() === key.toLowerCase());
  if (exact >= 0) return exact;
  if (/(^|_)id$/i.test(key) || /id$/i.test(key)) return 20;
  if (/(name|title|label)$/i.test(key)) return 30;
  if (/(status|state|type)$/i.test(key)) return 40;
  if (/(created|updated|deleted|date|time|at)$/i.test(key)) return 50;
  return 100;
}

function sortRowEntries(row: Record<string, unknown>) {
  return Object.entries(row).sort(([left], [right]) => {
    const rankDiff = fieldRank(left) - fieldRank(right);
    if (rankDiff !== 0) return rankDiff;
    return left.localeCompare(right);
  });
}

function sortRowKeys(row: Record<string, unknown>) {
  return Object.keys(row).sort((left, right) => {
    const rankDiff = fieldRank(left) - fieldRank(right);
    if (rankDiff !== 0) return rankDiff;
    return left.localeCompare(right);
  });
}

function sortRowObject(row: Record<string, unknown>) {
  return Object.fromEntries(sortRowKeys(row).map((key) => [key, row[key]]));
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedRowValues(original: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => !valuesEqual(original[key], value))
  );
}

function rowIdentityWhere(row: Record<string, unknown>, columns: ColumnInfo[]) {
  const primaryKeys = columns.filter((column) => column.isPrimaryKey && Object.prototype.hasOwnProperty.call(row, column.name));
  if (primaryKeys.length > 0) {
    return Object.fromEntries(primaryKeys.map((column) => [column.name, row[column.name]]));
  }

  const fallbackKey = ["id", "_id", "uuid"].find((key) => Object.prototype.hasOwnProperty.call(row, key));
  if (fallbackKey) return { [fallbackKey]: row[fallbackKey] };

  return row;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

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

function isSensitiveField(fieldName?: string) {
  return Boolean(fieldName && /(password|passwd|pwd|token|secret|apikey|api_key|privatekey|private_key|credential)/i.test(fieldName));
}

function truncateText(value: string, length: number) {
  return value.length > length ? `${value.slice(0, Math.max(1, length - 3))}...` : value;
}

function compactJson(value: unknown) {
  return JSON.stringify(value);
}

function sanitizeRow(row: Record<string, unknown>, settings: AppSettings) {
  if (!settings.security.maskSensitiveFields) return row;

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      isSensitiveField(key) ? "********" : value,
    ])
  );
}

function sanitizeRows(rows: Record<string, unknown>[], settings: AppSettings) {
  return rows.map((row) => sanitizeRow(row, settings));
}

const valueTone = {
  string: "text-neutral-950 dark:text-stone-200",
  id: "font-medium text-slate-700 dark:text-neutral-400",
  number: "font-semibold tabular-nums text-blue-900 dark:text-sky-300",
  money: "font-semibold tabular-nums text-emerald-950 dark:text-emerald-300",
  booleanTrue: "font-semibold text-indigo-900 dark:text-violet-300",
  booleanFalse: "font-semibold text-neutral-800 dark:text-neutral-400",
  date: "font-semibold text-stone-900 dark:text-cyan-300",
  link: "font-medium text-sky-800 dark:text-blue-300",
  json: "font-medium text-violet-950 dark:text-fuchsia-300",
  nullish: "text-neutral-600 dark:text-neutral-500",
};

function FieldValue({
  value,
  fieldName,
  settings,
  expanded,
}: {
  value: unknown;
  fieldName?: string;
  settings: AppSettings;
  expanded?: boolean;
}) {
  const truncateLength = expanded ? 1000 : settings.dataView.truncateLength;

  if (settings.security.maskSensitiveFields && isSensitiveField(fieldName)) {
    return <span className="text-muted-foreground">"••••••••"</span>;
  }
  if (value === null) return <span className={valueTone.nullish}>null</span>;
  if (value === undefined) return <span className={valueTone.nullish}>undefined</span>;
  if (typeof value === "boolean") {
    return (
      <span className={value ? valueTone.booleanTrue : valueTone.booleanFalse}>
        {String(value)}
      </span>
    );
  }
  if (typeof value === "number") {
    const isMoney = fieldName && /(amount|price|cost|total|subtotal|tax|discount|shipping|unitprice)$/i.test(fieldName);
    return (
      <span className={isMoney ? valueTone.money : valueTone.number}>
        {isMoney ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
      </span>
    );
  }
  if (typeof value === "string") {
    const kind = stringKind(value, fieldName);
    const displayValue = kind === "date" && settings.dataView.dateDisplay === "local"
      ? new Date(value).toLocaleString()
      : truncateText(value, truncateLength);
    if (kind === "date") return <span className={valueTone.date}>{displayValue}</span>;
    if (kind === "id") return <span className={valueTone.id}>"{displayValue}"</span>;
    if (kind === "email") return <span className={valueTone.link}>"{displayValue}"</span>;
    if (kind === "url") return <span className={valueTone.link}>"{displayValue}"</span>;
    if (kind === "enum") return <span className="rounded bg-primary/10 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-primary">{value}</span>;
    if (kind === "money") return <span className={valueTone.money}>"{displayValue}"</span>;
    return <span className={valueTone.string}>"{displayValue}"</span>;
  }
  if (Array.isArray(value)) {
    if (expanded) {
      return (
        <pre className={cn("whitespace-pre-wrap break-words", valueTone.json)}>
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    const preview = value
      .slice(0, 3)
      .map((item) => compactJson(item))
      .join(", ");
    const suffix = value.length > 3 ? ", ..." : "";
    return (
      <span className={valueTone.json}>
        Array({value.length}) [{truncateText(`${preview}${suffix}`, truncateLength)}]
      </span>
    );
  }
  if (expanded && typeof value === "object") {
    return (
      <pre className={cn("whitespace-pre-wrap break-words", valueTone.json)}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className={valueTone.json}>{compactJson(value)}</span>;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toExcelHtml(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const header = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = rows
    .map((row) => (
      `<tr>${columns.map((column) => `<td>${escapeHtml(serializeValue(row[column]))}</td>`).join("")}</tr>`
    ))
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
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
        primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted/25 text-foreground hover:bg-muted/45"
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
        "inline-flex size-7 items-center justify-center rounded-md bg-muted/25 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-foreground text-background hover:bg-foreground hover:text-background"
      )}
    >
      {children}
    </button>
  );
}

function ViewToggle({ value, onChange }: { value: DataViewMode; onChange: (mode: DataViewMode) => void }) {
  const { t } = useTranslation();
  const items: Array<{ value: DataViewMode; title: string; icon: typeof List }> = [
    { value: "list", title: t("data_preview.document_list"), icon: List },
    { value: "json", title: "JSON", icon: Braces },
    { value: "table", title: t("explorer.table_view"), icon: Table2 },
  ];

  return (
    <div className="inline-flex h-7 items-center rounded-md bg-muted/25 p-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            title={item.title}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/45",
              value === item.value && "bg-foreground text-background hover:bg-foreground"
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
  allowDelete,
  onEdit,
  onDelete,
}: {
  row: Record<string, unknown>;
  busy: boolean;
  allowDelete: boolean;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover/row:opacity-100">
      <IconButton title={t("data_preview.edit_row")} disabled={busy} onClick={() => onEdit(row)}>
        <Edit3 size={12} />
      </IconButton>
      <IconButton title={t("data_preview.copy_json")} onClick={() => void copyText(JSON.stringify(sortRowObject(row), null, 2))}>
        <Copy size={12} />
      </IconButton>
      {allowDelete && (
        <IconButton title={t("data_preview.delete_row")} disabled={busy} onClick={() => onDelete(row)}>
          <Trash2 size={12} />
        </IconButton>
      )}
    </div>
  );
}

function DocumentRow({
  row,
  busy,
  settings,
  onEdit,
  onDelete,
}: {
  row: Record<string, unknown>;
  busy: boolean;
  settings: AppSettings;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const entries = sortRowEntries(row);
  const cardLimit = settings.dataView.maxCardFields || CARD_FIELD_LIMIT;
  const hiddenCount = Math.max(0, entries.length - cardLimit);
  const visibleEntries = expanded ? entries : entries.slice(0, cardLimit);

  return (
    <article className="group/row relative overflow-hidden rounded-md bg-muted/25 hover:bg-muted/35">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <IconButton
          title={expanded
            ? t("data_preview.collapse_row")
            : hiddenCount > 0
              ? t("data_preview.show_more_fields", { count: hiddenCount })
              : t("data_preview.expand_row")}
          active={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown size={12} className={cn("transition-transform", expanded ? "rotate-180" : "-rotate-90")} />
        </IconButton>
        <RowActions row={row} busy={busy} allowDelete={settings.security.allowDeleteRows} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="overflow-auto px-3 py-2 font-mono text-[12px] leading-[1.45]">
        <div className="flex">
          <button
            type="button"
            disabled={hiddenCount === 0}
            onClick={() => setExpanded((value) => !value)}
            className="mr-3 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/25 text-muted-foreground disabled:opacity-0"
          >
            <ChevronRight size={12} className={cn("transition-transform", expanded && "rotate-90")} />
          </button>
          <div className="min-w-0 flex-1 pr-36">
            {visibleEntries.map(([key, value], index) => (
              <div key={key} className={cn("flex min-w-0 gap-1 rounded px-1", expanded && "items-start", index === 2 && "bg-muted/45")}>
                <span className="shrink-0 font-semibold text-foreground">{key}</span>
                <span className="shrink-0 text-muted-foreground">:</span>
                <span className={cn("min-w-0", expanded ? "break-all" : "truncate")}>
                  <FieldValue value={value} fieldName={key} settings={settings} expanded={expanded} />
                </span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-1 px-1 text-[12px] font-medium text-primary hover:underline"
              >
                {expanded ? t("data_preview.hide_fields", { count: hiddenCount }) : t("data_preview.show_more_fields", { count: hiddenCount })}
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
  settings,
  readOnly,
  fill,
  onEdit,
  onDelete,
}: {
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  busy: boolean;
  settings: AppSettings;
  readOnly?: boolean;
  fill?: boolean;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}) {
  const columns = useMemo(() => (rows[0] ? sortRowKeys(rows[0]) : []), [rows]);
  return (
    <div className={cn("h-full w-full max-w-full overflow-auto rounded-md bg-background", fill && "min-w-0")}>
      <table className="min-w-max border-separate border-spacing-0 text-left text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 w-10 min-w-10 bg-background px-2 py-2 text-muted-foreground shadow-[1px_1px_0_hsl(var(--border))]">#</th>
            {columns.map((column) => (
              <th key={column} className="sticky top-0 z-20 min-w-[150px] max-w-[260px] bg-background px-3 py-2 font-medium text-foreground shadow-[0_1px_0_hsl(var(--border))]">
                {column}
              </th>
            ))}
            {!readOnly && <th className="sticky right-0 top-0 z-30 w-[116px] min-w-[116px] bg-background px-2 py-2 shadow-[-1px_1px_0_hsl(var(--border))]" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="group/row hover:bg-muted/25">
              <td className="sticky left-0 z-10 bg-background px-2 py-1.5 font-mono text-muted-foreground group-hover/row:bg-muted/25">{page * pageSize + rowIndex + 1}</td>
              {columns.map((column) => (
                <td key={column} className="max-w-[260px] truncate px-3 py-1.5 font-mono">
                  <FieldValue value={row[column]} fieldName={column} settings={settings} />
                </td>
              ))}
              {!readOnly && (
                <td className="sticky right-0 z-10 bg-background px-2 py-1.5 group-hover/row:bg-muted/25">
                  <RowActions row={row} busy={busy} allowDelete={settings.security.allowDeleteRows} onEdit={onEdit} onDelete={onDelete} />
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
  columns,
  saving,
  onClose,
  onSave,
}: {
  row: Record<string, unknown>;
  columns: ColumnInfo[];
  saving: boolean;
  onClose: () => void;
  onSave: (next: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  async function handleSave(next: Record<string, unknown>) {
    try {
      setError(null);
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-background shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/45 px-5">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">{t("data_preview.edit_row")}</h2>
            <p className="text-[12px] text-muted-foreground">{t("data_preview.update_typed_fields")}</p>
          </div>
          <IconButton title={t("common.close")} disabled={saving} onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <RowDataEditor
          key={JSON.stringify(row)}
          mode="edit"
          columns={columns.length ? columns : Object.keys(row).map((name) => ({
            name,
            type: typeof row[name],
            nullable: true,
            defaultValue: null,
            isPrimaryKey: name === "id" || name === "_id",
          }))}
          initialValue={row}
          disabled={saving}
          cancelLabel={t("common.cancel")}
          onCancel={onClose}
          submitLabel={saving ? t("data_preview.saving") : t("common.save")}
          onSubmit={handleSave}
        />
        {error && <p className="border-t border-border/40 px-5 py-3 text-[12px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function DeleteRowDialog({
  row,
  busy,
  error,
  cascadeImpacts,
  loadingCascadeImpacts,
  onCancel,
  onConfirm,
}: {
  row: Record<string, unknown>;
  busy: boolean;
  error: string | null;
  cascadeImpacts: DeleteCascadeImpact[];
  loadingCascadeImpacts: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const identity = ["id", "_id", "uuid", "name", "email"].find((key) => Object.prototype.hasOwnProperty.call(row, key));
  const identityValue = identity ? `${identity}: ${serializeValue(row[identity])}` : serializeValue(Object.values(row)[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-background shadow-xl">
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="flex gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2 size={17} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-foreground">{t("data_preview.confirm_delete")}</h2>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{t("data_preview.confirm_delete_desc")}</p>
            </div>
          </div>
          <IconButton title={t("common.close")} disabled={busy} onClick={onCancel}>
            <X size={14} />
          </IconButton>
        </div>
        <div className="mx-5 rounded-md bg-muted/25 px-3 py-2 font-mono text-[12px] text-muted-foreground">
          {identityValue}
        </div>
        <div className="mx-5 mt-3 rounded-md bg-muted/20 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-foreground">{t("data_preview.cascade_impact")}</p>
            {loadingCascadeImpacts && <RefreshCw size={12} className="animate-spin text-muted-foreground" />}
          </div>
          {loadingCascadeImpacts ? (
            <p className="mt-1 text-[12px] text-muted-foreground">{t("data_preview.cascade_loading")}</p>
          ) : cascadeImpacts.length ? (
            <div className="mt-2 max-h-32 space-y-1 overflow-auto pr-1 custom-scrollbar">
              {cascadeImpacts.map((impact) => (
                <div key={impact.constraintName} className="rounded bg-background/70 px-2 py-1.5 text-[12px]">
                  <div className="font-mono font-semibold text-foreground">{impact.sourceTable}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {impact.sourceColumns} {"->"} {impact.targetTable}.{impact.targetColumns}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-muted-foreground">{t("data_preview.cascade_none")}</p>
          )}
        </div>
        {error && (
          <div className="mx-5 mt-3 max-h-28 overflow-auto rounded-md bg-destructive/10 px-3 py-2 font-mono text-[12px] leading-5 text-destructive custom-scrollbar">
            {error}
          </div>
        )}
        <div className="flex h-14 items-center justify-end gap-2 px-5">
          <ToolbarButton disabled={busy} onClick={onCancel}>{t("common.cancel")}</ToolbarButton>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-[12px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({
  tableName,
  defaultQuery,
  completions,
  editorSettings,
  defaultFormat,
  exporting,
  error,
  message,
  onClose,
  onExport,
}: {
  tableName: string;
  defaultQuery: string;
  completions: string[];
  editorSettings: AppSettings["editor"];
  defaultFormat: ExportFormat;
  exporting: boolean;
  error: string | null;
  message: string | null;
  onClose: () => void;
  onExport: (query: string, format: ExportFormat) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(defaultQuery);
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div className="flex h-12 items-center justify-between px-4">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">{t("data_preview.export_title", { tableName })}</h2>
            <p className="text-[12px] text-muted-foreground">{t("data_preview.export_desc")}</p>
          </div>
          <IconButton title={t("common.close")} disabled={exporting} onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <div className="space-y-3 p-4">
          <SqlEditor
            value={query}
            onChange={setQuery}
            placeholder={t("data_preview.export_query_placeholder")}
            minHeight="176px"
            completions={completions}
            fontSize={editorSettings.fontSize}
            autocomplete={editorSettings.autocomplete}
          />
          <label className="flex items-center gap-2 text-[12px] font-medium text-foreground">
            {t("data_preview.format")}
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ExportFormat)}
              className="h-8 rounded-md bg-muted/25 px-2 text-[12px] outline-none"
            >
              <option value="csv">CSV</option>
              <option value="xls">Excel</option>
              <option value="json">JSON</option>
            </select>
          </label>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          {message && <p className="text-[12px] text-primary">{message}</p>}
        </div>
        <div className="flex h-14 items-center justify-end gap-2 px-4">
          <ToolbarButton disabled={exporting} onClick={onClose}>{t("common.cancel")}</ToolbarButton>
          <ToolbarButton primary disabled={exporting} onClick={() => onExport(query, format)}>
            {exporting ? t("data_preview.exporting") : t("data_preview.export")}
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
  deleteCascadeImpacts = [],
  loadingDeleteCascadeImpacts = false,
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
  onValidateWhere,
  onRunQuery,
  onExportQuery,
  onExportStatusChange,
  onUpdateRow,
  onDeleteRow,
}: DataPreviewProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const appSettings = settings ?? DEFAULT_APP_SETTINGS;
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
  const [schemaMessage, setSchemaMessage] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [validatingFilter, setValidatingFilter] = useState(false);
  const [whereSuggestOpen, setWhereSuggestOpen] = useState(false);
  const [whereSuggestIndex, setWhereSuggestIndex] = useState(0);
  const [whereCursor, setWhereCursor] = useState(0);
  const [sortSuggestOpen, setSortSuggestOpen] = useState(false);
  const [sortSuggestIndex, setSortSuggestIndex] = useState(0);
  const [sortCursor, setSortCursor] = useState(0);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [deleteRow, setDeleteRow] = useState<Record<string, unknown> | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DataTab>("rows");
  const [sql, setSql] = useState(() => `SELECT * FROM ${selectedTable} LIMIT 100`);
  const [lastQuerySql, setLastQuerySql] = useState("");
  const [busy, setBusy] = useState(false);
  const querySplitRef = useRef<HTMLDivElement | null>(null);
  const [querySplit, setQuerySplit] = useState(52);
  const [queryResizing, setQueryResizing] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startRow = totalRows === 0 ? 0 : page * pageSize + 1;
  const endRow = Math.min(totalRows, (page + 1) * pageSize);
  const whereInputRef = useRef<HTMLInputElement | null>(null);
  const sortInputRef = useRef<HTMLInputElement | null>(null);
  const whereToken = useMemo(() => {
    const left = query.slice(0, whereCursor);
    return left.match(/[a-zA-Z_][\w.]*$/)?.[0] ?? "";
  }, [query, whereCursor]);
  const sortToken = useMemo(() => {
    const left = sort.slice(0, sortCursor);
    const currentTerm = left.split(",").pop() ?? "";
    return currentTerm.match(/[a-zA-Z_][\w.]*$/)?.[0] ?? "";
  }, [sort, sortCursor]);
  const whereSuggestions = useMemo(() => {
    if (!whereToken) return [];
    const needle = whereToken.toLowerCase();
    return schemaColumns
      .filter((column) => column.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [schemaColumns, whereToken]);
  const sortSuggestions = useMemo(() => {
    if (!sortToken) return [];
    const needle = sortToken.toLowerCase();
    return schemaColumns
      .filter((column) => column.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [schemaColumns, sortToken]);
  useEffect(() => {
    setWhereSuggestIndex(0);
  }, [whereToken]);
  useEffect(() => {
    setSortSuggestIndex(0);
  }, [sortToken]);

  useEffect(() => setQuery(whereClause), [whereClause]);
  useEffect(() => {
    if (!queryResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = querySplitRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const next = ((event.clientX - rect.left) / rect.width) * 100;
      setQuerySplit(Math.min(72, Math.max(28, next)));
    };

    const stopResize = () => setQueryResizing(false);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [queryResizing]);
  useEffect(() => {
    setProject(rowOptions.project || "");
    setSort(rowOptions.sort || "");
    setSkip(String(rowOptions.skip || ""));
    setLimit(String(rowOptions.limit || ""));
  }, [rowOptions]);
  useEffect(() => {
    setSql(`SELECT * FROM ${selectedTable} LIMIT 100`);
    setLastQuerySql("");
  }, [selectedTable]);

  async function applyRows() {
    const nextWhere = query.trim();
    setValidatingFilter(true);
    setFilterError(null);
    try {
      await onValidateWhere(nextWhere);
      onOptionsApply({
        project: project.trim() || undefined,
        sort: sort.trim() || undefined,
        skip: Number(skip) > 0 ? Number(skip) : undefined,
        limit: Number(limit) > 0 ? Number(limit) : undefined,
      });
      onFilterApply(nextWhere);
      onFind();
      setMessage(null);
    } catch (err) {
      setFilterError(err instanceof Error ? err.message : String(err));
    } finally {
      setValidatingFilter(false);
    }
  }

  function resetRows() {
    setQuery("");
    setProject("");
    setSort("");
    setSkip("");
    setLimit("");
    setMessage(null);
    setFilterError(null);
    onFilterReset();
    onFind();
  }

  async function copySchemaJson() {
    const schema = {
      table: selectedTable,
      columns: schemaColumns.map((column) => ({
        name: column.name,
        type: column.type,
        nullable: column.nullable,
        defaultValue: column.defaultValue,
        primaryKey: column.isPrimaryKey,
        enumValues: column.enumValues ?? [],
      })),
      indexes: indexes.map((index) => ({
        name: index.name,
        columns: index.columns,
        unique: index.unique,
        type: index.type,
      })),
    };
    await copyText(JSON.stringify(schema, null, 2));
    setSchemaMessage(t("data_preview.schema_copied"));
    window.setTimeout(() => setSchemaMessage(null), 1800);
  }

  function insertWhereSuggestion(columnName: string) {
    const input = whereInputRef.current;
    const cursor = input?.selectionStart ?? whereCursor;
    const before = query.slice(0, cursor);
    const after = query.slice(cursor);
    const match = before.match(/[a-zA-Z_][\w.]*$/);
    const start = match ? cursor - match[0].length : cursor;
    const next = `${query.slice(0, start)}${columnName}${after}`;
    const nextCursor = start + columnName.length;
    setQuery(next);
    setWhereCursor(nextCursor);
    setWhereSuggestOpen(false);
    requestAnimationFrame(() => {
      whereInputRef.current?.focus();
      whereInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function insertSortSuggestion(columnName: string) {
    const input = sortInputRef.current;
    const cursor = input?.selectionStart ?? sortCursor;
    const before = sort.slice(0, cursor);
    const after = sort.slice(cursor);
    const currentTerm = before.split(",").pop() ?? "";
    const termStart = cursor - currentTerm.length;
    const match = currentTerm.match(/[a-zA-Z_][\w.]*$/);
    const start = match ? cursor - match[0].length : termStart + currentTerm.length;
    const next = `${sort.slice(0, start)}${columnName}${after}`;
    const nextCursor = start + columnName.length;
    setSort(next);
    setSortCursor(nextCursor);
    setSortSuggestOpen(false);
    requestAnimationFrame(() => {
      sortInputRef.current?.focus();
      sortInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function handleExport(query: string, format: ExportFormat) {
    if (!appSettings.security.allowExports) {
      setExportError(t("settings.security.exports_disabled"));
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportMessage(null);
    onExportStatusChange(t("data_preview.exporting_data"));
    try {
      const filename = `${selectedTable}-export.${format}`;
      if (query.trim()) {
        const path = await pickSaveFile({ defaultPath: filename, format });
        if (!path) {
          setExportMessage(t("data_preview.export_canceled"));
          return;
        }

        const result = await onExportQuery(query, path, format);
        const successMessage = t("data_preview.exported_rows", { count: result.rows, format: format === "xls" ? "EXCEL" : format.toUpperCase() });
        setExportMessage(successMessage);
        toast({ title: t("toast.export_done"), description: successMessage, variant: "success" });
        return;
      }

      const safeRows = sanitizeRows(rows, appSettings);
      const saved = await saveTextFile({
        defaultPath: filename,
        contents: format === "json"
          ? JSON.stringify(safeRows, null, 2)
          : format === "xls"
            ? toExcelHtml(safeRows)
            : toCsv(safeRows),
        format,
      });
      if (saved) {
        const successMessage = t("data_preview.exported_rows", { count: rows.length, format: format === "xls" ? "EXCEL" : format.toUpperCase() });
        setExportMessage(successMessage);
        toast({ title: t("toast.export_done"), description: successMessage, variant: "success" });
      } else {
        setExportMessage(t("data_preview.export_canceled"));
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setExportError(error);
      toast({ title: t("toast.export_failed"), description: error, variant: "error" });
    } finally {
      setExporting(false);
      onExportStatusChange(null);
    }
  }

  async function handleQueryResultExport(format: "csv" | "json" | "xls") {
    if (!queryRows.length) return;
    if (!appSettings.security.allowExports) {
      setExportError(t("settings.security.exports_disabled"));
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportMessage(null);
    onExportStatusChange(t("data_preview.exporting_data"));
    try {
      const path = await pickSaveFile({
        defaultPath: `${selectedTable}-query-result.${format}`,
        format,
      });
      if (!path) {
        setExportMessage(t("data_preview.export_canceled"));
        return;
      }
      const result = await onExportQuery(lastQuerySql || sql, path, format);
      const successMessage = t("data_preview.exported_rows", { count: result.rows, format: format === "xls" ? "EXCEL" : format.toUpperCase() });
      setExportMessage(successMessage);
      toast({ title: t("toast.export_done"), description: successMessage, variant: "success" });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setExportError(error);
      toast({ title: t("toast.export_failed"), description: error, variant: "error" });
    } finally {
      setExporting(false);
      onExportStatusChange(null);
    }
  }

  async function handleRunQuery() {
    const nextQuery = appSettings.editor.formatOnRun ? sql.trim() : sql;
    setLastQuerySql(nextQuery);
    await onRunQuery(nextQuery);
  }

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(t("data_preview.done"));
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setMessage(error);
      return { ok: false, error };
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(row: Record<string, unknown>) {
    if (!appSettings.security.allowDeleteRows) return;
    setDeleteError(null);
    setDeleteRow(row);
  }

  async function confirmDeleteRow() {
    if (!deleteRow) return;
    setDeleteError(null);
    const where = rowIdentityWhere(deleteRow, schemaColumns);
    const result = await runAction(() => onDeleteRow(where));
    if (result.ok) {
      setDeleteRow(null);
      toast({ title: t("toast.row_deleted"), variant: "success" });
      return;
    }
    setDeleteError(result.error ?? t("common.error"));
    toast({ title: t("toast.delete_failed"), description: result.error ?? t("common.error"), variant: "error" });
  }

  const tabs: Array<{ id: DataTab; label: string; count?: number }> = [
    { id: "rows", label: t("data_preview.rows"), count: totalRows },
    { id: "query", label: t("data_preview.query") },
    { id: "schema", label: t("data_preview.schema"), count: columnCount },
    { id: "indexes", label: t("data_preview.indexes"), count: indexes.length },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-background">
      <div className="z-20 shrink-0 bg-background pb-1">
        <div className="flex h-10 items-center gap-2 px-5">
          <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft size={14} />
          </button>
          <Database size={15} className="text-foreground" />
          <span className="font-mono text-[13px] font-semibold text-foreground">{selectedTable}</span>
        </div>

        <div className="flex h-11 items-end gap-7 px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-11 border-b-2 px-0 text-[13px] font-semibold",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 rounded-full bg-muted/45 px-1.5 py-0.5 text-[11px] text-muted-foreground">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "rows" && (
          <>
            <div className="space-y-2 px-5 py-2">
              <div className="flex min-h-8 items-center gap-3">
                <div className="relative flex h-8 flex-1 items-center rounded-md bg-muted/25 px-2 text-[12px]">
                  <Search size={14} className="mr-2 text-muted-foreground" />
                  <span className="mr-2 font-semibold text-foreground">WHERE</span>
                  <input
                    ref={whereInputRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setWhereCursor(event.target.selectionStart ?? event.target.value.length);
                      setWhereSuggestOpen(true);
                      setFilterError(null);
                    }}
                    onClick={(event) => {
                      setWhereCursor(event.currentTarget.selectionStart ?? 0);
                      setWhereSuggestOpen(true);
                    }}
                    onKeyUp={(event) => setWhereCursor(event.currentTarget.selectionStart ?? 0)}
                    onFocus={() => setWhereSuggestOpen(true)}
                    onBlur={() => window.setTimeout(() => setWhereSuggestOpen(false), 120)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" && whereSuggestOpen && whereSuggestions.length > 0) {
                        event.preventDefault();
                        setWhereSuggestIndex((index) => Math.min(whereSuggestions.length - 1, index + 1));
                        return;
                      }
                      if (event.key === "ArrowUp" && whereSuggestOpen && whereSuggestions.length > 0) {
                        event.preventDefault();
                        setWhereSuggestIndex((index) => Math.max(0, index - 1));
                        return;
                      }
                      if (event.key === "Enter" && whereSuggestOpen && whereSuggestions[whereSuggestIndex]) {
                        event.preventDefault();
                        insertWhereSuggestion(whereSuggestions[whereSuggestIndex].name);
                        return;
                      }
                      if (event.key === "Enter") void applyRows();
                      if (event.key === "Escape") setWhereSuggestOpen(false);
                      if (event.key === "Tab" && whereSuggestions[0]) {
                        event.preventDefault();
                        insertWhereSuggestion(whereSuggestions[whereSuggestIndex]?.name ?? whereSuggestions[0].name);
                      }
                    }}
                    placeholder={t("data_preview.where_placeholder")}
                    className="min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:text-muted-foreground/70"
                  />
                  {query || whereClause || project || sort || skip || limit ? (
                    <button type="button" title={t("data_preview.reset")} onClick={resetRows} className="ml-2 text-muted-foreground/70 hover:text-foreground">
                      <X size={13} />
                    </button>
                  ) : null}
                  {whereSuggestOpen && whereSuggestions.length > 0 && (
                    <div className="absolute left-20 top-9 z-50 w-[360px] overflow-hidden rounded-md bg-popover p-1 shadow-xl ring-1 ring-border">
                      {whereSuggestions.map((column, index) => (
                        <button
                          key={column.name}
                          type="button"
                          onMouseEnter={() => setWhereSuggestIndex(index)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            insertWhereSuggestion(column.name);
                          }}
                          className={cn(
                            "flex h-7 w-full items-center justify-between rounded px-2 text-left font-mono text-[12px] hover:bg-muted/45",
                            index === whereSuggestIndex && "bg-muted/45"
                          )}
                        >
                          <span className="font-semibold text-foreground">{column.name}</span>
                          <span className="text-muted-foreground">{column.type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ToolbarButton primary disabled={busy || validatingFilter} onClick={() => void applyRows()}>
                  {refreshing || validatingFilter ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      {validatingFilter ? t("data_preview.validating_where") : t("data_preview.loading")}
                    </>
                  ) : (
                    t("data_preview.find")
                  )}
                </ToolbarButton>
                <ToolbarButton disabled={busy} onClick={() => setOptionsOpen((open) => !open)}>
                  {t("data_preview.options")}
                  <ChevronDown size={12} className={cn("transition-transform", optionsOpen && "rotate-180")} />
                </ToolbarButton>
              </div>
              {filterError && (
                <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-[12px] text-destructive">
                  {filterError}
                </p>
              )}
              <div className="relative flex h-8 items-center rounded-md bg-muted/25 px-2 text-[12px]">
                <span className="mr-2 font-semibold text-foreground">ORDER BY</span>
                <input
                  ref={sortInputRef}
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    setSortCursor(event.target.selectionStart ?? event.target.value.length);
                    setSortSuggestOpen(true);
                  }}
                  onClick={(event) => {
                    setSortCursor(event.currentTarget.selectionStart ?? 0);
                    setSortSuggestOpen(true);
                  }}
                  onKeyUp={(event) => setSortCursor(event.currentTarget.selectionStart ?? 0)}
                  onFocus={() => setSortSuggestOpen(true)}
                  onBlur={() => window.setTimeout(() => setSortSuggestOpen(false), 120)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && sortSuggestOpen && sortSuggestions.length > 0) {
                      event.preventDefault();
                      setSortSuggestIndex((index) => Math.min(sortSuggestions.length - 1, index + 1));
                      return;
                    }
                    if (event.key === "ArrowUp" && sortSuggestOpen && sortSuggestions.length > 0) {
                      event.preventDefault();
                      setSortSuggestIndex((index) => Math.max(0, index - 1));
                      return;
                    }
                    if (event.key === "Enter" && sortSuggestOpen && sortSuggestions[sortSuggestIndex]) {
                      event.preventDefault();
                      insertSortSuggestion(sortSuggestions[sortSuggestIndex].name);
                      return;
                    }
                    if (event.key === "Enter") void applyRows();
                    if (event.key === "Escape") setSortSuggestOpen(false);
                    if (event.key === "Tab" && sortSuggestions[0]) {
                      event.preventDefault();
                      insertSortSuggestion(sortSuggestions[sortSuggestIndex]?.name ?? sortSuggestions[0].name);
                    }
                  }}
                  placeholder={t("data_preview.order_placeholder")}
                  className="min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:text-muted-foreground/70"
                />
                {sortSuggestOpen && sortSuggestions.length > 0 && (
                  <div className="absolute left-24 top-9 z-50 w-[360px] overflow-hidden rounded-md bg-popover p-1 shadow-xl ring-1 ring-border">
                    {sortSuggestions.map((column, index) => (
                      <button
                        key={column.name}
                        type="button"
                        onMouseEnter={() => setSortSuggestIndex(index)}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          insertSortSuggestion(column.name);
                        }}
                        className={cn(
                          "flex h-7 w-full items-center justify-between rounded px-2 text-left font-mono text-[12px] hover:bg-muted/45",
                          index === sortSuggestIndex && "bg-muted/45"
                        )}
                      >
                        <span className="font-semibold text-foreground">{column.name}</span>
                        <span className="text-muted-foreground">{column.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {message && <pre className="max-h-32 overflow-auto rounded-md bg-muted/25 p-2 font-mono text-[11px] leading-4 text-foreground">{message}</pre>}
              {optionsOpen && (
                <div className="grid gap-3 rounded-md bg-muted/25 p-3 text-[12px] md:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">{t("data_preview.project")}</span>
                    <input
                      value={project}
                      onChange={(event) => setProject(event.target.value)}
                      placeholder={t("data_preview.project_placeholder")}
                      className="h-8 w-full rounded bg-background px-2 font-mono outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">{t("data_preview.skip")}</span>
                    <input
                      value={skip}
                      onChange={(event) => setSkip(event.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      className="h-8 w-full rounded bg-background px-2 font-mono outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">{t("data_preview.limit")}</span>
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
                  {t("data_preview.add_row")}
                  <ChevronDown size={12} />
                </ToolbarButton>
                <ToolbarButton onClick={() => setExportOpen(true)} disabled={!rows.length || !appSettings.security.allowExports}>
                  <Download size={13} />
                  {t("data_preview.export")}
                </ToolbarButton>
              </div>

              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-7 rounded-md bg-muted/25 px-2 text-[12px] outline-none">
                  {[10, 25, 50, 100, 250].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <span className="min-w-[104px] text-right text-[12px] text-foreground">
                  {t("data_preview.page_range", { start: startRow, end: endRow, total: totalRows })}
                </span>
                <button type="button" onClick={onRefresh} disabled={refreshing} className="text-muted-foreground disabled:opacity-40">
                  <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
                </button>
                <button type="button" disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)} className="text-muted-foreground disabled:opacity-35">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" disabled={page >= totalPages - 1 || loading} onClick={() => onPageChange(page + 1)} className="text-muted-foreground disabled:opacity-35">
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
          <div
            ref={querySplitRef}
            className={cn("grid h-full min-h-0", queryResizing && "select-none")}
            style={{ gridTemplateColumns: `${querySplit}fr 8px ${100 - querySplit}fr` }}
          >
            <div className="flex min-h-0 min-w-0 flex-col rounded-md bg-muted/25 p-3">
              <SqlEditor
                value={sql}
                onChange={setSql}
                minHeight="100%"
                className="min-h-0 flex-1"
                completions={[selectedTable, ...schemaColumns.map((column) => column.name)]}
                fontSize={appSettings.editor.fontSize}
                autocomplete={appSettings.editor.autocomplete}
              />
              <div className="mt-3 flex justify-end">
                <IconButton title={t("data_preview.run_query")} disabled={queryLoading || !sql.trim()} onClick={() => void handleRunQuery()}>
                  {queryLoading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                </IconButton>
              </div>
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              className="group flex cursor-col-resize items-center justify-center"
              onPointerDown={(event) => {
                event.preventDefault();
                setQueryResizing(true);
              }}
            >
              <div className="h-16 w-px rounded-full bg-border/50 transition-colors group-hover:bg-primary/70" />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col rounded-md bg-muted/25 p-3">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-foreground">{t("data_preview.result_preview")}</div>
                  {(exportError || exportMessage) && (
                    <div className={cn("mt-1 text-[11px]", exportError ? "text-destructive" : "text-muted-foreground")}>
                      {exportError || exportMessage}
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title={t("data_preview.export_result")}
                      disabled={exporting || !queryRows.length || !appSettings.security.allowExports}
                      className="inline-flex size-7 items-center justify-center rounded-md bg-muted/25 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {exporting ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => void handleQueryResultExport("csv")}>
                      <Download size={13} />
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleQueryResultExport("xls")}>
                      <FileSpreadsheet size={13} />
                      Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleQueryResultExport("json")}>
                      <FileJson size={13} />
                      JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {queryError ? (
                <p className="text-[12px] text-destructive">{queryError}</p>
              ) : queryRows.length ? (
                <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                  <RowsTable rows={queryRows} page={0} pageSize={queryRows.length} busy={false} settings={appSettings} readOnly fill onEdit={setEditingRow} onDelete={handleDelete} />
                </div>
              ) : (
                <p className="py-10 text-center text-[12px] text-muted-foreground">{t("data_preview.run_select_preview")}</p>
              )}
            </div>
          </div>
        ) : activeTab === "schema" ? (
          <div className="rounded-md bg-muted/25 p-2">
            <div className="mb-2 flex items-center justify-end gap-2">
              {schemaMessage && <span className="text-[11px] text-muted-foreground">{schemaMessage}</span>}
              <ToolbarButton onClick={() => void copySchemaJson()}>
                <Copy size={13} />
                {t("data_preview.copy_schema")}
              </ToolbarButton>
            </div>
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("data_preview.column")}</th>
                  <th className="px-3 py-2 font-medium">{t("data_preview.type")}</th>
                  <th className="px-3 py-2 font-medium">{t("data_preview.nullable")}</th>
                  <th className="px-3 py-2 font-medium">{t("data_preview.default")}</th>
                  <th className="px-3 py-2 font-medium">{t("data_preview.key")}</th>
                </tr>
              </thead>
              <tbody>
                {schemaColumns.map((column) => (
                  <tr key={column.name} className="hover:bg-background">
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">{column.name}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{column.type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{column.nullable ? t("data_preview.yes") : t("data_preview.no")}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{column.defaultValue == null ? "-" : String(column.defaultValue)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{column.isPrimaryKey ? t("data_preview.primary") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === "indexes" ? (
          <div className="rounded-md bg-muted/25 p-2">
            {indexes.length ? (
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("data_preview.index")}</th>
                    <th className="px-3 py-2 font-medium">{t("data_preview.column")}</th>
                    <th className="px-3 py-2 font-medium">{t("data_preview.unique")}</th>
                    <th className="px-3 py-2 font-medium">{t("data_preview.type")}</th>
                  </tr>
                </thead>
                <tbody>
                  {indexes.map((index) => (
                    <tr key={`${index.name}-${index.columns}`} className="hover:bg-background">
                      <td className="px-3 py-2 font-mono font-semibold">{index.name}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{index.columns || "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{index.unique ? t("data_preview.yes") : t("data_preview.no")}</td>
                      <td className="px-3 py-2 text-muted-foreground">{index.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-16 text-center text-[12px] text-muted-foreground">{t("data_preview.no_indexes")}</p>
            )}
          </div>
        ) : loading ? (
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-md text-muted-foreground">
            <RefreshCw size={24} className="animate-spin" />
            <span className="text-[12px]">{t("data_preview.fetching_rows")}</span>
          </div>
        ) : rows.length === 0 && totalRows > 0 && refreshing ? (
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-md bg-muted/25 text-muted-foreground">
            <RefreshCw size={24} className="animate-spin" />
            <span className="text-[12px]">{t("data_preview.syncing_rows")}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md bg-muted/25 py-20 text-center text-[13px] text-muted-foreground">{t("data_preview.no_rows")}</div>
        ) : viewMode === "table" ? (
          <RowsTable rows={rows} page={page} pageSize={pageSize} busy={busy} settings={appSettings} onEdit={setEditingRow} onDelete={handleDelete} />
        ) : viewMode === "json" ? (
          <div className="space-y-2 overflow-auto">
            {rows.map((row, rowIndex) => (
              <pre key={rowIndex} className="rounded-md bg-muted/25 p-3 font-mono text-[12px] leading-5 text-foreground">
                {JSON.stringify(sortRowObject(sanitizeRow(row, appSettings)), null, 2)}
              </pre>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map((row, rowIndex) => (
              <DocumentRow key={rowIndex} row={row} busy={busy} settings={appSettings} onEdit={setEditingRow} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {editingRow && (
        <RowEditor
          row={editingRow}
          columns={schemaColumns}
          saving={busy}
          onClose={() => setEditingRow(null)}
          onSave={async (next) => {
            const changed = changedRowValues(editingRow, next);
            if (Object.keys(changed).length === 0) {
              setEditingRow(null);
              return;
            }
            const where = rowIdentityWhere(editingRow, schemaColumns);
            const result = await runAction(() => onUpdateRow(where, changed));
            if (result.ok) {
              setEditingRow(null);
              return;
            }
            throw new Error(result.error ?? t("common.error"));
          }}
        />
      )}
      {deleteRow && (
        <DeleteRowDialog
          row={deleteRow}
          busy={busy}
          error={deleteError}
          cascadeImpacts={deleteCascadeImpacts}
          loadingCascadeImpacts={loadingDeleteCascadeImpacts}
          onCancel={() => {
            setDeleteError(null);
            setDeleteRow(null);
          }}
          onConfirm={() => void confirmDeleteRow()}
        />
      )}
      {exportOpen && (
        <ExportModal
          tableName={selectedTable}
          defaultQuery={`SELECT * FROM ${selectedTable}`}
          completions={[selectedTable, ...schemaColumns.map((column) => column.name)]}
          editorSettings={appSettings.editor}
          defaultFormat={appSettings.query.exportFormat}
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
