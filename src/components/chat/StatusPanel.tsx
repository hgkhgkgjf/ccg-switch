import {type KeyboardEvent, type ReactNode, useEffect, useMemo, useState} from 'react';
import {
    Activity,
    AlertTriangle,
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
    Rows3,
    Sparkles,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {openFile} from '../../utils/bridge';
import {type ChatStatusEditSummary, type ChatStatusSummary, getChatStatusEditKey} from '../../utils/chatStatusSummary';
import {cn} from '../../utils/cn';
import type {EditDiffPreviewMode} from '../toolBlocks/EditDiffPreview';
import EditDiffPreview from '../toolBlocks/EditDiffPreview';

const EMPTY_EDIT_SUMMARIES: ChatStatusEditSummary[] = [];
const AUTO_COLLAPSE_EDIT_TREE_FILE_THRESHOLD = 24;

interface CollapsedFolderState {
    editSetKey: string;
    folders: Set<string>;
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

export default function StatusPanel({
    provider,
    messageCount,
    daemonReady,
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
    const hiddenEditCount = Math.max(0, touchedFileCount - recentEdits.length);
    const collapsedFolders = collapsedFolderState.folders;
    const allFoldersCollapsed = editFolderKeys.length > 0 && editFolderKeys.every((key) => collapsedFolders.has(key));
    const canReopenDiffPane = Boolean(isDiffPaneCollapsed && allEdits.length > 0 && onOpenDiffPanel);

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

    const readyStateClass = daemonReady ? 'font-medium text-success' : 'font-medium text-warning';
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
                        <span>{t('chat.ready')}</span>
                        <span className={readyStateClass}>
                            {daemonReady ? t('common.success') : t('chat.starting')}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.layout.pendingTools')}</span>
                        <span className="font-medium text-base-content/70">{statusSummary?.pendingToolCount ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.layout.errorTools')}</span>
                        <span className={cn(
                            'font-medium',
                            (statusSummary?.errorToolCount ?? 0) > 0 ? 'text-error' : 'text-base-content/70',
                        )}>
                            {statusSummary?.errorToolCount ?? 0}
                        </span>
                    </div>
                </div>

                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-base-300/70 bg-base-100/65 p-2">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-normal text-base-content/45">
                            <Sparkles size={12} />
                            <span>{t('chat.layout.currentActivity')}</span>
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
                                                {activeTool.status === 'pending'
                                                    ? t('tools.pending')
                                                    : activeTool.status === 'error'
                                                        ? t('tools.failed')
                                                        : t('common.success')}
                                            </span>
                                        </div>
                                        <div className="truncate text-[12px] font-medium text-base-content/75" title={activeTool.summary}>
                                            {activeTool.summary}
                                        </div>
                                    </div>
                                    {activeTool.status === 'pending' ? (
                                        <Loader2 size={14} className="mt-0.5 flex-shrink-0 animate-spin text-warning" />
                                    ) : activeTool.status === 'error' ? (
                                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-error" />
                                    ) : (
                                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-success" />
                                    )}
                                </div>
                                {activeTool.detail && (
                                    <div className="text-[11px] leading-tight text-base-content/50" title={activeTool.detail}>
                                        {activeTool.detail}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-[11px] text-base-content/50">
                                {isStreaming ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin text-success/75" />
                                        <span>{t('chat.layout.streamingReply')}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="h-1.5 w-1.5 rounded-full bg-base-content/30" />
                                        <span>{t('chat.layout.idle')}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

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
                                    {touchedFileCount > 0
                                        ? t('chat.layout.editSummary', {
                                            count: touchedFileCount,
                                            additions: statusSummary?.totalAdditions ?? 0,
                                            deletions: statusSummary?.totalDeletions ?? 0,
                                        })
                                        : '+0 / -0'}
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

                        {visibleEdits.length > 0 ? (
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
                        ) : (
                            <div className="text-[11px] text-base-content/45">
                                {t('chat.layout.noRecentEdits')}
                            </div>
                        )}
                    </div>

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
