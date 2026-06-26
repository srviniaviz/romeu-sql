import { LazyStore } from "@tauri-apps/plugin-store";
import { Connection, NewConnection, StoredConnection } from "./types";
import {
  getConnectionPassword,
  removeConnectionPassword,
  setConnectionPassword,
} from "./secretsRepository";

const store = new LazyStore("connections.json");
const REGISTRY_KEY = "registry";

function withoutPassword(conn: Connection): StoredConnection {
  const { password: _password, ...profile } = conn;
  return {
    ...profile,
    hasSavedPassword: !!conn.password && conn.savePassword !== false,
  };
}

async function persistProfiles(profiles: StoredConnection[]) {
  await store.set(REGISTRY_KEY, profiles);
  await store.save();
}

async function readProfiles() {
  return (await store.get<Array<StoredConnection | Connection>>(REGISTRY_KEY)) || [];
}

export async function listConnections(): Promise<Connection[]> {
  const profiles = await readProfiles();
  let needsMigration = false;

  const hydrated = await Promise.all(
    profiles.map(async (raw) => {
      const conn = raw as Connection;

      if (conn.password) {
        needsMigration = true;
        await setConnectionPassword(conn.id, conn.password);
        return withoutPassword(conn);
      }

      return raw as StoredConnection;
    })
  );

  if (needsMigration) {
    await persistProfiles(hydrated);
  }

  return hydrated.map((profile) => ({
    ...profile,
    hasSavedPassword: !!profile.hasSavedPassword,
    password: undefined,
  }));
}

export async function hydrateConnectionSecrets(connection: Connection): Promise<Connection> {
  if (connection.type === "sqlite" || connection.password || !connection.hasSavedPassword) {
    return connection;
  }

  const password = await getConnectionPassword(connection.id);
  return {
    ...connection,
    hasSavedPassword: !!password,
    password,
  };
}

export async function addConnection(conn: NewConnection): Promise<Connection> {
  const id = crypto.randomUUID();
  const newConn: Connection = { ...conn, id };
  const current = await readProfiles();

  if (conn.password && conn.savePassword !== false) {
    await setConnectionPassword(id, conn.password);
  }

  const next = [...current.filter((item) => item.id !== id), newConn].map(withoutPassword);
  await persistProfiles(next);
  return newConn;
}

export async function updateConnection(id: string, updates: Partial<Connection>) {
  const current = await readProfiles();
  const existing = current.find((conn) => conn.id === id);
  if (!existing) return;

  const updated: Connection = { ...existing, ...updates, id };
  const shouldSavePassword = updated.savePassword !== false && !!updated.password;

  if (shouldSavePassword) {
    await setConnectionPassword(id, updated.password || "");
  } else {
    await removeConnectionPassword(id);
  }

  const next = current.map((conn) => (conn.id === id ? updated : conn)).map(withoutPassword);
  await persistProfiles(next);
}

export async function removeConnection(id: string) {
  const current = await readProfiles();
  await persistProfiles(current.filter((conn) => conn.id !== id).map(withoutPassword));
  await removeConnectionPassword(id);
}
