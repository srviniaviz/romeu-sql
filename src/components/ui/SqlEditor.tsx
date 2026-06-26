import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "ORDER BY",
  "GROUP BY",
  "LIMIT",
  "OFFSET",
  "JOIN",
  "LEFT JOIN",
  "INNER JOIN",
  "INSERT INTO",
  "UPDATE",
  "DELETE FROM",
  "CREATE TABLE",
  "ALTER TABLE",
  "DROP TABLE",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "AND",
  "OR",
  "IS NULL",
  "IS NOT NULL",
  "ASC",
  "DESC",
];

function currentToken(value: string, cursor: number) {
  const before = value.slice(0, cursor);
  const match = before.match(/[a-zA-Z0-9_.*]+$/);
  return match?.[0] || "";
}

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  completions?: string[];
}

export function SqlEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "min-h-32",
  completions = [],
}: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const token = currentToken(value, cursor);

  const suggestions = useMemo(() => {
    if (!token || token.length < 1) return [];
    const all = Array.from(new Set([...SQL_KEYWORDS, ...completions]));
    return all
      .filter((item) => item.toLowerCase().startsWith(token.toLowerCase()) && item.toLowerCase() !== token.toLowerCase())
      .slice(0, 8);
  }, [completions, token]);

  function insertSuggestion(suggestion: string) {
    const start = cursor - token.length;
    const next = `${value.slice(0, start)}${suggestion}${value.slice(cursor)}`;
    const nextCursor = start + suggestion.length;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
  }

  return (
    <div className={cn("relative rounded-md bg-slate-50", className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart);
          setOpen(true);
        }}
        onClick={(event) => setCursor(event.currentTarget.selectionStart)}
        onKeyUp={(event) => {
          setCursor(event.currentTarget.selectionStart);
          if (event.key.length === 1 || event.key === "Backspace") setOpen(true);
          if (event.key === "Escape") setOpen(false);
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === "Tab" && open && suggestions[0]) {
            event.preventDefault();
            insertSuggestion(suggestions[0]);
          }
        }}
        spellCheck={false}
        placeholder={placeholder}
        className={cn(
          "w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-5 outline-none placeholder:text-slate-400",
          minHeight
        )}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-3 top-10 z-20 w-56 overflow-hidden rounded-md bg-background shadow-xl ring-1 ring-border/60">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                insertSuggestion(suggestion);
              }}
              className="block w-full px-3 py-1.5 text-left font-mono text-[12px] text-slate-700 hover:bg-slate-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
