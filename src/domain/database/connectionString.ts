import { Connection } from "../connections/types";

function encode(value?: string) {
  return encodeURIComponent(value || "");
}

export function buildConnectionString(connection: Connection) {
  const { type, host, port, username, password, database } = connection;

  if (type === "postgres") {
    return `postgres://${encode(username)}:${encode(password)}@${host}:${port}/${encode(database)}`;
  }

  if (type === "mysql") {
    return `mysql://${encode(username)}:${encode(password)}@${host}:${port}/${encode(database)}`;
  }

  if (type === "sqlite") {
    return `sqlite:${host}`;
  }

  if (type === "sqlserver") {
    return `sqlserver://${host}:${port};database=${database};user=${username};password=${password || ""}`;
  }

  return "";
}
