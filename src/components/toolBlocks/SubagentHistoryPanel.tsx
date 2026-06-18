import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
    ArrowUpRight,
    Bot,
    FileCode2,
    Globe,
    History,
    ListTree,
    Loader2,
    Pencil,
    Search,
    Terminal,
    Wrench
} from 'lucide-react';
import ContentBlockRenderer from '../chat/ContentBlockRenderer';
import type {ChatMessage, ToolResultBlock} from '../../types/chat';
import type {UnifiedSessionMessage} from '../../types/session';
import {findToolResult, getRenderableContentBlocks, shouldRenderChatMessage} from '../../utils/chatMessageFlow';
import {loadClaudeSubagentHistory} from '../../services/subagentHistoryService';
import {useChatStore} from '../../stores/useChatStore';
import {openFile} from '../../utils/bridge';
import {
    buildSubagentProcessModel,
    extractSubagentResultRuntimeMeta,
    resolveSubagentHistoryRequest,
    summarizeSubagentProcessToolCall,
} from './subagentHistoryUtils';
import {formatLineRange} from '../../utils/toolPresentation';

interface SubagentHistoryPanelProps {
    agentId?: string | null;
    description?: string | null;
    enabled: boolean;
    hasVisibleMeta?: boolean;
    result?: ToolResultBlock | null;
}

interface SubagentProcessSummaryProps {
    agentId?: string | null;
    requestSessionId?: string | null;
    currentCwd: string | null;
    process: ReturnType<typeof buildSubagentProcessModel>;
}

function normalizeHistoryRole(role: string): ChatMessage['role'] {
    if (role === 'user' || role === 'assistant' || role === 'system') {
        return role;
    }
    return 'system';
}

function mapHistoryMessage(
    sessionId: string,
    message: UnifiedSessionMessage,
    index: number,
): ChatMessage {
    const parsedTime = message.ts ? Date.parse(message.ts) : NaN;
    return {
        id: `subagent-${sessionId}-${index}`,
        role: normalizeHistoryRole(message.role),
        content: message.content,
        raw: message.raw ?? undefined,
        createdAt: Number.isFinite(parsedTime) ? parsedTime : index,
    };
}

function hasRenderableHistory(messages: ChatMessage[]): boolean {
    return messages.some(shouldRenderChatMessage);
}

function formatStatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

function formatTokenStat(t: ReturnType<typeof useTranslation>['t'], value: number): string {
    const label = t('tools.subagentProcessTokens', { count: 0 });
    const suffix = label.replace(/\s*0[\s,.-]*/u, '').trim() || 'tokens';
    return `${formatStatNumber(value)} ${suffix}`;
}

function getSubagentToolIcon(iconKind: ReturnType<typeof summarizeSubagentProcessToolCall>['iconKind']) {
    switch (iconKind) {
        case 'command':
            return Terminal;
        case 'search':
            return Search;
        case 'read':
            return FileCode2;
        case 'list':
            return ListTree;
        case 'patch':
            return Pencil;
        case 'web':
            return Globe;
        case 'agent':
            return Bot;
        default:
            return Wrench;
    }
}

export function SubagentProcessSummary({
    agentId,
    requestSessionId,
    currentCwd,
    process,
}: SubagentProcessSummaryProps) {
    const { t } = useTranslation();

    if (!(process.thought || process.readFiles.length > 0 || process.toolCalls.length > 0 || process.finalSummary)) {
        return null;
    }

    return (
        <div className="subagent-process-card">
            <div className="subagent-process-header">
                <div>
                    <div className="subagent-process-title">{t('tools.subagentProcessTitle')}</div>
                    {(agentId || requestSessionId) && (
                        <div className="subagent-process-subtitle">
                            {agentId || requestSessionId}
                        </div>
                    )}
                </div>
                <div className="subagent-process-stats">
                    {[
                        process.totalDurationMs != null ? t('tools.subagentProcessDuration', { count: process.totalDurationMs }) : null,
                        process.toolUseCount > 0 ? t('tools.subagentProcessTools', { count: process.toolUseCount }) : null,
                        process.readFiles.length > 0 ? t('tools.subagentProcessFiles', { count: process.readFiles.length }) : null,
                        process.totalTokens != null ? formatTokenStat(t, process.totalTokens) : null,
                    ].filter(Boolean).join(' · ')}
                </div>
            </div>

            <div className="subagent-process-sections">
                {process.thought && (
                    <section className="subagent-process-section">
                        <div className="subagent-section-heading">{t('tools.subagentProcessThinking')}</div>
                        <div className="subagent-note-card">{process.thought}</div>
                    </section>
                )}

                {process.readFiles.length > 0 && (
                    <section className="subagent-process-section">
                        <div className="subagent-section-heading">
                            {t('tools.subagentProcessFilesRead', { count: process.readFiles.length })}
                        </div>
                        <div className="subagent-file-grid">
                            {process.readFiles.map((file) => (
                                <button
                                    key={file.id}
                                    type="button"
                                    className="subagent-file-chip clickable-file"
                                    title={t('tools.subagentProcessOpenFile', { file: file.displayPath })}
                                    aria-label={t('tools.subagentProcessOpenFile', { file: file.displayPath })}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void openFile(file.openPath, file.lineStart, file.lineEnd, currentCwd);
                                    }}
                                >
                                    <FileCode2 className="subagent-chip-icon" aria-hidden="true" />
                                        <span className="subagent-chip-body">
                                            <span className="subagent-chip-text">{file.displayPath}</span>
                                            {file.lineStart && (
                                                <span className="subagent-chip-meta">
                                                    {formatLineRange({ start: file.lineStart, end: file.lineEnd })}
                                                </span>
                                            )}
                                        </span>
                                    <ArrowUpRight className="subagent-chip-action-icon" aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {process.toolCalls.length > 0 && (
                    <section className="subagent-process-section">
                        <div className="subagent-section-heading">{t('tools.subagentProcessOtherTools')}</div>
                        <div className="subagent-tool-list">
                            {process.toolCalls.map((tool) => {
                                const presentation = summarizeSubagentProcessToolCall(tool);
                                const Icon = getSubagentToolIcon(presentation.iconKind);
                                const interactiveTarget = tool.resultFile ?? tool.target;
                                const hasTarget = Boolean(interactiveTarget);
                                const detailText = tool.detail?.trim();
                                const resultSummaryText = tool.resultSummary?.trim();
                                const showDetail = Boolean(
                                    detailText
                                    && detailText !== presentation.summary
                                    && detailText !== interactiveTarget?.displayPath,
                                ) || Boolean(
                                    detailText
                                    && interactiveTarget
                                    && detailText === presentation.summary
                                );
                                const showResultSummary = Boolean(
                                    resultSummaryText
                                    && resultSummaryText !== presentation.summary
                                    && resultSummaryText !== interactiveTarget?.displayPath
                                    && resultSummaryText !== detailText,
                                );
                                const isJsonLikeDetail = Boolean(
                                    tool.detail?.trim().startsWith('{')
                                    || tool.resultSummary?.trim().startsWith('{')
                                );

                                return (
                                    <div key={tool.id} className="subagent-tool-row">
                                        <div className="subagent-tool-row-main">
                                            <Icon className="subagent-chip-icon" aria-hidden="true" />
                                            <span className={`tool-command-chip ${presentation.accentClass}`}>
                                                {presentation.label}
                                            </span>
                                            <span className="subagent-tool-row-name" title={tool.name}>
                                                {tool.name}
                                            </span>
                                            {hasTarget ? (
                                                <button
                                                    type="button"
                                                    className="subagent-tool-row-target clickable-file"
                                                    title={t('tools.subagentProcessOpenFile', { file: interactiveTarget?.displayPath ?? presentation.summary })}
                                                    aria-label={t('tools.subagentProcessOpenFile', { file: interactiveTarget?.displayPath ?? presentation.summary })}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        if (!interactiveTarget) {
                                                            return;
                                                        }
                                                        void openFile(
                                                            interactiveTarget.openPath,
                                                            interactiveTarget.lineStart,
                                                            interactiveTarget.lineEnd,
                                                            currentCwd,
                                                        );
                                                    }}
                                                >
                                                    <span className="subagent-tool-row-summary" title={interactiveTarget?.displayPath ?? presentation.summary}>
                                                        {interactiveTarget?.displayPath ?? presentation.summary}
                                                    </span>
                                                    {interactiveTarget?.lineStart && (
                                                        <span className="subagent-chip-meta">
                                                            {formatLineRange({ start: interactiveTarget.lineStart, end: interactiveTarget.lineEnd })}
                                                        </span>
                                                    )}
                                                    <ArrowUpRight className="subagent-chip-action-icon" aria-hidden="true" />
                                                </button>
                                            ) : (
                                                <span className="subagent-tool-row-summary" title={presentation.summary}>
                                                    {presentation.summary}
                                                </span>
                                            )}
                                        </div>
                                        {showDetail && (
                                            <small className="subagent-tool-row-detail" title={tool.detail}>
                                                {tool.detail}
                                            </small>
                                        )}
                                        {showResultSummary && !isJsonLikeDetail && (
                                            <small className="subagent-tool-row-detail" title={tool.resultSummary}>
                                                {tool.resultSummary}
                                            </small>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {process.finalSummary && (
                    <section className="subagent-process-section">
                        <div className="subagent-section-heading">{t('tools.subagentProcessResult')}</div>
                        <div className="subagent-result-card">{process.finalSummary}</div>
                        {process.fullResultText && (
                            <details className="subagent-result">
                                <summary>{t('tools.subagentProcessShowFullOutput')}</summary>
                                <pre>{process.fullResultText}</pre>
                            </details>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}

export default function SubagentHistoryPanel({
    agentId,
    description,
    enabled,
    hasVisibleMeta = false,
    result,
}: SubagentHistoryPanelProps) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const activeProvider = useChatStore((state) => state.activeSession?.providerId ?? state.provider);
    const sessionId = useChatStore((state) => state.sessionId);
    const sourcePath = useChatStore((state) => state.activeSession?.sourcePath ?? null);
    const currentCwd = useChatStore((state) => state.currentCwd);
    const historyRequest = resolveSubagentHistoryRequest({
        sessionId,
        sourcePath,
        currentCwd,
        agentId,
        description,
    });
    const {
        requestSessionId,
        requestSourcePath,
        canLoad: canLoadHistory,
    } = historyRequest;
    const runtimeMeta = extractSubagentResultRuntimeMeta(result);
    const process = buildSubagentProcessModel(messages, runtimeMeta);

    useEffect(() => {
        setMessages([]);
        setLoaded(false);
        setError(null);
    }, [agentId, description, sessionId, sourcePath, currentCwd]);

    useEffect(() => {
        if (!enabled || loaded || loading) {
            return;
        }
        if (activeProvider !== 'claude') {
            setLoaded(true);
            return;
        }
        if (!canLoadHistory) {
            setLoaded(true);
            return;
        }

        const resolvedRequestSessionId = requestSessionId ?? 'subagent';
        let cancelled = false;
        setLoading(true);
        setError(null);

        void loadClaudeSubagentHistory({
            sourcePath: requestSourcePath ?? undefined,
            sessionId: resolvedRequestSessionId,
            agentId,
            description,
        })
            .then((history) => {
                if (cancelled) {
                    return;
                }
                setMessages(history.map((message, index) => mapHistoryMessage(resolvedRequestSessionId, message, index)));
                setLoaded(true);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                setLoaded(true);
                setError(String(err));
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeProvider, agentId, canLoadHistory, description, enabled, loaded, loading, requestSessionId, requestSourcePath]);

    if (loading) {
        return (
            <div className="agent-history-placeholder agent-history-placeholder-inline">
                <div className="agent-history-placeholder-text">
                    <Loader2 className="agent-history-placeholder-icon animate-spin" aria-hidden="true" />
                    <span>{t('tools.subagentHistoryLoading')}</span>
                </div>
            </div>
        );
    }

    if (activeProvider !== 'claude') {
        return (
            <div className="agent-history-placeholder agent-history-placeholder-inline">
                <div className="agent-history-placeholder-text">
                    <History className="agent-history-placeholder-icon" aria-hidden="true" />
                    <span>{t('tools.subagentHistory')}</span>
                </div>
                <div className="agent-history-placeholder-note">
                    {t('tools.subagentHistoryUnavailable')}
                </div>
            </div>
        );
    }

    if (!canLoadHistory) {
        return (
            <div className="agent-history-placeholder agent-history-placeholder-inline">
                <div className="agent-history-placeholder-text">
                    <History className="agent-history-placeholder-icon" aria-hidden="true" />
                    <span>{t('tools.subagentHistory')}</span>
                </div>
                <div className="agent-history-placeholder-note">
                    {hasVisibleMeta ? t('tools.subagentHistoryUnavailable') : t('tools.subagentHistoryPendingEmpty')}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="agent-history-placeholder agent-history-placeholder-inline">
                <div className="agent-history-placeholder-text">
                    <History className="agent-history-placeholder-icon" aria-hidden="true" />
                    <span>{t('tools.subagentHistory')}</span>
                </div>
                <div className="agent-history-placeholder-note text-error" title={error}>
                    {t('tools.subagentHistoryLoadFailed')}
                </div>
            </div>
        );
    }

    if (loaded && !hasRenderableHistory(messages)) {
        return (
            <div className="agent-history-placeholder agent-history-placeholder-inline">
                <div className="agent-history-placeholder-text">
                    <History className="agent-history-placeholder-icon" aria-hidden="true" />
                    <span>{t('tools.subagentHistory')}</span>
                </div>
                <div className="agent-history-placeholder-note">
                    {t('tools.subagentHistoryEmpty')}
                </div>
            </div>
        );
    }

    return (
        <div className="tool-section">
            <div className="tool-section-label">{t('tools.subagentHistory')}:</div>
            <SubagentProcessSummary
                agentId={agentId}
                requestSessionId={requestSessionId}
                currentCwd={currentCwd}
                process={process}
            />
            <div className="space-y-3">
                {messages.map((message, messageIndex) => {
                    if (!shouldRenderChatMessage(message)) {
                        return null;
                    }
                    const blocks = getRenderableContentBlocks(message.raw);
                    if (blocks.length > 0) {
                        return (
                            <div key={message.id} className="agent-history-message assistant-message-flow">
                                <ContentBlockRenderer
                                    blocks={blocks}
                                    findToolResult={(toolId) => findToolResult(messages, toolId, messageIndex)}
                                    compact
                                />
                            </div>
                        );
                    }

                    if (!message.content.trim()) {
                        return null;
                    }

                    return (
                        <div key={message.id} className="agent-history-message">
                            <div className="task-field-content task-prompt">{message.content}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
