import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ChatMessage, MessageRaw} from '../types/chat';
import {getSessionSelectionKey, type SessionMeta, type UnifiedSessionMessage} from '../types/session';
import {findToolResult, getRenderableContentBlocks} from '../utils/chatMessageFlow';
import {buildChatStatusSummary} from '../utils/chatStatusSummary';
import {clearChatSessionHistoryCache, useChatStore} from './useChatStore';

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    listen: vi.fn(async (_eventName: string, _callback: (event: { payload: unknown }) => void) => vi.fn()),
}));

const notificationMocks = vi.hoisted(() => ({
    notifyChatTurnStopped: vi.fn(),
    prepareChatTurnStoppedNotificationPermission: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: tauriMocks.listen,
}));

vi.mock('../utils/desktopNotification', () => ({
    notifyChatTurnStopped: notificationMocks.notifyChatTurnStopped,
    prepareChatTurnStoppedNotificationPermission: notificationMocks.prepareChatTurnStoppedNotificationPermission,
}));

const activeMessages: ChatMessage[] = [
    {
        id: 'u1',
        role: 'user',
        content: 'hello',
        createdAt: 100,
    },
    {
        id: 'a1',
        role: 'assistant',
        content: 'streaming',
        streaming: true,
        createdAt: 101,
    },
];

const loadedSession: SessionMeta = {
    providerId: 'codex',
    sessionId: 'session-1',
    title: 'Loaded session',
    summary: null,
    projectDir: 'C:/guodevelop/ccg-switch',
    createdAt: 1_786_000_000_000,
    lastActiveAt: 1_786_000_100_000,
    sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
    resumeCommand: 'codex resume session-1',
};

const claudeSession: SessionMeta = {
    providerId: 'claude',
    sessionId: 'claude-session-1',
    title: 'Claude session',
    summary: null,
    projectDir: 'C:/guodevelop/ccg-switch',
    createdAt: 1_786_000_000_000,
    lastActiveAt: 1_786_000_100_000,
    sourcePath: 'C:/Users/Administrator/.claude/projects/project/session.jsonl',
    resumeCommand: 'claude --resume claude-session-1',
};

function resetStore() {
    useChatStore.setState({
        messages: [],
        provider: 'claude',
        permissionMode: 'default',
        model: 'claude-opus-4-8',
        reasoningEffort: 'high',
        draft: '',
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
    });
}

describe('useChatStore session transitions', () => {
    beforeEach(() => {
        tauriMocks.invoke.mockReset();
        tauriMocks.listen.mockClear();
        notificationMocks.notifyChatTurnStopped.mockClear();
        notificationMocks.prepareChatTurnStoppedNotificationPermission.mockClear();
        clearChatSessionHistoryCache();
        resetStore();
    });

    it('aborts an active request before starting a new session', async () => {
        useChatStore.setState({
            messages: activeMessages,
            activeRequestId: 'request-1',
            sessionId: 'old-session',
            activeSession: loadedSession,
            currentCwd: 'C:/old-project',
            contextTokens: 42,
        });
        tauriMocks.invoke.mockResolvedValue(undefined);

        await useChatStore.getState().startNewSession('C:/new-project');

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_abort');
        expect(useChatStore.getState()).toMatchObject({
            messages: [],
            sessionId: null,
            activeSession: null,
            currentCwd: 'C:/new-project',
            activeRequestId: null,
            contextTokens: 0,
            error: null,
        });
    });

    it('aborts an active request before loading a history session', async () => {
        const history: UnifiedSessionMessage[] = [
            {
                role: 'user',
                content: 'resume this task',
                ts: '2026-06-17T08:00:00.000Z',
            },
            {
                role: 'assistant',
                content: 'history loaded',
                ts: '2026-06-17T08:00:01.000Z',
            },
        ];
        tauriMocks.invoke.mockImplementation(async (command: string) => {
            if (command === 'chat_abort') return undefined;
            if (command === 'get_unified_session_messages') return history;
            throw new Error(`Unexpected command: ${command}`);
        });
        useChatStore.setState({
            messages: activeMessages,
            activeRequestId: 'request-1',
            sessionId: 'old-session',
            currentCwd: 'C:/old-project',
        });

        await useChatStore.getState().loadSession(loadedSession);

        expect(tauriMocks.invoke).toHaveBeenNthCalledWith(1, 'chat_abort');
        expect(tauriMocks.invoke).toHaveBeenNthCalledWith(2, 'get_unified_session_messages', {
            providerId: 'codex',
            sourcePath: loadedSession.sourcePath,
        });
        expect(useChatStore.getState()).toMatchObject({
            provider: 'codex',
            sessionId: loadedSession.sessionId,
            currentCwd: loadedSession.projectDir,
            activeSession: loadedSession,
            pendingSessionKey: null,
            activeRequestId: null,
            contextTokens: 0,
            error: null,
        });
        expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
            'resume this task',
            'history loaded',
        ]);
    });

    it('marks the selected history session as pending while loading', async () => {
        let resolveHistory: ((value: UnifiedSessionMessage[]) => void) | null = null;
        tauriMocks.invoke.mockImplementation((command: string) => {
            if (command === 'get_unified_session_messages') {
                return new Promise<UnifiedSessionMessage[]>((resolve) => {
                    resolveHistory = resolve;
                });
            }
            throw new Error(`Unexpected command: ${command}`);
        });

        const loadPromise = useChatStore.getState().loadSession(loadedSession);
        await Promise.resolve();

        expect(useChatStore.getState()).toMatchObject({
            pendingSessionKey: getSessionSelectionKey(loadedSession),
            error: null,
        });

        expect(resolveHistory).not.toBeNull();
        resolveHistory!([
            {
                role: 'assistant',
                content: 'loaded later',
                ts: '2026-06-17T08:00:02.000Z',
            },
        ]);
        await loadPromise;

        expect(useChatStore.getState()).toMatchObject({
            activeSession: loadedSession,
            pendingSessionKey: null,
        });
    });

    it('does not reload when selecting the already active history session', async () => {
        useChatStore.setState({
            provider: 'codex',
            sessionId: loadedSession.sessionId,
            activeSession: loadedSession,
            currentCwd: loadedSession.projectDir,
            messages: [
                {
                    id: 'history-existing',
                    role: 'assistant',
                    content: 'already loaded',
                    createdAt: 100,
                },
            ],
        });

        await useChatStore.getState().loadSession(loadedSession);

        expect(tauriMocks.invoke).not.toHaveBeenCalled();
        expect(useChatStore.getState()).toMatchObject({
            activeSession: loadedSession,
            pendingSessionKey: null,
        });
        expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
            'already loaded',
        ]);
    });

    it('reuses cached history for the same session metadata', async () => {
        const history: UnifiedSessionMessage[] = [
            {
                role: 'assistant',
                content: 'cached history',
                ts: '2026-06-17T08:00:03.000Z',
            },
        ];
        tauriMocks.invoke.mockImplementation(async (command: string) => {
            if (command === 'get_unified_session_messages') return history;
            throw new Error(`Unexpected command: ${command}`);
        });

        await useChatStore.getState().loadSession(loadedSession);
        useChatStore.setState({
            messages: [],
            sessionId: null,
            activeSession: null,
            currentCwd: null,
        });
        await useChatStore.getState().loadSession(loadedSession);

        expect(tauriMocks.invoke).toHaveBeenCalledTimes(1);
        expect(useChatStore.getState()).toMatchObject({
            activeSession: loadedSession,
            pendingSessionKey: null,
        });
        expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
            'cached history',
        ]);
    });

    it('reloads cached sessions when lastActiveAt changes', async () => {
        const updatedSession: SessionMeta = {
            ...loadedSession,
            lastActiveAt: loadedSession.lastActiveAt + 1,
        };
        let loadCount = 0;
        tauriMocks.invoke.mockImplementation(async (_command: string, args?: { sourcePath?: string }) => {
            if (args?.sourcePath === loadedSession.sourcePath) {
                loadCount += 1;
                return [
                    {
                        role: 'assistant',
                        content: loadCount === 1 ? 'initial history' : 'updated history',
                        ts: '2026-06-17T08:00:03.000Z',
                    },
                ] satisfies UnifiedSessionMessage[];
            }
            throw new Error(`Unexpected call: ${JSON.stringify(args)}`);
        });

        await useChatStore.getState().loadSession(loadedSession);
        useChatStore.setState({
            messages: [],
            sessionId: null,
            activeSession: null,
            currentCwd: null,
        });
        await useChatStore.getState().loadSession(updatedSession);

        expect(tauriMocks.invoke).toHaveBeenCalledTimes(2);
        expect(useChatStore.getState().activeSession).toBe(updatedSession);
        expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
            'updated history',
        ]);
    });

    it('ignores stale history loads when a newer session selection finishes later', async () => {
        const newerSession: SessionMeta = {
            ...claudeSession,
            sessionId: 'claude-session-2',
            title: 'Claude session 2',
            sourcePath: 'C:/Users/Administrator/.claude/projects/project/session-2.jsonl',
            resumeCommand: 'claude --resume claude-session-2',
        };
        let resolveFirst: ((value: UnifiedSessionMessage[]) => void) | null = null;
        let resolveSecond: ((value: UnifiedSessionMessage[]) => void) | null = null;

        tauriMocks.invoke.mockImplementation((_command: string, args?: { sourcePath?: string }) => {
            if (args?.sourcePath === loadedSession.sourcePath) {
                return new Promise<UnifiedSessionMessage[]>((resolve) => {
                    resolveFirst = resolve;
                });
            }
            if (args?.sourcePath === newerSession.sourcePath) {
                return new Promise<UnifiedSessionMessage[]>((resolve) => {
                    resolveSecond = resolve;
                });
            }
            throw new Error(`Unexpected call: ${JSON.stringify(args)}`);
        });

        const firstLoad = useChatStore.getState().loadSession(loadedSession);
        const secondLoad = useChatStore.getState().loadSession(newerSession);
        await Promise.resolve();

        expect(useChatStore.getState().pendingSessionKey).toBe(getSessionSelectionKey(newerSession));

        expect(resolveSecond).not.toBeNull();
        resolveSecond!([
            {
                role: 'assistant',
                content: 'newer history',
                ts: '2026-06-17T08:00:03.000Z',
            },
        ]);
        await secondLoad;

        expect(resolveFirst).not.toBeNull();
        resolveFirst!([
            {
                role: 'assistant',
                content: 'older history',
                ts: '2026-06-17T08:00:04.000Z',
            },
        ]);
        await firstLoad;

        expect(useChatStore.getState()).toMatchObject({
            activeSession: newerSession,
            pendingSessionKey: null,
            provider: 'claude',
            sessionId: newerSession.sessionId,
        });
        expect(useChatStore.getState().messages.map((message) => message.content)).toEqual(['newer history']);
    });

    it('preserves structured thinking and tool blocks when loading history', async () => {
        const assistantRaw: MessageRaw = {
            type: 'assistant',
            timestamp: '2026-06-17T08:00:01.000Z',
            message: {
                content: [
                    {type: 'thinking', thinking: 'I need to inspect the file first.'},
                    {
                        type: 'tool_use',
                        id: 'tool-read-1',
                        name: 'Read',
                        input: {file_path: 'src/pages/ChatPage.tsx'},
                    },
                    {type: 'text', text: 'I read the chat page.'},
                ],
            },
        };
        const toolResultRaw: MessageRaw = {
            type: 'user',
            timestamp: '2026-06-17T08:00:02.000Z',
            message: {
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'tool-read-1',
                        content: 'file contents',
                        is_error: false,
                    },
                ],
            },
        };
        const history: UnifiedSessionMessage[] = [
            {
                role: 'assistant',
                content: 'I read the chat page.',
                ts: '2026-06-17T08:00:01.000Z',
                raw: assistantRaw,
            },
            {
                role: 'user',
                content: '[tool_result]',
                ts: '2026-06-17T08:00:02.000Z',
                raw: toolResultRaw,
            },
        ];

        tauriMocks.invoke.mockImplementation(async (command: string) => {
            if (command === 'get_unified_session_messages') return history;
            throw new Error(`Unexpected command: ${command}`);
        });

        await useChatStore.getState().loadSession(claudeSession);

        const messages = useChatStore.getState().messages;
        expect(messages[0].content).toBe('I read the chat page.');
        expect(messages[0].raw).toEqual(assistantRaw);
        expect(getRenderableContentBlocks(messages[0].raw).map((block) => block.type)).toEqual([
            'thinking',
            'tool_use',
            'text',
        ]);
        expect(findToolResult(messages, 'tool-read-1', 0)).toMatchObject({
            type: 'tool_result',
            tool_use_id: 'tool-read-1',
            content: 'file contents',
        });
    });

    it('keeps normalized Codex apply_patch history visible to edit summaries', async () => {
        const patchRaw: MessageRaw = {
            type: 'assistant',
            timestamp: '2026-06-17T08:00:01.000Z',
            message: {
                content: [
                    {
                        type: 'tool_use',
                        id: 'call-patch-1',
                        name: 'apply_patch',
                        input: {
                            patch: [
                                '*** Begin Patch',
                                '*** Update File: src/stores/useChatStore.ts',
                                '@@ -1,1 +1,2 @@',
                                ' const oldValue = true;',
                                '+const newValue = true;',
                                '*** Update File: src/components/chat/StatusPanel.tsx',
                                '@@ -2,2 +2,1 @@',
                                '-const stale = true;',
                                ' const keep = true;',
                                '*** End Patch',
                            ].join('\n'),
                        },
                    },
                ],
            },
        };
        const resultRaw: MessageRaw = {
            type: 'user',
            timestamp: '2026-06-17T08:00:02.000Z',
            message: {
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'call-patch-1',
                        content: 'Done!',
                        is_error: false,
                    },
                ],
            },
        };
        const history: UnifiedSessionMessage[] = [
            {
                role: 'assistant',
                content: '',
                ts: '2026-06-17T08:00:01.000Z',
                raw: patchRaw,
            },
            {
                role: 'user',
                content: '[tool_result]',
                ts: '2026-06-17T08:00:02.000Z',
                raw: resultRaw,
            },
        ];
        tauriMocks.invoke.mockImplementation(async (command: string) => {
            if (command === 'get_unified_session_messages') return history;
            throw new Error(`Unexpected command: ${command}`);
        });

        await useChatStore.getState().loadSession(loadedSession);

        const summary = buildChatStatusSummary(useChatStore.getState().messages);
        expect(summary.touchedFileCount).toBe(2);
        expect(summary.totalAdditions).toBe(1);
        expect(summary.totalDeletions).toBe(1);
        expect(summary.recentEdits.map((edit) => edit.displayPath)).toEqual([
            'src/components/chat/StatusPanel.tsx',
            'src/stores/useChatStore.ts',
        ]);
    });

    it('surfaces generic tool permission requests and writes allow responses', async () => {
        const listeners: Record<string, (event: { payload: unknown }) => void> = {};
        tauriMocks.listen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
            listeners[eventName] = callback;
            return vi.fn();
        });
        tauriMocks.invoke.mockResolvedValue(undefined);

        await useChatStore.getState().init();

        listeners['permission://tool']?.({
            payload: {
                requestId: 'perm-1',
                toolName: 'mcp__chrome-devtools__new_page',
                inputs: {
                    url: 'https://www.baidu.com',
                },
                timestamp: '2026-06-18T09:00:00.000Z',
                cwd: 'C:/guodevelop/ccg-switch',
            },
        });

        expect(useChatStore.getState().pendingToolPermission).toEqual({
            requestId: 'perm-1',
            toolName: 'mcp__chrome-devtools__new_page',
            inputs: {
                url: 'https://www.baidu.com',
            },
            timestamp: '2026-06-18T09:00:00.000Z',
            cwd: 'C:/guodevelop/ccg-switch',
        });

        await useChatStore.getState().answerToolPermission('perm-1', true);

        expect(tauriMocks.invoke).toHaveBeenCalledWith('permission_respond_tool', {
            requestId: 'perm-1',
            allow: true,
        });
        expect(useChatStore.getState().pendingToolPermission).toBeNull();
    });

    it('sends desktop notifications when a streaming turn completes or fails', async () => {
        const listeners: Record<string, (event: { payload: unknown }) => void> = {};
        tauriMocks.listen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
            listeners[eventName] = callback;
            return vi.fn();
        });
        tauriMocks.invoke.mockResolvedValue(undefined);

        await useChatStore.getState().init();

        useChatStore.setState({
            provider: 'codex',
            activeRequestId: 'request-success',
            messages: [
                {
                    id: 'assistant-success',
                    role: 'assistant',
                    content: 'streaming fallback',
                    streaming: true,
                    createdAt: 100,
                    raw: {
                        type: 'assistant',
                        message: {
                            content: [
                                {type: 'text', text: 'pre tool note'},
                                {type: 'tool_use', id: 'tool-1', name: 'Read', input: {file_path: 'src/main.ts'}},
                                {type: 'text', text: ' final answer preview '},
                            ],
                        },
                    },
                },
            ],
        });
        listeners['chat://done']?.({
            payload: {
                requestId: 'request-success',
                success: true,
                error: null,
            },
        });

        expect(notificationMocks.notifyChatTurnStopped).toHaveBeenCalledWith({
            outcome: 'success',
            provider: 'codex',
            detail: 'final answer preview',
        });

        useChatStore.setState({
            provider: 'claude',
            activeRequestId: 'request-error',
            messages: [
                {id: 'assistant-error', role: 'assistant', content: '', streaming: true, createdAt: 200},
            ],
        });
        listeners['chat://done']?.({
            payload: {
                requestId: 'request-error',
                success: false,
                error: 'tool failed',
            },
        });

        expect(notificationMocks.notifyChatTurnStopped).toHaveBeenLastCalledWith({
            outcome: 'error',
            provider: 'claude',
            detail: 'tool failed',
        });
    });

    it('deduplicates stopped notifications for the same request id', async () => {
        const listeners: Record<string, (event: { payload: unknown }) => void> = {};
        tauriMocks.listen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
            listeners[eventName] = callback;
            return vi.fn();
        });
        tauriMocks.invoke.mockResolvedValue(undefined);

        await useChatStore.getState().init();

        useChatStore.setState({
            provider: 'codex',
            activeRequestId: 'request-duplicate',
            messages: [
                {id: 'assistant-duplicate', role: 'assistant', content: 'done once', streaming: true, createdAt: 210},
            ],
        });

        listeners['chat://done']?.({
            payload: {
                requestId: 'request-duplicate',
                success: true,
                error: null,
            },
        });
        listeners['chat://done']?.({
            payload: {
                requestId: 'request-duplicate',
                success: true,
                error: null,
            },
        });

        expect(notificationMocks.notifyChatTurnStopped).toHaveBeenCalledTimes(1);
        expect(notificationMocks.notifyChatTurnStopped).toHaveBeenCalledWith({
            outcome: 'success',
            provider: 'codex',
            detail: 'done once',
        });
    });

    it('sends a desktop notification when the user aborts a streaming turn', async () => {
        useChatStore.setState({
            provider: 'claude',
            activeRequestId: 'request-abort',
            messages: [
                {id: 'assistant-abort', role: 'assistant', content: 'partial', streaming: true, createdAt: 300},
            ],
        });
        tauriMocks.invoke.mockResolvedValue(undefined);

        await useChatStore.getState().abort();

        expect(notificationMocks.prepareChatTurnStoppedNotificationPermission).toHaveBeenCalledTimes(1);
        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_abort');
        expect(notificationMocks.notifyChatTurnStopped).toHaveBeenCalledWith({
            outcome: 'aborted',
            provider: 'claude',
            detail: 'partial',
        });
        expect(useChatStore.getState().messages[0]).toMatchObject({
            streaming: false,
            error: '已停止输出',
        });
    });

    it('saves Codex THREAD_ID and resumes Codex turns with threadId', async () => {
        const listeners: Record<string, (event: { payload: unknown }) => void> = {};
        tauriMocks.listen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
            listeners[eventName] = callback;
            return vi.fn();
        });
        tauriMocks.invoke.mockResolvedValue('request-1');

        await useChatStore.getState().init();

        listeners['chat://stream']?.({
            payload: {
                requestId: 'request-1',
                kind: 'line',
                text: '[THREAD_ID] codex-thread-1',
            },
        });

        expect(useChatStore.getState().sessionId).toBe('codex-thread-1');

        useChatStore.setState({
            provider: 'codex',
            model: 'gpt-5-codex',
            sessionId: 'codex-thread-1',
            currentCwd: 'C:/guodevelop/ccg-switch',
        });

        await useChatStore.getState().send('continue');

        expect(notificationMocks.prepareChatTurnStoppedNotificationPermission).toHaveBeenCalledTimes(1);
        expect(tauriMocks.invoke).toHaveBeenLastCalledWith('chat_send', {
            provider: 'codex',
            command: 'send',
            params: expect.objectContaining({
                message: 'continue',
                threadId: 'codex-thread-1',
                sessionId: undefined,
            }),
        });
    });

    it('carries visible Claude history into the first Codex turn after provider switch', async () => {
        useChatStore.setState({
            provider: 'claude',
            model: 'claude-opus-4-8',
            sessionId: claudeSession.sessionId,
            activeSession: claudeSession,
            currentCwd: claudeSession.projectDir,
            messages: [
                {
                    id: 'history-protocol-1',
                    role: 'user',
                    content: 'You are Codex, a coding agent based on GPT-5.\n\n# Tools\nTools are grouped by namespace.',
                    createdAt: 99,
                },
                {
                    id: 'history-user-1',
                    role: 'user',
                    content: '请记住项目目标是会话管理对标 cc-gui',
                    createdAt: 100,
                },
                {
                    id: 'history-assistant-1',
                    role: 'assistant',
                    content: '已了解：需要修复历史会话选择和工具块展示。',
                    createdAt: 101,
                },
            ],
        });
        tauriMocks.invoke.mockResolvedValue('request-1');

        useChatStore.getState().setProvider('codex');
        await useChatStore.getState().send('继续实现');

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_send', {
            provider: 'codex',
            command: 'send',
            params: expect.objectContaining({
                threadId: undefined,
                sessionId: undefined,
                message: expect.stringContaining('请记住项目目标是会话管理对标 cc-gui'),
            }),
        });
        const lastCall = tauriMocks.invoke.mock.calls[tauriMocks.invoke.mock.calls.length - 1];
        const payload = lastCall?.[1] as { params: { message: string } };
        expect(payload.params.message).toContain('已了解：需要修复历史会话选择和工具块展示。');
        expect(payload.params.message).toContain('继续实现');
        expect(payload.params.message).not.toContain('You are Codex');
        expect(payload.params.message).not.toContain('Tools are grouped by namespace');
        const messages = useChatStore.getState().messages;
        expect(messages[messages.length - 2]?.content).toBe('继续实现');
    });

    it('uses Claude attachment command and keeps image payloads out of prompt text', async () => {
        useChatStore.setState({
            provider: 'claude',
            model: 'claude-sonnet-4-6',
            currentCwd: 'C:/guodevelop/ccg-switch',
        });
        tauriMocks.invoke.mockResolvedValue('request-1');

        await useChatStore.getState().send('识别这张图', {
            attachments: [
                {
                    fileName: 'screen.png',
                    mediaType: 'image/png',
                    data: 'iVBORw0KGgo=',
                    size: 64,
                },
            ],
            displayText: '识别这张图\n\n[Image: screen.png]',
        });

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_send', {
            provider: 'claude',
            command: 'sendWithAttachments',
            params: expect.objectContaining({
                message: '识别这张图',
                attachments: [
                    {
                        fileName: 'screen.png',
                        mediaType: 'image/png',
                        data: 'iVBORw0KGgo=',
                        size: 64,
                    },
                ],
            }),
        });
        const messages = useChatStore.getState().messages;
        expect(messages[messages.length - 2]?.content).toBe('识别这张图\n\n[Image: screen.png]');
        expect(messages[messages.length - 2]?.raw?.message.content).toEqual([
            { type: 'text', text: '识别这张图' },
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgo=',
                },
                media_type: 'image/png',
                data: 'iVBORw0KGgo=',
                fileName: 'screen.png',
            },
        ]);
    });

    it('maps Codex local image paths to SDK local_image attachments', async () => {
        useChatStore.setState({
            provider: 'codex',
            model: 'gpt-5-codex',
            currentCwd: 'C:/guodevelop/ccg-switch',
        });
        tauriMocks.invoke.mockResolvedValue('request-1');

        await useChatStore.getState().send('看下截图', {
            attachments: [
                {
                    fileName: 'screen.png',
                    mediaType: 'image/png',
                    path: 'C:/Users/Administrator/Pictures/screen.png',
                    size: 128,
                },
            ],
        });

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_send', {
            provider: 'codex',
            command: 'send',
            params: expect.objectContaining({
                message: '看下截图',
                attachments: [
                    {
                        type: 'local_image',
                        path: 'C:/Users/Administrator/Pictures/screen.png',
                    },
                ],
            }),
        });
    });

    it('keeps Codex base64 image payloads when no local path is available', async () => {
        useChatStore.setState({
            provider: 'codex',
            model: 'gpt-5-codex',
            currentCwd: 'C:/guodevelop/ccg-switch',
        });
        tauriMocks.invoke.mockResolvedValue('request-1');

        await useChatStore.getState().send('', {
            attachments: [
                {
                    fileName: 'clipboard.png',
                    mediaType: 'image/png',
                    data: 'iVBORw0KGgo=',
                },
            ],
            displayText: '[Image: clipboard.png]',
        });

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_send', {
            provider: 'codex',
            command: 'send',
            params: expect.objectContaining({
                message: 'Please analyze the attached image(s).',
                attachments: [
                    {
                        fileName: 'clipboard.png',
                        mediaType: 'image/png',
                        data: 'iVBORw0KGgo=',
                    },
                ],
            }),
        });
        const messages = useChatStore.getState().messages;
        expect(messages[messages.length - 2]?.content).toBe('[Image: clipboard.png]');
        expect(messages[messages.length - 2]?.raw?.message.content).toEqual([
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgo=',
                },
                media_type: 'image/png',
                data: 'iVBORw0KGgo=',
                fileName: 'clipboard.png',
            },
        ]);
    });
});
