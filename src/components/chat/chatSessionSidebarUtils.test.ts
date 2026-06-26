// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {createInstance} from 'i18next';
import {I18nextProvider} from 'react-i18next';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {SessionMeta} from '../../types/session';
import ChatSessionSidebar, {SessionProviderBadge} from './ChatSessionSidebar';
import {
    CHAT_SESSION_SIDEBAR_STATE_STORAGE_KEY,
    type ChatSessionSidebarState,
} from '../../utils/chatSessionSidebarState';
import {
    buildRecentChatProjectGroups,
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

(
    globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean}
).IS_REACT_ACT_ENVIRONMENT = true;

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
}));
const toastMocks = vi.hoisted(() => ({
    showToast: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
}));

vi.mock('../common/ToastContainer', () => ({
    showToast: toastMocks.showToast,
}));

const t = (key: string): string => {
    const map: Record<string, string> = {
        'history.provider_claude': 'Claude',
        'history.provider_codex': 'Codex',
    };
    return map[key] ?? key;
};

function createKeyOnlyI18n() {
    const instance = createInstance();
    instance.init({
        lng: 'en',
        fallbackLng: false,
        resources: {},
        initImmediate: false,
        interpolation: {escapeValue: false},
    });
    return instance;
}

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

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
    if (root) {
        await act(async () => {
            root?.unmount();
        });
    }
    container?.remove();
    root = null;
    container = null;
    tauriMocks.invoke.mockReset();
    toastMocks.showToast.mockReset();
    window.localStorage.clear();
});

interface RenderSidebarOptions {
    sessionsByProject?: Record<string, SessionMeta[]>;
    openExplorerError?: unknown;
}

async function renderSidebarWithData(options: RenderSidebarOptions = {}) {
    const now = Date.now();
    const projects = [
        {
            name: 'ccg-switch',
            path: 'C:/workspace/ccg-switch',
            session_count: 2,
            last_active: null,
        },
        {
            name: 'ai-bridge',
            path: 'C:/workspace/ai-bridge',
            session_count: 1,
            last_active: null,
        },
    ];
    const defaultSessionsByProject: Record<string, SessionMeta[]> = {
        'C:/workspace/ccg-switch': [
            createSession({
                providerId: 'claude',
                sessionId: 'recent-claude',
                title: 'Continue Trellis work',
                projectDir: 'C:/workspace/ccg-switch',
                lastActiveAt: now,
                sourcePath: 'C:/sessions/recent-claude.jsonl',
            }),
            createSession({
                providerId: 'codex',
                sessionId: 'recent-codex',
                title: 'Review multi session UI',
                projectDir: 'C:/workspace/ccg-switch',
                lastActiveAt: now - 1_000,
                sourcePath: 'C:/sessions/recent-codex.jsonl',
            }),
        ],
        'C:/workspace/ai-bridge': [
            createSession({
                providerId: 'claude',
                sessionId: 'bridge-session',
                title: 'Bridge follow up',
                projectDir: 'C:/workspace/ai-bridge',
                lastActiveAt: now - 2_000,
                sourcePath: 'C:/sessions/bridge-session.jsonl',
            }),
        ],
    };
    const sessionsByProject = options.sessionsByProject ?? defaultSessionsByProject;
    tauriMocks.invoke.mockImplementation((command: string, args?: {
        projectPath?: string;
        path?: string;
        sessionId?: string;
        title?: string;
    }) => {
        if (command === 'get_dashboard_projects') return Promise.resolve(projects);
        if (command === 'list_sessions' && args?.projectPath) {
            return Promise.resolve(sessionsByProject[args.projectPath] ?? []);
        }
        if (command === 'chat_session_rename' && args?.sessionId && args?.title) {
            Object.keys(sessionsByProject).forEach((projectPath) => {
                sessionsByProject[projectPath] = sessionsByProject[projectPath].map((session) => (
                    session.sessionId === args.sessionId
                        ? {...session, title: args.title ?? null}
                        : session
                ));
            });
            return Promise.resolve({title: args.title});
        }
        if (command === 'chat_open_path_in_explorer') {
            return options.openExplorerError
                ? Promise.reject(options.openExplorerError)
                : Promise.resolve(undefined);
        }
        if (command === 'chat_open_project_in_terminal') {
            return Promise.resolve(undefined);
        }
        if (command === 'chat_resume_session_in_terminal') {
            return Promise.resolve(undefined);
        }
        throw new Error(`Unexpected command: ${command}`);
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root?.render(createElement(
            I18nextProvider,
            {i18n: createKeyOnlyI18n()},
            createElement(ChatSessionSidebar, {
                activeSession: null,
                currentCwd: 'C:/workspace/ccg-switch',
                pendingSessionKey: null,
                onSessionSelect: () => undefined,
                onNewSession: () => undefined,
            }),
        ));
    });
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

    return {container, sessionsByProject};
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

    it('keeps session sidebar chrome readable when i18n keys are unavailable', () => {
        const html = renderToStaticMarkup(createElement(
            I18nextProvider,
            {i18n: createKeyOnlyI18n()},
            createElement(ChatSessionSidebar, {
                activeSession: null,
                currentCwd: 'C:/guodevelop/ccg-switch',
                pendingSessionKey: null,
                onSessionSelect: () => undefined,
                onNewSession: () => undefined,
            }),
        ));

        expect(html).toContain('Session Management');
        expect(html).toContain('New chat');
        expect(html).toContain('Search projects...');
        expect(html).toContain('Projects');
        expect(html).toContain('No projects');
        expect(html).toContain('Sessions');
        expect(html).toContain('No sessions');
        expect(html).toContain('Refresh');
        expect(html).toContain('aria-label="Refresh"');
        expect(html).toContain('aria-label="New chat"');
        expect(html).toContain('aria-label="Search projects..."');
        expect(html).not.toContain('chat.sessionPanel.title');
        expect(html).not.toContain('chat.sessionPanel.newChat');
        expect(html).not.toContain('chat.sessionPanel.searchProjects');
        expect(html).not.toContain('chat.sessionPanel.projects');
        expect(html).not.toContain('chat.sessionPanel.noProjects');
        expect(html).not.toContain('chat.sessionPanel.sessions');
        expect(html).not.toContain('chat.sessionPanel.noSessions');
        expect(html).not.toContain('common.refresh');
    });

    it('renders the collapse action inside the session sidebar header actions', () => {
        const html = renderToStaticMarkup(createElement(
            I18nextProvider,
            {i18n: createKeyOnlyI18n()},
            createElement(ChatSessionSidebar, {
                activeSession: null,
                currentCwd: 'C:/guodevelop/ccg-switch',
                pendingSessionKey: null,
                onSessionSelect: () => undefined,
                onNewSession: () => undefined,
                onCollapse: () => undefined,
                collapseLabel: 'Collapse session sidebar',
            }),
        ));

        expect(html).toContain('data-chat-session-sidebar-header-actions="true"');
        expect(html).toContain('data-chat-session-sidebar-action="collapse"');
        expect(html).toContain('title="Collapse session sidebar"');
        expect(html).toContain('aria-label="Collapse session sidebar"');
        expect(html).not.toContain('chat-session-sidebar-collapse-button');

        const newChatButtonIndex = html.indexOf('aria-label="New chat"');
        const collapseButtonIndex = html.indexOf('data-chat-session-sidebar-action="collapse"');
        expect(newChatButtonIndex).toBeGreaterThan(-1);
        expect(collapseButtonIndex).toBeGreaterThan(newChatButtonIndex);
    });

    it('renders a compact mode switch instead of stacking recent chats above projects', () => {
        const html = renderToStaticMarkup(createElement(
            I18nextProvider,
            {i18n: createKeyOnlyI18n()},
            createElement(ChatSessionSidebar, {
                activeSession: null,
                currentCwd: 'C:/guodevelop/ccg-switch',
                pendingSessionKey: null,
                onSessionSelect: () => undefined,
                onNewSession: () => undefined,
            }),
        ));

        expect(html).toContain('chat-session-sidebar-mode-switch');
        expect(html).toContain('Project sessions');
        expect(html).toContain('Recent chats');
        expect(html).not.toContain('max-h-64 shrink-0 overflow-y-auto');
    });

    it('switches to recent chats mode and allows project groups to collapse', async () => {
        const {container: rendered} = await renderSidebarWithData();

        expect(rendered.textContent).toContain('Projects');
        expect(rendered.querySelector('[data-chat-recent-project-toggle]')).toBeNull();

        const recentModeButton = rendered.querySelector('[data-chat-session-panel-mode="recent"]');
        expect(recentModeButton).toBeInstanceOf(HTMLButtonElement);
        await act(async () => {
            recentModeButton?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        expect(rendered.textContent).toContain('Continue Trellis work');
        expect(rendered.textContent).toContain('Review multi session UI');
        expect(rendered.textContent).toContain('Bridge follow up');

        const groupToggle = rendered.querySelector('[data-chat-recent-project-toggle="C:/workspace/ccg-switch"]');
        expect(groupToggle).toBeInstanceOf(HTMLButtonElement);
        expect(groupToggle?.getAttribute('aria-expanded')).toBe('true');

        await act(async () => {
            groupToggle?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        expect(groupToggle?.getAttribute('aria-expanded')).toBe('false');
        expect(rendered.textContent).not.toContain('Continue Trellis work');
        expect(rendered.textContent).not.toContain('Review multi session UI');
        expect(rendered.textContent).toContain('Bridge follow up');
    });

    it('persists the selected session panel mode and collapsed recent chat project groups', async () => {
        let renderResult = await renderSidebarWithData();
        const rendered = renderResult.container;
        const recentModeButton = rendered.querySelector('[data-chat-session-panel-mode="recent"]');
        expect(recentModeButton).toBeInstanceOf(HTMLButtonElement);

        await act(async () => {
            recentModeButton?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        const groupToggle = rendered.querySelector('[data-chat-recent-project-toggle="C:/workspace/ccg-switch"]');
        expect(groupToggle).toBeInstanceOf(HTMLButtonElement);
        await act(async () => {
            groupToggle?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        const stored = JSON.parse(
            window.localStorage.getItem(CHAT_SESSION_SIDEBAR_STATE_STORAGE_KEY) ?? '{}',
        ) as ChatSessionSidebarState;
        expect(stored).toEqual({
            panelMode: 'recent',
            collapsedRecentProjectKeys: ['c:/workspace/ccg-switch'],
        });

        await act(async () => {
            root?.unmount();
        });
        rendered.remove();
        root = null;
        container = null;
        tauriMocks.invoke.mockReset();

        renderResult = await renderSidebarWithData({sessionsByProject: renderResult.sessionsByProject});
        const remounted = renderResult.container;
        const restoredRecentModeButton = remounted.querySelector('[data-chat-session-panel-mode="recent"]');
        const restoredGroupToggle = remounted.querySelector('[data-chat-recent-project-toggle="C:/workspace/ccg-switch"]');

        expect(restoredRecentModeButton?.getAttribute('aria-pressed')).toBe('true');
        expect(restoredGroupToggle?.getAttribute('aria-expanded')).toBe('false');
        expect(remounted.textContent).not.toContain('Continue Trellis work');
        expect(remounted.textContent).toContain('Bridge follow up');
    });

    it('opens a project context menu with safe actions and disabled placeholders', async () => {
        const {container: rendered} = await renderSidebarWithData();
        const projectRow = rendered.querySelector('[data-chat-project-path="C:/workspace/ccg-switch"]');
        expect(projectRow).toBeInstanceOf(HTMLButtonElement);

        await act(async () => {
            projectRow?.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 80,
                clientY: 120,
            }));
        });

        const menu = rendered.querySelector('[data-chat-context-menu="project"]');
        expect(menu).not.toBeNull();
        expect(menu?.textContent).toContain('Pin project');
        expect(menu?.textContent).toContain('Open in Explorer');
        expect(menu?.textContent).toContain('Create permanent worktree');
        expect(menu?.textContent).toContain('Rename project');
        expect(menu?.textContent).toContain('Mark all as read');
        expect(menu?.textContent).toContain('Archive conversations');
        expect(menu?.textContent).toContain('Remove');
        expect(menu?.querySelector('[data-chat-menu-action="project-open-explorer"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="project-pin"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="project-rename"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="project-archive-conversations"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="project-mark-all-read"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="project-remove"]')?.getAttribute('aria-disabled')).toBe('false');
        // 工作树创建属于第二阶段高风险操作，仍保持禁用占位。
        expect(menu?.querySelector('[data-chat-menu-action="project-create-worktree"]')?.getAttribute('aria-disabled')).toBe('true');
    });

    it('opens a session context menu with rename/open actions and disabled fork placeholders', async () => {
        const {container: rendered} = await renderSidebarWithData();
        const sessionRow = rendered.querySelector('[data-chat-session-key="claude::C:/sessions/recent-claude.jsonl"]');
        expect(sessionRow).toBeInstanceOf(HTMLButtonElement);

        await act(async () => {
            sessionRow?.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 120,
                clientY: 260,
            }));
        });

        const menu = rendered.querySelector('[data-chat-context-menu="session"]');
        expect(menu).not.toBeNull();
        expect(menu?.textContent).toContain('Pin session');
        expect(menu?.textContent).toContain('Rename session');
        expect(menu?.textContent).toContain('Archive session');
        expect(menu?.textContent).toContain('Mark as unread');
        expect(menu?.textContent).toContain('Open in Explorer');
        expect(menu?.textContent).toContain('Fork locally');
        expect(menu?.textContent).toContain('Fork to new worktree');
        expect(menu?.querySelector('[data-chat-menu-action="session-rename"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="session-open-terminal"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="session-resume-terminal"]')?.getAttribute('aria-disabled')).toBe('false');
        expect(menu?.querySelector('[data-chat-menu-action="session-fork-worktree"]')?.getAttribute('aria-disabled')).toBe('true');
    });

    it('resumes a session in terminal using the scanned resume command', async () => {
        const sessionsByProject = {
            'C:/workspace/ccg-switch': [
                createSession({
                    providerId: 'codex',
                    sessionId: 'thread-42',
                    title: 'Resume Codex thread',
                    projectDir: 'C:/workspace/ccg-switch',
                    sourcePath: 'C:/sessions/codex-thread-42.jsonl',
                    resumeCommand: 'codex resume thread-42',
                }),
            ],
        };
        const {container: rendered} = await renderSidebarWithData({sessionsByProject});
        const sessionRow = rendered.querySelector('[data-chat-session-key="codex::C:/sessions/codex-thread-42.jsonl"]');
        expect(sessionRow).toBeInstanceOf(HTMLButtonElement);

        await act(async () => {
            sessionRow?.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 120,
                clientY: 260,
            }));
        });

        await act(async () => {
            rendered.querySelector<HTMLButtonElement>('[data-chat-menu-action="session-resume-terminal"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
            await Promise.resolve();
        });

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_resume_session_in_terminal', {
            resumeCommand: 'codex resume thread-42',
            projectDir: 'C:/workspace/ccg-switch',
        });
        expect(tauriMocks.invoke).not.toHaveBeenCalledWith(
            'chat_resume_session_in_terminal',
            expect.objectContaining({
                provider: expect.anything(),
                sessionId: expect.anything(),
            }),
        );
    });

    it('renames a session through the persistent title command and refreshes the list', async () => {
        vi.spyOn(window, 'prompt').mockReturnValue(' Renamed Trellis session ');
        const {container: rendered} = await renderSidebarWithData();
        const sessionRow = rendered.querySelector('[data-chat-session-key="claude::C:/sessions/recent-claude.jsonl"]');

        await act(async () => {
            sessionRow?.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 120,
                clientY: 260,
            }));
        });

        await act(async () => {
            rendered.querySelector<HTMLButtonElement>('[data-chat-menu-action="session-rename"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_session_rename', {
            providerId: 'claude',
            sessionId: 'recent-claude',
            title: 'Renamed Trellis session',
        });
        expect(rendered.textContent).toContain('Renamed Trellis session');
    });

    it('shows a toast when opening a project in Explorer fails', async () => {
        const {container: rendered} = await renderSidebarWithData({
            openExplorerError: new Error('path missing'),
        });
        const projectRow = rendered.querySelector('[data-chat-project-path="C:/workspace/ccg-switch"]');

        await act(async () => {
            projectRow?.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 80,
                clientY: 120,
            }));
        });

        await act(async () => {
            rendered.querySelector<HTMLButtonElement>('[data-chat-menu-action="project-open-explorer"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
            await Promise.resolve();
        });

        expect(toastMocks.showToast).toHaveBeenCalledWith(
            expect.stringContaining('path missing'),
            'error',
            5000,
        );
    });

    it('renders Claude and Codex session providers with the shared provider icons', () => {
        const claudeHtml = renderToStaticMarkup(
            createElement(SessionProviderBadge, {
                providerId: 'claude',
                providerLabel: 'Claude',
                selected: false,
            }),
        );
        const codexHtml = renderToStaticMarkup(
            createElement(SessionProviderBadge, {
                providerId: 'codex',
                providerLabel: 'Codex',
                selected: true,
            }),
        );
        const customHtml = renderToStaticMarkup(
            createElement(SessionProviderBadge, {
                providerId: 'internal_agent',
                providerLabel: 'Internal Agent',
                selected: false,
            }),
        );

        expect(claudeHtml).toContain('data-chat-provider-icon="claude"');
        expect(claudeHtml).toContain('data-chat-provider-icon-glyph="claude-lobehub"');
        expect(claudeHtml).not.toContain('>Claude<');
        expect(codexHtml).toContain('data-chat-provider-icon="codex"');
        expect(codexHtml).toContain('data-chat-provider-icon-glyph="codex-openai"');
        expect(codexHtml).not.toContain('>Codex<');
        expect(customHtml).toContain('>Internal Agent<');
    });

    it('renders Gemini sessions with the gemini provider glyph', () => {
        const geminiHtml = renderToStaticMarkup(
            createElement(SessionProviderBadge, {
                providerId: 'gemini',
                providerLabel: 'Gemini',
                selected: false,
            }),
        );

        expect(geminiHtml).toContain('data-chat-provider-icon="gemini"');
        expect(geminiHtml).toContain('data-chat-provider-icon-glyph="gemini-google"');
        expect(geminiHtml).not.toContain('>Gemini<');
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

    it('groups recent chats by project with supported-provider filtering and per-project caps', () => {
        const groups = buildRecentChatProjectGroups({
            projects: [
                {
                    name: 'ccg-switch',
                    path: 'C:\\guodevelop\\ccg-switch\\',
                    session_count: 3,
                    last_active: '2026-06-24T12:00:00.000Z',
                },
                {
                    name: 'other',
                    path: 'C:/guodevelop/other',
                    session_count: 1,
                    last_active: null,
                },
            ],
            sessionsByProject: new Map([
                ['c:/guodevelop/ccg-switch', [
                    createSession({
                        providerId: 'claude',
                        sessionId: 'older',
                        title: 'Older chat',
                        projectDir: 'C:/guodevelop/ccg-switch',
                        lastActiveAt: 100,
                    }),
                    createSession({
                        providerId: 'codex',
                        sessionId: 'newest',
                        title: 'Newest chat',
                        projectDir: 'C:\\guodevelop\\ccg-switch\\',
                        lastActiveAt: 300,
                    }),
                    createSession({
                        providerId: 'gemini',
                        sessionId: 'unsupported',
                        title: 'Unsupported chat',
                        projectDir: 'C:/guodevelop/ccg-switch',
                        lastActiveAt: 400,
                    }),
                    createSession({
                        providerId: 'claude',
                        sessionId: 'wrong-project',
                        title: 'Wrong project',
                        projectDir: 'C:/guodevelop/other',
                        lastActiveAt: 500,
                    }),
                ]],
                ['c:/guodevelop/other', [
                    createSession({
                        providerId: 'codex',
                        sessionId: 'other-project',
                        title: 'Other project',
                        projectDir: 'C:/guodevelop/other',
                        lastActiveAt: 200,
                    }),
                ]],
            ]),
            limitPerProject: 1,
        });

        expect(groups).toEqual([
            {
                projectName: 'ccg-switch',
                projectPath: 'C:\\guodevelop\\ccg-switch\\',
                sessions: [
                    expect.objectContaining({sessionId: 'newest'}),
                ],
            },
            {
                projectName: 'other',
                projectPath: 'C:/guodevelop/other',
                sessions: [
                    expect.objectContaining({sessionId: 'other-project'}),
                ],
            },
        ]);
    });

    it('filters recent chat groups to sessions active within the requested time window', () => {
        const now = Date.UTC(2026, 5, 24, 12, 0, 0);
        const oneDay = 24 * 60 * 60 * 1000;
        const groups = buildRecentChatProjectGroups({
            projects: [
                {
                    name: 'ccg-switch',
                    path: 'C:/guodevelop/ccg-switch',
                    session_count: 3,
                    last_active: '2026-06-24T12:00:00.000Z',
                },
            ],
            sessionsByProject: new Map([
                ['c:/guodevelop/ccg-switch', [
                    createSession({
                        providerId: 'claude',
                        sessionId: 'within-seven-days',
                        projectDir: 'C:/guodevelop/ccg-switch',
                        lastActiveAt: now - (7 * oneDay) + 1,
                    }),
                    createSession({
                        providerId: 'codex',
                        sessionId: 'too-old',
                        projectDir: 'C:/guodevelop/ccg-switch',
                        lastActiveAt: now - (7 * oneDay) - 1,
                    }),
                ]],
            ]),
            recentSince: now - (7 * oneDay),
        });

        expect(groups).toHaveLength(1);
        expect(groups[0].sessions.map((session) => session.sessionId)).toEqual(['within-seven-days']);
    });

    it('sorts pinned recent chats first and drops archived ones', () => {
        const now = Date.now();
        const groups = buildRecentChatProjectGroups({
            projects: [
                {
                    name: 'ccg-switch',
                    path: 'C:/workspace/ccg-switch',
                    session_count: 3,
                    last_active: null,
                },
            ],
            sessionsByProject: new Map([
                ['c:/workspace/ccg-switch', [
                    createSession({
                        sessionId: 'newest-unpinned',
                        projectDir: 'C:/workspace/ccg-switch',
                        lastActiveAt: now,
                    }),
                    createSession({
                        sessionId: 'older-pinned',
                        projectDir: 'C:/workspace/ccg-switch',
                        lastActiveAt: now - 5_000,
                        pinned: true,
                    }),
                    createSession({
                        sessionId: 'archived-hidden',
                        projectDir: 'C:/workspace/ccg-switch',
                        lastActiveAt: now - 1_000,
                        archived: true,
                    }),
                ]],
            ]),
        });

        expect(groups).toHaveLength(1);
        expect(groups[0].sessions.map((session) => session.sessionId))
            .toEqual(['older-pinned', 'newest-unpinned']);
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
