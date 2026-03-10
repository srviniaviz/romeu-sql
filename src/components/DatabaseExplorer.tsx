import { useEffect, useState, useRef } from "react";
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
  RefreshCw,
  History,
  Code as CodeIcon,
  Trash as TrashIcon,
  Clock,
  LayoutGrid,
  Rows3,
  ChevronRight as ChevronRightIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CreateTableModal } from "./CreateTableModal";
import { CreateDatabaseModal } from "./CreateDatabaseModal";
import { InsertDataModal } from "./InsertDataModal";

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
  isPrimaryKey: boolean;
}

interface Props {
  connection: Connection;
  onDisconnect: () => void;
  openCreateOnMount?: boolean;
  openCreateDbOnMount?: boolean;
  onModalOpened?: () => void;
  selectedTable?: string | null;
  onTableSelected?: (tableName: string | null) => void;
}

interface HistoryEntry {
  id: string;
  action: string;
  query?: string;
  status: 'success' | 'error';
  message: string;
  timestamp: Date;
}

export function DatabaseExplorer({ 
    connection, 
    onDisconnect, 
    openCreateOnMount, 
    openCreateDbOnMount, 
    onModalOpened,
    selectedTable,
    onTableSelected
}: Props) {
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
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const lastRequestId = useRef<string | null>(null);

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
    // ID to track this specific request
    const requestId = Date.now().toString();
    lastRequestId.current = requestId;

    try {
      if (isFirstLoad) setLoading(true);
      setRefreshing(true);
      setError(null);
      
      let connStr = getConnectionString();
      const db = await Database.load(connStr);
      
      try {
          if (lastRequestId.current !== requestId) {
              await db.close();
              return;
          }

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
          
          if (lastRequestId.current === requestId) {
            const names = result.map(r => r.table_name || r.name || r.TABLE_NAME || Object.values(r)[0]);
            setTables(names as string[]);
            setIsFirstLoad(false);
          }
      } finally {
          await db.close();
      }
    } catch (err: any) {
      if (lastRequestId.current === requestId) {
          const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
          setError(msg || "Failed to connect to database");
          console.error("Database connection error:", err);
      }
    } finally {
      if (lastRequestId.current === requestId) {
          setLoading(false);
          setRefreshing(false);
      }
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

  const fetchTableData = async () => {
    if (!selectedTable) return;
    try {
      setDataLoading(true);
      const db = await Database.load(getConnectionString());
      try {
          const result = await db.select<any[]>(`SELECT * FROM ${selectedTable} LIMIT 100`);
          setTableData(result);
      } finally {
          await db.close();
      }
    } catch (err: any) {
      console.error("Failed to fetch table data:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchColumns = async () => {
    if (!selectedTable) return;
    try {
      const db = await Database.load(getConnectionString());
      try {
          let query = "";
          const type = connection.type;
          
          if (type === 'postgres') {
            const pureTable = selectedTable.replace(/['"`]/g, '').split('.').pop();
            query = `SELECT column_name as name, data_type as type, is_nullable as nullable, column_default as "defaultValue" 
                     FROM information_schema.columns 
                     WHERE table_name = '${pureTable}' OR table_name = '${selectedTable}'
                     ORDER BY ordinal_position`;
          } else if (type === 'mysql') {
            query = `DESCRIBE ${selectedTable}`;
          } else if (type === 'sqlite') {
            query = `PRAGMA table_info(${selectedTable})`;
          } else if (type === 'sqlserver') {
            const pureTable = selectedTable.replace(/['"`]/g, '').split('.').pop();
            query = `SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as nullable, COLUMN_DEFAULT as defaultValue 
                     FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${pureTable}'`;
          }

          const result = await db.select<any[]>(query);
          const mapped = result.map(r => {
            const name = r.name || r.column_name || r.Field || r.COLUMN_NAME;
            const rawType = r.type || r.data_type || r.Type || r.DATA_TYPE;
            
            // Basic PK detection that won't hide everything by mistake
            const isPK = (
                r.pk === 1 || 
                r.Key === 'PRI' || 
                r.is_identity === 1 ||
                (r.defaultValue && String(r.defaultValue).toLowerCase().includes('nextval'))
            );
            
            return {
              name,
              type: rawType,
              nullable: r.nullable === 'YES' || r.Null === 'YES' || r.IS_NULLABLE === 'YES' || r.notnull === 0 || r.pk === 0,
              defaultValue: r.defaultValue || r.Default || r.COLUMN_DEFAULT,
              isPrimaryKey: !!isPK
            };
          });
          
          setColumns(mapped);
      } finally {
          await db.close();
      }
    } catch (err) {
      console.error("Failed to fetch columns:", err);
    }
  };

  const handleInsertData = async (data: Record<string, any>) => {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data).map(v => typeof v === 'string' ? `'${v}'` : v);
      const query = `INSERT INTO ${selectedTable} (${keys.join(', ')}) VALUES (${values.join(', ')})`;
      
      const db = await Database.load(getConnectionString());
      await db.execute(query);
      await db.close();
      
      const msg = "Record inserted successfully!";
      setExecResult({ success: true, message: msg });
      addHistory({ action: 'Insert Data', query, status: 'success', message: msg });
      fetchTableData();
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      setExecResult({ success: false, message: msg });
      addHistory({ action: 'Insert Data', status: 'error', message: msg });
      throw err;
    }
  };

  useEffect(() => {
    if (selectedTable) {
        fetchTableData();
        fetchColumns();
    }
  }, [selectedTable, connection.database]);

  useEffect(() => {
    // If it's the same connection but different database, don't show full loader
    fetchTables();
  }, [connection.id, connection.database]);

  useEffect(() => {
    // Reset first load state when connection changes
    setIsFirstLoad(true);
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
          <div className="px-4 py-2 rounded-xl bg-card border border-border/5 shadow-sm flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest text-muted-foreground opacity-40 uppercase">{selectedTable ? 'Records' : 'Tables'}: </span>
            <span className="text-xs font-bold tabular-nums">{selectedTable ? tableData.length : tables.length}</span>
            {(refreshing || dataLoading) && <RefreshCw size={10} className="animate-spin text-primary ml-1" />}
          </div>

          {selectedTable && (
            <>
                <Separator orientation="vertical" className="h-10 mx-2 opacity-10" />
                <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-xl">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'table' ? 'bg-background shadow-sm text-primary opacity-100' : 'opacity-40 hover:opacity-100'}`}
                        onClick={() => setViewMode('table')}
                    >
                        <Rows3 size={12} className="mr-2" />
                        Table
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'json' ? 'bg-background shadow-sm text-primary opacity-100' : 'opacity-40 hover:opacity-100'}`}
                        onClick={() => setViewMode('json')}
                    >
                        <LayoutGrid size={12} className="mr-2" />
                        JSON
                    </Button>
                </div>
            </>
          )}

          <Separator orientation="vertical" className="h-10 mx-2 opacity-10" />

          <Button 
            variant="ghost" 
            className={`h-10 px-4 rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest transition-all hover:bg-primary/5 group ${isConsoleOpen ? 'bg-primary/10 text-primary opacity-100' : 'opacity-40'}`}
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
          >
            <Terminal size={14} className={isConsoleOpen ? 'text-primary' : 'group-hover:text-primary'} />
            Console
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

      <InsertDataModal
        isOpen={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
        tableName={selectedTable || ""}
        columns={columns}
        onInsert={handleInsertData}
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

      {selectedTable ? (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-[10px] font-black uppercase tracking-widest bg-muted/20 opacity-40 hover:opacity-100"
                    onClick={() => onTableSelected?.(null)}
                >
                    <ChevronRightIcon size={14} className="rotate-180 mr-1" />
                    Back to Grid
                </Button>
                <Separator orientation="vertical" className="h-4 mx-2" />
                <div className="flex items-center gap-2">
                    <TableIcon size={16} className="text-primary" />
                    <span className="text-sm font-black uppercase italic tracking-tight">{selectedTable}</span>
                </div>
                <Button 
                    size="sm" 
                    className="ml-auto h-8 px-4 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 rounded-xl"
                    onClick={() => setIsInsertModalOpen(true)}
                >
                    <PlusIcon size={12} className="mr-2" />
                    Add Document
                </Button>
            </div>

            {dataLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                    <RefreshCw size={32} className="animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Fetching records...</span>
                </div>
            ) : tableData.length === 0 ? (
                <div className="py-20 text-center opacity-20 border-2 border-dashed border-border/10 rounded-3xl">
                    <p className="text-[10px] font-black uppercase tracking-widest">No data found in this collection</p>
                </div>
            ) : viewMode === 'table' ? (
                <div className="rounded-xl border border-border/20 bg-background overflow-hidden relative shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse table-fixed min-w-full">
                            <thead>
                                <tr className="border-b border-border/20 bg-muted/60 sticky top-0 z-10 backdrop-blur-sm">
                                    {Object.keys(tableData[0]).map(col => (
                                        <th key={col} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-foreground/60 border-r border-border/10 last:border-0 whitespace-nowrap overflow-hidden text-ellipsis">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                                {tableData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-primary/[0.04] transition-colors group">
                                        {Object.values(row).map((val: any, vidx) => (
                                            <td key={vidx} className="px-5 py-3 text-[11px] font-medium border-r border-border/10 last:border-0 whitespace-nowrap overflow-hidden text-ellipsis">
                                                <span className="opacity-90 group-hover:opacity-100 transition-opacity">
                                                    {val === null ? <span className="text-[9px] font-black uppercase opacity-30 italic">NULL</span> : String(val)}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {tableData.map((row, idx) => (
                        <div key={idx} className="p-6 rounded-3xl bg-card/60 border border-border/20 backdrop-blur-xl hover:border-primary/40 transition-all group shadow-sm hover:shadow-xl hover:shadow-primary/5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Record #{idx + 1}</span>
                            </div>
                            <div className="space-y-2">
                                {Object.entries(row).map(([key, val]) => (
                                    <div key={key} className="flex items-start gap-4 font-mono text-xs">
                                        <span className="min-w-[120px] text-primary font-bold opacity-70 group-hover:opacity-100 transition-opacity">{key}:</span>
                                        <span className={val === null ? 'text-muted-foreground/50 italic uppercase text-[10px] font-black' : 'text-foreground/100'}>
                                            {val === null ? 'null' : (typeof val === 'object' ? JSON.stringify(val) : String(val))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table, i) => (
            <div 
                key={i} 
                className="group p-5 rounded-2xl bg-card border border-border/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all"
                onClick={() => onTableSelected?.(table)}
            >
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
      )}
    </motion.div>
  );
}
