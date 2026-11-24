import { useState } from "react";
import { AlertTriangle, Check, Copy, Eye, EyeOff, PencilLine, RefreshCw, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useConnections } from "@/domain/connections/useConnections";
import { claudeCodeCommand, codexCommands, generateMcpToken, mcpJsonConfig, mcpUrl } from "@/domain/mcp/service";
import { useMcpRuntime } from "@/domain/mcp/useMcpServer";
import type { AppSettings, McpAccess } from "@/domain/settings/types";
import { cn } from "@/lib/utils";
import { NumberInput, SettingRow, SettingToggle } from "./SettingControls";

type SetupTab = "claude" | "codex" | "json";
type AccessChoice = McpAccess | "off";
const ACCESS_CHOICES: AccessChoice[] = ["off", "read", "write"];

interface McpSettingsSectionProps {
  settings: AppSettings["mcp"];
  onChange: (next: AppSettings["mcp"]) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 px-2 text-[11px]"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          toast({ title: t("settings.mcp.copied"), variant: "success" });
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {label}
    </Button>
  );
}

export function McpSettingsSection({ settings, onChange }: McpSettingsSectionProps) {
  const { t } = useTranslation();
  const { connections } = useConnections();
  const runtime = useMcpRuntime();
  const [showToken, setShowToken] = useState(false);
  const [setupTab, setSetupTab] = useState<SetupTab>("claude");

  const patch = (next: Partial<AppSettings["mcp"]>) => onChange({ ...settings, ...next });
  const token = settings.token;
  const maskedToken = token ? `${token.slice(0, 4)}${"•".repeat(Math.max(0, token.length - 8))}${token.slice(-4)}` : "";
  const running = runtime.status?.running ?? false;
  const skipped = runtime.sync?.skippedWithoutPassword ?? [];

  const setAccess = (id: string, choice: AccessChoice) => {
    const permissions = { ...settings.permissions };
    if (choice === "off") delete permissions[id];
    else permissions[id] = choice;
    patch({ permissions });
  };
  const setupText = (value: string) =>
    setupTab === "claude"
      ? claudeCodeCommand(settings.port, value)
      : setupTab === "codex"
        ? codexCommands(settings.port, value)
        : mcpJsonConfig(settings.port, value);

  return (
    <div className="space-y-7">
      <SettingToggle
        title={t("settings.mcp.enabled")}
        description={t("settings.mcp.enabled_desc")}
        checked={settings.enabled}
        onChange={(enabled) => patch({ enabled, token: enabled && !token ? generateMcpToken() : token })}
      />

      {settings.enabled && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12px]",
            runtime.error
              ? "border-destructive/30 bg-destructive/[0.06] text-destructive"
              : running
                ? "border-emerald-500/30 bg-emerald-500/[0.06] text-foreground"
                : "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "mt-1 size-2 shrink-0 rounded-full",
              runtime.error ? "bg-destructive" : running ? "bg-emerald-500" : "bg-muted-foreground/50"
            )}
          />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">
              {runtime.error
                ? t("settings.mcp.status_error")
                : running
                  ? t("settings.mcp.status_running")
                  : t("settings.mcp.status_starting")}
            </p>
            {runtime.error ? (
              <p className="break-words">{runtime.error}</p>
            ) : running ? (
              <p className="font-mono text-[11.5px] text-muted-foreground">{runtime.status?.url}</p>
            ) : null}
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-[14px] font-semibold">{t("settings.mcp.connections")}</h3>
          <p className="max-w-2xl text-[12px] leading-5 text-muted-foreground">{t("settings.mcp.connections_desc")}</p>
        </div>
        {connections.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">{t("settings.mcp.no_connections")}</p>
        ) : (
          <div className="max-w-3xl divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {connections.map((connection) => {
              const access = (settings.permissions[connection.id] as McpAccess | undefined) ?? ("off" as AccessChoice);
              const missingPassword = access !== "off" && skipped.includes(connection.name);
              return (
                <div key={connection.id} className="flex items-center gap-4 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{connection.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {connection.type} · {connection.database}
                    </p>
                    {missingPassword && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={11} />
                        {t("settings.mcp.no_password")}
                      </p>
                    )}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={t("settings.mcp.access_for", { name: connection.name })}
                    className="flex shrink-0 rounded-md bg-muted p-0.5"
                  >
                    {ACCESS_CHOICES.map((choice) => {
                      const selected = access === choice;
                      return (
                        <button
                          key={choice}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setAccess(connection.id, choice)}
                          className={cn(
                            "flex h-7 items-center gap-1 rounded px-2.5 text-[11.5px] font-medium transition-colors",
                            !selected && "text-muted-foreground hover:text-foreground",
                            selected && choice === "off" && "bg-card text-foreground shadow-sm dark:bg-white/10",
                            selected && choice === "read" && "bg-primary text-primary-foreground shadow-sm",
                            selected && choice === "write" && "bg-amber-500 text-white shadow-sm dark:bg-amber-600"
                          )}
                        >
                          {choice === "write" && <PencilLine size={11} />}
                          {t(`settings.mcp.access_${choice}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {Object.values(settings.permissions).includes("write") && (
          <p className="flex max-w-3xl items-start gap-1.5 text-[11.5px] leading-5 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={12} className="mt-1 shrink-0" />
            {t("settings.mcp.write_warning")}
          </p>
        )}
      </section>

      <SettingRow
        title={t("settings.mcp.port")}
        description={t("settings.mcp.port_desc")}
        control={<NumberInput value={settings.port} min={1024} max={65535} onCommit={(port) => patch({ port })} />}
      />

      <SettingRow
        title={t("settings.mcp.max_rows")}
        description={t("settings.mcp.max_rows_desc")}
        control={<NumberInput value={settings.maxRows} min={1} max={5000} onCommit={(maxRows) => patch({ maxRows })} />}
      />

      <SettingRow
        title={t("settings.mcp.token")}
        description={t("settings.mcp.token_desc")}
        control={
          token ? (
            <div className="space-y-2">
              <div className="flex h-9 items-center rounded-md border border-input bg-card px-2.5 shadow-xs">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{showToken ? token : maskedToken}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={() => setShowToken((value) => !value)}
                  aria-label={showToken ? t("settings.mcp.hide") : t("settings.mcp.show")}
                  title={showToken ? t("settings.mcp.hide") : t("settings.mcp.show")}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
              <div className="flex gap-2">
                <CopyButton value={token} label={t("settings.mcp.copy")} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-[11px]"
                  onClick={() => patch({ token: generateMcpToken() })}
                >
                  <RefreshCw size={12} />
                  {t("settings.mcp.regenerate")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">{t("settings.mcp.token_after_enable")}</p>
          )
        }
      />

      {token && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-[14px] font-semibold">{t("settings.mcp.setup")}</h3>
            <p className="max-w-2xl text-[12px] leading-5 text-muted-foreground">{t("settings.mcp.setup_desc")}</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2 py-1.5">
              <div className="flex rounded-md bg-muted p-0.5">
                {(["claude", "codex", "json"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSetupTab(tab)}
                    className={cn(
                      "h-6 rounded px-2.5 text-[11.5px] font-medium transition-colors",
                      setupTab === tab ? "bg-card text-foreground shadow-sm dark:bg-white/10" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "claude" ? t("settings.mcp.claude_code") : tab === "codex" ? t("settings.mcp.codex") : t("settings.mcp.json_config")}
                  </button>
                ))}
              </div>
              <CopyButton value={setupText(token)} label={t("settings.mcp.copy")} />
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 py-2.5 font-mono text-[11.5px] leading-5 text-foreground">
              {setupText(showToken ? token : maskedToken)}
            </pre>
            {setupTab === "codex" && (
              <p className="border-t border-border px-3 py-2 text-[11.5px] leading-5 text-muted-foreground">
                {t("settings.mcp.codex_hint")}
              </p>
            )}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">{mcpUrl(settings.port)}</p>
        </section>
      )}

      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-[12px] leading-5 text-muted-foreground">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" />
        <p>{t("settings.mcp.read_only_note")}</p>
      </div>
    </div>
  );
}
