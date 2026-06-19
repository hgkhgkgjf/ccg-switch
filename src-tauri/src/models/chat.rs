use serde::{Deserialize, Serialize};

/// chat://message 事件载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageEvent {
    /// 当前聊天请求 ID，用于前端过滤迟到/旧请求事件
    #[serde(rename = "requestId")]
    pub request_id: String,
    /// 原始 JSON 字符串（前端负责解析）
    pub json: String,
}
