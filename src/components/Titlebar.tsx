import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Database, Minus, Moon, Square, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Titlebar() {
  const { theme, toggleTheme } = useTheme();
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'pt' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const minimize = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  };

  const toggleMaximize = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  };

  const close = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  };

  return (
    <div className="titlebar select-none z-50 flex h-12 items-center justify-between border-b border-border bg-background text-foreground">
      <div 
        data-tauri-drag-region 
        className="flex-1 h-full flex items-center gap-5 px-3"
      >
        <div className="flex items-center gap-2">
          <Database size={16} className="text-primary" />
          <span className="text-[13px] font-semibold">Romeu SQL</span>
        </div>
      </div>

      <div className="flex h-full items-center px-1">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={toggleLanguage}
          className="h-8 w-8 p-0 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Change Language"
        >
          {i18n.language.startsWith('en') ? 'PT' : 'EN'}
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1.5" />

        <Button 
          variant="ghost" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toggleTheme();
          }}
          className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={theme === 'dark' ? "Switch to Light" : "Switch to Dark"}
        >
          {theme === 'dark' ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1.5" />

        <Button variant="ghost" size="sm" onClick={minimize} className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Minus size={14} strokeWidth={2.5} />
        </Button>
        
        <Button variant="ghost" size="sm" onClick={toggleMaximize} className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Square size={12} strokeWidth={2.5} />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={close} 
          className="h-8 w-8 p-0 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <X size={14} strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  );
}
