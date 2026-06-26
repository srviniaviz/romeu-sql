import { invoke } from "@tauri-apps/api/core";
import { hydrateConnectionSecrets } from "../connections/repository";
import { Connection } from "../connections/types";
import type {
  ClusterPermissionInfo,
  ClusterUserInfo,
  ColumnInfo,
  IndexInfo,
  RowQueryOptions,
  TableInfo,
} from "./types";

async function prepareConnection(connection: Connection) {
  const hydrated = await hydrateConnectionSecrets(connection);
  if (hydrated.type !== "sqlite" && !hydrated.password) {
    throw new Error("No password is saved for this connection. Edit the connection, enter the password, and save it again.");
  }
  return hydrated;
}

async function dbInvoke<T>(command: string, connection: Connection, args: Record<string, unknown> = {}) {
  const readyConnection = await prepareConnection(connection);
  return invoke<T>(command, {
    connection: readyConnection,
    ...args,
  });
}

export async function testConnection(connection: Connection) {
  await dbInvoke<void>("db_test_connection", connection);
}

export async function listDatabases(connection: Connection) {
  return dbInvoke<string[]>("db_list_databases", connection);
}

export async function listTables(connection: Connection) {
  return dbInvoke<string[]>("db_list_tables", connection);
}

export async function listTableStats(connection: Connection) {
  return dbInvoke<TableInfo[]>("db_list_table_stats", connection);
}

export async function listClusterUsers(connection: Connection) {
  return dbInvoke<ClusterUserInfo[]>("db_list_cluster_users", connection);
}

export async function listClusterPermissions(connection: Connection) {
  return dbInvoke<ClusterPermissionInfo[]>("db_list_cluster_permissions", connection);
}

export async function selectRows(connection: Connection, tableName: string, limit = 100) {
  return selectRowsPage(connection, tableName, limit, 0);
}

export async function selectRowsPage(
  connection: Connection,
  tableName: string,
  limit: number,
  offset: number,
  whereClause = "",
  options?: RowQueryOptions
) {
  return dbInvoke<Record<string, unknown>[]>("db_select_rows_page", connection, {
    tableName,
    limit,
    offset,
    whereClause,
    options,
  });
}

export async function countRows(connection: Connection, tableName: string, whereClause = "") {
  return dbInvoke<number>("db_count_rows", connection, { tableName, whereClause });
}

export async function explainRows(connection: Connection, tableName: string, whereClause = "") {
  return dbInvoke<Record<string, unknown>[]>("db_explain_rows", connection, { tableName, whereClause });
}

export async function listColumns(connection: Connection, tableName: string) {
  return dbInvoke<ColumnInfo[]>("db_list_columns", connection, { tableName });
}

export async function listIndexes(connection: Connection, tableName: string) {
  return dbInvoke<IndexInfo[]>("db_list_indexes", connection, { tableName });
}

export async function executeSql(connection: Connection, query: string) {
  const executedQuery = await dbInvoke<string>("db_execute_sql", connection, { query });
  return { query: executedQuery };
}

export async function selectQuery(connection: Connection, query: string) {
  return dbInvoke<Record<string, unknown>[]>("db_select_query", connection, { query });
}

export async function insertRow(
  connection: Connection,
  tableName: string,
  data: Record<string, unknown>
) {
  const query = await dbInvoke<string>("db_insert_row", connection, { tableName, data });
  return { query };
}

export async function updateRow(
  connection: Connection,
  tableName: string,
  original: Record<string, unknown>,
  next: Record<string, unknown>
) {
  const query = await dbInvoke<string>("db_update_row", connection, { tableName, original, next });
  return { query };
}

export async function deleteRow(
  connection: Connection,
  tableName: string,
  row: Record<string, unknown>
) {
  const query = await dbInvoke<string>("db_delete_row", connection, { tableName, row });
  return { query };
}

export async function createTable(connection: Connection, query: string) {
  await dbInvoke<void>("db_create_table", connection, { query });
}

export async function createDatabase(connection: Connection, name: string) {
  await dbInvoke<void>("db_create_database", connection, { name });
}
