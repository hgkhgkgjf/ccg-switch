use super::utils::{
    extract_message_text, extract_teammate_summary, home_dir, is_system_message,
    sanitize_session_text, truncate_text,
};
use crate::session_manager::{SessionMeta, UnifiedSessionMessage};
use serde::Deserialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

const TOOL_RESULT_CONTENT: &str = "[tool_result]";

/// 按项目路径扫描 Claude 会话（只扫描匹配的项目目录）
pub fn scan_claude_sessions_for_project(project_path: &str) -> Vec<SessionMeta> {
    let home = match home_dir() {
        Some(h) => h,
        None => return vec![],
    };

    let projects_dir = home.join(".claude").join("projects");
    if !projects_dir.exists() {
        return vec![];
    }

    // 找到匹配 project_path 的项目目录
    let target_dir = find_project_dir(&projects_dir, project_path);
    let target_dir = match target_dir {
        Some(d) => d,
        None => return vec![],
    };

    scan_sessions_in_dir(&target_dir, project_path)
}

/// 在 ~/.claude/projects/ 中找到匹配给定路径的项目目录
fn find_project_dir(projects_dir: &Path, project_path: &str) -> Option<PathBuf> {
    let normalized = normalize_path(project_path);
    let entries = fs::read_dir(projects_dir).ok()?;

    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let dir = entry.path();

        // 快速检查：读取第一个 .jsonl 的 cwd 字段
        if let Some(cwd) = extract_cwd_from_first_file(&dir) {
            if normalize_path(&cwd) == normalized {
                return Some(dir);
            }
        }
    }
    None
}

/// 从目录中第一个 .jsonl 文件提取 cwd
fn extract_cwd_from_first_file(dir: &Path) -> Option<String> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            if let Some(cwd) = extract_cwd(&path) {
                return Some(cwd);
            }
        }
    }
    None
}

/// 规范化路径用于比较（统一斜杠方向和大小写）
fn normalize_path(p: &str) -> String {
    p.replace('\\', "/").to_lowercase()
}

/// 扫描指定目录下的所有会话文件
fn scan_sessions_in_dir(dir: &Path, project_path: &str) -> Vec<SessionMeta> {
    let mut sessions = Vec::new();
    let jsonl_files = collect_jsonl_files(dir);

    for path in jsonl_files {
        let fname = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        if fname.starts_with("agent-") {
            continue;
        }

        let session_id = fname.trim_end_matches(".jsonl").to_string();
        let source_path = path.to_string_lossy().to_string();
        let (title, summary) = extract_title_and_summary(&path);

        let (created_at, last_active_at) = match fs::metadata(&path) {
            Ok(meta) => {
                let modified = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                let created = meta
                    .created()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(modified);
                (created, modified)
            }
            Err(_) => (0, 0),
        };

        sessions.push(SessionMeta {
            provider_id: "claude".to_string(),
            session_id: session_id.clone(),
            title,
            summary,
            project_dir: Some(project_path.to_string()),
            created_at,
            last_active_at,
            source_path,
            resume_command: Some(format!("claude --resume {}", session_id)),
        });
    }

    sessions
}

/// 加载 Claude 会话的所有消息
pub fn load_claude_messages(source_path: &str) -> Result<Vec<UnifiedSessionMessage>, String> {
    let path = Path::new(source_path);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }

    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // 跳过 meta 行
        if json.get("isMeta").and_then(|v| v.as_bool()) == Some(true) {
            continue;
        }

        let msg_type = json
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if msg_type != "user" && msg_type != "assistant" {
            continue;
        }

        let message_content = match json.get("message").and_then(|v| v.get("content")) {
            Some(content) => content,
            None => continue,
        };

        let has_structured_content = has_structured_history_content(message_content);
        let raw_text = extract_message_text(message_content).unwrap_or_default();
        let clean_text = sanitize_session_text(&raw_text);
        if clean_text.is_empty() && !has_structured_content {
            continue;
        }
        let content = if clean_text.is_empty() && has_tool_result_content(message_content) {
            TOOL_RESULT_CONTENT.to_string()
        } else {
            clean_text
        };

        let ts = json
            .get("timestamp")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        messages.push(UnifiedSessionMessage {
            role: msg_type.to_string(),
            content,
            ts,
            raw: if has_structured_content {
                Some(json)
            } else {
                None
            },
        });
    }

    Ok(messages)
}

pub fn load_claude_subagent_messages(
    session_id: &str,
    source_path: &str,
    agent_id: Option<&str>,
    description: Option<&str>,
) -> Result<Vec<UnifiedSessionMessage>, String> {
    let subagents_dir = resolve_subagents_dir(source_path, session_id)
        .ok_or_else(|| "Subagent history directory not found".to_string())?;
    let history_file = find_subagent_history_file(&subagents_dir, agent_id, description)
        .ok_or_else(|| "Subagent history file not found".to_string())?;
    load_claude_messages(&history_file.to_string_lossy())
}

fn has_content_block_type(content: &serde_json::Value, target_type: &str) -> bool {
    content
        .as_array()
        .map(|items| {
            items
                .iter()
                .any(|item| item.get("type").and_then(|v| v.as_str()) == Some(target_type))
        })
        .unwrap_or(false)
}

fn has_structured_history_content(content: &serde_json::Value) -> bool {
    has_content_block_type(content, "thinking")
        || has_content_block_type(content, "tool_use")
        || has_content_block_type(content, "tool_result")
        || has_content_block_type(content, "image")
        || has_content_block_type(content, "input_image")
}

fn has_tool_result_content(content: &serde_json::Value) -> bool {
    has_content_block_type(content, "tool_result")
}

/// 递归收集目录下所有 .jsonl 文件
fn collect_jsonl_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_jsonl_inner(dir, &mut files);
    files
}

fn collect_jsonl_inner(dir: &Path, files: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_inner(&path, files);
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }
}

#[derive(Debug, Deserialize)]
struct SubagentMeta {
    #[serde(default)]
    description: Option<String>,
}

fn resolve_subagents_dir(source_path: &str, session_id: &str) -> Option<PathBuf> {
    let source = Path::new(source_path);
    if source.is_file() {
        let parent = source.parent()?;
        let sibling = parent.join(session_id).join("subagents");
        if sibling.is_dir() {
            return Some(sibling);
        }
        let direct = parent.join("subagents");
        if direct.is_dir() {
            return Some(direct);
        }
    }

    let home = home_dir()?;
    let projects_dir = home.join(".claude").join("projects");
    let project_dir = if source.is_file() {
        source.parent()?.to_path_buf()
    } else {
        find_project_dir(&projects_dir, source_path)?
    };
    let candidate = project_dir.join(session_id).join("subagents");
    if candidate.is_dir() {
        Some(candidate)
    } else {
        None
    }
}

fn read_optional_string(value: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(|entry| entry.as_str())
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn extract_agent_id_from_subagent_file(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);
    for line in reader.lines().take(40).flatten() {
        let json: serde_json::Value = serde_json::from_str(&line).ok()?;
        if let Some(agent_id) = read_optional_string(&json, &["agentId", "agent_id"]) {
            return Some(agent_id);
        }
    }
    None
}

fn load_subagent_meta(meta_path: &Path) -> Option<SubagentMeta> {
    let file = fs::File::open(meta_path).ok()?;
    serde_json::from_reader(file).ok()
}

fn find_subagent_history_file(
    subagents_dir: &Path,
    agent_id: Option<&str>,
    description: Option<&str>,
) -> Option<PathBuf> {
    let mut candidates = fs::read_dir(subagents_dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("jsonl"))
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with("agent-"))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    candidates.sort();

    if let Some(agent_id) = agent_id.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some(path) = candidates.iter().find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.contains(agent_id))
                .unwrap_or(false)
                || extract_agent_id_from_subagent_file(path).as_deref() == Some(agent_id)
        }) {
            return Some(path.clone());
        }
    }

    if let Some(description) = description.map(str::trim).filter(|value| !value.is_empty()) {
        let normalized = description.to_lowercase();
        if let Some(path) = candidates.iter().find(|path| {
            load_subagent_meta(&path.with_extension("meta.json"))
                .and_then(|meta| meta.description)
                .map(|value| value.trim().to_lowercase() == normalized)
                .unwrap_or(false)
        }) {
            return Some(path.clone());
        }
    }

    None
}

/// 从 .jsonl 前 20 行提取 cwd 字段
fn extract_cwd(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);
    for line in reader.lines().take(20).flatten() {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                if !cwd.is_empty() {
                    return Some(cwd.to_string());
                }
            }
        }
    }
    None
}

/// 从 .jsonl 前 240 行提取 title 和 summary
fn extract_title_and_summary(path: &Path) -> (Option<String>, Option<String>) {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, None),
    };

    let reader = BufReader::new(file);
    let mut title: Option<String> = None;
    let mut summary: Option<String> = None;

    for line in reader.lines().take(240).flatten() {
        if line.trim().is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if title.is_some() && summary.is_some() {
            break;
        }

        let msg_type = json
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if msg_type != "user" {
            continue;
        }

        let message_content = match json.get("message").and_then(|v| v.get("content")) {
            Some(content) => content,
            None => continue,
        };

        let raw_text = match extract_message_text(message_content) {
            Some(text) => text,
            None => continue,
        };

        // 优先从 teammate 标签提取 summary 作为 title
        if let Some(teammate_summary) = extract_teammate_summary(&raw_text) {
            let short = truncate_text(&teammate_summary, 80);
            if !short.is_empty() {
                title = Some(short);
            }
        }

        // 跳过纯系统/命令消息（如 <local-command-caveat>、/clear 等）
        if is_system_message(&raw_text) {
            continue;
        }

        let clean_text = sanitize_session_text(&raw_text);
        if clean_text.is_empty() {
            continue;
        }

        if title.is_none() {
            title = Some(truncate_text(&clean_text, 80));
        }

        if summary.is_none() {
            summary = Some(truncate_text(&clean_text, 140));
        }
    }

    (title, summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_temp_session(content: impl AsRef<[u8]>) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ccg-switch-claude-{suffix}.jsonl"));
        fs::write(&path, content).expect("write temp claude session");
        path
    }

    fn write_temp_dir() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ccg-switch-claude-dir-{suffix}"));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn load_claude_messages_preserves_structured_blocks() {
        let path = write_temp_session(
            r#"{"type":"assistant","timestamp":"2026-06-17T08:00:00.000Z","message":{"content":[{"type":"thinking","thinking":"inspect first"}]}}"#
                .to_owned()
                + "\n"
                + r#"{"type":"assistant","timestamp":"2026-06-17T08:00:01.000Z","message":{"content":[{"type":"tool_use","id":"tool-1","name":"Read","input":{"file_path":"src/App.tsx"}}]}}"#
                + "\n"
                + r#"{"type":"user","timestamp":"2026-06-17T08:00:02.000Z","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1","content":"file contents","is_error":false}]}}"#,
        );

        let messages = load_claude_messages(&path.to_string_lossy()).expect("load messages");
        fs::remove_file(path).ok();

        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].content, "");
        assert_eq!(
            messages[0].raw.as_ref().unwrap()["message"]["content"][0]["type"],
            "thinking"
        );
        assert_eq!(
            messages[1].raw.as_ref().unwrap()["message"]["content"][0]["name"],
            "Read"
        );
        assert_eq!(messages[2].content, TOOL_RESULT_CONTENT);
        assert_eq!(
            messages[2].raw.as_ref().unwrap()["message"]["content"][0]["tool_use_id"],
            "tool-1"
        );
    }

    #[test]
    fn load_claude_messages_preserves_image_only_blocks() {
        let path = write_temp_session(
            r#"{"type":"user","timestamp":"2026-06-17T08:00:00.000Z","message":{"content":[{"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBORw0KGgo="},"fileName":"screen.png"}]}}"#,
        );

        let messages = load_claude_messages(&path.to_string_lossy()).expect("load messages");
        fs::remove_file(path).ok();

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[0].content, "");
        assert_eq!(
            messages[0].raw.as_ref().unwrap()["message"]["content"][0]["type"],
            "image"
        );
        assert_eq!(
            messages[0].raw.as_ref().unwrap()["message"]["content"][0]["source"]["media_type"],
            "image/png"
        );
    }

    #[test]
    fn load_claude_subagent_messages_finds_file_by_agent_id() {
        let root = write_temp_dir();
        let parent = root.join("parent-session.jsonl");
        fs::write(&parent, "").expect("write parent session");
        let subagents = root.join("session-1").join("subagents");
        fs::create_dir_all(&subagents).expect("create subagents dir");
        let history = subagents.join("agent-a12c75a82930fb687.jsonl");
        fs::write(
            &history,
            r#"{"type":"assistant","timestamp":"2026-06-17T08:00:00.000Z","agentId":"agent-a12c75a82930fb687","message":{"content":[{"type":"text","text":"subagent trace"}]}}"#,
        )
        .expect("write subagent history");

        let messages = load_claude_subagent_messages(
            "session-1",
            &parent.to_string_lossy(),
            Some("agent-a12c75a82930fb687"),
            None,
        )
        .expect("load subagent messages");

        fs::remove_dir_all(root).ok();

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "subagent trace");
    }

    #[test]
    fn load_claude_subagent_messages_finds_file_by_meta_description() {
        let root = write_temp_dir();
        let parent = root.join("parent-session.jsonl");
        fs::write(&parent, "").expect("write parent session");
        let subagents = root.join("session-1").join("subagents");
        fs::create_dir_all(&subagents).expect("create subagents dir");
        let history = subagents.join("agent-lookup.jsonl");
        fs::write(
            &history,
            r#"{"type":"assistant","timestamp":"2026-06-17T08:00:00.000Z","message":{"content":[{"type":"thinking","thinking":"inspect backend"}]}}"#,
        )
        .expect("write subagent history");
        fs::write(
            history.with_extension("meta.json"),
            r#"{"description":"逆向JetBrains插件后端Java"}"#,
        )
        .expect("write subagent meta");

        let messages = load_claude_subagent_messages(
            "session-1",
            &parent.to_string_lossy(),
            None,
            Some("逆向JetBrains插件后端Java"),
        )
        .expect("load subagent messages by meta");

        fs::remove_dir_all(root).ok();

        assert_eq!(messages.len(), 1);
        assert_eq!(
            messages[0].raw.as_ref().unwrap()["message"]["content"][0]["type"],
            "thinking"
        );
    }
}
