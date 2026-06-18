import {describe, expect, it} from 'vitest';
import {
    clampComposerHeight,
    COMPOSER_DEFAULT_MAX_HEIGHT,
    COMPOSER_MAX_HEIGHT,
    COMPOSER_MIN_HEIGHT,
    getCollapsedMessageWindow,
    getComposerHeightFromDrag,
    getScrollTopAfterPrepend,
    shouldAutoRevealEarlierMessages,
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
});
