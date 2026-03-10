import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import { Connection } from "../lib/useConnections";
import { 
  Table as TableIcon, 
  Loader2, 
  AlertCircle,
  Hash,
  Type,
  Calendar,
  LogOut,
  Plus as PlusIcon,
  Terminal,
  Play,
  CheckCircle2,
  XCircle,
  History,
  Code as CodeIcon,
  Trash as TrashIcon,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CreateTableModal } from "./CreateTableModal";
import { CreateDatabaseModal } from "./CreateDatabaseModal";

interface Props {
  connection: Connection;
  onDisconnect: () => void;
  openCreateOnMount?: boolean;
  openCreateDbOnMount?: boolean;
  onModalOpened?: () => void;
}

interface HistoryEntry {
  id: string;
  action: string;
  query?: string;
  status: 'success' | 'error';
  message: string;
  timestamp: Date;
}

export function DatabaseExplorer({ connection, onDisconnect, openCreateOnMount, openCreateDbOnMount, onModalOpened }: Props) {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [sqlQuery, setSqlQuery] = useState("");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{ success: boolean, message: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');

  const addHistory = (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    setHistory(prev => [{
        ...entry,
        id: Math.random().toString(36).substring(7),
        timestamp: new Date()
    }, ...prev]);
  };

  useEffect(() => {
    if (openCreateOnMount) {
      setIsCreateModalOpen(true);
      onModalOpened?.();
    } else if (openCreateDbOnMount) {
      setIsCreateDbModalOpen(true);
      onModalOpened?.();
    }
  }, [openCreateOnMount, openCreateDbOnMount]);

  const handleCreateDatabase = async (name: string) => {
    const query = connection.type === 'sqlserver' ? `CREATE SCHEMA ${name}` : `CREATE DATABASE ${name}`;
    try {
      setExecuting(true);
      const db = await Database.load(getConnectionString());
      await db.execute(query);
      const msg = `Database ${name} created successfully!`;
      setExecResult({ success: true, message: msg });
      addHistory({ action: 'Create Database', query, status: 'success', message: msg });
      await db.close();
      fetchTables();
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      setExecResult({ success: false, message: msg });
      addHistory({ action: 'Create Database', query, status: 'error', message: msg });
      throw err;
    } finally {
      setExecuting(false);
    }
  };

  const handleCreateTable = async (sql: string) => {
    try {
      setExecuting(true);
      setExecResult(null);
      const db = await Database.load(getConnectionString());
      await db.execute(sql);
      const msg = "Table created successfully!";
      setExecResult({ success: true, message: msg });
      addHistory({ action: 'Create Table', query: sql, status: 'success', message: msg });
      await db.close();
      fetchTables();
      setIsCreateModalOpen(false);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      setExecResult({ success: false, message: msg });
      addHistory({ action: 'Create Table', query: sql, status: 'error', message: msg });
      setIsConsoleOpen(true);
      setActiveTab('editor');
      throw err;
    } finally {
      setExecuting(false);
    }
  };

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let connStr = getConnectionString();
      const db = await Database.load(connStr);
      
      let query = "";
      const type = connection.type;
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
      const names = result.map(r => r.table_name || r.name || r.TABLE_NAME || Object.values(r)[0]);

      setTables(names as string[]);
      await db.close();
    } catch (err: any) {
      setError(err.message || "Failed to connect to database");
    } finally {
      setLoading(false);
    }
  };

  const getConnectionString = () => {
    const { type, host, port, username, password, database } = connection;
    if (type === 'postgres') return `postgres://${username}:${password}@${host}:${port}/${database}`;
    if (type === 'mysql') return `mysql://${username}:${password}@${host}:${port}/${database}`;
    if (type === 'sqlite') return `sqlite:${host}`;
    if (type === 'sqlserver') return `sqlserver://${host}:${port};database=${database};user=${username};password=${password}`;
    return "";
  };

  const executeSql = async () => {
    if (!sqlQuery.trim()) return;
    try {
      setExecuting(true);
      setExecResult(null);
      const db = await Database.load(getConnectionString());
      await db.execute(sqlQuery);
      const msg = "Query executed successfully!";
      setExecResult({ success: true, message: msg });
      addHistory({ action: 'Execute SQL', query: sqlQuery, status: 'success', message: msg });
      await db.close();
      fetchTables();
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      setExecResult({ success: false, message: msg });
      addHistory({ action: 'Execute SQL', query: sqlQuery, status: 'error', message: msg });
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [connection.id, connection.database]);

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
        <div className="flex gap-3">
          <Button onClick={fetchTables} className="w-fit text-[10px] font-black uppercase tracking-widest" variant="destructive">Try Again</Button>
          <Button onClick={onDisconnect} className="w-fit text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100" variant="ghost">Disconnect</Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
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
          <div className="px-4 py-2 rounded-xl bg-card border border-border/5 shadow-sm">
            <span className="text-[10px] font-black tracking-widest text-muted-foreground opacity-40 uppercase">Tables: </span>
            <span className="text-xs font-bold tabular-nums">{tables.length}</span>
          </div>

          <Separator orientation="vertical" className="h-10 mx-2 opacity-10" />

          <Button 
            variant="ghost" 
            className={`h-10 px-4 rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest transition-all hover:bg-primary/5 group ${isConsoleOpen ? 'bg-primary/10 text-primary opacity-100' : 'opacity-40'}`}
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
          >
            <Terminal size={14} className={isConsoleOpen ? 'text-primary' : 'group-hover:text-primary'} />
            Console
          </Button>

          {connection.type !== 'sqlite' && (
            <Button 
                variant="ghost" 
                className="h-10 px-4 rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest bg-muted/20 hover:bg-muted/40 transition-all opacity-60 hover:opacity-100"
                onClick={() => setIsCreateDbModalOpen(true)}
            >
                <PlusIcon size={14} />
                New DB
            </Button>
          )}

          <Button 
            variant="ghost" 
            className="h-10 px-4 rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest bg-primary/5 text-primary hover:bg-primary/10 transition-all"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <PlusIcon size={14} />
            New Table
          </Button>

          <Button variant="ghost" size="icon" className="size-10 rounded-xl opacity-20 hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive group" onClick={onDisconnect}>
            <LogOut size={18} className="transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>

      <CreateTableModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        dbType={connection.type}
        onCreate={handleCreateTable}
      />

      <CreateDatabaseModal
        isOpen={isCreateDbModalOpen}
        onClose={() => setIsCreateDbModalOpen(false)}
        onCreate={handleCreateDatabase}
      />

      <AnimatePresence>
        {isConsoleOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border border-border/5 rounded-3xl bg-card/30 backdrop-blur-xl"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/5 px-6 py-3">
                <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-xl">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'editor' ? 'bg-background shadow-sm text-primary opacity-100' : 'opacity-40 hover:opacity-100'}`}
                        onClick={() => setActiveTab('editor')}
                    >
                        <CodeIcon size={12} className="mr-2" />
                        SQL Editor
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'history' ? 'bg-background shadow-sm text-primary opacity-100' : 'opacity-40 hover:opacity-100'}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <History size={12} className="mr-2" />
                        Activity Log
                        {history.length > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary tabular-nums">({history.length})</span>
                        )}
                    </Button>
                </div>
                
                {activeTab === 'editor' ? (
                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100"
                            onClick={() => setSqlQuery("")}
                        >Clear</Button>
                        <Button 
                            size="sm" 
                            className={`h-8 px-4 text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all ${executing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={executeSql}
                            disabled={executing}
                        >
                            {executing ? <Loader2 size={12} className="animate-spin mr-2" /> : <Play size={10} className="mr-2 fill-current" />}
                            Run Script
                        </Button>
                    </div>
                ) : (
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-destructive"
                        onClick={() => setHistory([])}
                    >
                        <TrashIcon size={12} className="mr-2" />
                        Clear History
                    </Button>
                )}
              </div>

              <div className="p-6">
                {activeTab === 'editor' ? (
                  <div className="space-y-4">
                    <Textarea 
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="-- Write your SQL script here...&#10;CREATE TABLE demo (id INT, name TEXT);" 
                className="min-h-32 bg-black/40 border-border/10 font-mono text-[13px] leading-relaxed selection:bg-primary/30"
              />

              {execResult && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border transition-all animate-in fade-in slide-in-from-top-2 ${execResult.success ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                  {execResult.success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      {execResult.success ? 'Sync Success' : 'Engine Error'}
                    </p>
                    <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap">{execResult.message}</p>
                  </div>
                </div>
              )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                    {history.length === 0 ? (
                        <div className="py-12 text-center opacity-20 flex flex-col items-center gap-3">
                            <Clock size={32} />
                            <span className="text-[10px] font-black uppercase tracking-widest">No activity recorded yet</span>
                        </div>
                    ) : history.map((entry) => (
                        <div key={entry.id} className="p-4 rounded-2xl bg-muted/10 border border-border/5 flex flex-col gap-3 group/entry hover:bg-muted/20 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`size-2 rounded-full ${entry.status === 'success' ? 'bg-emerald-500' : 'bg-destructive'}`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{entry.action}</span>
                                    <span className="text-[10px] font-bold opacity-20 tabular-nums lowercase">{entry.timestamp.toLocaleTimeString()}</span>
                                </div>
                                {entry.status === 'error' && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-destructive px-2 py-0.5 rounded bg-destructive/10">Engine Fault</span>
                                )}
                            </div>
                            
                            {entry.query && (
                                <code className="block p-3 rounded-lg bg-black/40 font-mono text-[11px] text-muted-foreground group-hover/entry:text-foreground transition-colors truncate">
                                    {entry.query}
                                </code>
                            )}

                            <div className={`flex items-start gap-2 text-xs font-medium ${entry.status === 'success' ? 'text-foreground/60' : 'text-destructive/80'}`}>
                                {entry.status === 'error' && <AlertCircle size={12} className="mt-0.5" />}
                                <p className="leading-relaxed whitespace-pre-wrap break-all">{entry.message}</p>
                            </div>
                        </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table, i) => (
          <div key={i} className="group p-5 rounded-2xl bg-card border border-border/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="size-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground/40 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                <TableIcon size={20} />
              </div>
              <span className="font-bold text-sm tracking-tight truncate group-hover:text-foreground transition-colors uppercase">{table}</span>
            </div>
            <div className="flex gap-1.5 opacity-20 group-hover:opacity-60 transition-opacity">
              <Hash size={12} /> <Type size={12} /> <Calendar size={12} />
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
