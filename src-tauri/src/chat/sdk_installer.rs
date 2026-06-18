//! On-demand SDK installer (Rust port of jetbrains-cc-gui's DependencyManager).
//!
//! The Claude/Codex SDKs are not bundled. They are installed on demand into the
//! deps directory using the system `npm`, into a layout sdk-loader.js expects:
//!   `<deps>/<sdkId>/node_modules/<npmPackage>`
//!
//! Install strategy (mirrors DependencyManager.installSdkSync):
//!   1. ensure `<deps>/<sdkId>/` exists with a minimal package.json
//!   2. run `npm install --include=optional --prefix <sdkDir> <pkg@ver> [deps...]`
//!   3. stream npm output back to the caller via a log callback

use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::Serialize;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use super::resources;

/// A known installable SDK.
#[derive(Debug, Clone, Copy)]
pub struct SdkDefinition {
    /// Directory id under the deps dir, e.g. "claude-sdk".
    pub id: &'static str,
    /// Human-readable name.
    pub display_name: &'static str,
    /// Primary npm package.
    pub npm_package: &'static str,
    /// Version range/spec to install.
    pub version: &'static str,
    /// Extra packages installed alongside the primary one.
    pub dependencies: &'static [&'static str],
}

pub const CLAUDE_SDK: SdkDefinition = SdkDefinition {
    id: "claude-sdk",
    display_name: "Claude Code SDK",
    npm_package: "@anthropic-ai/claude-agent-sdk",
    version: "^0.2.58",
    dependencies: &["@anthropic-ai/sdk", "@anthropic-ai/bedrock-sdk"],
};

pub const CODEX_SDK: SdkDefinition = SdkDefinition {
    id: "codex-sdk",
    display_name: "Codex SDK",
    npm_package: "@openai/codex-sdk",
    version: "latest",
    dependencies: &[],
};

/// Resolve an SDK definition by id.
pub fn sdk_by_id(id: &str) -> Option<SdkDefinition> {
    match id {
        "claude-sdk" => Some(CLAUDE_SDK),
        "codex-sdk" => Some(CODEX_SDK),
        _ => None,
    }
}

/// Installation status of one SDK.
#[derive(Debug, Clone, Serialize)]
pub struct SdkStatus {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub installed: bool,
    pub path: String,
}

impl SdkDefinition {
    /// The package install dir: `<deps>/<id>/node_modules/<scope>/<name>`.
    fn package_dir(&self, deps_dir: &Path) -> PathBuf {
        let mut p = resources::sdk_dir(deps_dir, self.id).join("node_modules");
        for part in self.npm_package.split('/') {
            p = p.join(part);
        }
        p
    }

    /// Whether this SDK is currently installed.
    pub fn is_installed(&self, deps_dir: &Path) -> bool {
        self.package_dir(deps_dir).exists()
    }

    /// The full npm package spec, e.g. "@anthropic-ai/claude-agent-sdk@^0.2.58".
    fn package_spec(&self) -> String {
        format!("{}@{}", self.npm_package, self.version)
    }

    fn status(&self, deps_dir: &Path) -> SdkStatus {
        SdkStatus {
            id: self.id.to_string(),
            display_name: self.display_name.to_string(),
            installed: self.is_installed(deps_dir),
            path: self.package_dir(deps_dir).to_string_lossy().to_string(),
        }
    }
}

/// Status of all known SDKs.
pub fn all_status(deps_dir: &Path) -> Vec<SdkStatus> {
    vec![CLAUDE_SDK.status(deps_dir), CODEX_SDK.status(deps_dir)]
}

/// Build the npm install command, handling the Windows `.cmd` shell routing.
fn build_npm_command(npm: &Path, sdk_dir: &Path, sdk: SdkDefinition) -> Command {
    // Common npm args, in order.
    let spec = sdk.package_spec();

    #[cfg(windows)]
    {
        // Route through cmd.exe so npm.cmd (a batch file) can be executed.
        let mut cmd = Command::new("cmd");
        cmd.arg("/C")
            .arg(npm)
            .arg("install")
            .arg("--include=optional")
            .arg("--prefix")
            .arg(sdk_dir)
            .arg(&spec);
        for dep in sdk.dependencies {
            cmd.arg(dep);
        }
        cmd
    }

    #[cfg(not(windows))]
    {
        let mut cmd = Command::new(npm);
        cmd.arg("install")
            .arg("--include=optional")
            .arg("--prefix")
            .arg(sdk_dir)
            .arg(&spec);
        for dep in sdk.dependencies {
            cmd.arg(dep);
        }
        cmd
    }
}

/// Install an SDK. Streams npm output line-by-line through `on_log`.
///
/// `node_path` is used to locate npm. The install is written under
/// `<deps_dir>/<sdkId>/`.
pub async fn install_sdk<F>(
    sdk: SdkDefinition,
    node_path: &Path,
    deps_dir: &Path,
    on_log: F,
) -> Result<(), String>
where
    F: Fn(String) + Send + Sync,
{
    on_log(format!("开始安装 {}...", sdk.display_name));

    let npm = resources::detect_npm(node_path)?;
    on_log(format!("使用 npm: {}", npm.display()));

    // Create SDK dir with a minimal package.json (npm --prefix needs a target).
    let sdk_dir = resources::sdk_dir(deps_dir, sdk.id);

    // Path-safety: ensure sdk_dir stays within deps_dir (prevent traversal).
    let norm_sdk = sdk_dir.canonicalize().unwrap_or_else(|_| sdk_dir.clone());
    let norm_deps = deps_dir
        .canonicalize()
        .unwrap_or_else(|_| deps_dir.to_path_buf());
    // Compare before creation: sdk_dir may not exist yet, so check the lexical prefix.
    if !sdk_dir.starts_with(deps_dir) && !norm_sdk.starts_with(&norm_deps) {
        return Err("安全错误：SDK 目录超出依赖目录范围".to_string());
    }

    std::fs::create_dir_all(&sdk_dir)
        .map_err(|e| format!("创建目录失败 {}: {e}", sdk_dir.display()))?;

    let package_json = sdk_dir.join("package.json");
    std::fs::write(
        &package_json,
        format!(
            "{{\n  \"name\": \"{}-container\",\n  \"version\": \"1.0.0\",\n  \"private\": true\n}}\n",
            sdk.id
        ),
    )
    .map_err(|e| format!("写入 package.json 失败: {e}"))?;
    on_log("已创建 package.json".to_string());

    // Build: npm install --include=optional --prefix <sdkDir> <pkg> [deps...]
    //
    // On Windows `npm` is `npm.cmd`, a batch file. CreateProcessW cannot execute
    // .cmd directly, so route it through `cmd.exe /C`. On Unix, invoke npm
    // directly.
    let mut cmd = build_npm_command(&npm, &sdk_dir, sdk);
    cmd.current_dir(&sdk_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW avoids a console flash for the spawned cmd.exe.
        cmd.creation_flags(0x0800_0000);
    }

    on_log("正在执行 npm install...".to_string());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("启动 npm 失败: {e}. 请确认已安装 Node.js / npm"))?;

    // Stream stdout + stderr.
    if let Some(stdout) = child.stdout.take() {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            on_log(line);
        }
    }
    if let Some(stderr) = child.stderr.take() {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            on_log(line);
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("等待 npm 进程失败: {e}"))?;

    if !status.success() {
        return Err(format!(
            "npm install 失败（退出码 {}）",
            status.code().unwrap_or(-1)
        ));
    }

    if !sdk.is_installed(deps_dir) {
        return Err("安装完成但未找到 SDK 包，请检查日志".to_string());
    }

    on_log(format!("{} 安装完成 ✓", sdk.display_name));
    Ok(())
}

/// Uninstall an SDK by removing its install directory.
pub fn uninstall_sdk(sdk: SdkDefinition, deps_dir: &Path) -> Result<(), String> {
    let dir = resources::sdk_dir(deps_dir, sdk.id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("删除 {} 失败: {e}", dir.display()))?;
    }
    Ok(())
}
