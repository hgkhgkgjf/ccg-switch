//! Tauri commands for interactive chat (Claude Code / Codex).
//!
//! Thin command layer: parse args, delegate to ChatManager, map errors to
//! String. Follows the project's command-layer convention.

use serde_json::Value;
use tauri::{AppHandle, State};

use crate::chat::ChatManager;

/// 当前聊天工作目录的只读工作区状态。
#[derive(serde::Serialize, Clone, Debug, PartialEq, Eq)]
pub struct ChatWorkspaceStatus {
    pub is_git_repository: bool,
    pub git_root: Option<String>,
    pub git_branch: Option<String>,
}

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

/// 一个 Slash 命令补全项，格式对齐 cc-gui 的 SlashCommandRegistry。
#[derive(serde::Serialize)]
pub struct SlashCommandItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source: String,
}

/// Shared chat manager, stored in Tauri managed state.
pub struct ChatState {
    pub manager: ChatManager,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SystemNotificationPayload {
    title: String,
    body: String,
}

fn normalize_system_notification_payload(
    title: &str,
    body: &str,
) -> Result<SystemNotificationPayload, String> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err("发送系统通知失败: 标题不能为空".to_string());
    }

    Ok(SystemNotificationPayload {
        title,
        body: body.trim().to_string(),
    })
}

fn empty_chat_workspace_status() -> ChatWorkspaceStatus {
    ChatWorkspaceStatus {
        is_git_repository: false,
        git_root: None,
        git_branch: None,
    }
}

fn find_git_entry(start: &std::path::Path) -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let mut current = if start.is_file() {
        start.parent()?.to_path_buf()
    } else {
        start.to_path_buf()
    };

    loop {
        let git_entry = current.join(".git");
        if git_entry.exists() {
            return Some((current, git_entry));
        }
        if !current.pop() {
            return None;
        }
    }
}

fn resolve_git_dir(
    repo_root: &std::path::Path,
    git_entry: &std::path::Path,
) -> Option<std::path::PathBuf> {
    if git_entry.is_dir() {
        return Some(git_entry.to_path_buf());
    }

    let content = std::fs::read_to_string(git_entry).ok()?;
    let git_dir = content.trim().strip_prefix("gitdir:")?.trim();
    if git_dir.is_empty() {
        return None;
    }

    let path = std::path::PathBuf::from(git_dir);
    Some(if path.is_absolute() {
        path
    } else {
        repo_root.join(path)
    })
}

fn read_git_branch(git_dir: &std::path::Path) -> Option<String> {
    let head = std::fs::read_to_string(git_dir.join("HEAD")).ok()?;
    let head = head.trim();
    if head.is_empty() {
        return None;
    }

    if let Some(reference) = head.strip_prefix("ref:") {
        let reference = reference.trim();
        return Some(
            reference
                .strip_prefix("refs/heads/")
                .unwrap_or(reference)
                .to_string(),
        )
        .filter(|branch| !branch.is_empty());
    }

    if head.len() >= 7 {
        return Some(head.chars().take(7).collect());
    }

    None
}

fn resolve_chat_workspace_status(cwd: Option<String>) -> Result<ChatWorkspaceStatus, String> {
    let Some(cwd) = cwd
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        return Ok(empty_chat_workspace_status());
    };

    let path = std::path::PathBuf::from(cwd);
    if !path.exists() {
        return Ok(empty_chat_workspace_status());
    }

    let Some((repo_root, git_entry)) = find_git_entry(&path) else {
        return Ok(empty_chat_workspace_status());
    };

    let git_branch = resolve_git_dir(&repo_root, &git_entry)
        .as_deref()
        .and_then(read_git_branch);

    Ok(ChatWorkspaceStatus {
        is_git_repository: true,
        git_root: Some(repo_root.to_string_lossy().to_string()),
        git_branch,
    })
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

/// 发送系统级桌面通知，用于聊天任务完成/失败/中断后的右下角提示。
#[tauri::command]
pub fn chat_show_system_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let payload = normalize_system_notification_payload(&title, &body)?;

    app.notification()
        .builder()
        .title(payload.title)
        .body(payload.body)
        .show()
        .map_err(|e| format!("发送系统通知失败: {e}"))
}

/// 返回当前 Chat 工作目录的 Git 状态；非 Git 或路径不可读时返回空状态。
#[tauri::command]
pub fn chat_workspace_status(cwd: Option<String>) -> Result<ChatWorkspaceStatus, String> {
    resolve_chat_workspace_status(cwd)
}

/// 列出所有 SDK 的安装状态（Claude / Codex）。
#[tauri::command]
pub async fn chat_sdk_status(
    state: State<'_, ChatState>,
) -> Result<Vec<crate::chat::SdkStatus>, String> {
    state.manager.sdk_status().await
}

/// 安装指定 SDK。npm 日志通过 "chat://sdk-install-log" 事件流式推送，
/// 结束时发 "chat://sdk-install-done"。
#[tauri::command]
pub async fn chat_install_sdk(
    sdk_id: String,
    version: Option<String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    state.manager.install_sdk(sdk_id, version).await
}

/// 卸载指定 SDK。
#[tauri::command]
pub async fn chat_uninstall_sdk(sdk_id: String, state: State<'_, ChatState>) -> Result<(), String> {
    state.manager.uninstall_sdk(sdk_id).await
}

/// 重启 daemon（用于手动刷新）。
#[tauri::command]
pub async fn chat_restart_daemon(state: State<'_, ChatState>) -> Result<(), String> {
    state.manager.restart_daemon().await
}

/// 列出 Slash 命令，用于输入框 `/` 补全。
///
/// 内置命令对齐 cc-gui 的 SlashCommandRegistry，并额外扫描当前项目向上的
/// `.claude/commands/**/*.md`，避免补全长期依赖前端硬编码列表。
#[tauri::command]
pub fn chat_list_slash_commands(
    cwd: Option<String>,
    provider: Option<String>,
) -> Result<Vec<SlashCommandItem>, String> {
    Ok(
        crate::chat::list_slash_commands(provider.as_deref(), cwd.as_deref())
            .into_iter()
            .map(|command| SlashCommandItem {
                id: command.id,
                name: command.name,
                description: command.description,
                source: command.source,
            })
            .collect(),
    )
}

/// 响应 AskUserQuestion 权限请求。
///
/// `request_id` 来自 "permission://ask-user-question" 事件，`answers` 是
/// { "问题文本": "用户选择的答案" } 的 map。
#[tauri::command]
pub async fn permission_respond_ask_user_question(
    request_id: String,
    session_id: Option<String>,
    answers: std::collections::HashMap<String, String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    let perm_dir = crate::chat::permission_dir(state.manager.app())?;
    let session_id = crate::chat::permission_response_session_id(session_id);
    crate::chat::write_ask_user_question_response(&perm_dir, &session_id, &request_id, answers)
}

/// 响应普通工具权限请求。
///
/// `request_id` 来自 "permission://tool" 事件，`allow` 会写入
/// `response-<sessionId>-<requestId>.json`，供 ai-bridge 继续执行或拒绝工具。
#[tauri::command]
pub async fn permission_respond_tool(
    request_id: String,
    session_id: Option<String>,
    allow: bool,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    let perm_dir = crate::chat::permission_dir(state.manager.app())?;
    let session_id = crate::chat::permission_response_session_id(session_id);
    crate::chat::write_tool_permission_response(&perm_dir, &session_id, &request_id, allow)
}

/// 列出工作目录下的文件，用于 `@` 文件引用补全。
///
/// `dir` 为工作目录（缺省用用户主目录）；`query` 为已输入的过滤词（按文件名/
/// 相对路径子串匹配，大小写不敏感）。最多返回 50 项，跳过常见的重型目录
/// （node_modules / .git / target / dist 等）与隐藏目录，限制扫描深度防卡顿。
///
/// 注意：文件系统遍历是阻塞操作，必须放到 `spawn_blocking` 线程池执行，
/// 否则会阻塞 Tauri 主线程导致界面卡死（"未响应"）。
#[tauri::command]
pub async fn chat_list_workspace_files(
    dir: Option<String>,
    query: Option<String>,
) -> Result<Vec<WorkspaceFile>, String> {
    tauri::async_runtime::spawn_blocking(move || list_workspace_files_blocking(dir, query))
        .await
        .map_err(|e| format!("文件扫描任务失败: {e}"))?
}

/// 同步执行工作目录文件扫描（阻塞）。由 `chat_list_workspace_files` 在
/// 后台线程池调用，不可直接在命令层（主线程）调用。
fn list_workspace_files_blocking(
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
    session_id: Option<String>,
    approved: bool,
    target_mode: String,
    message: Option<String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    let perm_dir = crate::chat::permission_dir(state.manager.app())?;
    let session_id = crate::chat::permission_response_session_id(session_id);
    crate::chat::write_plan_approval_response(
        &perm_dir,
        &session_id,
        &request_id,
        approved,
        target_mode,
        message,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};

    fn unique_test_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ccg-switch-{name}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ));
        fs::create_dir_all(&dir).expect("create test dir");
        dir
    }

    fn write_file(path: &Path, text: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent dir");
        }
        fs::write(path, text).expect("write test file");
    }

    #[test]
    fn normalizes_system_notification_payload_trims_title_and_body() -> Result<(), String> {
        let payload = normalize_system_notification_payload("  CCG Switch  ", "  done\n")?;

        assert_eq!(payload.title, "CCG Switch");
        assert_eq!(payload.body, "done");
        Ok(())
    }

    #[test]
    fn normalizes_system_notification_payload_rejects_empty_title() {
        let error =
            normalize_system_notification_payload(" \n\t ", "body").expect_err("empty title");

        assert_eq!(error, "发送系统通知失败: 标题不能为空");
    }

    #[test]
    fn normalizes_system_notification_payload_allows_empty_body() -> Result<(), String> {
        let payload = normalize_system_notification_payload("CCG Switch", " \n\t ")?;

        assert_eq!(payload.title, "CCG Switch");
        assert_eq!(payload.body, "");
        Ok(())
    }

    #[test]
    fn resolves_workspace_status_none_for_non_git_directory() -> Result<(), String> {
        let dir = unique_test_dir("workspace-status-no-git");
        let status = resolve_chat_workspace_status(Some(dir.to_string_lossy().to_string()))?;

        assert!(!status.is_git_repository);
        assert_eq!(status.git_branch, None);
        assert_eq!(status.git_root, None);

        fs::remove_dir_all(dir).ok();
        Ok(())
    }

    #[test]
    fn resolves_workspace_status_from_git_head_branch() -> Result<(), String> {
        let dir = unique_test_dir("workspace-status-git-branch");
        let nested = dir.join("packages").join("app");
        fs::create_dir_all(&nested).expect("create nested dir");
        write_file(
            &dir.join(".git").join("HEAD"),
            "ref: refs/heads/feature/chat-status\n",
        );

        let status = resolve_chat_workspace_status(Some(nested.to_string_lossy().to_string()))?;

        assert!(status.is_git_repository);
        assert_eq!(status.git_branch.as_deref(), Some("feature/chat-status"));
        assert_eq!(
            status.git_root.as_deref(),
            Some(dir.to_string_lossy().as_ref())
        );

        fs::remove_dir_all(dir).ok();
        Ok(())
    }

    #[test]
    fn resolves_workspace_status_from_gitdir_file() -> Result<(), String> {
        let dir = unique_test_dir("workspace-status-gitdir-file");
        let actual_git_dir = dir.join(".git-worktrees").join("app");
        write_file(&dir.join(".git"), "gitdir: .git-worktrees/app\n");
        write_file(
            &actual_git_dir.join("HEAD"),
            "ref: refs/heads/worktree/status-strip\n",
        );

        let status = resolve_chat_workspace_status(Some(dir.to_string_lossy().to_string()))?;

        assert!(status.is_git_repository);
        assert_eq!(status.git_branch.as_deref(), Some("worktree/status-strip"));
        assert_eq!(
            status.git_root.as_deref(),
            Some(dir.to_string_lossy().as_ref())
        );

        fs::remove_dir_all(dir).ok();
        Ok(())
    }
}
