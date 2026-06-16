import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Square, Trash2, Loader2, Package } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useSdkStore } from '../stores/useSdkStore';
import SdkDependencyPanel from '../components/chat/SdkDependencyPanel';
import AskUserQuestionDialog from '../components/chat/AskUserQuestionDialog';
import PlanApprovalDialog from '../components/chat/PlanApprovalDialog';
import ContentBlockRenderer from '../components/chat/ContentBlockRenderer';
import ModalDialog from '../components/common/ModalDialog';
import type { ChatMessage } from '../types/chat';

/**
 * 交互式对话页 —— 对接 ai-bridge daemon（Claude Code / Codex）。
 *
 * 这是集成的最小可用前端：发送消息、流式渲染回复、中止、清空。
 * 工具调用可视化、Diff、权限审批将在后续任务中补充。
 */
export default function ChatPage() {
    const { t } = useTranslation();
    const {
        messages,
        provider,
        daemonReady,
        daemonStatus,
        activeRequestId,
        error,
        pendingAskUserQuestion,
        pendingPlanApproval,
        init,
        setProvider,
        send,
        abort,
        clear,
        answerAskUserQuestion,
        approvePlan,
    } = useChatStore();

    const [input, setInput] = useState('');
    const [sdkModalOpen, setSdkModalOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const sdkStatuses = useSdkStore((s) => s.statuses);
    const sdkInit = useSdkStore((s) => s.init);

    useEffect(() => {
        init();
        sdkInit();
    }, [init, sdkInit]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const isStreaming = activeRequestId !== null;

    // 当前 provider 对应的 SDK 是否已安装。
    const sdkId = provider === 'claude' ? 'claude-sdk' : 'codex-sdk';
    const currentSdk = sdkStatuses.find((s) => s.id === sdkId);
    const sdkMissing = currentSdk ? !currentSdk.installed : false;

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;
        if (sdkMissing) {
            setSdkModalOpen(true);
            return;
        }
        const text = input;
        setInput('');
        await send(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* 头部：provider 切换 + daemon 状态 + 清空 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
                <div className="flex items-center gap-3">
                    <div className="tabs tabs-boxed tabs-sm">
                        <button
                            className={`tab ${provider === 'claude' ? 'tab-active' : ''}`}
                            onClick={() => setProvider('claude')}
                        >
                            Claude
                        </button>
                        <button
                            className={`tab ${provider === 'codex' ? 'tab-active' : ''}`}
                            onClick={() => setProvider('codex')}
                        >
                            Codex
                        </button>
                    </div>
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
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className={`btn btn-ghost btn-sm ${sdkMissing ? 'text-warning' : ''}`}
                        onClick={() => setSdkModalOpen(true)}
                    >
                        <Package size={16} />
                        {t('chat.sdk.manage')}
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={clear}
                        disabled={messages.length === 0}
                    >
                        <Trash2 size={16} />
                        {t('chat.clear')}
                    </button>
                </div>
            </div>

            {/* 缺少 SDK 提示条 */}
            {sdkMissing && (
                <div className="px-4 pt-3">
                    <div className="alert alert-warning py-2 text-sm flex items-center justify-between">
                        <span>{t('chat.sdk.missingBanner', { name: currentSdk?.displayName })}</span>
                        <button
                            className="btn btn-sm btn-warning"
                            onClick={() => setSdkModalOpen(true)}
                        >
                            {t('chat.sdk.install')}
                        </button>
                    </div>
                </div>
            )}

            {/* 消息区 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                        <p className="text-sm">{t('chat.empty')}</p>
                    </div>
                )}
                {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                ))}
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="px-4 pb-2">
                    <div className="alert alert-error py-2 text-sm">{error}</div>
                </div>
            )}

            {/* 输入区 */}
            <div className="border-t border-base-300 p-3">
                <div className="flex items-end gap-2">
                    <textarea
                        className="textarea textarea-bordered flex-1 resize-none min-h-[44px] max-h-40"
                        rows={1}
                        placeholder={t('chat.placeholder')}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {isStreaming ? (
                        <button className="btn btn-error" onClick={abort}>
                            <Square size={16} />
                            {t('chat.stop')}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleSend}
                            disabled={!input.trim()}
                        >
                            <Send size={16} />
                            {t('chat.send')}
                        </button>
                    )}
                </div>
            </div>

            {/* SDK 依赖管理弹窗 */}
            <ModalDialog
                isOpen={sdkModalOpen}
                title={t('chat.sdk.title')}
                maxWidthClass="max-w-lg"
                confirmText={t('common.close')}
                onConfirm={() => setSdkModalOpen(false)}
                onClose={() => setSdkModalOpen(false)}
            >
                <SdkDependencyPanel />
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

function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    const hasBlocks = message.raw?.message?.content && message.raw.message.content.length > 0;

    return (
        <div className={`chat ${isUser ? 'chat-end' : 'chat-start'}`}>
            <div
                className={`chat-bubble whitespace-pre-wrap break-words ${
                    isUser ? 'chat-bubble-primary' : ''
                } ${message.error ? 'chat-bubble-error' : ''}`}
            >
                {hasBlocks ? (
                    <ContentBlockRenderer
                        blocks={message.raw!.message.content}
                    />
                ) : (
                    message.content || (message.streaming ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : null)
                )}
                {message.error && (
                    <div className="text-xs opacity-70 mt-1">{message.error}</div>
                )}
            </div>
        </div>
    );
}
