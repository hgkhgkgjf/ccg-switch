//! Resolves the bundled ai-bridge directory and the Node.js runtime path.
//!
//! Ported (simplified) from jetbrains-cc-gui's `BridgeDirectoryResolver` and
//! `NodeDetector`. In a desktop Tauri app the ai-bridge is shipped as a bundled
//! resource; in dev it lives under `src-tauri/resources/ai-bridge`.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Locate the `ai-bridge` directory containing `daemon.js`.
///
/// Resolution order:
///   1. Tauri bundled resource dir (`resources/ai-bridge`) — production.
///   2. `src-tauri/resources/ai-bridge` relative to the dev manifest — dev.
pub fn resolve_bridge_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // Production: resources are unpacked next to the executable.
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("resources").join("ai-bridge");
        if candidate.join("daemon.js").exists() {
            return Ok(candidate);
        }
        // Some bundlers flatten `resources/` away.
        let flat = resource_dir.join("ai-bridge");
        if flat.join("daemon.js").exists() {
            return Ok(flat);
        }
    }

    // Dev fallback: walk up from CARGO_MANIFEST_DIR.
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev = manifest.join("resources").join("ai-bridge");
    if dev.join("daemon.js").exists() {
        return Ok(dev);
    }

    Err(format!(
        "ai-bridge not found. Looked in resource dir and {}",
        dev.display()
    ))
}

/// The directory where the Claude/Codex SDKs are installed on demand.
/// Passed to the daemon via `AI_BRIDGE_DEPS_DIR` (see path-utils.js).
///
/// Uses the project's data-dir convention (`~/.ccg-switch/`, see
/// migration_service) so SDK installs live alongside other app data.
pub fn deps_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Cannot resolve home directory".to_string())?;
    Ok(home.join(".ccg-switch").join("ai-bridge-deps"))
}

/// Detect a usable `node` executable.
///
/// Order: `AI_BRIDGE_NODE` env override → PATH lookup → common install dirs.
pub fn detect_node() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("AI_BRIDGE_NODE") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Ok(pb);
        }
    }

    let exe = if cfg!(windows) { "node.exe" } else { "node" };

    // PATH lookup.
    if let Ok(path) = std::env::var("PATH") {
        let sep = if cfg!(windows) { ';' } else { ':' };
        for dir in path.split(sep) {
            if dir.is_empty() {
                continue;
            }
            let candidate = Path::new(dir).join(exe);
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    // Common install locations not always on a GUI app's PATH.
    let common: &[&str] = if cfg!(windows) {
        &[
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
        ]
    } else {
        &[
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/homebrew/bin/node",
            "/opt/local/bin/node",
        ]
    };
    for c in common {
        let pb = PathBuf::from(c);
        if pb.exists() {
            return Ok(pb);
        }
    }

    Err(
        "Node.js runtime not found. Install Node 18+ and ensure it is on PATH, \
         or set AI_BRIDGE_NODE to the node executable."
            .to_string(),
    )
}

/// Detect a usable `npm` executable.
///
/// Order: alongside the given node path → PATH lookup → bare command name.
/// On Windows the executable is `npm.cmd`.
pub fn detect_npm(node_path: &Path) -> Result<PathBuf, String> {
    let npm_name = if cfg!(windows) { "npm.cmd" } else { "npm" };

    // 1. Same directory as node (most reliable for nvm/official installs).
    if let Some(dir) = node_path.parent() {
        let candidate = dir.join(npm_name);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    // 2. PATH lookup.
    if let Ok(path) = std::env::var("PATH") {
        let sep = if cfg!(windows) { ';' } else { ':' };
        for dir in path.split(sep) {
            if dir.is_empty() {
                continue;
            }
            let candidate = Path::new(dir).join(npm_name);
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    // 3. Bare command name (relies on PATH at spawn time).
    Ok(PathBuf::from(npm_name))
}

/// The permission directory for file-based IPC with the daemon.
///
/// Creates `<app-data-dir>/permissions/` if it doesn't exist. The daemon
/// receives this path via the `CLAUDE_PERMISSION_DIR` environment variable.
pub fn permission_dir<R: tauri::Runtime>(app: &impl tauri::Manager<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {e}"))?
        .join("permissions");

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建 permissions 目录失败: {e}"))?;
    }

    Ok(dir)
}

///
/// Must match sdk-loader.js, which resolves SDKs under
/// `<AI_BRIDGE_DEPS_DIR>/dependencies/<sdkId>/node_modules/<pkg>`
/// (DEPS_BASE = join(getCodemossDir(), 'dependencies')). The `dependencies`
/// segment is required or the daemon won't find what we install.
pub fn sdk_dir(deps_dir: &Path, sdk_id: &str) -> PathBuf {
    deps_dir.join("dependencies").join(sdk_id)
}
