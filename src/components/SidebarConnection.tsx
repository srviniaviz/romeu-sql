import { useState, useEffect, useMemo } from "react";
import { Connection } from "../lib/useConnections";
import { listDatabases, listTables } from "@/domain/database/service";
import { 
  ChevronRight, 
  Pencil, 
  Trash2, 
  LogOut,
  RefreshCw,
  Database as DatabaseIcon,
  Plus as PlusIcon,
  Table as TableIcon,
  Shield,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import type { DbEngine } from "@/domain/connections/types";
import { useTranslation } from "react-i18next";

interface DatabaseItemProps {
  conn: Connection;
  dbName: string;
  isCurrentDb: boolean;
  onSelect: (conn: Connection) => void;
  onCreateAction?: (conn: Connection) => void;
  onSelectTable?: (tableName: string) => void;
  activeTable?: string;
  refreshToken: number;
  collapseToken: number;
}

function DatabaseItem({ conn, dbName, isCurrentDb, onSelect, onCreateAction, onSelectTable, activeTable, refreshToken, collapseToken }: DatabaseItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const filteredTables = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    if (!term) return tables;
    return tables.filter((table) => table.toLowerCase().includes(term));
  }, [tableSearch, tables]);

  const fetchTables = async (force = false) => {
    if (tables.length > 0 && !force) return;
    try {
      setLoading(true);
      setTables(await listTables({ ...conn, database: dbName }, { force }));
    } catch (err) {
      console.error(`Failed to fetch tables for ${dbName}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchTables();
    }
  }, [isExpanded]);

  useEffect(() => {
    if (isCurrentDb) {
      setIsExpanded(true);
    }
  }, [isCurrentDb]);

  useEffect(() => {
    if (refreshToken > 0 && isExpanded) {
      fetchTables(true);
    }
  }, [refreshToken]);

  useEffect(() => {
    if (collapseToken > 0) {
      setIsExpanded(false);
      setTableSearch("");
    }
  }, [collapseToken]);

  return (
    <div className="flex flex-col gap-0.5">
      <div 
        className={`group/db-item flex items-center justify-between rounded-md px-2 py-1 cursor-pointer group/item transition-all hover:bg-background/70 ${isCurrentDb ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded((expanded) => {
            const next = !expanded;
            if (next) onSelect({ ...conn, database: dbName });
            return next;
          });
        }}
      >
        <div className="flex items-center gap-2 truncate">
          <div className="size-4 flex items-center justify-center">
            <ChevronRight 
                size={12} 
                className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
            />
          </div>
          <DatabaseIcon 
            size={13} 
            className={`${isCurrentDb ? 'text-primary' : 'text-muted-foreground'}`} 
          />
          <span className={`truncate text-[12px] font-medium ${isCurrentDb ? 'text-primary' : 'text-muted-foreground group-hover/item:text-foreground'}`}>
            {dbName}
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="size-5 rounded opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover/db-item:opacity-100"
          onClick={(e) => {
              e.stopPropagation();
              onSelect({ ...conn, database: dbName });
              onCreateAction?.({ ...conn, database: dbName });
          }}
          title={t("shell.new_table")}
        >
          <PlusIcon size={10} />
        </Button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="ml-4 mt-0.5 flex flex-col gap-0.5 overflow-hidden pl-2"
          >
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-muted-foreground">
                <RefreshCw size={10} className="animate-spin" />
                <span>{t("shell.loading")}</span>
              </div>
            ) : tables.length > 0 ? (
              <>
                <div className="relative mb-1 px-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    placeholder={t("shell.search_tables")}
                    className="h-7 w-full rounded-md bg-background/60 pl-7 pr-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/55 focus:bg-background"
                  />
                </div>
                {filteredTables.length > 0 ? (
                  filteredTables.map(table => (
                    <div 
                      key={table}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 cursor-pointer group/table transition-all hover:bg-background/70 ${activeTable === table && isCurrentDb ? 'bg-primary/10 text-primary' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCurrentDb) onSelect({ ...conn, database: dbName });
                        onSelectTable?.(table);
                      }}
                    >
                      <TableIcon size={12} className={`${activeTable === table && isCurrentDb ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`truncate text-[12px] ${activeTable === table && isCurrentDb ? 'font-medium text-primary' : 'text-muted-foreground group-hover/table:text-foreground'}`}>
                        {table}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="px-3 py-1 text-[11px] text-muted-foreground">{t("shell.no_tables")}</span>
                )}
              </>
            ) : (
              <span className="px-3 py-1 text-[11px] text-muted-foreground">{t("shell.no_tables")}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function uniqueDatabases(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

interface Props {
  conn: Connection;
  isActive: boolean;
  onSelect: (conn: Connection) => void;
  onEdit: (conn: Connection, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDisconnect: (e: React.MouseEvent) => void;
  onCreateAction?: (conn: Connection) => void;
  onCreateDatabase?: (conn: Connection) => void;
  onManage?: (conn: Connection, e: React.MouseEvent) => void;
  activeDatabase?: string;
  onSelectTable?: (tableName: string) => void;
  activeTable?: string;
  collapseToken: number;
}

export function SidebarConnection({ 
  conn, 
  isActive, 
  onSelect, 
  onEdit, 
  onDelete, 
  onDisconnect,
  onCreateAction,
  onCreateDatabase,
  onManage,
  activeDatabase,
  onSelectTable,
  activeTable,
  collapseToken
}: Props) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [databases, setDatabases] = useState<string[]>(() => uniqueDatabases([conn.database]));
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const fetchDatabases = async (force = false) => {
    if (hasScanned && !force) return;
    try {
      setLoading(true);
      const discovered = await listDatabases(conn, { force });
      setDatabases(uniqueDatabases([conn.database, ...discovered]));
      setHasScanned(true);
    } catch (err) {
      console.error("Failed to fetch databases for sidebar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDatabases((current) => uniqueDatabases([conn.database, ...current]));
    setHasScanned(false);
  }, [conn.id, conn.database]);

  useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  useEffect(() => {
    if (collapseToken > 0) {
      setIsExpanded(false);
    }
  }, [collapseToken]);

  const refreshConnection = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setRefreshToken((value) => value + 1);
    await fetchDatabases(true);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div 
        className={`group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 transition-all hover:bg-background/70 ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
        onClick={() => {
          onSelect(conn);
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronRight 
            size={14} 
            className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90 text-primary' : ''}`} 
          />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center">
              <DatabaseEngineIcon engine={conn.type} active={isActive} />
              {isActive && (
                <motion.div 
                  layoutId="active-dot" 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -bottom-0.5 size-1.5 rounded-full bg-primary" 
                />
              )}
            </div>
            <span className={`truncate text-[12px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
              {conn.name}
            </span>
          </div>
        </div>

        <div className={`flex items-center transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="flex items-center rounded-md">
                {isActive && (
                  <>
                    <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md text-primary hover:bg-primary/10"
                    onClick={(e) => onDisconnect(e)}
                    >
                    <LogOut size={12} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        onClick={refreshConnection}
                        title={t("shell.refresh_databases_tables")}
                        disabled={loading}
                    >
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateDatabase?.(conn);
                        }}
                        title={t("shell.new_database")}
                    >
                        <DatabaseIcon size={12} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onManage?.(conn, e);
                        }}
                        title={t("shell.manager")}
                    >
                        <Shield size={12} />
                    </Button>
                  </>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={(e) => onEdit(conn, e)}
                >
                    <Pencil size={12} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => onDelete(conn.id, e)}
                >
                    <Trash2 size={12} />
                </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 py-1 pl-6 pr-2">
              {databases.map((dbName) => (
                <DatabaseItem 
                    key={dbName}
                    conn={conn}
                    dbName={dbName}
                    isCurrentDb={isActive && activeDatabase === dbName}
                    onSelect={onSelect}
                    onCreateAction={onCreateAction}
                    onSelectTable={onSelectTable}
                    activeTable={activeTable}
                    refreshToken={refreshToken}
                    collapseToken={collapseToken}
                />
              ))}

              {databases.length === 0 && (
                <div className="flex items-center justify-between px-3 py-2 group/empty">
                   <div className="flex items-center gap-2 text-muted-foreground">
                    <DatabaseIcon size={10} />
                    <span className="text-[11px]">{t("shell.empty")}</span>
                   </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DatabaseEngineIcon({ engine, active }: { engine: DbEngine; active: boolean }) {
  const baseClass = active ? "text-primary" : "text-muted-foreground group-hover:text-foreground";

  if (engine === "postgres") {
    return (
      <span
        className={`flex size-4 items-center justify-center rounded-[5px] bg-background/80 transition-colors ${baseClass}`}
        title="PostgreSQL"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path
            d="M3.2 6.2c0-2.4 1.8-4.1 4.8-4.1s4.8 1.7 4.8 4.1c0 1.6-.6 2.8-1.7 3.5.2 1.3.3 2.3-.2 2.8-.4.4-1.1.2-2-.6-.3 1.2-1.1 2-2.1 2-.9 0-1.4-.5-1.6-1.4-.2-.7-.1-1.8.1-2.8-1.2-.7-2.1-1.8-2.1-3.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path d="M6.1 6.4h.1M9.8 6.4h.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M7 9.3c.7.4 1.4.4 2 0" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (engine === "mysql") {
    return (
      <span
        className={`flex size-4 items-center justify-center rounded-[5px] bg-background/80 transition-colors ${baseClass}`}
        title="MySQL"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path
            d="M2.1 9.7c2.7-4.4 6.7-5.8 11.8-4.2-2 2.9-4.8 4.8-8.4 5.6 1.4.3 2.9.2 4.4-.1-2.4 1.6-5.2 1.8-7.8-1.3Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path d="M8.8 4.5c1.2-1 2.3-1.4 3.5-1.2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (engine === "sqlite") {
    return (
      <span
        className={`flex size-4 items-center justify-center rounded-[5px] bg-background/80 transition-colors ${baseClass}`}
        title="SQLite"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path d="M4 2.7h7.1l1 1v9.6H4V2.7Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M6 5h4M6 7.4h4M6 9.8h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`flex size-4 items-center justify-center rounded-[5px] bg-background/80 text-[9px] font-semibold leading-none transition-colors ${baseClass}`}
      title="SQL Server"
    >
      MS
    </span>
  );
}
