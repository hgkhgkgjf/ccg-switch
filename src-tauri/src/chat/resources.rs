//! Resolves the bundled ai-bridge directory and the Node.js runtime path.
//!
//! Ported (simplified) from jetbrains-cc-gui's `BridgeDirectoryResolver` and
//! `NodeDetector`. In a desktop Tauri app the ai-bridge is shipped as a bundled
//! resource; in dev it lives under `src-tauri/resources/ai-bridge`.

use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const NODE_RUNTIME_VERSION: &str = "v24.11.1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PrivateNodePlatformSpec {
    pub install_dir: &'static str,
    pub platform: &'static str,
    pub arch: &'static str,
}

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

/// Root directory for the CCG Switch private Node runtime.
pub fn private_node_runtime_root() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Cannot resolve home directory".to_string())?;
    Ok(home.join(".ccg-switch").join("runtime").join("node"))
}

pub fn private_node_platform_spec() -> PrivateNodePlatformSpec {
    let platform = if cfg!(target_os = "windows") {
        "win"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };
    let install_dir = if cfg!(target_os = "windows") {
        if cfg!(target_arch = "aarch64") {
            "win-arm64"
        } else {
            "win-x64"
        }
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "darwin-arm64"
        } else {
            "darwin-x64"
        }
    } else if cfg!(target_arch = "aarch64") {
        "linux-arm64"
    } else {
        "linux-x64"
    };

    PrivateNodePlatformSpec {
        install_dir,
        platform,
        arch,
    }
}

pub fn private_node_executable_from_root(root: &Path, spec: &PrivateNodePlatformSpec) -> PathBuf {
    let base = root.join(NODE_RUNTIME_VERSION).join(spec.install_dir);
    if cfg!(windows) {
        base.join("node.exe")
    } else {
        base.join("bin").join("node")
    }
}

pub fn private_npm_executable_for_node(node_path: &Path) -> PathBuf {
    let npm_name = if cfg!(windows) { "npm.cmd" } else { "npm" };
    node_path
        .parent()
        .map(|dir| dir.join(npm_name))
        .unwrap_or_else(|| PathBuf::from(npm_name))
}

pub fn private_node_executable() -> Option<PathBuf> {
    let root = private_node_runtime_root().ok()?;
    let spec = private_node_platform_spec();
    let node = private_node_executable_from_root(&root, &spec);
    node.exists().then_some(node)
}

fn push_unique_path(paths: &mut Vec<PathBuf>, seen: &mut HashSet<String>, path: PathBuf) {
    if path.as_os_str().is_empty() {
        return;
    }
    let key = if cfg!(windows) {
        path.to_string_lossy().to_lowercase()
    } else {
        path.to_string_lossy().to_string()
    };
    if seen.insert(key) {
        paths.push(path);
    }
}

fn split_path_env(path: &OsStr) -> Vec<PathBuf> {
    std::env::split_paths(path).collect()
}

fn push_home_subdir(paths: &mut Vec<PathBuf>, seen: &mut HashSet<String>, parts: &[&str]) {
    let Some(mut path) = dirs::home_dir() else {
        return;
    };
    for part in parts {
        path = path.join(part);
    }
    push_unique_path(paths, seen, path);
}

fn push_fnm_multishell_dirs(paths: &mut Vec<PathBuf>, seen: &mut HashSet<String>) {
    let Some(home) = dirs::home_dir() else {
        return;
    };
    let root = home.join(".local").join("state").join("fnm_multishells");
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let bin = entry.path().join("bin");
        if bin.exists() {
            push_unique_path(paths, seen, bin);
        }
    }
}

fn push_nvm_version_dirs(paths: &mut Vec<PathBuf>, seen: &mut HashSet<String>) {
    let Some(home) = dirs::home_dir() else {
        return;
    };
    let root = home.join(".nvm").join("versions").join("node");
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    let mut versions: Vec<PathBuf> = entries.flatten().map(|entry| entry.path()).collect();
    versions.sort();
    versions.reverse();
    for version in versions {
        let bin = version.join("bin");
        if bin.exists() {
            push_unique_path(paths, seen, bin);
        }
    }
}

pub fn node_search_dirs() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();

    if let Ok(private_root) = private_node_runtime_root() {
        let spec = private_node_platform_spec();
        let private_node = private_node_executable_from_root(&private_root, &spec);
        if let Some(dir) = private_node.parent() {
            push_unique_path(&mut paths, &mut seen, dir.to_path_buf());
        }
    }

    if cfg!(windows) {
        push_unique_path(
            &mut paths,
            &mut seen,
            PathBuf::from(r"C:\Program Files\nodejs"),
        );
        push_unique_path(
            &mut paths,
            &mut seen,
            PathBuf::from(r"C:\Program Files (x86)\nodejs"),
        );
        if let Ok(appdata) = std::env::var("APPDATA") {
            push_unique_path(&mut paths, &mut seen, PathBuf::from(appdata).join("npm"));
        }
    } else {
        push_unique_path(&mut paths, &mut seen, PathBuf::from("/opt/homebrew/bin"));
        push_unique_path(&mut paths, &mut seen, PathBuf::from("/usr/local/bin"));
        push_unique_path(&mut paths, &mut seen, PathBuf::from("/usr/bin"));
        push_unique_path(&mut paths, &mut seen, PathBuf::from("/opt/local/bin"));
        push_home_subdir(&mut paths, &mut seen, &[".local", "bin"]);
        push_home_subdir(&mut paths, &mut seen, &[".npm-global", "bin"]);
        push_home_subdir(&mut paths, &mut seen, &["n", "bin"]);
        push_home_subdir(&mut paths, &mut seen, &[".volta", "bin"]);
        push_fnm_multishell_dirs(&mut paths, &mut seen);
        push_nvm_version_dirs(&mut paths, &mut seen);
    }

    if let Ok(path) = std::env::var_os("PATH").ok_or(()) {
        for dir in split_path_env(&path) {
            push_unique_path(&mut paths, &mut seen, dir);
        }
    }

    paths
}

pub fn node_execution_path_env(
    node_path: &Path,
    npm_path: Option<&Path>,
    base_path: Option<&OsStr>,
) -> String {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();

    if let Some(dir) = node_path.parent() {
        push_unique_path(&mut paths, &mut seen, dir.to_path_buf());
    }
    if let Some(dir) = npm_path.and_then(Path::parent) {
        push_unique_path(&mut paths, &mut seen, dir.to_path_buf());
    }

    for dir in node_search_dirs() {
        push_unique_path(&mut paths, &mut seen, dir);
    }
    if let Some(base) = base_path {
        for dir in split_path_env(base) {
            push_unique_path(&mut paths, &mut seen, dir);
        }
    } else if let Some(base) = std::env::var_os("PATH") {
        for dir in split_path_env(&base) {
            push_unique_path(&mut paths, &mut seen, dir);
        }
    }

    std::env::join_paths(paths)
        .unwrap_or_else(|_| OsString::new())
        .to_string_lossy()
        .to_string()
}

fn find_executable_in_dirs(exe: &str, dirs: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    dirs.into_iter()
        .map(|dir| dir.join(exe))
        .find(|candidate| candidate.exists())
}

/// Detect a usable `node` executable.
///
/// Order: `AI_BRIDGE_NODE` env override → CCG Switch private runtime → PATH/common install dirs.
pub fn detect_node() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("AI_BRIDGE_NODE") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Ok(pb);
        }
    }

    let exe = if cfg!(windows) { "node.exe" } else { "node" };

    if let Some(node) = private_node_executable() {
        return Ok(node);
    }

    if let Some(node) = find_executable_in_dirs(exe, node_search_dirs()) {
        return Ok(node);
    }

    Err(
        "未找到 Node.js 运行环境。可在 SDK 依赖面板一键安装 CCG Switch 私有 Node.js，\
         或手动安装 Node 18+ 后重启应用，也可以设置 AI_BRIDGE_NODE 指向 node 可执行文件。"
            .to_string(),
    )
}

/// Detect a usable `npm` executable.
///
/// Order: alongside the given node path → PATH/common GUI-missing locations.
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

    // 2. PATH/common GUI-missing locations.
    if let Some(npm) = find_executable_in_dirs(npm_name, node_search_dirs()) {
        return Ok(npm);
    }

    Err(
        "未找到 npm。可在 SDK 依赖面板一键安装 CCG Switch 私有 Node.js，\
         或手动安装包含 npm 的 Node.js LTS 后重启应用。"
            .to_string(),
    )
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

#[cfg(test)]
mod tests {
    use super::*;

    fn path_entries(path_env: &str) -> Vec<&str> {
        std::env::split_paths(path_env)
            .map(|path| {
                let owned = path.to_string_lossy().to_string();
                Box::leak(owned.into_boxed_str()) as &str
            })
            .collect()
    }

    #[test]
    fn node_execution_path_env_prepends_node_and_npm_directories_without_duplicates() {
        let node_path = if cfg!(windows) {
            PathBuf::from(r"C:\Program Files\nodejs\node.exe")
        } else {
            PathBuf::from("/opt/homebrew/bin/node")
        };
        let npm_path = if cfg!(windows) {
            PathBuf::from(r"C:\Users\tester\AppData\Roaming\npm\npm.cmd")
        } else {
            PathBuf::from("/usr/local/bin/npm")
        };
        let existing_path = std::env::join_paths([
            node_path.parent().expect("node dir"),
            Path::new(if cfg!(windows) {
                r"C:\Windows\System32"
            } else {
                "/usr/bin"
            }),
        ])
        .expect("join path");

        let path_env = node_execution_path_env(&node_path, Some(&npm_path), Some(&existing_path));
        let entries = path_entries(&path_env);
        let node_dir = node_path
            .parent()
            .expect("node dir")
            .to_string_lossy()
            .to_string();
        let npm_dir = npm_path
            .parent()
            .expect("npm dir")
            .to_string_lossy()
            .to_string();

        assert_eq!(entries.first().copied(), Some(node_dir.as_str()));
        assert!(entries.iter().any(|entry| *entry == npm_dir));
        assert_eq!(
            entries.iter().filter(|entry| **entry == node_dir).count(),
            1,
            "node directory should not be duplicated in PATH",
        );
    }

    #[test]
    fn private_node_runtime_paths_match_normalized_install_layout() {
        let root = PathBuf::from(if cfg!(windows) {
            r"C:\Users\tester\.ccg-switch\runtime\node"
        } else {
            "/Users/tester/.ccg-switch/runtime/node"
        });
        let spec = private_node_platform_spec();
        let node_path = private_node_executable_from_root(&root, &spec);
        let npm_path = private_npm_executable_for_node(&node_path);

        assert!(node_path.starts_with(root.join(NODE_RUNTIME_VERSION).join(spec.install_dir)));
        assert_eq!(
            node_path.file_name().and_then(|name| name.to_str()),
            Some(if cfg!(windows) { "node.exe" } else { "node" }),
        );
        assert_eq!(
            npm_path.file_name().and_then(|name| name.to_str()),
            Some(if cfg!(windows) { "npm.cmd" } else { "npm" }),
        );
    }
}
