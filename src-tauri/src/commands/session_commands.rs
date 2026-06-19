use crate::session_manager::{
    self, SessionMeta, UnifiedSessionMessage, UnifiedSessionMessageWindow,
};
use std::collections::HashMap;

#[tauri::command]
#[allow(non_snake_case)]
pub async fn list_sessions(projectPath: String) -> Result<Vec<SessionMeta>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        session_manager::scan_sessions_for_project(&projectPath)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))
}

/// 轻量检测每个项目拥有哪些 provider（不读取标题/内容）
#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_project_provider_map(
    projectPaths: Vec<String>,
) -> Result<HashMap<String, Vec<String>>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        session_manager::get_project_provider_map(&projectPaths)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_unified_session_messages(
    providerId: String,
    sourcePath: String,
) -> Result<Vec<UnifiedSessionMessage>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        session_manager::load_messages(&providerId, &sourcePath)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_unified_session_message_window(
    providerId: String,
    sourcePath: String,
    tailLimit: usize,
) -> Result<UnifiedSessionMessageWindow, String> {
    tauri::async_runtime::spawn_blocking(move || {
        session_manager::load_message_window(&providerId, &sourcePath, tailLimit)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_claude_subagent_session_messages(
    sessionId: String,
    sourcePath: String,
    agentId: Option<String>,
    description: Option<String>,
) -> Result<Vec<UnifiedSessionMessage>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        session_manager::load_claude_subagent_messages(
            &sessionId,
            &sourcePath,
            agentId.as_deref(),
            description.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
