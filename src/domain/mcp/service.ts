import { invoke } from "@tauri-apps/api/core";
import { hydrateConnectionSecrets } from "../connections/repository";
import type { Connection } from "../connections/types";
import type { McpAccess } from "../settings/types";

export interface McpStatus {
  running: boolean;
  port: number | null;
  url: string | null;
}

export interface McpSyncResult {
  shared: number;
  skippedWithoutPassword: string[];
}

export const mcpStatusQueryKey = ["mcp-status"] as const;

export function generateMcpToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function mcpUrl(port: number) {
  return `http://127.0.0.1:${port}/mcp`;
}

export function claudeCodeCommand(port: number, token: string) {
  return `claude mcp add --transport http romeu-sql ${mcpUrl(port)} --header "Authorization: Bearer ${token}"`;
}

export const CODEX_TOKEN_ENV_VAR = "ROMEU_SQL_MCP_TOKEN";

/** Codex reads the bearer token from an environment variable, so the token is stored first. */
export function codexCommands(port: number, token: string) {
  return [
    `setx ${CODEX_TOKEN_ENV_VAR} "${token}"`,
    `codex mcp add romeu-sql --url ${mcpUrl(port)} --bearer-token-env-var ${CODEX_TOKEN_ENV_VAR}`,
  ].join("\n");
}

export function mcpJsonConfig(port: number, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        "romeu-sql": {
          type: "http",
          url: mcpUrl(port),
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2
  );
}

export interface SharedConnection {
  connection: Connection;
  access: McpAccess;
}

export async function syncMcpConnections(shared: SharedConnection[]): Promise<McpSyncResult> {
  const accessById = new Map(shared.map((item) => [item.connection.id, item.access]));
  const hydrated = await Promise.all(shared.map((item) => hydrateConnectionSecrets(item.connection)));
  const ready = hydrated.filter((connection) => connection.type === "sqlite" || !!connection.password);
  const skippedWithoutPassword = hydrated
    .filter((connection) => connection.type !== "sqlite" && !connection.password)
    .map((connection) => connection.name);

  await invoke<number>("mcp_set_connections", {
    connections: ready.map((connection) => ({
      id: connection.id,
      name: connection.name,
      access: accessById.get(connection.id) ?? "read",
      type: connection.type,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password ?? null,
    })),
  });
  return { shared: ready.length, skippedWithoutPassword };
}

export function startMcpServer(options: { port: number; token: string; maxRows: number; queryTimeoutMs: number }) {
  return invoke<McpStatus>("mcp_start", options);
}

export function stopMcpServer() {
  return invoke<McpStatus>("mcp_stop");
}

export function getMcpStatus() {
  return invoke<McpStatus>("mcp_status");
}
