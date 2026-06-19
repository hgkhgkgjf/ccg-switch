import {type RefObject, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {AlertTriangle, Loader2, RefreshCw} from 'lucide-react';
import type {ChatMessage, ToolResultBlock} from '../../types/chat';
import {
    getClampedRevealState,
    getCollapsedMessageWindow,
    getEffectiveRevealedCount,
    getNextRevealState,
    getScrollTopAfterPrepend,
    REVEAL_PAGE_SIZE,
    shouldAutoRevealEarlierMessages,
    type TranscriptRevealState,
    VISIBLE_MESSAGE_WINDOW,
} from '../../utils/chatUiBehavior';
import {
    filterRenderableMessages,
    getRecentRenderableMessages,
    getRenderableMessages,
    isMessageAnchorCandidate,
    type RenderableMessage,
} from '../../utils/chatNavigation';
import {getContentBlocksFromRaw} from '../../utils/chatMessageFlow';
import MessageItem from './MessageItem';

interface MessageListProps {
    messages: ChatMessage[];
    searchQuery?: string;
    fullHistorySearchStatus?: 'loading' | 'complete' | 'error' | null;
    scrollContainerRef?: RefObject<HTMLDivElement | null>;
    onCollapsedCountChange?: (count: number) => void;
    onMessageNodeRef?: (messageId: string, node: HTMLElement | null) => void;
    onRetryFullHistorySearch?: () => void;
}

export default function MessageList({
    messages,
    searchQuery = '',
    fullHistorySearchStatus = null,
    scrollContainerRef,
    onCollapsedCountChange,
    onMessageNodeRef,
    onRetryFullHistorySearch,
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
    const isSearching = normalizedSearchQuery.length > 0;
    const showFullHistorySearchLoading = isSearching && fullHistorySearchStatus === 'loading';
    const showFullHistorySearchError = isSearching && fullHistorySearchStatus === 'error';

    const transcriptKey = messages[0]?.id ?? '';
    const revealedCount = getEffectiveRevealedCount(revealState, transcriptKey);
    const requestedVisibleCount = VISIBLE_MESSAGE_WINDOW + revealedCount;
    const renderableWindow = useMemo(() => {
        if (isSearching) {
            const allRenderableMessages = getRenderableMessages(messages);
            return {
                renderableMessages: allRenderableMessages,
                hiddenRenderableCount: 0,
                totalRenderableCount: allRenderableMessages.length,
            };
        }

        return getRecentRenderableMessages(messages, requestedVisibleCount);
    }, [isSearching, messages, requestedVisibleCount]);
    const renderableMessages = renderableWindow.renderableMessages;

    const filteredMessages = useMemo<RenderableMessage[]>(() => {
        if (!isSearching) return renderableMessages;
        return filterRenderableMessages(renderableMessages, normalizedSearchQuery);
    }, [isSearching, normalizedSearchQuery, renderableMessages]);

    const {
        totalEarlierMessages,
        collapsedCount,
        nextRevealCount,
        visibleStartIndex,
    } = useMemo(() => {
        if (!isSearching) {
            const hiddenCount = renderableWindow.hiddenRenderableCount;
            return {
                totalEarlierMessages: hiddenCount,
                collapsedCount: hiddenCount,
                nextRevealCount: hiddenCount > 0 ? Math.min(REVEAL_PAGE_SIZE, hiddenCount) : 0,
                visibleStartIndex: 0,
            };
        }

        return getCollapsedMessageWindow({
            filteredCount: filteredMessages.length,
            revealedCount,
            isSearching,
        });
    }, [filteredMessages.length, isSearching, renderableWindow.hiddenRenderableCount, revealedCount]);
    const visibleMessages = isSearching
        ? filteredMessages.slice(visibleStartIndex)
        : filteredMessages;
    const lastRenderableIndex = renderableMessages.length > 0
        ? renderableMessages[renderableMessages.length - 1].originalIndex
        : undefined;
    const toolResultSearchStartIndex = visibleMessages[0]?.originalIndex ?? messages.length;
    const toolResultById = useMemo(() => {
        const results = new Map<string, ToolResultBlock>();

        for (let index = toolResultSearchStartIndex; index < messages.length; index += 1) {
            getContentBlocksFromRaw(messages[index].raw).forEach((block) => {
                if (block.type === 'tool_result' && !results.has(block.tool_use_id)) {
                    results.set(block.tool_use_id, block);
                }
            });
        }

        return results;
    }, [messages, toolResultSearchStartIndex]);
    const findVisibleToolResult = useCallback((toolId: string | undefined): ToolResultBlock | null => {
        if (!toolId) return null;
        return toolResultById.get(toolId) ?? null;
    }, [toolResultById]);

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
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            {showFullHistorySearchLoading && (
                                <Loader2 size={13} className="flex-shrink-0 animate-spin text-info" />
                            )}
                            {showFullHistorySearchError && (
                                <AlertTriangle size={13} className="flex-shrink-0 text-warning" />
                            )}
                            <span className="min-w-0 truncate">
                                {filteredMessages.length > 0
                                    ? t('chat.layout.searchResults', { count: filteredMessages.length })
                                    : t('chat.layout.searchNoResults')}
                            </span>
                        </div>
                        {showFullHistorySearchError && onRetryFullHistorySearch && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs h-6 min-h-0 gap-1 px-2 text-warning"
                                aria-label={t('chat.layout.searchFullHistoryRetry')}
                                onClick={onRetryFullHistorySearch}
                            >
                                <RefreshCw size={12} />
                                <span>{t('chat.layout.searchFullHistoryRetry')}</span>
                            </button>
                        )}
                    </div>
                    {(showFullHistorySearchLoading || showFullHistorySearchError) && (
                        <div className="mt-1 text-[11px] leading-snug text-base-content/45">
                            {showFullHistorySearchLoading
                                ? t('chat.layout.searchFullHistoryLoading')
                                : t('chat.layout.searchFullHistoryError')}
                        </div>
                    )}
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
                    isLast={originalIndex === lastRenderableIndex}
                    isSearchMatch={isSearching}
                    anchorId={isMessageAnchorCandidate(message) ? message.id : undefined}
                    onAnchorRef={onMessageNodeRef}
                    findToolResult={findVisibleToolResult}
                />
            ))}
        </div>
    );
}
