// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
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
        expect(collapsedHtml).toContain('2 earlier messages are collapsed. Click to load 2 more');
        expect(collapsedHtml).toMatch(/<button(?=[^>]*type="button")(?=[^>]*title="2 earlier messages are collapsed\. Click to load 2 more")[^>]*>/);
        expect(collapsedHtml).not.toContain('Scroll to the top');
        expect(collapsedHtml).not.toContain('chat.message.showEarlier');
    });

    it('offers an explicit load-earlier-history control when more history exists on disk', () => {
        const html = renderToStaticMarkup(
            <MessageList
                messages={messages}
                hasEarlierServerHistory
                onLoadEarlierServerHistory={() => undefined}
            />,
        );

        expect(html).toContain('Load earlier history from this session');
        expect(html).toContain('aria-label="Load earlier history from this session"');
        // 内存窗口里没有折叠消息时，不应展示本地折叠提示。
        expect(html).not.toContain('are collapsed');
    });

    it('shows a disabled loading affordance while earlier server history is loading', () => {
        const html = renderToStaticMarkup(
            <MessageList
                messages={messages}
                hasEarlierServerHistory
                isLoadingEarlierServerHistory
                onLoadEarlierServerHistory={() => undefined}
            />,
        );

        expect(html).toContain('Loading earlier history...');
        expect(html).toContain('disabled');
        expect(html).toContain('animate-spin');
    });

    it('does not offer the load-earlier-history control without earlier server history', () => {
        const html = renderToStaticMarkup(
            <MessageList messages={messages} />,
        );

        expect(html).not.toContain('Load earlier history from this session');
    });

    it('migrates reveal state when a windowed tail grows into the full transcript', async () => {
        const buildTranscript = (prefix: string, count: number): ChatMessage[] =>
            Array.from({length: count}, (_, index) => ({
                id: `${prefix}-${index}`,
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `${prefix}-body-${index}`,
                createdAt: index + 1,
            }));

        const fullTranscript = buildTranscript('history', 50);
        // 窗口尾部：完整记录的最后 30 条（index 20..49）。
        const windowedTail = fullTranscript.slice(20);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        try {
            await act(async () => {
                root.render(<MessageList messages={windowedTail} />);
            });

            // 默认窗口只展示最近 15 条（index 35..49）。
            expect(container.innerHTML).toContain('history-body-49');
            expect(container.innerHTML).toContain('history-body-35');
            expect(container.innerHTML).not.toContain('history-body-34');
            // 更早的历史此时还没加载进内存窗口。
            expect(container.innerHTML).not.toContain('history-body-10');

            // 服务端补全完整历史：最后一条 id 不变，长度增长，第一条 id 改变。
            await act(async () => {
                root.render(<MessageList messages={fullTranscript} />);
            });

            // 之前可见的消息保持可见，且额外多露出一页更早历史，而不是被甩回最近 15 条尾部。
            expect(container.innerHTML).toContain('history-body-49');
            expect(container.innerHTML).toContain('history-body-35');
            // 扩展前被折叠的消息（index 34）现在可见，证明没有重置到尾部。
            expect(container.innerHTML).toContain('history-body-34');
            // 多露出的一页较早历史也进入可见窗口。
            expect(container.innerHTML).toContain('history-body-10');
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('resets reveal to the recent tail when switching to a different session', async () => {
        const buildTranscript = (prefix: string, count: number): ChatMessage[] =>
            Array.from({length: count}, (_, index) => ({
                id: `${prefix}-${index}`,
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `${prefix}-body-${index}`,
                createdAt: index + 1,
            }));

        const sessionA = buildTranscript('sessiona', 50);
        const sessionB = buildTranscript('sessionb', 50);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        try {
            await act(async () => {
                root.render(<MessageList messages={sessionA} />);
            });
            expect(container.innerHTML).toContain('sessiona-body-49');

            // 切换到另一个会话：最后一条 id 也改变，应重置到尾部，而不是迁移。
            await act(async () => {
                root.render(<MessageList messages={sessionB} />);
            });

            expect(container.innerHTML).toContain('sessionb-body-49');
            expect(container.innerHTML).toContain('sessionb-body-35');
            // 重置到默认窗口：更早的消息不应可见。
            expect(container.innerHTML).not.toContain('sessionb-body-10');
            expect(container.innerHTML).not.toContain('sessiona-body-49');
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
});
