import {type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Package, PanelRightOpen, Trash2} from 'lucide-react';
import {useChatStore} from '../stores/useChatStore';
import {useSdkStore} from '../stores/useSdkStore';
import SdkDependencyPanel from '../components/chat/SdkDependencyPanel';
import AskUserQuestionDialog from '../components/chat/AskUserQuestionDialog';
import PlanApprovalDialog from '../components/chat/PlanApprovalDialog';
import ToolPermissionDialog from '../components/chat/ToolPermissionDialog';
import MessageList from '../components/chat/MessageList';
import ConversationSearch from '../components/chat/ConversationSearch';
import MessageAnchorRail from '../components/chat/MessageAnchorRail';
import ScrollControl from '../components/chat/ScrollControl';
import StatusPanel from '../components/chat/StatusPanel';
import ChatSessionSidebar from '../components/chat/ChatSessionSidebar';
import ChatDiffReviewPane from '../components/chat/ChatDiffReviewPane';
import {ChatComposer} from '../components/chat/composer/ChatComposer';
import ModalDialog from '../components/common/ModalDialog';
import {
    CONVERSATION_PANE_MAX_WIDTH,
    CONVERSATION_PANE_MIN_WIDTH,
    DIFF_PANE_MAX_WIDTH,
    DIFF_PANE_MIN_WIDTH,
    getCollapsedMessageWindow,
    getPaneWidthsAfterResize,
    shouldShowDiffPaneReopenControl,
    STATUS_PANE_MAX_WIDTH,
    STATUS_PANE_MIN_WIDTH,
} from '../utils/chatUiBehavior';
import {buildChatStatusSummary, type ChatStatusEditSummary, getChatStatusEditKey,} from '../utils/chatStatusSummary';
import {
    filterRenderableMessages,
    getAnchorPreview,
    getRenderableMessages,
    getVisibleAnchorMessages,
    isMessageAnchorCandidate,
} from '../utils/chatNavigation';
import {getSessionSelectionKey, type SessionMeta} from '../types/session';
import type {EditDiffPreviewMode} from '../components/toolBlocks/EditDiffPreview';

const BOTTOM_REVEAL_THRESHOLD = 160;
/**
 * 交互式对话页 —— 对接 ai-bridge daemon（Claude Code / Codex）。
 *
 * 这是集成的最小可用前端：发送消息、流式渲染回复、中止、清空。
 * 工具调用可视化、Diff、权限审批将在后续任务中补充。
 */
export default function ChatPage() {
    const {t} = useTranslation();
    const {
        messages,
        provider,
        currentCwd,
        activeSession,
        pendingSessionKey,
        daemonReady,
        daemonStatus,
        error,
        pendingAskUserQuestion,
        pendingPlanApproval,
        pendingToolPermission,
        init,
        clear,
        loadSession,
        startNewSession,
        answerAskUserQuestion,
        answerToolPermission,
        approvePlan,
    } = useChatStore();

    const [sdkModalOpen, setSdkModalOpen] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedAnchorCount, setCollapsedAnchorCount] = useState<number | null>(null);
    const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
    const [conversationPaneWidth, setConversationPaneWidth] = useState(600);
    const [diffPaneWidth, setDiffPaneWidth] = useState(520);
    const [statusPaneWidth, setStatusPaneWidth] = useState(320);
    const [selectedEditKey, setSelectedEditKey] = useState<string | null>(null);
    const [diffViewMode, setDiffViewMode] = useState<EditDiffPreviewMode>('unified');
    const [diffWrapLines, setDiffWrapLines] = useState(true);
    const [diffPaneCollapsed, setDiffPaneCollapsed] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isNearBottomRef = useRef(true);
    const messageNodeMapRef = useRef<Map<string, HTMLElement>>(new Map());
    const paneResizeCleanupRef = useRef<(() => void) | null>(null);

    const sdkStatuses = useSdkStore((s) => s.statuses);
    const sdkInit = useSdkStore((s) => s.init);

    useEffect(() => {
        void init();
        void sdkInit();
    }, [init, sdkInit]);

    useEffect(() => () => {
        paneResizeCleanupRef.current?.();
    }, []);

    const updateBottomState = useCallback(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;

        const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
        const nextIsNearBottom = distanceFromBottom < BOTTOM_REVEAL_THRESHOLD;
        isNearBottomRef.current = nextIsNearBottom;
        setIsNearBottom(nextIsNearBottom);
    }, []);

    useEffect(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl || !isNearBottomRef.current) return;

        requestAnimationFrame(() => {
            scrollEl.scrollTo({top: scrollEl.scrollHeight, behavior: 'smooth'});
        });
    }, [messages]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 当前 provider 对应的 SDK 是否已安装。
    const sdkId = provider === 'claude' ? 'claude-sdk' : 'codex-sdk';
    const currentSdk = sdkStatuses.find((s) => s.id === sdkId);
    const sdkMissing = currentSdk ? !currentSdk.installed : false;
    const hasMessages = messages.length > 0;
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const renderableMessages = useMemo(() => getRenderableMessages(messages), [messages]);
    const filteredMessages = useMemo(
        () => filterRenderableMessages(renderableMessages, normalizedSearchQuery),
        [normalizedSearchQuery, renderableMessages],
    );
    const renderableMessageCount = renderableMessages.length;
    const { totalEarlierMessages } = useMemo(() => getCollapsedMessageWindow({
        filteredCount: filteredMessages.length,
        revealedCount: 0,
        isSearching: normalizedSearchQuery.length > 0,
    }), [filteredMessages.length, normalizedSearchQuery.length]);
    const clampedCollapsedAnchorCount = Math.min(
        collapsedAnchorCount ?? totalEarlierMessages,
        totalEarlierMessages,
    );
    const visibleAnchorMessages = useMemo(
        () => getVisibleAnchorMessages(filteredMessages, clampedCollapsedAnchorCount),
        [clampedCollapsedAnchorCount, filteredMessages],
    );
    const anchorItems = useMemo(() => {
        const userMessages = visibleAnchorMessages.filter(({ message }) => isMessageAnchorCandidate(message));

        return userMessages.map(({ message }, index) => {
            const preview = getAnchorPreview(message, t('chat.layout.anchorRail'));
            return {
                id: message.id,
                label: preview.label,
                kind: preview.kind,
                sequence: index + 1,
                total: userMessages.length,
                createdAt: message.createdAt,
            };
        });
    }, [t, visibleAnchorMessages]);
    const anchorCount = anchorItems.length;
    const isStreaming = useMemo(
        () => messages.some((message) => Boolean(message.streaming)),
        [messages],
    );
    const statusSummary = useMemo(
        () => buildChatStatusSummary(messages),
        [messages],
    );
    const selectedEdit = useMemo<ChatStatusEditSummary | undefined>(() => {
        const allEdits = statusSummary.allEdits;
        if (allEdits.length === 0) return undefined;
        if (!selectedEditKey) return allEdits[0];
        return allEdits.find((edit) => getChatStatusEditKey(edit) === selectedEditKey) ?? allEdits[0];
    }, [selectedEditKey, statusSummary.allEdits]);
    const activeSelectedEditKey = selectedEdit ? getChatStatusEditKey(selectedEdit) : null;
    const shouldShowDiffPane = Boolean(selectedEdit) && !diffPaneCollapsed;
    const showDiffReopenControl = shouldShowDiffPaneReopenControl({
        diffPaneCollapsed,
        hasSelectedEdit: Boolean(selectedEdit),
    });
    const activeAnchorLabel = useMemo(
        () => {
            const activeAnchor = anchorItems.find((anchor) => anchor.id === activeAnchorId);
            if (activeAnchor) return activeAnchor.label;
            if (anchorItems.length === 0) return undefined;

            const fallbackAnchor = isNearBottom
                ? anchorItems[anchorItems.length - 1]
                : anchorItems[0];
            return fallbackAnchor?.label;
        },
        [activeAnchorId, anchorItems, isNearBottom],
    );

    useEffect(() => {
        if (activeAnchorId && !anchorItems.some((anchor) => anchor.id === activeAnchorId)) {
            setActiveAnchorId(null);
        }
    }, [activeAnchorId, anchorItems]);

    useEffect(() => {
        if (!selectedEdit) {
            setDiffPaneCollapsed(false);
        }
    }, [selectedEdit]);

    const handleMessageNodeRef = useCallback((messageId: string, node: HTMLElement | null) => {
        if (node) {
            messageNodeMapRef.current.set(messageId, node);
            return;
        }

        messageNodeMapRef.current.delete(messageId);
    }, []);

    const resetConversationNavigation = useCallback(() => {
        setSearchQuery('');
        setCollapsedAnchorCount(null);
        setActiveAnchorId(null);
        messageNodeMapRef.current.clear();
        isNearBottomRef.current = true;
        setIsNearBottom(true);
    }, []);

    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        setActiveAnchorId(null);

        if (value.trim()) {
            requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({top: 0, behavior: 'smooth'});
            });
        }
    }, []);

    const handleClear = () => {
        resetConversationNavigation();
        void clear();
    };

    const handleSessionSelect = useCallback((session: SessionMeta) => {
        const sessionKey = getSessionSelectionKey(session);
        const activeSessionKey = activeSession ? getSessionSelectionKey(activeSession) : null;
        if (pendingSessionKey === sessionKey || activeSessionKey === sessionKey) {
            return;
        }

        resetConversationNavigation();
        void loadSession(session);
    }, [activeSession, loadSession, pendingSessionKey, resetConversationNavigation]);

    const handleNewSession = useCallback((cwd?: string | null) => {
        resetConversationNavigation();
        void startNewSession(cwd ?? currentCwd);
    }, [currentCwd, resetConversationNavigation, startNewSession]);

    const handleSelectedEditChange = useCallback((edit: ChatStatusEditSummary) => {
        setSelectedEditKey(getChatStatusEditKey(edit));
        setDiffPaneCollapsed(false);
    }, []);

    const startPaneResize = useCallback((
        edge: 'conversation-diff' | 'diff-status' | 'conversation-status',
        event: ReactPointerEvent<HTMLButtonElement>,
    ) => {
        if (event.button !== 0) return;
        event.preventDefault();
        paneResizeCleanupRef.current?.();

        const startX = event.clientX;
        const startConversationWidth = conversationPaneWidth;
        const startDiffWidth = diffPaneWidth;
        const startStatusWidth = statusPaneWidth;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const rawDelta = moveEvent.clientX - startX;

            if (edge === 'conversation-diff') {
                const next = getPaneWidthsAfterResize(
                    rawDelta,
                    startConversationWidth,
                    startDiffWidth,
                    CONVERSATION_PANE_MIN_WIDTH,
                    CONVERSATION_PANE_MAX_WIDTH,
                    DIFF_PANE_MIN_WIDTH,
                    DIFF_PANE_MAX_WIDTH,
                );
                setConversationPaneWidth(next.leftWidth);
                setDiffPaneWidth(next.rightWidth);
                return;
            }

            if (edge === 'diff-status') {
                const next = getPaneWidthsAfterResize(
                    rawDelta,
                    startDiffWidth,
                    startStatusWidth,
                    DIFF_PANE_MIN_WIDTH,
                    DIFF_PANE_MAX_WIDTH,
                    STATUS_PANE_MIN_WIDTH,
                    STATUS_PANE_MAX_WIDTH,
                );
                setDiffPaneWidth(next.leftWidth);
                setStatusPaneWidth(next.rightWidth);
                return;
            }

            const next = getPaneWidthsAfterResize(
                rawDelta,
                startConversationWidth,
                startStatusWidth,
                CONVERSATION_PANE_MIN_WIDTH,
                CONVERSATION_PANE_MAX_WIDTH,
                STATUS_PANE_MIN_WIDTH,
                STATUS_PANE_MAX_WIDTH,
            );
            setConversationPaneWidth(next.leftWidth);
            setStatusPaneWidth(next.rightWidth);
        };

        const cleanup = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', cleanup);
            document.removeEventListener('pointercancel', cleanup);
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            paneResizeCleanupRef.current = null;
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', cleanup);
        document.addEventListener('pointercancel', cleanup);
        paneResizeCleanupRef.current = cleanup;
    }, [conversationPaneWidth, diffPaneWidth, statusPaneWidth]);

    const scrollToBottom = () => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;

        scrollEl.scrollTo({top: scrollEl.scrollHeight, behavior: 'smooth'});
        isNearBottomRef.current = true;
        setIsNearBottom(true);
    };

    const scrollToTop = () => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;

        scrollEl.scrollTo({top: 0, behavior: 'smooth'});
        isNearBottomRef.current = false;
        setIsNearBottom(false);
    };

    return (
        <div className="flex flex-col h-full">
            {/* 头部：daemon 状态 + 依赖 + 清空 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
                <div className="flex items-center gap-1.5 text-xs">
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${
                            daemonReady ? 'bg-success' : 'bg-warning'
                        }`}
                    />
                    <span className="text-base-content/60">
                        {daemonReady ? t('chat.ready') : daemonStatus || t('chat.starting')}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className={`btn btn-ghost btn-sm ${sdkMissing ? 'text-warning' : ''}`}
                        onClick={() => setSdkModalOpen(true)}
                    >
                        <Package size={16}/>
                        {t('chat.sdk.manage')}
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleClear}
                        disabled={messages.length === 0}
                    >
                        <Trash2 size={16}/>
                        {t('chat.clear')}
                    </button>
                </div>
            </div>

            {/* 缺少 SDK 提示条 */}
            {sdkMissing && (
                <div className="px-4 pt-3">
                    <div className="alert alert-warning py-2 text-sm flex items-center justify-between">
                        <span>{t('chat.sdk.missingBanner', {name: currentSdk?.displayName})}</span>
                        <button
                            className="btn btn-sm btn-warning"
                            onClick={() => setSdkModalOpen(true)}
                        >
                            {t('chat.sdk.install')}
                        </button>
                    </div>
                </div>
            )}

            {/* 消息区：预留 cc-gui 风格的搜索、锚点和状态扩展槽 */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden bg-base-200/20">
                <ChatSessionSidebar
                    activeSession={activeSession}
                    currentCwd={currentCwd}
                    pendingSessionKey={pendingSessionKey}
                    onSessionSelect={handleSessionSelect}
                    onNewSession={handleNewSession}
                />

                <MessageAnchorRail
                    hasMessages={hasMessages}
                    anchors={anchorItems}
                    activeAnchorId={activeAnchorId}
                    activeAnchorLabel={activeAnchorLabel}
                    containerRef={scrollRef}
                    messageNodeMap={messageNodeMapRef}
                    onActiveAnchorChange={setActiveAnchorId}
                    onScrollToTop={scrollToTop}
                    onScrollToBottom={scrollToBottom}
                />

                <div className="chat-review-layout">
                    <section
                        className="chat-conversation-pane"
                        style={{flex: `1 1 ${conversationPaneWidth}px`}}
                    >
                        <ConversationSearch ref={searchInputRef} value={searchQuery} onChange={handleSearchChange} />

                        <div
                            ref={scrollRef}
                            className="flex-1 scroll-pb-8 overflow-y-auto px-2 py-3 sm:px-3"
                            onScroll={updateBottomState}
                        >
                            {!hasMessages && (
                                <div className="flex h-full flex-col items-center justify-center text-base-content/40">
                                    <p className="text-sm">{t('chat.empty')}</p>
                                </div>
                            )}
                            <MessageList
                                messages={messages}
                                searchQuery={searchQuery}
                                scrollContainerRef={scrollRef}
                                onCollapsedCountChange={setCollapsedAnchorCount}
                                onMessageNodeRef={handleMessageNodeRef}
                            />
                        </div>

                        <ScrollControl
                            visible={hasMessages && !isNearBottom}
                            onScrollToBottom={scrollToBottom}
                        />

                        {/* 发送控制台：约束在中间对话列，避免横跨会话栏/状态栏 */}
                        <ChatComposer
                            sdkMissing={sdkMissing}
                            onSdkMissing={() => setSdkModalOpen(true)}
                            cwd={currentCwd ?? undefined}
                        />
                    </section>

                    {shouldShowDiffPane && (
                        <>
                            <button
                                type="button"
                                className="chat-pane-resizer hidden xl:flex"
                                title={t('chat.layout.resizeConversationDiff')}
                                aria-label={t('chat.layout.resizeConversationDiff')}
                                onPointerDown={(event) => startPaneResize('conversation-diff', event)}
                            />

                            <section
                                className="chat-diff-pane-shell hidden xl:flex"
                                style={{flex: `1 1 ${diffPaneWidth}px`}}
                            >
                                <ChatDiffReviewPane
                                    edit={selectedEdit}
                                    mode={diffViewMode}
                                    wrapLines={diffWrapLines}
                                    currentCwd={currentCwd}
                                    onModeChange={setDiffViewMode}
                                    onWrapLinesChange={setDiffWrapLines}
                                    onCollapse={() => setDiffPaneCollapsed(true)}
                                />
                            </section>

                            <button
                                type="button"
                                className="chat-pane-resizer hidden xl:flex"
                                title={t('chat.layout.resizeDiffStatus')}
                                aria-label={t('chat.layout.resizeDiffStatus')}
                                onPointerDown={(event) => startPaneResize('diff-status', event)}
                            />
                        </>
                    )}

                    {!shouldShowDiffPane && (
                        <button
                            type="button"
                            className="chat-pane-resizer hidden xl:flex"
                            title={t('chat.layout.resizeConversationStatus')}
                            aria-label={t('chat.layout.resizeConversationStatus')}
                            onPointerDown={(event) => startPaneResize('conversation-status', event)}
                        />
                    )}

                    <div
                        className="chat-status-pane-shell hidden xl:block"
                        style={{flex: `0 0 ${statusPaneWidth}px`, width: statusPaneWidth}}
                    >
                        <StatusPanel
                            provider={provider}
                            messageCount={renderableMessageCount}
                            daemonReady={daemonReady}
                            anchorCount={anchorCount}
                            activeAnchorLabel={activeAnchorLabel}
                            currentCwd={currentCwd}
                            isStreaming={isStreaming}
                            statusSummary={statusSummary}
                            selectedEditKey={activeSelectedEditKey}
                            isDiffPaneCollapsed={diffPaneCollapsed}
                            diffViewMode={diffViewMode}
                            onSelectedEditChange={handleSelectedEditChange}
                            onOpenDiffPanel={() => setDiffPaneCollapsed(false)}
                            onDiffViewModeChange={setDiffViewMode}
                        />
                    </div>

                    {showDiffReopenControl && (
                        <button
                            type="button"
                            className="chat-diff-pane-reopen-floating"
                            title={t('chat.layout.expandDiffPanel')}
                            aria-label={t('chat.layout.expandDiffPanel')}
                            onClick={() => setDiffPaneCollapsed(false)}
                        >
                            <PanelRightOpen size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="px-4 pb-2">
                    <div className="alert alert-error py-2 text-sm">{error}</div>
                </div>
            )}

            {/* SDK 依赖管理弹窗 */}
            <ModalDialog
                isOpen={sdkModalOpen}
                title={t('chat.sdk.title')}
                maxWidthClass="max-w-lg"
                confirmText={t('common.close')}
                onConfirm={() => setSdkModalOpen(false)}
                onClose={() => setSdkModalOpen(false)}
            >
                <SdkDependencyPanel/>
            </ModalDialog>

            {/* AskUserQuestion 权限请求弹窗 */}
            {pendingAskUserQuestion && (
                <AskUserQuestionDialog
                    request={pendingAskUserQuestion}
                    onAnswer={(answers) =>
                        answerAskUserQuestion(pendingAskUserQuestion.requestId, answers)
                    }
                    onCancel={() => answerAskUserQuestion(pendingAskUserQuestion.requestId, {})}
                />
            )}

            {/* PlanApproval 权限请求弹窗 */}
            {pendingPlanApproval && (
                <PlanApprovalDialog
                    request={pendingPlanApproval}
                    onApprove={(approved, targetMode) =>
                        approvePlan(pendingPlanApproval.requestId, approved, targetMode)
                    }
                    onCancel={() => approvePlan(pendingPlanApproval.requestId, false, 'default')}
                />
            )}

            {/* 普通工具权限请求弹窗 */}
            {pendingToolPermission && (
                <ToolPermissionDialog
                    request={pendingToolPermission}
                    onAnswer={(allow) => answerToolPermission(pendingToolPermission.requestId, allow)}
                />
            )}
        </div>
    );
}
