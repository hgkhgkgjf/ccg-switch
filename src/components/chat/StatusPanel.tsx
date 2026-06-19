import {type KeyboardEvent, type ReactNode, useEffect, useMemo, useState} from 'react';
import {
    Activity,
    AlertTriangle,
    Bot,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Columns2,
    ExternalLink,
    FileDiff,
    FilePenLine,
    Folder,
    FolderOpen,
    FolderTree,
    Loader2,
    PanelRightOpen,
    RefreshCw,
    Rows3,
    Server,
    SlidersHorizontal,
    Sparkles,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {SdkStatus} from '../../types/chat';
import type {ChatSessionLoadMetrics} from '../../types/session';
import {openFile} from '../../utils/bridge';
import {
    type ChatStatusEditSummary,
    type ChatStatusSummary,
    type ChatStatusToolSummary,
    getChatStatusEditKey,
} from '../../utils/chatStatusSummary';
import {
    canReconnectChatDaemon,
    CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY,
    getChatDaemonDiagnosticText,
    getChatDaemonStatusKind,
} from '../../utils/chatDaemonStatus';
import type {ChatMcpConnectivityState, ChatMcpLiveStatus} from '../../utils/chatMcpConnectivity';
import type {ChatMcpAvailabilitySummary} from '../../utils/chatMcpStatus';
import {cn} from '../../utils/cn';
import {AVAILABLE_MODES, type PermissionMode, REASONING_LEVELS, type ReasoningEffort} from './composer/constants';
import type {EditDiffPreviewMode} from '../toolBlocks/EditDiffPreview';
import EditDiffPreview from '../toolBlocks/EditDiffPreview';

const EMPTY_EDIT_SUMMARIES: ChatStatusEditSummary[] = [];
const AUTO_COLLAPSE_EDIT_TREE_FILE_THRESHOLD = 24;
const MAX_ACTIVITY_TASKS = 5;
const MAX_ACTIVITY_SUBAGENTS = 2;

interface CollapsedFolderState {
    editSetKey: string;
    folders: Set<string>;
    userModified: boolean;
}

interface SessionLoadDisclosureState {
    metricsKey: string | null;
    expanded: boolean;
    userModified: boolean;
}

interface EditTreeNode {
    type: 'folder' | 'file';
    key: string;
    name: string;
    path: string;
    additions: number;
    deletions: number;
    status: ChatStatusEditSummary['status'];
    children: EditTreeNode[];
    edit?: ChatStatusEditSummary;
}

interface StatusPanelProps {
    provider: string;
    messageCount: number;
    daemonReady: boolean;
    model?: string | null;
    permissionMode?: PermissionMode;
    reasoningEffort?: ReasoningEffort;
    sdkStatus?: SdkStatus | null;
    daemonStatus?: string | null;
    daemonReconnecting?: boolean;
    daemonError?: string | null;
    mcpStatus?: ChatMcpAvailabilitySummary;
    mcpConnectivity?: ChatMcpConnectivityState;
    sessionLoadMetrics?: ChatSessionLoadMetrics | null;
    anchorCount?: number;
    activeAnchorLabel?: string;
    currentCwd?: string | null;
    isStreaming?: boolean;
    statusSummary?: ChatStatusSummary;
    selectedEditKey?: string | null;
    isDiffPaneCollapsed?: boolean;
    diffViewMode?: EditDiffPreviewMode;
    onSelectedEditChange?: (edit: ChatStatusEditSummary) => void;
    onOpenDiffPanel?: () => void;
    onDiffViewModeChange?: (mode: EditDiffPreviewMode) => void;
    onSelectTool?: (tool: ChatStatusToolSummary) => void;
    onReconnectDaemon?: () => void;
    onCheckMcpConnectivity?: () => void;
}

function normalizeEditPathParts(edit: ChatStatusEditSummary): string[] {
    const rawPath = (edit.displayPath || edit.openPath || 'unknown').replace(/\\/g, '/');
    const parts = rawPath.split('/').map((part) => part.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [rawPath || 'unknown'];
}

function mergeEditStatus(
    current: ChatStatusEditSummary['status'],
    next: ChatStatusEditSummary['status'],
): ChatStatusEditSummary['status'] {
    if (current === 'error' || next === 'error') return 'error';
    if (current === 'pending' || next === 'pending') return 'pending';
    return 'completed';
}

function sortEditTreeNodes(nodes: EditTreeNode[]): EditTreeNode[] {
    return [...nodes]
        .sort((left, right) => {
            if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
            return left.name.localeCompare(right.name);
        })
        .map((node) => ({
            ...node,
            children: node.children.length > 0 ? sortEditTreeNodes(node.children) : node.children,
        }));
}

function buildEditTree(edits: ChatStatusEditSummary[]): EditTreeNode[] {
    const root: EditTreeNode = {
        type: 'folder',
        key: 'folder:',
        name: '',
        path: '',
        additions: 0,
        deletions: 0,
        status: 'completed',
        children: [],
    };
    const childFolderMaps = new Map<string, Map<string, EditTreeNode>>();
    childFolderMaps.set(root.key, new Map());

    edits.forEach((edit, index) => {
        const parts = normalizeEditPathParts(edit);
        const fileName = parts[parts.length - 1] ?? edit.displayPath;
        const folderParts = parts.slice(0, -1);
        let parent = root;
        const currentPathParts: string[] = [];

        folderParts.forEach((part) => {
            currentPathParts.push(part);
            const folderPath = currentPathParts.join('/');
            const folderKey = `folder:${folderPath}`;
            let siblings = childFolderMaps.get(parent.key);

            if (!siblings) {
                siblings = new Map();
                childFolderMaps.set(parent.key, siblings);
            }

            let folder = siblings.get(part);
            if (!folder) {
                folder = {
                    type: 'folder',
                    key: folderKey,
                    name: part,
                    path: folderPath,
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    children: [],
                };
                siblings.set(part, folder);
                parent.children.push(folder);
                childFolderMaps.set(folder.key, new Map());
            }

            folder.additions += edit.additions;
            folder.deletions += edit.deletions;
            folder.status = mergeEditStatus(folder.status, edit.status);
            parent = folder;
        });

        const filePath = [...folderParts, fileName].join('/');
        parent.children.push({
            type: 'file',
            key: `file:${edit.openPath || filePath}:${index}`,
            name: fileName,
            path: filePath,
            additions: edit.additions,
            deletions: edit.deletions,
            status: edit.status,
            children: [],
            edit,
        });
    });

    return sortEditTreeNodes(root.children);
}

function collectEditFolderKeys(nodes: EditTreeNode[]): string[] {
    return nodes.flatMap((node) => (
        node.type === 'folder'
            ? [node.key, ...collectEditFolderKeys(node.children)]
            : []
    ));
}

function createEditSetKey(edits: ChatStatusEditSummary[], touchedFileCount: number): string {
    return `${touchedFileCount}:${edits
        .map((edit) => `${edit.openPath || edit.displayPath}:${edit.additions}:${edit.deletions}:${edit.status}`)
        .join('|')}`;
}

function createDefaultCollapsedFolders(edits: ChatStatusEditSummary[], touchedFileCount: number): Set<string> {
    if (touchedFileCount <= AUTO_COLLAPSE_EDIT_TREE_FILE_THRESHOLD) return new Set();
    return new Set(collectEditFolderKeys(buildEditTree(edits)));
}

function normalizeRuntimeValue(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\\/g, '/');
}

function formatMetricMs(value: number | null): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
    return `${Math.max(0, Math.round(value))}ms`;
}

function formatMetricCount(value: number | null): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
    return String(value);
}

function getMcpLiveStatusClass(status: ChatMcpLiveStatus): string {
    if (status === 'online') return 'completed';
    if (status === 'unknown') return 'pending';
    return 'error';
}

export default function StatusPanel({
    provider,
    messageCount,
    daemonReady,
    model,
    permissionMode,
    reasoningEffort,
    sdkStatus,
    daemonStatus,
    daemonReconnecting = false,
    daemonError,
    mcpStatus,
    mcpConnectivity,
    sessionLoadMetrics,
    anchorCount = 0,
    activeAnchorLabel,
    currentCwd,
    isStreaming = false,
    statusSummary,
    selectedEditKey,
    isDiffPaneCollapsed = false,
    diffViewMode,
    onSelectedEditChange,
    onOpenDiffPanel,
    onDiffViewModeChange,
    onSelectTool,
    onReconnectDaemon,
    onCheckMcpConnectivity,
}: StatusPanelProps) {
    const { t } = useTranslation();
    const activeTool = statusSummary?.activeTool;
    const recentEdits = statusSummary?.recentEdits ?? EMPTY_EDIT_SUMMARIES;
    const allEdits = statusSummary?.allEdits ?? recentEdits;
    const touchedFileCount = statusSummary?.touchedFileCount ?? 0;
    const editSetKey = useMemo(() => createEditSetKey(allEdits, touchedFileCount), [allEdits, touchedFileCount]);
    const [showAllEdits, setShowAllEdits] = useState(false);
    const [collapsedFolderState, setCollapsedFolderState] = useState<CollapsedFolderState>(() => ({
        editSetKey,
        folders: createDefaultCollapsedFolders(allEdits, touchedFileCount),
        userModified: false,
    }));
    const [localDiffViewMode, setLocalDiffViewMode] = useState<EditDiffPreviewMode>('unified');
    const [floatingPreview, setFloatingPreview] = useState<{ key: string; top: number } | null>(null);
    const activeDiffViewMode = diffViewMode ?? localDiffViewMode;
    const visibleEdits = showAllEdits ? allEdits : recentEdits;
    const editTree = useMemo(() => buildEditTree(visibleEdits), [visibleEdits]);
    const editFolderKeys = useMemo(() => collectEditFolderKeys(editTree), [editTree]);
    const sessionLoadMetricsKey = sessionLoadMetrics
        ? `${sessionLoadMetrics.providerId}:${sessionLoadMetrics.sessionKey}:${sessionLoadMetrics.startedAt}`
        : null;
    const shouldAutoExpandSessionLoadMetrics = Boolean(
        sessionLoadMetrics && (
            sessionLoadMetrics.status === 'loading'
            || sessionLoadMetrics.status === 'error'
            || sessionLoadMetrics.error
        ),
    );
    const [sessionLoadDisclosureState, setSessionLoadDisclosureState] = useState<SessionLoadDisclosureState>(() => ({
        metricsKey: sessionLoadMetricsKey,
        expanded: shouldAutoExpandSessionLoadMetrics,
        userModified: false,
    }));
    const sessionLoadMetricsExpanded = Boolean(
        sessionLoadMetrics && (
            shouldAutoExpandSessionLoadMetrics || sessionLoadDisclosureState.expanded
        ),
    );
    const modelLabel = normalizeRuntimeValue(model);
    const workspaceLabel = normalizeRuntimeValue(currentCwd);
    const permissionModeInfo = permissionMode
        ? AVAILABLE_MODES.find((mode) => mode.id === permissionMode)
        : undefined;
    const permissionModeLabel = permissionModeInfo
        ? t(`chat.modes.${permissionModeInfo.i18nKey}.label`)
        : permissionMode;
    const reasoningInfo = reasoningEffort
        ? REASONING_LEVELS.find((level) => level.id === reasoningEffort)
        : undefined;
    const reasoningLabel = reasoningInfo
        ? t(`chat.reasoning.${reasoningInfo.i18nKey}.label`)
        : reasoningEffort;
    const hasRuntimeContext = Boolean(
        modelLabel || permissionModeLabel || reasoningLabel || workspaceLabel || sdkStatus,
    );
    const pendingToolCount = statusSummary?.pendingToolCount ?? 0;
    const errorToolCount = statusSummary?.errorToolCount ?? 0;
    const hasActivityToolCounts = pendingToolCount > 0 || errorToolCount > 0;
    const agentTools = statusSummary?.agentTools ?? (statusSummary?.toolTimeline ?? [])
        .filter((tool) => tool.type === 'agent');
    const activitySubagents = agentTools
        .filter((tool) => tool.toolId !== activeTool?.toolId);
    const recentActivitySubagents = [...activitySubagents].reverse().slice(0, MAX_ACTIVITY_SUBAGENTS);
    const hiddenActivitySubagentCount = Math.max(0, activitySubagents.length - recentActivitySubagents.length);
    const hasActivitySubagents = recentActivitySubagents.length > 0;
    const activityTasks = (statusSummary?.toolTimeline ?? [])
        .filter((tool) => tool.type !== 'agent' && tool.toolId !== activeTool?.toolId);
    const recentActivityTasks = [...activityTasks].reverse().slice(0, MAX_ACTIVITY_TASKS);
    const hiddenActivityTaskCount = Math.max(0, activityTasks.length - recentActivityTasks.length);
    const hasActivityTasks = recentActivityTasks.length > 0;
    const shouldShowCurrentActivityCard = Boolean(activeTool || isStreaming || hasActivityToolCounts || hasActivityTasks || hasActivitySubagents);
    const hiddenEditCount = Math.max(0, touchedFileCount - recentEdits.length);
    const collapsedFolders = collapsedFolderState.folders;
    const allFoldersCollapsed = editFolderKeys.length > 0 && editFolderKeys.every((key) => collapsedFolders.has(key));
    const canReopenDiffPane = Boolean(isDiffPaneCollapsed && allEdits.length > 0 && onOpenDiffPanel);
    const shouldShowRecentEditsCard = touchedFileCount > 0 || allEdits.length > 0 || canReopenDiffPane;
    const shouldAutoExpandMcpDetails = Boolean(
        mcpStatus && (
            mcpStatus.loading
            || mcpStatus.error
            || mcpConnectivity?.checking
            || mcpConnectivity?.error
            || mcpConnectivity?.hasResults
        ),
    );
    const [mcpExpanded, setMcpExpanded] = useState(shouldAutoExpandMcpDetails);
    const mcpDetailsExpanded = Boolean(mcpStatus && mcpExpanded);

    useEffect(() => {
        setCollapsedFolderState((current) => {
            if (current.editSetKey === editSetKey) return current;
            if (current.userModified) {
                return {
                    ...current,
                    editSetKey,
                };
            }
            return {
                editSetKey,
                folders: createDefaultCollapsedFolders(allEdits, touchedFileCount),
                userModified: false,
            };
        });
    }, [allEdits, editSetKey, touchedFileCount]);

    useEffect(() => {
        if (!mcpStatus) {
            setMcpExpanded(false);
            return;
        }
        if (shouldAutoExpandMcpDetails) {
            setMcpExpanded(true);
        }
    }, [Boolean(mcpStatus), shouldAutoExpandMcpDetails]);

    useEffect(() => {
        setSessionLoadDisclosureState((current) => {
            if (!sessionLoadMetrics || !sessionLoadMetricsKey) {
                if (!current.metricsKey && !current.expanded && !current.userModified) return current;
                return {
                    metricsKey: null,
                    expanded: false,
                    userModified: false,
                };
            }

            if (current.metricsKey !== sessionLoadMetricsKey) {
                return {
                    metricsKey: sessionLoadMetricsKey,
                    expanded: shouldAutoExpandSessionLoadMetrics,
                    userModified: false,
                };
            }

            if (shouldAutoExpandSessionLoadMetrics && !current.expanded) {
                return {
                    ...current,
                    expanded: true,
                };
            }

            if (!shouldAutoExpandSessionLoadMetrics && !current.userModified && current.expanded) {
                return {
                    ...current,
                    expanded: false,
                };
            }

            return current;
        });
    }, [sessionLoadMetrics, sessionLoadMetricsKey, shouldAutoExpandSessionLoadMetrics]);

    const handleOpenEditedFile = (filePath: string, lineStart?: number, lineEnd?: number) => {
        void openFile(filePath, lineStart, lineEnd, currentCwd);
    };

    const handleDiffViewModeChange = (mode: EditDiffPreviewMode) => {
        if (onDiffViewModeChange) {
            onDiffViewModeChange(mode);
            return;
        }
        setLocalDiffViewMode(mode);
    };

    const toggleSessionLoadMetrics = () => {
        if (!sessionLoadMetrics || !sessionLoadMetricsKey) return;
        setSessionLoadDisclosureState((current) => {
            const currentExpanded = shouldAutoExpandSessionLoadMetrics
                || (current.metricsKey === sessionLoadMetricsKey && current.expanded);
            return {
                metricsKey: sessionLoadMetricsKey,
                expanded: !currentExpanded,
                userModified: true,
            };
        });
    };

    const handleSelectEditedFile = (edit: ChatStatusEditSummary) => {
        if (onSelectedEditChange) {
            onSelectedEditChange(edit);
            return;
        }
        handleOpenEditedFile(edit.openPath, edit.lineStart, edit.lineEnd);
    };

    const handleEditedFileKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
        edit: ChatStatusEditSummary,
    ) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleSelectEditedFile(edit);
    };

    const toggleFolder = (folderKey: string) => {
        setCollapsedFolderState((current) => {
            const next = new Set(current.folders);
            if (next.has(folderKey)) {
                next.delete(folderKey);
            } else {
                next.add(folderKey);
            }
            return {
                ...current,
                folders: next,
                userModified: true,
            };
        });
    };

    const toggleAllFolders = () => {
        setCollapsedFolderState((current) => {
            if (editFolderKeys.length === 0) return current;
            const shouldExpandAll = editFolderKeys.every((key) => current.folders.has(key));
            return {
                ...current,
                folders: shouldExpandAll ? new Set() : new Set(editFolderKeys),
                userModified: true,
            };
        });
    };

    const showFloatingPreview = (key: string, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const maxTop = Math.max(12, window.innerHeight - 420);
        const top = Math.min(Math.max(12, rect.top - 8), maxTop);
        setFloatingPreview({ key, top });
    };

    const hideFloatingPreview = (key: string) => {
        setFloatingPreview((current) => (current?.key === key ? null : current));
    };

    const getStatusLabel = (status: ChatStatusEditSummary['status']) => (
        status === 'error' ? t('tools.failed') : status === 'pending' ? t('tools.pending') : t('common.success')
    );
    const getToolStatusLabel = (status: ChatStatusToolSummary['status']) => (
        status === 'error' ? t('tools.failed') : status === 'pending' ? t('tools.pending') : t('common.success')
    );
    const getActivityJumpLabelKey = (tool: ChatStatusToolSummary) => (
        tool.type === 'agent'
            ? 'chat.layout.scrollToSubagentActivity'
            : 'chat.layout.scrollToToolTask'
    );
    const renderToolStatusIcon = (status: ChatStatusToolSummary['status']) => {
        if (status === 'pending') return <Loader2 size={13} className="mt-0.5 flex-shrink-0 animate-spin text-warning" />;
        if (status === 'error') return <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-error" />;
        return <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-success" />;
    };
    const renderActivityTaskRow = (tool: ChatStatusToolSummary) => (
        <button
            type="button"
            key={tool.toolId}
            className="status-activity-task-row flex w-full min-w-0 items-start gap-2 rounded-md bg-base-200/45 px-2 py-1.5 text-left transition-colors hover:bg-base-200/80 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-default disabled:opacity-100"
            title={[tool.summary, tool.detail].filter(Boolean).join('\n')}
            aria-label={t(getActivityJumpLabelKey(tool), {tool: tool.summary || tool.label})}
            data-target-tool-id={tool.toolId}
            disabled={!onSelectTool}
            onClick={() => onSelectTool?.(tool)}
        >
            {renderToolStatusIcon(tool.status)}
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`tool-command-chip ${tool.accentClass}`}>{tool.label}</span>
                    <span className={`tool-state-pill ${tool.status}`}>{getToolStatusLabel(tool.status)}</span>
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

    const daemonStatusKind = getChatDaemonStatusKind({daemonReady, daemonStatus, daemonReconnecting});
    const showDaemonReconnect = Boolean(onReconnectDaemon) && (
        daemonReconnecting || canReconnectChatDaemon({daemonReady, daemonStatus, daemonReconnecting})
    );
    const readyStateClass = daemonStatusKind === 'ready'
        ? 'font-medium text-success'
        : daemonStatusKind === 'offline' || daemonStatusKind === 'error'
            ? 'font-medium text-error'
            : 'font-medium text-warning';
    const daemonStatusText = daemonStatusKind === 'ready'
        ? t('common.success')
        : daemonStatusKind === 'offline'
            ? t('chat.daemon.offline')
            : daemonStatusKind === 'error'
                ? t('chat.daemon.error')
                : daemonStatusKind === 'unknown' && daemonStatus
                ? daemonStatus
                : t('chat.starting');
    const daemonDiagnosticText = getChatDaemonDiagnosticText({
        daemonReady,
        daemonStatus,
        daemonReconnecting,
        error: daemonError,
    });
    const daemonDiagnosticDisplayText = daemonDiagnosticText === CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY
        ? t(CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY)
        : daemonDiagnosticText;
    const mcpSummaryText = mcpStatus
        ? t('chat.layout.mcpEnabledSummary', {
            enabled: mcpStatus.enabledServers,
            total: mcpStatus.totalServers,
        })
        : '';
    const mcpSummaryClass = mcpStatus?.error
        ? 'text-error'
        : mcpStatus?.loading
            ? 'text-warning'
            : (mcpStatus?.enabledServers ?? 0) > 0
                ? 'text-success'
                : 'text-base-content/55';
    const canCheckMcpConnectivity = Boolean(onCheckMcpConnectivity) && (mcpStatus?.enabledServers ?? 0) > 0;
    const sessionLoadStatusLabel = sessionLoadMetrics?.status === 'error'
        ? t('chat.layout.sessionLoadError')
        : sessionLoadMetrics?.status === 'loading'
            ? t('chat.layout.sessionLoadLoading')
            : sessionLoadMetrics?.status === 'windowed'
                ? t('chat.layout.sessionLoadWindowed')
                : t('chat.layout.sessionLoadComplete');
    const sessionLoadStatusClass = sessionLoadMetrics?.status === 'error'
        ? 'error'
        : sessionLoadMetrics?.status === 'loading'
            ? 'pending'
            : 'completed';
    const sessionLoadSourceLabel = sessionLoadMetrics?.cacheHit
        ? t('chat.layout.sessionLoadCacheHit')
        : t('chat.layout.sessionLoadWindowFirstPaint');
    const sessionLoadSummaryText = sessionLoadMetrics
        ? [
            sessionLoadSourceLabel,
            sessionLoadMetrics.cacheHit
                ? formatMetricCount(sessionLoadMetrics.fullMessageCount)
                : `${formatMetricCount(sessionLoadMetrics.windowMessageCount)} / ${formatMetricCount(sessionLoadMetrics.totalMessageCount)}`,
            formatMetricMs(sessionLoadMetrics.elapsedMs ?? sessionLoadMetrics.windowLoadMs),
        ].join(' · ')
        : '';
    const getMcpLiveStatusLabel = (status: ChatMcpLiveStatus) => {
        switch (status) {
            case 'online':
                return t('chat.layout.mcpLiveOnline');
            case 'offline':
                return t('chat.layout.mcpLiveOffline');
            case 'timeout':
                return t('chat.layout.mcpLiveTimeout');
            case 'error':
                return t('chat.layout.mcpLiveError');
            case 'unknown':
            default:
                return t('chat.layout.mcpLiveUnknown');
        }
    };
    const renderEditTreeNode = (node: EditTreeNode, depth: number): ReactNode => {
        const paddingLeft = `${6 + depth * 12}px`;

        if (node.type === 'folder') {
            const isCollapsed = collapsedFolders.has(node.key);
            return (
                <div key={node.key} className="status-edit-tree-node">
                    <button
                        type="button"
                        className="status-edit-tree-row status-edit-tree-folder"
                        style={{ paddingLeft }}
                        title={node.path}
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleFolder(node.key)}
                    >
                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
                        <span className="min-w-0 flex-1 truncate">{node.name}</span>
                        <span className="status-edit-tree-stats">
                            <span className="text-success">+{node.additions}</span>
                            <span className="text-error">-{node.deletions}</span>
                        </span>
                    </button>
                    {!isCollapsed && node.children.map((child) => renderEditTreeNode(child, depth + 1))}
                </div>
            );
        }

        const edit = node.edit;
        if (!edit) return null;
        const isPreviewVisible = floatingPreview?.key === node.key;
        const editKey = getChatStatusEditKey(edit);
        const isSelected = selectedEditKey === editKey;

        return (
            <div
                key={node.key}
                role="button"
                tabIndex={0}
                className={cn(
                    'status-edit-diff-trigger status-edit-tree-row status-edit-tree-file',
                    isSelected && 'status-edit-tree-file-selected',
                )}
                style={{ paddingLeft }}
                title={edit.displayPath}
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => handleSelectEditedFile(edit)}
                onKeyDown={(event) => handleEditedFileKeyDown(event, edit)}
                onMouseEnter={(event) => showFloatingPreview(node.key, event.currentTarget)}
                onMouseLeave={() => hideFloatingPreview(node.key)}
                onFocus={(event) => showFloatingPreview(node.key, event.currentTarget)}
                onBlur={() => hideFloatingPreview(node.key)}
            >
                <FileDiff size={12} className="status-edit-tree-file-icon" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-base-content/70">
                        <span className={`tool-state-pill ${edit.status}`}>{getStatusLabel(edit.status)}</span>
                        <span className="truncate">{node.name}</span>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-base-content/40">
                        <span className="min-w-0 truncate">{edit.displayPath}</span>
                        {(edit.lineStart || edit.lineEnd) && (
                            <span className="flex-shrink-0">
                                {edit.lineStart ? `L${edit.lineStart}${edit.lineEnd && edit.lineEnd !== edit.lineStart ? `-L${edit.lineEnd}` : ''}` : ''}
                            </span>
                        )}
                    </div>
                </div>
                <div className="status-edit-tree-stats">
                    <span className="text-success">+{edit.additions}</span>
                    <span className="text-error">-{edit.deletions}</span>
                    <button
                        type="button"
                        className="status-edit-tree-open"
                        title={t('tools.openFile')}
                        aria-label={t('tools.openFile')}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEditedFile(edit.openPath, edit.lineStart, edit.lineEnd);
                        }}
                    >
                        <ExternalLink size={11} />
                    </button>
                </div>
                {edit.diffPreviewLines.length > 0 && (
                    <EditDiffPreview
                        filePath={edit.displayPath}
                        additions={edit.additions}
                        deletions={edit.deletions}
                        lines={edit.diffPreviewLines}
                        mode={activeDiffViewMode}
                        visible={isPreviewVisible}
                        floatingTop={isPreviewVisible ? floatingPreview.top : undefined}
                        surface="status"
                    />
                )}
            </div>
        );
    };

    const diffModeButtonClass = (mode: EditDiffPreviewMode) => cn(
        'status-diff-mode-button',
        activeDiffViewMode === mode && 'active',
    );

    const renderEditToolbar = () => (
        <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1">
                <button
                    type="button"
                    className="status-edit-tree-toggle"
                    title={allFoldersCollapsed ? t('chat.layout.expandEditTree') : t('chat.layout.collapseEditTree')}
                    aria-label={allFoldersCollapsed ? t('chat.layout.expandEditTree') : t('chat.layout.collapseEditTree')}
                    onClick={toggleAllFolders}
                >
                    <FolderTree size={12} />
                </button>
            </div>
            <div className="status-diff-mode-toggle" role="group" aria-label={t('chat.layout.diffViewMode')}>
                <button
                    type="button"
                    className={diffModeButtonClass('unified')}
                    title={t('chat.layout.diffUnifiedView')}
                    aria-label={t('chat.layout.diffUnifiedView')}
                    aria-pressed={activeDiffViewMode === 'unified'}
                    onClick={() => handleDiffViewModeChange('unified')}
                >
                    <Rows3 size={12} />
                </button>
                <button
                    type="button"
                    className={diffModeButtonClass('split')}
                    title={t('chat.layout.diffSplitView')}
                    aria-label={t('chat.layout.diffSplitView')}
                    aria-pressed={activeDiffViewMode === 'split'}
                    onClick={() => handleDiffViewModeChange('split')}
                >
                    <Columns2 size={12} />
                    <span className="diff-mode-color-bars" aria-hidden="true">
                        <span className="diff-mode-color-bar deleted" />
                        <span className="diff-mode-color-bar added" />
                    </span>
                </button>
            </div>
        </div>
    );

    return (
        <aside className="hidden h-full min-w-0 flex-shrink-0 overflow-hidden border-l border-base-300 bg-base-100/70 p-2 xl:flex xl:flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-base-300 bg-base-200/30 p-2 text-xs text-base-content/60">
                <div className="mb-2 flex items-center gap-2 font-medium text-base-content/70">
                    <Activity size={14} />
                    <span>{t('chat.layout.statusPanel')}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <div className="flex items-center justify-between gap-2 col-span-2">
                        <span>{t('chat.providerLabel')}</span>
                        <span className="font-medium text-base-content/70">{provider}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.layout.messageCount')}</span>
                        <span className="font-medium text-base-content/70">{messageCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.layout.anchorRail')}</span>
                        <span className="font-medium text-base-content/70">{anchorCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.daemon.label')}</span>
                        <div className="flex min-w-0 items-center justify-end gap-1.5">
                            <span className={readyStateClass} title={daemonDiagnosticDisplayText ?? daemonStatusText}>
                                {daemonStatusText}
                            </span>
                            {showDaemonReconnect && (
                                <button
                                    type="button"
                                    className="status-daemon-reconnect"
                                    title={t('chat.daemon.reconnect')}
                                    aria-label={t('chat.daemon.reconnect')}
                                    disabled={daemonReconnecting}
                                    onClick={onReconnectDaemon}
                                >
                                    <RefreshCw size={11} className={daemonReconnecting ? 'animate-spin' : ''} />
                                </button>
                            )}
                        </div>
                    </div>
                    {daemonDiagnosticDisplayText && (
                        <div
                            className="status-daemon-diagnostic col-span-2 -mt-1 truncate text-[10px] leading-snug text-base-content/45"
                            title={daemonDiagnosticDisplayText}
                        >
                            {daemonDiagnosticDisplayText}
                        </div>
                    )}
                    {mcpStatus && (
                        <div
                            className={cn(
                                'status-mcp-summary col-span-2 rounded-md border border-base-300/70 bg-base-100/45 px-2 py-1.5',
                                mcpDetailsExpanded && 'status-mcp-summary-expanded',
                            )}
                            title={mcpStatus.error ?? mcpSummaryText}
                        >
                            <button
                                type="button"
                                className="status-mcp-toggle flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                                aria-expanded={mcpDetailsExpanded}
                                onClick={() => setMcpExpanded((current) => !current)}
                            >
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <ChevronRight size={12} className="status-mcp-chevron flex-shrink-0 text-base-content/35" />
                                    <Server size={12} className="flex-shrink-0 text-base-content/35" />
                                    <span className="text-base-content/55">{t('chat.layout.mcpStatus')}</span>
                                </div>
                                <div className={cn('flex min-w-0 items-center gap-1.5 font-medium', mcpSummaryClass)}>
                                    {mcpStatus.loading && <Loader2 size={11} className="flex-shrink-0 animate-spin" />}
                                    <span className="truncate">{mcpSummaryText}</span>
                                </div>
                            </button>
                            {mcpDetailsExpanded && (
                                <div className="status-mcp-details mt-2 space-y-1.5 border-t border-base-300/60 pt-1.5">
                                    {mcpStatus.error && (
                                        <div className="status-mcp-diagnostic truncate text-[10px] leading-snug text-base-content/45" title={mcpStatus.error}>
                                            {mcpStatus.error}
                                        </div>
                                    )}
                                    {mcpStatus.loading && (
                                        <div className="text-[10px] leading-snug text-base-content/45">
                                            {t('chat.layout.mcpLoading')}
                                        </div>
                                    )}
                                    {onCheckMcpConnectivity && (
                                        <div className="flex items-center justify-between gap-2 rounded bg-base-200/35 px-1.5 py-1">
                                            <div className="min-w-0 text-[10px] leading-snug text-base-content/45">
                                                {mcpStatus.enabledServers > 0
                                                    ? t('chat.layout.mcpManualCheckHint')
                                                    : t('chat.layout.mcpNoEnabledServers')}
                                            </div>
                                            <button
                                                type="button"
                                                className="status-mcp-check inline-flex flex-shrink-0 items-center gap-1 rounded border border-base-300/70 bg-base-100/60 px-1.5 py-0.5 text-[10px] font-medium text-base-content/60 transition-colors hover:bg-base-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                title={t('chat.layout.mcpCheckLive')}
                                                disabled={!canCheckMcpConnectivity || mcpConnectivity?.checking}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onCheckMcpConnectivity?.();
                                                }}
                                            >
                                                <RefreshCw size={10} className={mcpConnectivity?.checking ? 'animate-spin' : ''} />
                                                {mcpConnectivity?.checking
                                                    ? t('chat.layout.mcpChecking')
                                                    : t('chat.layout.mcpCheckLive')}
                                            </button>
                                        </div>
                                    )}
                                    {mcpConnectivity?.error && (
                                        <div className="status-mcp-live-error truncate text-[10px] leading-snug text-error/80" title={mcpConnectivity.error}>
                                            {mcpConnectivity.error}
                                        </div>
                                    )}
                                    {mcpStatus.servers.length > 0 ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-normal text-base-content/40">
                                                <span>{t('chat.layout.mcpConfiguredServers')}</span>
                                                <span>{mcpStatus.servers.length}</span>
                                            </div>
                                            {mcpStatus.servers.map((server) => {
                                                const liveResult = server.enabled
                                                    ? mcpConnectivity?.resultByServerId[server.id]
                                                    : undefined;
                                                const liveLatencyText = typeof liveResult?.latencyMs === 'number'
                                                    ? t('chat.layout.mcpLiveLatency', {latency: liveResult.latencyMs})
                                                    : null;
                                                const liveTitle = [liveResult?.message, liveLatencyText].filter(Boolean).join(' · ') || undefined;

                                                return (
                                                    <div key={server.id} className="flex min-w-0 items-center justify-between gap-2 rounded bg-base-200/45 px-1.5 py-1">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-[11px] font-medium text-base-content/70" title={server.name}>
                                                                {server.name}
                                                            </div>
                                                            <div className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-base-content/40">
                                                                {server.transport && <span className="truncate">{server.transport}</span>}
                                                                {liveLatencyText && <span className="flex-shrink-0">{liveLatencyText}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-shrink-0 items-center gap-1">
                                                            {liveResult && (
                                                                <span
                                                                    className={cn(
                                                                        'status-mcp-live-result tool-state-pill',
                                                                        getMcpLiveStatusClass(liveResult.status),
                                                                    )}
                                                                    title={liveTitle}
                                                                >
                                                                    {getMcpLiveStatusLabel(liveResult.status)}
                                                                </span>
                                                            )}
                                                            <span className={cn('tool-state-pill', server.enabled ? 'completed' : 'pending')}>
                                                                {server.enabled ? t('chat.layout.mcpEnabled') : t('chat.layout.mcpDisabled')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] leading-snug text-base-content/45">
                                            {t('chat.layout.mcpNoServers')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {sessionLoadMetrics && (
                        <div
                            className={cn(
                                'status-session-load-metrics col-span-2 rounded-md border border-base-300/70 bg-base-100/45 px-2 py-1.5',
                                sessionLoadMetricsExpanded && 'status-session-load-metrics-expanded',
                            )}
                            title={sessionLoadMetrics.sourcePath}
                        >
                            <button
                                type="button"
                                className="status-session-load-toggle flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                                aria-expanded={sessionLoadMetricsExpanded}
                                onClick={toggleSessionLoadMetrics}
                            >
                                <div className="flex min-w-0 items-center gap-1.5">
                                    {sessionLoadMetricsExpanded ? (
                                        <ChevronDown size={12} className="flex-shrink-0 text-base-content/35" />
                                    ) : (
                                        <ChevronRight size={12} className="flex-shrink-0 text-base-content/35" />
                                    )}
                                    <Activity size={12} className="flex-shrink-0 text-base-content/35" />
                                    <span className="truncate text-base-content/55">
                                        {t('chat.layout.sessionLoadMetrics')}
                                    </span>
                                </div>
                                <div className="flex min-w-0 items-center justify-end gap-1.5">
                                    <span className="min-w-0 truncate text-right text-[10px] font-medium text-base-content/55">
                                        {sessionLoadSummaryText}
                                    </span>
                                    <span className={cn('tool-state-pill', sessionLoadStatusClass)}>
                                        {sessionLoadStatusLabel}
                                    </span>
                                </div>
                            </button>
                            {sessionLoadMetricsExpanded && (
                                <div className="status-session-load-details mt-2 space-y-1 border-t border-base-300/60 pt-1.5 text-[10px] leading-snug text-base-content/50">
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{t('chat.layout.sessionLoadSource')}</span>
                                        <span className="truncate text-right font-medium text-base-content/65">
                                            {sessionLoadSourceLabel}
                                        </span>
                                    </div>
                                    {sessionLoadMetrics.cacheHit ? (
                                        <div className="flex items-center justify-between gap-2">
                                            <span>{t('chat.layout.sessionLoadCache')}</span>
                                            <span className="truncate text-right font-medium text-base-content/65">
                                                {formatMetricCount(sessionLoadMetrics.fullMessageCount)}
                                                {' · '}
                                                {formatMetricMs(sessionLoadMetrics.elapsedMs)}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-2">
                                            <span>{t('chat.layout.sessionLoadWindow')}</span>
                                            <span className="truncate text-right font-medium text-base-content/65">
                                                {formatMetricCount(sessionLoadMetrics.windowMessageCount)}
                                                {' / '}
                                                {formatMetricCount(sessionLoadMetrics.totalMessageCount)}
                                                {' · '}
                                                {formatMetricMs(sessionLoadMetrics.windowLoadMs)}
                                                {' · '}
                                                {t('chat.layout.sessionLoadMapMs', {
                                                    ms: formatMetricMs(sessionLoadMetrics.windowMapMs),
                                                })}
                                            </span>
                                        </div>
                                    )}
                                    {!sessionLoadMetrics.cacheHit && sessionLoadMetrics.fullLoadMs !== null && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span>{t('chat.layout.sessionLoadFull')}</span>
                                            <span className="truncate text-right font-medium text-base-content/65">
                                                {formatMetricCount(sessionLoadMetrics.fullMessageCount)}
                                                {' · '}
                                                {formatMetricMs(sessionLoadMetrics.fullLoadMs)}
                                                {' · '}
                                                {t('chat.layout.sessionLoadMapMs', {
                                                    ms: formatMetricMs(sessionLoadMetrics.fullMapMs),
                                                })}
                                            </span>
                                        </div>
                                    )}
                                    {!sessionLoadMetrics.cacheHit && sessionLoadMetrics.elapsedMs !== null && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span>{t('chat.layout.sessionLoadElapsed')}</span>
                                            <span className="font-medium text-base-content/65">
                                                {formatMetricMs(sessionLoadMetrics.elapsedMs)}
                                            </span>
                                        </div>
                                    )}
                                    {sessionLoadMetrics.error && (
                                        <div
                                            className="truncate text-error/80"
                                            title={sessionLoadMetrics.error}
                                        >
                                            {sessionLoadMetrics.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {hasRuntimeContext && (
                    <div className="status-runtime-context mt-2 rounded-md border border-base-300/70 bg-base-100/45 p-2">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-normal text-base-content/45">
                            <SlidersHorizontal size={12} />
                            <span>{t('chat.layout.runtimeContext')}</span>
                        </div>
                        <div className="status-runtime-context-grid grid grid-cols-2 gap-1.5">
                            {modelLabel && (
                                <div className="status-runtime-context-item min-w-0 rounded bg-base-200/35 px-1.5 py-1">
                                    <div className="truncate text-[9px] uppercase tracking-normal text-base-content/40">
                                        {t('chat.modelLabel')}
                                    </div>
                                    <div className="status-runtime-context-value min-w-0 truncate text-[11px] font-medium leading-tight text-base-content/70" title={modelLabel}>
                                        {modelLabel}
                                    </div>
                                </div>
                            )}
                            {permissionModeLabel && (
                                <div className="status-runtime-context-item min-w-0 rounded bg-base-200/35 px-1.5 py-1">
                                    <div className="truncate text-[9px] uppercase tracking-normal text-base-content/40">
                                        {t('chat.modeLabel')}
                                    </div>
                                    <div className="status-runtime-context-value min-w-0 truncate text-[11px] font-medium leading-tight text-base-content/70" title={permissionModeLabel}>
                                        {permissionModeLabel}
                                    </div>
                                </div>
                            )}
                            {reasoningLabel && (
                                <div className="status-runtime-context-item min-w-0 rounded bg-base-200/35 px-1.5 py-1">
                                    <div className="truncate text-[9px] uppercase tracking-normal text-base-content/40">
                                        {t('chat.reasoningLabel')}
                                    </div>
                                    <div className="status-runtime-context-value min-w-0 truncate text-[11px] font-medium leading-tight text-base-content/70" title={reasoningLabel}>
                                        {reasoningLabel}
                                    </div>
                                </div>
                            )}
                            {workspaceLabel && (
                                <div className="status-runtime-context-item min-w-0 rounded bg-base-200/35 px-1.5 py-1">
                                    <div className="truncate text-[9px] uppercase tracking-normal text-base-content/40">
                                        {t('chat.layout.workspace')}
                                    </div>
                                    <div className="status-runtime-context-value min-w-0 truncate text-[11px] font-medium leading-tight text-base-content/70" title={workspaceLabel}>
                                        {workspaceLabel}
                                    </div>
                                </div>
                            )}
                            {sdkStatus && (
                                <div className="status-runtime-context-item min-w-0 rounded bg-base-200/35 px-1.5 py-1">
                                    <div className="truncate text-[9px] uppercase tracking-normal text-base-content/40">
                                        {t('chat.layout.sdkStatus')}
                                    </div>
                                    <div
                                        className={cn(
                                            'status-runtime-context-value min-w-0 truncate text-[11px] font-medium leading-tight',
                                            sdkStatus.installed ? 'text-success' : 'text-error',
                                        )}
                                        title={sdkStatus.path || sdkStatus.displayName}
                                    >
                                        {sdkStatus.displayName} · {sdkStatus.installed ? t('chat.sdk.installed') : t('chat.sdk.notInstalled')}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-3 space-y-3">
                    {shouldShowCurrentActivityCard && (
                        <div className="rounded-md border border-base-300/70 bg-base-100/65 p-2">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-normal text-base-content/45">
                                    <Sparkles size={12} className="flex-shrink-0" />
                                    <span className="truncate">{t('chat.layout.currentActivity')}</span>
                                </div>
                                {hasActivityToolCounts && (
                                    <div className="status-activity-tool-counts flex flex-shrink-0 items-center gap-1">
                                        {pendingToolCount > 0 && (
                                            <span
                                                className="status-activity-tool-count pending tool-state-pill"
                                                title={t('chat.layout.pendingTools')}
                                            >
                                                {pendingToolCount}
                                            </span>
                                        )}
                                        {errorToolCount > 0 && (
                                            <span
                                                className="status-activity-tool-count error tool-state-pill"
                                                title={t('chat.layout.errorTools')}
                                            >
                                                {errorToolCount}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {activeTool ? (
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`tool-command-chip ${activeTool.accentClass}`}>
                                                    {activeTool.label}
                                                </span>
                                                <span className={`tool-state-pill ${activeTool.status}`}>
                                                    {getToolStatusLabel(activeTool.status)}
                                                </span>
                                            </div>
                                            <div className="truncate text-[12px] font-medium text-base-content/75" title={activeTool.summary}>
                                                {activeTool.summary}
                                            </div>
                                        </div>
                                        {renderToolStatusIcon(activeTool.status)}
                                    </div>
                                    {activeTool.detail && (
                                        <div className="text-[11px] leading-tight text-base-content/50" title={activeTool.detail}>
                                            {activeTool.detail}
                                        </div>
                                    )}
                                </div>
                            ) : isStreaming ? (
                                <div className="flex items-center gap-2 text-[11px] text-base-content/50">
                                    <Loader2 size={13} className="animate-spin text-success/75" />
                                    <span>{t('chat.layout.streamingReply')}</span>
                                </div>
                            ) : !hasActivityTasks && !hasActivitySubagents && (
                                <div className="flex items-center gap-2 text-[11px] text-base-content/50">
                                    <span className="h-1.5 w-1.5 rounded-full bg-base-content/30" />
                                    <span>{t('chat.layout.idle')}</span>
                                </div>
                            )}

                            {(hasActivityTasks || hasActivitySubagents) && (
                                <div
                                    className="status-activity-scroll-region mt-2 max-h-64 min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1 focus:outline-none focus:ring-2 focus:ring-primary/25"
                                    role="region"
                                    tabIndex={0}
                                    aria-label={t('chat.layout.activityHistoryRegion')}
                                >
                                    {hasActivityTasks && (
                                        <div className="status-activity-task-list space-y-1.5 border-t border-base-300/60 pt-1.5">
                                            <div className="flex items-center justify-between gap-2 px-1 text-[10px] uppercase tracking-normal text-base-content/40">
                                                <span>{t('chat.layout.inputStatusTasks')}</span>
                                                <span>{recentActivityTasks.length} / {activityTasks.length}</span>
                                            </div>
                                            {recentActivityTasks.map(renderActivityTaskRow)}
                                            {hiddenActivityTaskCount > 0 && (
                                                <div className="status-activity-task-hidden-count px-1 text-[10px] text-base-content/40">
                                                    {t('chat.layout.inputStatusMoreTools', {count: hiddenActivityTaskCount})}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {hasActivitySubagents && (
                                        <div className="status-activity-subagent-list space-y-1.5 border-t border-base-300/60 pt-1.5">
                                            <div className="flex items-center justify-between gap-2 px-1 text-[10px] uppercase tracking-normal text-base-content/40">
                                                <span className="inline-flex min-w-0 items-center gap-1">
                                                    <Bot size={11} className="flex-shrink-0" />
                                                    <span className="truncate">{t('chat.layout.inputStatusSubagents')}</span>
                                                </span>
                                                <span>{recentActivitySubagents.length} / {activitySubagents.length}</span>
                                            </div>
                                            {recentActivitySubagents.map(renderActivityTaskRow)}
                                            {hiddenActivitySubagentCount > 0 && (
                                                <div className="status-activity-subagent-hidden-count px-1 text-[10px] text-base-content/40">
                                                    {t('chat.layout.inputStatusMoreSubagents', {count: hiddenActivitySubagentCount})}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {shouldShowRecentEditsCard && (
                        <div className="rounded-md border border-base-300/70 bg-base-100/65 p-2">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-normal text-base-content/45">
                                    <FilePenLine size={12} />
                                    <span>{t('chat.layout.recentEdits')}</span>
                                </div>
                                <div className="flex min-w-0 items-center justify-end gap-1.5">
                                    <div className="max-w-[9rem] truncate text-right text-[10px] text-base-content/45" title={t('chat.layout.editSummary', {
                                        count: touchedFileCount,
                                        additions: statusSummary?.totalAdditions ?? 0,
                                        deletions: statusSummary?.totalDeletions ?? 0,
                                    })}>
                                        {t('chat.layout.editSummary', {
                                            count: touchedFileCount,
                                            additions: statusSummary?.totalAdditions ?? 0,
                                            deletions: statusSummary?.totalDeletions ?? 0,
                                        })}
                                    </div>
                                    {canReopenDiffPane && (
                                        <button
                                            type="button"
                                            className="status-edit-tree-toggle status-diff-pane-reopen status-diff-pane-reopen-header"
                                            title={t('chat.layout.expandDiffPanel')}
                                            aria-label={t('chat.layout.expandDiffPanel')}
                                            onClick={onOpenDiffPanel}
                                        >
                                            <PanelRightOpen size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {visibleEdits.length > 0 && (
                                <div className="space-y-1.5">
                                    {renderEditToolbar()}
                                    <div className={cn(
                                        'status-edit-tree-scroll',
                                        showAllEdits && 'status-edit-tree-scroll-expanded',
                                    )}>
                                        {editTree.map((node) => renderEditTreeNode(node, 0))}
                                    </div>
                                    {hiddenEditCount > 0 && (
                                        <button
                                            type="button"
                                            className="w-full rounded-md border border-dashed border-base-300/70 bg-base-100/35 px-2 py-1.5 text-left text-[10px] text-base-content/45 transition-colors hover:bg-base-100/70"
                                            title={t('chat.layout.hiddenEditFiles', {count: hiddenEditCount})}
                                            onClick={() => setShowAllEdits((value) => !value)}
                                        >
                                            {showAllEdits
                                                ? t('chat.layout.showRecentEditFiles')
                                                : t('chat.layout.hiddenEditFiles', {count: hiddenEditCount})}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeAnchorLabel && (
                        <div className="rounded-md border border-base-300/70 bg-base-100/60 p-2" title={activeAnchorLabel}>
                            <div className="mb-1 flex items-center gap-1 text-[10px] text-base-content/45">
                                <span className="h-1.5 w-1.5 rounded-full bg-success/70" />
                                <span>{t('chat.layout.currentAnchor')}</span>
                            </div>
                            <div className="text-[11px] leading-tight text-base-content/60">
                                {activeAnchorLabel}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
