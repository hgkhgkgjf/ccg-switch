export const COMPOSER_MIN_HEIGHT = 44;
export const COMPOSER_DEFAULT_MAX_HEIGHT = 120;
export const COMPOSER_MAX_HEIGHT = 320;
export const AUTO_REVEAL_SCROLL_THRESHOLD = 48;
export const VISIBLE_MESSAGE_WINDOW = 15;
export const REVEAL_PAGE_SIZE = 30;

export function clampComposerHeight(
    height: number,
    minHeight = COMPOSER_MIN_HEIGHT,
    maxHeight = COMPOSER_MAX_HEIGHT,
): number {
    return Math.min(maxHeight, Math.max(minHeight, Math.round(height)));
}

export function getComposerHeightFromDrag(
    startHeight: number,
    startClientY: number,
    currentClientY: number,
): number {
    return clampComposerHeight(startHeight + startClientY - currentClientY);
}

interface AutoRevealInput {
    scrollTop: number;
    collapsedCount: number;
    isSearching: boolean;
    threshold?: number;
}

export function shouldAutoRevealEarlierMessages({
    scrollTop,
    collapsedCount,
    isSearching,
    threshold = AUTO_REVEAL_SCROLL_THRESHOLD,
}: AutoRevealInput): boolean {
    return !isSearching && collapsedCount > 0 && scrollTop <= threshold;
}

interface CollapsedMessageWindowInput {
    filteredCount: number;
    revealedCount: number;
    isSearching: boolean;
}

interface CollapsedMessageWindowResult {
    totalEarlierMessages: number;
    collapsedCount: number;
    nextRevealCount: number;
    visibleStartIndex: number;
}

export function getCollapsedMessageWindow({
    filteredCount,
    revealedCount,
    isSearching,
}: CollapsedMessageWindowInput): CollapsedMessageWindowResult {
    const totalEarlierMessages = Math.max(0, filteredCount - VISIBLE_MESSAGE_WINDOW);
    const collapsedCount = isSearching
        ? 0
        : Math.max(0, totalEarlierMessages - Math.min(revealedCount, totalEarlierMessages));

    return {
        totalEarlierMessages,
        collapsedCount,
        nextRevealCount: collapsedCount > 0 ? Math.min(REVEAL_PAGE_SIZE, collapsedCount) : 0,
        visibleStartIndex: isSearching ? 0 : collapsedCount,
    };
}

interface ScrollPreserveInput {
    previousScrollTop: number;
    previousScrollHeight: number;
    nextScrollHeight: number;
}

export function getScrollTopAfterPrepend({
    previousScrollTop,
    previousScrollHeight,
    nextScrollHeight,
}: ScrollPreserveInput): number {
    return Math.max(0, previousScrollTop + nextScrollHeight - previousScrollHeight);
}
