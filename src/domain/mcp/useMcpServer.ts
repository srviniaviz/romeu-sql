import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection } from "../connections/types";
import type { AppSettings } from "../settings/types";
import { startMcpServer, stopMcpServer, syncMcpConnections, type McpStatus, type McpSyncResult } from "./service";

export interface McpRuntimeState {
  status: McpStatus | null;
  sync: McpSyncResult | null;
  error: string | null;
}

const mcpRuntimeQueryKey = ["mcp-runtime"] as const;
const EMPTY_RUNTIME: McpRuntimeState = { status: null, sync: null, error: null };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Keeps the native MCP server in step with settings and the shared connection list. */
export function useMcpServer(connections: Connection[], settings: AppSettings) {
  const queryClient = useQueryClient();
  const { enabled, port, token, maxRows, permissions } = settings.mcp;
  const queryTimeoutMs = settings.query.timeoutMs;
  const active = enabled && token.length >= 16;

  const shared = useMemo(
    () =>
      connections
        .filter((connection) => permissions[connection.id])
        .map((connection) => ({ connection, access: permissions[connection.id] })),
    [connections, permissions]
  );
  const sharedKey = shared
    .map(({ connection: c, access }) => [c.id, access, c.name, c.type, c.host, c.port, c.database, c.username, c.hasSavedPassword].join("|"))
    .join(",");

  useEffect(() => {
    const patch = (next: Partial<McpRuntimeState>) =>
      queryClient.setQueryData<McpRuntimeState>(mcpRuntimeQueryKey, (current) => ({ ...(current ?? EMPTY_RUNTIME), ...next }));
    let canceled = false;

    async function apply() {
      try {
        if (!active) {
          const status = await stopMcpServer();
          if (!canceled) patch({ status, error: null });
          return;
        }
        const status = await startMcpServer({ port, token, maxRows, queryTimeoutMs });
        if (!canceled) patch({ status, error: null });
      } catch (error) {
        if (!canceled) patch({ status: { running: false, port: null, url: null }, error: errorMessage(error) });
      }
    }

    void apply();
    return () => {
      canceled = true;
    };
  }, [active, port, token, maxRows, queryTimeoutMs, queryClient]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sharedKey captures the fields that matter
  useEffect(() => {
    if (!active) return;
    let canceled = false;
    syncMcpConnections(shared)
      .then((sync) => {
        if (!canceled) queryClient.setQueryData<McpRuntimeState>(mcpRuntimeQueryKey, (current) => ({ ...(current ?? EMPTY_RUNTIME), sync }));
      })
      .catch((error) => {
        if (!canceled) queryClient.setQueryData<McpRuntimeState>(mcpRuntimeQueryKey, (current) => ({ ...(current ?? EMPTY_RUNTIME), error: errorMessage(error) }));
      });
    return () => {
      canceled = true;
    };
  }, [active, sharedKey, queryClient]);
}

export function useMcpRuntime() {
  const { data } = useQuery({
    queryKey: mcpRuntimeQueryKey,
    queryFn: () => EMPTY_RUNTIME,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ?? EMPTY_RUNTIME;
}
