import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import MessageList from './MessageList';
import type {ChatMessage} from '../../types/chat';

vi.mock('@tauri-apps/api/core', () => ({
    convertFileSrc: (path: string) => `asset://${path}`,
    invoke: vi.fn(),
}));

vi.mock('dompurify', () => ({
    default: {
        sanitize: (html: string) => html,
    },
}));

const translationState = vi.hoisted(() => ({
    keyOnly: false,
}));

vi.mock('react-i18next', () => ({
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined,
    },
    useTranslation: () => ({
        t: (key: string, values?: Record<string, number>) => {
            if (translationState.keyOnly) return key;
            if (key === 'chat.layout.searchResults') return `Found ${values?.count ?? 0} matches`;
            if (key === 'chat.layout.searchNoResults') return 'No matches';
            if (key === 'chat.layout.searchFullHistoryLoading') return 'Searching complete history';
            if (key === 'chat.layout.searchFullHistoryError') return 'Could not search complete history';
            if (key === 'chat.layout.searchFullHistoryRetry') return 'Retry';
            if (key === 'chat.message.user') return 'You';
            if (key === 'chat.message.assistant') return 'Assistant';
            if (key === 'chat.message.system') return 'System';
            if (key === 'chat.message.copy') return 'Copy';
            if (key === 'chat.message.copied') return 'Copied';
            if (key === 'chat.message.emptyUser') return 'Empty message';
            return key;
        },
    }),
}));

const messages: ChatMessage[] = [
    {
        id: 'm-1',
        role: 'user',
        content: 'needle',
        createdAt: 1,
    },
    {
        id: 'm-2',
        role: 'assistant',
        content: 'haystack',
        createdAt: 2,
    },
];

describe('MessageList', () => {
    afterEach(() => {
        translationState.keyOnly = false;
    });

    it('surfaces full-history search loading above windowed search results', () => {
        const html = renderToStaticMarkup(
            <MessageList
                messages={messages}
                searchQuery="needle"
                fullHistorySearchStatus="loading"
            />,
        );

        expect(html).toContain('Searching complete history');
        expect(html).toContain('Found 1 matches');
        expect(html).toContain('animate-spin');
    });

    it('surfaces full-history search errors with a retry affordance', () => {
        const html = renderToStaticMarkup(
            <MessageList
                messages={messages}
                searchQuery="needle"
                fullHistorySearchStatus="error"
                onRetryFullHistorySearch={() => undefined}
            />,
        );

        expect(html).toContain('Could not search complete history');
        expect(html).toContain('Retry');
        expect(html).toContain('aria-label="Retry"');
    });

    it('uses the regular match summary once full-history search is complete', () => {
        const html = renderToStaticMarkup(
            <MessageList
                messages={messages}
                searchQuery="needle"
                fullHistorySearchStatus="complete"
            />,
        );

        expect(html).toContain('Found 1 matches');
        expect(html).not.toContain('Searching complete history');
        expect(html).not.toContain('Could not search complete history');
    });

    it('resolves earlier internal tool results for visible tool blocks', () => {
        const outOfOrderToolMessages: ChatMessage[] = [
            {
                id: 'prompt',
                role: 'user',
                content: 'read package metadata',
                createdAt: 1,
            },
            {
                id: 'tool-result',
                role: 'user',
                content: '[tool_result]',
                raw: {
                    type: 'user',
                    message: {
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'tool-early',
                                content: 'package file contents',
                                is_error: false,
                            },
                        ],
                    },
                },
                createdAt: 2,
            },
            {
                id: 'assistant-tool',
                role: 'assistant',
                content: '',
                raw: {
                    type: 'assistant',
                    message: {
                        content: [
                            {
                                type: 'tool_use',
                                id: 'tool-early',
                                name: 'Read',
                                input: {file_path: 'package.json'},
                            },
                        ],
                    },
                },
                createdAt: 3,
            },
        ];

        const html = renderToStaticMarkup(
            <MessageList
                messages={outOfOrderToolMessages}
                searchQuery="package.json"
            />,
        );

        expect(html).toContain('tool-status-indicator completed');
        expect(html).not.toContain('tool-status-indicator pending');
        expect(html).not.toContain('[tool_result]');
    });

    it('keeps search and reveal chrome readable when i18n keys are unavailable', () => {
        translationState.keyOnly = true;
        const manyMessages: ChatMessage[] = Array.from({length: 17}, (_, index) => ({
            id: `m-${index + 1}`,
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: index === 16 ? 'needle' : `message ${index + 1}`,
            createdAt: index + 1,
        }));
        const searchHtml = renderToStaticMarkup(
            <MessageList
                messages={messages}
                searchQuery="absent"
                fullHistorySearchStatus="error"
                onRetryFullHistorySearch={() => undefined}
            />,
        );
        const collapsedHtml = renderToStaticMarkup(
            <MessageList messages={manyMessages}/>,
        );

        expect(searchHtml).toContain('No matching messages found');
        expect(searchHtml).toContain('Complete history search failed. Current results only cover the loaded window.');
        expect(searchHtml).toContain('aria-label="Retry"');
        expect(searchHtml).not.toContain('chat.layout.searchNoResults');
        expect(searchHtml).not.toContain('chat.layout.searchFullHistoryError');
        expect(searchHtml).not.toContain('chat.layout.searchFullHistoryRetry');
        expect(collapsedHtml).toContain('2 earlier messages are collapsed. Scroll to the top to load 2 more');
        expect(collapsedHtml).not.toContain('chat.message.showEarlier');
    });
});
