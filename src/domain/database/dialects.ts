import { Connection, DbEngine } from "../connections/types";
import { ColumnInfo, Dialect } from "./types";

function firstValue(row: Record<string, unknown>) {
  return Object.values(row)[0];
}

function namesFrom(rows: Record<string, unknown>[], keys: string[]) {
  return rows
    .map((row) => keys.map((key) => row[key]).find(Boolean) ?? firstValue(row))
    .filter((value): value is string | number => value !== undefined && value !== null)
    .map(String);
}

function quoteDouble(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteBacktick(identifier: string) {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

function quoteBracket(identifier: string) {
  return `[${identifier.replace(/]/g, "]]")}]`;
}

function quoteQualified(identifier: string, quote: (part: string) => string) {
  return identifier
    .split(".")
    .map((part) => quote(part.replace(/['"`[\]]/g, "")))
    .join(".");
}

function defaultNormalizeColumns(rows: Record<string, unknown>[]): ColumnInfo[] {
  return rows.map((row) => {
    const name = row.name || row.column_name || row.Field || row.COLUMN_NAME;
    const type = row.type || row.data_type || row.Type || row.DATA_TYPE;
    const defaultValue = row.defaultValue || row.Default || row.COLUMN_DEFAULT;
    const isPrimaryKey =
      row.pk === 1 ||
      row.Key === "PRI" ||
      row.is_identity === 1 ||
      (defaultValue ? String(defaultValue).toLowerCase().includes("nextval") : false);

    return {
      name: String(name || ""),
      type: String(type || ""),
      nullable:
        row.nullable === "YES" ||
        row.Null === "YES" ||
        row.IS_NULLABLE === "YES" ||
        row.notnull === 0 ||
        row.pk === 0,
      defaultValue,
      isPrimaryKey,
    };
  });
}

const postgresDialect: Dialect = {
  listDatabases: () =>
    "SELECT datname as name FROM pg_database WHERE datistemplate = false ORDER BY datname ASC",
  listTables: () =>
    "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC",
  listColumns: (tableName) => {
    const pureTable = tableName.replace(/['"`]/g, "").split(".").pop();
    return `SELECT column_name as name, data_type as type, is_nullable as nullable, column_default as "defaultValue"
      FROM information_schema.columns
      WHERE table_name = '${pureTable}'
      ORDER BY ordinal_position`;
  },
  createDatabase: (name) => `CREATE DATABASE ${quoteDouble(name)}`,
  selectRows: (tableName, limit) =>
    `SELECT * FROM ${quoteQualified(tableName, quoteDouble)} LIMIT ${limit}`,
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteDouble)} (${Object.keys(data)
      .map(quoteDouble)
      .join(", ")}) VALUES (${Object.keys(data).map((_, index) => `$${index + 1}`).join(", ")})`,
    values: Object.values(data),
  }),
  normalizeDatabases: (rows) => namesFrom(rows, ["name", "datname"]),
  normalizeTables: (rows) => namesFrom(rows, ["name", "table_name"]),
  normalizeColumns: defaultNormalizeColumns,
  quoteIdentifier: quoteDouble,
};

const mysqlDialect: Dialect = {
  listDatabases: () => "SHOW DATABASES",
  listTables: () => "SHOW TABLES",
  listColumns: (tableName) => `DESCRIBE ${quoteQualified(tableName, quoteBacktick)}`,
  createDatabase: (name) => `CREATE DATABASE ${quoteBacktick(name)}`,
  selectRows: (tableName, limit) =>
    `SELECT * FROM ${quoteQualified(tableName, quoteBacktick)} LIMIT ${limit}`,
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteBacktick)} (${Object.keys(data)
      .map(quoteBacktick)
      .join(", ")}) VALUES (${Object.keys(data).map(() => "?").join(", ")})`,
    values: Object.values(data),
  }),
  normalizeDatabases: (rows) => namesFrom(rows, ["name", "Database"]),
  normalizeTables: (rows) => namesFrom(rows, ["name", "table_name"]),
  normalizeColumns: defaultNormalizeColumns,
  quoteIdentifier: quoteBacktick,
};

const sqliteDialect: Dialect = {
  listDatabases: (connection: Connection) => `SELECT '${connection.database || "main"}' as name`,
  listTables: () => "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC",
  listColumns: (tableName) => `PRAGMA table_info(${quoteQualified(tableName, quoteDouble)})`,
  createDatabase: (name) => `ATTACH DATABASE ${quoteDouble(name)} AS ${quoteDouble(name)}`,
  selectRows: (tableName, limit) =>
    `SELECT * FROM ${quoteQualified(tableName, quoteDouble)} LIMIT ${limit}`,
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteDouble)} (${Object.keys(data)
      .map(quoteDouble)
      .join(", ")}) VALUES (${Object.keys(data).map(() => "?").join(", ")})`,
    values: Object.values(data),
  }),
  normalizeDatabases: (_rows, fallback) => [fallback || "main"],
  normalizeTables: (rows) => namesFrom(rows, ["name"]),
  normalizeColumns: defaultNormalizeColumns,
  quoteIdentifier: quoteDouble,
};

const sqlserverDialect: Dialect = {
  listDatabases: () =>
    "SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name ASC",
  listTables: () =>
    "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME ASC",
  listColumns: (tableName) => {
    const pureTable = tableName.replace(/['"`[\]]/g, "").split(".").pop();
    return `SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as nullable, COLUMN_DEFAULT as defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${pureTable}'`;
  },
  createDatabase: (name) => `CREATE SCHEMA ${quoteBracket(name)}`,
  selectRows: (tableName, limit) =>
    `SELECT TOP ${limit} * FROM ${quoteQualified(tableName, quoteBracket)}`,
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteBracket)} (${Object.keys(data)
      .map(quoteBracket)
      .join(", ")}) VALUES (${Object.keys(data).map((_, index) => `@P${index + 1}`).join(", ")})`,
    values: Object.values(data),
  }),
  normalizeDatabases: (rows) => namesFrom(rows, ["name"]),
  normalizeTables: (rows) => namesFrom(rows, ["name", "TABLE_NAME"]),
  normalizeColumns: defaultNormalizeColumns,
  quoteIdentifier: quoteBracket,
};

const dialects: Record<DbEngine, Dialect> = {
  postgres: postgresDialect,
  mysql: mysqlDialect,
  sqlite: sqliteDialect,
  sqlserver: sqlserverDialect,
};

export function getDialect(engine: DbEngine) {
  return dialects[engine];
}
