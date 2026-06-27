import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ColumnInfo } from "@/domain/database/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

interface FieldState {
  raw: string;
  touched: boolean;
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

interface ContextMenuState {
  x: number;
  y: number;
  field: ParsedField;
}

const FIELD_MENU_WIDTH = 240;
const FIELD_MENU_MAX_HEIGHT = 300;

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

function cleanStringLiteral(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return value;
}

function valueToRaw(value: unknown, kind: FieldKind) {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (kind === "json") return JSON.stringify(value, null, 2);
  return String(value);
}

function defaultRawFor(column: ColumnInfo, mode: EditorMode) {
  const kind = getFieldKind(column.type, column);
  if (mode === "insert" && (column.isPrimaryKey || hasDefault(column))) return DEFAULT_TOKEN;
  if (column.nullable) return "null";
  if (kind === "boolean") return "false";
  if (kind === "integer" || kind === "decimal") return "0";
  if (kind === "json") return "{}";
  return "";
}

function parseField(column: ColumnInfo, raw: string, mode: EditorMode): ParsedField {
  const kind = getFieldKind(column.type, column);
  const trimmed = raw.trim();

  if (trimmed === DEFAULT_TOKEN) {
    if (mode === "insert") return { column, kind, raw, include: false };
    return { column, kind, raw, include: false, error: "required_field" };
  }

  if (trimmed.length === 0) {
    if (mode === "insert" && (column.isPrimaryKey || hasDefault(column))) return { column, kind, raw, include: false };
    if (kind === "text" || kind === "binary" || kind === "date") return { column, kind, raw, include: true, value: "" };
    if (column.nullable) return { column, kind, raw, include: true, value: null };
    return { column, kind, raw, include: false, error: "required_field" };
  }

  if (trimmed.toLowerCase() === "null") {
    if (column.nullable || mode === "edit") return { column, kind, raw, include: true, value: null };
    return { column, kind, raw, include: false, error: "not_nullable" };
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
      return { column, kind, raw, include: true, value: JSON.parse(raw) };
    } catch {
      return { column, kind, raw, include: false, error: "invalid_json" };
    }
  }

  if (kind === "date") {
    const value = cleanStringLiteral(raw).trim();
    if (!Number.isNaN(Date.parse(value)) || /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return { column, kind, raw, include: true, value };
    }
    return { column, kind, raw, include: false, error: "date_error" };
  }

  if (kind === "binary") {
    const value = cleanStringLiteral(raw).trim();
    if (!/^\\x[0-9a-f]+$/i.test(value)) return { column, kind, raw, include: false, error: "binary_error" };
    return { column, kind, raw, include: true, value };
  }

  if (kind === "enum") {
    const value = cleanStringLiteral(raw).trim();
    if (column.enumValues?.length && !column.enumValues.includes(value)) {
      return { column, kind, raw, include: false, error: "enum_error" };
    }
    return { column, kind, raw, include: true, value: { __romeuSqlEnum: column.type, value } };
  }

  return { column, kind, raw, include: true, value: cleanStringLiteral(raw) };
}

function literalClass(kind: FieldKind, error?: string) {
  if (error) return "text-destructive";
  if (kind === "json") return "text-fuchsia-700 dark:text-fuchsia-300";
  if (kind === "boolean") return "text-indigo-700 dark:text-violet-300";
  if (kind === "integer" || kind === "decimal") return "text-blue-700 dark:text-sky-300";
  if (kind === "date") return "text-cyan-700 dark:text-cyan-300";
  if (kind === "binary") return "text-amber-700 dark:text-amber-300";
  if (kind === "enum") return "text-violet-700 dark:text-violet-300";
  return "text-emerald-700 dark:text-stone-200";
}

function displayRaw(raw: string, kind: FieldKind) {
  if (raw === DEFAULT_TOKEN) return "<default>";
  if (kind === "text" || kind === "date" || kind === "binary") return raw;
  return raw;
}

function randomId() {
  return crypto.randomUUID();
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

function generatedValueFor(field: ParsedField) {
  if (field.kind === "boolean") return "true";
  if (field.kind === "integer") return randomInt();
  if (field.kind === "decimal") return randomDecimal();
  if (field.kind === "json") return JSON.stringify({ active: true, meta: field.column.name }, null, 2);
  if (field.kind === "date") return new Date().toISOString();
  if (field.kind === "binary") return randomHex();
  if (field.kind === "enum") return field.column.enumValues?.[0] ?? sampleString(field.column);
  return sampleString(field.column);
}

function contextOptions(field: ParsedField, mode: EditorMode, t: (key: string) => string) {
  const options: Array<{ label: string; value: string; disabled?: boolean }> = [
    { label: t("row_editor.context.fill_value"), value: generatedValueFor(field) },
  ];
  if (field.column.nullable || mode === "edit") options.push({ label: t("row_editor.context.null"), value: "null" });
  if (mode === "insert" && (field.column.isPrimaryKey || hasDefault(field.column))) {
    options.push({ label: t("row_editor.context.default"), value: DEFAULT_TOKEN });
  }

  if (field.kind === "enum" && field.column.enumValues?.length) {
    options.push(...field.column.enumValues.map((value) => ({ label: value, value })));
  } else if (field.kind === "boolean") {
    options.push(
      { label: "true", value: "true" },
      { label: "false", value: "false" }
    );
  } else if (field.kind === "integer") {
    options.push(
      { label: t("row_editor.context.zero"), value: "0" },
      { label: t("row_editor.context.random_int"), value: randomInt() }
    );
  } else if (field.kind === "decimal") {
    options.push(
      { label: t("row_editor.context.zero"), value: "0" },
      { label: t("row_editor.context.random_decimal"), value: randomDecimal() }
    );
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
  } else {
    options.push(
      { label: t("row_editor.context.sample_text"), value: sampleString(field.column) },
      { label: t("row_editor.context.uuid"), value: randomId() },
      { label: t("row_editor.context.empty_string"), value: "" }
    );
  }
  return options;
}

function EditableLiteral({
  parsed,
  onChange,
  onContextMenu,
}: {
  parsed: ParsedField;
  onChange?: (name: string, value: string) => void;
  onContextMenu?: (event: React.MouseEvent, field: ParsedField) => void;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const focusedRef = useRef(false);
  const displayValue = displayRaw(parsed.raw, parsed.kind);

  useEffect(() => {
    if (focusedRef.current) return;
    if (ref.current && ref.current.textContent !== displayValue) {
      ref.current.textContent = displayValue;
    }
  }, [displayValue]);

  return (
    <span
      ref={ref}
      contentEditable={!onChange ? false : true}
      suppressContentEditableWarning
      spellCheck={false}
      className={cn(
        "inline-block min-w-8 rounded px-1 py-0.5 outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary/30",
        parsed.kind === "json" && "max-w-full whitespace-pre-wrap align-top",
        literalClass(parsed.kind, parsed.error)
      )}
      onInput={(event) => onChange?.(parsed.column.name, event.currentTarget.textContent ?? "")}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (ref.current && ref.current.textContent !== displayValue) {
          ref.current.textContent = displayValue;
        }
      }}
      onContextMenu={(event) => onContextMenu?.(event, parsed)}
      onKeyDown={(event) => {
        if (parsed.kind !== "json" && event.key === "Enter") event.preventDefault();
      }}
    >
      {displayValue}
    </span>
  );
}

export function RowDataEditor({ mode, columns, initialValue = {}, disabled, cancelLabel, onCancel, onSubmit, submitLabel }: RowDataEditorProps) {
  const { t } = useTranslation();
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const editableColumns = useMemo(() => columns, [columns]);
  const [fields, setFields] = useState<Record<string, FieldState>>(() =>
    Object.fromEntries(
      editableColumns.map((column) => {
        const kind = getFieldKind(column.type, column);
        const raw =
          Object.prototype.hasOwnProperty.call(initialValue, column.name)
            ? valueToRaw(initialValue[column.name], kind)
            : defaultRawFor(column, mode);
        return [column.name, { raw, touched: false }];
      })
    )
  );

  const parsedFields = useMemo(
    () => editableColumns.map((column) => parseField(column, fields[column.name]?.raw ?? "", mode)),
    [editableColumns, fields, mode]
  );
  const errors = parsedFields.filter((field) => field.error);
  const output = useMemo(
    () => Object.fromEntries(parsedFields.filter((field) => field.include).map((field) => [field.column.name, field.value])),
    [parsedFields]
  );

  function updateField(name: string, raw: string) {
    setFields((current) => ({ ...current, [name]: { raw, touched: true } }));
    setContextMenu(null);
  }

function openContextMenu(event: React.MouseEvent, field: ParsedField) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = editorRootRef.current?.getBoundingClientRect();
    const localX = rect ? event.clientX - rect.left : event.clientX;
    const localY = rect ? event.clientY - rect.top : event.clientY;
    const maxX = Math.max(8, (rect?.width ?? window.innerWidth) - FIELD_MENU_WIDTH - 8);
    const maxY = Math.max(8, (rect?.height ?? window.innerHeight) - FIELD_MENU_MAX_HEIGHT - 8);
    const x = Math.min(localX, maxX);
    const y = Math.min(localY, maxY);
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), field });
  }

  async function handleSubmit() {
    setFields((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, touched: true }])));
    if (errors.length > 0) return;
    await onSubmit(output);
  }

  if (editableColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <AlertCircle size={22} />
        <span className="text-[13px] font-medium">{t("modal_insert.no_fields")}</span>
      </div>
    );
  }

  return (
    <div ref={editorRootRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto p-5 custom-scrollbar" onClick={() => setContextMenu(null)}>
        <div className="rounded-md bg-muted/20 px-4 py-3 font-mono text-[12px] leading-6 text-foreground">
          <div>{"{"}</div>
          <div className="pl-5">
            {parsedFields.map((field, index) => {
              const showError = Boolean(field.error && fields[field.column.name]?.touched);
              return (
                <div key={field.column.name} className="group relative">
                  <span className="text-slate-800 dark:text-stone-100">"{field.column.name}"</span>
                  <span className="text-muted-foreground">: </span>
                  {field.raw === DEFAULT_TOKEN ? (
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded px-1 py-0.5 font-mono text-muted-foreground outline-none hover:bg-muted"
                      onContextMenu={(event) => openContextMenu(event, field)}
                      onClick={() => updateField(field.column.name, defaultRawFor({ ...field.column, defaultValue: null, isPrimaryKey: false }, "insert"))}
                    >
                      &lt;default&gt;
                    </button>
                  ) : field.raw.trim().toLowerCase() === "null" ? (
                    <EditableLiteral parsed={field} onChange={disabled ? undefined : updateField} onContextMenu={openContextMenu} />
                  ) : field.kind === "text" || field.kind === "date" || field.kind === "binary" || field.kind === "enum" ? (
                    <>
                      <span className="text-muted-foreground">"</span>
                      <EditableLiteral parsed={field} onChange={disabled ? undefined : updateField} onContextMenu={openContextMenu} />
                      <span className="text-muted-foreground">"</span>
                    </>
                  ) : (
                    <EditableLiteral parsed={field} onChange={disabled ? undefined : updateField} onContextMenu={openContextMenu} />
                  )}
                  {index < parsedFields.length - 1 && <span className="text-muted-foreground">,</span>}
                  <span className="ml-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{field.column.type}</span>
                  </span>
                  {showError && (
                    <div className="ml-4 inline-flex items-center gap-1 text-[11px] text-destructive">
                      <AlertCircle size={11} />
                      {t(`row_editor.${field.error}`)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div>{"}"}</div>
        </div>
      </div>

      {contextMenu && (
        <div
          className="absolute inset-0 z-[80]"
          onClick={() => setContextMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu(null);
          }}
        >
        <div
          className="absolute z-[81] max-h-[300px] min-w-56 overflow-y-auto rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-xl custom-scrollbar"
          style={{ left: contextMenu.x, top: contextMenu.y, width: FIELD_MENU_WIDTH }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
            {contextMenu.field.column.name} · {contextMenu.field.column.type}
          </div>
          {contextOptions(contextMenu.field, mode, t).map((option) => (
            <button
              key={`${option.label}-${option.value}`}
              type="button"
              disabled={option.disabled}
              className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-[12px] hover:bg-muted disabled:opacity-50"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                updateField(contextMenu.field.column.name, option.value);
              }}
            >
              <span>{option.label}</span>
              <span className="max-w-28 truncate font-mono text-[11px] text-muted-foreground">
                {option.value === DEFAULT_TOKEN ? "<default>" : option.value}
              </span>
            </button>
          ))}
        </div>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between border-t border-border/45 px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {errors.length ? <AlertCircle size={13} className="text-destructive" /> : <CheckCircle2 size={13} className="text-primary" />}
          <span className={errors.length ? "text-destructive" : undefined}>
            {errors.length ? t("row_editor.error_count", { count: errors.length }) : t("row_editor.ready_to_save")}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" disabled={disabled} onClick={onCancel} className="h-9 rounded-md px-4 text-[12px] font-medium text-muted-foreground">
              {cancelLabel}
            </Button>
          )}
          <Button type="button" disabled={disabled || errors.length > 0} onClick={handleSubmit} className="h-9 rounded-md px-5 text-[12px] font-medium">
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
