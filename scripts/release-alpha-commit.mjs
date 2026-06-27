import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const bump = process.argv[2] || "patch";
const versionFiles = [
  "package.json",
  "package-lock.json",
  path.join("src-tauri", "Cargo.toml"),
  path.join("src-tauri", "tauri.conf.json"),
].filter((filePath) => fs.existsSync(path.join(root, filePath)));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

const version = run(process.execPath, [path.join("scripts", "bump-alpha-version.mjs"), bump]).trim();

run("git", ["add", ...versionFiles], { stdio: "inherit" });
run("git", ["commit", "--allow-empty", "-m", `[RELEASE] v${version}`], { stdio: "inherit" });

console.log(`Created release commit for v${version}`);
