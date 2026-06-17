import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {AlertTriangle, Bot, Check, Copy, User} from 'lucide-react';
import type {ChatMessage, ContentBlock, TextBlock, ThinkingBlock} from '../../types/chat';
import {cn} from '../../utils/cn';
import {findToolResult, getRenderableContentBlocks, shouldRenderChatMessage,} from '../../utils/chatMessageFlow';
import ContentBlockRenderer from './ContentBlockRenderer';
import MarkdownBlock from './MarkdownBlock';
import MessageMeta from './MessageMeta';
import StreamingPlaceholder from './StreamingPlaceholder';

interface MessageItemProps {
    message: ChatMessage;
    messages: ChatMessage[];
    messageIndex: number;
    isLast: boolean;
    isSearchMatch?: boolean;
}

function isTextBlock(block: ContentBlock): block is TextBlock {
    return block.type === 'text';
}

function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
    return block.type === 'thinking';
}

function getCopyText(message: ChatMessage, blocks: ContentBlock[]): string {
    if (message.content.trim()) return message.content;

    return blocks
        .map((block) => {
            if (isTextBlock(block)) return block.text;
            if (isThinkingBlock(block)) return block.thinking;
            if (block.type === 'tool_use') return `${block.name} ${JSON.stringify(block.input, null, 2)}`;
            return '';
        })
        .filter((text) => text.trim().length > 0)
        .join('\n\n');
}

function getLastThinkingBlockIndex(blocks: ContentBlock[]): number | undefined {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
        if (isThinkingBlock(blocks[index])) return index;
    }

    return undefined;
}

export default function MessageItem({
    message,
    messages,
    messageIndex,
    isLast,
    isSearchMatch = false,
}: MessageItemProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const copyTimerRef = useRef<number | null>(null);

    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const blocks = useMemo(() => getRenderableContentBlocks(message.raw), [message.raw]);
    const hasBlocks = blocks.length > 0;
    const copyText = useMemo(() => getCopyText(message, blocks), [message, blocks]);
    const expandedThinkingBlockIndex = useMemo(
        () => (isAssistant && isLast && message.streaming ? getLastThinkingBlockIndex(blocks) : undefined),
        [blocks, isAssistant, isLast, message.streaming],
    );
    const isEmptyStreamingPlaceholder = isAssistant
        && isLast
        && Boolean(message.streaming)
        && !message.content.trim()
        && !hasBlocks;

    useEffect(() => () => {
        if (copyTimerRef.current !== null) {
            window.clearTimeout(copyTimerRef.current);
        }
    }, []);

    if (!shouldRenderChatMessage(message)) {
        return null;
    }

    const time = new Date(message.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    const roleLabel = isUser
        ? t('chat.message.user')
        : isAssistant
            ? t('chat.message.assistant')
            : t('chat.message.system');

    const handleCopy = async () => {
        if (!copyText.trim()) return;

        try {
            await navigator.clipboard.writeText(copyText);
            setCopied(true);
            if (copyTimerRef.current !== null) {
                window.clearTimeout(copyTimerRef.current);
            }
            copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
        } catch (e) {
            console.error('[MessageItem] Copy failed:', e);
        }
    };

    return (
        <article
            className={cn(
                'group relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border px-4 py-3 pl-5 shadow-sm transition-all hover:border-base-content/20 hover:shadow-md',
                isUser
                    ? 'border-orange-100 bg-orange-50/60 dark:border-orange-500/20 dark:bg-orange-500/10'
                    : 'border-gray-100 bg-white/95 dark:border-base-200 dark:bg-base-100/95',
                isSearchMatch && 'border-primary/35 bg-primary/5 shadow-md ring-1 ring-primary/15',
                message.error && 'border-error/30 bg-error/5 dark:border-error/40 dark:bg-error/10',
            )}
        >
            <div
                className={cn(
                    'absolute inset-y-0 left-0 w-1',
                    isUser ? 'bg-orange-400/70' : 'bg-base-content/10',
                    message.error && 'bg-error/70',
                )}
            />

            <header className="mb-2 flex items-start justify-between gap-3 text-xs text-base-content/50">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full shadow-sm',
                            isUser
                                ? 'bg-orange-500 text-white'
                                : 'bg-base-200 text-base-content/70 dark:bg-base-300',
                        )}
                    >
                        {isUser ? <User size={14} /> : <Bot size={14} />}
                    </span>
                    <span className="font-medium text-base-content/70">{roleLabel}</span>
                    <span>{time}</span>
                    {isAssistant && message.streaming && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                            {t('chat.message.streamingConnected')}
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    className={cn(
                        'btn btn-ghost btn-xs min-h-0 h-7 px-2 opacity-0 transition-opacity',
                        'group-hover:opacity-100 focus:opacity-100',
                        copied && 'opacity-100 text-success',
                    )}
                    title={copied ? t('chat.message.copied') : t('chat.message.copy')}
                    aria-label={copied ? t('chat.message.copied') : t('chat.message.copy')}
                    onClick={handleCopy}
                    disabled={!copyText.trim()}
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="hidden sm:inline">{copied ? t('chat.message.copied') : t('chat.message.copy')}</span>
                </button>
            </header>

            <div className="min-w-0 space-y-2 text-sm leading-relaxed text-base-content">
                {hasBlocks ? (
                    <ContentBlockRenderer
                        blocks={blocks}
                        findToolResult={(toolId) => findToolResult(messages, toolId, messageIndex)}
                        expandThinkingBlockIndex={expandedThinkingBlockIndex}
                    />
                ) : message.content ? (
                    <MarkdownBlock content={message.content} isStreaming={message.streaming} />
                ) : isEmptyStreamingPlaceholder ? (
                    <StreamingPlaceholder />
                ) : isUser ? (
                    <span className="italic text-base-content/40">{t('chat.message.emptyUser')}</span>
                ) : null}

                {message.error && (
                    <div className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{message.error}</span>
                    </div>
                )}
            </div>

            {isAssistant && !message.streaming && (
                <footer className="mt-2">
                    <MessageMeta durationMs={message.durationMs} usage={message.usage} />
                </footer>
            )}
        </article>
    );
}
