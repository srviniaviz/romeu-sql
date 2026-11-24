import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Ban,
  KeyRound,
  Lock,
  MoreHorizontal,
  RotateCcw,
  Search,
  Unlock,
  WandSparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ColumnInfo } from "@/domain/database/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EditorMode = "insert" | "edit";
type FieldKind = "text" | "integer" | "decimal" | "boolean" | "json" | "date" | "binary" | "enum";

interface RowDataEditorProps {
  mode: EditorMode;
  columns: ColumnInfo[];
  initialValue?: Record<string, unknown>;
  disabled?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
  onSubmit: (value: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

interface ParsedField {
  column: ColumnInfo;
  kind: FieldKind;
  raw: string;
  include: boolean;
  value?: unknown;
  error?: string;
}

const DEFAULT_TOKEN = "__ROMEUSQL_DEFAULT__";
const NULL_TOKEN = "__ROMEUSQL_NULL__";

function normalizeType(type: string) {
  return type.toLowerCase().replace(/\s+/g, " ").trim();
}

function getFieldKind(type: string, column?: ColumnInfo): FieldKind {
  if (column?.enumValues?.length) return "enum";
  const normalized = normalizeType(type);
  if (/(json|jsonb)/.test(normalized)) return "json";
  if (/(bool|boolean)/.test(normalized)) return "boolean";
  if (/(bigint|smallint|integer|int\d?|serial|bigserial)/.test(normalized)) return "integer";
  if (/(numeric|decimal|double|real|float|money)/.test(normalized)) return "decimal";
  if (/(date|time|timestamp)/.test(normalized)) return "date";
  if (/(bytea|blob|binary|varbinary)/.test(normalized)) return "binary";
  return "text";
}

function hasDefault(column: ColumnInfo) {
  return column.defaultValue !== null && column.defaultValue !== undefined && String(column.defaultValue).trim() !== "";
}

function valueToRaw(value: unknown, kind: FieldKind) {
  if (value === undefined) return "";
  if (value === null) return NULL_TOKEN;
  if (kind === "json") return JSON.stringify(value, null, 2);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function emptyRawFor(kind: FieldKind) {
  if (kind === "boolean") return "false";
  if (kind === "integer" || kind === "decimal") return "0";
  if (kind === "json") return "{}";
  return "";
}

function defaultRawFor(column: ColumnInfo, mode: EditorMode) {
  const kind = getFieldKind(column.type, column);
  if (mode === "insert" && (column.isPrimaryKey || hasDefault(column))) return DEFAULT_TOKEN;
  if (column.nullable) return NULL_TOKEN;
  if (kind === "enum") return column.enumValues?.[0] ?? "";
  return emptyRawFor(kind);
}

function parseField(column: ColumnInfo, raw: string, mode: EditorMode): ParsedField {
  const kind = getFieldKind(column.type, column);
  const trimmed = raw.trim();

  if (raw === DEFAULT_TOKEN) {
    if (mode === "insert") return { column, kind, raw, include: false };
    return { column, kind, raw, include: false, error: "required_field" };
  }

  if (raw === NULL_TOKEN) {
    if (column.nullable) return { column, kind, raw, include: true, value: null };
    return { column, kind, raw, include: false, error: "not_nullable" };
  }

  if (trimmed.length === 0) {
    if (mode === "insert" && (column.isPrimaryKey || hasDefault(column))) return { column, kind, raw, include: false };
    if (kind === "text" || kind === "binary") return { column, kind, raw, include: true, value: "" };
    return { column, kind, raw, include: false, error: column.nullable ? "empty_value" : "required_field" };
  }

  if (kind === "boolean") {
    if (/^(true|1|yes)$/i.test(trimmed)) return { column, kind, raw, include: true, value: true };
    if (/^(false|0|no)$/i.test(trimmed)) return { column, kind, raw, include: true, value: false };
    return { column, kind, raw, include: false, error: "boolean_error" };
  }

  if (kind === "integer") {
    if (!/^-?\d+$/.test(trimmed)) return { column, kind, raw, include: false, error: "integer_error" };
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) return { column, kind, raw, include: false, error: "unsafe_integer" };
    return { column, kind, raw, include: true, value };
  }

  if (kind === "decimal") {
    const value = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(value)) return { column, kind, raw, include: false, error: "number_error" };
    return { column, kind, raw, include: true, value };
  }

  if (kind === "json") {
    try {
      return { column, kind, raw, include: true, value: { __romeuSqlType: column.type, value: JSON.parse(raw) } };
    } catch {
      return { column, kind, raw, include: false, error: "invalid_json" };
    }
  }

  if (kind === "date") {
    if (!Number.isNaN(Date.parse(trimmed)) || /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
      return { column, kind, raw, include: true, value: { __romeuSqlType: column.type, value: trimmed } };
    }
    return { column, kind, raw, include: false, error: "date_error" };
  }

  if (kind === "binary") {
    if (!/^\\x[0-9a-f]+$/i.test(trimmed)) return { column, kind, raw, include: false, error: "binary_error" };
    return { column, kind, raw, include: true, value: { __romeuSqlType: column.type, value: trimmed } };
  }

  if (kind === "enum") {
    if (column.enumValues?.length && !column.enumValues.includes(trimmed)) {
      return { column, kind, raw, include: false, error: "enum_error" };
    }
    return { column, kind, raw, include: true, value: { __romeuSqlEnum: column.type, value: trimmed } };
  }

  return { column, kind, raw, include: true, value: raw };
}

function randomInt() {
  return String(Math.floor(Math.random() * 1000));
}

function randomDecimal() {
  return (Math.round(Math.random() * 100000) / 100).toFixed(2);
}

function randomHex() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `\\x${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function sampleString(column: ColumnInfo) {
  const name = column.name.toLowerCase();
  if (name.includes("email")) return "user@example.com";
  if (name.includes("phone")) return "+55 11 99999-0000";
  if (name.includes("status")) return "ACTIVE";
  if (name.includes("name")) return "Sample value";
  return `${column.name}_value`;
}

function quickValues(field: ParsedField, t: (key: string) => string) {
  const options: Array<{ label: string; value: string }> = [];
  if (field.kind === "integer") {
    options.push({ label: t("row_editor.context.zero"), value: "0" }, { label: t("row_editor.context.random_int"), value: randomInt() });
  } else if (field.kind === "decimal") {
    options.push({ label: t("row_editor.context.zero"), value: "0" }, { label: t("row_editor.context.random_decimal"), value: randomDecimal() });
  } else if (field.kind === "json") {
    options.push(
      { label: t("row_editor.context.empty_object"), value: "{}" },
      { label: t("row_editor.context.empty_array"), value: "[]" },
      { label: t("row_editor.context.sample_json"), value: JSON.stringify({ active: true, meta: field.column.name }, null, 2) }
    );
  } else if (field.kind === "date") {
    options.push(
      { label: t("row_editor.context.now_iso"), value: new Date().toISOString() },
      { label: t("row_editor.context.today"), value: new Date().toISOString().slice(0, 10) }
    );
  } else if (field.kind === "binary") {
    options.push({ label: t("row_editor.context.random_hex"), value: randomHex() });
  } else if (field.kind === "text") {
    options.push(
      { label: t("row_editor.context.uuid"), value: crypto.randomUUID() },
      { label: t("row_editor.context.sample_text"), value: sampleString(field.column) },
      { label: t("row_editor.context.empty_string"), value: "" }
    );
  }
  return options;
}

function previewRaw(raw: string) {
  if (raw === NULL_TOKEN) return "NULL";
  if (raw === DEFAULT_TOKEN) return "DEFAULT";
  if (raw === "") return '""';
  return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
}

const controlClass =
  "w-full min-w-0 rounded-md border border-input bg-card px-2.5 font-mono text-[12px] text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";

function FieldControl({
  field,
  disabled,
  invalid,
  autoFocus,
  onChange,
  onActivate,
}: {
  field: ParsedField;
  disabled: boolean;
  invalid: boolean;
  autoFocus: boolean;
  onChange: (raw: string) => void;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  const { kind, raw, column } = field;
  const focusOnMount = useCallback(
    (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
      if (!element || !autoFocus) return;
      element.focus();
      if (!(element instanceof HTMLSelectElement)) element.select();
    },
    [autoFocus]
  );
  const invalidClass = invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20";

  if (raw === NULL_TOKEN || raw === DEFAULT_TOKEN) {
    const isNull = raw === NULL_TOKEN;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onActivate();
          onChange(kind === "enum" ? column.enumValues?.[0] ?? "" : emptyRawFor(kind));
        }}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-md border border-dashed px-2.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          invalid ? "border-destructive/60" : "border-border hover:border-primary/40 hover:bg-primary/[0.03]"
        )}
      >
        <span className="font-mono font-medium italic text-muted-foreground">
          {isNull ? "NULL" : `DEFAULT${hasDefault(column) ? ` (${String(column.defaultValue)})` : ""}`}
        </span>
        <span className="text-[11px] text-muted-foreground">{t("row_editor.set_value")}</span>
      </button>
    );
  }

  if (kind === "boolean") {
    const current = /^(true|1|yes)$/i.test(raw.trim()) ? "true" : /^(false|0|no)$/i.test(raw.trim()) ? "false" : null;
    return (
      <div className={cn("inline-flex h-8 rounded-md bg-muted p-[3px]", invalid && "ring-1 ring-destructive")}>
        {["true", "false"].map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "min-w-16 rounded-[5px] px-3 font-mono text-[12px] font-medium transition-colors disabled:cursor-not-allowed",
              current === option ? "bg-card text-foreground shadow-sm dark:bg-white/10" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (kind === "enum" && column.enumValues?.length) {
    return (
      <select
        value={raw}
        disabled={disabled}
        ref={focusOnMount}
        onChange={(event) => onChange(event.target.value)}
        className={cn(controlClass, "h-8 pr-7", invalidClass)}
      >
        {!column.enumValues.includes(raw) && <option value={raw}>{raw || t("row_editor.select_value")}</option>}
        {column.enumValues.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    );
  }

  const multiline = kind === "json" || raw.includes("\n") || raw.length > 90;
  if (multiline) {
    const lines = raw.split("\n").length;
    return (
      <textarea
        value={raw}
        disabled={disabled}
        ref={focusOnMount}
        spellCheck={false}
        rows={Math.max(kind === "json" ? 3 : 2, Math.min(12, lines + (raw.length > 90 && lines === 1 ? 1 : 0)))}
        onChange={(event) => onChange(event.target.value)}
        className={cn(controlClass, "resize-y py-1.5 leading-5", invalidClass)}
      />
    );
  }

  const placeholder =
    kind === "date"
      ? "YYYY-MM-DD HH:MM:SS"
      : kind === "binary"
        ? "\\xDEADBEEF"
        : kind === "integer" || kind === "decimal"
          ? "0"
          : "";

  return (
    <input
      value={raw}
      disabled={disabled}
      ref={focusOnMount}
      spellCheck={false}
      inputMode={kind === "integer" ? "numeric" : kind === "decimal" ? "decimal" : undefined}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(controlClass, "h-8", invalidClass)}
    />
  );
}

export function RowDataEditor({ mode, columns, initialValue = {}, disabled = false, cancelLabel, onCancel, onSubmit, submitLabel }: RowDataEditorProps) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";
  const initialRaw = useRef<Record<string, string>>(
    Object.fromEntries(
      columns.map((column) => {
        const kind = getFieldKind(column.type, column);
        const raw = Object.prototype.hasOwnProperty.call(initialValue, column.name)
          ? valueToRaw(initialValue[column.name], kind)
          : defaultRawFor(column, mode);
        return [column.name, raw];
      })
    )
  ).current;
  const [fields, setFields] = useState<Record<string, string>>(() => ({ ...initialRaw }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [unlockedKeys, setUnlockedKeys] = useState<Record<string, boolean>>({});
  const [focusName, setFocusName] = useState<string | null>(null);

  const parsedFields = useMemo(
    () => columns.map((column) => parseField(column, fields[column.name] ?? "", mode)),
    [columns, fields, mode]
  );
  const isDirty = (name: string) => fields[name] !== initialRaw[name];
  const dirtyCount = parsedFields.filter((field) => isDirty(field.column.name)).length;
  const errors = parsedFields.filter((field) => field.error && (!isEdit || isDirty(field.column.name)));
  const canSubmit = !disabled && errors.length === 0 && (!isEdit || dirtyCount > 0);

  const visibleFields = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parsedFields.filter((field) => {
      if (onlyChanged && fields[field.column.name] === initialRaw[field.column.name]) return false;
      if (!term) return true;
      return field.column.name.toLowerCase().includes(term) || field.column.type.toLowerCase().includes(term);
    });
  }, [parsedFields, search, onlyChanged, fields, initialRaw]);

  function updateField(name: string, raw: string) {
    setFields((current) => ({ ...current, [name]: raw }));
    setTouched((current) => ({ ...current, [name]: true }));
  }

  async function handleSubmit() {
    setSubmitted(true);
    if (!canSubmit) return;
    const output = Object.fromEntries(
      parsedFields
        .filter((field) => field.include && (!isEdit || isDirty(field.column.name)))
        .map((field) => [field.column.name, field.value])
    );
    await onSubmit(output);
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <AlertCircle size={22} />
        <span className="text-[13px] font-medium">{t("modal_insert.no_fields")}</span>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void handleSubmit();
        }
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-2.5">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("row_editor.search_fields")}
            aria-label={t("row_editor.search_fields")}
            className="h-8 pl-8 text-[12px]"
          />
        </div>
        {isEdit && (
          <button
            type="button"
            onClick={() => setOnlyChanged((value) => !value)}
            aria-pressed={onlyChanged}
            disabled={dirtyCount === 0 && !onlyChanged}
            className={cn(
              "h-8 rounded-md border px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              onlyChanged ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground shadow-xs hover:text-foreground"
            )}
          >
            {t("row_editor.only_changed")}
          </button>
        )}
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {t("row_editor.field_count", { count: columns.length })}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        {visibleFields.length === 0 ? (
          <div className="py-14 text-center text-[12px] text-muted-foreground">{t("row_editor.no_matching_fields")}</div>
        ) : (
          <div className="divide-y divide-border/70">
            {visibleFields.map((field) => {
              const { column } = field;
              const name = column.name;
              const dirty = isDirty(name);
              const keyLocked = isEdit && column.isPrimaryKey && !unlockedKeys[name];
              const showError = Boolean(field.error && (touched[name] || submitted) && (!isEdit || dirty));
              const quick = quickValues(field, t);
              const canNull = column.nullable && field.raw !== NULL_TOKEN;
              const canDefault = !isEdit && (column.isPrimaryKey || hasDefault(column)) && field.raw !== DEFAULT_TOKEN;

              return (
                <div
                  key={name}
                  className={cn(
                    "relative grid grid-cols-[minmax(150px,220px)_minmax(0,1fr)_88px] items-start gap-x-4 px-5 py-2.5 transition-colors",
                    dirty && "bg-primary/[0.035]",
                    showError && "bg-destructive/[0.04]"
                  )}
                >
                  {(dirty || showError) && (
                    <span className={cn("absolute inset-y-0 left-0 w-0.5", showError ? "bg-destructive" : "bg-primary")} />
                  )}

                  <div className="min-w-0 pt-1">
                    <div className="flex items-center gap-1.5">
                      {column.isPrimaryKey && <KeyRound size={12} className="shrink-0 text-amber-500" aria-label={t("row_editor.primary_key")} />}
                      <span className="truncate font-mono text-[12px] font-medium text-foreground" title={name}>
                        {name}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="rounded bg-muted px-1.5 py-px font-mono text-[10.5px] text-muted-foreground" title={column.type}>
                        {column.type.length > 22 ? `${column.type.slice(0, 22)}…` : column.type}
                      </span>
                      {!column.nullable && (
                        <span className="rounded px-1 py-px text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                          {t("row_editor.not_null")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <FieldControl
                      field={field}
                      disabled={disabled || keyLocked}
                      invalid={showError}
                      autoFocus={focusName === name}
                      onChange={(raw) => updateField(name, raw)}
                      onActivate={() => setFocusName(name)}
                    />
                    {keyLocked && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Lock size={11} />
                        {t("row_editor.pk_locked")}
                      </p>
                    )}
                    {isEdit && column.isPrimaryKey && !keyLocked && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertCircle size={11} />
                        {t("row_editor.pk_warning")}
                      </p>
                    )}
                    {isEdit && dirty && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground" title={initialRaw[name]}>
                        {t("row_editor.was")}{" "}
                        <span className="font-mono line-through decoration-muted-foreground/50">{previewRaw(initialRaw[name])}</span>
                      </p>
                    )}
                    {showError && field.error && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle size={11} />
                        {t(`row_editor.${field.error}`)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-0.5 pt-0.5">
                    {isEdit && column.isPrimaryKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        className="text-muted-foreground"
                        title={keyLocked ? t("row_editor.unlock_pk") : t("row_editor.lock_pk")}
                        aria-label={keyLocked ? t("row_editor.unlock_pk") : t("row_editor.lock_pk")}
                        onClick={() => {
                          setUnlockedKeys((current) => ({ ...current, [name]: keyLocked }));
                          if (!keyLocked) updateField(name, initialRaw[name]);
                        }}
                      >
                        {keyLocked ? <Unlock size={13} /> : <Lock size={13} />}
                      </Button>
                    )}
                    {isEdit && dirty && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        className="text-muted-foreground"
                        title={t("row_editor.revert")}
                        aria-label={t("row_editor.revert")}
                        onClick={() => updateField(name, initialRaw[name])}
                      >
                        <RotateCcw size={13} />
                      </Button>
                    )}
                    {!keyLocked && (canNull || canDefault || quick.length > 0 || field.kind === "json") && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={disabled}
                            className="text-muted-foreground"
                            title={t("row_editor.more_actions")}
                            aria-label={t("row_editor.more_actions")}
                          >
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="truncate font-mono text-[11px] font-normal text-muted-foreground">
                            {name}
                          </DropdownMenuLabel>
                          {canNull && (
                            <DropdownMenuItem onSelect={() => updateField(name, NULL_TOKEN)}>
                              <Ban className="size-3.5" />
                              {t("row_editor.set_null")}
                            </DropdownMenuItem>
                          )}
                          {canDefault && (
                            <DropdownMenuItem onSelect={() => updateField(name, DEFAULT_TOKEN)}>
                              <WandSparkles className="size-3.5" />
                              {t("row_editor.context.default")}
                            </DropdownMenuItem>
                          )}
                          {field.kind === "json" && !field.error && field.raw !== NULL_TOKEN && (
                            <DropdownMenuItem onSelect={() => updateField(name, JSON.stringify(JSON.parse(field.raw), null, 2))}>
                              <WandSparkles className="size-3.5" />
                              {t("row_editor.format_json")}
                            </DropdownMenuItem>
                          )}
                          {quick.length > 0 && (canNull || canDefault || field.kind === "json") && <DropdownMenuSeparator />}
                          {quick.map((option) => (
                            <DropdownMenuItem key={option.label} onSelect={() => updateField(name, option.value)}>
                              <span className="flex-1">{option.label}</span>
                              <span className="max-w-24 truncate font-mono text-[10.5px] text-muted-foreground">
                                {option.value === "" ? '""' : option.value}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-chrome/50 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2 text-[12px]">
          {errors.length > 0 ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle size={13} />
              {t("row_editor.error_count", { count: errors.length })}
            </span>
          ) : isEdit ? (
            <span className={cn("flex items-center gap-1.5", dirtyCount ? "text-foreground" : "text-muted-foreground")}>
              {dirtyCount > 0 && <span className="size-1.5 rounded-full bg-primary" />}
              {dirtyCount > 0 ? t("row_editor.changes_count", { count: dirtyCount }) : t("row_editor.no_changes")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 size={13} className="text-primary" />
              {t("row_editor.ready_to_save")}
            </span>
          )}
          <span className="hidden text-[11px] text-muted-foreground/80 md:inline">· {t("row_editor.save_shortcut")}</span>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" disabled={disabled} onClick={onCancel} className="h-8 px-3 text-[12px] text-muted-foreground">
              {cancelLabel}
            </Button>
          )}
          <Button type="button" disabled={disabled || (isEdit && dirtyCount === 0)} onClick={() => void handleSubmit()} className="h-8 px-4 text-[12px]">
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
