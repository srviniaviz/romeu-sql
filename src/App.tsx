import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Titlebar } from "./components/Titlebar";
import { CreateConnectionModal } from "./components/CreateConnection";
import { 
  Plus, 
  Settings, 
  Database, 
  Search, 
  Code2,
  GitBranch,
  MoreHorizontal,
  FolderTree,
  Filter,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

import { useConnections, Connection } from "./lib/useConnections";

import { DatabaseExplorer } from "./components/DatabaseExplorer";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { SidebarConnection } from "./components/SidebarConnection";

function App() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [connToDelete, setConnToDelete] = useState<string | null>(null);
  const { connections, loading, removeConnection } = useConnections();
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
  const [shouldOpenCreateModal, setShouldOpenCreateModal] = useState(false);
  const [shouldOpenCreateDbModal, setShouldOpenCreateDbModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const handleSelectConn = (conn: Connection) => {
    if (conn.id !== selectedConn?.id || conn.database !== selectedConn?.database) {
        setSelectedTable(null);
    }
    setSelectedConn(conn);
  };

  const handleCreateAction = (conn: Connection, type: 'table' | 'db' = 'table') => {
    setSelectedConn(conn);
    if (type === 'table') setShouldOpenCreateModal(true);
    else setShouldOpenCreateDbModal(true);
  };

  const handleEdit = (conn: Connection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConn(conn);
    setIsModalOpen(true);
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConn(null);
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (connToDelete) {
      removeConnection(connToDelete);
      if (selectedConn?.id === connToDelete) {
        setSelectedConn(null);
      }
      setIsDeleteOpen(false);
      setConnToDelete(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingConn(null);
  };


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans text-xs">
      <Titlebar />

      <main className="flex-1 flex overflow-hidden">
        {/* MongoDB Compass Style Sidebar */}
        <aside className="w-[280px] hidden lg:flex flex-col border-r border-border/10">
          
          {/* Top Header */}
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <img src="/src/assets/logo.png" alt="Romeu Logo" className="size-8 rounded-lg shadow-lg border border-border/10" />
              <h2 className="text-xl font-bold tracking-tight text-foreground/90 tabular-nums">Romeu SQL</h2>
            </div>
            <Button variant="ghost" size="icon" className="size-8 rounded-lg opacity-40 hover:opacity-100 transition-opacity">
              <Settings size={16} />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3">
            <div className="flex flex-col gap-6 py-2 pb-8">
              
              {/* Main Nav Section */}
              <nav className="flex flex-col gap-0.5">
                <Button 
                    variant="ghost" 
                    className={`justify-start gap-4 h-9 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-lg group ${!selectedConn ? 'bg-primary/5 text-primary' : ''}`}
                    onClick={() => setSelectedConn(null)}
                >
                  <Code2 size={16} className={`opacity-40 group-hover:opacity-100 transition-opacity ${!selectedConn ? 'text-primary' : ''}`} />
                  {t('common.overview')}
                </Button>
                <Button variant="ghost" className="justify-start gap-4 h-9 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-lg group">
                  <GitBranch size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                  {t('common.modeling')}
                </Button>
              </nav>

              <Separator className="opacity-[0.03] mx-3" />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black tracking-[0.1em] text-muted-foreground opacity-60 uppercase">{t('common.connections')}</span>
                    <span className="text-[10px] font-bold text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 tabular-nums">({connections.length})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-6 rounded opacity-40 hover:opacity-100" onClick={() => setIsModalOpen(true)}>
                      <Plus size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-6 rounded opacity-40 hover:opacity-100">
                      <MoreHorizontal size={14} />
                    </Button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="px-3">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Search connections" 
                      className="h-9 pl-9 pr-8 bg-muted/20 border-border/5 text-xs rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20" 
                    />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 size-7 rounded opacity-20 hover:opacity-100">
                      <Filter size={12} />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 px-3">
                  {loading ? (
                    <div className="p-4 flex justify-center">
                      <RefreshCw size={16} className="animate-spin opacity-20" />
                    </div>
                  ) : connections.map((conn) => (
                    <SidebarConnection 
                      key={conn.id}
                      conn={conn}
                      isActive={selectedConn?.id === conn.id}
                      activeDatabase={selectedConn?.id === conn.id ? selectedConn.database : undefined}
                      activeTable={selectedTable || undefined}
                      onSelect={handleSelectConn}
                      onSelectTable={setSelectedTable}
                      onEdit={handleEdit}
                      onDelete={confirmDelete}
                      onDisconnect={handleDisconnect}
                      onCreateAction={(c) => handleCreateAction(c, 'table')}
                      onCreateDatabase={(c) => handleCreateAction(c, 'db')}
                    />
                  ))}
                </div>
              </div>

            </div>
          </ScrollArea>
        </aside>

        {/* Content Area */}
        <ScrollArea className="flex-1 bg-muted/5">
          <motion.div 
            key={selectedConn?.id || 'dashboard'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-6xl mx-auto px-8 py-16"
          >
            {selectedConn ? (
              <DatabaseExplorer 
                connection={selectedConn} 
                onDisconnect={() => setSelectedConn(null)}
                openCreateOnMount={shouldOpenCreateModal}
                openCreateDbOnMount={shouldOpenCreateDbModal}
                selectedTable={selectedTable}
                onTableSelected={setSelectedTable}
                onModalOpened={() => {
                   setShouldOpenCreateModal(false);
                   setShouldOpenCreateDbModal(false);
                }}
              />
            ) : (
              <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-1000">
                <header className="space-y-1">
                  <h1 className="text-4xl font-bold tracking-tight text-foreground/90">{t('dashboard.title')}</h1>
                  <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px] opacity-40">{t('dashboard.subtitle')}</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card 
                    className="relative group transition-all hover:shadow-2xl hover:shadow-primary/5 border-border/5 overflow-hidden cursor-pointer rounded-2xl bg-card/50 backdrop-blur-sm"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <CardHeader className="p-8 pb-4">
                      <div className="size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-6 shadow-xl shadow-primary/20 transition-transform group-hover:scale-105">
                        <Plus size={28} />
                      </div>
                      <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">{t('dashboard.init_node_title')}</CardTitle>
                      <CardDescription className="text-sm font-medium leading-relaxed opacity-60">
                        {t('dashboard.init_node_desc')}
                      </CardDescription>
                    </CardHeader>
                    <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.02] group-hover:opacity-[0.05] transition-all rotate-12 scale-[2.5] pointer-events-none text-primary">
                      <Database size={80} />
                    </div>
                  </Card>
                </div>

                <section className="space-y-6 pt-4">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">{t('dashboard.recent_nodes')}</h2>
                    <Button variant="link" className="text-[10px] font-bold uppercase tracking-widest h-auto p-0 opacity-20 hover:opacity-100 transition-opacity">
                      {t('dashboard.view_registry')} <ExternalLink size={12} className="ml-1" />
                    </Button>
                  </div>

                  <div 
                    className="h-56 rounded-[2rem] border-2 border-dashed border-border/10 bg-muted/5 flex flex-col items-center justify-center gap-6 group cursor-pointer hover:bg-muted/10 transition-all hover:scale-[0.99] active:scale-[0.98]"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <div className="size-16 rounded-3xl border border-border/20 flex items-center justify-center text-muted-foreground/20 group-hover:text-primary/40 group-hover:border-primary/20 transition-all shadow-inner">
                      <FolderTree size={32} />
                    </div>
                    <div className="text-center space-y-1">
                      <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">{t('dashboard.no_nodes')}</span>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/20">Click to deploy your first connection</p>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </motion.div>
        </ScrollArea>
      </main>

      <CreateConnectionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        connectionToEdit={editingConn}
      />

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic uppercase italic tracking-tighter text-destructive">Delete Connection?</DialogTitle>
            <DialogDescription className="text-xs font-medium opacity-60">
              This action cannot be undone. This will permanently delete the connection profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)} className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="text-[10px] font-black uppercase tracking-widest">
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
