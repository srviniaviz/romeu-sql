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
  { key: "query", icon: TerminalSquare },
  { key: "editor", icon: SlidersHorizontal },
  { key: "dataView", icon: Table2 },
  { key: "connections", icon: Database },
  { key: "security", icon: Lock },
  { key: "appearance", icon: Brush },
  { key: "updates", icon: DownloadCloud },
  { key: "advanced", icon: Settings },
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
                onClick={() => setActiveSection(section.key)}
              />
            ))}
          </nav>
        </aside>

        <main className="min-h-0 overflow-auto py-2">
          <div className="max-w-4xl">
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
              <SettingsGroup>
                <SettingRow title={t("settings.editor.font_size")} description={t("settings.editor.font_size_desc")} control={<NumberInput value={data.editor.fontSize} min={10} max={22} onCommit={(fontSize) => patchSettings({ editor: { ...data.editor, fontSize } })} />} />
                <SettingToggle title={t("settings.editor.autocomplete")} description={t("settings.editor.autocomplete_desc")} checked={data.editor.autocomplete} onChange={(autocomplete) => patchSettings({ editor: { ...data.editor, autocomplete } })} />
                <SettingToggle title={t("settings.editor.format_on_run")} description={t("settings.editor.format_on_run_desc")} checked={data.editor.formatOnRun} onChange={(formatOnRun) => patchSettings({ editor: { ...data.editor, formatOnRun } })} />
                <SettingRow title={t("settings.editor.history_limit")} description={t("settings.editor.history_limit_desc")} control={<NumberInput value={data.editor.historyLimit} min={10} max={1000} onCommit={(historyLimit) => patchSettings({ editor: { ...data.editor, historyLimit } })} />} />
              </SettingsGroup>
            )}

            {activeSection === "dataView" && (
              <SettingsGroup>
                <SettingRow title={t("settings.dataView.default_page_size")} description={t("settings.dataView.default_page_size_desc")} control={<SimpleSelect value={String(data.dataView.defaultPageSize)} options={["10", "25", "50", "100", "250"]} onValueChange={(value) => patchSettings({ dataView: { ...data.dataView, defaultPageSize: Number(value) } })} />} />
                <SettingRow title={t("settings.dataView.default_view_mode")} description={t("settings.dataView.default_view_mode_desc")} control={<SimpleSelect value={data.dataView.defaultViewMode} options={["list", "json", "table"]} onValueChange={(value) => patchSettings({ dataView: { ...data.dataView, defaultViewMode: value as AppSettings["dataView"]["defaultViewMode"] } })} />} />
                <SettingRow title={t("settings.dataView.max_card_fields")} description={t("settings.dataView.max_card_fields_desc")} control={<NumberInput value={data.dataView.maxCardFields} min={4} max={100} onCommit={(maxCardFields) => patchSettings({ dataView: { ...data.dataView, maxCardFields } })} />} />
                <SettingRow title={t("settings.dataView.truncate_length")} description={t("settings.dataView.truncate_length_desc")} control={<NumberInput value={data.dataView.truncateLength} min={40} max={1000} onCommit={(truncateLength) => patchSettings({ dataView: { ...data.dataView, truncateLength } })} />} />
                <SettingRow title={t("settings.dataView.date_display")} description={t("settings.dataView.date_display_desc")} control={<SimpleSelect value={data.dataView.dateDisplay} options={["raw", "local"]} onValueChange={(value) => patchSettings({ dataView: { ...data.dataView, dateDisplay: value as AppSettings["dataView"]["dateDisplay"] } })} />} />
              </SettingsGroup>
            )}

            {activeSection === "connections" && (
              <SettingsGroup>
                <SettingToggle title={t("settings.connections.auto_connect")} description={t("settings.connections.auto_connect_desc")} checked={data.connections.autoConnect} onChange={(autoConnect) => patchSettings({ connections: { ...data.connections, autoConnect } })} />
                <SettingToggle title={t("settings.connections.remember_last_workspace")} description={t("settings.connections.remember_last_workspace_desc")} checked={data.connections.rememberLastWorkspace} onChange={(rememberLastWorkspace) => patchSettings({ connections: { ...data.connections, rememberLastWorkspace } })} />
                <SettingToggle title={t("settings.connections.schema_cache")} description={t("settings.connections.schema_cache_desc")} checked={data.connections.schemaCache} onChange={(schemaCache) => patchSettings({ connections: { ...data.connections, schemaCache } })} />
                <SettingToggle title={t("settings.connections.refresh_metadata")} description={t("settings.connections.refresh_metadata_desc")} checked={data.connections.refreshMetadataOnConnect} onChange={(refreshMetadataOnConnect) => patchSettings({ connections: { ...data.connections, refreshMetadataOnConnect } })} />
              </SettingsGroup>
            )}

            {activeSection === "security" && (
              <SettingsGroup>
                <SettingToggle title={t("settings.security.mask_sensitive")} description={t("settings.security.mask_sensitive_desc")} checked={data.security.maskSensitiveFields} onChange={(maskSensitiveFields) => patchSettings({ security: { ...data.security, maskSensitiveFields } })} />
                <SettingToggle title={t("settings.security.confirm_destructive")} description={t("settings.security.confirm_destructive_desc")} checked={data.security.confirmDestructiveActions} onChange={(confirmDestructiveActions) => patchSettings({ security: { ...data.security, confirmDestructiveActions } })} />
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
  onClick: () => void;
};

function SettingsNavItem({ icon: Icon, label, active, onClick }: SettingsNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}
