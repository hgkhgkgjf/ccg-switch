import {type RefObject, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {ChatMessage} from '../../types/chat';
import {
    getClampedRevealState,
    getCollapsedMessageWindow,
    getEffectiveRevealedCount,
    getNextRevealState,
    getScrollTopAfterPrepend,
    shouldAutoRevealEarlierMessages,
    type TranscriptRevealState,
} from '../../utils/chatUiBehavior';
import {
    filterRenderableMessages,
    getRenderableMessages,
    isMessageAnchorCandidate,
    type RenderableMessage,
} from '../../utils/chatNavigation';
import MessageItem from './MessageItem';

interface MessageListProps {
    messages: ChatMessage[];
    searchQuery?: string;
    scrollContainerRef?: RefObject<HTMLDivElement | null>;
    onCollapsedCountChange?: (count: number) => void;
    onMessageNodeRef?: (messageId: string, node: HTMLElement | null) => void;
}

export default function MessageList({
    messages,
    searchQuery = '',
    scrollContainerRef,
    onCollapsedCountChange,
    onMessageNodeRef,
}: MessageListProps) {
    const { t } = useTranslation();
    const [revealState, setRevealState] = useState<TranscriptRevealState>({
        transcriptKey: '',
        revealedCount: 0,
    });
    const revealAnchorRef = useRef<{
        previousScrollHeight: number;
        previousScrollTop: number;
    } | null>(null);
    const revealPendingRef = useRef(false);
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const renderableMessages = useMemo<RenderableMessage[]>(() => (
        getRenderableMessages(messages)
    ), [messages]);
    const transcriptKey = renderableMessages[0]?.message.id ?? '';
    const revealedCount = getEffectiveRevealedCount(revealState, transcriptKey);

    const filteredMessages = useMemo<RenderableMessage[]>(() => {
        return filterRenderableMessages(renderableMessages, normalizedSearchQuery);
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
        setRevealState((current) => getClampedRevealState(
            current,
            transcriptKey,
            totalEarlierMessages,
        ));
    }, [totalEarlierMessages, transcriptKey]);

    useEffect(() => {
        onCollapsedCountChange?.(collapsedCount);
    }, [collapsedCount, onCollapsedCountChange]);

    const revealEarlierMessages = useCallback((scrollEl?: HTMLDivElement | null) => {
        if (collapsedCount <= 0) return;

        if (scrollEl) {
            revealAnchorRef.current = {
                previousScrollHeight: scrollEl.scrollHeight,
                previousScrollTop: scrollEl.scrollTop,
            };
        }

        revealPendingRef.current = true;
        setRevealState((current) => {
            const currentRevealed = getEffectiveRevealedCount(current, transcriptKey);
            const next = getNextRevealState(current, transcriptKey, totalEarlierMessages);
            if (next.revealedCount === currentRevealed) {
                revealPendingRef.current = false;
                revealAnchorRef.current = null;
            }
            return next;
        });
    }, [collapsedCount, totalEarlierMessages, transcriptKey]);

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
                    anchorId={isMessageAnchorCandidate(message) ? message.id : undefined}
                    onAnchorRef={onMessageNodeRef}
                />
            ))}
        </div>
    );
}
