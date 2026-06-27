use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, process::Command};
use tokio::{fs::File, io::AsyncWriteExt};

const RELEASES_API_URL: &str = "https://api.github.com/repos/srviniaviz/romeu-sql/releases/latest";

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: Option<String>,
    html_url: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInstallResult {
    version: String,
    installer_path: String,
    release_url: String,
}

fn installer_score(name: &str) -> Option<i32> {
    let lower = name.to_lowercase();
    if !(lower.contains("windows")
        || lower.contains("win")
        || lower.contains("x64")
        || lower.contains("setup"))
    {
        return None;
    }

    if lower.ends_with(".msi") {
        return Some(100);
    }

    if lower.ends_with(".exe") {
        return Some(90);
    }

    None
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect()
}

fn installer_path(asset_name: &str) -> PathBuf {
    std::env::temp_dir()
        .join("romeu-sql-updates")
        .join(sanitize_filename(asset_name))
}

fn open_installer(path: &PathBuf) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();

    if extension == "msi" {
        Command::new("msiexec")
            .args(["/i", path.to_string_lossy().as_ref()])
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    Command::new(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn download_and_install_update() -> Result<UpdateInstallResult, String> {
    let client = reqwest::Client::new();
    let release = client
        .get(RELEASES_API_URL)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "Romeu SQL")
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<GitHubRelease>()
        .await
        .map_err(|error| error.to_string())?;

    let asset = release
        .assets
        .iter()
        .filter_map(|asset| installer_score(&asset.name).map(|score| (score, asset)))
        .max_by_key(|(score, _)| *score)
        .map(|(_, asset)| asset)
        .ok_or_else(|| "No Windows installer asset was found in the latest release.".to_string())?;

    let path = installer_path(&asset.name);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| error.to_string())?;
    }

    let response = client
        .get(&asset.browser_download_url)
        .header(reqwest::header::USER_AGENT, "Romeu SQL")
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;

    let mut file = File::create(&path)
        .await
        .map_err(|error| error.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        file.write_all(&chunk)
            .await
            .map_err(|error| error.to_string())?;
    }

    file.flush().await.map_err(|error| error.to_string())?;
    drop(file);

    open_installer(&path)?;

    Ok(UpdateInstallResult {
        version: release.tag_name.unwrap_or_else(|| "latest".to_string()),
        installer_path: path.to_string_lossy().to_string(),
        release_url: release
            .html_url
            .unwrap_or_else(|| "https://github.com/srviniaviz/romeu-sql/releases".to_string()),
    })
}
