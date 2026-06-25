// @vitest-environment jsdom

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {invoke, isTauri} from '@tauri-apps/api/core';
import {
    createAndCheckoutChatGitBranch,
    EMPTY_CHAT_WORKSPACE_STATUS,
    listChatGitBranches,
    loadChatWorkspaceStatus,
    normalizeChatWorkspaceStatus,
    openChatPathInExplorer,
    pickWorkspaceFolder,
    renameChatSessionTitle,
} from './chatWorkspaceStatus';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
    isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);
const mockedIsTauri = vi.mocked(isTauri);

describe('chatWorkspaceStatus', () => {
    beforeEach(() => {
        mockedInvoke.mockReset();
        mockedIsTauri.mockReset();
        mockedIsTauri.mockReturnValue(true);
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

    it('loads git branches from tauri with a trimmed cwd', async () => {
        mockedInvoke.mockResolvedValue([
            {name: ' main ', current: false},
            {name: 'cc-gui', current: true},
            {name: ' ', current: false},
        ]);

        await expect(listChatGitBranches(' C:/repo/app ')).resolves.toEqual([
            {name: 'main', current: false},
            {name: 'cc-gui', current: true},
        ]);
        expect(mockedInvoke).toHaveBeenCalledWith('chat_git_list_branches', {cwd: 'C:/repo/app'});
    });

    it('creates and checks out a branch with trimmed arguments', async () => {
        mockedInvoke.mockResolvedValue({
            is_git_repository: true,
            git_root: 'C:/repo',
            git_branch: 'feature/workspace-switch',
        });

        await expect(createAndCheckoutChatGitBranch(
            ' C:/repo/app ',
            ' feature/workspace-switch ',
        )).resolves.toEqual({
            isGitRepository: true,
            gitRoot: 'C:/repo',
            gitBranch: 'feature/workspace-switch',
        });
        expect(mockedInvoke).toHaveBeenCalledWith('chat_git_create_and_checkout_branch', {
            cwd: 'C:/repo/app',
            branchName: 'feature/workspace-switch',
        });
    });

    it('opens a chat path in Explorer with a trimmed path', async () => {
        mockedInvoke.mockResolvedValue(undefined);

        await openChatPathInExplorer(' C:/repo/app ');

        expect(mockedInvoke).toHaveBeenCalledWith('chat_open_path_in_explorer', {path: 'C:/repo/app'});
    });

    it('renames a chat session title with trimmed arguments', async () => {
        mockedInvoke.mockResolvedValue({title: 'Renamed session'});

        await expect(renameChatSessionTitle(
            ' claude ',
            ' session-1 ',
            ' Renamed session ',
        )).resolves.toEqual({title: 'Renamed session'});

        expect(mockedInvoke).toHaveBeenCalledWith('chat_session_rename', {
            providerId: 'claude',
            sessionId: 'session-1',
            title: 'Renamed session',
        });
    });

    it('returns the directory chosen by the native dialog', async () => {
        const {open} = await import('@tauri-apps/plugin-dialog');
        vi.mocked(open).mockResolvedValue('C:/picked/dir');

        await expect(pickWorkspaceFolder({defaultPath: ' C:/repo '})).resolves.toBe('C:/picked/dir');
        expect(open).toHaveBeenCalledWith(expect.objectContaining({
            directory: true,
            multiple: false,
            defaultPath: 'C:/repo',
        }));
    });

    it('falls back to a prompt when not running in tauri', async () => {
        mockedIsTauri.mockReturnValue(false);
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(' C:/manual/dir ');

        await expect(pickWorkspaceFolder({promptFallbackLabel: 'Open folder path'}))
            .resolves.toBe('C:/manual/dir');
        expect(promptSpy).toHaveBeenCalledWith('Open folder path', '');

        promptSpy.mockRestore();
    });

    it('returns null when the prompt fallback is cancelled', async () => {
        mockedIsTauri.mockReturnValue(false);
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);

        await expect(pickWorkspaceFolder()).resolves.toBeNull();

        promptSpy.mockRestore();
    });
});
