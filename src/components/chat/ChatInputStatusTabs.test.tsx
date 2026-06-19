import type {ComponentProps, ComponentType} from 'react';
import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ChatInputStatusTabs, {
    getInputStatusTabAfterEditSelection,
    getInputStatusTabAfterToolSelection,
    shouldDismissInputStatusPopoverForKey,
    shouldDismissInputStatusPopoverForPointer,
} from './ChatInputStatusTabs';
import {type ChatStatusSummary, getChatStatusEditKey} from '../../utils/chatStatusSummary';
import type {ChatMcpAvailabilitySummary} from '../../utils/chatMcpStatus';

type ChatInputStatusTabsWithMcpProps = ComponentProps<typeof ChatInputStatusTabs> & {
    defaultOpenTab?: ComponentProps<typeof ChatInputStatusTabs>['defaultOpenTab'] | 'mcp' | null;
    mcpStatus?: ChatMcpAvailabilitySummary;
};

const ChatInputStatusTabsWithMcp = ChatInputStatusTabs as ComponentType<ChatInputStatusTabsWithMcpProps>;

const agentTool: ChatStatusSummary['activeTool'] = {
    toolId: 'tool-agent',
    type: 'agent',
    label: 'Agent',
    accentClass: 'tool-command-plan',
    summary: 'Review composer status strip',
    detail: 'frontend-reviewer · claude-sonnet-provider-20260601',
    status: 'pending',
};

const editSummary = {
    toolId: 'tool-edit',
    displayPath: 'src/pages/ChatPage.tsx',
    openPath: 'src/pages/ChatPage.tsx',
    additions: 5,
    deletions: 2,
    status: 'completed' as const,
    diffPreviewLines: [],
};

const statusSummary: ChatStatusSummary = {
    activeTool: agentTool,
    toolTimeline: [
        {
            toolId: 'tool-build',
            type: 'bash',
            label: 'npm',
            accentClass: 'tool-command-bash',
            summary: 'npm test',
            detail: 'Tests passed',
            status: 'completed',
        },
        agentTool,
        {
            toolId: 'tool-edit',
            type: 'edit',
            label: 'Edit',
            accentClass: 'tool-command-patch',
            summary: 'src/pages/ChatPage.tsx',
            detail: '+5 / -2',
            status: 'completed',
        },
    ],
    agentTools: [agentTool],
    recentEdits: [editSummary],
    allEdits: [editSummary],
    touchedFileCount: 1,
    totalAdditions: 5,
    totalDeletions: 2,
    pendingToolCount: 1,
    completedToolCount: 2,
    errorToolCount: 0,
};

const emptyStatusSummary: ChatStatusSummary = {
    recentEdits: [],
    allEdits: [],
    touchedFileCount: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    pendingToolCount: 0,
    completedToolCount: 0,
    errorToolCount: 0,
    toolTimeline: [],
    agentTools: [],
};

const mcpStatus: ChatMcpAvailabilitySummary = {
    totalServers: 2,
    enabledServers: 1,
    loading: false,
    error: null,
    servers: [
        {
            id: 'filesystem',
            name: 'Filesystem',
            enabled: true,
            transport: 'stdio',
        },
        {
            id: 'github',
            name: 'GitHub',
            enabled: false,
            transport: 'http',
        },
    ],
};

describe('ChatInputStatusTabs', () => {
    it('renders a git branch chip when the current workspace is a git repository', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={{
                    recentEdits: [],
                    allEdits: [],
                    touchedFileCount: 0,
                    totalAdditions: 0,
                    totalDeletions: 0,
                    pendingToolCount: 0,
                    completedToolCount: 0,
                    errorToolCount: 0,
                    toolTimeline: [],
                    agentTools: [],
                }}
                workspaceStatus={{
                    gitBranch: 'codex/chat-status',
                    gitRoot: 'C:/repo',
                    isGitRepository: true,
                }}
            />,
        );

        expect(html).toContain('chat-input-status-git-branch');
        expect(html).toContain('codex/chat-status');
        expect(html).not.toContain('chat-input-status-tab-tasks');
        expect(html).not.toContain('chat-input-status-tab-subagents');
        expect(html).not.toContain('chat-input-status-tab-edits');
    });

    it('keeps the git branch chip compact while preserving accessible branch context', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={emptyStatusSummary}
                workspaceStatus={{
                    gitBranch: 'feature/very-long-chat-ui-parity-branch-name',
                    gitRoot: 'C:/repo',
                    isGitRepository: true,
                }}
            />,
        );

        expect(html).toContain('chat-input-status-git-branch');
        expect(html).toContain('chat-input-status-git-label hidden sm:inline');
        expect(html).toContain('chat-input-status-git-value');
        expect(html).toContain('feature/very-long-chat-ui-parity-branch-name');
        expect(html).toContain('aria-label="chat.layout.inputStatusGitBranch feature/very-long-chat-ui-parity-branch-name"');
        expect(html).toContain('title="chat.layout.inputStatusGitBranch: feature/very-long-chat-ui-parity-branch-name');
    });

    it('hides the status strip when there is no git branch or triggered activity', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={emptyStatusSummary}
                workspaceStatus={{
                    gitBranch: null,
                    gitRoot: null,
                    isGitRepository: false,
                }}
            />,
        );

        expect(html).toBe('');
    });

    it('renders an mcp entry above the composer when servers are configured', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabsWithMcp
                statusSummary={emptyStatusSummary}
                mcpStatus={mcpStatus}
            />,
        );

        expect(html).toContain('chat-input-status-tab-mcp');
        expect(html).toContain('MCP');
        expect(html).toContain('1 / 2');
        expect(html).not.toContain('chat-input-status-tab-tasks');
    });

    it('renders configured mcp server details when the mcp entry is open', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabsWithMcp
                statusSummary={emptyStatusSummary}
                mcpStatus={mcpStatus}
                defaultOpenTab="mcp"
            />,
        );

        expect(html).toContain('chat-input-status-mcp-server');
        expect(html).toContain('Filesystem');
        expect(html).toContain('stdio');
        expect(html).toContain('GitHub');
        expect(html).toContain('http');
        expect(html).toContain('Enabled');
        expect(html).toContain('Disabled');
    });

    it('keeps the status strip hidden for empty idle mcp configuration', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabsWithMcp
                statusSummary={emptyStatusSummary}
                mcpStatus={{
                    totalServers: 0,
                    enabledServers: 0,
                    loading: false,
                    error: null,
                    servers: [],
                }}
            />,
        );

        expect(html).toBe('');
    });

    it('renders the compact tasks, subagents, and edits entries above the composer without duplicating subagents as tasks', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                isStreaming
                defaultOpenTab="tasks"
            />,
        );

        expect(html).toContain('chat-input-status-tabs');
        expect(html).toContain('chat-input-status-tab-tasks');
        expect(html).toContain('chat-input-status-tab-subagents');
        expect(html).toContain('chat-input-status-tab-edits');
        expect(html).toContain('chat-input-status-count-pill');
        expect(html).toContain('chat-input-status-tab-label hidden sm:inline');
        expect(html).toContain('aria-label="chat.layout.inputStatusTasks chat.layout.inputStatusProgress"');
        expect(html).toContain('title="chat.layout.inputStatusTasks chat.layout.inputStatusProgress"');
        expect(html).toContain('npm test');
        expect(html).toContain('src/pages/ChatPage.tsx');
        expect(html).not.toContain('Review composer status strip');
        expect(html).not.toContain('frontend-reviewer');
        expect(html).not.toContain('claude-sonnet-provider-20260601');
    });

    it('renders task rows as transcript jump targets when selection is available', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                defaultOpenTab="tasks"
                onSelectTool={() => undefined}
            />,
        );

        expect(html).toContain('<button');
        expect(html).toContain('data-target-tool-id="tool-build"');
        expect(html).toContain('aria-label="chat.layout.scrollToToolTask"');
        expect(html).not.toContain('data-target-tool-id="tool-agent"');
        expect(html).not.toContain('disabled=""');
    });

    it('renders subagent rows with subagent-specific transcript jump labels', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                defaultOpenTab="subagents"
                onSelectTool={() => undefined}
            />,
        );

        expect(html).toContain('data-target-tool-id="tool-agent"');
        expect(html).toContain('aria-label="chat.layout.scrollToSubagentActivity"');
        expect(html).not.toContain('aria-label="chat.layout.scrollToToolTask"');
    });

    it('keeps task rows disabled when no transcript selection handler is available', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                defaultOpenTab="tasks"
            />,
        );

        expect(html).toContain('data-target-tool-id="tool-build"');
        expect(html).toContain('disabled=""');
    });

    it('keeps expandable status tabs as a small-screen fallback when the desktop status panel is visible', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabsWithMcp
                statusSummary={statusSummary}
                isStreaming
                defaultOpenTab="tasks"
                workspaceStatus={{
                    gitBranch: 'codex/chat-status',
                    gitRoot: 'C:/repo',
                    isGitRepository: true,
                }}
                mcpStatus={mcpStatus}
                collapseStatusTabsOnDesktop
            />,
        );

        expect(html).toContain('chat-input-status-git-branch');
        expect(html).not.toContain('chat-input-status-git-branch flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-transparent bg-base-200/65 px-1.5 py-1.5 text-[11px] font-medium text-base-content/70 sm:px-2 xl:hidden');
        expect(html).toContain('chat-input-status-tab-tasks xl:hidden');
        expect(html).toContain('chat-input-status-tab-subagents xl:hidden');
        expect(html).toContain('chat-input-status-tab-edits xl:hidden');
        expect(html).toContain('chat-input-status-tab-mcp xl:hidden');
        expect(html).toContain('chat-input-status-popover-panel');
        expect(html).toContain('xl:hidden');
    });

    it('renders subagent execution details when the subagent tab is open', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                defaultOpenTab="subagents"
            />,
        );

        expect(html).toContain('frontend-reviewer');
        expect(html).toContain('claude-sonnet-provider-20260601');
        expect(html).toContain('tool-state-pill pending');
    });

    it('renders the open status details as an anchored popover so composer layout is not pushed', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                isStreaming
                defaultOpenTab="tasks"
            />,
        );

        expect(html).toContain('mx-auto relative w-full max-w-2xl');
        expect(html).toContain('chat-input-status-popover-panel');
        expect(html).toContain('absolute bottom-full');
        expect(html).toContain('z-[30]');
        expect(html).toContain('role="region"');
        expect(html).toMatch(/tabindex="0"/i);
        expect(html).toContain('aria-label="chat.layout.inputStatusDetailsRegion"');
        expect(html).toContain('npm test');
    });

    it('treats outside pointer events and Escape as status popover dismiss actions', () => {
        const insideTarget = {id: 'inside'} as unknown as Node;
        const outsideTarget = {id: 'outside'} as unknown as Node;
        const root: Pick<Node, 'contains'> = {
            contains: (target: Node | null) => target === insideTarget,
        };

        expect(shouldDismissInputStatusPopoverForPointer(root, insideTarget)).toBe(false);
        expect(shouldDismissInputStatusPopoverForPointer(root, outsideTarget)).toBe(true);
        expect(shouldDismissInputStatusPopoverForPointer(null, outsideTarget)).toBe(false);
        expect(shouldDismissInputStatusPopoverForPointer(root, null)).toBe(false);
        expect(shouldDismissInputStatusPopoverForKey('Escape')).toBe(true);
        expect(shouldDismissInputStatusPopoverForKey('Enter')).toBe(false);
    });

    it('dismisses the transient status popover after a transcript tool jump', () => {
        expect(getInputStatusTabAfterToolSelection('tasks', true)).toBeNull();
        expect(getInputStatusTabAfterToolSelection('subagents', true)).toBeNull();
        expect(getInputStatusTabAfterToolSelection('tasks', false)).toBe('tasks');
        expect(getInputStatusTabAfterToolSelection(null, true)).toBeNull();
    });

    it('dismisses the transient status popover after selecting an edited file', () => {
        expect(getInputStatusTabAfterEditSelection('edits', true)).toBeNull();
        expect(getInputStatusTabAfterEditSelection('edits', false)).toBe('edits');
        expect(getInputStatusTabAfterEditSelection(null, true)).toBeNull();
    });

    it('renders edit totals and selectable edited files when the edits tab is open', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                defaultOpenTab="edits"
                selectedEditKey={getChatStatusEditKey(editSummary)}
                onSelectedEditChange={() => undefined}
            />,
        );

        expect(html).toContain('+5');
        expect(html).toContain('-2');
        expect(html).toContain('src/pages/ChatPage.tsx');
        expect(html).toContain('chat-input-status-edit-selected');
        expect(html).not.toContain('disabled=""');
    });

    it('keeps edited file rows disabled when no edit selection handler is available', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                defaultOpenTab="edits"
                selectedEditKey={getChatStatusEditKey(editSummary)}
            />,
        );

        expect(html).toContain('src/pages/ChatPage.tsx');
        expect(html).toContain('chat-input-status-edit-selected');
        expect(html).toContain('disabled=""');
    });
});
