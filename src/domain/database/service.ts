import { Connection } from "../connections/types";
import { hydrateConnectionSecrets } from "../connections/repository";
import { withDatabase } from "./client";
import { getDialect } from "./dialects";
import type { RowQueryOptions } from "./types";

async function prepareConnection(connection: Connection) {
  const hydrated = await hydrateConnectionSecrets(connection);
  if (hydrated.type !== "sqlite" && !hydrated.password) {
    throw new Error("No password is saved for this connection. Edit the connection, enter the password, and save it again.");
  }
  return hydrated;
}

export async function testConnection(connection: Connection) {
  const readyConnection = await prepareConnection(connection);
  await withDatabase(readyConnection, async () => undefined);
}

export async function listDatabases(connection: Connection) {
  if (connection.type === "sqlite") return [connection.database || "main"];
  const readyConnection = await prepareConnection(connection);

  const dialect = getDialect(readyConnection.type);
  const rows = await withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listDatabases(readyConnection))
  );
  return dialect.normalizeDatabases(rows, readyConnection.database);
}

export async function listTables(connection: Connection) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const rows = await withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listTables(readyConnection))
  );
  return dialect.normalizeTables(rows);
}

export async function listTableStats(connection: Connection) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const rows = await withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listTableStats())
  );
  return dialect.normalizeTableStats(rows);
}

export async function selectRows(connection: Connection, tableName: string, limit = 100) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  return withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.selectRows(tableName, limit, 0))
  );
}

export async function selectRowsPage(
  connection: Connection,
  tableName: string,
  limit: number,
  offset: number,
  whereClause = "",
  options?: RowQueryOptions
) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  return withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.selectRows(tableName, limit, offset, whereClause, options))
  );
}

export async function countRows(connection: Connection, tableName: string, whereClause = "") {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const rows = await withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.countRows(tableName, whereClause))
  );
  const firstRow = rows[0] || {};
  const value =
    firstRow.count ??
    firstRow.COUNT ??
    firstRow["COUNT(*)"] ??
    Object.values(firstRow)[0] ??
    0;

  return Number(value) || 0;
}

export async function explainRows(connection: Connection, tableName: string, whereClause = "") {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  return withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.explainRows(tableName, whereClause))
  );
}

export async function listColumns(connection: Connection, tableName: string) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const rows = await withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listColumns(tableName))
  );
  return dialect.normalizeColumns(rows);
}

export async function listIndexes(connection: Connection, tableName: string) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const rows = await withDatabase(readyConnection, (db) =>
    db.select<Record<string, unknown>[]>(dialect.listIndexes(tableName))
  );
  return dialect.normalizeIndexes(rows);
}

export async function executeSql(connection: Connection, query: string) {
  const readyConnection = await prepareConnection(connection);
  await withDatabase(readyConnection, (db) => db.execute(query));
  return { query };
}

export async function selectQuery(connection: Connection, query: string) {
  const readyConnection = await prepareConnection(connection);
  const trimmed = query.trim();
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Query tab only runs SELECT/WITH statements.");
  }
  return withDatabase(readyConnection, (db) => db.select<Record<string, unknown>[]>(trimmed));
}

export async function insertRow(
  connection: Connection,
  tableName: string,
  data: Record<string, unknown>
) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const { sql, values } = dialect.insertRow(tableName, data);
  await withDatabase(readyConnection, (db) => db.execute(sql, values));
  return { query: sql };
}

export async function updateRow(
  connection: Connection,
  tableName: string,
  original: Record<string, unknown>,
  next: Record<string, unknown>
) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const { sql, values } = dialect.updateRow(tableName, original, next);
  await withDatabase(readyConnection, (db) => db.execute(sql, values));
  return { query: sql };
}

export async function deleteRow(
  connection: Connection,
  tableName: string,
  row: Record<string, unknown>
) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  const { sql, values } = dialect.deleteRow(tableName, row);
  await withDatabase(readyConnection, (db) => db.execute(sql, values));
  return { query: sql };
}

export async function createTable(connection: Connection, query: string) {
  const readyConnection = await prepareConnection(connection);
  await withDatabase(readyConnection, (db) => db.execute(query));
}

export async function createDatabase(connection: Connection, name: string) {
  const readyConnection = await prepareConnection(connection);
  const dialect = getDialect(readyConnection.type);
  await withDatabase(readyConnection, (db) => db.execute(dialect.createDatabase(name)));
}
