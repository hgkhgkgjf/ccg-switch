import {describe, expect, it} from 'vitest';
import type {SessionMeta} from '../../types/session';
import {
    filterProjectChatSessions,
    filterSupportedChatSessions,
    getCachedProjectSessions,
    getSessionProviderLabel,
    getVisibleProjectSessions,
    normalizeProjectPathForCache,
    rememberProjectSessions,
    sessionTitle,
    shortSessionId,
    shouldAcceptSessionListResponse,
    shouldIgnoreSessionClick,
    shouldShowSessionRefreshStatus,
    shouldSyncProjectFromCurrentCwd,
} from './chatSessionSidebarUtils';

const t = (key: string): string => {
    const map: Record<string, string> = {
        'history.provider_claude': 'Claude',
        'history.provider_codex': 'Codex',
    };
    return map[key] ?? key;
};

function createSession(overrides: Partial<SessionMeta>): SessionMeta {
    return {
        providerId: 'claude',
        sessionId: 'session-id',
        title: null,
        summary: null,
        projectDir: 'C:/project',
        createdAt: 1,
        lastActiveAt: 2,
        sourcePath: `C:/sessions/${overrides.providerId ?? 'claude'}-${overrides.sessionId ?? 'session-id'}.jsonl`,
        resumeCommand: null,
        ...overrides,
    };
}

describe('chatSessionSidebarUtils', () => {
    it('uses localized provider labels when available', () => {
        expect(getSessionProviderLabel(t, 'claude')).toBe('Claude');
        expect(getSessionProviderLabel(t, 'codex')).toBe('Codex');
    });

    it('falls back to a readable provider label when translation is missing', () => {
        expect(getSessionProviderLabel(t, 'internal_agent')).toBe('Internal Agent');
        expect(getSessionProviderLabel(t, 'custom')).toBe('Custom');
    });

    it('prefers title then summary then shortened session id', () => {
        expect(sessionTitle({
            sessionId: '1234567890abcdef',
            title: 'Pinned title',
            summary: 'Ignored summary',
        })).toBe('Pinned title');

        expect(sessionTitle({
            sessionId: '1234567890abcdef',
            title: '   ',
            summary: 'Useful summary',
        })).toBe('Useful summary');

        expect(sessionTitle({
            sessionId: '1234567890abcdef123',
            title: '',
            summary: '',
        })).toBe(shortSessionId('1234567890abcdef123'));
    });

    it('filters unsupported providers before showing chat sessions', () => {
        const sessions = [
            createSession({providerId: 'claude', sessionId: 'claude-1'}),
            createSession({providerId: 'codex', sessionId: 'codex-1'}),
            createSession({providerId: 'gemini', sessionId: 'gemini-1'}),
        ];

        expect(filterSupportedChatSessions(sessions).map((session) => session.sessionId)).toEqual([
            'claude-1',
            'codex-1',
        ]);
    });

    it('filters sessions that explicitly belong to a different project', () => {
        const sessions = [
            createSession({
                providerId: 'claude',
                sessionId: 'current-project',
                projectDir: 'C:/workspace/current',
            }),
            createSession({
                providerId: 'codex',
                sessionId: 'legacy-unknown-project',
                projectDir: null,
            }),
            createSession({
                providerId: 'claude',
                sessionId: 'other-project',
                projectDir: 'C:/workspace/other',
            }),
            createSession({
                providerId: 'gemini',
                sessionId: 'unsupported-project',
                projectDir: 'C:/workspace/current',
            }),
        ];

        expect(filterProjectChatSessions(sessions, 'C:/workspace/current').map((session) => session.sessionId)).toEqual([
            'current-project',
            'legacy-unknown-project',
        ]);
    });

    it('reuses cached project sessions unless a force reload is requested', () => {
        const cache = new Map<string, SessionMeta[]>();
        const projectPath = 'C:\\project\\';
        const cached = rememberProjectSessions(cache, projectPath, [
            createSession({providerId: 'claude', sessionId: 'claude-1'}),
            createSession({providerId: 'gemini', sessionId: 'gemini-1'}),
        ]);

        expect(cached.map((session) => session.sessionId)).toEqual(['claude-1']);
        expect(getCachedProjectSessions(cache, 'c:/project')).toBe(cached);
        expect(getCachedProjectSessions(cache, projectPath, true)).toBeNull();
    });

    it('indexes cached sessions by session projectDir aliases', () => {
        const cache = new Map<string, SessionMeta[]>();
        const cached = rememberProjectSessions(cache, 'C:\\workspace\\current', [
            createSession({
                providerId: 'codex',
                sessionId: 'codex-1',
                projectDir: 'C:/Workspace/Current/',
            }),
        ]);

        expect(getCachedProjectSessions(cache, 'c:/workspace/current')).toBe(cached);
        expect(getCachedProjectSessions(cache, 'C:\\Workspace\\Current\\')).toBe(cached);
    });

    it('does not cache mixed-project session results under unrelated project aliases', () => {
        const cache = new Map<string, SessionMeta[]>();
        const cached = rememberProjectSessions(cache, 'C:/workspace/current', [
            createSession({
                providerId: 'claude',
                sessionId: 'current-project',
                projectDir: 'C:/workspace/current',
            }),
            createSession({
                providerId: 'codex',
                sessionId: 'other-project',
                projectDir: 'C:/workspace/other',
            }),
        ]);

        expect(cached.map((session) => session.sessionId)).toEqual(['current-project']);
        expect(getCachedProjectSessions(cache, 'C:/workspace/current')).toBe(cached);
        expect(getCachedProjectSessions(cache, 'C:/workspace/other')).toBeNull();
    });

    it('hides sessions that belong to a previous selected project', () => {
        const sessions = [
            createSession({
                providerId: 'claude',
                sessionId: 'previous-project',
                projectDir: 'C:/workspace/previous',
            }),
        ];

        expect(getVisibleProjectSessions(
            sessions,
            'C:/workspace/current',
            'C:/workspace/previous',
        )).toEqual([]);
    });

    it('keeps visible sessions scoped to the selected project owner', () => {
        const sessions = [
            createSession({
                providerId: 'claude',
                sessionId: 'current-project',
                projectDir: 'C:/workspace/current',
            }),
            createSession({
                providerId: 'codex',
                sessionId: 'other-project',
                projectDir: 'C:/workspace/other',
            }),
            createSession({
                providerId: 'gemini',
                sessionId: 'unsupported-provider',
                projectDir: 'C:/workspace/current',
            }),
        ];

        expect(getVisibleProjectSessions(
            sessions,
            'C:/workspace/current',
            'C:/workspace/current/',
        ).map((session) => session.sessionId)).toEqual(['current-project']);
    });

    it('accepts session list responses only for the latest selected project request', () => {
        expect(shouldAcceptSessionListResponse({
            requestSeq: 2,
            latestRequestSeq: 2,
            requestProjectPath: 'C:/workspace/current',
            selectedProjectPath: 'C:\\workspace\\current\\',
        })).toBe(true);

        expect(shouldAcceptSessionListResponse({
            requestSeq: 1,
            latestRequestSeq: 2,
            requestProjectPath: 'C:/workspace/current',
            selectedProjectPath: 'C:/workspace/current',
        })).toBe(false);

        expect(shouldAcceptSessionListResponse({
            requestSeq: 2,
            latestRequestSeq: 2,
            requestProjectPath: 'C:/workspace/previous',
            selectedProjectPath: 'C:/workspace/current',
        })).toBe(false);
    });

    it('normalizes project paths for stable sidebar cache keys', () => {
        expect(normalizeProjectPathForCache('C:\\guodevelop\\ccg-switch\\')).toBe('c:/guodevelop/ccg-switch');
        expect(normalizeProjectPathForCache('  C:/guodevelop/ccg-switch///  ')).toBe('c:/guodevelop/ccg-switch');
        expect(normalizeProjectPathForCache(null)).toBe('');
    });

    it('ignores repeated clicks on active or pending sessions', () => {
        const session = createSession({
            providerId: 'codex',
            sessionId: 'codex-1',
            sourcePath: 'C:/sessions/codex-1.jsonl',
        });
        const activeKey = 'codex::C:/sessions/codex-1.jsonl';
        const pendingKey = 'codex::C:/sessions/codex-2.jsonl';

        expect(shouldIgnoreSessionClick(session, activeKey, null)).toBe(true);
        expect(shouldIgnoreSessionClick(session, null, activeKey)).toBe(true);
        expect(shouldIgnoreSessionClick(session, activeKey, pendingKey)).toBe(false);
    });

    it('shows a lightweight refresh status only when refreshing an existing session list', () => {
        expect(shouldShowSessionRefreshStatus(true, 2)).toBe(true);
        expect(shouldShowSessionRefreshStatus(true, 0)).toBe(false);
        expect(shouldShowSessionRefreshStatus(false, 2)).toBe(false);
    });

    it('does not sync current cwd over a manually selected different project', () => {
        expect(shouldSyncProjectFromCurrentCwd({
            currentCwd: 'C:/guodevelop/ccg-switch',
            selectedProjectPath: 'C:/guodevelop/demo/jetbrains-cc-gui',
            hasManualProjectSelection: true,
            visibleSessionCount: 0,
            hasCachedCurrentProjectSessions: false,
        })).toBe(false);
    });

    it('syncs current cwd when there is no manual project override', () => {
        expect(shouldSyncProjectFromCurrentCwd({
            currentCwd: 'C:/guodevelop/ccg-switch',
            selectedProjectPath: 'C:/guodevelop/demo/jetbrains-cc-gui',
            hasManualProjectSelection: false,
            visibleSessionCount: 3,
            hasCachedCurrentProjectSessions: false,
        })).toBe(true);
    });

    it('skips current cwd sync when the selected project already has visible or cached sessions', () => {
        expect(shouldSyncProjectFromCurrentCwd({
            currentCwd: 'C:/guodevelop/ccg-switch',
            selectedProjectPath: 'C:/guodevelop/ccg-switch/',
            hasManualProjectSelection: false,
            visibleSessionCount: 1,
            hasCachedCurrentProjectSessions: false,
        })).toBe(false);

        expect(shouldSyncProjectFromCurrentCwd({
            currentCwd: 'C:/guodevelop/ccg-switch',
            selectedProjectPath: 'C:/guodevelop/ccg-switch/',
            hasManualProjectSelection: false,
            visibleSessionCount: 0,
            hasCachedCurrentProjectSessions: true,
        })).toBe(false);
    });
});
