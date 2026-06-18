import {describe, expect, it} from 'vitest';
import {
    clampComposerHeight,
    COMPOSER_DEFAULT_MAX_HEIGHT,
    COMPOSER_MAX_HEIGHT,
    COMPOSER_MIN_HEIGHT,
    CONVERSATION_PANE_MAX_WIDTH,
    CONVERSATION_PANE_MIN_WIDTH,
    getClampedRevealState,
    getCollapsedMessageWindow,
    getComposerHeightFromDrag,
    getEffectiveRevealedCount,
    getNextRevealState,
    getPaneWidthsAfterResize,
    getScrollTopAfterPrepend,
    shouldAutoRevealEarlierMessages,
    shouldShowDiffPaneReopenControl,
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
});
