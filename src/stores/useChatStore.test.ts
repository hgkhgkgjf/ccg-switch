import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ChatMessage} from '../types/chat';
import type {SessionMeta, UnifiedSessionMessage} from '../types/session';

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    listen: vi.fn(async (_eventName: string, _callback: (event: { payload: unknown }) => void) => vi.fn()),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: tauriMocks.listen,
}));

import {useChatStore} from './useChatStore';

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
        handoffContextProvider: null,
        initialized: false,
        error: null,
        pendingAskUserQuestion: null,
        pendingPlanApproval: null,
        deniedToolIds: new Set(),
    });
}

describe('useChatStore session transitions', () => {
    beforeEach(() => {
        tauriMocks.invoke.mockReset();
        tauriMocks.listen.mockClear();
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
            activeRequestId: null,
            contextTokens: 0,
            error: null,
        });
        expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
            'resume this task',
            'history loaded',
        ]);
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
        const messages = useChatStore.getState().messages;
        expect(messages[messages.length - 2]?.content).toBe('继续实现');
    });
});
