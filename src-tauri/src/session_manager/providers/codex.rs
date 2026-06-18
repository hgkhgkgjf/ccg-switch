use super::utils::{home_dir, sanitize_session_text, truncate_text};
use crate::session_manager::{SessionMeta, UnifiedSessionMessage};
use regex::Regex;
use serde_json::{json, Value};
use std::fs;
use std::io::{BufRead, BufReader};

const TOOL_RESULT_CONTENT: &str = "[tool_result]";

/// 按项目路径扫描 Codex 会话（扫描全部文件但只返回匹配项目的会话）
pub fn scan_codex_sessions_for_project(project_path: &str) -> Vec<SessionMeta> {
    let normalized_target = project_path.replace('\\', "/").to_lowercase();
    let all = scan_codex_sessions_inner();
    all.into_iter()
        .filter(|s| {
            s.project_dir
                .as_ref()
                .map(|d| d.replace('\\', "/").to_lowercase() == normalized_target)
                .unwrap_or(false)
        })
        .collect()
}

/// 扫描 Codex 会话目录，返回所有会话元数据
fn scan_codex_sessions_inner() -> Vec<SessionMeta> {
    let home = match home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };

    let sessions_dir = home.join(".codex").join("sessions");
    if !sessions_dir.exists() {
        return Vec::new();
    }

    let uuid_re = Regex::new(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
        .expect("invalid regex");

    // Codex 会话存储在 YYYY/MM/DD/ 子目录下，需要递归扫描
    let mut jsonl_files = Vec::new();
    collect_jsonl_files(&sessions_dir, &mut jsonl_files);

    let mut sessions = Vec::new();

    for path in jsonl_files {
        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // 从文件名中提取 UUID 作为 session_id
        let session_id = match uuid_re.find(&filename) {
            Some(m) => m.as_str().to_string(),
            None => continue,
        };

        // 读取文件获取 metadata 和首条用户消息
        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };

        let reader = BufReader::new(file);
        let mut project_dir: Option<String> = None;
        let mut best_title: Option<String> = None;
        let mut fallback_title: Option<String> = None;

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            let line = line.trim().to_string();
            if line.is_empty() {
                continue;
            }

            let json: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let line_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

            if line_type == "session_meta" {
                if let Some(payload) = json.get("payload") {
                    if project_dir.is_none() {
                        project_dir = payload
                            .get("cwd")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                }
            } else if line_type == "response_item" {
                if best_title.is_some() {
                    continue;
                }
                if let Some(payload) = json.get("payload") {
                    let payload_type = payload.get("type").and_then(|v| v.as_str());
                    let role = payload.get("role").and_then(|v| v.as_str());
                    if payload_type == Some("message") && role == Some("user") {
                        if let Some(content) = payload.get("content") {
                            let text = extract_codex_content(content);
                            if !text.is_empty() {
                                let cleaned = sanitize_session_text(&text);
                                // 跳过系统指令类消息（以 # 开头的 markdown 文档，如 AGENTS.md）
                                if is_system_instruction(&cleaned) {
                                    if fallback_title.is_none() {
                                        fallback_title = Some(truncate_text(&cleaned, 80));
                                    }
                                } else {
                                    best_title = Some(truncate_text(&cleaned, 80));
                                }
                            }
                        }
                    }
                }
            }
        }

        let first_user_message = best_title.or(fallback_title);

        // 使用文件元数据获取时间戳
        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let created_at = metadata
            .created()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        let last_active_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(created_at);

        sessions.push(SessionMeta {
            provider_id: "codex".to_string(),
            session_id: session_id.clone(),
            title: first_user_message,
            summary: None,
            project_dir,
            created_at,
            last_active_at,
            source_path: path.to_string_lossy().to_string(),
            resume_command: Some(format!("codex resume {}", session_id)),
        });
    }

    sessions
}

/// 加载 Codex 会话的消息列表
pub fn load_codex_messages(source_path: &str) -> Result<Vec<UnifiedSessionMessage>, String> {
    let file = fs::File::open(source_path).map_err(|e| format!("打开文件失败: {}", e))?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("读取行失败: {}", e))?;
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let line_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if line_type != "response_item" {
            continue;
        }

        let payload = match json.get("payload") {
            Some(p) => p,
            None => continue,
        };

        let ts = json
            .get("timestamp")
            .or_else(|| json.get("ts"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let payload_type = payload.get("type").and_then(|v| v.as_str());
        match payload_type {
            Some("message") => {
                let role = payload
                    .get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                let role = normalize_role(role);

                let blocks = match payload.get("content") {
                    Some(c) => codex_message_content_blocks(c),
                    None => Vec::new(),
                };
                let content = extract_text_from_blocks(&blocks);
                if content.is_empty() && blocks.is_empty() {
                    continue;
                }

                messages.push(UnifiedSessionMessage {
                    role: role.to_string(),
                    content,
                    ts: ts.clone(),
                    raw: if blocks.is_empty() {
                        None
                    } else {
                        Some(message_raw(role, blocks, ts))
                    },
                });
            }
            Some("reasoning") => {
                let thinking = extract_codex_reasoning(payload);
                if thinking.is_empty() {
                    continue;
                }

                messages.push(UnifiedSessionMessage {
                    role: "assistant".to_string(),
                    content: String::new(),
                    ts: ts.clone(),
                    raw: Some(message_raw(
                        "assistant",
                        vec![json!({
                            "type": "thinking",
                            "thinking": thinking,
                        })],
                        ts,
                    )),
                });
            }
            Some("function_call") => {
                let tool_id = payload
                    .get("call_id")
                    .or_else(|| payload.get("id"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("codex-tool-{}", messages.len()));
                let name = payload
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("function_call");
                let input = parse_codex_arguments(payload.get("arguments"));

                messages.push(UnifiedSessionMessage {
                    role: "assistant".to_string(),
                    content: String::new(),
                    ts: ts.clone(),
                    raw: Some(message_raw(
                        "assistant",
                        vec![json!({
                            "type": "tool_use",
                            "id": tool_id,
                            "name": name,
                            "input": input,
                        })],
                        ts,
                    )),
                });
            }
            Some("function_call_output") => {
                let tool_id = payload
                    .get("call_id")
                    .or_else(|| payload.get("id"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("codex-tool-result-{}", messages.len()));
                let output = extract_codex_output(payload);
                let is_error = payload
                    .get("is_error")
                    .and_then(|v| v.as_bool())
                    .unwrap_or_else(|| {
                        payload
                            .get("status")
                            .and_then(|v| v.as_str())
                            .map(|status| status.eq_ignore_ascii_case("failed"))
                            .unwrap_or(false)
                    });

                messages.push(UnifiedSessionMessage {
                    role: "user".to_string(),
                    content: TOOL_RESULT_CONTENT.to_string(),
                    ts: ts.clone(),
                    raw: Some(message_raw(
                        "user",
                        vec![json!({
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": output,
                            "is_error": is_error,
                        })],
                        ts,
                    )),
                });
            }
            _ => continue,
        }
    }

    Ok(messages)
}

/// 从 Codex content 字段提取文本（支持 string 和 array 格式）
fn extract_codex_content(content: &serde_json::Value) -> String {
    if let Some(text) = content.as_str() {
        return text.to_string();
    }

    if let Some(items) = content.as_array() {
        let mut parts = Vec::new();
        for item in items {
            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                if !text.trim().is_empty() {
                    parts.push(text.to_string());
                }
            }
        }
        return parts.join("\n");
    }

    String::new()
}

fn text_from_value(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }

    for key in ["text", "content", "output"] {
        if let Some(text) = value.get(key).and_then(|v| v.as_str()) {
            return Some(text.to_string());
        }
    }

    None
}

fn codex_message_content_blocks(content: &Value) -> Vec<Value> {
    if let Some(text) = content.as_str() {
        let clean = sanitize_session_text(text);
        if clean.is_empty() {
            return Vec::new();
        }
        return vec![json!({"type": "text", "text": clean})];
    }

    let Some(items) = content.as_array() else {
        return Vec::new();
    };

    items
        .iter()
        .filter_map(|item| {
            let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if !matches!(item_type, "text" | "input_text" | "output_text") {
                return None;
            }
            let text = text_from_value(item)?;
            let clean = sanitize_session_text(&text);
            if clean.is_empty() {
                None
            } else {
                Some(json!({"type": "text", "text": clean}))
            }
        })
        .collect()
}

fn extract_text_from_blocks(blocks: &[Value]) -> String {
    blocks
        .iter()
        .filter_map(|block| {
            if block.get("type").and_then(|v| v.as_str()) == Some("text") {
                block.get("text").and_then(|v| v.as_str())
            } else {
                None
            }
        })
        .filter(|text| !text.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_codex_reasoning(payload: &Value) -> String {
    if let Some(text) = payload.get("content").and_then(text_from_value) {
        return sanitize_session_text(&text);
    }

    payload
        .get("summary")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(text_from_value)
                .map(|text| sanitize_session_text(&text))
                .filter(|text| !text.is_empty())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

fn parse_codex_arguments(arguments: Option<&Value>) -> Value {
    let Some(arguments) = arguments else {
        return json!({});
    };

    if let Some(raw) = arguments.as_str() {
        if raw.trim().is_empty() {
            return json!({});
        }
        return match serde_json::from_str::<Value>(raw) {
            Ok(Value::Object(map)) => Value::Object(map),
            Ok(parsed) => json!({"arguments": parsed}),
            Err(_) => json!({"arguments": raw}),
        };
    }

    if arguments.is_object() {
        return arguments.clone();
    }

    json!({"arguments": arguments})
}

fn extract_codex_output(payload: &Value) -> String {
    let value = payload.get("output").or_else(|| payload.get("content"));
    let Some(value) = value else {
        return String::new();
    };

    if let Some(text) = text_from_value(value) {
        return text;
    }

    if let Some(items) = value.as_array() {
        let text = items
            .iter()
            .filter_map(text_from_value)
            .collect::<Vec<_>>()
            .join("\n");
        if !text.is_empty() {
            return text;
        }
    }

    value.to_string()
}

fn message_raw(role: &str, blocks: Vec<Value>, ts: Option<String>) -> Value {
    let mut raw = json!({
        "type": role,
        "message": {
            "content": blocks,
        },
    });

    if let Some(ts) = ts {
        raw["timestamp"] = json!(ts);
    }

    raw
}

/// 规范化角色名称
fn normalize_role(role: &str) -> &str {
    match role {
        "user" => "user",
        "assistant" | "system" => role,
        _ => "assistant",
    }
}

/// 判断消息是否为系统指令（如 AGENTS.md、README.md 等文档内容）
fn is_system_instruction(text: &str) -> bool {
    let trimmed = text.trim();
    // 以 markdown 标题开头（# XXX），通常是 AGENTS.md / README 等系统文档
    if trimmed.starts_with("# ") {
        return true;
    }
    // 包含常见指令文件名关键词
    let lower = trimmed.to_lowercase();
    if lower.starts_with("agents.md") || lower.starts_with("claude.md") {
        return true;
    }
    false
}

/// 轻量扫描：只读取每个 Codex 会话的 cwd 字段，返回去重的项目路径列表
pub fn scan_codex_project_dirs() -> Vec<String> {
    let home = match home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };
    let sessions_dir = home.join(".codex").join("sessions");
    if !sessions_dir.exists() {
        return Vec::new();
    }

    let mut files = Vec::new();
    collect_jsonl_files(&sessions_dir, &mut files);

    let mut dirs = std::collections::HashSet::new();
    for path in files {
        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);
        // 只读前 5 行，cwd 在 session_meta 行
        for line in reader.lines().take(5).flatten() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                if json.get("type").and_then(|v| v.as_str()) == Some("session_meta") {
                    if let Some(cwd) = json
                        .get("payload")
                        .and_then(|p| p.get("cwd"))
                        .and_then(|v| v.as_str())
                    {
                        dirs.insert(cwd.to_string());
                        break;
                    }
                }
            }
        }
    }

    dirs.into_iter().collect()
}

/// 递归收集目录下所有 .jsonl 文件
fn collect_jsonl_files(dir: &std::path::Path, files: &mut Vec<std::path::PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, files);
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_temp_session(content: impl AsRef<[u8]>) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ccg-switch-codex-{suffix}.jsonl"));
        fs::write(&path, content).expect("write temp codex session");
        path
    }

    #[test]
    fn load_codex_messages_converts_native_items_to_structured_blocks() {
        let path = write_temp_session(
            r#"{"type":"response_item","timestamp":"2026-06-17T08:00:00.000Z","payload":{"type":"reasoning","summary":[{"type":"summary_text","text":"inspect first"}],"content":null}}"#
                .to_owned()
                + "\n"
                + r#"{"type":"response_item","timestamp":"2026-06-17T08:00:01.000Z","payload":{"type":"function_call","name":"shell_command","arguments":"{\"command\":\"git status\"}","call_id":"call-1"}}"#
                + "\n"
                + r#"{"type":"response_item","timestamp":"2026-06-17T08:00:02.000Z","payload":{"type":"function_call_output","call_id":"call-1","output":"clean"}}"#,
        );

        let messages = load_codex_messages(&path.to_string_lossy()).expect("load messages");
        fs::remove_file(path).ok();

        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].role, "assistant");
        assert_eq!(
            messages[0].raw.as_ref().unwrap()["message"]["content"][0]["type"],
            "thinking"
        );
        assert_eq!(
            messages[1].raw.as_ref().unwrap()["message"]["content"][0]["type"],
            "tool_use"
        );
        assert_eq!(
            messages[1].raw.as_ref().unwrap()["message"]["content"][0]["input"]["command"],
            "git status"
        );
        assert_eq!(messages[2].role, "user");
        assert_eq!(messages[2].content, TOOL_RESULT_CONTENT);
        assert_eq!(
            messages[2].raw.as_ref().unwrap()["message"]["content"][0]["tool_use_id"],
            "call-1"
        );
    }
}
