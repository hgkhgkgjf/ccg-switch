// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    CHAT_SESSION_SIDEBAR_STATE_STORAGE_KEY,
    type ChatSessionSidebarState,
    loadChatSessionSidebarState,
    saveChatSessionSidebarState,
} from './chatSessionSidebarState';

describe('chatSessionSidebarState', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('defaults to project mode with no collapsed recent projects', () => {
        expect(loadChatSessionSidebarState()).toEqual({
            panelMode: 'project',
            collapsedRecentProjectKeys: [],
        });
    });

    it('loads and saves the selected panel mode and collapsed recent project keys', () => {
        const state: ChatSessionSidebarState = {
            panelMode: 'recent',
            collapsedRecentProjectKeys: ['c:/workspace/ccg-switch'],
        };

        saveChatSessionSidebarState(state);

        expect(window.localStorage.getItem(CHAT_SESSION_SIDEBAR_STATE_STORAGE_KEY)).toBe(JSON.stringify(state));
        expect(loadChatSessionSidebarState()).toEqual(state);
    });

    it('falls back to default state when persisted data is invalid', () => {
        window.localStorage.setItem(CHAT_SESSION_SIDEBAR_STATE_STORAGE_KEY, JSON.stringify({
            panelMode: 'unknown',
            collapsedRecentProjectKeys: [1, 'c:/workspace/ccg-switch'],
        }));

        expect(loadChatSessionSidebarState()).toEqual({
            panelMode: 'project',
            collapsedRecentProjectKeys: [],
        });
    });

    it('does not throw when localStorage is unavailable', () => {
        vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(loadChatSessionSidebarState()).toEqual({
            panelMode: 'project',
            collapsedRecentProjectKeys: [],
        });
        expect(() => saveChatSessionSidebarState({
            panelMode: 'recent',
            collapsedRecentProjectKeys: ['c:/workspace/ccg-switch'],
        })).not.toThrow();
    });
});
