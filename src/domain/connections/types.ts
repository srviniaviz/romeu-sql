export type DbEngine = "postgres" | "mysql" | "sqlite" | "sqlserver";

export interface Connection {
  id: string;
  name: string;
  type: DbEngine;
  host: string;
  port: string;
  database: string;
  username: string;
  password?: string;
  group?: string;
  color?: string;
  comment?: string;
  savePassword?: boolean;
  sslMode?: string;
  hasSavedPassword?: boolean;
}

export type NewConnection = Omit<Connection, "id">;

export type StoredConnection = Omit<Connection, "password"> & {
  hasSavedPassword?: boolean;
};
