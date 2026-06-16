use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

/// Polls the permission directory for request files written by the daemon
/// (claude-agent-sdk), parses them, and emits Tauri events to the frontend.
///
/// Protocol: daemon writes `ask-user-question-<sessionId>-<requestId>.json` or
/// `plan-approval-<sessionId>-<requestId>.json` → watcher reads + emits event →
/// frontend responds via Tauri command → writes response file → daemon reads.
pub struct PermissionWatcher<R: Runtime> {
    permission_dir: PathBuf,
    session_id: String,
    app: AppHandle<R>,
    stop: Arc<AtomicBool>,
}

// ─── Request Types ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AskUserQuestionRequest {
    pub request_id: String,
    pub tool_name: String,
    pub questions: Vec<Question>,
    pub timestamp: String,
    pub cwd: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub question: String,
    pub header: String,
    pub options: Vec<QuestionOption>,
    pub multi_select: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct QuestionOption {
    pub label: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PlanApprovalRequest {
    pub request_id: String,
    pub tool_name: String,
    pub plan: String,
    pub allowed_prompts: Vec<AllowedPrompt>,
    pub timestamp: String,
    pub cwd: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AllowedPrompt {
    pub tool: String,
    pub prompt: String,
}

// ─── Response Types (for Tauri commands to serialize) ─────────────────────

#[derive(Serialize)]
struct AskUserQuestionResponse {
    #[serde(rename = "requestId")]
    request_id: String,
    answers: HashMap<String, String>,
}

#[derive(Serialize)]
struct PlanApprovalResponse {
    #[serde(rename = "requestId")]
    request_id: String,
    approved: bool,
    #[serde(rename = "targetMode")]
    target_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

impl<R: Runtime> PermissionWatcher<R> {
    pub fn new(permission_dir: PathBuf, session_id: String, app: AppHandle<R>) -> Self {
        Self {
            permission_dir,
            session_id,
            app,
            stop: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start polling in a background thread. Polls every 100ms until stop() is called.
    pub fn start(&self) {
        let dir = self.permission_dir.clone();
        let session_id = self.session_id.clone();
        let app = self.app.clone();
        let stop = self.stop.clone();

        std::thread::spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                Self::poll_once(&dir, &session_id, &app);
                std::thread::sleep(Duration::from_millis(100));
            }
        });
    }

    /// Stop the polling thread. Reserved for future watcher lifecycle control.
    #[allow(dead_code)]
    pub fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
    }

    /// Single poll cycle: scan for request files, parse, emit event, delete request.
    fn poll_once(permission_dir: &Path, session_id: &str, app: &AppHandle<R>) {
        // Scan AskUserQuestion requests
        if let Ok(entries) = std::fs::read_dir(permission_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with(&format!("ask-user-question-{}-", session_id))
                        && name.ends_with(".json")
                        && !name.contains("-response-")
                    {
                        Self::handle_ask_user_question(&path, app);
                    } else if name.starts_with(&format!("plan-approval-{}-", session_id))
                        && name.ends_with(".json")
                        && !name.contains("-response-")
                    {
                        Self::handle_plan_approval(&path, app);
                    }
                }
            }
        }
    }

    fn handle_ask_user_question(file: &Path, app: &AppHandle<R>) {
        match std::fs::read_to_string(file) {
            Ok(content) => match serde_json::from_str::<AskUserQuestionRequest>(&content) {
                Ok(req) => {
                    eprintln!("[PermissionWatcher] AskUserQuestion: {}", req.request_id);
                    let _ = app.emit("permission://ask-user-question", req);
                    // Delete request file after emitting (daemon won't re-read it).
                    let _ = std::fs::remove_file(file);
                }
                Err(e) => eprintln!("[PermissionWatcher] Parse error: {e}"),
            },
            Err(e) => eprintln!("[PermissionWatcher] Read error: {e}"),
        }
    }

    fn handle_plan_approval(file: &Path, app: &AppHandle<R>) {
        match std::fs::read_to_string(file) {
            Ok(content) => match serde_json::from_str::<PlanApprovalRequest>(&content) {
                Ok(req) => {
                    eprintln!("[PermissionWatcher] PlanApproval: {}", req.request_id);
                    let _ = app.emit("permission://plan-approval", req);
                    let _ = std::fs::remove_file(file);
                }
                Err(e) => eprintln!("[PermissionWatcher] Parse error: {e}"),
            },
            Err(e) => eprintln!("[PermissionWatcher] Read error: {e}"),
        }
    }
}

/// Write AskUserQuestion response file.
pub fn write_ask_user_question_response(
    permission_dir: &Path,
    session_id: &str,
    request_id: &str,
    answers: HashMap<String, String>,
) -> Result<(), String> {
    let filename = format!(
        "ask-user-question-response-{}-{}.json",
        session_id, request_id
    );
    let path = permission_dir.join(filename);
    let resp = AskUserQuestionResponse {
        request_id: request_id.to_string(),
        answers,
    };
    let json = serde_json::to_string_pretty(&resp)
        .map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("写入响应文件失败: {e}"))?;
    Ok(())
}

/// Write PlanApproval response file.
pub fn write_plan_approval_response(
    permission_dir: &Path,
    session_id: &str,
    request_id: &str,
    approved: bool,
    target_mode: String,
    message: Option<String>,
) -> Result<(), String> {
    let filename = format!(
        "plan-approval-response-{}-{}.json",
        session_id, request_id
    );
    let path = permission_dir.join(filename);
    let resp = PlanApprovalResponse {
        request_id: request_id.to_string(),
        approved,
        target_mode,
        message,
    };
    let json = serde_json::to_string_pretty(&resp)
        .map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("写入响应文件失败: {e}"))?;
    Ok(())
}
