import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Package, Trash2} from 'lucide-react';
import {useChatStore} from '../stores/useChatStore';
import {useSdkStore} from '../stores/useSdkStore';
import SdkDependencyPanel from '../components/chat/SdkDependencyPanel';
import AskUserQuestionDialog from '../components/chat/AskUserQuestionDialog';
import PlanApprovalDialog from '../components/chat/PlanApprovalDialog';
import MessageList from '../components/chat/MessageList';
import ConversationSearch from '../components/chat/ConversationSearch';
import MessageAnchorRail from '../components/chat/MessageAnchorRail';
import ScrollControl from '../components/chat/ScrollControl';
import StatusPanel from '../components/chat/StatusPanel';
import {ChatComposer} from '../components/chat/composer/ChatComposer';
import ModalDialog from '../components/common/ModalDialog';
import {shouldRenderChatMessage} from '../utils/chatMessageFlow';

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
        daemonReady,
        daemonStatus,
        error,
        pendingAskUserQuestion,
        pendingPlanApproval,
        init,
        clear,
        answerAskUserQuestion,
        approvePlan,
    } = useChatStore();

    const [sdkModalOpen, setSdkModalOpen] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isNearBottomRef = useRef(true);

    const sdkStatuses = useSdkStore((s) => s.statuses);
    const sdkInit = useSdkStore((s) => s.init);

    useEffect(() => {
        void init();
        void sdkInit();
    }, [init, sdkInit]);

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
    const renderableMessageCount = useMemo(
        () => messages.filter((message) => shouldRenderChatMessage(message)).length,
        [messages],
    );

    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);

        if (value.trim()) {
            requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({top: 0, behavior: 'smooth'});
            });
        }
    }, []);

    const handleClear = () => {
        setSearchQuery('');
        isNearBottomRef.current = true;
        setIsNearBottom(true);
        clear();
    };

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
                <MessageAnchorRail
                    hasMessages={hasMessages}
                    onScrollToTop={scrollToTop}
                    onScrollToBottom={scrollToBottom}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                    <ConversationSearch ref={searchInputRef} value={searchQuery} onChange={handleSearchChange} />

                    <div
                        ref={scrollRef}
                        className="flex-1 scroll-pb-8 overflow-y-auto px-3 py-5 sm:px-4"
                        onScroll={updateBottomState}
                    >
                        {!hasMessages && (
                            <div className="flex h-full flex-col items-center justify-center text-base-content/40">
                                <p className="text-sm">{t('chat.empty')}</p>
                            </div>
                        )}
                        <MessageList messages={messages} searchQuery={searchQuery} />
                    </div>

                    <ScrollControl
                        visible={hasMessages && !isNearBottom}
                        onScrollToBottom={scrollToBottom}
                    />
                </div>

                <StatusPanel
                    provider={provider}
                    messageCount={renderableMessageCount}
                    daemonReady={daemonReady}
                />
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="px-4 pb-2">
                    <div className="alert alert-error py-2 text-sm">{error}</div>
                </div>
            )}

            {/* 发送控制台（顶部上下文栏 + 富输入 + 底部工具栏） */}
            <ChatComposer
                sdkMissing={sdkMissing}
                onSdkMissing={() => setSdkModalOpen(true)}
            />

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
        </div>
    );
}
