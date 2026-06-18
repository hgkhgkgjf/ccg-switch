import {type RefObject, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {ChatMessage, ContentBlock} from '../../types/chat';
import {getRenderableContentBlocks, shouldRenderChatMessage} from '../../utils/chatMessageFlow';
import {
    getCollapsedMessageWindow,
    getScrollTopAfterPrepend,
    REVEAL_PAGE_SIZE,
    shouldAutoRevealEarlierMessages,
} from '../../utils/chatUiBehavior';
import MessageItem from './MessageItem';

interface RenderableMessage {
    message: ChatMessage;
    originalIndex: number;
}

interface MessageListProps {
    messages: ChatMessage[];
    searchQuery?: string;
    scrollContainerRef?: RefObject<HTMLDivElement | null>;
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

export default function MessageList({
    messages,
    searchQuery = '',
    scrollContainerRef,
}: MessageListProps) {
    const { t } = useTranslation();
    const [revealedCount, setRevealedCount] = useState(0);
    const revealAnchorRef = useRef<{
        previousScrollHeight: number;
        previousScrollTop: number;
    } | null>(null);
    const revealPendingRef = useRef(false);
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

    const isSearching = normalizedSearchQuery.length > 0;
    const {
        totalEarlierMessages,
        collapsedCount,
        nextRevealCount,
        visibleStartIndex,
    } = useMemo(() => getCollapsedMessageWindow({
        filteredCount: filteredMessages.length,
        revealedCount,
        isSearching,
    }), [filteredMessages.length, isSearching, revealedCount]);
    const visibleMessages = filteredMessages.slice(visibleStartIndex);
    const lastRenderableIndex = renderableMessages.length > 0
        ? renderableMessages[renderableMessages.length - 1].originalIndex
        : undefined;

    useEffect(() => {
        setRevealedCount((current) => Math.min(current, totalEarlierMessages));
    }, [totalEarlierMessages]);

    const revealEarlierMessages = useCallback((scrollEl?: HTMLDivElement | null) => {
        if (collapsedCount <= 0) return;

        if (scrollEl) {
            revealAnchorRef.current = {
                previousScrollHeight: scrollEl.scrollHeight,
                previousScrollTop: scrollEl.scrollTop,
            };
        }

        revealPendingRef.current = true;
        setRevealedCount((current) => {
            const next = Math.min(totalEarlierMessages, current + REVEAL_PAGE_SIZE);
            if (next === current) {
                revealPendingRef.current = false;
                revealAnchorRef.current = null;
            }
            return next;
        });
    }, [collapsedCount, totalEarlierMessages]);

    useEffect(() => {
        const scrollEl = scrollContainerRef?.current;
        const anchor = revealAnchorRef.current;
        if (!scrollEl || !anchor) {
            revealPendingRef.current = false;
            return;
        }

        requestAnimationFrame(() => {
            scrollEl.scrollTop = getScrollTopAfterPrepend({
                previousScrollTop: anchor.previousScrollTop,
                previousScrollHeight: anchor.previousScrollHeight,
                nextScrollHeight: scrollEl.scrollHeight,
            });
            revealAnchorRef.current = null;
            revealPendingRef.current = false;
        });
    }, [scrollContainerRef, visibleMessages.length]);

    useEffect(() => {
        const scrollEl = scrollContainerRef?.current;
        if (!scrollEl) return;

        const handleScroll = () => {
            if (revealPendingRef.current) return;
            if (!shouldAutoRevealEarlierMessages({
                scrollTop: scrollEl.scrollTop,
                collapsedCount,
                isSearching,
            })) {
                return;
            }

            revealEarlierMessages(scrollEl);
        };

        scrollEl.addEventListener('scroll', handleScroll, {passive: true});
        return () => scrollEl.removeEventListener('scroll', handleScroll);
    }, [collapsedCount, isSearching, revealEarlierMessages, scrollContainerRef]);

    return (
        <div className="space-y-1 pb-6">
            {normalizedSearchQuery && (
                <div className="mx-auto w-full max-w-4xl rounded-lg border border-base-300 bg-base-100/80 px-3 py-2 text-xs text-base-content/60 shadow-sm">
                    {filteredMessages.length > 0
                        ? t('chat.layout.searchResults', { count: filteredMessages.length })
                        : t('chat.layout.searchNoResults')}
                </div>
            )}

            {collapsedCount > 0 && (
                <div className="mx-auto flex w-full max-w-4xl justify-center py-1">
                    <div
                        className="rounded-full border border-base-300 bg-base-100/80 px-3 py-1 text-[11px] text-base-content/50 shadow-sm backdrop-blur"
                        title={t('chat.message.showEarlier', { count: nextRevealCount, total: collapsedCount })}
                    >
                        {t('chat.message.showEarlier', { count: nextRevealCount, total: collapsedCount })}
                    </div>
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
