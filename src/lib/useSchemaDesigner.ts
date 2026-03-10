import { useState, useMemo } from 'react';

export interface Column {
  id: string;
  name: string;
  type: string;
  isPrimary: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue: string;
}

export type DbEngine = 'postgres' | 'mysql' | 'sqlite' | 'sqlserver';

export function useSchemaDesigner(dbType: DbEngine) {
  const [tableName, setTableName] = useState("");

  const getDefaultIdType = (type: DbEngine) => {
    switch (type) {
      case 'postgres': return 'SERIAL';
      case 'mysql': return 'INT AUTO_INCREMENT';
      case 'sqlite': return 'INTEGER PRIMARY KEY';
      case 'sqlserver': return 'INT IDENTITY(1,1)';
      default: return 'INT';
    }
  };

  const [columns, setColumns] = useState<Column[]>([
    {
      id: '1',
      name: 'id',
      type: getDefaultIdType(dbType),
      isPrimary: true,
      isNullable: false,
      isUnique: false,
      defaultValue: ''
    }
  ]);

  const commonTypes = useMemo(() => {
    switch (dbType) {
      case 'postgres':
        return ['SERIAL', 'INTEGER', 'BIGINT', 'VARCHAR(255)', 'TEXT', 'BOOLEAN', 'TIMESTAMP', 'JSONB', 'UUID', 'DECIMAL', 'REAL'];
      case 'mysql':
        return ['INT', 'INT AUTO_INCREMENT', 'BIGINT', 'VARCHAR(255)', 'TEXT', 'BOOL', 'DATETIME', 'JSON', 'DECIMAL', 'FLOAT'];
      case 'sqlite':
        return ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC'];
      case 'sqlserver':
        return ['INT', 'INT IDENTITY(1,1)', 'BIGINT', 'VARCHAR(255)', 'NVARCHAR(MAX)', 'BIT', 'DATETIME2', 'DECIMAL', 'MONEY'];
      default:
        return ['INT', 'VARCHAR(255)', 'TEXT'];
    }
  }, [dbType]);

  const addColumn = () => {
    setColumns(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      type: dbType === 'sqlite' ? 'TEXT' : 'VARCHAR(255)',
      isPrimary: false,
      isNullable: true,
      isUnique: false,
      defaultValue: ''
    }]);
  };

  const removeColumn = (id: string) => {
    if (columns.length > 1) {
      setColumns(prev => prev.filter(c => c.id !== id));
    }
  };

  const updateColumn = (id: string, updates: Partial<Column>) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const generatedSql = useMemo(() => {
    if (!tableName.trim()) return "-- Define table name to preview SQL";

    let sql = `CREATE TABLE ${tableName} (\n`;

    const colDefs = columns.map(c => {
      let def = `  ${c.name.trim() || '[column_name]'} ${c.type}`;

      // Special handling for SQLite Primary Key (it must be defining during column def for AUTOINC behavior)
      if (c.isPrimary && dbType === 'sqlite') {
        return def;
      }

      if (c.isPrimary) def += ' PRIMARY KEY';
      if (!c.isNullable) def += ' NOT NULL';
      if (c.isUnique) def += ' UNIQUE';
      if (c.defaultValue.trim()) def += ` DEFAULT ${c.defaultValue}`;

      return def;
    });

    sql += colDefs.join(',\n');
    sql += '\n);';
    return sql;
  }, [tableName, columns, dbType]);

  const reset = () => {
    setTableName("");
    setColumns([{
      id: '1',
      name: 'id',
      type: getDefaultIdType(dbType),
      isPrimary: true,
      isNullable: false,
      isUnique: false,
      defaultValue: ''
    }]);
  };

  return {
    tableName,
    setTableName,
    columns,
    addColumn,
    removeColumn,
    updateColumn,
    commonTypes,
    generatedSql,
    reset
  };
}
