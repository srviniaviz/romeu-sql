import { ArrowLeft, Clock3, Loader2, Settings, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSettings } from "@/domain/settings/useSettings";
import {
  DEFAULT_QUERY_TIMEOUT_MS,
  MAX_QUERY_TIMEOUT_MS,
  MIN_QUERY_TIMEOUT_MS,
  clampQueryTimeout,
} from "@/domain/settings/types";

const timeoutPresets = [15, 30, 60, 120];

type SettingsPageProps = {
  onBack: () => void;
};

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  const { settings, isLoading, updateQuery } = useSettings();
  const [timeoutSeconds, setTimeoutSeconds] = useState(DEFAULT_QUERY_TIMEOUT_MS / 1000);

  useEffect(() => {
    if (settings?.query.timeoutMs) {
      setTimeoutSeconds(Math.round(settings.query.timeoutMs / 1000));
    }
  }, [settings?.query.timeoutMs]);

  const savedSeconds = Math.round((settings?.query.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS) / 1000);
  const hasChanges = timeoutSeconds !== savedSeconds;
  const minSeconds = MIN_QUERY_TIMEOUT_MS / 1000;
  const maxSeconds = MAX_QUERY_TIMEOUT_MS / 1000;

  const statusText = useMemo(() => {
    if (updateQuery.isPending) return t("settings.saving");
    if (updateQuery.isSuccess && !hasChanges) return t("settings.saved");
    return t("settings.autosaved_hint");
  }, [hasChanges, t, updateQuery.isPending, updateQuery.isSuccess]);

  function saveTimeout(nextSeconds = timeoutSeconds) {
    const timeoutMs = clampQueryTimeout(nextSeconds * 1000);
    setTimeoutSeconds(Math.round(timeoutMs / 1000));
    updateQuery.mutate({ timeoutMs });
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="shrink-0 px-8 py-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            aria-label={t("settings.back_workspace")}
            title={t("settings.back_workspace")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={15} />
          </Button>
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-semibold tracking-tight">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t("settings.description")}
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[190px_minmax(0,1fr)] gap-10 px-8 py-4">
        <aside className="pt-2">
          <nav className="space-y-1">
            <SettingsNavItem icon={TerminalSquare} label={t("settings.query.title")} active />
          </nav>
        </aside>

        <main className="min-h-0 overflow-auto py-2">
          <div className="max-w-3xl space-y-8">
            <section className="space-y-2">
              <p className="text-[12px] font-medium text-primary">{t("settings.query.eyebrow")}</p>
              <h2 className="text-[22px] font-semibold tracking-tight">
                {t("settings.query.title")}
              </h2>
              <p className="max-w-2xl text-[13px] leading-6 text-muted-foreground">
                {t("settings.query.description")}
              </p>
            </section>

            <section className="space-y-5">
              <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock3 size={16} className="text-primary" />
                    <h3 className="text-[14px] font-semibold">
                      {t("settings.query.timeout_title")}
                    </h3>
                  </div>
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    {t("settings.query.timeout_desc")}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {timeoutPresets.map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => saveTimeout(seconds)}
                        className={cn(
                          "h-8 rounded-md px-3 text-[12px] font-medium transition-colors",
                          timeoutSeconds === seconds
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {t("settings.query.seconds", { count: seconds })}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="query-timeout">{t("settings.query.timeout_field")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="query-timeout"
                      type="number"
                      min={minSeconds}
                      max={maxSeconds}
                      value={timeoutSeconds}
                      disabled={isLoading || updateQuery.isPending}
                      onChange={(event) => setTimeoutSeconds(Number(event.target.value))}
                      onBlur={() => saveTimeout()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveTimeout();
                      }}
                      className="h-10"
                    />
                    <span className="text-[12px] text-muted-foreground">
                      {t("settings.query.unit_seconds")}
                    </span>
                  </div>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {t("settings.query.range", { min: minSeconds, max: maxSeconds })}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {updateQuery.isPending && <Loader2 size={13} className="animate-spin" />}
                      {statusText}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!hasChanges || updateQuery.isPending}
                      onClick={() => saveTimeout()}
                      className="h-8 rounded-md px-4 text-[12px]"
                    >
                      {t("common.save")}
                    </Button>
                  </div>
                  {updateQuery.error && (
                    <p className="text-[12px] text-destructive">
                      {String(updateQuery.error.message || updateQuery.error)}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </section>
  );
}

type SettingsNavItemProps = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
};

function SettingsNavItem({ icon: Icon, label, active, disabled }: SettingsNavItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground"
      )}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}
