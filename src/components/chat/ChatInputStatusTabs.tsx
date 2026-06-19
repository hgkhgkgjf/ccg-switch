import {type ReactNode, useEffect, useRef, useState} from 'react';
import {AlertTriangle, Bot, CheckCircle2, FilePenLine, GitBranch, ListChecks, Loader2, Server} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {
    type ChatStatusEditSummary,
    type ChatStatusSummary,
    type ChatStatusToolSummary,
    getChatStatusEditKey,
} from '../../utils/chatStatusSummary';
import type {ChatMcpAvailabilityServerSummary, ChatMcpAvailabilitySummary} from '../../utils/chatMcpStatus';
import type {ChatWorkspaceStatus} from '../../utils/chatWorkspaceStatus';
import {cn} from '../../utils/cn';

type ChatInputStatusTab = 'tasks' | 'subagents' | 'edits' | 'mcp';

interface ChatInputStatusTabsProps {
    statusSummary: ChatStatusSummary;
    isStreaming?: boolean;
    selectedEditKey?: string | null;
    onSelectedEditChange?: (edit: ChatStatusEditSummary) => void;
    onSelectTool?: (tool: ChatStatusToolSummary) => void;
    defaultOpenTab?: ChatInputStatusTab | null;
    workspaceStatus?: ChatWorkspaceStatus;
    mcpStatus?: ChatMcpAvailabilitySummary;
    collapseStatusTabsOnDesktop?: boolean;
}

const MAX_PANEL_ITEMS = 8;

function latestFirst<T>(items: T[]): T[] {
    return [...items].reverse();
}

export function shouldDismissInputStatusPopoverForPointer(
    root: Pick<Node, 'contains'> | null,
    target: Node | null,
): boolean {
    return Boolean(root && target && !root.contains(target));
}

export function shouldDismissInputStatusPopoverForKey(key: string): boolean {
    return key === 'Escape';
}

export function getInputStatusTabAfterToolSelection(
    currentTab: ChatInputStatusTab | null,
    canSelectTool: boolean,
): ChatInputStatusTab | null {
    return canSelectTool ? null : currentTab;
}

export function getInputStatusTabAfterEditSelection(
    currentTab: ChatInputStatusTab | null,
    canSelectEdit: boolean,
): ChatInputStatusTab | null {
    return canSelectEdit ? null : currentTab;
}

function getStatusIcon(status: ChatStatusToolSummary['status']) {
    if (status === 'pending') return <Loader2 size={13} className="mt-0.5 flex-shrink-0 animate-spin text-warning" />;
    if (status === 'error') return <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-error" />;
    return <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-success" />;
}

function getToolJumpLabelKey(tool: ChatStatusToolSummary) {
    return tool.type === 'agent'
        ? 'chat.layout.scrollToSubagentActivity'
        : 'chat.layout.scrollToToolTask';
}

export default function ChatInputStatusTabs({
    statusSummary,
    isStreaming = false,
    selectedEditKey,
    onSelectedEditChange,
    onSelectTool,
    defaultOpenTab = null,
    workspaceStatus,
    mcpStatus,
    collapseStatusTabsOnDesktop = false,
}: ChatInputStatusTabsProps) {
    const {t} = useTranslation();
    const [openTab, setOpenTab] = useState<ChatInputStatusTab | null>(defaultOpenTab);
    const popoverRootRef = useRef<HTMLDivElement>(null);
    const toolTimeline = statusSummary.toolTimeline ?? (statusSummary.activeTool ? [statusSummary.activeTool] : []);
    const taskTools = toolTimeline.filter((tool) => tool.type !== 'agent');
    const agentTools = statusSummary.agentTools ?? toolTimeline.filter((tool) => tool.type === 'agent');
    const edits = statusSummary.allEdits.length > 0 ? statusSummary.allEdits : statusSummary.recentEdits;
    const gitBranch = workspaceStatus?.isGitRepository ? workspaceStatus.gitBranch : null;
    const hasGitBranch = Boolean(gitBranch);
    const hasTasks = taskTools.length > 0;
    const hasSubagents = agentTools.length > 0;
    const hasEdits = edits.length > 0;
    const hasMcpStatus = Boolean(mcpStatus && (mcpStatus.totalServers > 0 || mcpStatus.loading || mcpStatus.error));
    const hasExpandableStatusTabs = hasTasks || hasSubagents || hasEdits || hasMcpStatus;
    const visibleTabs = new Set<ChatInputStatusTab>([
        ...(hasTasks ? ['tasks' as const] : []),
        ...(hasSubagents ? ['subagents' as const] : []),
        ...(hasEdits ? ['edits' as const] : []),
        ...(hasMcpStatus ? ['mcp' as const] : []),
    ]);
    const activeOpenTab = openTab && visibleTabs.has(openTab) ? openTab : null;
    const recentTools = latestFirst(taskTools).slice(0, MAX_PANEL_ITEMS);
    const recentAgents = latestFirst(agentTools).slice(0, MAX_PANEL_ITEMS);
    const visibleEdits = edits.slice(0, MAX_PANEL_ITEMS);
    const completedTools = taskTools.filter((tool) => tool.status === 'completed').length;
    const pendingTasks = taskTools.some((tool) => tool.status === 'pending');
    const completedAgents = agentTools.filter((tool) => tool.status === 'completed').length;
    const pendingAgents = agentTools.some((tool) => tool.status === 'pending');
    const activeTabClass = 'border-primary/40 bg-primary/10 text-primary shadow-sm';
    const inactiveTabClass = 'border-transparent bg-base-100/55 text-base-content/60 hover:bg-base-100 hover:text-base-content/80';
    const translatedMcpLabel = t('chat.layout.mcpStatus');
    const mcpTabLabel = translatedMcpLabel === 'chat.layout.mcpStatus' ? 'MCP' : translatedMcpLabel;
    const gitBranchTitle = hasGitBranch
        ? [
            `${t('chat.layout.inputStatusGitBranch')}: ${gitBranch}`,
            workspaceStatus?.gitRoot,
        ].filter(Boolean).join(' · ')
        : undefined;

    const toggleTab = (tab: ChatInputStatusTab) => {
        setOpenTab((current) => (current === tab ? null : tab));
    };

    useEffect(() => {
        if (!activeOpenTab) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target instanceof Node ? event.target : null;
            if (shouldDismissInputStatusPopoverForPointer(popoverRootRef.current, target)) {
                setOpenTab(null);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (shouldDismissInputStatusPopoverForKey(event.key)) {
                setOpenTab(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeOpenTab]);

    if (!hasGitBranch && !hasTasks && !hasSubagents && !hasEdits && !hasMcpStatus) {
        return null;
    }

    const statusLabel = (status: ChatStatusToolSummary['status']) => (
        status === 'pending' ? t('tools.pending') : status === 'error' ? t('tools.failed') : t('common.success')
    );

    const handleSelectToolRow = (tool: ChatStatusToolSummary) => {
        setOpenTab(getInputStatusTabAfterToolSelection(activeOpenTab, Boolean(onSelectTool)));
        onSelectTool?.(tool);
    };

    const handleSelectEditRow = (edit: ChatStatusEditSummary) => {
        setOpenTab(getInputStatusTabAfterEditSelection(activeOpenTab, Boolean(onSelectedEditChange)));
        onSelectedEditChange?.(edit);
    };

    const renderToolRow = (tool: ChatStatusToolSummary) => (
        <button
            key={tool.toolId}
            type="button"
            className={cn(
                'flex w-full min-w-0 items-start gap-2 rounded-md bg-base-200/45 px-2 py-1.5 text-left transition-colors',
                'hover:bg-base-200/80 focus:outline-none focus:ring-2 focus:ring-primary/30',
                'disabled:cursor-default disabled:opacity-100 disabled:hover:bg-base-200/45',
            )}
            title={[tool.summary, tool.detail].filter(Boolean).join('\n')}
            aria-label={t(getToolJumpLabelKey(tool), {tool: tool.summary || tool.label})}
            data-target-tool-id={tool.toolId}
            disabled={!onSelectTool}
            onClick={() => handleSelectToolRow(tool)}
        >
            {getStatusIcon(tool.status)}
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`tool-command-chip ${tool.accentClass}`}>{tool.label}</span>
                    <span className={`tool-state-pill ${tool.status}`}>{statusLabel(tool.status)}</span>
                </div>
                <div className="mt-1 truncate text-[11px] font-medium text-base-content/75">
                    {tool.summary}
                </div>
                {tool.detail && (
                    <div className="mt-0.5 truncate text-[10px] text-base-content/45">
                        {tool.detail}
                    </div>
                )}
            </div>
        </button>
    );

    const renderTasksPanel = () => (
        <div className="space-y-1.5">
            {recentTools.length > 0 ? (
                <>
                    {recentTools.map(renderToolRow)}
                    {taskTools.length > MAX_PANEL_ITEMS && (
                        <div className="px-1 text-[10px] text-base-content/40">
                            {t('chat.layout.inputStatusMoreTools', {count: taskTools.length - MAX_PANEL_ITEMS})}
                        </div>
                    )}
                </>
            ) : (
                <div className="rounded-md bg-base-200/35 px-2 py-2 text-[11px] text-base-content/45">
                    {t('chat.layout.inputStatusNoTasks')}
                </div>
            )}
        </div>
    );

    const renderSubagentsPanel = () => (
        <div className="space-y-1.5">
            {recentAgents.length > 0 ? (
                <>
                    {recentAgents.map(renderToolRow)}
                    {agentTools.length > MAX_PANEL_ITEMS && (
                        <div className="px-1 text-[10px] text-base-content/40">
                            {t('chat.layout.inputStatusMoreSubagents', {count: agentTools.length - MAX_PANEL_ITEMS})}
                        </div>
                    )}
                </>
            ) : (
                <div className="rounded-md bg-base-200/35 px-2 py-2 text-[11px] text-base-content/45">
                    {t('chat.layout.inputStatusNoSubagents')}
                </div>
            )}
        </div>
    );

    const renderEditsPanel = () => (
        <div className="space-y-1.5">
            {visibleEdits.length > 0 ? (
                <>
                    {visibleEdits.map((edit) => {
                        const editKey = getChatStatusEditKey(edit);
                        const selected = selectedEditKey === editKey;
                        return (
                            <button
                                key={editKey}
                                type="button"
                                className={cn(
                                    'flex w-full min-w-0 items-center gap-2 rounded-md bg-base-200/45 px-2 py-1.5 text-left transition-colors',
                                    'hover:bg-base-200/80 focus:outline-none focus:ring-2 focus:ring-primary/30',
                                    'disabled:cursor-default disabled:opacity-100 disabled:hover:bg-base-200/45',
                                    selected && 'chat-input-status-edit-selected ring-1 ring-primary/30 bg-primary/10',
                                )}
                                title={edit.displayPath}
                                aria-current={selected ? 'true' : undefined}
                                disabled={!onSelectedEditChange}
                                onClick={() => handleSelectEditRow(edit)}
                            >
                                <FilePenLine size={13} className="flex-shrink-0 text-base-content/45" />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[11px] font-medium text-base-content/75">
                                        {edit.displayPath}
                                    </div>
                                    {(edit.lineStart || edit.lineEnd) && (
                                        <div className="truncate text-[10px] text-base-content/40">
                                            {edit.lineStart ? `L${edit.lineStart}${edit.lineEnd && edit.lineEnd !== edit.lineStart ? `-L${edit.lineEnd}` : ''}` : ''}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-1 text-[11px] font-medium">
                                    <span className="text-success">+{edit.additions}</span>
                                    <span className="text-error">-{edit.deletions}</span>
                                </div>
                            </button>
                        );
                    })}
                    {edits.length > MAX_PANEL_ITEMS && (
                        <div className="px-1 text-[10px] text-base-content/40">
                            {t('chat.layout.inputStatusMoreEdits', {count: edits.length - MAX_PANEL_ITEMS})}
                        </div>
                    )}
                </>
            ) : (
                <div className="rounded-md bg-base-200/35 px-2 py-2 text-[11px] text-base-content/45">
                    {t('chat.layout.inputStatusNoEdits')}
                </div>
            )}
        </div>
    );

    const renderMcpServerRow = (server: ChatMcpAvailabilityServerSummary) => (
        <div
            key={server.id}
            className="chat-input-status-mcp-server flex min-w-0 items-center gap-2 rounded-md bg-base-200/45 px-2 py-1.5"
            title={server.id}
        >
            <Server size={13} className="flex-shrink-0 text-base-content/45" />
            <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-base-content/75">
                    {server.name}
                </div>
                <div className="truncate text-[10px] text-base-content/40">
                    {server.transport ?? t('chat.layout.mcpLiveUnknown')}
                </div>
            </div>
            <span className={`tool-state-pill ${server.enabled ? 'completed' : 'pending'}`}>
                {server.enabled ? t('chat.layout.mcpEnabled') : t('chat.layout.mcpDisabled')}
            </span>
        </div>
    );

    const renderMcpPanel = () => {
        if (!mcpStatus) return null;

        return (
            <div className="space-y-1.5">
                {mcpStatus.error && (
                    <div className="rounded-md bg-error/10 px-2 py-1.5 text-[11px] text-error/85" title={mcpStatus.error}>
                        {mcpStatus.error}
                    </div>
                )}
                {mcpStatus.loading && (
                    <div className="flex items-center gap-1.5 rounded-md bg-base-200/35 px-2 py-2 text-[11px] text-base-content/45">
                        <Loader2 size={12} className="animate-spin text-warning" />
                        {t('chat.layout.mcpLoading')}
                    </div>
                )}
                {mcpStatus.servers.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between px-1 text-[10px] text-base-content/40">
                            <span>{t('chat.layout.mcpConfiguredServers')}</span>
                            <span>{mcpStatus.enabledServers} / {mcpStatus.totalServers}</span>
                        </div>
                        {mcpStatus.servers.slice(0, MAX_PANEL_ITEMS).map(renderMcpServerRow)}
                        {mcpStatus.servers.length > MAX_PANEL_ITEMS && (
                            <div className="px-1 text-[10px] text-base-content/40">
                                {t('chat.layout.inputStatusMoreMcpServers', {count: mcpStatus.servers.length - MAX_PANEL_ITEMS})}
                            </div>
                        )}
                    </>
                ) : (
                    !mcpStatus.loading && (
                        <div className="rounded-md bg-base-200/35 px-2 py-2 text-[11px] text-base-content/45">
                            {t('chat.layout.mcpNoServers')}
                        </div>
                    )
                )}
            </div>
        );
    };

    const renderPanel = () => {
        if (activeOpenTab === 'tasks') return renderTasksPanel();
        if (activeOpenTab === 'subagents') return renderSubagentsPanel();
        if (activeOpenTab === 'edits') return renderEditsPanel();
        if (activeOpenTab === 'mcp') return renderMcpPanel();
        return null;
    };

    const renderTabButton = (
        tab: ChatInputStatusTab,
        className: string,
        icon: ReactNode,
        label: string,
        stat: string,
        showSpinner = false,
    ) => {
        const accessibleLabel = `${label} ${stat}`;

        return (
            <button
                type="button"
                className={cn(
                    'chat-input-status-tab flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-1.5 py-1.5 text-[11px] font-medium transition-colors sm:px-2',
                    activeOpenTab === tab ? activeTabClass : inactiveTabClass,
                    className,
                    collapseStatusTabsOnDesktop && 'xl:hidden',
                )}
                aria-expanded={activeOpenTab === tab}
                aria-label={accessibleLabel}
                title={accessibleLabel}
                onClick={() => toggleTab(tab)}
            >
                {icon}
                <span className="chat-input-status-tab-label hidden sm:inline max-w-[5rem] truncate">{label}</span>
                <span className="chat-input-status-count-pill flex-shrink-0 rounded-full bg-base-200/80 px-1.5 py-0.5 text-[10px] leading-none text-base-content/55">
                    {stat}
                </span>
                {showSpinner && <Loader2 size={11} className="flex-shrink-0 animate-spin text-warning" />}
            </button>
        );
    };

    return (
        <div
            className={cn(
                'chat-input-status-tabs bg-base-200/20 px-3 pt-2 sm:px-5',
                collapseStatusTabsOnDesktop && !hasGitBranch && hasExpandableStatusTabs && 'xl:hidden',
            )}
        >
            <div className="mx-auto relative w-full max-w-2xl" ref={popoverRootRef}>
                <div className="flex flex-wrap items-stretch gap-1 rounded-md border border-base-300 bg-base-100/70 p-1 shadow-sm shadow-base-300/20">
                    {hasGitBranch && (
                        <div
                            className="chat-input-status-git-branch flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-transparent bg-base-200/65 px-1.5 py-1.5 text-[11px] font-medium text-base-content/70 sm:px-2"
                            title={gitBranchTitle}
                            aria-label={`${t('chat.layout.inputStatusGitBranch')} ${gitBranch}`}
                        >
                            <GitBranch size={13} className="flex-shrink-0 text-base-content/50" />
                            <span className="chat-input-status-git-label hidden sm:inline flex-shrink-0 text-base-content/45">
                                {t('chat.layout.inputStatusGitBranch')}
                            </span>
                            <span className="chat-input-status-git-value min-w-0 max-w-[8rem] truncate text-base-content/80 sm:max-w-[10rem]">
                                {gitBranch}
                            </span>
                        </div>
                    )}
                    {hasTasks && renderTabButton(
                        'tasks',
                        'chat-input-status-tab-tasks',
                        <ListChecks size={13} className="flex-shrink-0" />,
                        t('chat.layout.inputStatusTasks'),
                        t('chat.layout.inputStatusProgress', {completed: completedTools, total: taskTools.length}),
                        isStreaming && pendingTasks,
                    )}
                    {hasSubagents && renderTabButton(
                        'subagents',
                        'chat-input-status-tab-subagents',
                        <Bot size={13} className="flex-shrink-0" />,
                        t('chat.layout.inputStatusSubagents'),
                        t('chat.layout.inputStatusProgress', {completed: completedAgents, total: agentTools.length}),
                        isStreaming && pendingAgents,
                    )}
                    {hasEdits && renderTabButton(
                        'edits',
                        'chat-input-status-tab-edits',
                        <FilePenLine size={13} className="flex-shrink-0" />,
                        t('chat.layout.inputStatusEdits'),
                        t('chat.layout.inputStatusEditStats', {
                            additions: statusSummary.totalAdditions,
                            deletions: statusSummary.totalDeletions,
                        }),
                    )}
                    {hasMcpStatus && mcpStatus && renderTabButton(
                        'mcp',
                        'chat-input-status-tab-mcp',
                        <Server size={13} className="flex-shrink-0" />,
                        mcpTabLabel,
                        `${mcpStatus.enabledServers} / ${mcpStatus.totalServers}`,
                        mcpStatus.loading,
                    )}
                </div>
                {activeOpenTab && (
                    <div
                        className={cn(
                            'chat-input-status-panel chat-input-status-popover-panel absolute bottom-full left-0 right-0 z-[30] mb-1 max-h-[min(20rem,45vh)] overflow-y-auto rounded-md border border-base-300 bg-base-100/95 p-2 text-xs shadow-lg shadow-base-300/20 focus:outline-none focus:ring-2 focus:ring-primary/25',
                            collapseStatusTabsOnDesktop && 'xl:hidden',
                        )}
                        role="region"
                        tabIndex={0}
                        aria-label={t('chat.layout.inputStatusDetailsRegion')}
                    >
                        {renderPanel()}
                    </div>
                )}
            </div>
        </div>
    );
}
