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
} from '../types/chat';
import {
    AskUserQuestionRequest,
    PlanApprovalRequest,
} from '../types/permission';

interface ChatState {
    messages: ChatMessage[];
    /** 当前 provider */
    provider: ChatProvider;
    /**
     * 权限模式。'default' 下工具调用会触发权限请求；在权限审批 UI 完成前
     * （后续任务），纯文本对话用 'default' 即可，涉及工具的复杂任务可临时用
     * 'bypassPermissions'（自动放行，请仅在信任的工作目录使用）。
     */
    permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
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

    init: () => Promise<void>;
    setProvider: (p: ChatProvider) => void;
    setPermissionMode: (m: ChatState['permissionMode']) => void;
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

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    provider: 'claude',
    permissionMode: 'default',
    daemonReady: false,
    daemonStatus: null,
    activeRequestId: null,
    sessionId: null,
    initialized: false,
    error: null,
    pendingAskUserQuestion: null,
    pendingPlanApproval: null,

    init: async () => {
        if (get().initialized) return;
        set({ initialized: true });

        // 清理可能的旧监听器（热重载场景）
        unlisteners.forEach((u) => u());
        unlisteners = [];

        const streamUn = await listen<ChatStreamEvent>('chat://stream', (event) => {
            const { text } = event.payload;

            // 不依赖 requestId 映射：直接找最后一条 streaming 的 assistant 消息追加内容。
            // daemon 响应极快，done/stream 事件可能在 invoke 返回前到达，无法靠
            // requestId→消息 映射定位（映射尚未建立）。单请求模式下按 streaming 状态定位最稳。
            set((state) => {
                const messages = [...state.messages];
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'assistant' && messages[i].streaming) {
                        messages[i] = {
                            ...messages[i],
                            content: messages[i].content + text + '\n',
                        };
                        break;
                    }
                }
                return { messages };
            });
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

    setProvider: (p) => set({ provider: p }),

    setPermissionMode: (m) => set({ permissionMode: m }),

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
        }));

        const { provider, sessionId, permissionMode } = get();
        const params: Record<string, unknown> = {
            message: trimmed,
            sessionId: sessionId ?? undefined,
            cwd: opts?.cwd,
            model: opts?.model,
            permissionMode,
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

    clear: () => set({ messages: [], sessionId: null, error: null }),

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
}));

