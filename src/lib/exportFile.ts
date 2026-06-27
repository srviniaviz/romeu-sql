import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export type ExportFileFormat = "csv" | "json" | "sql" | "txt" | "xls";

function filtersFor(format: ExportFileFormat) {
  return {
    csv: [{ name: "CSV", extensions: ["csv"] }],
    json: [{ name: "JSON", extensions: ["json"] }],
    sql: [{ name: "SQL", extensions: ["sql"] }],
    txt: [{ name: "Text", extensions: ["txt"] }],
    xls: [{ name: "Excel", extensions: ["xls"] }],
  }[format];
}

export async function pickSaveFile({
  defaultPath,
  format,
}: {
  defaultPath: string;
  format: ExportFileFormat;
}) {
  return save({
    defaultPath,
    filters: filtersFor(format),
  });
}

export async function saveTextFile({
  defaultPath,
  contents,
  format,
}: {
  defaultPath: string;
  contents: string;
  format: ExportFileFormat;
}) {
  const filePath = await pickSaveFile({
    defaultPath,
    format,
  });

  if (!filePath) return false;
  await writeTextFile(filePath, contents);
  return true;
}
