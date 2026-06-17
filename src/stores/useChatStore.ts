import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
    ChatMessage,
    ChatStreamEvent,
    ChatDoneEvent,
    ChatDaemonEvent,
    ChatProvider,
    MessageRaw,
    TokenUsage,
} from '../types/chat';
import {
    AskUserQuestionRequest,
    PlanApprovalRequest,
} from '../types/permission';
import type {
    PermissionMode,
    ReasoningEffort,
    ChatProviderId,
} from '../components/chat/composer/constants';
import {
    CLAUDE_MODELS,
    CODEX_MODELS,
    reasoningLevelsFor,
} from '../components/chat/composer/constants';

const DRAFT_KEY_PREFIX = 'ccg-chat-draft:';
const MODEL_KEY_PREFIX = 'ccg-chat-model:';
const REASONING_KEY = 'ccg-chat-reasoning';

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
    /** 事件监听器是否已注册 */
    initialized: boolean;
    error: string | null;
    /** 待审批的 AskUserQuestion 请求（弹窗） */
    pendingAskUserQuestion: AskUserQuestionRequest | null;
    /** 待审批的 PlanApproval 请求（弹窗） */
    pendingPlanApproval: PlanApprovalRequest | null;
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
    send: (text: string, opts?: { cwd?: string; model?: string }) => Promise<void>;
    abort: () => Promise<void>;
    clear: () => void;
    answerAskUserQuestion: (requestId: string, answers: Record<string, string>) => Promise<void>;
    approvePlan: (requestId: string, approved: boolean, targetMode: string) => Promise<void>;
}

let unlisteners: UnlistenFn[] = [];

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
    initialized: false,
    error: null,
    pendingAskUserQuestion: null,
    pendingPlanApproval: null,
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
            if (text.startsWith('[SESSION_ID]')) {
                const sid = text.slice('[SESSION_ID]'.length).trim();
                if (sid) set({ sessionId: sid });
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
            const { success, error } = event.payload;

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

        // 监听 chat://message 事件（工具调用可视化）
        const messageUn = await listen<{ json: string }>('chat://message', (event) => {
            try {
                const raw = JSON.parse(event.payload.json) as MessageRaw;

                // 更新最后一条相同角色的消息的 raw 字段
                set((state) => {
                    const messages = [...state.messages];

                    // 手动实现 findLastIndex（向后兼容）
                    let lastIndex = -1;
                    for (let i = messages.length - 1; i >= 0; i--) {
                        if (messages[i].role === raw.type) {
                            lastIndex = i;
                            break;
                        }
                    }

                    if (lastIndex === -1) {
                        console.warn('[useChatStore] Received MESSAGE without existing message');
                        return state;
                    }

                    messages[lastIndex] = {
                        ...messages[lastIndex],
                        raw,
                    };

                    return { messages };
                });
            } catch (e) {
                console.error('[useChatStore] Failed to parse MESSAGE:', e);
            }
        });

        unlisteners = [streamUn, doneUn, daemonUn, askUserUn, planApprovalUn, messageUn];

        // 预热 daemon（懒启动也可，但提前启动可减少首条消息延迟）
        try {
            await invoke('chat_start_daemon');
        } catch (e) {
            set({ error: String(e) });
        }
    },

    setProvider: (p) => {
        const currentProvider = get().provider;
        // 如果 provider 没有变化，不重新加载草稿
        if (currentProvider === p) {
            set({ provider: p });
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
        if (!trimmed) return;

        const userMsg: ChatMessage = {
            id: newId(),
            role: 'user',
            content: trimmed,
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

        const { provider, sessionId, permissionMode, model, reasoningEffort } = get();
        const params: Record<string, unknown> = {
            message: trimmed,
            sessionId: sessionId ?? undefined,
            cwd: opts?.cwd,
            model: opts?.model ?? model,
            permissionMode,
            reasoningEffort,
            streaming: true,
        };

        try {
            const requestId = await invoke<string>('chat_send', {
                provider,
                command: 'send',
                params,
            });
            set({ activeRequestId: requestId });
        } catch (e) {
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

    abort: async () => {
        try {
            await invoke('chat_abort');
        } catch (e) {
            set({ error: String(e) });
        }
        set({ activeRequestId: null });
    },

    clear: () => set({ messages: [], sessionId: null, error: null, contextTokens: 0 }),

    answerAskUserQuestion: async (requestId, answers) => {
        try {
            await invoke('permission_respond_ask_user_question', { requestId, answers });
            set({ pendingAskUserQuestion: null });
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

