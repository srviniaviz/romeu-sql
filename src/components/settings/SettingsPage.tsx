import {
  ArrowLeft,
  Brush,
  Clock3,
  Database,
  DownloadCloud,
  Loader2,
  Lock,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Table2,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/context/ThemeContext";
import { useSettings } from "@/domain/settings/useSettings";
import {
  DEFAULT_QUERY_TIMEOUT_MS,
  DEFAULT_APP_SETTINGS,
  MAX_QUERY_TIMEOUT_MS,
  MIN_QUERY_TIMEOUT_MS,
  clampQueryTimeout,
} from "@/domain/settings/types";
import type { AppSettings } from "@/domain/settings/types";
import { checkForUpdates } from "@/lib/updates";
import { cn } from "@/lib/utils";

const timeoutPresets = [15, 30, 60, 120];
const sections = [
  { key: "query", icon: TerminalSquare, enabled: true },
  { key: "editor", icon: SlidersHorizontal, enabled: true },
  { key: "dataView", icon: Table2, enabled: true },
  { key: "connections", icon: Database, enabled: true },
  { key: "security", icon: Lock, enabled: true },
  { key: "appearance", icon: Brush, enabled: false },
  { key: "updates", icon: DownloadCloud, enabled: false },
  { key: "advanced", icon: Settings, enabled: false },
] as const;

type SettingsSection = (typeof sections)[number]["key"];

type SettingsPageProps = {
  onBack: () => void;
};

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { settings, isLoading, update, reset } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>("query");
  const [timeoutSeconds, setTimeoutSeconds] = useState(DEFAULT_QUERY_TIMEOUT_MS / 1000);
  const [updateStatus, setUpdateStatus] = useState("");

  useEffect(() => {
    if (settings?.query.timeoutMs) {
      setTimeoutSeconds(Math.round(settings.query.timeoutMs / 1000));
    }
  }, [settings?.query.timeoutMs]);

  const savedSeconds = Math.round((settings?.query.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS) / 1000);
  const hasTimeoutChanges = timeoutSeconds !== savedSeconds;
  const minSeconds = MIN_QUERY_TIMEOUT_MS / 1000;
  const maxSeconds = MAX_QUERY_TIMEOUT_MS / 1000;

  const statusText = useMemo(() => {
    if (update.isPending || reset.isPending) return t("settings.saving");
    if (update.isSuccess || reset.isSuccess) return t("settings.saved");
    return t("settings.autosaved_hint");
  }, [reset.isPending, reset.isSuccess, t, update.isPending, update.isSuccess]);

  function patchSettings(next: Partial<AppSettings>) {
    update.mutate(next);
  }

  function saveTimeout(nextSeconds = timeoutSeconds) {
    const timeoutMs = clampQueryTimeout(nextSeconds * 1000);
    setTimeoutSeconds(Math.round(timeoutMs / 1000));
    patchSettings({ query: { ...settingsOrDefault(settings).query, timeoutMs } });
  }

  async function handleCheckUpdates() {
    setUpdateStatus(t("updates.checking"));
    try {
      const result = await checkForUpdates();
      setUpdateStatus(
        result.hasUpdate
          ? t("updates.available", { version: result.latestVersion })
          : t("updates.current", { version: result.currentVersion })
      );
    } catch {
      setUpdateStatus(t("updates.error"));
    }
  }

  const data = settingsOrDefault(settings);

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
            <h1 className="text-[18px] font-semibold tracking-tight">{t("settings.title")}</h1>
            <p className="mt-1 text-[12px] text-muted-foreground">{t("settings.description")}</p>
          </div>
          <span className="text-[11px] text-muted-foreground">{statusText}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[205px_minmax(0,1fr)] gap-10 px-8 pb-8 pt-3">
        <aside className="pt-2">
          <nav className="space-y-1">
            {sections.map((section) => (
              <SettingsNavItem
                key={section.key}
                icon={section.icon}
                label={t(`settings.sections.${section.key}`)}
                active={activeSection === section.key}
                disabled={!section.enabled}
                badge={!section.enabled ? t("settings.coming_soon") : undefined}
                onClick={() => {
                  if (section.enabled) setActiveSection(section.key);
                }}
              />
            ))}
          </nav>
        </aside>

        <main className="min-h-0 overflow-auto py-2">
          <div className="max-w-6xl">
            <SectionIntro
              eyebrow={t(`settings.${activeSection}.eyebrow`)}
              title={t(`settings.${activeSection}.title`)}
              description={t(`settings.${activeSection}.description`)}
            />

            {activeSection === "query" && (
              <SettingsGroup>
                <SettingRow
                  icon={Clock3}
                  title={t("settings.query.timeout_title")}
                  description={t("settings.query.timeout_desc")}
                  control={
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={minSeconds}
                          max={maxSeconds}
                          value={timeoutSeconds}
                          disabled={isLoading || update.isPending}
                          onChange={(event) => setTimeoutSeconds(Number(event.target.value))}
                          onBlur={() => saveTimeout()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveTimeout();
                          }}
                          className="h-9 w-32"
                        />
                        <span className="text-[12px] text-muted-foreground">
                          {t("settings.query.unit_seconds")}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!hasTimeoutChanges || update.isPending}
                          onClick={() => saveTimeout()}
                          className="h-8 px-3 text-[12px]"
                        >
                          {update.isPending ? <Loader2 size={13} className="animate-spin" /> : t("common.save")}
                        </Button>
                      </div>
                      <PresetButtons
                        values={timeoutPresets}
                        selected={timeoutSeconds}
                        onSelect={saveTimeout}
                        format={(value) => t("settings.query.seconds", { count: value })}
                      />
                    </div>
                  }
                />
                <SettingRow
                  title={t("settings.query.default_limit")}
                  description={t("settings.query.default_limit_desc")}
                  control={
                    <NumberInput
                      value={data.query.defaultLimit}
                      min={1}
                      max={10000}
                      onCommit={(value) => patchSettings({ query: { ...data.query, defaultLimit: value } })}
                    />
                  }
                />
                <SettingRow
                  title={t("settings.query.export_format")}
                  description={t("settings.query.export_format_desc")}
                  control={
                    <SimpleSelect
                      value={data.query.exportFormat}
                      options={["csv", "json", "xls"]}
                      onValueChange={(value) => patchSettings({ query: { ...data.query, exportFormat: value as AppSettings["query"]["exportFormat"] } })}
                    />
                  }
                />
                <SettingToggle
                  title={t("settings.query.cancel_on_navigate")}
                  description={t("settings.query.cancel_on_navigate_desc")}
                  checked={data.query.cancelOnNavigate}
                  onChange={(checked) => patchSettings({ query: { ...data.query, cancelOnNavigate: checked } })}
                />
              </SettingsGroup>
            )}

            {activeSection === "editor" && (
              <SettingsPreviewLayout preview={<EditorSettingsPreview settings={data.editor} />}>
                <SettingsGroup>
                  <SettingRow title={t("settings.editor.font_size")} description={t("settings.editor.font_size_desc")} control={<NumberInput value={data.editor.fontSize} min={10} max={22} onCommit={(fontSize) => patchSettings({ editor: { ...data.editor, fontSize } })} />} />
                  <SettingToggle title={t("settings.editor.autocomplete")} description={t("settings.editor.autocomplete_desc")} checked={data.editor.autocomplete} onChange={(autocomplete) => patchSettings({ editor: { ...data.editor, autocomplete } })} />
                  <SettingToggle title={t("settings.editor.format_on_run")} description={t("settings.editor.format_on_run_desc")} checked={data.editor.formatOnRun} onChange={(formatOnRun) => patchSettings({ editor: { ...data.editor, formatOnRun } })} />
                  <SettingRow title={t("settings.editor.history_limit")} description={t("settings.editor.history_limit_desc")} control={<NumberInput value={data.editor.historyLimit} min={10} max={1000} onCommit={(historyLimit) => patchSettings({ editor: { ...data.editor, historyLimit } })} />} />
                </SettingsGroup>
              </SettingsPreviewLayout>
            )}

            {activeSection === "dataView" && (
              <SettingsPreviewLayout preview={<DataViewSettingsPreview settings={data.dataView} />}>
                <SettingsGroup>
                  <SettingRow title={t("settings.dataView.default_page_size")} description={t("settings.dataView.default_page_size_desc")} control={<SimpleSelect value={String(data.dataView.defaultPageSize)} options={["10", "25", "50", "100", "250"]} onValueChange={(value) => patchSettings({ dataView: { ...data.dataView, defaultPageSize: Number(value) } })} />} />
                  <SettingRow title={t("settings.dataView.default_view_mode")} description={t("settings.dataView.default_view_mode_desc")} control={<SimpleSelect value={data.dataView.defaultViewMode} options={["list", "json", "table"]} onValueChange={(value) => patchSettings({ dataView: { ...data.dataView, defaultViewMode: value as AppSettings["dataView"]["defaultViewMode"] } })} />} />
                  <SettingRow title={t("settings.dataView.max_card_fields")} description={t("settings.dataView.max_card_fields_desc")} control={<NumberInput value={data.dataView.maxCardFields} min={4} max={100} onCommit={(maxCardFields) => patchSettings({ dataView: { ...data.dataView, maxCardFields } })} />} />
                  <SettingRow title={t("settings.dataView.truncate_length")} description={t("settings.dataView.truncate_length_desc")} control={<NumberInput value={data.dataView.truncateLength} min={40} max={1000} onCommit={(truncateLength) => patchSettings({ dataView: { ...data.dataView, truncateLength } })} />} />
                  <SettingRow title={t("settings.dataView.date_display")} description={t("settings.dataView.date_display_desc")} control={<SimpleSelect value={data.dataView.dateDisplay} options={["raw", "local"]} onValueChange={(value) => patchSettings({ dataView: { ...data.dataView, dateDisplay: value as AppSettings["dataView"]["dateDisplay"] } })} />} />
                </SettingsGroup>
              </SettingsPreviewLayout>
            )}

            {activeSection === "connections" && (
              <SettingsGroup>
                <SettingToggle title={t("settings.connections.auto_connect")} description={t("settings.connections.auto_connect_desc")} checked={data.connections.autoConnect} onChange={(autoConnect) => patchSettings({ connections: { ...data.connections, autoConnect } })} />
                <SettingToggle title={t("settings.connections.remember_last_workspace")} description={t("settings.connections.remember_last_workspace_desc")} checked={data.connections.rememberLastWorkspace} onChange={(rememberLastWorkspace) => patchSettings({ connections: { ...data.connections, rememberLastWorkspace } })} />
                <SettingToggle title={t("settings.connections.hide_others")} description={t("settings.connections.hide_others_desc")} checked={data.connections.hideOtherConnectionsWhenConnected} onChange={(hideOtherConnectionsWhenConnected) => patchSettings({ connections: { ...data.connections, hideOtherConnectionsWhenConnected } })} />
                <SettingToggle title={t("settings.connections.schema_cache")} description={t("settings.connections.schema_cache_desc")} checked={data.connections.schemaCache} onChange={(schemaCache) => patchSettings({ connections: { ...data.connections, schemaCache } })} />
                <SettingToggle title={t("settings.connections.refresh_metadata")} description={t("settings.connections.refresh_metadata_desc")} checked={data.connections.refreshMetadataOnConnect} onChange={(refreshMetadataOnConnect) => patchSettings({ connections: { ...data.connections, refreshMetadataOnConnect } })} />
              </SettingsGroup>
            )}

            {activeSection === "security" && (
              <SettingsGroup>
                <SettingToggle title={t("settings.security.mask_sensitive")} description={t("settings.security.mask_sensitive_desc")} checked={data.security.maskSensitiveFields} onChange={(maskSensitiveFields) => patchSettings({ security: { ...data.security, maskSensitiveFields } })} />
                <SettingToggle title={t("settings.security.confirm_destructive")} description={t("settings.security.confirm_destructive_desc")} checked={data.security.confirmDestructiveActions} onChange={(confirmDestructiveActions) => patchSettings({ security: { ...data.security, confirmDestructiveActions } })} />
                <SettingToggle title={t("settings.security.allow_delete_rows")} description={t("settings.security.allow_delete_rows_desc")} checked={data.security.allowDeleteRows} onChange={(allowDeleteRows) => patchSettings({ security: { ...data.security, allowDeleteRows } })} />
                <SettingToggle title={t("settings.security.allow_exports")} description={t("settings.security.allow_exports_desc")} checked={data.security.allowExports} onChange={(allowExports) => patchSettings({ security: { ...data.security, allowExports } })} />
                <SettingToggle title={t("settings.security.clear_secrets")} description={t("settings.security.clear_secrets_desc")} checked={data.security.clearSecretsOnDisconnect} onChange={(clearSecretsOnDisconnect) => patchSettings({ security: { ...data.security, clearSecretsOnDisconnect } })} />
              </SettingsGroup>
            )}

            {activeSection === "appearance" && (
              <SettingsGroup>
                <SettingRow title={t("settings.appearance.theme")} description={t("settings.appearance.theme_desc")} control={<SimpleSelect value={theme} options={["light", "dark"]} onValueChange={(value) => { setTheme(value as "light" | "dark"); patchSettings({ appearance: { ...data.appearance, theme: value as AppSettings["appearance"]["theme"] } }); }} />} />
                <SettingRow title={t("settings.appearance.density")} description={t("settings.appearance.density_desc")} control={<SimpleSelect value={data.appearance.density} options={["comfortable", "compact"]} onValueChange={(value) => patchSettings({ appearance: { ...data.appearance, density: value as AppSettings["appearance"]["density"] } })} />} />
                <SettingRow title={t("settings.appearance.font_size")} description={t("settings.appearance.font_size_desc")} control={<NumberInput value={data.appearance.fontSize} min={11} max={18} onCommit={(fontSize) => patchSettings({ appearance: { ...data.appearance, fontSize } })} />} />
              </SettingsGroup>
            )}

            {activeSection === "updates" && (
              <SettingsGroup>
                <SettingToggle title={t("settings.updates.auto_check")} description={t("settings.updates.auto_check_desc")} checked={data.updates.autoCheck} onChange={(autoCheck) => patchSettings({ updates: { ...data.updates, autoCheck } })} />
                <SettingRow title={t("settings.updates.channel")} description={t("settings.updates.channel_desc")} control={<SimpleSelect value={data.updates.channel} options={["alpha", "stable"]} onValueChange={(value) => patchSettings({ updates: { ...data.updates, channel: value as AppSettings["updates"]["channel"] } })} />} />
                <SettingRow title={t("settings.updates.check_now")} description={updateStatus || t("settings.updates.check_now_desc")} control={<Button type="button" variant="secondary" size="sm" onClick={handleCheckUpdates}>{t("updates.check")}</Button>} />
              </SettingsGroup>
            )}

            {activeSection === "advanced" && (
              <SettingsGroup>
                <SettingToggle title={t("settings.advanced.debug_logs")} description={t("settings.advanced.debug_logs_desc")} checked={data.advanced.debugLogs} onChange={(debugLogs) => patchSettings({ advanced: { ...data.advanced, debugLogs } })} />
                <SettingRow title={t("settings.advanced.reset")} description={t("settings.advanced.reset_desc")} control={<Button type="button" variant="outline" size="sm" onClick={() => reset.mutate()}><RotateCcw size={14} />{t("settings.advanced.reset_action")}</Button>} />
              </SettingsGroup>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}

function settingsOrDefault(settings?: AppSettings): AppSettings {
  return settings ?? DEFAULT_APP_SETTINGS;
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="mb-8 space-y-2">
      <p className="text-[12px] font-medium text-primary">{eyebrow}</p>
      <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
      <p className="max-w-2xl text-[13px] leading-6 text-muted-foreground">{description}</p>
    </section>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <div className="space-y-7">{children}</div>;
}

function SettingsPreviewLayout({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,620px)_minmax(320px,430px)]">
      <div className="min-w-0">{children}</div>
      <div className="min-w-0 xl:sticky xl:top-2 xl:self-start">{preview}</div>
    </div>
  );
}

function PreviewShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-muted/25 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/35" />
          <span className="size-2 rounded-full bg-muted-foreground/25" />
          <span className="size-2 rounded-full bg-muted-foreground/15" />
        </div>
      </div>
      {children}
    </div>
  );
}

function EditorSettingsPreview({ settings }: { settings: AppSettings["editor"] }) {
  const query = settings.formatOnRun
    ? ["SELECT id, email, created_at", "FROM user_accounts", "WHERE is_active = true", "ORDER BY created_at DESC", "LIMIT 10;"]
    : ["SELECT id, email, created_at FROM user_accounts WHERE is_active = true ORDER BY created_at DESC LIMIT 10;"];

  return (
    <PreviewShell title="SQL editor preview" subtitle={`${settings.fontSize}px · history ${settings.historyLimit}`}>
      <motion.div
        key={`${settings.fontSize}-${settings.autocomplete}-${settings.formatOnRun}-${settings.historyLimit}`}
        initial={{ opacity: 0.65, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative overflow-hidden rounded-lg bg-[#121212] p-3 text-white"
      >
        <div className="mb-3 flex items-center justify-between text-[10px] text-white/45">
          <span>query.sql</span>
          <span>{settings.autocomplete ? "autocomplete on" : "autocomplete off"}</span>
        </div>
        <div className="space-y-1 font-mono leading-6" style={{ fontSize: settings.fontSize }}>
          {query.map((line, index) => (
            <div key={`${line}-${index}`} className="flex min-w-0 gap-3">
              <span className="w-4 shrink-0 text-right text-white/30">{index + 1}</span>
              <span className="min-w-0 truncate">
                {line
                  .replace("SELECT", "SELECT")
                  .replace("FROM", "FROM")
                  .replace("WHERE", "WHERE")
                  .replace("ORDER BY", "ORDER BY")
                  .replace("LIMIT", "LIMIT")}
              </span>
            </div>
          ))}
        </div>
        {settings.autocomplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.18 }}
            className="absolute right-4 top-16 w-44 rounded-md bg-[#252525] p-1 text-[11px] text-white shadow-xl"
          >
            {["user_accounts", "created_at", "is_active"].map((item, index) => (
              <div key={item} className={cn("rounded px-2 py-1", index === 0 && "bg-white/10")}>
                {item}
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </PreviewShell>
  );
}

function DataViewSettingsPreview({ settings }: { settings: AppSettings["dataView"] }) {
  const fields = [
    ["id", '"ce5510fd..."'],
    ["email", '"user@example.com"'],
    ["status", "ACTIVE"],
    ["createdAt", settings.dateDisplay === "local" ? '"27/06/2026 20:29"' : '"2026-06-27T23:29:05.132Z"'],
    ["bio", `"${truncatePreview("This is a long text value that should respect the configured truncation length.", settings.truncateLength)}"`],
    ["credits", "388.3"],
    ["lastLoginAt", settings.dateDisplay === "local" ? '"27/06/2026 21:03"' : '"2026-06-28T00:03:44.653Z"'],
  ];
  const visibleFields = fields.slice(0, Math.min(fields.length, Math.max(1, settings.maxCardFields)));

  return (
    <PreviewShell title="Data view preview" subtitle={`${settings.defaultPageSize} rows · ${settings.defaultViewMode}`}>
      <motion.div
        key={`${settings.defaultPageSize}-${settings.defaultViewMode}-${settings.maxCardFields}-${settings.truncateLength}-${settings.dateDisplay}`}
        initial={{ opacity: 0.65, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="rounded-lg bg-background p-3"
      >
        <div className="mb-3 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-foreground">user_accounts</span>
          <span className="rounded-md bg-muted/60 px-2 py-1 text-muted-foreground">{settings.defaultPageSize} rows</span>
        </div>

        {settings.defaultViewMode === "table" ? (
          <div className="overflow-hidden rounded-md bg-muted/25 font-mono text-[11px]">
            <div className="grid grid-cols-[32px_1fr_1fr_80px] bg-muted/45 px-2 py-2 text-muted-foreground">
              <span>#</span>
              <span>email</span>
              <span>createdAt</span>
              <span>status</span>
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid grid-cols-[32px_1fr_1fr_80px] px-2 py-2">
                <span className="text-muted-foreground">{row + 1}</span>
                <span className="truncate">"user_{row}@mail.com"</span>
                <span className="truncate text-primary">{settings.dateDisplay === "local" ? "27/06/2026" : "2026-06-27"}</span>
                <span className="text-primary">ACTIVE</span>
              </div>
            ))}
          </div>
        ) : settings.defaultViewMode === "json" ? (
          <pre className="max-h-64 overflow-hidden rounded-md bg-muted/25 p-3 font-mono text-[11px] leading-5 text-foreground">
{`[
  {
    "id": "ce5510fd...",
    "email": "user@example.com",
    "createdAt": ${settings.dateDisplay === "local" ? '"27/06/2026 20:29"' : '"2026-06-27T23:29:05.132Z"'},
    "status": "ACTIVE"
  }
]`}
          </pre>
        ) : (
          <div className="space-y-2">
            {[0, 1].map((row) => (
              <div key={row} className="rounded-md bg-muted/25 p-3 font-mono text-[11px] leading-5">
                {visibleFields.map(([key, value], index) => (
                  <div key={key} className={cn("flex min-w-0 gap-1 rounded px-1", index === 2 && "bg-muted/55")}>
                    <span className="font-semibold text-foreground">{key}</span>
                    <span className="text-muted-foreground">:</span>
                    <span className="min-w-0 truncate text-primary">{row === 1 && key === "email" ? '"another@example.com"' : value}</span>
                  </div>
                ))}
                {fields.length > visibleFields.length && (
                  <button type="button" className="mt-1 px-1 text-[11px] font-medium text-primary">
                    Show {fields.length - visibleFields.length} more fields
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </PreviewShell>
  );
}

function truncatePreview(value: string, length: number) {
  return value.length > length ? `${value.slice(0, Math.max(1, length - 3))}...` : value;
}

function SettingRow({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(220px,320px)] items-start gap-10">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-primary" />}
          <h3 className="text-[14px] font-semibold">{title}</h3>
        </div>
        <p className="max-w-xl text-[12px] leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      control={
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "inline-flex h-7 w-12 items-center rounded-full p-1 transition-colors",
            checked ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "size-5 rounded-full bg-background shadow-sm transition-transform",
              checked && "translate-x-5"
            )}
          />
        </button>
      }
    />
  );
}

function NumberInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function commit() {
    const next = Math.round(Math.min(max, Math.max(min, localValue)));
    setLocalValue(next);
    onCommit(next);
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={localValue}
      onChange={(event) => setLocalValue(Number(event.target.value))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      className="h-9 w-32"
    />
  );
}

function SimpleSelect({
  value,
  options,
  onValueChange,
}: {
  value: string;
  options: string[];
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PresetButtons({
  values,
  selected,
  format,
  onSelect,
}: {
  values: number[];
  selected: number;
  format: (value: number) => string;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className={cn(
            "h-8 rounded-md px-3 text-[12px] font-medium transition-colors",
            selected === value
              ? "bg-primary/10 text-primary"
              : "bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {format(value)}
        </button>
      ))}
    </div>
  );
}

type SettingsNavItemProps = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
};

function SettingsNavItem({ icon: Icon, label, active, disabled, badge, onClick }: SettingsNavItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground"
      )}
    >
      <Icon size={15} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}
