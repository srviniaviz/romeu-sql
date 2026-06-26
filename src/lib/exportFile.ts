import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export async function saveTextFile({
  defaultPath,
  contents,
  format,
}: {
  defaultPath: string;
  contents: string;
  format: "csv" | "json" | "sql" | "txt";
}) {
  const filters = {
    csv: [{ name: "CSV", extensions: ["csv"] }],
    json: [{ name: "JSON", extensions: ["json"] }],
    sql: [{ name: "SQL", extensions: ["sql"] }],
    txt: [{ name: "Text", extensions: ["txt"] }],
  }[format];
  const filePath = await save({
    defaultPath,
    filters,
  });

  if (!filePath) return false;
  await writeTextFile(filePath, contents);
  return true;
}
