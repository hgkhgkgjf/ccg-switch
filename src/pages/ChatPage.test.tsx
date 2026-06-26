// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {CHAT_SIDEBAR_LAYOUT_STORAGE_KEY, type ChatSidebarLayoutState,} from '../utils/chatSidebarLayout';
import ChatPage from './ChatPage';

(
    globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean}
).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollTo = vi.fn();

const chatStoreState = vi.hoisted(() => ({
    messages: [],
    provider: 'claude',
    permissionMode: 'default',
    model: 'claude-sonnet-4-6',
    reasoningEffort: 'medium',
    currentCwd: 'C:/workspace/project',
    activeSession: null,
    pendingSessionKey: null,
    lastSessionLoadMetrics: null,
    daemonReady: true,
    daemonStatus: 'ready',
    daemonReconnecting: false,
    error: null,
    pendingAskUserQuestion: null,
    pendingPlanApproval: null,
    pendingToolPermission: null,
    openTabs: [],
    activeTabKey: null,
    init: vi.fn(),
    reconnectDaemon: vi.fn(),
    clear: vi.fn(),
    loadSession: vi.fn(),
    loadActiveSessionFullHistory: vi.fn(),
    expandActiveSessionHistory: vi.fn(),
    focusTab: vi.fn(),
    closeTab: vi.fn(),
    closeOtherTabs: vi.fn(),
    closeAllTabs: vi.fn(),
    setCurrentCwd: vi.fn(),
    startNewSession: vi.fn(),
    answerAskUserQuestion: vi.fn(),
    answerToolPermission: vi.fn(),
    approvePlan: vi.fn(),
}));

const sdkStoreState = vi.hoisted(() => ({
    statuses: [],
    init: vi.fn(),
}));

const mcpStoreState = vi.hoisted(() => ({
    servers: [],
    loading: false,
    error: null,
    loadServers: vi.fn(),
}));

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
}));

vi.mock('../stores/useChatStore', () => ({
    useChatStore: () => chatStoreState,
}));

vi.mock('../stores/useSdkStore', () => ({
    useSdkStore: (selector: (state: typeof sdkStoreState) => unknown) => selector(sdkStoreState),
}));

vi.mock('../stores/useMcpStoreV2', () => ({
    useMcpStoreV2: (selector: (state: typeof mcpStoreState) => unknown) => selector(mcpStoreState),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
}));

vi.mock('react-i18next', () => ({
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined,
    },
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string | number>) => {
            const translations: Record<string, string> = {
                'chat.layout.collapseSessionSidebar': 'Collapse session sidebar',
                'chat.layout.expandSessionSidebar': 'Expand session sidebar',
                'chat.layout.collapseStatusSidebar': 'Collapse status sidebar',
                'chat.layout.expandStatusSidebar': 'Expand status sidebar',
                'chat.empty': 'No messages yet',
            };
            const translated = translations[key] ?? key;
            return Object.entries(options ?? {}).reduce(
                (text, [name, value]) => text.split(`{{${name}}}`).join(String(value)),
                translated,
            );
        },
    }),
}));

vi.mock('../components/chat/ChatSessionSidebar', () => ({
    default: ({
        onCollapse,
        collapseLabel,
    }: {
        onCollapse?: () => void;
        collapseLabel?: string;
    }) => createElement(
        'aside',
        {'data-testid': 'chat-session-sidebar'},
        'Session sidebar',
        onCollapse && collapseLabel
            ? createElement('button', {
                type: 'button',
                'data-chat-session-sidebar-action': 'collapse',
                'aria-label': collapseLabel,
                title: collapseLabel,
                onClick: onCollapse,
            })
            : null,
    ),
}));

vi.mock('../components/chat/StatusPanel', () => ({
    default: () => createElement('aside', {'data-testid': 'chat-status-panel'}, 'Status panel'),
}));

vi.mock('../components/chat/MessageAnchorRail', () => ({
    default: () => createElement('nav', {'data-testid': 'message-anchor-rail'}),
}));

vi.mock('../components/chat/ChatSessionTabs', () => ({
    default: () => createElement('div', {'data-testid': 'chat-session-tabs'}),
}));

vi.mock('../components/chat/ConversationSearch', () => ({
    default: () => createElement('input', {'data-testid': 'conversation-search'}),
}));

vi.mock('../components/chat/MessageList', () => ({
    default: () => createElement('div', {'data-testid': 'message-list'}),
}));

vi.mock('../components/chat/ScrollControl', () => ({
    default: () => null,
}));

vi.mock('../components/chat/ChatInputStatusTabs', () => ({
    default: () => createElement('div', {'data-testid': 'chat-input-status-tabs'}),
}));

vi.mock('../components/chat/composer/ChatComposer', () => ({
    ChatComposer: () => createElement('div', {'data-testid': 'chat-composer'}),
}));

vi.mock('../components/chat/ChatDiffReviewPane', () => ({
    default: () => createElement('section', {'data-testid': 'chat-diff-review-pane'}),
}));

vi.mock('../components/chat/AskUserQuestionDialog', () => ({
    default: () => null,
}));

vi.mock('../components/chat/PlanApprovalDialog', () => ({
    default: () => null,
}));

vi.mock('../components/chat/ToolPermissionDialog', () => ({
    default: () => null,
}));

vi.mock('../components/common/ModalDialog', () => ({
    default: ({children}: {children: React.ReactNode}) => createElement('div', {'data-testid': 'modal-dialog'}, children),
}));

vi.mock('../components/chat/SdkDependencyPanel', () => ({
    default: () => createElement('div', {'data-testid': 'sdk-dependency-panel'}),
    getSdkDependencyPanelLabels: () => ({title: 'SDK dependencies'}),
}));

function getStoredSidebarLayoutState(): ChatSidebarLayoutState {
    const raw = window.localStorage.getItem(CHAT_SIDEBAR_LAYOUT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    return JSON.parse(raw ?? '{}') as ChatSidebarLayoutState;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderChatPage() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
        root?.render(createElement(ChatPage));
    });
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

    return container;
}

afterEach(async () => {
    if (root) {
        await act(async () => {
            root?.unmount();
        });
    }
    container?.remove();
    root = null;
    container = null;
    window.localStorage.clear();
    tauriMocks.invoke.mockReset();
    chatStoreState.init.mockClear();
    sdkStoreState.init.mockClear();
    mcpStoreState.loadServers.mockClear();
});

describe('ChatPage sidebar layout', () => {
    it('collapses both sidebars and persists the layout preference', async () => {
        tauriMocks.invoke.mockImplementation((command: string) => {
            if (command === 'get_dashboard_projects') return Promise.resolve([]);
            if (command === 'chat_workspace_status') return Promise.resolve({});
            return Promise.resolve(null);
        });

        const rendered = await renderChatPage();

        expect(rendered.querySelector('[data-testid="chat-session-sidebar"]')).toBeInstanceOf(HTMLElement);
        expect(rendered.querySelector('[data-testid="chat-status-panel"]')).toBeInstanceOf(HTMLElement);
        expect(rendered.querySelector('.chat-session-sidebar-collapse-button')).toBeNull();
        expect(rendered.querySelector('[data-chat-session-sidebar-action="collapse"]')).toBeInstanceOf(HTMLButtonElement);

        await act(async () => {
            rendered
                .querySelector<HTMLButtonElement>('button[aria-label="Collapse session sidebar"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        expect(rendered.querySelector('[data-testid="chat-session-sidebar"]')).toBeNull();
        expect(getStoredSidebarLayoutState()).toEqual({
            sessionSidebarCollapsed: true,
            statusSidebarCollapsed: false,
        });

        await act(async () => {
            rendered
                .querySelector<HTMLButtonElement>('button[aria-label="Collapse status sidebar"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        expect(rendered.querySelector('[data-testid="chat-status-panel"]')).toBeNull();
        expect(getStoredSidebarLayoutState()).toEqual({
            sessionSidebarCollapsed: true,
            statusSidebarCollapsed: true,
        });
    });

    it('restores persisted collapsed sidebars on mount', async () => {
        tauriMocks.invoke.mockImplementation((command: string) => {
            if (command === 'get_dashboard_projects') return Promise.resolve([]);
            if (command === 'chat_workspace_status') return Promise.resolve({});
            return Promise.resolve(null);
        });
        window.localStorage.setItem(CHAT_SIDEBAR_LAYOUT_STORAGE_KEY, JSON.stringify({
            sessionSidebarCollapsed: true,
            statusSidebarCollapsed: true,
        } satisfies ChatSidebarLayoutState));

        const rendered = await renderChatPage();

        expect(rendered.querySelector('[data-testid="chat-session-sidebar"]')).toBeNull();
        expect(rendered.querySelector('[data-testid="chat-status-panel"]')).toBeNull();
        expect(rendered.querySelector('button[aria-label="Expand session sidebar"]')).toBeInstanceOf(HTMLButtonElement);
        expect(rendered.querySelector('button[aria-label="Expand status sidebar"]')).toBeInstanceOf(HTMLButtonElement);

        await act(async () => {
            rendered
                .querySelector<HTMLButtonElement>('button[aria-label="Expand session sidebar"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });
        await act(async () => {
            rendered
                .querySelector<HTMLButtonElement>('button[aria-label="Expand status sidebar"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        expect(rendered.querySelector('[data-testid="chat-session-sidebar"]')).toBeInstanceOf(HTMLElement);
        expect(rendered.querySelector('[data-testid="chat-status-panel"]')).toBeInstanceOf(HTMLElement);
        expect(getStoredSidebarLayoutState()).toEqual({
            sessionSidebarCollapsed: false,
            statusSidebarCollapsed: false,
        });
    });
});
