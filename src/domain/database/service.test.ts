import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { clearDatabaseMetadataCache, listTables } from "./service";
import type { Connection } from "../connections/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../connections/repository", () => ({
  hydrateConnectionSecrets: vi.fn(async (connection: Connection) => ({
    ...connection,
    password: connection.password || "postgres",
  })),
}));

vi.mock("../settings/repository", () => ({
  loadSettings: vi.fn(async () => ({
    query: {
      timeoutMs: 60000,
    },
  })),
}));

const connection: Connection = {
  id: "test-connection",
  name: "test",
  type: "postgres",
  host: "localhost",
  port: "5432",
  database: "postgres",
  username: "postgres",
  password: "postgres",
  savePassword: true,
  hasSavedPassword: true,
};

describe("database service metadata cache", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(["products"]);
    clearDatabaseMetadataCache();
  });

  it("reuses an in-flight metadata request for the same connection scope", async () => {
    const [first, second] = await Promise.all([
      listTables(connection),
      listTables(connection),
    ]);

    expect(first).toEqual(["products"]);
    expect(second).toEqual(["products"]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("db_list_tables", expect.objectContaining({
      connection: expect.objectContaining({ id: connection.id, password: "postgres" }),
      queryTimeoutMs: 60000,
    }));
  });

  it("reloads metadata when force is requested", async () => {
    await listTables(connection);
    await listTables(connection, { force: true });

    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
