import {describe, expect, it, vi} from 'vitest';
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

vi.mock('react-i18next', () => ({
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined,
    },
    useTranslation: () => ({
        t: (key: string, values?: Record<string, number>) => {
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
});
