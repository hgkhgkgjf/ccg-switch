//! Tauri commands for interactive chat (Claude Code / Codex).
//!
//! Thin command layer: parse args, delegate to ChatManager, map errors to
//! String. Follows the project's command-layer convention.

use serde_json::Value;
use tauri::State;

use crate::chat::ChatManager;

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

