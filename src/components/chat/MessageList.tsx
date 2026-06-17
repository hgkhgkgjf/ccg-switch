import {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {ChatMessage, ContentBlock} from '../../types/chat';
import {getRenderableContentBlocks, shouldRenderChatMessage} from '../../utils/chatMessageFlow';
import MessageItem from './MessageItem';

const VISIBLE_MESSAGE_WINDOW = 15;
const REVEAL_PAGE_SIZE = 30;

interface RenderableMessage {
    message: ChatMessage;
    originalIndex: number;
}

interface MessageListProps {
    messages: ChatMessage[];
    searchQuery?: string;
}

function getBlockSearchText(block: ContentBlock): string {
    if (block.type === 'text') return block.text;
    if (block.type === 'thinking') return block.thinking;
    if (block.type === 'tool_use') return `${block.name} ${JSON.stringify(block.input)}`;
    if (block.type === 'tool_result') {
        if (typeof block.content === 'string') return block.content;
        if (Array.isArray(block.content)) return block.content.map(getBlockSearchText).join('\n');
    }

    return '';
}

function getMessageSearchText(message: ChatMessage): string {
    const rawText = getRenderableContentBlocks(message.raw)
        .map(getBlockSearchText)
        .join('\n');

    return [message.role, message.content, rawText, message.error]
        .filter((part): part is string => Boolean(part))
        .join('\n')
        .toLowerCase();
}

export default function MessageList({ messages, searchQuery = '' }: MessageListProps) {
    const { t } = useTranslation();
    const [revealedCount, setRevealedCount] = useState(0);
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const renderableMessages = useMemo<RenderableMessage[]>(() => (
        messages
            .map((message, originalIndex) => ({ message, originalIndex }))
            .filter(({ message }) => shouldRenderChatMessage(message))
    ), [messages]);

    const filteredMessages = useMemo<RenderableMessage[]>(() => {
        if (!normalizedSearchQuery) return renderableMessages;

        return renderableMessages.filter(({ message }) => (
            getMessageSearchText(message).includes(normalizedSearchQuery)
        ));
    }, [normalizedSearchQuery, renderableMessages]);

    const totalEarlierMessages = Math.max(0, filteredMessages.length - VISIBLE_MESSAGE_WINDOW);
    const isSearching = normalizedSearchQuery.length > 0;
    const collapsedCount = isSearching ? 0 : Math.max(0, totalEarlierMessages - revealedCount);
    const visibleMessages = isSearching ? filteredMessages : filteredMessages.slice(collapsedCount);
    const lastRenderableIndex = renderableMessages.length > 0
        ? renderableMessages[renderableMessages.length - 1].originalIndex
        : undefined;
    const nextRevealCount = Math.min(REVEAL_PAGE_SIZE, collapsedCount);

    useEffect(() => {
        setRevealedCount((current) => Math.min(current, totalEarlierMessages));
    }, [totalEarlierMessages]);

    const handleRevealEarlier = () => {
        setRevealedCount((current) => Math.min(totalEarlierMessages, current + REVEAL_PAGE_SIZE));
    };

    return (
        <div className="space-y-4 pb-6">
            {normalizedSearchQuery && (
                <div className="mx-auto w-full max-w-4xl rounded-lg border border-base-300 bg-base-100/80 px-3 py-2 text-xs text-base-content/60 shadow-sm">
                    {filteredMessages.length > 0
                        ? t('chat.layout.searchResults', { count: filteredMessages.length })
                        : t('chat.layout.searchNoResults')}
                </div>
            )}

            {collapsedCount > 0 && (
                <div className="mx-auto flex w-full max-w-4xl justify-center py-1">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm rounded-full border border-base-300 bg-base-100/85 px-4 text-base-content/60 shadow-sm backdrop-blur hover:border-base-content/20 hover:text-base-content"
                        onClick={handleRevealEarlier}
                    >
                        {t('chat.message.showEarlier', { count: nextRevealCount, total: collapsedCount })}
                    </button>
                </div>
            )}

            {visibleMessages.map(({ message, originalIndex }) => (
                <MessageItem
                    key={message.id}
                    message={message}
                    messages={messages}
                    messageIndex={originalIndex}
                    isLast={originalIndex === lastRenderableIndex}
                    isSearchMatch={isSearching}
                />
            ))}
        </div>
    );
}
