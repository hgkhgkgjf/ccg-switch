pub mod providers;

use serde::Serialize;
use std::collections::{HashMap, VecDeque};

const MAX_MESSAGE_WINDOW_LIMIT: usize = 500;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub provider_id: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_dir: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub source_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_command: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct UnifiedSessionMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ts: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedSessionMessageWindow {
    pub messages: Vec<UnifiedSessionMessage>,
    pub start_index: usize,
    pub total_count: usize,
    pub complete: bool,
}

fn normalize_message_window_limit(tail_limit: usize) -> usize {
    tail_limit.clamp(1, MAX_MESSAGE_WINDOW_LIMIT)
}

pub(crate) struct MessageWindowBuilder {
    limit: usize,
    total_count: usize,
    messages: VecDeque<UnifiedSessionMessage>,
}

impl MessageWindowBuilder {
    pub(crate) fn new(tail_limit: usize) -> Self {
        Self {
            limit: normalize_message_window_limit(tail_limit),
            total_count: 0,
            messages: VecDeque::new(),
        }
    }

    pub(crate) fn push(&mut self, message: UnifiedSessionMessage) {
        self.total_count += 1;
        self.messages.push_back(message);
        while self.messages.len() > self.limit {
            self.messages.pop_front();
        }
    }

    pub(crate) fn next_index(&self) -> usize {
        self.total_count
    }

    pub(crate) fn finish(self) -> UnifiedSessionMessageWindow {
        let messages: Vec<UnifiedSessionMessage> = self.messages.into_iter().collect();
        let start_index = self.total_count.saturating_sub(messages.len());
        UnifiedSessionMessageWindow {
            complete: start_index == 0,
            messages,
            start_index,
            total_count: self.total_count,
        }
    }
}

fn messages_to_window(
    messages: Vec<UnifiedSessionMessage>,
    tail_limit: usize,
) -> UnifiedSessionMessageWindow {
    let total_count = messages.len();
    let limit = normalize_message_window_limit(tail_limit);
    let start_index = total_count.saturating_sub(limit);
    UnifiedSessionMessageWindow {
        messages: messages.into_iter().skip(start_index).collect(),
        start_index,
        total_count,
        complete: start_index == 0,
    }
}

/// 按项目路径扫描会话，合并所有 provider 并按 last_active_at 降序排序
pub fn scan_sessions_for_project(project_path: &str) -> Vec<SessionMeta> {
    let mut all = Vec::new();
    all.extend(providers::claude::scan_claude_sessions_for_project(
        project_path,
    ));
    all.extend(providers::codex::scan_codex_sessions_for_project(
        project_path,
    ));
    all.extend(providers::gemini::scan_gemini_sessions_for_project(
        project_path,
    ));
    all.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));
    all
}

/// 轻量扫描：返回每个项目路径拥有哪些 provider 的映射
/// 不读取标题/内容，只检查目录结构和 cwd 字段
pub fn get_project_provider_map(project_paths: &[String]) -> HashMap<String, Vec<String>> {
    let normalized: Vec<String> = project_paths
        .iter()
        .map(|p| p.replace('\\', "/").to_lowercase())
        .collect();

    let mut result: HashMap<String, Vec<String>> = HashMap::new();
    // 初始化每个项目
    for path in project_paths {
        result.insert(path.clone(), vec!["claude".to_string()]); // 所有项目都来自 Claude
    }

    // Codex: 快速扫描 cwd 字段
    let codex_projects = providers::codex::scan_codex_project_dirs();
    for codex_dir in &codex_projects {
        let norm = codex_dir.replace('\\', "/").to_lowercase();
        for (i, target) in normalized.iter().enumerate() {
            if norm == *target {
                let entry = result.entry(project_paths[i].clone()).or_default();
                if !entry.contains(&"codex".to_string()) {
                    entry.push("codex".to_string());
                }
            }
        }
    }

    // Gemini: 从 projects.json 读取
    let gemini_projects = providers::gemini::scan_gemini_project_dirs();
    for gemini_dir in &gemini_projects {
        let norm = gemini_dir.replace('\\', "/").to_lowercase();
        for (i, target) in normalized.iter().enumerate() {
            if norm == *target {
                let entry = result.entry(project_paths[i].clone()).or_default();
                if !entry.contains(&"gemini".to_string()) {
                    entry.push("gemini".to_string());
                }
            }
        }
    }

    result
}

/// 根据 provider_id 路由到对应 provider 加载消息
pub fn load_messages(
    provider_id: &str,
    source_path: &str,
) -> Result<Vec<UnifiedSessionMessage>, String> {
    match provider_id {
        "claude" => providers::claude::load_claude_messages(source_path),
        "codex" => providers::codex::load_codex_messages(source_path),
        "gemini" => providers::gemini::load_gemini_messages(source_path),
        _ => Err(format!("Unknown provider: {}", provider_id)),
    }
}

pub fn load_message_window(
    provider_id: &str,
    source_path: &str,
    tail_limit: usize,
) -> Result<UnifiedSessionMessageWindow, String> {
    match provider_id {
        "claude" => providers::claude::load_claude_message_window(source_path, tail_limit),
        "codex" => providers::codex::load_codex_message_window(source_path, tail_limit),
        "gemini" => {
            let messages = providers::gemini::load_gemini_messages(source_path)?;
            Ok(messages_to_window(messages, tail_limit))
        }
        _ => Err(format!("Unknown provider: {}", provider_id)),
    }
}

pub fn load_claude_subagent_messages(
    session_id: &str,
    source_path: &str,
    agent_id: Option<&str>,
    description: Option<&str>,
) -> Result<Vec<UnifiedSessionMessage>, String> {
    providers::claude::load_claude_subagent_messages(session_id, source_path, agent_id, description)
}
