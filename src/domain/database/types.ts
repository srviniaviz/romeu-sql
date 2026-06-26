import { Connection, DbEngine } from "../connections/types";

export type { Connection, DbEngine };

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: unknown;
  isPrimaryKey: boolean;
}

export interface Dialect {
  listDatabases(connection: Connection): string;
  listTables(connection: Connection): string;
  listColumns(tableName: string): string;
  createDatabase(name: string): string;
  selectRows(tableName: string, limit: number): string;
  insertRow(tableName: string, data: Record<string, unknown>): {
    sql: string;
    values: unknown[];
  };
  normalizeDatabases(rows: Record<string, unknown>[], fallback: string): string[];
  normalizeTables(rows: Record<string, unknown>[]): string[];
  normalizeColumns(rows: Record<string, unknown>[]): ColumnInfo[];
  quoteIdentifier(identifier: string): string;
}
