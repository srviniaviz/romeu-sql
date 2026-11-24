import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { DownloadCloud, Loader2, Minus, Moon, Settings, Square, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import appIcon from "@/assets/icon.png";
import { checkForUpdates, downloadAndInstallUpdate, type UpdateCheckResult } from "@/lib/updates";
import { useEffect, useState } from "react";
import { loadSettings, updateSettings } from "@/domain/settings/repository";

interface TitlebarProps {
  onOpenSettings: () => void;
}

const toolButtonClass =
  "h-7 w-7 rounded-md p-0 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:translate-y-0";
const windowButtonClass =
  "flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground";

type UpdateStatus = "idle" | "checking" | "downloading" | "available" | "current" | "error";

export function Titlebar({ onOpenSettings }: TitlebarProps) {
  const { theme, setTheme } = useTheme();
  const { i18n, t } = useTranslation();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'pt' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const checkUpdates = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (updateStatus === "checking" || updateStatus === "downloading") return;

    setUpdateStatus("checking");
    try {
      const result = await checkForUpdates();
      setUpdateResult(result);
      if (!result.hasUpdate) {
        setUpdateStatus("current");
        return;
      }

      setUpdateStatus("available");
      setUpdateModalOpen(true);
    } catch {
      setUpdateResult(null);
      setUpdateStatus(silent ? "idle" : "error");
    }
  };

  const installUpdate = async () => {
    if (!updateResult || updateStatus === "downloading") return;
    setUpdateStatus("downloading");
    try {
      await downloadAndInstallUpdate();
      setUpdateStatus("available");
      setUpdateModalOpen(false);
    } catch {
      setUpdateStatus("error");
    }
  };

  useEffect(() => {
    let canceled = false;

    void loadSettings()
      .then((settings) => {
        if (!canceled && settings.updates.autoCheck) {
          void checkUpdates({ silent: true });
        }
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, []);

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
    <>
    <div className="titlebar z-50 border-b border-border bg-chrome text-foreground">
      <div
        data-tauri-drag-region
        className="flex h-full flex-1 items-center gap-2.5 pl-3"
      >
        <img src={appIcon} alt="" className="pointer-events-none size-[18px] rounded-[4px] shadow-xs" draggable={false} />
        <span className="pointer-events-none text-[12.5px] font-semibold tracking-tight">Romeu SQL</span>
      </div>

      <div className="flex h-full items-center">
        <div className="mr-2 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className={toolButtonClass}
            title={t("settings.title")}
            aria-label={t("settings.title")}
          >
            <Settings size={15} strokeWidth={2} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void checkUpdates()}
            className={`relative ${toolButtonClass}`}
            title={
              updateStatus === "available" && updateResult
                ? t("updates.available", { version: updateResult.latestVersion })
                : updateStatus === "downloading" && updateResult
                  ? t("updates.downloading", { version: updateResult.latestVersion })
                : updateStatus === "current" && updateResult
                  ? t("updates.current", { version: updateResult.currentVersion })
                  : updateStatus === "error"
                    ? t("updates.error")
                    : t("updates.check")
            }
          >
            {updateStatus === "checking" || updateStatus === "downloading" ? (
              <Loader2 size={15} className="animate-spin" strokeWidth={2} />
            ) : (
              <DownloadCloud size={15} strokeWidth={2} />
            )}
            {updateStatus === "available" && (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-chrome" />
            )}
            {updateStatus === "error" && (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive ring-2 ring-chrome" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className={`${toolButtonClass} w-auto px-2 text-[11px] font-semibold tracking-wide`}
            title={t("shell.change_language")}
          >
            {i18n.language.startsWith('en') ? 'PT' : 'EN'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleThemeAndSettings();
            }}
            className={toolButtonClass}
            title={theme === 'dark' ? t("shell.switch_to_light") : t("shell.switch_to_dark")}
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
          </Button>
        </div>

        <Separator orientation="vertical" className="h-4" />

        <button type="button" onClick={minimize} className={windowButtonClass} aria-label="Minimize">
          <Minus size={15} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={toggleMaximize} className={windowButtonClass} aria-label="Maximize">
          <Square size={12} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={close}
          className={`${windowButtonClass} hover:bg-[#e81123] hover:text-white`}
          aria-label={t("common.close")}
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>

      <Dialog open={updateModalOpen} onOpenChange={(open) => {
        if (updateStatus !== "downloading") setUpdateModalOpen(open);
      }}>
        <DialogContent showCloseButton={updateStatus !== "downloading"} className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b border-border/50 px-5 py-4">
            <DialogTitle>{t("updates.modal_title")}</DialogTitle>
            <DialogDescription>
              {updateResult
                ? t("updates.modal_description", {
                    currentVersion: updateResult.currentVersion,
                    latestVersion: updateResult.latestVersion,
                  })
                : t("updates.available", { version: "" })}
            </DialogDescription>
          </DialogHeader>

          {updateStatus === "error" && (
            <div className="mx-5 mt-4 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {t("updates.install_error")}
            </div>
          )}

          <DialogFooter className="border-t border-border/50 px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              disabled={updateStatus === "downloading"}
              onClick={() => setUpdateModalOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={updateStatus === "downloading"} onClick={() => void installUpdate()}>
              {updateStatus === "downloading" ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  {t("updates.installing")}
                </>
              ) : (
                t("updates.install")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
