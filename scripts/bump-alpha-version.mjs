import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const releasePrefix = "alpha";
const versionArg = process.argv[2] || "patch";
const validBumps = new Set(["patch", "minor", "major"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-alpha\.(\d+))?$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version "${version}". Expected x.y.z or x.y.z-alpha.n.`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    alpha: match[4] === undefined ? null : Number(match[4]),
  };
}

function nextVersion(current, bump) {
  const version = parseVersion(current);

  if (/^\d+\.\d+\.\d+(?:-alpha\.\d+)?$/.test(bump)) {
    const explicit = parseVersion(bump);
    return `${explicit.major}.${explicit.minor}.${explicit.patch}-${releasePrefix}.${explicit.alpha ?? 0}`;
  }

  if (!validBumps.has(bump)) {
    throw new Error(`Invalid bump "${bump}". Use patch, minor, major, or an explicit x.y.z-alpha.n version.`);
  }

  if (bump === "major") {
    version.major += 1;
    version.minor = 0;
    version.patch = 0;
    version.alpha = 0;
  } else if (bump === "minor") {
    version.minor += 1;
    version.patch = 0;
    version.alpha = 0;
  } else if (version.alpha === null) {
    version.patch += 1;
    version.alpha = 0;
  } else {
    version.alpha += 1;
  }

  return `${version.major}.${version.minor}.${version.patch}-${releasePrefix}.${version.alpha}`;
}

function replaceTomlVersion(contents, version) {
  return contents.replace(/^version = ".*"$/m, `version = "${version}"`);
}

const packagePath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");

const packageJson = readJson(packagePath);
const next = nextVersion(packageJson.version, versionArg);

packageJson.version = next;
writeJson(packagePath, packageJson);

if (fs.existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath);
  packageLock.version = next;
  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = next;
  }
  writeJson(packageLockPath, packageLock);
}

fs.writeFileSync(cargoTomlPath, replaceTomlVersion(fs.readFileSync(cargoTomlPath, "utf8"), next));

const tauriConfig = readJson(tauriConfigPath);
tauriConfig.version = next;
writeJson(tauriConfigPath, tauriConfig);

console.log(next);
