import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ChatMessage} from '../../types/chat';
import MessageItem from './MessageItem';
import StreamingPlaceholder from './StreamingPlaceholder';
import WaitingIndicator from './WaitingIndicator';

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
        t: (key: string) => {
            if (translationState.keyOnly) return key;
            if (key === 'chat.message.user') return 'You';
            if (key === 'chat.message.assistant') return 'AI Assistant';
            if (key === 'chat.message.system') return 'System';
            if (key === 'chat.message.copy') return 'Copy';
            if (key === 'chat.message.copied') return 'Copied';
            if (key === 'chat.message.emptyUser') return 'Empty message';
            if (key === 'chat.message.waiting') return 'Waiting for response...';
            if (key === 'chat.message.streamingConnected') return 'Connected, generating response...';
            return key;
        },
    }),
}));

function renderMessage(message: ChatMessage) {
    return renderToStaticMarkup(
        <MessageItem
            message={message}
            isLast
            findToolResult={() => null}
        />,
    );
}

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
    return {
        id: 'message-1',
        role: 'user',
        content: 'hello',
        createdAt: 1,
        ...overrides,
    };
}

describe('MessageItem', () => {
    afterEach(() => {
        translationState.keyOnly = false;
    });

    it('keeps message role and copy labels readable when i18n keys are unavailable', () => {
        translationState.keyOnly = true;

        const userHtml = renderMessage(makeMessage({role: 'user', content: 'hello'}));

        expect(userHtml).toContain('You');
        expect(userHtml).toContain('title="Copy"');
        expect(userHtml).toContain('aria-label="Copy"');
        expect(userHtml).not.toContain('chat.message.user');
        expect(userHtml).not.toContain('chat.message.copy');
    });

    it('keeps empty and streaming message chrome readable when i18n keys are unavailable', () => {
        translationState.keyOnly = true;

        const emptyUserHtml = renderMessage(makeMessage({role: 'user', content: '', error: 'send failed'}));
        const streamingHtml = renderMessage(makeMessage({
            role: 'assistant',
            content: 'partial response',
            streaming: true,
        }));

        expect(emptyUserHtml).toContain('Empty message');
        expect(streamingHtml).toContain('Connected, generating response...');
        expect(streamingHtml).toContain('title="Copy"');
        expect(emptyUserHtml).not.toContain('chat.message.emptyUser');
        expect(streamingHtml).not.toContain('chat.message.streamingConnected');
        expect(streamingHtml).not.toContain('chat.message.copy');
    });
});

describe('WaitingIndicator', () => {
    afterEach(() => {
        translationState.keyOnly = false;
    });

    it('keeps waiting text readable when i18n keys are unavailable', () => {
        translationState.keyOnly = true;

        const html = renderToStaticMarkup(<WaitingIndicator />);

        expect(html).toContain('Waiting for response...');
        expect(html).not.toContain('chat.message.waiting');
    });
});

describe('StreamingPlaceholder', () => {
    afterEach(() => {
        translationState.keyOnly = false;
    });

    it('keeps initial waiting text readable when i18n keys are unavailable', () => {
        translationState.keyOnly = true;

        const html = renderToStaticMarkup(<StreamingPlaceholder />);

        expect(html).toContain('Waiting for response...');
        expect(html).not.toContain('chat.message.waiting');
    });
});
