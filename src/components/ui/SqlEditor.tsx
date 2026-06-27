import CodeMirror from "@uiw/react-codemirror";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
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

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  completions?: string[];
  dark?: boolean;
}

export function SqlEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "160px",
  completions = [],
  dark = false,
}: SqlEditorProps) {
  const isDark = dark || (typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const completionSource = (context: CompletionContext) => {
    const word = context.matchBefore(/[\w.]+/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const custom = completions.map((item) => ({
      label: item,
      type: "variable",
      detail: item.includes(".") ? "field" : "object",
    }));

    return {
      from: word.from,
      options: [
        ...SQL_KEYWORDS.map((label) => ({ label, type: "keyword" })),
        ...custom,
      ],
    };
  };

  return (
    <div className={cn("overflow-hidden rounded-md bg-muted/25 text-[12px]", className)}>
      <CodeMirror
        value={value}
        height="100%"
        minHeight={minHeight}
        placeholder={placeholder}
        theme={isDark ? oneDark : undefined}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          autocompletion: false,
          closeBrackets: true,
          bracketMatching: true,
        }}
        extensions={[
          sql(),
          autocompletion({
            override: [completionSource],
            activateOnTyping: true,
            maxRenderedOptions: 14,
          }),
          EditorView.theme({
            "&": {
              fontSize: "12px",
              height: "100%",
            },
            ".cm-editor": {
              height: "100%",
              backgroundColor: "transparent",
            },
            ".cm-scroller": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
            ".cm-tooltip": {
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--popover)",
              color: "var(--popover-foreground)",
              boxShadow: "0 16px 32px rgba(0, 0, 0, 0.18)",
              overflow: "hidden",
            },
            ".cm-tooltip-autocomplete ul li[aria-selected]": {
              backgroundColor: "var(--muted)",
              color: "var(--foreground)",
            },
          }),
        ]}
        onChange={onChange}
      />
    </div>
  );
}
