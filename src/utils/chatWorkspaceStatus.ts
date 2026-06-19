import {invoke} from '@tauri-apps/api/core';

export interface ChatWorkspaceStatus {
    isGitRepository: boolean;
    gitRoot: string | null;
    gitBranch: string | null;
}

interface RawChatWorkspaceStatus {
    is_git_repository?: boolean;
    git_root?: string | null;
    git_branch?: string | null;
}

export const EMPTY_CHAT_WORKSPACE_STATUS: ChatWorkspaceStatus = {
    isGitRepository: false,
    gitRoot: null,
    gitBranch: null,
};

function cleanString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function normalizeChatWorkspaceStatus(
    raw: RawChatWorkspaceStatus | null | undefined,
): ChatWorkspaceStatus {
    if (!raw) return EMPTY_CHAT_WORKSPACE_STATUS;

    return {
        isGitRepository: raw.is_git_repository === true,
        gitRoot: cleanString(raw.git_root),
        gitBranch: cleanString(raw.git_branch),
    };
}

export async function loadChatWorkspaceStatus(cwd?: string | null): Promise<ChatWorkspaceStatus> {
    try {
        const raw = await invoke<RawChatWorkspaceStatus>('chat_workspace_status', {
            cwd: cwd?.trim() || undefined,
        });
        return normalizeChatWorkspaceStatus(raw);
    } catch {
        return EMPTY_CHAT_WORKSPACE_STATUS;
    }
}
