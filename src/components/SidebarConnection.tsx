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
  Plus as PlusIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

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
  activeDatabase
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

        <div className={`flex items-center gap-1 transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {isActive && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 rounded text-primary hover:bg-primary/20 hover:text-primary transition-all"
              onClick={(e) => onDisconnect(e)}
            >
              <LogOut size={12} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded opacity-40 hover:opacity-100 hover:text-primary hover:bg-primary/10"
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
            className="size-6 rounded opacity-40 hover:opacity-100 hover:text-primary hover:bg-primary/10"
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
            className="size-6 rounded opacity-40 hover:opacity-100 hover:bg-primary/10"
            onClick={(e) => onEdit(conn, e)}
          >
            <Pencil size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded opacity-40 hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => onDelete(conn.id, e)}
          >
            <Trash2 size={12} />
          </Button>
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
            <div className="pl-9 pr-2 py-1 flex flex-col gap-0.5">
              {loading && databases.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 opacity-20">
                  <RefreshCw size={10} className="animate-spin" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Scanning...</span>
                </div>
              )}
              
              {databases.map((dbName) => (
                <div 
                  key={dbName}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer group/item transition-colors ${isActive && activeDatabase === dbName ? 'bg-primary/5' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect({ ...conn, database: dbName });
                  }}
                >
                  <DatabaseIcon 
                    size={12} 
                    className={`opacity-20 transition-opacity ${isActive && activeDatabase === dbName ? 'text-primary opacity-100' : 'group-hover/item:opacity-60 text-muted-foreground'}`} 
                  />
                  <span className={`text-[10px] font-bold tracking-tight truncate uppercase ${isActive && activeDatabase === dbName ? 'text-primary' : 'text-muted-foreground/70 group-hover/item:text-foreground'}`}>
                    {dbName}
                  </span>
                </div>
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
