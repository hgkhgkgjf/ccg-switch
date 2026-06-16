use serde::{Deserialize, Serialize};

/// chat://message 事件载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageEvent {
    /// 原始 JSON 字符串（前端负责解析）
    pub json: String,
}
