import {beforeEach, describe, expect, it, vi} from 'vitest';
import {invoke} from '@tauri-apps/api/core';
import {
    EMPTY_CHAT_WORKSPACE_STATUS,
    loadChatWorkspaceStatus,
    normalizeChatWorkspaceStatus,
} from './chatWorkspaceStatus';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe('chatWorkspaceStatus', () => {
    beforeEach(() => {
        mockedInvoke.mockReset();
    });

    it('normalizes tauri snake_case workspace status', () => {
        expect(normalizeChatWorkspaceStatus({
            is_git_repository: true,
            git_root: ' C:/repo ',
            git_branch: ' feature/chat-status ',
        })).toEqual({
            isGitRepository: true,
            gitRoot: 'C:/repo',
            gitBranch: 'feature/chat-status',
        });
    });

    it('falls back to an empty status when strings are missing', () => {
        expect(normalizeChatWorkspaceStatus({
            is_git_repository: false,
            git_root: '  ',
            git_branch: null,
        })).toEqual(EMPTY_CHAT_WORKSPACE_STATUS);
    });

    it('loads workspace status from tauri with a trimmed cwd', async () => {
        mockedInvoke.mockResolvedValue({
            is_git_repository: true,
            git_root: 'C:/repo',
            git_branch: 'main',
        });

        await expect(loadChatWorkspaceStatus(' C:/repo/app ')).resolves.toEqual({
            isGitRepository: true,
            gitRoot: 'C:/repo',
            gitBranch: 'main',
        });
        expect(mockedInvoke).toHaveBeenCalledWith('chat_workspace_status', {cwd: 'C:/repo/app'});
    });

    it('returns an empty status when tauri status loading fails', async () => {
        mockedInvoke.mockRejectedValue(new Error('tauri unavailable'));

        await expect(loadChatWorkspaceStatus('C:/repo')).resolves.toEqual(EMPTY_CHAT_WORKSPACE_STATUS);
    });
});
