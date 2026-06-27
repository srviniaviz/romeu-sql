const RELEASES_API_URL = "https://api.github.com/repos/srviniaviz/romeu-sql/releases/latest";
export const RELEASES_URL = "https://github.com/srviniaviz/romeu-sql/releases";

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  hasUpdate: boolean;
}

export interface UpdateInstallResult {
  version: string;
  installerPath: string;
  releaseUrl: string;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "");
}

function versionParts(version: string) {
  const [core, prerelease = ""] = normalizeVersion(version).split("-");
  const numbers = core.split(".").map((part) => Number(part) || 0);
  return {
    numbers: [numbers[0] || 0, numbers[1] || 0, numbers[2] || 0],
    prerelease,
  };
}

function compareVersions(left: string, right: string) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);

  for (let index = 0; index < 3; index += 1) {
    const diff = leftParts.numbers[index] - rightParts.numbers[index];
    if (diff !== 0) return diff;
  }

  if (leftParts.prerelease === rightParts.prerelease) return 0;
  if (!leftParts.prerelease) return 1;
  if (!rightParts.prerelease) return -1;
  return leftParts.prerelease.localeCompare(rightParts.prerelease, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

async function getCurrentVersion() {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return getVersion();
  } catch {
    return "0.0.0";
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const [currentVersion, response] = await Promise.all([
    getCurrentVersion(),
    fetch(RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    }),
  ]);

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}`);
  }

  const release = (await response.json()) as GitHubRelease;
  const latestVersion = release.tag_name ? normalizeVersion(release.tag_name) : "0.0.0";

  return {
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url || RELEASES_URL,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
  };
}

export async function downloadAndInstallUpdate(): Promise<UpdateInstallResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<UpdateInstallResult>("download_and_install_update");
}
