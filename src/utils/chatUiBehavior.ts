export const COMPOSER_MIN_HEIGHT = 44;
export const COMPOSER_DEFAULT_MAX_HEIGHT = 120;
export const COMPOSER_MAX_HEIGHT = 320;
export const AUTO_REVEAL_SCROLL_THRESHOLD = 48;
export const VISIBLE_MESSAGE_WINDOW = 15;
export const REVEAL_PAGE_SIZE = 30;
export const CONVERSATION_PANE_MIN_WIDTH = 380;
export const CONVERSATION_PANE_MAX_WIDTH = 960;
export const DIFF_PANE_MIN_WIDTH = 360;
export const DIFF_PANE_MAX_WIDTH = 920;
export const STATUS_PANE_MIN_WIDTH = 260;
export const STATUS_PANE_MAX_WIDTH = 520;

export interface TranscriptRevealState {
    transcriptKey: string;
    revealedCount: number;
}

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

export function clampPaneSize(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function clampPaneResizeDelta(
    delta: number,
    leftStart: number,
    rightStart: number,
    leftMin: number,
    leftMax: number,
    rightMin: number,
    rightMax: number,
): number {
    const minDelta = Math.max(leftMin - leftStart, rightStart - rightMax);
    const maxDelta = Math.min(leftMax - leftStart, rightStart - rightMin);
    return clampPaneSize(delta, minDelta, maxDelta);
}

export interface PaneResizeResult {
    leftWidth: number;
    rightWidth: number;
}

export function getPaneWidthsAfterResize(
    delta: number,
    leftStart: number,
    rightStart: number,
    leftMin: number,
    leftMax: number,
    rightMin: number,
    rightMax: number,
): PaneResizeResult {
    const clampedDelta = clampPaneResizeDelta(
        delta,
        leftStart,
        rightStart,
        leftMin,
        leftMax,
        rightMin,
        rightMax,
    );

    return {
        leftWidth: Math.round(leftStart + clampedDelta),
        rightWidth: Math.round(rightStart - clampedDelta),
    };
}

interface DiffPaneReopenControlInput {
    diffPaneCollapsed: boolean;
    hasSelectedEdit: boolean;
}

export function shouldShowDiffPaneReopenControl({
    diffPaneCollapsed,
    hasSelectedEdit,
}: DiffPaneReopenControlInput): boolean {
    return diffPaneCollapsed && hasSelectedEdit;
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

export function getEffectiveRevealedCount(
    state: TranscriptRevealState,
    transcriptKey: string,
): number {
    return state.transcriptKey === transcriptKey ? state.revealedCount : 0;
}

export function getClampedRevealState(
    state: TranscriptRevealState,
    transcriptKey: string,
    totalEarlierMessages: number,
): TranscriptRevealState {
    const revealedCount = Math.min(
        getEffectiveRevealedCount(state, transcriptKey),
        totalEarlierMessages,
    );

    if (state.transcriptKey === transcriptKey && state.revealedCount === revealedCount) {
        return state;
    }

    return {transcriptKey, revealedCount};
}

export function getNextRevealState(
    state: TranscriptRevealState,
    transcriptKey: string,
    totalEarlierMessages: number,
    pageSize = REVEAL_PAGE_SIZE,
): TranscriptRevealState {
    return {
        transcriptKey,
        revealedCount: Math.min(
            totalEarlierMessages,
            getEffectiveRevealedCount(state, transcriptKey) + pageSize,
        ),
    };
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
