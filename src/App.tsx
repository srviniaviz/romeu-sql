import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Titlebar } from "./components/Titlebar";
import { CreateConnectionModal } from "./components/CreateConnection";
import { 
  Plus, 
  Settings, 
  LayoutGrid, 
  Database, 
  Search, 
  DatabaseZap, 
  ExternalLink 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";

function App() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sidebarItems = [
    { icon: <LayoutGrid size={18} />, label: t('common.overview'), active: true },
    { icon: <Database size={18} />, label: t('common.nodes'), active: false },
    { icon: <Search size={18} />, label: t('common.search'), active: false },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <Titlebar />

      <main className="flex-1 flex overflow-hidden">
        {/* Modern Sidebar */}
        <aside className="w-64 hidden lg:flex flex-col border-r border-border/10 bg-muted/30 p-4 gap-6">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <DatabaseZap size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Romeu SQL</span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-60">Professional</span>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {sidebarItems.map((item, i) => (
              <Button
                key={i}
                variant={item.active ? "secondary" : "ghost"}
                className={`justify-start gap-3 h-10 px-3 ${item.active ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}`}
              >
                {item.icon}
                <span className="text-xs font-semibold uppercase tracking-widest">{item.label}</span>
              </Button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-1">
            <Separator className="mb-4 opacity-50" />
            <Button variant="ghost" className="justify-start gap-3 h-10 px-3">
              <Settings size={18} />
              <span className="text-xs font-semibold uppercase tracking-widest">{t('common.settings')}</span>
            </Button>
          </div>
        </aside>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto px-8 py-16 space-y-12"
          >
            <header className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px] opacity-60">{t('dashboard.subtitle')}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card 
                className="relative group transition-all hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 border-muted-foreground/10 overflow-hidden cursor-pointer"
                onClick={() => setIsModalOpen(true)}
              >
                <CardHeader className="p-8 pb-4">
                  <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                    <Plus size={24} />
                  </div>
                  <CardTitle className="text-xl font-bold">{t('dashboard.init_node_title')}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed max-w-[200px]">
                    {t('dashboard.init_node_desc')}
                  </CardDescription>
                </CardHeader>
                <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] group-hover:opacity-[0.08] transition-all rotate-12 scale-[2] pointer-events-none">
                  <Database size={80} />
                </div>
              </Card>

            </div>

            <section className="space-y-6 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-60">{t('dashboard.recent_nodes')}</h2>
                <Button variant="link" className="text-[10px] font-bold uppercase tracking-widest h-auto p-0 opacity-40 hover:opacity-100 transition-opacity">
                  {t('dashboard.view_registry')} <ExternalLink size={12} className="ml-1" />
                </Button>
              </div>

              <div 
                className="h-44 rounded-2xl border-2 border-dashed border-muted-foreground/10 bg-muted/5 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => setIsModalOpen(true)}
              >
                <div className="size-12 rounded-full border border-muted-foreground/20 flex items-center justify-center text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
                  <Database size={24} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">{t('dashboard.no_nodes')}</span>
              </div>
            </section>
          </motion.div>
        </ScrollArea>
      </main>

      <CreateConnectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default App;
