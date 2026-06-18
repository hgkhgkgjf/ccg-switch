import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {convertFileSrc} from '@tauri-apps/api/core';
import type {ContentBlock, ImageBlock, ToolResultBlock, ToolUseBlock} from '../../types/chat';
import {groupToolBlocks} from '../../utils/toolGrouping';
import {getToolType} from '../../types/tools';
import {
    getImageBlockDataUrl,
    getImageBlockFileName,
    getImageBlockMediaType,
    getImageBlockPreviewText,
    getImageBlockUrl,
} from '../../utils/chatImageBlocks';
import {
    AgentGroupBlock,
    BashToolBlock,
    BashToolGroupBlock,
    EditToolBlock,
    EditToolGroupBlock,
    GenericToolBlock,
    ReadToolBlock,
    ReadToolGroupBlock,
    SearchToolGroupBlock,
    TaskExecutionBlock,
} from '../toolBlocks';
import MarkdownBlock from './MarkdownBlock';
import ThinkingBlock from './ThinkingBlock';

interface ContentBlockRendererProps {
    blocks: ContentBlock[];
    findToolResult: (toolId: string) => ToolResultBlock | null | undefined;
    expandThinkingBlockIndex?: number;
    compact?: boolean;
    imageDisplay?: 'default' | 'compact' | 'user-thumbnail';
}

interface ImageRenderData {
    label: string;
    mediaType: string;
    src: string | null;
}

function normalizeLocalImagePath(url: string): string {
    if (!url.toLowerCase().startsWith('file:')) return url;

    try {
        const parsed = new URL(url);
        const path = decodeURIComponent(parsed.pathname);
        if (parsed.hostname) {
            return `//${parsed.hostname}${path}`;
        }
        if (/^\/[a-zA-Z]:\//.test(path)) {
            return path.slice(1);
        }
        return path || url;
    } catch {
        return url.replace(/^file:\/+/i, '');
    }
}

function resolveImageSrc(block: ImageBlock): string | null {
    const dataUrl = getImageBlockDataUrl(block);
    if (dataUrl) return dataUrl;

    const url = getImageBlockUrl(block);
    if (!url) return null;
    if (/^(data|https?|blob|asset):/i.test(url)) return url;

    try {
        return convertFileSrc(normalizeLocalImagePath(url));
    } catch {
        return url;
    }
}

function resolveImageRenderData(block: ImageBlock): ImageRenderData {
    const fileName = getImageBlockFileName(block);
    return {
        label: fileName ?? getImageBlockPreviewText(block),
        mediaType: getImageBlockMediaType(block),
        src: resolveImageSrc(block),
    };
}

function ImageBlockRenderer({
    block,
    imageDisplay,
    onOpen,
}: {
    block: ImageBlock;
    imageDisplay: 'default' | 'compact' | 'user-thumbnail';
    onOpen: (image: ImageRenderData) => void;
}) {
    const image = useMemo(() => resolveImageRenderData(block), [block]);
    const isUserThumbnail = imageDisplay === 'user-thumbnail';
    const frameClassName = isUserThumbnail
        ? 'group block max-w-full rounded-lg border border-base-300 bg-base-100 p-0.5 text-left shadow-sm transition hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30'
        : 'group block max-w-full rounded-lg border border-base-300 bg-base-100 p-1 text-left shadow-sm transition hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30';
    const imageClassName = isUserThumbnail
        ? 'chat-image-thumbnail chat-image-thumbnail-user block h-auto max-h-[150px] max-w-[52vw] rounded-md object-contain sm:max-w-[200px]'
        : `chat-image-thumbnail block max-w-full rounded-md object-contain ${imageDisplay === 'compact' ? 'max-h-48' : 'max-h-64'}`;

    return (
        <figure className={`chat-image-block inline-flex max-w-full flex-col gap-1 ${isUserThumbnail ? 'chat-image-block-user ml-auto items-end' : ''}`}>
            {image.src ? (
                <button
                    type="button"
                    className={frameClassName}
                    title={image.label}
                    aria-label={image.label}
                    onClick={() => onOpen(image)}
                >
                    <img
                        className={imageClassName}
                        src={image.src}
                        alt={image.label}
                        loading="lazy"
                    />
                </button>
            ) : (
                <div className="chat-image-thumbnail rounded-lg border border-dashed border-base-300 bg-base-200/60 px-3 py-2 text-xs text-base-content/55">
                    {image.label}
                </div>
            )}
            <figcaption className="sr-only" title={image.label}>
                {image.label}
            </figcaption>
        </figure>
    );
}

/**
 * 内容块渲染器 - 根据块类型路由到对应组件
 * 支持 text、image、tool_use、tool_result、thinking 内容块
 * 自动分组连续的同类型工具（3+ 个）
 */
export default function ContentBlockRenderer({
    blocks,
    findToolResult,
    expandThinkingBlockIndex,
    compact = false,
    imageDisplay,
}: ContentBlockRendererProps) {
    const { t } = useTranslation();
    const [lightboxImage, setLightboxImage] = useState<ImageRenderData | null>(null);
    const resolvedImageDisplay = imageDisplay ?? (compact ? 'compact' : 'default');

    useEffect(() => {
        if (!lightboxImage) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setLightboxImage(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxImage]);

    // 应用分组算法
    const groupedBlocks = useMemo(() => groupToolBlocks(blocks), [blocks]);

    // 渲染单个工具块
    const renderToolBlock = (block: ToolUseBlock, result: ToolResultBlock | null | undefined) => {
        const toolType = getToolType(block.name);

        switch (toolType) {
            case 'bash':
                return (
                    <BashToolBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                        compact={compact}
                    />
                );

            case 'read':
                return (
                    <ReadToolBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                        compact={compact}
                    />
                );

            case 'edit':
                return (
                    <EditToolBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                        compact={compact}
                    />
                );

            case 'search':
                return (
                    <SearchToolGroupBlock
                        blocks={[block]}
                        findToolResult={findToolResult}
                        compact={compact}
                    />
                );

            case 'agent':
                // Agent 工具：检查是否是 Task/spawn_agent
                if (block.name.toLowerCase().includes('task') ||
                    block.name.toLowerCase().includes('spawn')) {
                    return (
                        <TaskExecutionBlock
                            name={block.name}
                            input={block.input}
                            result={result}
                            toolId={block.id}
                            compact={compact}
                        />
                    );
                }
                return (
                    <AgentGroupBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                        compact={compact}
                    />
                );

            default:
                // Generic fallback
                return (
                    <GenericToolBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                        compact={compact}
                    />
                );
        }
    };

    return (
        <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
            {groupedBlocks.map((grouped, index) => {
                if (grouped.type === 'single') {
                    const block = grouped.block;

                    switch (block.type) {
                        case 'text':
                            return (
                                <MarkdownBlock
                                    key={grouped.originalIndex}
                                    content={block.text}
                                />
                            );

                        case 'thinking':
                            return (
                                <ThinkingBlock
                                    key={grouped.originalIndex}
                                    content={block.thinking}
                                    defaultExpanded={grouped.originalIndex === expandThinkingBlockIndex}
                                    title={t('chat.thinking.title')}
                                    compact={compact}
                                />
                            );

                        case 'image':
                        case 'input_image':
                            return (
                                <ImageBlockRenderer
                                    key={grouped.originalIndex}
                                    block={block}
                                    imageDisplay={resolvedImageDisplay}
                                    onOpen={setLightboxImage}
                                />
                            );

                        case 'tool_use':
                            const result = findToolResult(block.id);
                            return (
                                <div key={block.id}>
                                    {renderToolBlock(block, result)}
                                </div>
                            );

                        case 'tool_result':
                            // 已在 tool_use 中显示，跳过
                            return null;

                        default:
                            console.warn('[ContentBlockRenderer] Unknown block:', block);
                            return (
                                <div key={grouped.originalIndex} className="text-warning text-sm bg-warning/10 px-3 py-2 rounded-lg">
                                    {t('chat.message.unknownBlock')}
                                </div>
                            );
                    }
                } else {
                    // 渲染分组
                    const { toolType, blocks: groupBlocks } = grouped;

                    switch (toolType) {
                        case 'bash':
                            return (
                                <BashToolGroupBlock
                                    key={`group-${index}`}
                                    blocks={groupBlocks}
                                    findToolResult={findToolResult}
                                    compact={compact}
                                />
                            );

                        case 'read':
                            return (
                                <ReadToolGroupBlock
                                    key={`group-${index}`}
                                    blocks={groupBlocks}
                                    findToolResult={findToolResult}
                                    compact={compact}
                                />
                            );

                        case 'edit':
                            return (
                                <EditToolGroupBlock
                                    key={`group-${index}`}
                                    blocks={groupBlocks}
                                    findToolResult={findToolResult}
                                    compact={compact}
                                />
                            );

                        case 'search':
                            return (
                                <SearchToolGroupBlock
                                    key={`group-${index}`}
                                    blocks={groupBlocks}
                                    findToolResult={findToolResult}
                                    compact={compact}
                                />
                            );

                        default:
                            // 不应该到这里（generic 不分组），降级为单个渲染
                            return (
                                <div key={`group-${index}`} className="space-y-2">
                                    {groupBlocks.map(block => {
                                        const result = findToolResult(block.id);
                                        return (
                                            <div key={block.id}>
                                                {renderToolBlock(block, result)}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                    }
                }
            })}
            {lightboxImage?.src && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={lightboxImage.label}
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-square absolute right-4 top-4 text-white hover:bg-white/10"
                        title={t('common.close')}
                        aria-label={t('common.close')}
                        onClick={() => setLightboxImage(null)}
                    >
                        <X size={18} />
                    </button>
                    <img
                        src={lightboxImage.src}
                        alt={lightboxImage.label}
                        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>,
                document.body,
            )}
        </div>
    );
}
