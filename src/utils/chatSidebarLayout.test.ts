// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    CHAT_SIDEBAR_LAYOUT_STORAGE_KEY,
    type ChatSidebarLayoutState,
    getChatSidebarLayoutActionLabel,
    loadChatSidebarLayoutState,
    saveChatSidebarLayoutState,
} from './chatSidebarLayout';

describe('chatSidebarLayout', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('defaults both chat sidebars to expanded when no preference is stored', () => {
        expect(loadChatSidebarLayoutState()).toEqual({
            sessionSidebarCollapsed: false,
            statusSidebarCollapsed: false,
        });
    });

    it('loads and saves persisted chat sidebar collapse state', () => {
        const state: ChatSidebarLayoutState = {
            sessionSidebarCollapsed: true,
            statusSidebarCollapsed: true,
        };

        saveChatSidebarLayoutState(state);

        expect(window.localStorage.getItem(CHAT_SIDEBAR_LAYOUT_STORAGE_KEY)).toBe(JSON.stringify(state));
        expect(loadChatSidebarLayoutState()).toEqual(state);
    });

    it('falls back to expanded sidebars when persisted data is invalid', () => {
        window.localStorage.setItem(CHAT_SIDEBAR_LAYOUT_STORAGE_KEY, '{"sessionSidebarCollapsed":"yes"}');

        expect(loadChatSidebarLayoutState()).toEqual({
            sessionSidebarCollapsed: false,
            statusSidebarCollapsed: false,
        });
    });

    it('does not throw when localStorage is unavailable', () => {
        vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(loadChatSidebarLayoutState()).toEqual({
            sessionSidebarCollapsed: false,
            statusSidebarCollapsed: false,
        });
        expect(() => saveChatSidebarLayoutState({
            sessionSidebarCollapsed: true,
            statusSidebarCollapsed: true,
        })).not.toThrow();
    });

    it('keeps sidebar layout action labels readable when i18n keys are unavailable', () => {
        const translate = (key: string) => key;

        expect(getChatSidebarLayoutActionLabel({
            action: 'collapse-session-sidebar',
            translate,
        })).toBe('Collapse session sidebar');
        expect(getChatSidebarLayoutActionLabel({
            action: 'expand-session-sidebar',
            translate,
        })).toBe('Expand session sidebar');
        expect(getChatSidebarLayoutActionLabel({
            action: 'collapse-status-sidebar',
            translate,
        })).toBe('Collapse status sidebar');
        expect(getChatSidebarLayoutActionLabel({
            action: 'expand-status-sidebar',
            translate,
        })).toBe('Expand status sidebar');
    });
});
