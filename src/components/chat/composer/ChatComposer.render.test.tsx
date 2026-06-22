import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChatComposer} from './ChatComposer';
import {CompletionMenu} from './CompletionMenu';

const loadAllProviders = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, _options?: Record<string, unknown>) => key,
    }),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

vi.mock('../../../stores/useChatStore', () => ({
    useChatStore: () => ({
        provider: 'claude',
        permissionMode: 'default',
        model: 'claude-sonnet-provider-20260601',
        reasoningEffort: 'high',
        draft: '',
        contextTokens: 0,
        activeRequestId: null,
        setProvider: vi.fn(),
        setPermissionMode: vi.fn(),
        setModel: vi.fn(),
        setReasoningEffort: vi.fn(),
        setDraft: vi.fn(),
        send: vi.fn(),
        abort: vi.fn(),
    }),
}));

vi.mock('../../../stores/useProviderStore', () => ({
    useProviderStore: () => ({
        providers: [
            {
                id: 'provider-claude',
                name: 'Provider Claude',
                appType: 'claude',
                apiKey: 'test-key',
                url: 'https://api.example.com',
                defaultSonnetModel: 'claude-sonnet-provider-20260601',
                inFailoverQueue: false,
                isActive: true,
                createdAt: '2026-06-19T00:00:00.000Z',
            },
        ],
        hasLoaded: true,
        loading: false,
        error: null,
        loadAllProviders,
    }),
}));

vi.mock('./useCompletions', () => ({
    useCompletions: () => ({
        isOpen: false,
        items: [],
        activeIndex: 0,
        loading: false,
        onTextChange: vi.fn(),
        handleKeyDown: () => false,
        applySelection: () => null,
        setActiveIndex: vi.fn(),
    }),
}));

describe('ChatComposer render integration', () => {
    it('passes provider-loaded model options into the bottom model selector', () => {
        const html = renderToStaticMarkup(
            <ChatComposer
                sdkMissing={false}
                onSdkMissing={() => undefined}
                cwd="C:\\repo"
            />,
        );

        expect(html).toContain('claude-sonnet-provider-20260601');
        expect(html).toContain('data-chat-model-icon="claude-sonnet"');
    });

    it('wires a manual model refresh affordance when the active provider can fetch models', () => {
        const html = renderToStaticMarkup(
            <ChatComposer
                sdkMissing={false}
                onSdkMissing={() => undefined}
                cwd="C:\\repo"
            />,
        );

        expect(html).toContain('title="Refresh models"');
        expect(html).not.toContain('chat.modelsRefresh');
    });

    it('keeps composer input surface labels readable when translations return keys', () => {
        const html = renderToStaticMarkup(
            <ChatComposer
                sdkMissing={false}
                onSdkMissing={() => undefined}
                cwd="C:\\repo"
            />,
        );

        expect(html).toContain('title="Add attachment"');
        expect(html).toContain('title="Collapse status panel"');
        expect(html).toContain('title="Drag to resize the input"');
        expect(html).toContain('aria-label="Drag to resize the input"');
        expect(html).toContain('placeholder="Type a message... @ to reference files, # for subagents, ! for presets. Enter to send, Shift+Enter for newline"');
        expect(html).not.toContain('chat.attach');
        expect(html).not.toContain('chat.collapsePanel');
        expect(html).not.toContain('chat.resizeComposer');
        expect(html).not.toContain('chat.richPlaceholder');
    });

    it('renders completion menu loading and items with readable accessibility chrome', () => {
        const loadingHtml = renderToStaticMarkup(
            <CompletionMenu
                items={[]}
                activeIndex={0}
                loading
                emptyText="No matches"
                loadingText="Loading suggestions..."
                menuLabel="Completion suggestions"
                onSelect={() => undefined}
                onHover={() => undefined}
            />,
        );

        expect(loadingHtml).toContain('role="listbox"');
        expect(loadingHtml).toContain('aria-label="Completion suggestions"');
        expect(loadingHtml).toContain('role="status"');
        expect(loadingHtml).toContain('Loading suggestions...');
        expect(loadingHtml).not.toContain('…');

        const itemsHtml = renderToStaticMarkup(
            <CompletionMenu
                items={[
                    {
                        id: 'review',
                        label: '/review',
                        description: 'Review working tree changes',
                    },
                    {
                        id: 'help',
                        label: '/help',
                    },
                ]}
                activeIndex={0}
                emptyText="No matches"
                loadingText="Loading suggestions..."
                menuLabel="Completion suggestions"
                onSelect={() => undefined}
                onHover={() => undefined}
            />,
        );

        expect(itemsHtml).toContain('role="option"');
        expect(itemsHtml).toContain('aria-selected="true"');
        expect(itemsHtml).toContain('aria-selected="false"');
        expect(itemsHtml).toContain('aria-label="/review. Review working tree changes"');
    });
});
