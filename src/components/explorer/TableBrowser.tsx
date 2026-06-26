import { Calendar, Hash, Table, Type } from "lucide-react";

interface TableBrowserProps {
  tables: string[];
  onSelectTable: (table: string) => void;
}

export function TableBrowser({ tables, onSelectTable }: TableBrowserProps) {
  if (tables.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center text-[13px] text-muted-foreground">
        No tables found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tables.map((table) => (
        <button
          key={table}
          className="group rounded-lg border border-border bg-background p-4 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md"
          onClick={() => onSelectTable(table)}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
              <Table size={18} />
            </div>
            <span className="truncate text-[14px] font-semibold text-foreground">{table}</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-muted-foreground/45">
            <Hash size={12} />
            <Type size={12} />
            <Calendar size={12} />
            <span className="ml-auto text-[11px] font-medium text-muted-foreground group-hover:text-primary">
              Open
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
