import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Minus, Square, X, Sun, Moon } from "lucide-react";
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
    <div className="titlebar select-none z-50 flex items-center justify-between h-10 border-b border-border/10 bg-background/50 backdrop-blur-md">
      <div 
        data-tauri-drag-region 
        className="flex-1 h-full flex items-center px-4"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">Romeu SQL</span>
      </div>

      <div className="flex h-full items-center px-1">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={toggleLanguage}
          className="h-8 w-8 p-0 font-bold text-[10px] uppercase tracking-tighter"
          title="Change Language"
        >
          {i18n.language.startsWith('en') ? 'PT' : 'EN'}
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1.5 opacity-20" />

        <Button 
          variant="ghost" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toggleTheme();
          }}
          className="h-8 w-8 p-0"
          title={theme === 'dark' ? "Switch to Light" : "Switch to Dark"}
        >
          {theme === 'dark' ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1.5 opacity-20" />

        <Button variant="ghost" size="sm" onClick={minimize} className="h-8 w-8 p-0">
          <Minus size={14} strokeWidth={2.5} />
        </Button>
        
        <Button variant="ghost" size="sm" onClick={toggleMaximize} className="h-8 w-8 p-0">
          <Square size={12} strokeWidth={2.5} />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={close} 
          className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <X size={14} strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  );
}
