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

interface ChatSessionSelectionInput {
    sessionKey: string;
    activeSessionKey: string | null;
    pendingSessionKey: string | null;
}

interface CompleteChatStatusSummaryInput {
    messageCount: number;
    isSearching: boolean;
    sessionLoadStatus?: 'loading' | 'windowed' | 'complete' | 'error' | null;
}

interface FullHistorySearchIntentInput {
    isSearching: boolean;
    activeSessionKey: string | null;
    sessionLoadStatus?: 'loading' | 'windowed' | 'complete' | 'error' | null;
    fullHistorySearchSessionKey?: string | null;
    fullHistorySearchStatus?: 'loading' | 'complete' | 'error' | null;
}

export function shouldIgnoreChatSessionSelection({
    sessionKey,
    activeSessionKey,
    pendingSessionKey,
}: ChatSessionSelectionInput): boolean {
    return sessionKey === pendingSessionKey || (!pendingSessionKey && sessionKey === activeSessionKey);
}

export function shouldBuildCompleteChatStatusSummary({
    messageCount,
    isSearching,
    sessionLoadStatus,
}: CompleteChatStatusSummaryInput): boolean {
    return messageCount > 0 && !isSearching && sessionLoadStatus !== 'windowed';
}

export function shouldRequestFullHistoryForSearch({
    isSearching,
    activeSessionKey,
    sessionLoadStatus,
    fullHistorySearchSessionKey,
    fullHistorySearchStatus,
}: FullHistorySearchIntentInput): boolean {
    if (!isSearching || !activeSessionKey || sessionLoadStatus !== 'windowed') return false;
    if (fullHistorySearchSessionKey !== activeSessionKey) return true;
    return fullHistorySearchStatus !== 'loading' && fullHistorySearchStatus !== 'complete';
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

export type ActivePermissionDialog =
    | 'ask-user-question'
    | 'plan-approval'
    | 'tool-permission'
    | null;

interface ActivePermissionDialogInput {
    hasAskUserQuestion?: boolean;
    askUserQuestionTimestamp?: string | null;
    hasPlanApproval?: boolean;
    planApprovalTimestamp?: string | null;
    hasToolPermission?: boolean;
    toolPermissionTimestamp?: string | null;
}

const PERMISSION_DIALOG_PRIORITY: Record<Exclude<ActivePermissionDialog, null>, number> = {
    'ask-user-question': 0,
    'plan-approval': 1,
    'tool-permission': 2,
};

function parsePermissionTimestamp(timestamp: string | null | undefined): number {
    if (!timestamp) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(timestamp);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function isPermissionDialogCandidatePresent(
    hasCandidate: boolean | undefined,
    timestamp: string | null | undefined,
): boolean {
    return hasCandidate ?? (timestamp !== null && timestamp !== undefined);
}

export function getActivePermissionDialog({
    hasAskUserQuestion,
    askUserQuestionTimestamp,
    hasPlanApproval,
    planApprovalTimestamp,
    hasToolPermission,
    toolPermissionTimestamp,
}: ActivePermissionDialogInput): ActivePermissionDialog {
    const candidates: Array<{
        type: Exclude<ActivePermissionDialog, null>;
        timestamp: number;
        priority: number;
    }> = [];

    if (isPermissionDialogCandidatePresent(hasAskUserQuestion, askUserQuestionTimestamp)) {
        candidates.push({
            type: 'ask-user-question',
            timestamp: parsePermissionTimestamp(askUserQuestionTimestamp),
            priority: PERMISSION_DIALOG_PRIORITY['ask-user-question'],
        });
    }
    if (isPermissionDialogCandidatePresent(hasPlanApproval, planApprovalTimestamp)) {
        candidates.push({
            type: 'plan-approval',
            timestamp: parsePermissionTimestamp(planApprovalTimestamp),
            priority: PERMISSION_DIALOG_PRIORITY['plan-approval'],
        });
    }
    if (isPermissionDialogCandidatePresent(hasToolPermission, toolPermissionTimestamp)) {
        candidates.push({
            type: 'tool-permission',
            timestamp: parsePermissionTimestamp(toolPermissionTimestamp),
            priority: PERMISSION_DIALOG_PRIORITY['tool-permission'],
        });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
        if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
        return b.priority - a.priority;
    });

    return candidates[0].type;
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

export const TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS = 'chat-tool-anchor-jump-highlight';
export const TOOL_ANCHOR_JUMP_HIGHLIGHT_DURATION_MS = 1400;

interface HighlightableToolAnchor {
    classList: Pick<DOMTokenList, 'add' | 'remove'>;
    dataset: DOMStringMap;
}

interface HighlightTranscriptToolAnchorOptions {
    durationMs?: number;
    previousCleanup?: (() => void) | null;
    setTimeoutFn?: (handler: () => void, timeout: number) => unknown;
    clearTimeoutFn?: (handle: unknown) => void;
}

export function highlightTranscriptToolAnchor(
    anchor: HighlightableToolAnchor,
    {
        durationMs = TOOL_ANCHOR_JUMP_HIGHLIGHT_DURATION_MS,
        previousCleanup,
        setTimeoutFn = (handler, timeout) => globalThis.setTimeout(handler, timeout),
        clearTimeoutFn = (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
    }: HighlightTranscriptToolAnchorOptions = {},
): () => void {
    previousCleanup?.();

    let cleaned = false;
    let timeoutHandle: unknown = null;
    const clearHighlight = () => {
        anchor.classList.remove(TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS);
        delete anchor.dataset.chatToolJumpHighlighted;
    };

    clearHighlight();
    anchor.classList.add(TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS);
    anchor.dataset.chatToolJumpHighlighted = 'true';

    timeoutHandle = setTimeoutFn(() => {
        if (cleaned) return;
        cleaned = true;
        clearHighlight();
    }, durationMs);

    return () => {
        if (cleaned) return;
        cleaned = true;
        if (timeoutHandle !== null) {
            clearTimeoutFn(timeoutHandle);
        }
        clearHighlight();
    };
}
