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

import { addConnection, updateConnection } from "./repository";

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
});
