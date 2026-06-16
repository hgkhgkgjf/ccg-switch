//! Tauri commands for interactive chat (Claude Code / Codex).
//!
//! Thin command layer: parse args, delegate to ChatManager, map errors to
//! String. Follows the project's command-layer convention.

use serde_json::Value;
use tauri::State;

use crate::chat::ChatManager;

/// 一个工作目录文件项（供 `@` 文件引用补全使用）。
#[derive(serde::Serialize)]
pub struct WorkspaceFile {
    /// 相对工作目录的路径（用 `/` 分隔，跨平台统一）
    pub rel_path: String,
    /// 文件名
    pub name: String,
    /// 是否为目录
    pub is_dir: bool,
}

/// Shared chat manager, stored in Tauri managed state.
pub struct ChatState {
    pub manager: ChatManager,
}

/// Send a chat message and stream the response via "chat://stream"/"chat://done".
///
/// `provider` is "claude" or "codex". `command` is the ai-bridge verb, e.g.
/// "send". `params` is the payload (message, sessionId, model, cwd, …).
/// Returns the request id for correlating streamed events.
#[tauri::command]
pub async fn chat_send(
    provider: String,
    command: String,
    params: Value,
    state: State<'_, ChatState>,
) -> Result<String, String> {
    let method = format!("{provider}.{command}");
    state.manager.send(method, params).await
}

/// Abort the current in-flight turn.
#[tauri::command]
pub async fn chat_abort(state: State<'_, ChatState>) -> Result<(), String> {
    state.manager.abort().await
}

/// Whether the daemon is running.
#[tauri::command]
pub async fn chat_is_running(state: State<'_, ChatState>) -> Result<bool, String> {
    Ok(state.manager.is_running().await)
}

/// Explicitly start the daemon (otherwise it starts lazily on first send).
#[tauri::command]
pub async fn chat_start_daemon(state: State<'_, ChatState>) -> Result<(), String> {
    // A no-op send path: starting happens inside the manager's lazy init.
    // We trigger it via is_running which forces client init only on send, so
    // instead expose a dedicated warm-up by sending a heartbeat-like start.
    state.manager.warm_up().await
}

/// 列出所有 SDK 的安装状态（Claude / Codex）。
#[tauri::command]
pub fn chat_sdk_status(
    state: State<'_, ChatState>,
) -> Result<Vec<crate::chat::SdkStatus>, String> {
    state.manager.sdk_status()
}

/// 安装指定 SDK。npm 日志通过 "chat://sdk-install-log" 事件流式推送，
/// 结束时发 "chat://sdk-install-done"。
#[tauri::command]
pub async fn chat_install_sdk(
    sdk_id: String,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    state.manager.install_sdk(sdk_id).await
}

/// 卸载指定 SDK。
#[tauri::command]
pub async fn chat_uninstall_sdk(
    sdk_id: String,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    state.manager.uninstall_sdk(sdk_id)
}

/// 重启 daemon（用于手动刷新）。
#[tauri::command]
pub async fn chat_restart_daemon(state: State<'_, ChatState>) -> Result<(), String> {
    state.manager.restart_daemon().await
}

/// 响应 AskUserQuestion 权限请求。
///
/// `request_id` 来自 "permission://ask-user-question" 事件，`answers` 是
/// { "问题文本": "用户选择的答案" } 的 map。
#[tauri::command]
pub async fn permission_respond_ask_user_question(
    request_id: String,
    answers: std::collections::HashMap<String, String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    let perm_dir = crate::chat::permission_dir(state.manager.app())?;
    crate::chat::write_ask_user_question_response(
        &perm_dir,
        "default", // TODO: match session ID from manager
        &request_id,
        answers,
    )
}

/// 列出工作目录下的文件，用于 `@` 文件引用补全。
///
/// `dir` 为工作目录（缺省用用户主目录）；`query` 为已输入的过滤词（按文件名/
/// 相对路径子串匹配，大小写不敏感）。最多返回 50 项，跳过常见的重型目录
/// （node_modules / .git / target / dist 等）与隐藏目录，限制扫描深度防卡顿。
#[tauri::command]
pub fn chat_list_workspace_files(
    dir: Option<String>,
    query: Option<String>,
) -> Result<Vec<WorkspaceFile>, String> {
    use std::path::PathBuf;

    let root: PathBuf = match dir {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d),
        _ => dirs::home_dir().ok_or_else(|| "无法定位主目录".to_string())?,
    };
    let query = query.unwrap_or_default().to_lowercase();

    const SKIP_DIRS: &[&str] = &[
        "node_modules",
        ".git",
        "target",
        "dist",
        "build",
        ".next",
        ".cache",
        "__pycache__",
        ".venv",
        "vendor",
    ];
    const MAX_RESULTS: usize = 50;
    const MAX_DEPTH: usize = 6;

    let mut out: Vec<WorkspaceFile> = Vec::new();
    // 广度优先，避免单分支过深；用栈记录 (路径, 深度)。
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.clone(), 0)];

    while let Some((cur, depth)) = stack.pop() {
        if out.len() >= MAX_RESULTS {
            break;
        }
        let entries = match std::fs::read_dir(&cur) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            // 跳过隐藏项与重型目录
            if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            let is_dir = path.is_dir();
            let rel = path
                .strip_prefix(&root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");

            let matches = query.is_empty()
                || rel.to_lowercase().contains(&query)
                || name.to_lowercase().contains(&query);
            if matches {
                out.push(WorkspaceFile {
                    rel_path: rel,
                    name,
                    is_dir,
                });
                if out.len() >= MAX_RESULTS {
                    break;
                }
            }
            if is_dir && depth < MAX_DEPTH {
                stack.push((path, depth + 1));
            }
        }
    }

    // 目录在前、文件在后，再按路径排序，便于浏览。
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.rel_path.cmp(&b.rel_path),
    });
    Ok(out)
}

/// 一键润色当前输入的 Prompt。返回增强后的文本（失败返回 Err，前端保留原文）。
#[tauri::command]
pub async fn chat_enhance_prompt(
    prompt: String,
    model: String,
    state: State<'_, ChatState>,
) -> Result<String, String> {
    state.manager.enhance_prompt(prompt, model).await
}

/// 响应 PlanApproval 权限请求。
///
/// `approved`: 是否批准；`target_mode`: "default" / "auto" / "bypassPermissions"。
#[tauri::command]
pub async fn permission_respond_plan_approval(
    request_id: String,
    approved: bool,
    target_mode: String,
    message: Option<String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    let perm_dir = crate::chat::permission_dir(state.manager.app())?;
    crate::chat::write_plan_approval_response(
        &perm_dir,
        "default",
        &request_id,
        approved,
        target_mode,
        message,
    )
}

