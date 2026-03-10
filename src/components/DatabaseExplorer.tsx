import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import { Connection } from "../lib/useConnections";
import { 
  Table as TableIcon, 
  Loader2, 
  AlertCircle,
  Hash,
  Type,
  Calendar
} from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  connection: Connection;
}

export function DatabaseExplorer({ connection }: Props) {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Construct connection string properly based on type
      let connStr = "";
      const { type, host, port, username, password, database } = connection;
      
      if (type === 'postgres') {
        connStr = `postgres://${username}:${password}@${host}:${port}/${database}`;
      } else if (type === 'mysql') {
        connStr = `mysql://${username}:${password}@${host}:${port}/${database}`;
      } else if (type === 'sqlite') {
        connStr = `sqlite:${host}`;
      } else if (type === 'sqlserver') {
        connStr = `sqlserver://${host}:${port};database=${database};user=${username};password=${password}`;
      }

      console.log(`[DatabaseExplorer] Connecting to ${type} at ${host}...`);
      const db = await Database.load(connStr);
      
      let query = "";
      if (type === 'postgres') {
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
      } else if (type === 'mysql') {
        query = "SHOW TABLES";
      } else if (type === 'sqlite') {
        query = "SELECT name FROM sqlite_master WHERE type='table'";
      } else if (type === 'sqlserver') {
        query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'";
      }

      const result = await db.select<any[]>(query);
      console.log(`[DatabaseExplorer] Query result:`, result);

      // Extract names robustly
      const names = result.map(r => {
        // Fallback for MySQL/generic results
        return r.table_name || r.name || r.TABLE_NAME || Object.values(r)[0];
      });

      setTables(names as string[]);
      await db.close();
    } catch (err: any) {
      console.error("Database connection error:", err);
      setError(err.message || "Failed to connect to database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [connection.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
        <Loader2 className="animate-spin" size={32} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Connecting to Engine...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-2xl bg-destructive/5 border border-destructive/10 flex flex-col gap-4">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle size={20} />
          <span className="font-bold uppercase tracking-widest text-xs">Connection Failed</span>
        </div>
        <p className="text-sm font-medium opacity-60 leading-relaxed">{error}</p>
        <button 
          onClick={fetchTables}
          className="w-fit text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">{connection.database}</h2>
          <div className="flex items-center gap-2 opacity-40">
            <span className="text-[10px] font-bold uppercase tracking-widest">{connection.host}:{connection.port}</span>
            <span className="text-[10px]">•</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">{connection.type}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Quick Stats */}
          <div className="px-4 py-2 rounded-xl bg-card border border-border/5 shadow-sm">
            <span className="text-[10px] font-black tracking-widest text-muted-foreground opacity-40 uppercase">Tables: </span>
            <span className="text-xs font-bold tabular-nums">{tables.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table, i) => (
          <div 
            key={i}
            className="group p-5 rounded-2xl bg-card border border-border/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="size-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground/40 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                <TableIcon size={20} />
              </div>
              <span className="font-bold text-sm tracking-tight truncate group-hover:text-foreground transition-colors uppercase">
                {table}
              </span>
            </div>
            
            <div className="flex gap-1.5 opacity-20 group-hover:opacity-60 transition-opacity">
              <Hash size={12} />
              <Type size={12} />
              <Calendar size={12} />
              <span className="ml-auto text-[9px] font-black uppercase tracking-widest">Explore</span>
            </div>
          </div>
        ))}
        {tables.length === 0 && !loading && !error && (
            <div className="col-span-full py-12 text-center opacity-30">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">No collections found in this database.</p>
            </div>
        )}
      </div>
    </motion.div>
  );
}
