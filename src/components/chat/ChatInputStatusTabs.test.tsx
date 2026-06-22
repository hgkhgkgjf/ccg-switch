import type {ComponentProps, ComponentType} from 'react';
import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createInstance} from 'i18next';
import {I18nextProvider} from 'react-i18next';
import ChatInputStatusTabs, {
    getInputStatusEmptyPanelLabel,
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

function createKeyOnlyI18n() {
    const instance = createInstance();
    instance.init({
        lng: 'en',
        fallbackLng: false,
        resources: {},
        initImmediate: false,
        interpolation: {escapeValue: false},
    });
    return instance;
}

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
    it('keeps empty status panel labels readable when i18n keys are unavailable', () => {
        expect(getInputStatusEmptyPanelLabel('tasks', (key) => key)).toBe('No task or tool activity yet');
        expect(getInputStatusEmptyPanelLabel('subagents', (key) => key)).toBe('No subagent calls yet');
        expect(getInputStatusEmptyPanelLabel('edits', (key) => key)).toBe('No file edits yet');
    });

    it('uses translated empty status panel labels when i18n provides them', () => {
        const translate = (key: string) => {
            if (key === 'chat.layout.inputStatusNoTasks') return '暂无任务或工具活动';
            if (key === 'chat.layout.inputStatusNoSubagents') return '暂无子代理调用';
            if (key === 'chat.layout.inputStatusNoEdits') return '暂无文件编辑';
            return key;
        };

        expect(getInputStatusEmptyPanelLabel('tasks', translate)).toBe('暂无任务或工具活动');
        expect(getInputStatusEmptyPanelLabel('subagents', translate)).toBe('暂无子代理调用');
        expect(getInputStatusEmptyPanelLabel('edits', translate)).toBe('暂无文件编辑');
    });

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
        expect(html).toContain('aria-label="Git feature/very-long-chat-ui-parity-branch-name"');
        expect(html).toContain('title="Git: feature/very-long-chat-ui-parity-branch-name');
        expect(html).not.toContain('chat.layout.inputStatusGitBranch');
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
        expect(html).toMatch(
            /<button[^>]*chat-input-status-tab-mcp[^>]*aria-label="MCP: 1 \/ 2 available"[^>]*title="MCP: 1 \/ 2 available"/,
        );
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
        expect(html).toContain('title="MCP server: Filesystem"');
        expect(html).toContain('aria-label="MCP server: Filesystem"');
        expect(html).toContain('title="MCP server: GitHub"');
        expect(html).toContain('aria-label="MCP server: GitHub"');
        expect(html).not.toContain('title="filesystem"');
        expect(html).not.toContain('title="github"');
        expect(html).toContain('title="MCP server transport: Filesystem · stdio"');
        expect(html).toContain('aria-label="MCP server transport: Filesystem · stdio"');
        expect(html).toContain('title="MCP server transport: GitHub · http"');
        expect(html).toContain('aria-label="MCP server transport: GitHub · http"');
        expect(html).toContain('title="Filesystem: Enabled"');
        expect(html).toContain('aria-label="Filesystem: Enabled"');
        expect(html).toContain('title="GitHub: Disabled"');
        expect(html).toContain('aria-label="GitHub: Disabled"');
    });

    it('falls back to readable mcp server labels when i18n keys are unavailable', () => {
        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatInputStatusTabsWithMcp
                    statusSummary={emptyStatusSummary}
                    mcpStatus={{
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
                                transport: null,
                            },
                        ],
                    }}
                    defaultOpenTab="mcp"
                />
            </I18nextProvider>,
        );

        expect(html).toContain('Unknown');
        expect(html).toContain('stdio');
        expect(html).toContain('Enabled');
        expect(html).toContain('Disabled');
        expect(html).toContain('title="MCP server: Filesystem"');
        expect(html).toContain('aria-label="MCP server: Filesystem"');
        expect(html).toContain('title="MCP server: GitHub"');
        expect(html).toContain('aria-label="MCP server: GitHub"');
        expect(html).not.toContain('title="filesystem"');
        expect(html).not.toContain('title="github"');
        expect(html).toContain('title="MCP server transport: Filesystem · stdio"');
        expect(html).toContain('aria-label="MCP server transport: Filesystem · stdio"');
        expect(html).toContain('title="MCP server transport: GitHub · Unknown"');
        expect(html).toContain('aria-label="MCP server transport: GitHub · Unknown"');
        expect(html).toContain('title="Filesystem: Enabled"');
        expect(html).toContain('aria-label="Filesystem: Enabled"');
        expect(html).toContain('title="GitHub: Disabled"');
        expect(html).toContain('aria-label="GitHub: Disabled"');
        expect(html).not.toContain('chat.layout.mcpLiveUnknown');
        expect(html).not.toContain('chat.layout.mcpEnabled');
        expect(html).not.toContain('chat.layout.mcpDisabled');
    });

    it('falls back to readable mcp panel labels when i18n keys are unavailable', () => {
        const manyServers = Array.from({length: 9}, (_, index) => ({
            id: `server-${index + 1}`,
            name: `Server ${index + 1}`,
            enabled: index === 0,
            transport: index === 0 ? 'stdio' : null,
        }));
        const configuredHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatInputStatusTabsWithMcp
                    statusSummary={emptyStatusSummary}
                    mcpStatus={{
                        totalServers: manyServers.length,
                        enabledServers: 1,
                        loading: false,
                        error: null,
                        servers: manyServers,
                    }}
                    defaultOpenTab="mcp"
                />
            </I18nextProvider>,
        );
        const loadingHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatInputStatusTabsWithMcp
                    statusSummary={emptyStatusSummary}
                    mcpStatus={{
                        totalServers: 0,
                        enabledServers: 0,
                        loading: true,
                        error: null,
                        servers: [],
                    }}
                    defaultOpenTab="mcp"
                />
            </I18nextProvider>,
        );
        const emptyHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatInputStatusTabsWithMcp
                    statusSummary={emptyStatusSummary}
                    mcpStatus={{
                        totalServers: 0,
                        enabledServers: 0,
                        loading: false,
                        error: 'Unable to read MCP configuration',
                        servers: [],
                    }}
                    defaultOpenTab="mcp"
                />
            </I18nextProvider>,
        );

        expect(configuredHtml).toContain('Configured servers');
        expect(configuredHtml).toContain('+1 more MCP server');
        expect(configuredHtml).toMatch(
            /<button[^>]*chat-input-status-tab-mcp[^>]*aria-label="MCP: 1 \/ 9 available"[^>]*title="MCP: 1 \/ 9 available"/,
        );
        expect(configuredHtml).not.toContain('chat.layout.mcpConfiguredServers');
        expect(configuredHtml).not.toContain('chat.layout.inputStatusMoreMcpServers');
        expect(loadingHtml).toContain('Loading MCP configuration...');
        expect(loadingHtml).toMatch(
            /<button[^>]*chat-input-status-tab-mcp[^>]*aria-label="MCP: Loading MCP configuration\.\.\."[^>]*title="MCP: Loading MCP configuration\.\.\."/,
        );
        expect(loadingHtml).toContain('title="MCP: Loading MCP configuration..."');
        expect(loadingHtml).toContain('aria-label="MCP: Loading MCP configuration..."');
        expect(loadingHtml).not.toContain('chat.layout.mcpLoading');
        expect(emptyHtml).toContain('No MCP servers configured');
        expect(emptyHtml).toMatch(
            /<button[^>]*chat-input-status-tab-mcp[^>]*aria-label="MCP: Configuration error · Unable to read MCP configuration"[^>]*title="MCP: Configuration error · Unable to read MCP configuration"/,
        );
        expect(emptyHtml).toContain('title="MCP: Configuration error · Unable to read MCP configuration"');
        expect(emptyHtml).toContain('aria-label="MCP: Configuration error · Unable to read MCP configuration"');
        expect(emptyHtml).not.toContain('chat.layout.mcpNoServers');
        expect(emptyHtml).not.toContain('chat.layout.mcpConfigurationError');
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
        expect(html).toContain('aria-label="Tasks 2/2"');
        expect(html).toContain('title="Tasks 2/2"');
        expect(html).toContain('aria-label="Subagents 0/1"');
        expect(html).toContain('aria-label="Edits +5 / -2"');
        expect(html).not.toContain('aria-label="chat.layout.inputStatusTasks chat.layout.inputStatusProgress"');
        expect(html).toContain('npm test');
        expect(html).toContain('aria-label="Jump to tool task: npm test"');
        expect(html).toMatch(/title="npm: npm test · (?:Success|成功)"/i);
        expect(html).toMatch(/aria-label="npm: npm test · (?:Success|成功)"/i);
        expect(html).toContain('src/pages/ChatPage.tsx');
        expect(html).not.toContain('Review composer status strip');
        expect(html).not.toContain('frontend-reviewer');
        expect(html).not.toContain('claude-sonnet-provider-20260601');
    });

    it('labels edit row stats with the target file context', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={statusSummary}
                defaultOpenTab="edits"
            />,
        );

        expect(html).toContain('src/pages/ChatPage.tsx');
        expect(html).toContain('title="Edit stats: src/pages/ChatPage.tsx · +5 / -2"');
        expect(html).toContain('aria-label="Edit stats: src/pages/ChatPage.tsx · +5 / -2"');
        const describedByMatch = html.match(
            /aria-label="Inspect full diff: src\/pages\/ChatPage\.tsx"[^>]*aria-describedby="([^"]+)"/,
        );
        expect(describedByMatch).not.toBeNull();
        const statsDescriptionId = describedByMatch?.[1] ?? '';
        expect(statsDescriptionId).toMatch(/^chat-input-status-edit-stats-/);
        expect(html).toContain(`id="${statsDescriptionId}"`);
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
        expect(html).toContain('title="Jump to tool task: npm test"');
        expect(html).toContain('aria-label="Jump to tool task: npm test"');
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
        expect(html).toContain('title="Jump to subagent activity: Review composer status strip"');
        expect(html).toContain('aria-label="Jump to subagent activity: Review composer status strip"');
        expect(html).toMatch(/title="Agent: Review composer status strip · (?:Pending|等待中)"/i);
        expect(html).toMatch(/aria-label="Agent: Review composer status strip · (?:Pending|等待中)"/i);
        expect(html).not.toContain('aria-label="Jump to tool task: Review composer status strip"');
    });

    it('falls back to readable state labels for status rows when i18n keys are unavailable', () => {
        const html = renderToStaticMarkup(
            <ChatInputStatusTabs
                statusSummary={{
                    ...emptyStatusSummary,
                    toolTimeline: [
                        {
                            toolId: 'tool-pending',
                            type: 'bash',
                            label: 'npm',
                            accentClass: 'tool-command-bash',
                            summary: 'npm test --watch',
                            status: 'pending',
                        },
                        {
                            toolId: 'tool-error',
                            type: 'bash',
                            label: 'build',
                            accentClass: 'tool-command-bash',
                            summary: 'npm run build',
                            status: 'error',
                        },
                        {
                            toolId: 'tool-completed',
                            type: 'bash',
                            label: 'test',
                            accentClass: 'tool-command-bash',
                            summary: 'npm test',
                            status: 'completed',
                        },
                    ],
                    pendingToolCount: 1,
                    completedToolCount: 1,
                    errorToolCount: 1,
                }}
                defaultOpenTab="tasks"
            />,
        );

        expect(html).toMatch(/tool-state-pill pending"[^>]*>Pending<\/span>/);
        expect(html).toMatch(/tool-state-pill error"[^>]*>Failed<\/span>/);
        expect(html).toMatch(/tool-state-pill completed"[^>]*>Success<\/span>/);
        expect(html).toContain('aria-label="npm: npm test --watch · Pending"');
        expect(html).toContain('title="npm: npm test --watch · Pending"');
        expect(html).not.toContain('tools.pending');
        expect(html).not.toContain('tools.failed');
        expect(html).not.toContain('common.success');
    });

    it('falls back to readable overflow labels for status panels when i18n keys are unavailable', () => {
        const manyTasks = Array.from({length: 9}, (_, index) => ({
            toolId: `tool-${index + 1}`,
            type: 'bash' as const,
            label: 'npm',
            accentClass: 'tool-command-bash',
            summary: `npm test ${index + 1}`,
            status: 'completed' as const,
        }));
        const manyAgents = Array.from({length: 9}, (_, index) => ({
            toolId: `agent-${index + 1}`,
            type: 'agent' as const,
            label: 'Agent',
            accentClass: 'tool-command-plan',
            summary: `Review task ${index + 1}`,
            status: 'completed' as const,
        }));
        const manyEdits = Array.from({length: 9}, (_, index) => ({
            toolId: `edit-${index + 1}`,
            displayPath: `src/file-${index + 1}.tsx`,
            openPath: `src/file-${index + 1}.tsx`,
            additions: 1,
            deletions: 0,
            status: 'completed' as const,
            diffPreviewLines: [],
        }));
        const tasksHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatInputStatusTabs
                    statusSummary={{
                        ...emptyStatusSummary,
                        toolTimeline: manyTasks,
                        completedToolCount: manyTasks.length,
                    }}
                    defaultOpenTab="tasks"
                />
            </I18nextProvider>,
        );
        const subagentsHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatInputStatusTabs
                    statusSummary={{
                        ...emptyStatusSummary,
                        agentTools: manyAgents,
                    }}
                    defaultOpenTab="subagents"
                />
            </I18nextProvider>,
        );
        const editsHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatInputStatusTabs
                    statusSummary={{
                        ...emptyStatusSummary,
                        allEdits: manyEdits,
                        recentEdits: manyEdits,
                        touchedFileCount: manyEdits.length,
                        totalAdditions: manyEdits.length,
                    }}
                    defaultOpenTab="edits"
                />
            </I18nextProvider>,
        );

        expect(tasksHtml).toContain('+1 more tool task');
        expect(tasksHtml).not.toContain('chat.layout.inputStatusMoreTools');
        expect(subagentsHtml).toContain('+1 more subagent');
        expect(subagentsHtml).not.toContain('chat.layout.inputStatusMoreSubagents');
        expect(editsHtml).toContain('title="Edit stats: src/file-1.tsx · +1 / -0"');
        expect(editsHtml).toContain('aria-label="Edit stats: src/file-1.tsx · +1 / -0"');
        const editStatsReferenceMatch = editsHtml.match(
            /aria-label="Inspect full diff: src\/file-1\.tsx"[^>]*aria-describedby="([^"]+)"/,
        );
        expect(editStatsReferenceMatch).not.toBeNull();
        const editStatsDescriptionId = editStatsReferenceMatch?.[1] ?? '';
        expect(editStatsDescriptionId).toMatch(/^chat-input-status-edit-stats-/);
        expect(editsHtml).toContain(`id="${editStatsDescriptionId}"`);
        expect(editsHtml).toContain('+1 more edit');
        expect(editsHtml).not.toContain('chat.layout.inputStatusMoreEdits');
        expect(editsHtml).not.toContain('chat.layout.inputStatusEditFileStats');
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
        expect(html).toContain('aria-label="Status details"');
        expect(html).not.toContain('aria-label="chat.layout.inputStatusDetailsRegion"');
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
        expect(html).toMatch(/aria-label="(?:Current full diff: |当前完整差异：)src\/pages\/ChatPage\.tsx"/i);
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
