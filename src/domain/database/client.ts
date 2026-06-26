import Database from "@tauri-apps/plugin-sql";
import { Connection } from "../connections/types";
import { buildConnectionString } from "./connectionString";

export async function withDatabase<T>(
  connection: Connection,
  callback: (db: Database) => Promise<T>
) {
  const db = await Database.load(buildConnectionString(connection));
  try {
    return await callback(db);
  } finally {
    await db.close();
  }
}
