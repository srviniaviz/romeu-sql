import { Connection, DbEngine } from "../connections/types";
import { ColumnInfo, Dialect, IndexInfo, RowQueryOptions, TableInfo } from "./types";

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

function cleanWhere(whereClause?: string) {
  const trimmed = whereClause?.trim();
  if (!trimmed) return "";
  const withoutWhere = trimmed.replace(/^where\s+/i, "");
  if (/[;]/.test(withoutWhere)) {
    throw new Error("WHERE clause cannot contain semicolons.");
  }
  return ` WHERE ${withoutWhere}`;
}

function parseIdentifierList(value: string | undefined, quote: (identifier: string) => string) {
  const trimmed = value?.trim();
  if (!trimmed) return "*";
  if (/[;()]/.test(trimmed)) throw new Error("Project only accepts column names separated by commas.");
  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => quoteQualified(part, quote))
    .join(", ");
}

function cleanOrderBy(value: string | undefined, quote: (identifier: string) => string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (/[;()]/.test(trimmed)) throw new Error("Sort only accepts column names with optional ASC/DESC.");
  const parts = trimmed
    .split(",")
    .map((part) => {
      const match = part.trim().match(/^([a-zA-Z0-9_.-]+)(?:\s+(asc|desc))?$/i);
      if (!match) throw new Error("Invalid sort option.");
      return `${quoteQualified(match[1], quote)} ${match[2]?.toUpperCase() || "ASC"}`;
    })
    .join(", ");
  return parts ? ` ORDER BY ${parts}` : "";
}

function limitWithOptions(defaultLimit: number, defaultOffset: number, options?: RowQueryOptions) {
  const optionLimit = Number(options?.limit || 0);
  const optionSkip = Number(options?.skip || 0);
  return {
    limit: optionLimit > 0 ? Math.min(defaultLimit, optionLimit) : defaultLimit,
    offset: defaultOffset + (optionSkip > 0 ? optionSkip : 0),
  };
}

function buildSelectRows(
  tableName: string,
  limit: number,
  offset: number,
  whereClause: string | undefined,
  options: RowQueryOptions | undefined,
  quote: (identifier: string) => string,
  paging: (limit: number, offset: number) => string
) {
  const page = limitWithOptions(limit, offset, options);
  return `SELECT ${parseIdentifierList(options?.project, quote)} FROM ${quoteQualified(tableName, quote)}${cleanWhere(whereClause)}${cleanOrderBy(options?.sort, quote)}${paging(page.limit, page.offset)}`;
}

function exactWhere(
  row: Record<string, unknown>,
  quote: (identifier: string) => string,
  placeholder: (index: number) => string
) {
  const values: unknown[] = [];
  const clauses = Object.entries(row).map(([key, value]) => {
    if (value === null || value === undefined) return `${quote(key)} IS NULL`;
    values.push(value);
    return `${quote(key)} = ${placeholder(values.length)}`;
  });

  return {
    clause: clauses.length ? clauses.join(" AND ") : "1 = 0",
    values,
  };
}

function buildUpdate(
  tableName: string,
  original: Record<string, unknown>,
  next: Record<string, unknown>,
  quote: (identifier: string) => string,
  quoteQualifiedIdentifier: (identifier: string) => string,
  placeholder: (index: number) => string
) {
  const values = Object.values(next);
  const assignments = Object.keys(next)
    .map((key, index) => `${quote(key)} = ${placeholder(index + 1)}`)
    .join(", ");
  const where = exactWhere(original, quote, (index) => placeholder(values.length + index));

  return {
    sql: `UPDATE ${quoteQualifiedIdentifier(tableName)} SET ${assignments} WHERE ${where.clause}`,
    values: [...values, ...where.values],
  };
}

function buildDelete(
  tableName: string,
  row: Record<string, unknown>,
  quote: (identifier: string) => string,
  quoteQualifiedIdentifier: (identifier: string) => string,
  placeholder: (index: number) => string
) {
  const where = exactWhere(row, quote, placeholder);
  return {
    sql: `DELETE FROM ${quoteQualifiedIdentifier(tableName)} WHERE ${where.clause}`,
    values: where.values,
  };
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

function boolFrom(value: unknown) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function defaultNormalizeIndexes(rows: Record<string, unknown>[]): IndexInfo[] {
  return rows.map((row) => ({
    name: String(row.name ?? row.indexname ?? row.Key_name ?? row.INDEX_NAME ?? ""),
    columns: String(row.columns ?? row.indexdef ?? row.Column_name ?? row.COLUMN_NAME ?? ""),
    unique: row.Non_unique !== undefined ? Number(row.Non_unique) === 0 : boolFrom(row.unique ?? row.is_unique),
    type: String(row.type ?? row.index_type ?? row.Index_type ?? row.type_desc ?? "index"),
  }));
}

function defaultNormalizeTableStats(rows: Record<string, unknown>[]): TableInfo[] {
  return rows.map((row) => ({
    name: String(row.name ?? row.table_name ?? row.TABLE_NAME ?? ""),
    type: String(row.type ?? row.table_type ?? row.TABLE_TYPE ?? "table").toLowerCase(),
    estimatedRows: numberOrNull(row.estimatedRows ?? row.table_rows ?? row.TABLE_ROWS ?? row.rows),
    totalBytes: numberOrNull(row.totalBytes ?? row.total_bytes ?? row.bytes),
  }));
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
  listIndexes: (tableName) => {
    const pureTable = tableName.replace(/['"`]/g, "").split(".").pop();
    return `SELECT indexname as name, indexdef as columns, indexdef ILIKE '%unique%' as unique, 'btree' as type
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = '${pureTable}'
      ORDER BY indexname`;
  },
  listTableStats: () =>
    `SELECT c.relname as name,
      CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' ELSE 'table' END as type,
      COALESCE(s.n_live_tup, c.reltuples)::bigint as "estimatedRows",
      pg_total_relation_size(c.oid) as "totalBytes"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
    ORDER BY c.relname ASC`,
  createDatabase: (name) => `CREATE DATABASE ${quoteDouble(name)}`,
  countRows: (tableName, whereClause) =>
    `SELECT COUNT(*)::int as count FROM ${quoteQualified(tableName, quoteDouble)}${cleanWhere(whereClause)}`,
  selectRows: (tableName, limit, offset, whereClause, options) =>
    buildSelectRows(tableName, limit, offset, whereClause, options, quoteDouble, (nextLimit, nextOffset) => ` LIMIT ${nextLimit} OFFSET ${nextOffset}`),
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteDouble)} (${Object.keys(data)
      .map(quoteDouble)
      .join(", ")}) VALUES (${Object.keys(data).map((_, index) => `$${index + 1}`).join(", ")})`,
    values: Object.values(data),
  }),
  updateRow: (tableName, original, next) =>
    buildUpdate(tableName, original, next, quoteDouble, (identifier) => quoteQualified(identifier, quoteDouble), (index) => `$${index}`),
  deleteRow: (tableName, row) =>
    buildDelete(tableName, row, quoteDouble, (identifier) => quoteQualified(identifier, quoteDouble), (index) => `$${index}`),
  explainRows: (tableName, whereClause) =>
    `EXPLAIN SELECT * FROM ${quoteQualified(tableName, quoteDouble)}${cleanWhere(whereClause)} LIMIT 25`,
  normalizeDatabases: (rows) => namesFrom(rows, ["name", "datname"]),
  normalizeTables: (rows) => namesFrom(rows, ["name", "table_name"]),
  normalizeColumns: defaultNormalizeColumns,
  normalizeIndexes: defaultNormalizeIndexes,
  normalizeTableStats: defaultNormalizeTableStats,
  quoteIdentifier: quoteDouble,
};

const mysqlDialect: Dialect = {
  listDatabases: () => "SHOW DATABASES",
  listTables: () => "SHOW TABLES",
  listColumns: (tableName) => `DESCRIBE ${quoteQualified(tableName, quoteBacktick)}`,
  listIndexes: (tableName) => `SHOW INDEX FROM ${quoteQualified(tableName, quoteBacktick)}`,
  listTableStats: () =>
    `SELECT table_name as name, table_type as type, table_rows as estimatedRows, data_length + index_length as totalBytes
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    ORDER BY table_name ASC`,
  createDatabase: (name) => `CREATE DATABASE ${quoteBacktick(name)}`,
  countRows: (tableName, whereClause) =>
    `SELECT COUNT(*) as count FROM ${quoteQualified(tableName, quoteBacktick)}${cleanWhere(whereClause)}`,
  selectRows: (tableName, limit, offset, whereClause, options) =>
    buildSelectRows(tableName, limit, offset, whereClause, options, quoteBacktick, (nextLimit, nextOffset) => ` LIMIT ${nextLimit} OFFSET ${nextOffset}`),
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteBacktick)} (${Object.keys(data)
      .map(quoteBacktick)
      .join(", ")}) VALUES (${Object.keys(data).map(() => "?").join(", ")})`,
    values: Object.values(data),
  }),
  updateRow: (tableName, original, next) =>
    buildUpdate(tableName, original, next, quoteBacktick, (identifier) => quoteQualified(identifier, quoteBacktick), () => "?"),
  deleteRow: (tableName, row) =>
    buildDelete(tableName, row, quoteBacktick, (identifier) => quoteQualified(identifier, quoteBacktick), () => "?"),
  explainRows: (tableName, whereClause) =>
    `EXPLAIN SELECT * FROM ${quoteQualified(tableName, quoteBacktick)}${cleanWhere(whereClause)} LIMIT 25`,
  normalizeDatabases: (rows) => namesFrom(rows, ["name", "Database"]),
  normalizeTables: (rows) => namesFrom(rows, ["name", "table_name"]),
  normalizeColumns: defaultNormalizeColumns,
  normalizeIndexes: defaultNormalizeIndexes,
  normalizeTableStats: defaultNormalizeTableStats,
  quoteIdentifier: quoteBacktick,
};

const sqliteDialect: Dialect = {
  listDatabases: (connection: Connection) => `SELECT '${connection.database || "main"}' as name`,
  listTables: () => "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC",
  listColumns: (tableName) => `PRAGMA table_info(${quoteQualified(tableName, quoteDouble)})`,
  listIndexes: (tableName) => `PRAGMA index_list(${quoteQualified(tableName, quoteDouble)})`,
  listTableStats: () => "SELECT name, type, NULL as estimatedRows, NULL as totalBytes FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name ASC",
  createDatabase: (name) => `ATTACH DATABASE ${quoteDouble(name)} AS ${quoteDouble(name)}`,
  countRows: (tableName, whereClause) =>
    `SELECT COUNT(*) as count FROM ${quoteQualified(tableName, quoteDouble)}${cleanWhere(whereClause)}`,
  selectRows: (tableName, limit, offset, whereClause, options) =>
    buildSelectRows(tableName, limit, offset, whereClause, options, quoteDouble, (nextLimit, nextOffset) => ` LIMIT ${nextLimit} OFFSET ${nextOffset}`),
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteDouble)} (${Object.keys(data)
      .map(quoteDouble)
      .join(", ")}) VALUES (${Object.keys(data).map(() => "?").join(", ")})`,
    values: Object.values(data),
  }),
  updateRow: (tableName, original, next) =>
    buildUpdate(tableName, original, next, quoteDouble, (identifier) => quoteQualified(identifier, quoteDouble), () => "?"),
  deleteRow: (tableName, row) =>
    buildDelete(tableName, row, quoteDouble, (identifier) => quoteQualified(identifier, quoteDouble), () => "?"),
  explainRows: (tableName, whereClause) =>
    `EXPLAIN QUERY PLAN SELECT * FROM ${quoteQualified(tableName, quoteDouble)}${cleanWhere(whereClause)} LIMIT 25`,
  normalizeDatabases: (_rows, fallback) => [fallback || "main"],
  normalizeTables: (rows) => namesFrom(rows, ["name"]),
  normalizeColumns: defaultNormalizeColumns,
  normalizeIndexes: defaultNormalizeIndexes,
  normalizeTableStats: defaultNormalizeTableStats,
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
  listIndexes: (tableName) => {
    const pureTable = tableName.replace(/['"`[\]]/g, "").split(".").pop();
    return `SELECT i.name, COL_NAME(ic.object_id, ic.column_id) as columns, i.is_unique as unique, i.type_desc as type
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.tables t ON t.object_id = i.object_id
      WHERE t.name = '${pureTable}' AND i.name IS NOT NULL
      ORDER BY i.name`;
  },
  listTableStats: () =>
    `SELECT t.name, 'table' as type, SUM(p.rows) as estimatedRows, SUM(a.total_pages) * 8192 as totalBytes
    FROM sys.tables t
    JOIN sys.indexes i ON t.object_id = i.object_id
    JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
    JOIN sys.allocation_units a ON p.partition_id = a.container_id
    GROUP BY t.name
    ORDER BY t.name ASC`,
  createDatabase: (name) => `CREATE SCHEMA ${quoteBracket(name)}`,
  countRows: (tableName, whereClause) =>
    `SELECT COUNT(*) as count FROM ${quoteQualified(tableName, quoteBracket)}${cleanWhere(whereClause)}`,
  selectRows: (tableName, limit, offset, whereClause, options) =>
    buildSelectRows(
      tableName,
      limit,
      offset,
      whereClause,
      options,
      quoteBracket,
      (nextLimit, nextOffset) => `${options?.sort?.trim() ? "" : " ORDER BY (SELECT NULL)"} OFFSET ${nextOffset} ROWS FETCH NEXT ${nextLimit} ROWS ONLY`
    ),
  insertRow: (tableName, data) => ({
    sql: `INSERT INTO ${quoteQualified(tableName, quoteBracket)} (${Object.keys(data)
      .map(quoteBracket)
      .join(", ")}) VALUES (${Object.keys(data).map((_, index) => `@P${index + 1}`).join(", ")})`,
    values: Object.values(data),
  }),
  updateRow: (tableName, original, next) =>
    buildUpdate(tableName, original, next, quoteBracket, (identifier) => quoteQualified(identifier, quoteBracket), (index) => `@P${index}`),
  deleteRow: (tableName, row) =>
    buildDelete(tableName, row, quoteBracket, (identifier) => quoteQualified(identifier, quoteBracket), (index) => `@P${index}`),
  explainRows: (tableName, whereClause) =>
    `SELECT * FROM ${quoteQualified(tableName, quoteBracket)}${cleanWhere(whereClause)} ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY`,
  normalizeDatabases: (rows) => namesFrom(rows, ["name"]),
  normalizeTables: (rows) => namesFrom(rows, ["name", "TABLE_NAME"]),
  normalizeColumns: defaultNormalizeColumns,
  normalizeIndexes: defaultNormalizeIndexes,
  normalizeTableStats: defaultNormalizeTableStats,
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
