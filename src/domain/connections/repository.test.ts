import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredConnection } from "./types";

const mocks = vi.hoisted(() => ({
  registry: [] as StoredConnection[],
  setConnectionPassword: vi.fn(),
  getConnectionPassword: vi.fn(),
  removeConnectionPassword: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: vi.fn(function LazyStore() {
    return {
      get: vi.fn(async () => mocks.registry),
      set: vi.fn(async (_key: string, value: StoredConnection[]) => {
        mocks.registry = value;
      }),
      save: vi.fn(async () => undefined),
    };
  }),
}));

vi.mock("./secretsRepository", () => ({
  getConnectionPassword: mocks.getConnectionPassword,
  removeConnectionPassword: mocks.removeConnectionPassword,
  setConnectionPassword: mocks.setConnectionPassword,
}));

import { addConnection, updateConnection, getConnectionString } from "./repository";

const storedConnection: StoredConnection = {
  id: "existing",
  name: "existing",
  type: "postgres",
  host: "localhost",
  port: "5432",
  database: "postgres",
  username: "postgres",
  savePassword: true,
  sslMode: "disable",
  hasSavedPassword: true,
};

describe("connections repository", () => {
  beforeEach(() => {
    mocks.registry = [{ ...storedConnection }];
    mocks.getConnectionPassword.mockReset();
    mocks.removeConnectionPassword.mockReset();
    mocks.setConnectionPassword.mockReset();
  });

  it("keeps saved password metadata for existing profiles when adding a connection", async () => {
    await addConnection({
      name: "new",
      type: "postgres",
      host: "localhost",
      port: "5432",
      database: "products",
      username: "postgres",
      password: "postgres",
      savePassword: true,
      sslMode: "disable",
    });

    expect(mocks.registry.find((connection) => connection.id === "existing")?.hasSavedPassword).toBe(true);
    expect(mocks.registry.find((connection) => connection.name === "new")?.hasSavedPassword).toBe(true);
  });

  it("does not remove an existing saved password when updating profile fields only", async () => {
    await updateConnection("existing", { name: "renamed" });

    expect(mocks.removeConnectionPassword).not.toHaveBeenCalled();
    expect(mocks.registry.find((connection) => connection.id === "existing")).toMatchObject({
      name: "renamed",
      hasSavedPassword: true,
    });
  });

  describe("getConnectionString", () => {
    it("formats postgres connection correctly with credentials encoded", () => {
      const conn: any = {
        type: "postgres",
        username: "user@example.com",
        password: "p@ss word",
        host: "127.0.0.1",
        port: "5432",
        database: "mydb",
      };
      const result = getConnectionString(conn);
      expect(result).toBe("postgresql://user%40example.com:p%40ss%20word@127.0.0.1:5432/mydb");
    });

    it("formats mysql connection correctly", () => {
      const conn: any = {
        type: "mysql",
        username: "root",
        password: "password",
        host: "localhost",
        port: "3306",
        database: "sys",
      };
      const result = getConnectionString(conn);
      expect(result).toBe("mysql://root:password@localhost:3306/sys");
    });

    it("formats sqlite connection string using path as host", () => {
      const conn: any = {
        type: "sqlite",
        host: "/users/documents/local.db",
      };
      const result = getConnectionString(conn);
      expect(result).toBe("sqlite:/users/documents/local.db");
    });
  });
});
