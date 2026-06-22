import {create} from 'zustand';
import {invoke} from '@tauri-apps/api/core';
import {listen, type UnlistenFn} from '@tauri-apps/api/event';
import {
    ChatAttachment,
    ChatDaemonEvent,
    ChatDoneEvent,
    ChatMessage,
    ChatMessageEvent,
    ChatProvider,
    ChatRole,
    ChatStreamEvent,
    ContentBlock,
    ImageBlock,
    MessageRaw,
    TokenUsage,
} from '../types/chat';
import {
    type ChatSessionLoadMetrics,
    getSessionSelectionKey,
    type SessionMeta,
    type UnifiedSessionMessage,
    type UnifiedSessionMessageWindow,
} from '../types/session';
import {AskUserQuestionRequest, PlanApprovalRequest, ToolPermissionRequest,} from '../types/permission';
import type {ChatProviderId, PermissionMode, ReasoningEffort,} from '../components/chat/composer/constants';
import {reasoningLevelsFor,} from '../components/chat/composer/constants';
import {isProtocolContextText, mergeRawChatMessage, TOOL_RESULT_CONTENT} from '../utils/chatMessageFlow';
import {
    type ChatTurnStopOutcome,
    notifyChatTurnStopped,
    prepareChatTurnStoppedNotificationPermission,
} from '../utils/desktopNotification';
import {CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY} from '../utils/chatDaemonStatus';
import {CHAT_MODEL_SELECTION_KEY_PREFIX, getDefaultChatModelId,} from '../utils/chatModels';

const DRAFT_KEY_PREFIX = 'ccg-chat-draft:';
const REASONING_KEY = 'ccg-chat-reasoning';
const HANDOFF_CONTEXT_MAX_MESSAGES = 24;
const HANDOFF_CONTEXT_MAX_CHARS = 12_000;
const ATTACHMENT_ONLY_MESSAGE = 'Please analyze the attached image(s).';
const SESSION_HISTORY_CACHE_LIMIT = 8;
const STOPPED_REQUEST_NOTIFICATION_LIMIT = 64;
const RETIRED_REQUEST_OWNERSHIP_LIMIT = 128;
const SESSION_HISTORY_FIRST_PAINT_LIMIT = 120;
const SESSION_HISTORY_FULL_MAP_CHUNK_SIZE = 250;
const STOPPED_OUTPUT_ERROR = '已停止输出';
const DEFAULT_PERMISSION_SESSION_ID = 'default';
const CHAT_DAEMON_READY_TIMEOUT_MS = 15_000;
const stoppedRequestNotifications = new Set<string>();
const retiredRequestIds = new Set<string>();
let daemonReadyTimeout: ReturnType<typeof setTimeout> | null = null;

function clearDaemonReadyTimeout(): void {
    if (!daemonReadyTimeout) return;
    clearTimeout(daemonReadyTimeout);
    daemonReadyTimeout = null;
}

function scheduleDaemonReadyTimeout(
    get: () => ChatState,
    set: (state: Partial<ChatState>) => void,
): void {
    clearDaemonReadyTimeout();
    daemonReadyTimeout = setTimeout(() => {
        daemonReadyTimeout = null;
        const state = get();
        if (state.daemonReady || state.daemonStatus !== 'starting') return;

        set({
            daemonReady: false,
            daemonStatus: 'error',
            daemonReconnecting: false,
            error: CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY,
        });
    }, CHAT_DAEMON_READY_TIMEOUT_MS);
    (daemonReadyTimeout as {unref?: () => void}).unref?.();
}

function permissionSessionId(
    request: AskUserQuestionRequest | PlanApprovalRequest | ToolPermissionRequest,
): string {
    const sessionId = request.sessionId?.trim();
    return sessionId || DEFAULT_PERMISSION_SESSION_ID;
}

function clonePermissionRequest<T extends AskUserQuestionRequest | PlanApprovalRequest | ToolPermissionRequest>(
    request: T,
): T {
    return {...request};
}

function enqueuePermissionRequest<T extends AskUserQuestionRequest | PlanApprovalRequest | ToolPermissionRequest>(
    pending: T | null,
    queue: T[],
    responseInFlightRequestId: string | null,
    request: T,
): { pending: T | null; queue: T[] } {
    if (
        pending?.requestId === request.requestId
        || responseInFlightRequestId === request.requestId
        || queue.some((item) => item.requestId === request.requestId)
    ) {
        return {pending, queue};
    }

    if (pending || responseInFlightRequestId || queue.length > 0) {
        return {pending, queue: [...queue, request]};
    }

    return {pending: request, queue};
}

function nextPermissionRequest<T extends AskUserQuestionRequest | PlanApprovalRequest | ToolPermissionRequest>(
    queue: T[],
): { pending: T | null; queue: T[] } {
    const [pending = null, ...rest] = queue;
    return {pending, queue: rest};
}

function loadDraft(provider: ChatProviderId): string {
    try {
        return localStorage.getItem(DRAFT_KEY_PREFIX + provider) ?? '';
    } catch {
        return '';
    }
}

function defaultModel(provider: ChatProviderId): string {
    try {
        const saved = localStorage.getItem(CHAT_MODEL_SELECTION_KEY_PREFIX + provider);
        if (saved) return saved;
    } catch {
        // ignore
    }
    return getDefaultChatModelId(provider);
}

function loadReasoning(): ReasoningEffort {
    try {
        const saved = localStorage.getItem(REASONING_KEY) as ReasoningEffort | null;
        if (saved) return saved;
    } catch {
        // ignore
    }
    return 'high';
}

function imageBlockFromAttachment(attachment: ChatAttachment): ImageBlock | null {
    const hasData = Boolean(attachment.data?.trim());
    const hasPath = Boolean(attachment.path?.trim());
    if (!hasData && !hasPath) return null;

    const block: ImageBlock = {
        type: 'image',
        media_type: attachment.mediaType,
        fileName: attachment.fileName,
    };

    if (hasData && attachment.data) {
        block.data = attachment.data;
        block.source = {
            type: 'base64',
            media_type: attachment.mediaType,
            data: attachment.data,
        };
    } else if (hasPath && attachment.path) {
        block.path = attachment.path;
        block.source = {
            type: 'file',
            media_type: attachment.mediaType,
            path: attachment.path,
        };
    }

    return block;
}

function buildUserRawMessage(text: string, attachments: ChatAttachment[]): MessageRaw | undefined {
    const blocks: ContentBlock[] = [];
    const trimmed = text.trim();
    if (trimmed) {
        blocks.push({type: 'text', text: trimmed});
    }

    for (const attachment of attachments) {
        const imageBlock = imageBlockFromAttachment(attachment);
        if (imageBlock) blocks.push(imageBlock);
    }

    if (blocks.length === 0) return undefined;
    return {
        type: 'user',
        timestamp: new Date().toISOString(),
        message: {
            content: blocks,
        },
    };
}

function notifyStoppedRequestOnce(
    requestId: string | null | undefined,
    outcome: ChatTurnStopOutcome,
    provider: ChatProvider,
    detail?: string | null,
): void {
    if (!requestId) return;
    if (stoppedRequestNotifications.has(requestId)) return;

    stoppedRequestNotifications.add(requestId);
    while (stoppedRequestNotifications.size > STOPPED_REQUEST_NOTIFICATION_LIMIT) {
        const oldest = stoppedRequestNotifications.values().next().value;
        if (!oldest) break;
        stoppedRequestNotifications.delete(oldest);
    }

    notifyChatTurnStopped({
        outcome,
        provider,
        ...(detail ? {detail} : {}),
    });
}

function retireRequestOwnership(requestId: string | null | undefined): void {
    if (!requestId) return;
    retiredRequestIds.add(requestId);
    while (retiredRequestIds.size > RETIRED_REQUEST_OWNERSHIP_LIMIT) {
        const oldest = retiredRequestIds.values().next().value;
        if (!oldest) break;
        retiredRequestIds.delete(oldest);
    }
}

function getLastAssistantTextPreview(messages: ChatMessage[]): string | null {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role !== 'assistant') continue;

        const rawTextBlocks = message.raw?.message.content
            .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
            .map((block) => block.text.trim())
            .filter(Boolean);
        const rawText = rawTextBlocks?.[rawTextBlocks.length - 1];
        const fallbackText = message.content.trim();
        const preview = (rawText || fallbackText).replace(/\s+/g, ' ').trim();
        if (preview) return preview;
    }

    return null;
}

interface ChatState {
    messages: ChatMessage[];
    /** 当前 provider */
    provider: ChatProvider;
    /**
     * 权限模式。'default' 下工具调用会触发权限请求；在权限审批 UI 完成前
     * （后续任务），纯文本对话用 'default' 即可，涉及工具的复杂任务可临时用
     * 'bypassPermissions'（自动放行，请仅在信任的工作目录使用）。
     */
    permissionMode: PermissionMode;
    /** 当前选中的模型 id（按 provider 维度持久化） */
    model: string;
    /** 推理强度（reasoning effort） */
    reasoningEffort: ReasoningEffort;
    /** 输入框草稿（按 provider 维度持久化，跨页面保留） */
    draft: string;
    /** 累计上下文 token 数（用于用量环估算） */
    contextTokens: number;
    /** daemon 是否就绪 */
    daemonReady: boolean;
    /** 最近一次 daemon 生命周期消息（诊断用） */
    daemonStatus: string | null;
    /** 用户手动触发 daemon 恢复后的前端等待态 */
    daemonReconnecting: boolean;
    /** 当前进行中的 requestId */
    activeRequestId: string | null;
    /** 当前会话 id（由 daemon 的 SESSION_ID 回填） */
    sessionId: string | null;
    /** 当前会话关联的工作目录，供 @ 文件补全和 daemon cwd 使用 */
    currentCwd: string | null;
    /** 当前从历史中载入的会话元信息 */
    activeSession: SessionMeta | null;
    /** 当前正在切换/加载中的历史会话 key */
    pendingSessionKey: string | null;
    /** 最近一次历史会话加载的性能诊断，仅用于状态面板展示 */
    lastSessionLoadMetrics: ChatSessionLoadMetrics | null;
    /** provider 切换后，下一次无原生 session 的发送需要携带的历史来源 */
    handoffContextProvider: ChatProvider | null;
    /** 事件监听器是否已注册 */
    initialized: boolean;
    error: string | null;
    /** 待审批的 AskUserQuestion 请求（弹窗） */
    pendingAskUserQuestion: AskUserQuestionRequest | null;
    pendingAskUserQuestionQueue: AskUserQuestionRequest[];
    askUserQuestionResponseInFlightRequestId: string | null;
    /** 待审批的 PlanApproval 请求（弹窗） */
    pendingPlanApproval: PlanApprovalRequest | null;
    pendingPlanApprovalQueue: PlanApprovalRequest[];
    planApprovalResponseInFlightRequestId: string | null;
    /** 待审批的普通工具权限请求（弹窗） */
    pendingToolPermission: ToolPermissionRequest | null;
    pendingToolPermissionQueue: ToolPermissionRequest[];
    toolPermissionResponseInFlightRequestId: string | null;
    /** 被用户拒绝的工具调用 ID 集合 */
    deniedToolIds: Set<string>;

    init: () => Promise<void>;
    reconnectDaemon: () => Promise<void>;
    addDeniedTool: (toolId: string) => void;
    clearDeniedTools: () => void;
    setProvider: (p: ChatProvider) => void;
    setPermissionMode: (m: PermissionMode) => void;
    setModel: (id: string) => void;
    setReasoningEffort: (e: ReasoningEffort) => void;
    setDraft: (text: string) => void;
    send: (text: string, opts?: {
        cwd?: string;
        model?: string;
        attachments?: ChatAttachment[];
        displayText?: string;
    }) => Promise<boolean>;
    loadSession: (session: SessionMeta) => Promise<void>;
    loadActiveSessionFullHistory: () => Promise<ChatMessage[] | null>;
    startNewSession: (cwd?: string | null) => Promise<void>;
    abort: () => Promise<void>;
    clear: () => Promise<void>;
    answerAskUserQuestion: (requestId: string, answers: Record<string, string>) => Promise<void>;
    answerToolPermission: (requestId: string, allow: boolean) => Promise<void>;
    approvePlan: (requestId: string, approved: boolean, targetMode: string) => Promise<void>;
}

let unlisteners: UnlistenFn[] = [];
let latestSessionLoadToken = 0;
let latestChatTurnToken = 0;
const sessionHistoryCache = new Map<string, ChatMessage[]>();

function nowMs(): number {
    return Date.now();
}

function newId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function syncAssistantRawWithStreamingContent(raw: MessageRaw | undefined, content: string): MessageRaw | undefined {
    if (!raw || raw.type !== 'assistant' || !content.trim()) return raw;

    let syncedText = false;
    const contentBlocks = raw.message.content.reduce<ContentBlock[]>((blocks, block) => {
        if (block.type !== 'text') {
            blocks.push(block);
            return blocks;
        }
        if (syncedText) return blocks;
        syncedText = true;
        blocks.push(block.text === content ? block : {...block, text: content});
        return blocks;
    }, []);

    return {
        ...raw,
        message: {
            ...raw.message,
            content: syncedText
                ? contentBlocks
                : [{type: 'text', text: content}, ...contentBlocks],
        },
    };
}

/**
 * 把文本增量追加到最后一条流式 assistant 消息。
 * 不依赖 requestId 映射：daemon 响应极快，按 streaming 状态定位最稳。
 */
function appendToStreamingAssistant(
    set: (fn: (state: ChatState) => Partial<ChatState>) => void,
    delta: string,
): void {
    set((state) => {
        const messages = [...state.messages];
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant' && messages[i].streaming) {
                const content = messages[i].content + delta;
                messages[i] = {
                    ...messages[i],
                    content,
                    raw: syncAssistantRawWithStreamingContent(messages[i].raw, content),
                };
                break;
            }
        }
        return { messages };
    });
}

function hasStreamingAssistant(messages: ChatMessage[]): boolean {
    return messages.some((message) => message.role === 'assistant' && message.streaming);
}

function hasActiveChatTurn(state: ChatState): boolean {
    return Boolean(state.activeRequestId) || hasStreamingAssistant(state.messages);
}

function stopStreamingAssistantMessages(
    messages: ChatMessage[],
    error = STOPPED_OUTPUT_ERROR,
): ChatMessage[] {
    return messages.map((message) => (
        message.role === 'assistant' && message.streaming
            ? {
                ...message,
                streaming: false,
                error: message.error ?? error,
                durationMs: Date.now() - message.createdAt,
            }
            : message
    ));
}

function shouldAcceptRequestEvent(state: ChatState, requestId: string | null | undefined): boolean {
    if (!requestId) return false;
    if (state.activeRequestId) return state.activeRequestId === requestId;
    if (retiredRequestIds.has(requestId)) return false;
    return hasStreamingAssistant(state.messages);
}

function bindPendingRequestIfNeeded(
    set: (state: Partial<ChatState>) => void,
    state: ChatState,
    requestId: string,
): void {
    if (!state.activeRequestId && hasStreamingAssistant(state.messages)) {
        set({activeRequestId: requestId});
    }
}

function isChatProvider(providerId: string): providerId is ChatProvider {
    return providerId === 'claude' || providerId === 'codex';
}

function normalizeHistoryRole(role: string): ChatRole {
    const normalized = role.toLowerCase();
    if (normalized === 'user' || normalized === 'assistant' || normalized === 'system') {
        return normalized;
    }
    return 'system';
}

function mapHistoryMessage(
    session: SessionMeta,
    message: UnifiedSessionMessage,
    index: number,
): ChatMessage {
    const parsedTime = message.ts ? Date.parse(message.ts) : NaN;
    const createdAt = Number.isFinite(parsedTime)
        ? parsedTime
        : session.createdAt + index;

    const role = isProtocolContextText(message.content)
        ? 'system'
        : normalizeHistoryRole(message.role);

    return {
        id: `history-${session.providerId}-${session.sessionId}-${index}`,
        role,
        content: message.content,
        raw: message.raw ?? undefined,
        createdAt,
    };
}

function mapHistoryMessages(
    session: SessionMeta,
    messages: UnifiedSessionMessage[],
    startIndex = 0,
): ChatMessage[] {
    return messages.map((message, offset) => mapHistoryMessage(session, message, startIndex + offset));
}

function deferSessionHistoryMapChunk(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

async function mapHistoryMessagesInChunks(
    session: SessionMeta,
    messages: UnifiedSessionMessage[],
    startIndex = 0,
): Promise<ChatMessage[]> {
    const mapped: ChatMessage[] = [];
    for (let index = 0; index < messages.length; index += SESSION_HISTORY_FULL_MAP_CHUNK_SIZE) {
        if (index > 0) {
            await deferSessionHistoryMapChunk();
        }
        mapped.push(...mapHistoryMessages(
            session,
            messages.slice(index, index + SESSION_HISTORY_FULL_MAP_CHUNK_SIZE),
            startIndex + index,
        ));
    }
    return mapped;
}

function getSessionHistoryCacheKey(session: SessionMeta): string {
    return [
        session.providerId,
        session.sourcePath,
        session.sessionId,
        session.lastActiveAt,
    ].join('::');
}

function getCachedSessionHistory(session: SessionMeta): ChatMessage[] | null {
    const key = getSessionHistoryCacheKey(session);
    const cached = sessionHistoryCache.get(key);
    if (!cached) return null;

    sessionHistoryCache.delete(key);
    sessionHistoryCache.set(key, cached);
    return cached;
}

function rememberSessionHistory(session: SessionMeta, messages: ChatMessage[]): void {
    const key = getSessionHistoryCacheKey(session);
    sessionHistoryCache.delete(key);
    sessionHistoryCache.set(key, messages);

    while (sessionHistoryCache.size > SESSION_HISTORY_CACHE_LIMIT) {
        const oldestKey = sessionHistoryCache.keys().next().value;
        if (!oldestKey) break;
        sessionHistoryCache.delete(oldestKey);
    }
}

function getSessionHistoryDisplayWindow(messages: ChatMessage[]): ChatMessage[] {
    if (messages.length <= SESSION_HISTORY_FIRST_PAINT_LIMIT) return messages;
    return messages.slice(messages.length - SESSION_HISTORY_FIRST_PAINT_LIMIT);
}

function createSessionLoadMetrics(session: SessionMeta, startedAt: number): ChatSessionLoadMetrics {
    return {
        sessionKey: getSessionSelectionKey(session),
        providerId: session.providerId as ChatProvider,
        sourcePath: session.sourcePath,
        cacheHit: false,
        status: 'loading',
        startedAt,
        completedAt: null,
        elapsedMs: null,
        windowMessageCount: 0,
        totalMessageCount: null,
        fullMessageCount: null,
        windowLoadMs: null,
        windowMapMs: null,
        fullLoadMs: null,
        fullMapMs: null,
        error: null,
    };
}

function finishSessionLoadMetrics(
    metrics: ChatSessionLoadMetrics,
    completedAt: number,
    status: ChatSessionLoadMetrics['status'],
    error: string | null = null,
): ChatSessionLoadMetrics {
    return {
        ...metrics,
        status,
        completedAt,
        elapsedMs: completedAt - metrics.startedAt,
        error,
    };
}

export function clearChatSessionHistoryCache(): void {
    sessionHistoryCache.clear();
}

function getLoadedSessionState(
    session: SessionMeta,
    provider: ChatProvider,
    messages: ChatMessage[],
    state: ChatState,
): Partial<ChatState> {
    const model = defaultModel(provider);
    const levels = reasoningLevelsFor(provider, model);

    return {
        messages,
        provider,
        model,
        draft: loadDraft(provider),
        reasoningEffort: levels.some((level) => level.id === state.reasoningEffort)
            ? state.reasoningEffort
            : (levels[levels.length - 1]?.id ?? 'high'),
        sessionId: session.sessionId,
        currentCwd: session.projectDir,
        activeSession: session,
        pendingSessionKey: null,
        handoffContextProvider: null,
        activeRequestId: null,
        contextTokens: 0,
        error: null,
    };
}

function isActiveSessionLoadCurrent(
    state: ChatState,
    session: SessionMeta,
    loadToken: number,
): boolean {
    if (loadToken !== latestSessionLoadToken) return false;
    if (!state.activeSession) return false;
    return getSessionSelectionKey(state.activeSession) === getSessionSelectionKey(session);
}

function hasHandoffContent(message: ChatMessage): boolean {
    if (message.streaming || message.error) return false;
    if (message.role !== 'user' && message.role !== 'assistant') return false;
    const content = message.content.trim();
    return content.length > 0
        && content !== TOOL_RESULT_CONTENT
        && !isProtocolContextText(content);
}

function roleLabel(role: ChatRole): string {
    if (role === 'assistant') return 'Assistant';
    if (role === 'system') return 'System';
    return 'User';
}

function trimToMaxChars(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(text.length - maxChars);
}

function buildProviderHandoffMessage(
    userMessage: string,
    messages: ChatMessage[],
    sourceProvider: ChatProvider,
    targetProvider: ChatProvider,
): string {
    const transcript = messages
        .filter(hasHandoffContent)
        .slice(-HANDOFF_CONTEXT_MAX_MESSAGES)
        .map((message) => `${roleLabel(message.role)}: ${message.content.trim()}`)
        .join('\n\n');

    if (!transcript.trim()) return userMessage;

    const boundedTranscript = trimToMaxChars(transcript, HANDOFF_CONTEXT_MAX_CHARS);

    return [
        `<previous-conversation-context source-provider="${sourceProvider}" target-provider="${targetProvider}">`,
        `The visible chat history below came from the ${sourceProvider} provider before the user switched to ${targetProvider}.`,
        'Treat it as prior conversation context and continue from it. Do not mention this wrapper unless it is directly relevant.',
        '',
        boundedTranscript,
        '</previous-conversation-context>',
        '',
        userMessage,
    ].join('\n');
}

async function abortActiveRequestIfNeeded(
    get: () => ChatState,
    set: (state: Partial<ChatState>) => void,
): Promise<string | null> {
    const state = get();
    const requestId = state.activeRequestId;
    if (!hasActiveChatTurn(state)) return null;

    latestChatTurnToken += 1;

    let abortError: string | null = null;
    try {
        await invoke('chat_abort');
    } catch (e) {
        abortError = String(e);
        set({ error: abortError });
    }
    retireRequestOwnership(requestId);
    set({ activeRequestId: null });
    return abortError;
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    provider: 'claude',
    permissionMode: 'default',
    model: defaultModel('claude'),
    reasoningEffort: loadReasoning(),
    draft: loadDraft('claude'),
    contextTokens: 0,
    daemonReady: false,
    daemonStatus: null,
    daemonReconnecting: false,
    activeRequestId: null,
    sessionId: null,
    currentCwd: null,
    activeSession: null,
    pendingSessionKey: null,
    lastSessionLoadMetrics: null,
    handoffContextProvider: null,
    initialized: false,
    error: null,
    pendingAskUserQuestion: null,
    pendingAskUserQuestionQueue: [],
    askUserQuestionResponseInFlightRequestId: null,
    pendingPlanApproval: null,
    pendingPlanApprovalQueue: [],
    planApprovalResponseInFlightRequestId: null,
    pendingToolPermission: null,
    pendingToolPermissionQueue: [],
    toolPermissionResponseInFlightRequestId: null,
    deniedToolIds: new Set(),

    init: async () => {
        if (get().initialized) return;
        clearDaemonReadyTimeout();
        set({
            initialized: true,
            daemonReady: false,
            daemonStatus: 'starting',
            daemonReconnecting: false,
            error: null,
        });

        // 清理可能的旧监听器（热重载场景）
        unlisteners.forEach((u) => u());
        unlisteners = [];

        const streamUn = await listen<ChatStreamEvent>('chat://stream', (event) => {
            const { requestId, text } = event.payload;
            const stateBeforeStream = get();
            if (!shouldAcceptRequestEvent(stateBeforeStream, requestId)) return;
            bindPendingRequestIfNeeded(set, stateBeforeStream, requestId);

            // 解析 daemon 的标签化输出。daemon stdout 每行都带标签前缀，
            // 只有 [CONTENT_DELTA] 是真正要显示的回复文本，其余（[DEBUG]、
            // [LIFECYCLE]、[MESSAGE]、[MESSAGE_START] 等）是协议/诊断信息，
            // 不应渲染到消息气泡里。参考 jcc-gui 的 ClaudeStreamAdapter。

            // [SESSION_ID]：保存会话 ID，供后续消息延续上下文。
            if (text.startsWith('[SESSION_ID]') || text.startsWith('[THREAD_ID]')) {
                const marker = text.startsWith('[THREAD_ID]') ? '[THREAD_ID]' : '[SESSION_ID]';
                const sid = text.slice(marker.length).trim();
                if (sid) set({ sessionId: sid, handoffContextProvider: null });
                return;
            }

            // [CONTENT_DELTA]：JSON 编码的文本增量，追加到当前流式消息。
            if (text.startsWith('[CONTENT_DELTA]')) {
                const payload = text.slice('[CONTENT_DELTA]'.length).trim();
                let delta = payload;
                try {
                    delta = JSON.parse(payload) as string;
                } catch {
                    // 非 JSON，按原文处理
                }
                appendToStreamingAssistant(set, delta);
                return;
            }

            // [CONTENT]：非流式模式的完整文本块（直接追加）。
            if (text.startsWith('[CONTENT]')) {
                const content = text.slice('[CONTENT]'.length).trim();
                appendToStreamingAssistant(set, content);
                return;
            }

            // [USAGE]：本轮 token 用量，保存到当前流式 assistant 消息。
            if (text.startsWith('[USAGE]')) {
                const payload = text.slice('[USAGE]'.length).trim();
                try {
                    const usage = JSON.parse(payload) as TokenUsage;
                    set((state) => {
                        const messages = [...state.messages];
                        for (let i = messages.length - 1; i >= 0; i--) {
                            if (messages[i].role === 'assistant' && messages[i].streaming) {
                                messages[i] = { ...messages[i], usage };
                                break;
                            }
                        }
                        // 上下文 token ≈ 本轮输入(含缓存) + 输出，作为用量环的估算值。
                        const contextTokens =
                            (usage.input_tokens || 0) +
                            (usage.cache_read_input_tokens || 0) +
                            (usage.cache_creation_input_tokens || 0) +
                            (usage.output_tokens || 0);
                        return { messages, contextTokens };
                    });
                } catch {
                    // 忽略解析失败
                }
                return;
            }

            // 其余标签行（[DEBUG]/[LIFECYCLE]/[MESSAGE]/[MESSAGE_START]/
            // [STREAM_START]/[STREAM_END]/[BLOCK_RESET] 等）忽略，
            // 不渲染为消息内容。[MESSAGE] 由 chat://message 事件单独处理。
        });

        const doneUn = await listen<ChatDoneEvent>('chat://done', (event) => {
            const { requestId, success, error } = event.payload;
            const stateBeforeDone = get();
            if (!shouldAcceptRequestEvent(stateBeforeDone, requestId)) return;
            bindPendingRequestIfNeeded(set, stateBeforeDone, requestId);
            notifyStoppedRequestOnce(
                requestId,
                success ? 'success' : 'error',
                stateBeforeDone.provider,
                success ? getLastAssistantTextPreview(stateBeforeDone.messages) : error,
            );
            retireRequestOwnership(requestId);

            set((state) => ({
                activeRequestId: null,
                messages: state.messages.map((m) =>
                    m.role === 'assistant' && m.streaming
                        ? {
                              ...m,
                              streaming: false,
                              error: success ? m.error : error || '执行失败',
                              // 记录本轮耗时（从消息创建到流式结束）
                              durationMs: Date.now() - m.createdAt,
                          }
                        : m,
                ),
            }));
        });

        const daemonUn = await listen<ChatDaemonEvent>('chat://daemon', (event) => {
            const { event: name, message } = event.payload;
            if (name === 'ready') {
                clearDaemonReadyTimeout();
                set({ daemonReady: true, daemonStatus: 'ready', daemonReconnecting: false });
            } else if (name === 'shutdown') {
                clearDaemonReadyTimeout();
                set({ daemonReady: false, daemonStatus: 'shutdown', daemonReconnecting: false });
            } else {
                set({ daemonStatus: message ? `${name}: ${message}` : name });
            }
        });

        const askUserUn = await listen<AskUserQuestionRequest>('permission://ask-user-question', (event) => {
            set((state) => {
                const next = enqueuePermissionRequest(
                    state.pendingAskUserQuestion,
                    state.pendingAskUserQuestionQueue,
                    state.askUserQuestionResponseInFlightRequestId,
                    event.payload,
                );
                return {
                    pendingAskUserQuestion: next.pending,
                    pendingAskUserQuestionQueue: next.queue,
                };
            });
        });

        const planApprovalUn = await listen<PlanApprovalRequest>('permission://plan-approval', (event) => {
            set((state) => {
                const next = enqueuePermissionRequest(
                    state.pendingPlanApproval,
                    state.pendingPlanApprovalQueue,
                    state.planApprovalResponseInFlightRequestId,
                    event.payload,
                );
                return {
                    pendingPlanApproval: next.pending,
                    pendingPlanApprovalQueue: next.queue,
                };
            });
        });

        const toolPermissionUn = await listen<ToolPermissionRequest>('permission://tool', (event) => {
            set((state) => {
                const next = enqueuePermissionRequest(
                    state.pendingToolPermission,
                    state.pendingToolPermissionQueue,
                    state.toolPermissionResponseInFlightRequestId,
                    event.payload,
                );
                return {
                    pendingToolPermission: next.pending,
                    pendingToolPermissionQueue: next.queue,
                };
            });
        });

        // 监听 chat://message 事件（工具调用可视化）
        const messageUn = await listen<ChatMessageEvent>('chat://message', (event) => {
            try {
                const { requestId } = event.payload;
                const stateBeforeMessage = get();
                if (!shouldAcceptRequestEvent(stateBeforeMessage, requestId)) return;
                bindPendingRequestIfNeeded(set, stateBeforeMessage, requestId);
                const raw = JSON.parse(event.payload.json) as MessageRaw;

                set((state) => {
                    const messages = mergeRawChatMessage(state.messages, raw, {
                        createId: newId,
                        now: Date.now,
                    });
                    return { messages };
                });
            } catch (e) {
                console.error('[useChatStore] Failed to parse MESSAGE:', e);
            }
        });

        unlisteners = [streamUn, doneUn, daemonUn, askUserUn, planApprovalUn, toolPermissionUn, messageUn];

        // 预热 daemon（懒启动也可，但提前启动可减少首条消息延迟）
        try {
            await invoke('chat_start_daemon');
            if (!get().daemonReady && get().daemonStatus === 'starting') {
                scheduleDaemonReadyTimeout(get, set);
            }
        } catch (e) {
            set({
                daemonReady: false,
                daemonStatus: 'error',
                daemonReconnecting: false,
                error: String(e),
            });
        }
    },

    reconnectDaemon: async () => {
        if (get().daemonReconnecting) return;
        clearDaemonReadyTimeout();
        set({
            daemonReady: false,
            daemonStatus: 'starting',
            daemonReconnecting: true,
            error: null,
        });
        try {
            await invoke('chat_start_daemon');
            scheduleDaemonReadyTimeout(get, set);
        } catch (e) {
            clearDaemonReadyTimeout();
            set({
                daemonReady: false,
                daemonStatus: 'error',
                daemonReconnecting: false,
                error: String(e),
            });
        }
    },

    setProvider: (p) => {
        if (hasActiveChatTurn(get())) return;
        const currentProvider = get().provider;
        latestSessionLoadToken += 1;
        // 如果 provider 没有变化，不重新加载草稿
        if (currentProvider === p) {
            set({ provider: p, pendingSessionKey: null, lastSessionLoadMetrics: null });
            return;
        }

        // 切换 provider 时同步切换持久化的模型与草稿，并校正推理档位。
        const provider = p as ChatProviderId;
        const model = defaultModel(provider);
        const levels = reasoningLevelsFor(provider, model);
        set((state) => ({
            provider: p,
            model,
            draft: loadDraft(provider),
            sessionId: null,
            activeSession: null,
            pendingSessionKey: null,
            lastSessionLoadMetrics: null,
            handoffContextProvider: state.messages.some(hasHandoffContent) ? currentProvider : null,
            reasoningEffort: levels.some((l) => l.id === state.reasoningEffort)
                ? state.reasoningEffort
                : (levels[levels.length - 1]?.id ?? 'high'),
        }));
    },

    setPermissionMode: (m) => {
        if (hasActiveChatTurn(get())) return;
        set({ permissionMode: m });
    },

    setModel: (id) => {
        if (hasActiveChatTurn(get())) return;
        try {
            localStorage.setItem(CHAT_MODEL_SELECTION_KEY_PREFIX + get().provider, id);
        } catch {
            // ignore
        }
        // 切模型后校正推理档位（避免停留在新模型不支持的档）。
        const levels = reasoningLevelsFor(get().provider as ChatProviderId, id);
        set((state) => ({
            model: id,
            reasoningEffort: levels.some((l) => l.id === state.reasoningEffort)
                ? state.reasoningEffort
                : (levels[levels.length - 1]?.id ?? 'high'),
        }));
    },

    setReasoningEffort: (e) => {
        if (hasActiveChatTurn(get())) return;
        try {
            localStorage.setItem(REASONING_KEY, e);
        } catch {
            // ignore
        }
        set({ reasoningEffort: e });
    },

    setDraft: (text) => {
        try {
            localStorage.setItem(DRAFT_KEY_PREFIX + get().provider, text);
        } catch {
            // ignore
        }
        set({ draft: text });
    },

    send: async (text, opts) => {
        const trimmed = text.trim();
        const attachments = opts?.attachments?.filter((attachment) => (
            attachment.fileName.trim().length > 0
        )) ?? [];
        const hasAttachments = attachments.length > 0;
        if (!trimmed && !hasAttachments) return false;
        latestSessionLoadToken += 1;
        const chatTurnToken = ++latestChatTurnToken;
        prepareChatTurnStoppedNotificationPermission();

        const messageText = trimmed || ATTACHMENT_ONLY_MESSAGE;
        const stateBeforeSend = get();
        const outboundMessage = stateBeforeSend.handoffContextProvider
            && stateBeforeSend.handoffContextProvider !== stateBeforeSend.provider
            && !stateBeforeSend.sessionId
            ? buildProviderHandoffMessage(
                messageText,
                stateBeforeSend.messages,
                stateBeforeSend.handoffContextProvider,
                stateBeforeSend.provider,
            )
            : messageText;
        const displayText = opts?.displayText?.trim() || messageText;

        const userMsg: ChatMessage = {
            id: newId(),
            role: 'user',
            content: displayText,
            raw: buildUserRawMessage(trimmed, attachments),
            createdAt: Date.now(),
        };
        const assistantMsg: ChatMessage = {
            id: newId(),
            role: 'assistant',
            content: '',
            streaming: true,
            createdAt: Date.now(),
        };
        set((state) => ({
            messages: [...state.messages, userMsg, assistantMsg],
            error: null,
            draft: '',
            pendingSessionKey: null,
            lastSessionLoadMetrics: null,
        }));
        // 发送即清空持久化草稿。
        try {
            localStorage.removeItem(DRAFT_KEY_PREFIX + get().provider);
        } catch {
            // ignore
        }

        const { provider, sessionId, permissionMode, model, reasoningEffort, currentCwd } = get();
        const params: Record<string, unknown> = {
            message: outboundMessage,
            sessionId: provider === 'claude' ? (sessionId ?? undefined) : undefined,
            threadId: provider === 'codex' ? (sessionId ?? undefined) : undefined,
            cwd: opts?.cwd ?? currentCwd ?? undefined,
            model: opts?.model ?? model,
            permissionMode,
            reasoningEffort,
            streaming: true,
        };

        if (hasAttachments) {
            params.attachments = provider === 'codex'
                ? attachments.map((attachment) => (
                    attachment.path
                        ? { type: 'local_image', path: attachment.path }
                        : attachment
                ))
                : attachments;
        }

        try {
            const requestId = await invoke<string>('chat_send', {
                provider,
                command: provider === 'claude' && hasAttachments ? 'sendWithAttachments' : 'send',
                params,
            });
            if (chatTurnToken !== latestChatTurnToken) {
                retireRequestOwnership(requestId);
                return true;
            }
            set({ activeRequestId: requestId });
            return true;
        } catch (e) {
            if (chatTurnToken !== latestChatTurnToken) {
                return true;
            }
            notifyStoppedRequestOnce(
                `send-error:${assistantMsg.id}`,
                'error',
                provider,
                String(e),
            );
            set((state) => ({
                error: String(e),
                messages: state.messages.map((m) =>
                    m.id === assistantMsg.id
                        ? { ...m, streaming: false, error: String(e) }
                        : m,
                ),
            }));
            return false;
        }
    },

    loadSession: async (session) => {
        if (!isChatProvider(session.providerId)) {
            set({
                error: `Unsupported chat provider: ${session.providerId}`,
                lastSessionLoadMetrics: null,
            });
            return;
        }
        const provider = session.providerId;

        const pendingSessionKey = getSessionSelectionKey(session);
        const currentState = get();
        const isCurrentSession = currentState.activeSession
            ? getSessionSelectionKey(currentState.activeSession) === pendingSessionKey
            : false;
        if (
            isCurrentSession
            && !currentState.activeRequestId
            && !currentState.pendingSessionKey
        ) {
            return;
        }

        const loadToken = ++latestSessionLoadToken;
        const startedAt = nowMs();
        const baseMetrics = createSessionLoadMetrics(session, startedAt);
        let abortedActiveTurn = false;
        let abortError: string | null = null;
        set({
            pendingSessionKey,
            error: null,
            lastSessionLoadMetrics: baseMetrics,
        });

        try {
            abortedActiveTurn = hasActiveChatTurn(get());
            abortError = await abortActiveRequestIfNeeded(get, set);
            const cachedHistory = getCachedSessionHistory(session);
            if (cachedHistory) {
                if (loadToken !== latestSessionLoadToken) {
                    return;
                }
                const displayHistory = getSessionHistoryDisplayWindow(cachedHistory);
                const completedAt = nowMs();
                const cacheMetrics = finishSessionLoadMetrics(
                    {
                        ...baseMetrics,
                        cacheHit: true,
                        windowMessageCount: displayHistory.length,
                        totalMessageCount: cachedHistory.length,
                        fullMessageCount: cachedHistory.length,
                    },
                    completedAt,
                    'complete',
                );
                set((state) => ({
                    ...getLoadedSessionState(session, provider, displayHistory, state),
                    lastSessionLoadMetrics: cacheMetrics,
                    error: abortError,
                }));
                return;
            }

            const windowLoadStartedAt = nowMs();
            const historyWindow = await invoke<UnifiedSessionMessageWindow>('get_unified_session_message_window', {
                providerId: session.providerId,
                sourcePath: session.sourcePath,
                tailLimit: SESSION_HISTORY_FIRST_PAINT_LIMIT,
            });
            const windowLoadedAt = nowMs();
            if (loadToken !== latestSessionLoadToken) {
                return;
            }

            const mappedHistoryWindow = mapHistoryMessages(
                session,
                historyWindow.messages,
                historyWindow.startIndex,
            );
            const windowMappedAt = nowMs();
            const windowStatus: ChatSessionLoadMetrics['status'] = historyWindow.complete ? 'complete' : 'windowed';
            const windowMetrics: ChatSessionLoadMetrics = {
                ...baseMetrics,
                status: windowStatus,
                completedAt: windowMappedAt,
                elapsedMs: windowMappedAt - baseMetrics.startedAt,
                windowMessageCount: historyWindow.messages.length,
                totalMessageCount: historyWindow.totalCount,
                fullMessageCount: historyWindow.complete ? mappedHistoryWindow.length : null,
                windowLoadMs: windowLoadedAt - windowLoadStartedAt,
                windowMapMs: windowMappedAt - windowLoadedAt,
            };
            set((state) => ({
                ...getLoadedSessionState(session, provider, mappedHistoryWindow, state),
                lastSessionLoadMetrics: windowMetrics,
                error: abortError,
            }));

            if (historyWindow.complete) {
                rememberSessionHistory(session, mappedHistoryWindow);
            }
        } catch (e) {
            if (loadToken !== latestSessionLoadToken) {
                return;
            }
            const errorText = String(e);
            const currentMetrics = get().lastSessionLoadMetrics;
            const metricsForError = currentMetrics?.sessionKey === baseMetrics.sessionKey
                ? currentMetrics
                : baseMetrics;
            const errorMetrics = finishSessionLoadMetrics(
                metricsForError,
                nowMs(),
                'error',
                errorText,
            );
            set((state) => ({
                messages: abortedActiveTurn
                    ? stopStreamingAssistantMessages(state.messages, abortError ?? STOPPED_OUTPUT_ERROR)
                    : state.messages,
                error: errorText,
                pendingSessionKey: null,
                lastSessionLoadMetrics: errorMetrics,
            }));
        }
    },

    loadActiveSessionFullHistory: async () => {
        const stateBeforeLoad = get();
        const session = stateBeforeLoad.activeSession;
        if (!session || !isChatProvider(session.providerId)) {
            return null;
        }

        const loadToken = latestSessionLoadToken;
        const sessionKey = getSessionSelectionKey(session);
        const startedAt = nowMs();
        const currentMetrics = stateBeforeLoad.lastSessionLoadMetrics?.sessionKey === sessionKey
            ? stateBeforeLoad.lastSessionLoadMetrics
            : createSessionLoadMetrics(session, startedAt);
        const cachedHistory = getCachedSessionHistory(session);

        if (cachedHistory) {
            if (!isActiveSessionLoadCurrent(get(), session, loadToken)) {
                return null;
            }
            const completedAt = nowMs();
            const displayHistory = getSessionHistoryDisplayWindow(cachedHistory);
            const cacheMetrics = finishSessionLoadMetrics(
                {
                    ...currentMetrics,
                    cacheHit: true,
                    windowMessageCount: displayHistory.length,
                    totalMessageCount: cachedHistory.length,
                    fullMessageCount: cachedHistory.length,
                    fullLoadMs: currentMetrics.fullLoadMs ?? 0,
                    fullMapMs: currentMetrics.fullMapMs ?? 0,
                    error: null,
                },
                completedAt,
                'complete',
            );
            set({lastSessionLoadMetrics: cacheMetrics, error: null});
            return cachedHistory;
        }

        const fullLoadStartedAt = nowMs();
        set({
            lastSessionLoadMetrics: {
                ...currentMetrics,
                status: 'loading',
                completedAt: null,
                elapsedMs: null,
                error: null,
            },
            error: null,
        });

        try {
            const history = await invoke<UnifiedSessionMessage[]>('get_unified_session_messages', {
                providerId: session.providerId,
                sourcePath: session.sourcePath,
            });
            const fullLoadedAt = nowMs();
            if (!isActiveSessionLoadCurrent(get(), session, loadToken)) {
                return null;
            }

            const mappedHistory = await mapHistoryMessagesInChunks(session, history);
            const fullMappedAt = nowMs();
            if (!isActiveSessionLoadCurrent(get(), session, loadToken)) {
                return null;
            }

            rememberSessionHistory(session, mappedHistory);
            const displayHistory = getSessionHistoryDisplayWindow(mappedHistory);
            const fullMetrics = finishSessionLoadMetrics(
                {
                    ...currentMetrics,
                    cacheHit: false,
                    windowMessageCount: displayHistory.length,
                    totalMessageCount: history.length,
                    fullMessageCount: mappedHistory.length,
                    fullLoadMs: fullLoadedAt - fullLoadStartedAt,
                    fullMapMs: fullMappedAt - fullLoadedAt,
                    error: null,
                },
                fullMappedAt,
                'complete',
            );
            set({lastSessionLoadMetrics: fullMetrics, error: null});
            return mappedHistory;
        } catch (e) {
            if (!isActiveSessionLoadCurrent(get(), session, loadToken)) {
                return null;
            }
            const errorText = String(e);
            const errorMetrics = finishSessionLoadMetrics(
                currentMetrics,
                nowMs(),
                'error',
                errorText,
            );
            set({lastSessionLoadMetrics: errorMetrics, error: errorText});
            return null;
        }
    },

    startNewSession: async (cwd) => {
        latestSessionLoadToken += 1;
        const abortError = await abortActiveRequestIfNeeded(get, set);
        set((state) => ({
            messages: [],
            sessionId: null,
            activeSession: null,
            pendingSessionKey: null,
            lastSessionLoadMetrics: null,
            handoffContextProvider: null,
            currentCwd: cwd ?? state.currentCwd,
            activeRequestId: null,
            contextTokens: 0,
            error: abortError,
        }));
    },

    abort: async () => {
        const stateBeforeAbort = get();
        const { activeRequestId, provider, messages } = stateBeforeAbort;
        if (hasActiveChatTurn(stateBeforeAbort)) {
            latestChatTurnToken += 1;
        }
        prepareChatTurnStoppedNotificationPermission();

        try {
            await invoke('chat_abort');
            notifyStoppedRequestOnce(
                activeRequestId,
                'aborted',
                provider,
                getLastAssistantTextPreview(messages),
            );
        } catch (e) {
            set({ error: String(e) });
        }
        retireRequestOwnership(activeRequestId);
        set((state) => ({
            activeRequestId: null,
            messages: state.messages.map((message) => (
                message.role === 'assistant' && message.streaming
                    ? {
                        ...message,
                        streaming: false,
                        error: message.error ?? STOPPED_OUTPUT_ERROR,
                        durationMs: Date.now() - message.createdAt,
                    }
                    : message
            )),
        }));
    },

    clear: async () => {
        latestSessionLoadToken += 1;
        const abortError = await abortActiveRequestIfNeeded(get, set);
        set({
            messages: [],
            sessionId: null,
            activeSession: null,
            pendingSessionKey: null,
            lastSessionLoadMetrics: null,
            handoffContextProvider: null,
            error: abortError,
            contextTokens: 0,
        });
    },

    answerAskUserQuestion: async (requestId, answers) => {
        const pending = get().pendingAskUserQuestion;
        if (pending?.requestId !== requestId) return;
        set({ pendingAskUserQuestion: null, askUserQuestionResponseInFlightRequestId: requestId });
        try {
            await invoke('permission_respond_ask_user_question', {
                requestId,
                sessionId: permissionSessionId(pending),
                answers,
            });
            set((state) => {
                if (state.pendingAskUserQuestion) {
                    return {askUserQuestionResponseInFlightRequestId: null};
                }
                const next = nextPermissionRequest(state.pendingAskUserQuestionQueue);
                return {
                    pendingAskUserQuestion: next.pending,
                    pendingAskUserQuestionQueue: next.queue,
                    askUserQuestionResponseInFlightRequestId: null,
                };
            });
        } catch (e) {
            set((state) => ({
                error: String(e),
                pendingAskUserQuestion: state.pendingAskUserQuestion ?? clonePermissionRequest(pending),
                askUserQuestionResponseInFlightRequestId: null,
            }));
        }
    },

    answerToolPermission: async (requestId, allow) => {
        const pending = get().pendingToolPermission;
        if (pending?.requestId !== requestId) return;
        set({ pendingToolPermission: null, toolPermissionResponseInFlightRequestId: requestId });
        try {
            await invoke('permission_respond_tool', {
                requestId,
                sessionId: permissionSessionId(pending),
                allow,
            });
            set((state) => {
                if (state.pendingToolPermission) {
                    return {toolPermissionResponseInFlightRequestId: null};
                }
                const next = nextPermissionRequest(state.pendingToolPermissionQueue);
                return {
                    pendingToolPermission: next.pending,
                    pendingToolPermissionQueue: next.queue,
                    toolPermissionResponseInFlightRequestId: null,
                };
            });
        } catch (e) {
            set((state) => ({
                error: String(e),
                pendingToolPermission: state.pendingToolPermission ?? clonePermissionRequest(pending),
                toolPermissionResponseInFlightRequestId: null,
            }));
        }
    },

    approvePlan: async (requestId, approved, targetMode) => {
        const pending = get().pendingPlanApproval;
        if (pending?.requestId !== requestId) return;
        set({ pendingPlanApproval: null, planApprovalResponseInFlightRequestId: requestId });
        try {
            await invoke('permission_respond_plan_approval', {
                requestId,
                sessionId: permissionSessionId(pending),
                approved,
                targetMode,
                message: null,
            });
            set((state) => {
                if (state.pendingPlanApproval) {
                    return {planApprovalResponseInFlightRequestId: null};
                }
                const next = nextPermissionRequest(state.pendingPlanApprovalQueue);
                return {
                    pendingPlanApproval: next.pending,
                    pendingPlanApprovalQueue: next.queue,
                    planApprovalResponseInFlightRequestId: null,
                };
            });
        } catch (e) {
            set((state) => ({
                error: String(e),
                pendingPlanApproval: state.pendingPlanApproval ?? clonePermissionRequest(pending),
                planApprovalResponseInFlightRequestId: null,
            }));
        }
    },

    addDeniedTool: (toolId) =>
        set((state) => ({
            deniedToolIds: new Set(state.deniedToolIds).add(toolId),
        })),

    clearDeniedTools: () => set({ deniedToolIds: new Set() }),
}));
