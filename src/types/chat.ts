// 交互式 Chat 类型定义（对接 Rust chat_commands + ai-bridge daemon）

/** 消息角色 */
export type ChatRole = 'user' | 'assistant' | 'system';

/** 一条聊天消息 */
export interface ChatMessage {
    id: string;
    role: ChatRole;
    /** 已渲染的文本内容（流式累积） */
    content: string;
    /** 是否仍在流式输出中 */
    streaming?: boolean;
    /** 出错信息（如有） */
    error?: string;
    createdAt: number;
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
