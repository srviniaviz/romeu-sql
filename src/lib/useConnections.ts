import { LazyStore } from "@tauri-apps/plugin-store";
import { useEffect, useState } from "react";

const store = new LazyStore("connections.json");

export interface Connection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password?: string;
  group?: string;
  color?: string;
}

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const saved = await store.get<Connection[]>("registry");
      if (saved) {
        setConnections(saved);
      }
    } catch (error) {
      console.error("Failed to load connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const addConnection = async (conn: Omit<Connection, "id">) => {
    const newConn = { ...conn, id: crypto.randomUUID() };
    const updated = [...connections, newConn];
    await store.set("registry", updated);
    await store.save();
    setConnections(updated);
    return newConn;
  };

  const removeConnection = async (id: string) => {
    const updated = connections.filter(c => c.id !== id);
    await store.set("registry", updated);
    await store.save();
    setConnections(updated);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  return { connections, addConnection, removeConnection, loading, refresh: loadConnections };
}
