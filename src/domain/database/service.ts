import { Connection } from "../connections/types";
import { withDatabase } from "./client";
import { getDialect } from "./dialects";

function ensurePasswordAvailable(connection: Connection) {
  if (connection.type !== "sqlite" && connection.hasSavedPassword === false && !connection.password) {
    throw new Error("No password is saved for this connection. Edit the connection, enter the password, and save it again.");
  }
}

export async function testConnection(connection: Connection) {
  ensurePasswordAvailable(connection);
  await withDatabase(connection, async () => undefined);
}

export async function listDatabases(connection: Connection) {
  if (connection.type === "sqlite") return [connection.database || "main"];
  ensurePasswordAvailable(connection);

  const dialect = getDialect(connection.type);
  const rows = await withDatabase(connection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listDatabases(connection))
  );
  return dialect.normalizeDatabases(rows, connection.database);
}

export async function listTables(connection: Connection) {
  ensurePasswordAvailable(connection);
  const dialect = getDialect(connection.type);
  const rows = await withDatabase(connection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listTables(connection))
  );
  return dialect.normalizeTables(rows);
}

export async function selectRows(connection: Connection, tableName: string, limit = 100) {
  ensurePasswordAvailable(connection);
  const dialect = getDialect(connection.type);
  return withDatabase(connection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.selectRows(tableName, limit))
  );
}

export async function listColumns(connection: Connection, tableName: string) {
  ensurePasswordAvailable(connection);
  const dialect = getDialect(connection.type);
  const rows = await withDatabase(connection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listColumns(tableName))
  );
  return dialect.normalizeColumns(rows);
}

export async function executeSql(connection: Connection, query: string) {
  ensurePasswordAvailable(connection);
  await withDatabase(connection, (db) => db.execute(query));
  return { query };
}

export async function insertRow(
  connection: Connection,
  tableName: string,
  data: Record<string, unknown>
) {
  ensurePasswordAvailable(connection);
  const dialect = getDialect(connection.type);
  const { sql, values } = dialect.insertRow(tableName, data);
  await withDatabase(connection, (db) => db.execute(sql, values));
  return { query: sql };
}

export async function createTable(connection: Connection, query: string) {
  ensurePasswordAvailable(connection);
  await withDatabase(connection, (db) => db.execute(query));
}

export async function createDatabase(connection: Connection, name: string) {
  ensurePasswordAvailable(connection);
  const dialect = getDialect(connection.type);
  await withDatabase(connection, (db) => db.execute(dialect.createDatabase(name)));
}
