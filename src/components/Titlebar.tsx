import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { DownloadCloud, Loader2, Minus, Moon, Settings, Square, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import appIcon from "@/assets/icon.png";
import { checkForUpdates, type UpdateCheckResult } from "@/lib/updates";
import { useState } from "react";
import { loadSettings, updateSettings } from "@/domain/settings/repository";

interface TitlebarProps {
  onOpenSettings: () => void;
}

type UpdateStatus = "idle" | "checking" | "available" | "current" | "error";

export function Titlebar({ onOpenSettings }: TitlebarProps) {
  const { theme, setTheme } = useTheme();
  const { i18n, t } = useTranslation();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'pt' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const checkUpdates = async () => {
    if (updateStatus === "checking") return;
    if (updateStatus === "available" && updateResult?.releaseUrl) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(updateResult.releaseUrl);
      return;
    }

    setUpdateStatus("checking");
    try {
      const result = await checkForUpdates();
      setUpdateResult(result);
      setUpdateStatus(result.hasUpdate ? "available" : "current");
    } catch {
      setUpdateResult(null);
      setUpdateStatus("error");
    }
  };

  const toggleThemeAndSettings = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    void loadSettings()
      .then((settings) =>
        updateSettings({
          appearance: {
            ...settings.appearance,
            theme: nextTheme,
          },
        })
      )
      .catch(() => undefined);
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
          <img src={appIcon} alt="" className="size-4 rounded-[3px]" draggable={false} />
          <span className="text-[13px] font-semibold">Romeu SQL</span>
        </div>
      </div>

      <div className="flex h-full items-center px-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t("settings.title")}
        >
          <Settings size={14} strokeWidth={2.4} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void checkUpdates()}
          className="relative h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={
            updateStatus === "available" && updateResult
              ? t("updates.available", { version: updateResult.latestVersion })
              : updateStatus === "current" && updateResult
                ? t("updates.current", { version: updateResult.currentVersion })
                : updateStatus === "error"
                  ? t("updates.error")
                  : t("updates.check")
          }
        >
          {updateStatus === "checking" ? (
            <Loader2 size={14} className="animate-spin" strokeWidth={2.4} />
          ) : (
            <DownloadCloud size={14} strokeWidth={2.4} />
          )}
          {updateStatus === "available" && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          )}
          {updateStatus === "error" && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1.5" />

        <Button 
          variant="ghost" 
          size="sm"
          onClick={toggleLanguage}
          className="h-8 w-8 p-0 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t("shell.change_language")}
        >
          {i18n.language.startsWith('en') ? 'PT' : 'EN'}
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1.5" />

        <Button 
          variant="ghost" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toggleThemeAndSettings();
          }}
          className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={theme === 'dark' ? t("shell.switch_to_light") : t("shell.switch_to_dark")}
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
