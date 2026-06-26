import { Connection, DbEngine } from "../connections/types";

export type { Connection, DbEngine };

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: unknown;
  isPrimaryKey: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string;
  unique: boolean;
  type: string;
}

export interface TableInfo {
  name: string;
  type: string;
  estimatedRows: number | null;
  totalBytes: number | null;
}

export interface ClusterUserInfo {
  name: string;
  role: string;
  canLogin: boolean;
  isAdmin: boolean;
}

export interface ClusterPermissionInfo {
  principal: string;
  objectName: string;
  privilege: string;
}

export interface RowQueryOptions {
  project?: string;
  sort?: string;
  skip?: number;
  limit?: number;
}

export interface Dialect {
  listDatabases(connection: Connection): string;
  listTables(connection: Connection): string;
  listColumns(tableName: string): string;
  listIndexes(tableName: string): string;
  listTableStats(): string;
  listClusterUsers(): string;
  listClusterPermissions(): string;
  createDatabase(name: string): string;
  countRows(tableName: string, whereClause?: string): string;
  selectRows(tableName: string, limit: number, offset: number, whereClause?: string, options?: RowQueryOptions): string;
  insertRow(tableName: string, data: Record<string, unknown>): {
    sql: string;
    values: unknown[];
  };
  updateRow(tableName: string, original: Record<string, unknown>, next: Record<string, unknown>): {
    sql: string;
    values: unknown[];
  };
  deleteRow(tableName: string, row: Record<string, unknown>): {
    sql: string;
    values: unknown[];
  };
  explainRows(tableName: string, whereClause?: string): string;
  normalizeDatabases(rows: Record<string, unknown>[], fallback: string): string[];
  normalizeTables(rows: Record<string, unknown>[]): string[];
  normalizeColumns(rows: Record<string, unknown>[]): ColumnInfo[];
  normalizeIndexes(rows: Record<string, unknown>[]): IndexInfo[];
  normalizeTableStats(rows: Record<string, unknown>[]): TableInfo[];
  normalizeClusterUsers(rows: Record<string, unknown>[]): ClusterUserInfo[];
  normalizeClusterPermissions(rows: Record<string, unknown>[]): ClusterPermissionInfo[];
  quoteIdentifier(identifier: string): string;
}
