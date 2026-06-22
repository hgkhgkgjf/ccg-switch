import {describe, expect, it} from 'vitest';
import {
    clampComposerHeight,
    COMPOSER_DEFAULT_MAX_HEIGHT,
    COMPOSER_MAX_HEIGHT,
    COMPOSER_MIN_HEIGHT,
    CONVERSATION_PANE_MAX_WIDTH,
    CONVERSATION_PANE_MIN_WIDTH,
    getActivePermissionDialog,
    getChatComposerInputLabel,
    getChatComposerModeText,
    getChatComposerReasoningText,
    getChatComposerToolbarLabel,
    getChatNavigationControlLabel,
    getChatTopChromeActionLabel,
    getClampedRevealState,
    getCollapsedMessageWindow,
    getComposerHeightFromDrag,
    getDiffPaneReopenLabel,
    getEffectiveRevealedCount,
    getNextRevealState,
    getPaneResizeHandleLabel,
    getPaneWidthsAfterResize,
    getScrollTopAfterPrepend,
    getSdkMissingBannerText,
    highlightTranscriptToolAnchor,
    queueDiffPaneFocusAfterOpen,
    shouldAutoRevealEarlierMessages,
    shouldBuildCompleteChatStatusSummary,
    shouldIgnoreChatSessionSelection,
    shouldRequestFullHistoryForSearch,
    shouldShowDiffPaneReopenControl,
    TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS,
} from './chatUiBehavior';

describe('chat UI behavior', () => {
    it('clamps composer resize height inside the supported range', () => {
        expect(clampComposerHeight(COMPOSER_MIN_HEIGHT - 20)).toBe(COMPOSER_MIN_HEIGHT);
        expect(clampComposerHeight(COMPOSER_DEFAULT_MAX_HEIGHT)).toBe(COMPOSER_DEFAULT_MAX_HEIGHT);
        expect(clampComposerHeight(COMPOSER_MAX_HEIGHT + 20)).toBe(COMPOSER_MAX_HEIGHT);
    });

    it('resizes the composer upward as the resize handle is dragged upward', () => {
        expect(getComposerHeightFromDrag(120, 300, 260)).toBe(160);
        expect(getComposerHeightFromDrag(120, 300, 360)).toBe(60);
        expect(getComposerHeightFromDrag(120, 300, 500)).toBe(COMPOSER_MIN_HEIGHT);
    });

    it('clamps pane resize deltas so neither side crosses its width limits', () => {
        expect(getPaneWidthsAfterResize(
            240,
            600,
            320,
            CONVERSATION_PANE_MIN_WIDTH,
            CONVERSATION_PANE_MAX_WIDTH,
            260,
            520,
        )).toEqual({
            leftWidth: 660,
            rightWidth: 260,
        });

        expect(getPaneWidthsAfterResize(
            -480,
            600,
            320,
            CONVERSATION_PANE_MIN_WIDTH,
            CONVERSATION_PANE_MAX_WIDTH,
            260,
            520,
        )).toEqual({
            leftWidth: 400,
            rightWidth: 520,
        });
    });

    it('reveals earlier messages only when the transcript is near the top', () => {
        expect(shouldAutoRevealEarlierMessages({
            scrollTop: 24,
            collapsedCount: 12,
            isSearching: false,
        })).toBe(true);

        expect(shouldAutoRevealEarlierMessages({
            scrollTop: 120,
            collapsedCount: 12,
            isSearching: false,
        })).toBe(false);

        expect(shouldAutoRevealEarlierMessages({
            scrollTop: 0,
            collapsedCount: 0,
            isSearching: false,
        })).toBe(false);

        expect(shouldAutoRevealEarlierMessages({
            scrollTop: 0,
            collapsedCount: 12,
            isSearching: true,
        })).toBe(false);
    });

    it('computes collapsed history paging for normal transcript browsing', () => {
        expect(getCollapsedMessageWindow({
            filteredCount: 96,
            revealedCount: 15,
            isSearching: false,
        })).toEqual({
            totalEarlierMessages: 81,
            collapsedCount: 66,
            nextRevealCount: 30,
            visibleStartIndex: 66,
        });
    });

    it('resets revealed history when switching to a different transcript', () => {
        const previousState = {
            transcriptKey: 'session-a-first-message',
            revealedCount: 90,
        };

        expect(getEffectiveRevealedCount(previousState, 'session-b-first-message')).toBe(0);
        expect(getClampedRevealState(previousState, 'session-b-first-message', 35)).toEqual({
            transcriptKey: 'session-b-first-message',
            revealedCount: 0,
        });
    });

    it('keeps paged reveal state inside the same transcript', () => {
        const state = {
            transcriptKey: 'session-a-first-message',
            revealedCount: 30,
        };

        expect(getNextRevealState(state, 'session-a-first-message', 95)).toEqual({
            transcriptKey: 'session-a-first-message',
            revealedCount: 60,
        });
        expect(getClampedRevealState(state, 'session-a-first-message', 20)).toEqual({
            transcriptKey: 'session-a-first-message',
            revealedCount: 20,
        });
    });

    it('disables history collapsing while searching so all matches stay visible', () => {
        expect(getCollapsedMessageWindow({
            filteredCount: 96,
            revealedCount: 0,
            isSearching: true,
        })).toEqual({
            totalEarlierMessages: 81,
            collapsedCount: 0,
            nextRevealCount: 0,
            visibleStartIndex: 0,
        });
    });

    it('preserves the visible scroll position after prepending earlier messages', () => {
        expect(getScrollTopAfterPrepend({
            previousScrollTop: 20,
            previousScrollHeight: 1000,
            nextScrollHeight: 1600,
        })).toBe(620);
    });

    it('marks a transcript tool anchor briefly after jumping to it', () => {
        const classes = new Set<string>();
        const dataset: Record<string, string> = {};
        let timeoutHandler: (() => void) | null = null;
        let clearedTimeout: unknown = null;
        let previousCleanupCount = 0;
        const anchor = {
            classList: {
                add: (className: string) => classes.add(className),
                remove: (className: string) => classes.delete(className),
            },
            dataset,
        } as unknown as HTMLElement;

        const cleanup = highlightTranscriptToolAnchor(anchor, {
            durationMs: 650,
            previousCleanup: () => {
                previousCleanupCount += 1;
            },
            setTimeoutFn: (handler, timeout) => {
                expect(timeout).toBe(650);
                timeoutHandler = handler;
                return 'highlight-timeout';
            },
            clearTimeoutFn: (handle) => {
                clearedTimeout = handle;
            },
        });

        expect(previousCleanupCount).toBe(1);
        expect(classes.has(TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS)).toBe(true);
        expect(dataset.chatToolJumpHighlighted).toBe('true');

        cleanup();
        expect(clearedTimeout).toBe('highlight-timeout');
        expect(classes.has(TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS)).toBe(false);
        expect(dataset.chatToolJumpHighlighted).toBeUndefined();

        expect(timeoutHandler).toBeTypeOf('function');
        const runTimeout = timeoutHandler as unknown as () => void;
        runTimeout();
        expect(classes.has(TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS)).toBe(false);
    });

    it('skips complete status summary work for windowed large-history browsing', () => {
        expect(shouldBuildCompleteChatStatusSummary({
            messageCount: 120,
            isSearching: false,
            sessionLoadStatus: 'windowed',
        })).toBe(false);

        expect(shouldBuildCompleteChatStatusSummary({
            messageCount: 120,
            isSearching: false,
            sessionLoadStatus: 'complete',
        })).toBe(true);

        expect(shouldBuildCompleteChatStatusSummary({
            messageCount: 120,
            isSearching: false,
            sessionLoadStatus: null,
        })).toBe(true);

        expect(shouldBuildCompleteChatStatusSummary({
            messageCount: 120,
            isSearching: true,
            sessionLoadStatus: 'complete',
        })).toBe(false);

        expect(shouldBuildCompleteChatStatusSummary({
            messageCount: 0,
            isSearching: false,
            sessionLoadStatus: 'complete',
        })).toBe(false);
    });

    it('requests full history only for active windowed-session search intent', () => {
        expect(shouldRequestFullHistoryForSearch({
            isSearching: true,
            activeSessionKey: 'codex::session',
            sessionLoadStatus: 'windowed',
            fullHistorySearchSessionKey: null,
            fullHistorySearchStatus: null,
        })).toBe(true);

        expect(shouldRequestFullHistoryForSearch({
            isSearching: false,
            activeSessionKey: 'codex::session',
            sessionLoadStatus: 'windowed',
            fullHistorySearchSessionKey: null,
            fullHistorySearchStatus: null,
        })).toBe(false);

        expect(shouldRequestFullHistoryForSearch({
            isSearching: true,
            activeSessionKey: null,
            sessionLoadStatus: 'windowed',
            fullHistorySearchSessionKey: null,
            fullHistorySearchStatus: null,
        })).toBe(false);

        expect(shouldRequestFullHistoryForSearch({
            isSearching: true,
            activeSessionKey: 'codex::session',
            sessionLoadStatus: 'complete',
            fullHistorySearchSessionKey: null,
            fullHistorySearchStatus: null,
        })).toBe(false);

        expect(shouldRequestFullHistoryForSearch({
            isSearching: true,
            activeSessionKey: 'codex::session',
            sessionLoadStatus: 'windowed',
            fullHistorySearchSessionKey: 'codex::session',
            fullHistorySearchStatus: 'loading',
        })).toBe(false);

        expect(shouldRequestFullHistoryForSearch({
            isSearching: true,
            activeSessionKey: 'codex::session',
            sessionLoadStatus: 'windowed',
            fullHistorySearchSessionKey: 'codex::session',
            fullHistorySearchStatus: 'complete',
        })).toBe(false);

        expect(shouldRequestFullHistoryForSearch({
            isSearching: true,
            activeSessionKey: 'codex::session',
            sessionLoadStatus: 'windowed',
            fullHistorySearchSessionKey: 'codex::session',
            fullHistorySearchStatus: 'error',
        })).toBe(true);
    });

    it('shows the global diff reopen affordance only when a collapsed diff can be restored', () => {
        expect(shouldShowDiffPaneReopenControl({
            diffPaneCollapsed: true,
            hasSelectedEdit: true,
        })).toBe(true);

        expect(shouldShowDiffPaneReopenControl({
            diffPaneCollapsed: false,
            hasSelectedEdit: true,
        })).toBe(false);

        expect(shouldShowDiffPaneReopenControl({
            diffPaneCollapsed: true,
            hasSelectedEdit: false,
        })).toBe(false);
    });

    it('keeps the global diff reopen label readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getDiffPaneReopenLabel({
            displayPath: 'src/components/chat/ChatDiffReviewPane.tsx',
            translate: keyOnlyTranslate,
        })).toBe('Open file diff: src/components/chat/ChatDiffReviewPane.tsx');

        expect(getDiffPaneReopenLabel({
            displayPath: null,
            translate: keyOnlyTranslate,
        })).toBe('Open file diff panel');
    });

    it('keeps pane resize handle labels readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getPaneResizeHandleLabel({
            edge: 'conversation-diff',
            translate: keyOnlyTranslate,
        })).toBe('Resize conversation and diff panes');

        expect(getPaneResizeHandleLabel({
            edge: 'diff-status',
            translate: keyOnlyTranslate,
        })).toBe('Resize diff and right panes');

        expect(getPaneResizeHandleLabel({
            edge: 'conversation-status',
            translate: keyOnlyTranslate,
        })).toBe('Resize conversation and right panes');
    });

    it('keeps chat top chrome action labels readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getChatTopChromeActionLabel({
            action: 'sdk-manage',
            translate: keyOnlyTranslate,
        })).toBe('Manage SDKs');

        expect(getChatTopChromeActionLabel({
            action: 'clear-chat',
            translate: keyOnlyTranslate,
        })).toBe('Clear chat');

        expect(getChatTopChromeActionLabel({
            action: 'sdk-install',
            translate: keyOnlyTranslate,
        })).toBe('Install SDK');

        expect(getSdkMissingBannerText({
            sdkName: 'Claude SDK',
            translate: (key) => key,
        })).toBe('Claude SDK is not installed yet. Install it to start chatting.');
    });

    it('keeps chat navigation control labels readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getChatNavigationControlLabel({
            control: 'search-placeholder',
            translate: keyOnlyTranslate,
        })).toBe('Search this conversation');

        expect(getChatNavigationControlLabel({
            control: 'clear-search',
            translate: keyOnlyTranslate,
        })).toBe('Clear search');

        expect(getChatNavigationControlLabel({
            control: 'anchor-rail',
            translate: keyOnlyTranslate,
        })).toBe('Message timeline');

        expect(getChatNavigationControlLabel({
            control: 'current-anchor',
            translate: keyOnlyTranslate,
        })).toBe('Current message');

        expect(getChatNavigationControlLabel({
            control: 'scroll-to-top',
            translate: keyOnlyTranslate,
        })).toBe('Scroll to top');

        expect(getChatNavigationControlLabel({
            control: 'scroll-to-bottom',
            translate: keyOnlyTranslate,
        })).toBe('Scroll to bottom');

        expect(getChatNavigationControlLabel({
            control: 'jump-to-message',
            index: 3,
            translate: (_key, options) => String(options?.index),
        })).toBe('3');

        expect(getChatNavigationControlLabel({
            control: 'jump-to-message',
            index: 3,
            translate: (key) => key,
        })).toBe('Jump to message 3');
    });

    it('keeps chat composer toolbar labels readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getChatComposerToolbarLabel({
            control: 'provider',
            translate: keyOnlyTranslate,
        })).toBe('AI provider');

        expect(getChatComposerToolbarLabel({
            control: 'mode',
            translate: keyOnlyTranslate,
        })).toBe('Permission mode');

        expect(getChatComposerToolbarLabel({
            control: 'model',
            translate: keyOnlyTranslate,
        })).toBe('Model');

        expect(getChatComposerToolbarLabel({
            control: 'reasoning',
            translate: keyOnlyTranslate,
        })).toBe('Reasoning effort');

        expect(getChatComposerToolbarLabel({
            control: 'models-refresh',
            translate: keyOnlyTranslate,
        })).toBe('Refresh models');

        expect(getChatComposerToolbarLabel({
            control: 'models-refreshing',
            translate: keyOnlyTranslate,
        })).toBe('Refreshing models...');

        expect(getChatComposerToolbarLabel({
            control: 'models-loading',
            translate: keyOnlyTranslate,
        })).toBe('Loading models...');

        expect(getChatComposerToolbarLabel({
            control: 'enhance',
            translate: keyOnlyTranslate,
        })).toBe('Enhance prompt');

        expect(getChatComposerToolbarLabel({
            control: 'send',
            translate: keyOnlyTranslate,
        })).toBe('Send');

        expect(getChatComposerToolbarLabel({
            control: 'stop',
            translate: keyOnlyTranslate,
        })).toBe('Stop');
    });

    it('keeps chat composer mode and reasoning option text readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getChatComposerModeText({
            mode: 'default',
            field: 'label',
            translate: keyOnlyTranslate,
        })).toBe('Default Mode');

        expect(getChatComposerModeText({
            mode: 'default',
            field: 'description',
            translate: keyOnlyTranslate,
        })).toBe('Requires manual confirmation for each operation');

        expect(getChatComposerModeText({
            mode: 'acceptEdits',
            field: 'label',
            translate: keyOnlyTranslate,
        })).toBe('Agent Mode');

        expect(getChatComposerModeText({
            mode: 'acceptEdits',
            field: 'description',
            translate: keyOnlyTranslate,
        })).toBe('Auto-accept file creation/editing, fewer confirmations');

        expect(getChatComposerModeText({
            mode: 'plan',
            field: 'label',
            translate: keyOnlyTranslate,
        })).toBe('Plan Mode');

        expect(getChatComposerModeText({
            mode: 'plan',
            field: 'description',
            translate: keyOnlyTranslate,
        })).toBe('Read-only tools only, generates plan for user approval');

        expect(getChatComposerModeText({
            mode: 'bypassPermissions',
            field: 'label',
            translate: keyOnlyTranslate,
        })).toBe('Auto Mode');

        expect(getChatComposerModeText({
            mode: 'bypassPermissions',
            field: 'description',
            translate: keyOnlyTranslate,
        })).toBe('Fully automated, bypasses all permission checks');

        expect(getChatComposerReasoningText({
            effort: 'high',
            field: 'label',
            translate: keyOnlyTranslate,
        })).toBe('High');

        expect(getChatComposerReasoningText({
            effort: 'high',
            field: 'description',
            translate: keyOnlyTranslate,
        })).toBe('Deep reasoning for complex tasks');

        expect(getChatComposerReasoningText({
            effort: 'xhigh',
            field: 'label',
            translate: keyOnlyTranslate,
        })).toBe('XHigh');

        expect(getChatComposerReasoningText({
            effort: 'max',
            field: 'description',
            translate: keyOnlyTranslate,
        })).toBe('Maximum reasoning depth');
    });

    it('keeps chat composer input surface labels readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getChatComposerInputLabel({
            control: 'attach',
            translate: keyOnlyTranslate,
        })).toBe('Add attachment');

        expect(getChatComposerInputLabel({
            control: 'remove-attachment',
            translate: keyOnlyTranslate,
        })).toBe('Remove attachment');

        expect(getChatComposerInputLabel({
            control: 'collapse-panel',
            translate: keyOnlyTranslate,
        })).toBe('Collapse status panel');

        expect(getChatComposerInputLabel({
            control: 'expand-panel',
            translate: keyOnlyTranslate,
        })).toBe('Expand status panel');

        expect(getChatComposerInputLabel({
            control: 'resize-composer',
            translate: keyOnlyTranslate,
        })).toBe('Drag to resize the input');

        expect(getChatComposerInputLabel({
            control: 'placeholder',
            translate: keyOnlyTranslate,
        })).toBe('Type a message... @ to reference files, # for subagents, ! for presets. Enter to send, Shift+Enter for newline');

        expect(getChatComposerInputLabel({
            control: 'completion-empty',
            translate: keyOnlyTranslate,
        })).toBe('No matches');

        expect(getChatComposerInputLabel({
            control: 'completion-menu',
            translate: keyOnlyTranslate,
        })).toBe('Completion suggestions');

        expect(getChatComposerInputLabel({
            control: 'completion-loading',
            translate: keyOnlyTranslate,
        })).toBe('Loading suggestions...');

        expect(getChatComposerInputLabel({
            control: 'drop-file',
            translate: keyOnlyTranslate,
        })).toBe('Drop to attach image');

        expect(getChatComposerInputLabel({
            control: 'history-hint',
            translate: keyOnlyTranslate,
        })).toBe('Press Up to restore the previous input, Down to return to an empty draft');
    });

    it('queues diff pane focus only when the desktop pane is visible', () => {
        const calls: FocusOptions[] = [];
        const target = {
            focus: (options?: FocusOptions) => {
                calls.push(options ?? {});
            },
        };
        const queuedCallbacks: Array<() => void> = [];

        expect(queueDiffPaneFocusAfterOpen(() => target, {
            matchMedia: () => ({matches: true}),
            requestAnimationFrame: (callback) => {
                queuedCallbacks.push(callback);
                return 1;
            },
        })).toBe(true);
        expect(calls).toEqual([]);

        queuedCallbacks[0]();
        expect(calls).toEqual([{preventScroll: true}]);

        expect(queueDiffPaneFocusAfterOpen(() => target, {
            matchMedia: () => ({matches: false}),
            requestAnimationFrame: (callback) => {
                queuedCallbacks.push(callback);
                return 2;
            },
        })).toBe(false);

        expect(queueDiffPaneFocusAfterOpen(() => null, {
            matchMedia: () => ({matches: true}),
            requestAnimationFrame: (callback) => {
                queuedCallbacks.push(callback);
                return 3;
            },
        })).toBe(true);
        queuedCallbacks[1]();
        expect(calls).toEqual([{preventScroll: true}]);
    });

    it('selects a single active permission dialog when multiple blocking requests are pending', () => {
        expect(getActivePermissionDialog({
            askUserQuestionTimestamp: null,
            planApprovalTimestamp: null,
            toolPermissionTimestamp: null,
        })).toBeNull();

        expect(getActivePermissionDialog({
            askUserQuestionTimestamp: '2026-06-19T09:00:00.000Z',
            planApprovalTimestamp: null,
            toolPermissionTimestamp: null,
        })).toBe('ask-user-question');

        expect(getActivePermissionDialog({
            askUserQuestionTimestamp: '2026-06-19T09:00:00.000Z',
            planApprovalTimestamp: '2026-06-19T09:00:05.000Z',
            toolPermissionTimestamp: '2026-06-19T09:00:03.000Z',
        })).toBe('plan-approval');

        expect(getActivePermissionDialog({
            askUserQuestionTimestamp: '2026-06-19T09:00:00.000Z',
            planApprovalTimestamp: '2026-06-19T09:00:00.000Z',
            toolPermissionTimestamp: '2026-06-19T09:00:00.000Z',
        })).toBe('tool-permission');
    });

    it('keeps pending permission dialogs visible even when their timestamp is empty', () => {
        expect(getActivePermissionDialog({
            hasAskUserQuestion: true,
            askUserQuestionTimestamp: '',
            hasPlanApproval: false,
            planApprovalTimestamp: null,
            hasToolPermission: false,
            toolPermissionTimestamp: null,
        })).toBe('ask-user-question');

        expect(getActivePermissionDialog({
            hasAskUserQuestion: false,
            askUserQuestionTimestamp: null,
            hasPlanApproval: true,
            planApprovalTimestamp: '',
            hasToolPermission: true,
            toolPermissionTimestamp: '',
        })).toBe('tool-permission');
    });

    it('allows reselecting the active history session while another session is pending', () => {
        expect(shouldIgnoreChatSessionSelection({
            sessionKey: 'codex::C:/sessions/active.jsonl',
            activeSessionKey: 'codex::C:/sessions/active.jsonl',
            pendingSessionKey: null,
        })).toBe(true);

        expect(shouldIgnoreChatSessionSelection({
            sessionKey: 'codex::C:/sessions/pending.jsonl',
            activeSessionKey: 'codex::C:/sessions/active.jsonl',
            pendingSessionKey: 'codex::C:/sessions/pending.jsonl',
        })).toBe(true);

        expect(shouldIgnoreChatSessionSelection({
            sessionKey: 'codex::C:/sessions/active.jsonl',
            activeSessionKey: 'codex::C:/sessions/active.jsonl',
            pendingSessionKey: 'codex::C:/sessions/pending.jsonl',
        })).toBe(false);
    });
});
