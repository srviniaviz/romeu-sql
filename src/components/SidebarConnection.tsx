import { useState, useEffect } from "react";
import { Connection } from "../lib/useConnections";
import Database from "@tauri-apps/plugin-sql";
import { 
  ChevronRight, 
  Pencil, 
  Trash2, 
  LogOut,
  RefreshCw,
  Database as DatabaseIcon,
  Plus as PlusIcon,
  Table as TableIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface DatabaseItemProps {
  conn: Connection;
  dbName: string;
  isCurrentDb: boolean;
  onSelect: (conn: Connection) => void;
  onCreateAction?: (conn: Connection) => void;
  onSelectTable?: (tableName: string) => void;
  activeTable?: string;
}

function DatabaseItem({ conn, dbName, isCurrentDb, onSelect, onCreateAction, onSelectTable, activeTable }: DatabaseItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTables = async () => {
    if (tables.length > 0) return;
    try {
      setLoading(true);
      const connStr = { ...conn, database: dbName };
      const getConnectionString = (c: Connection) => {
        const { type, host, port, username, password, database } = c;
        if (type === 'postgres') return `postgres://${username}:${password}@${host}:${port}/${database}`;
        if (type === 'mysql') return `mysql://${username}:${password}@${host}:${port}/${database}`;
        if (type === 'sqlite') return `sqlite:${host}`;
        if (type === 'sqlserver') return `sqlserver://${host}:${port};database=${database};user=${username};password=${password}`;
        return "";
      };

      const db = await Database.load(getConnectionString(connStr));
      
      let query = "";
      const type = conn.type;
      if (type === 'postgres') {
        query = "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC";
      } else if (type === 'mysql') {
        query = "SHOW TABLES";
      } else if (type === 'sqlite') {
        query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC";
      } else if (type === 'sqlserver') {
        query = "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME ASC";
      }

      const result = await db.select<any[]>(query);
      const names = result.map(r => r.name || r.table_name || r.TABLE_NAME || Object.values(r)[0]);

      setTables(names as string[]);
      await db.close();
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

  return (
    <div className="flex flex-col gap-0.5">
      <div 
        className={`group/db-item flex items-center justify-between px-2 py-1 rounded-lg hover:bg-muted/50 cursor-pointer group/item transition-all ${isCurrentDb ? 'bg-primary/5 text-primary' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect({ ...conn, database: dbName });
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex items-center gap-2 truncate">
          <div className="size-4 flex items-center justify-center">
            <ChevronRight 
                size={12} 
                className={`opacity-20 transition-transform ${isExpanded ? 'rotate-90 opacity-60' : ''}`} 
            />
          </div>
          <DatabaseIcon 
            size={13} 
            className={`opacity-20 transition-opacity ${isCurrentDb ? 'text-primary opacity-100' : 'group-hover/item:opacity-60'}`} 
          />
          <span className={`text-[10px] font-bold tracking-tight truncate uppercase ${isCurrentDb ? 'text-primary' : 'text-muted-foreground/50 group-hover/item:text-foreground'}`}>
            {dbName}
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="size-5 rounded opacity-0 group-hover/db-item:opacity-40 hover:!opacity-100 transition-all hover:bg-primary/10 hover:text-primary"
          onClick={(e) => {
              e.stopPropagation();
              onSelect({ ...conn, database: dbName });
              onCreateAction?.({ ...conn, database: dbName });
          }}
          title="New Table"
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
            className="overflow-hidden ml-4 pl-2 border-l border-border/10 flex flex-col gap-0.5 mt-0.5"
          >
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-1 opacity-20">
                <RefreshCw size={10} className="animate-spin" />
                <span className="text-[9px] font-black uppercase tracking-widest">Loading...</span>
              </div>
            ) : tables.length > 0 ? (
              tables.map(table => (
                <div 
                  key={table}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/30 cursor-pointer group/table transition-all ${activeTable === table && isCurrentDb ? 'bg-primary/10 text-primary' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isCurrentDb) onSelect({ ...conn, database: dbName });
                    onSelectTable?.(table);
                  }}
                >
                  <TableIcon size={12} className={`opacity-10 group-hover/table:opacity-40 ${activeTable === table && isCurrentDb ? 'text-primary opacity-60' : 'text-muted-foreground'}`} />
                  <span className={`text-[10px] font-bold tracking-tight truncate uppercase ${activeTable === table && isCurrentDb ? 'text-primary' : 'text-muted-foreground/40 group-hover/table:text-foreground'}`}>
                    {table}
                  </span>
                </div>
              ))
            ) : (
              <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest opacity-10">No Tables</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  activeDatabase?: string;
  onSelectTable?: (tableName: string) => void;
  activeTable?: string;
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
  activeDatabase,
  onSelectTable,
  activeTable
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const getEngineColor = (type: string) => {
    switch (type) {
      case 'postgres': return 'bg-cyan-500';
      case 'mysql': return 'bg-amber-500';
      case 'sqlite': return 'bg-emerald-500';
      case 'sqlserver': return 'bg-red-500';
      default: return 'bg-primary';
    }
  };

  const getConnectionString = () => {
    const { type, host, port, username, password, database } = conn;
    if (type === 'postgres') return `postgres://${username}:${password}@${host}:${port}/${database}`;
    if (type === 'mysql') return `mysql://${username}:${password}@${host}:${port}/${database}`;
    if (type === 'sqlite') return `sqlite:${host}`;
    if (type === 'sqlserver') return `sqlserver://${host}:${port};database=${database};user=${username};password=${password}`;
    return "";
  };

  const fetchDatabases = async () => {
    if (databases.length > 0 && !isActive) return;
    try {
      setLoading(true);
      const db = await Database.load(getConnectionString());
      
      let query = "";
      const type = conn.type;
      if (type === 'postgres') {
        query = "SELECT datname as name FROM pg_database WHERE datistemplate = false ORDER BY datname ASC";
      } else if (type === 'mysql') {
        query = "SHOW DATABASES";
      } else if (type === 'sqlite') {
        setDatabases([conn.database || 'main']);
        await db.close();
        return;
      } else if (type === 'sqlserver') {
        query = "SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name ASC";
      }

      const result = await db.select<any[]>(query);
      const names = result.map(r => r.name || r.datname || r.Database || Object.values(r)[0]);

      setDatabases(names as string[]);
      await db.close();
    } catch (err) {
      console.error("Failed to fetch databases for sidebar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive || isExpanded) {
      fetchDatabases();
    }
  }, [isActive, isExpanded]);

  return (
    <div className="flex flex-col gap-0.5">
      <div 
        className={`group flex items-center h-9 px-3 gap-3 rounded-lg hover:bg-primary/5 cursor-pointer transition-all ${isActive ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]' : ''}`}
        onClick={() => {
          onSelect(conn);
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronRight 
            size={14} 
            className={`opacity-20 transition-transform ${isExpanded || isActive ? 'rotate-90 opacity-100 text-primary' : 'group-hover:opacity-40'}`} 
          />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center">
              <div className={`size-2.5 rounded-[2px] ${getEngineColor(conn.type)} opacity-80 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
              {isActive && (
                <motion.div 
                  layoutId="active-dot" 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -bottom-0.5 size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] border-[1.5px] border-background" 
                />
              )}
            </div>
            <span className={`text-[11px] font-bold tracking-tight text-muted-foreground transition-colors truncate uppercase ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`}>
              {conn.name}
            </span>
          </div>
        </div>

        <div className={`flex items-center transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="flex items-center bg-muted/20 p-0.5 rounded-lg border border-border/5">
                {isActive && (
                    <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md text-primary hover:bg-primary/20 hover:text-primary transition-all"
                    onClick={(e) => onDisconnect(e)}
                    >
                    <LogOut size={12} />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md opacity-40 hover:opacity-100 hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCreateDatabase?.(conn);
                    }}
                    title="New Database"
                >
                    <DatabaseIcon size={12} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md opacity-40 hover:opacity-100 hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCreateAction?.(conn);
                    }}
                    title="New Table"
                >
                    <PlusIcon size={12} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md opacity-40 hover:opacity-100 hover:bg-primary/10"
                    onClick={(e) => onEdit(conn, e)}
                >
                    <Pencil size={12} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md opacity-40 hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => onDelete(conn.id, e)}
                >
                    <Trash2 size={12} />
                </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(isExpanded || isActive) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pl-6 pr-2 py-1 flex flex-col gap-0.5">
              {loading && databases.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 opacity-20">
                  <RefreshCw size={10} className="animate-spin" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Scanning...</span>
                </div>
              )}
              
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
                />
              ))}

              {!loading && databases.length === 0 && (
                <div className="px-3 py-2 flex items-center justify-between group/empty">
                   <div className="flex items-center gap-2 opacity-20">
                    <DatabaseIcon size={10} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Empty</span>
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
