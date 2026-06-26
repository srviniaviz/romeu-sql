import { useState, useEffect } from "react";
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
  refreshToken: number;
}

function DatabaseItem({ conn, dbName, isCurrentDb, onSelect, onCreateAction, onSelectTable, activeTable, refreshToken }: DatabaseItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTables = async (force = false) => {
    if (tables.length > 0 && !force) return;
    try {
      setLoading(true);
      setTables(await listTables({ ...conn, database: dbName }));
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
    if (refreshToken > 0 && isExpanded) {
      fetchTables(true);
    }
  }, [refreshToken]);

  return (
    <div className="flex flex-col gap-0.5">
      <div 
        className={`group/db-item flex items-center justify-between rounded-md px-2 py-1 cursor-pointer group/item transition-all hover:bg-background/70 ${isCurrentDb ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
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
            className="ml-4 mt-0.5 flex flex-col gap-0.5 overflow-hidden pl-2"
          >
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-muted-foreground">
                <RefreshCw size={10} className="animate-spin" />
                <span>Loading</span>
              </div>
            ) : tables.length > 0 ? (
              tables.map(table => (
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
              <span className="px-3 py-1 text-[11px] text-muted-foreground">No tables</span>
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
  const [refreshToken, setRefreshToken] = useState(0);

  const getEngineColor = (type: string) => {
    switch (type) {
      case 'postgres': return 'bg-primary';
      case 'mysql': return 'bg-primary';
      case 'sqlite': return 'bg-primary';
      case 'sqlserver': return 'bg-primary';
      default: return 'bg-primary';
    }
  };

  const fetchDatabases = async (force = false) => {
    if (databases.length > 0 && !force) return;
    try {
      setLoading(true);
      setDatabases(await listDatabases(conn));
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
            className={`text-muted-foreground transition-transform ${isExpanded || isActive ? 'rotate-90 text-primary' : ''}`} 
          />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center">
              <div className={`size-2.5 rounded-[2px] ${getEngineColor(conn.type)} transition-opacity`} />
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
                    <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md text-primary hover:bg-primary/10"
                    onClick={(e) => onDisconnect(e)}
                    >
                    <LogOut size={12} />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={refreshConnection}
                    title="Refresh databases and tables"
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
                    title="New Database"
                >
                    <DatabaseIcon size={12} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
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
        {(isExpanded || isActive) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 py-1 pl-6 pr-2">
              {loading && databases.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground">
                  <RefreshCw size={10} className="animate-spin" />
                  <span>Scanning</span>
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
                    refreshToken={refreshToken}
                />
              ))}

              {!loading && databases.length === 0 && (
                <div className="flex items-center justify-between px-3 py-2 group/empty">
                   <div className="flex items-center gap-2 text-muted-foreground">
                    <DatabaseIcon size={10} />
                    <span className="text-[11px]">Empty</span>
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
