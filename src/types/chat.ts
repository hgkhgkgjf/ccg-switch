// 交互式 Chat 类型定义（对接 Rust chat_commands + ai-bridge daemon）

/** 消息角色 */
export type ChatRole = 'user' | 'assistant' | 'system';

/** 一条聊天消息 */
export interface ChatMessage {
    id: string;
    role: ChatRole;
    /** 已渲染的文本内容（流式累积） */
    content: string;
    /** 结构化数据（来自 [MESSAGE] 标签） */
    raw?: MessageRaw;
    /** 是否仍在流式输出中 */
    streaming?: boolean;
    /** 出错信息（如有） */
    error?: string;
    createdAt: number;
    /** 本轮耗时（毫秒），流式结束时记录（仅 assistant） */
    durationMs?: number;
    /** 本轮 token 用量（来自 [USAGE] 标签，仅 assistant） */
    usage?: TokenUsage;
}

/** 用户输入区附件。图片附件使用 base64 数据传给 bridge，必要时由 bridge 落盘。 */
export interface ChatAttachment {
    fileName: string;
    mediaType: string;
    data?: string;
    path?: string;
    size?: number;
}

/** Token 用量（对应 daemon [USAGE] 标签的 JSON） */
export interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
}

/** MESSAGE 标签的完整结构 */
export interface MessageRaw {
    type: 'user' | 'assistant';
    message: {
        content: ContentBlock[];
    };
    uuid?: string;
    timestamp?: string;
}

/** 内容块联合类型 */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

export interface TextBlock {
    type: 'text';
    text: string;
}

export interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content?: string | ContentBlock[];
    is_error?: boolean;
}

export interface ThinkingBlock {
    type: 'thinking';
    thinking: string;
}

/** 后端 "chat://stream" 事件载荷 */
export interface ChatStreamEvent {
    requestId: string;
    kind: 'line' | 'stderr';
    text: string;
}

/** 后端 "chat://done" 事件载荷 */
export interface ChatDoneEvent {
    requestId: string;
    success: boolean;
    error?: string | null;
}

/** 后端 "chat://daemon" 生命周期事件载荷 */
export interface ChatDaemonEvent {
    event: string;
    pid?: number | null;
    message?: string | null;
    provider?: string | null;
}

/** Provider 选择 */
export type ChatProvider = 'claude' | 'codex';

/** SDK 安装状态（对应 Rust SdkStatus） */
export interface SdkStatus {
    id: string;
    displayName: string;
    installed: boolean;
    path: string;
}

/** "chat://sdk-install-log" 事件载荷 */
export interface SdkInstallLogEvent {
    sdkId: string;
    line: string;
}

/** "chat://sdk-install-done" 事件载荷 */
export interface SdkInstallDoneEvent {
    sdkId: string;
    success: boolean;
    error?: string | null;
}
