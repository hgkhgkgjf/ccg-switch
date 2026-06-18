import {create} from 'zustand';
import {invoke} from '@tauri-apps/api/core';
import {listen, type UnlistenFn} from '@tauri-apps/api/event';
import {
    ChatAttachment,
    ChatDaemonEvent,
    ChatDoneEvent,
    ChatMessage,
    ChatProvider,
    ChatRole,
    ChatStreamEvent,
    ContentBlock,
    ImageBlock,
    MessageRaw,
    TokenUsage,
} from '../types/chat';
import {getSessionSelectionKey, type SessionMeta, type UnifiedSessionMessage} from '../types/session';
import {AskUserQuestionRequest, PlanApprovalRequest, ToolPermissionRequest,} from '../types/permission';
import type {ChatProviderId, PermissionMode, ReasoningEffort,} from '../components/chat/composer/constants';
import {CLAUDE_MODELS, CODEX_MODELS, reasoningLevelsFor,} from '../components/chat/composer/constants';
import {isProtocolContextText, mergeRawChatMessage, TOOL_RESULT_CONTENT} from '../utils/chatMessageFlow';
import {
    type ChatTurnStopOutcome,
    notifyChatTurnStopped,
    prepareChatTurnStoppedNotificationPermission,
} from '../utils/desktopNotification';

const DRAFT_KEY_PREFIX = 'ccg-chat-draft:';
const MODEL_KEY_PREFIX = 'ccg-chat-model:';
const REASONING_KEY = 'ccg-chat-reasoning';
const HANDOFF_CONTEXT_MAX_MESSAGES = 24;
const HANDOFF_CONTEXT_MAX_CHARS = 12_000;
const ATTACHMENT_ONLY_MESSAGE = 'Please analyze the attached image(s).';
const SESSION_HISTORY_CACHE_LIMIT = 8;
const STOPPED_REQUEST_NOTIFICATION_LIMIT = 64;
const STOPPED_OUTPUT_ERROR = '已停止输出';
const stoppedRequestNotifications = new Set<string>();

function loadDraft(provider: ChatProviderId): string {
    try {
        return localStorage.getItem(DRAFT_KEY_PREFIX + provider) ?? '';
    } catch {
        return '';
    }
}

function defaultModel(provider: ChatProviderId): string {
    try {
        const saved = localStorage.getItem(MODEL_KEY_PREFIX + provider);
        if (saved) return saved;
    } catch {
        // ignore
    }
    return provider === 'codex' ? CODEX_MODELS[0].id : CLAUDE_MODELS[0].id;
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
    /** provider 切换后，下一次无原生 session 的发送需要携带的历史来源 */
    handoffContextProvider: ChatProvider | null;
    /** 事件监听器是否已注册 */
    initialized: boolean;
    error: string | null;
    /** 待审批的 AskUserQuestion 请求（弹窗） */
    pendingAskUserQuestion: AskUserQuestionRequest | null;
    /** 待审批的 PlanApproval 请求（弹窗） */
    pendingPlanApproval: PlanApprovalRequest | null;
    /** 待审批的普通工具权限请求（弹窗） */
    pendingToolPermission: ToolPermissionRequest | null;
    /** 被用户拒绝的工具调用 ID 集合 */
    deniedToolIds: Set<string>;

    init: () => Promise<void>;
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
    }) => Promise<void>;
    loadSession: (session: SessionMeta) => Promise<void>;
    startNewSession: (cwd?: string | null) => Promise<void>;
    abort: () => Promise<void>;
    clear: () => Promise<void>;
    answerAskUserQuestion: (requestId: string, answers: Record<string, string>) => Promise<void>;
    answerToolPermission: (requestId: string, allow: boolean) => Promise<void>;
    approvePlan: (requestId: string, approved: boolean, targetMode: string) => Promise<void>;
}

let unlisteners: UnlistenFn[] = [];
let latestSessionLoadToken = 0;
const sessionHistoryCache = new Map<string, ChatMessage[]>();

function newId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
                messages[i] = {
                    ...messages[i],
                    content: messages[i].content + delta,
                };
                break;
            }
        }
        return { messages };
    });
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

function getSessionHistoryCacheKey(session: SessionMeta): string {
    return [
        session.providerId,
        session.sourcePath,
        session.sessionId,
        session.lastActiveAt,
    ].join('::');
}

function cloneHistoryMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((message) => ({...message}));
}

function getCachedSessionHistory(session: SessionMeta): ChatMessage[] | null {
    const key = getSessionHistoryCacheKey(session);
    const cached = sessionHistoryCache.get(key);
    if (!cached) return null;

    sessionHistoryCache.delete(key);
    sessionHistoryCache.set(key, cached);
    return cloneHistoryMessages(cached);
}

function rememberSessionHistory(session: SessionMeta, messages: ChatMessage[]): void {
    const key = getSessionHistoryCacheKey(session);
    sessionHistoryCache.delete(key);
    sessionHistoryCache.set(key, cloneHistoryMessages(messages));

    while (sessionHistoryCache.size > SESSION_HISTORY_CACHE_LIMIT) {
        const oldestKey = sessionHistoryCache.keys().next().value;
        if (!oldestKey) break;
        sessionHistoryCache.delete(oldestKey);
    }
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
): Promise<void> {
    if (!get().activeRequestId) return;

    try {
        await invoke('chat_abort');
    } catch (e) {
        set({ error: String(e) });
    }
    set({ activeRequestId: null });
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
    activeRequestId: null,
    sessionId: null,
    currentCwd: null,
    activeSession: null,
    pendingSessionKey: null,
    handoffContextProvider: null,
    initialized: false,
    error: null,
    pendingAskUserQuestion: null,
    pendingPlanApproval: null,
    pendingToolPermission: null,
    deniedToolIds: new Set(),

    init: async () => {
        if (get().initialized) return;
        set({ initialized: true });

        // 清理可能的旧监听器（热重载场景）
        unlisteners.forEach((u) => u());
        unlisteners = [];

        const streamUn = await listen<ChatStreamEvent>('chat://stream', (event) => {
            const { text } = event.payload;

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
            notifyStoppedRequestOnce(
                requestId,
                success ? 'success' : 'error',
                stateBeforeDone.provider,
                success ? getLastAssistantTextPreview(stateBeforeDone.messages) : error,
            );

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
                set({ daemonReady: true, daemonStatus: 'ready' });
            } else if (name === 'shutdown') {
                set({ daemonReady: false, daemonStatus: 'shutdown' });
            } else {
                set({ daemonStatus: message ? `${name}: ${message}` : name });
            }
        });

        const askUserUn = await listen<AskUserQuestionRequest>('permission://ask-user-question', (event) => {
            set({ pendingAskUserQuestion: event.payload });
        });

        const planApprovalUn = await listen<PlanApprovalRequest>('permission://plan-approval', (event) => {
            set({ pendingPlanApproval: event.payload });
        });

        const toolPermissionUn = await listen<ToolPermissionRequest>('permission://tool', (event) => {
            set({ pendingToolPermission: event.payload });
        });

        // 监听 chat://message 事件（工具调用可视化）
        const messageUn = await listen<{ json: string }>('chat://message', (event) => {
            try {
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
        } catch (e) {
            set({ error: String(e) });
        }
    },

    setProvider: (p) => {
        const currentProvider = get().provider;
        latestSessionLoadToken += 1;
        // 如果 provider 没有变化，不重新加载草稿
        if (currentProvider === p) {
            set({ provider: p, pendingSessionKey: null });
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
            handoffContextProvider: state.messages.some(hasHandoffContent) ? currentProvider : null,
            reasoningEffort: levels.some((l) => l.id === state.reasoningEffort)
                ? state.reasoningEffort
                : (levels[levels.length - 1]?.id ?? 'high'),
        }));
    },

    setPermissionMode: (m) => set({ permissionMode: m }),

    setModel: (id) => {
        try {
            localStorage.setItem(MODEL_KEY_PREFIX + get().provider, id);
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
        if (!trimmed && !hasAttachments) return;
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
            set({ activeRequestId: requestId });
        } catch (e) {
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
        }
    },

    loadSession: async (session) => {
        if (!isChatProvider(session.providerId)) {
            set({ error: `Unsupported chat provider: ${session.providerId}` });
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
        set({
            pendingSessionKey,
            error: null,
        });

        try {
            await abortActiveRequestIfNeeded(get, set);
            const cachedHistory = getCachedSessionHistory(session);
            if (cachedHistory) {
                if (loadToken !== latestSessionLoadToken) {
                    return;
                }
                set((state) => getLoadedSessionState(session, provider, cachedHistory, state));
                return;
            }

            const history = await invoke<UnifiedSessionMessage[]>('get_unified_session_messages', {
                providerId: session.providerId,
                sourcePath: session.sourcePath,
            });
            if (loadToken !== latestSessionLoadToken) {
                return;
            }
            const mappedHistory = history.map((message, index) => mapHistoryMessage(session, message, index));
            rememberSessionHistory(session, mappedHistory);
            set((state) => ({
                ...getLoadedSessionState(session, provider, mappedHistory, state),
            }));
        } catch (e) {
            if (loadToken !== latestSessionLoadToken) {
                return;
            }
            set({
                error: String(e),
                pendingSessionKey: null,
            });
        }
    },

    startNewSession: async (cwd) => {
        latestSessionLoadToken += 1;
        await abortActiveRequestIfNeeded(get, set);
        set((state) => ({
            messages: [],
            sessionId: null,
            activeSession: null,
            pendingSessionKey: null,
            handoffContextProvider: null,
            currentCwd: cwd ?? state.currentCwd,
            activeRequestId: null,
            contextTokens: 0,
            error: null,
        }));
    },

    abort: async () => {
        const { activeRequestId, provider, messages } = get();
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
        await abortActiveRequestIfNeeded(get, set);
        set({
            messages: [],
            sessionId: null,
            activeSession: null,
            pendingSessionKey: null,
            handoffContextProvider: null,
            error: null,
            contextTokens: 0,
        });
    },

    answerAskUserQuestion: async (requestId, answers) => {
        try {
            await invoke('permission_respond_ask_user_question', { requestId, answers });
            set({ pendingAskUserQuestion: null });
        } catch (e) {
            set({ error: String(e) });
        }
    },

    answerToolPermission: async (requestId, allow) => {
        try {
            await invoke('permission_respond_tool', { requestId, allow });
            set({ pendingToolPermission: null });
        } catch (e) {
            set({ error: String(e) });
        }
    },

    approvePlan: async (requestId, approved, targetMode) => {
        try {
            await invoke('permission_respond_plan_approval', {
                requestId,
                approved,
                targetMode,
                message: null,
            });
            set({ pendingPlanApproval: null });
        } catch (e) {
            set({ error: String(e) });
        }
    },

    addDeniedTool: (toolId) =>
        set((state) => ({
            deniedToolIds: new Set(state.deniedToolIds).add(toolId),
        })),

    clearDeniedTools: () => set({ deniedToolIds: new Set() }),
}));
