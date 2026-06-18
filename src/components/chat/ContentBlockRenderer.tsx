import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import type {ContentBlock, ToolResultBlock, ToolUseBlock} from '../../types/chat';
import {groupToolBlocks} from '../../utils/toolGrouping';
import {getToolType} from '../../types/tools';
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
}

/**
 * 内容块渲染器 - 根据块类型路由到对应组件
 * 支持 text、tool_use、tool_result、thinking 四种块类型
 * 自动分组连续的同类型工具（3+ 个）
 */
export default function ContentBlockRenderer({
    blocks,
    findToolResult,
    expandThinkingBlockIndex,
    compact = false,
}: ContentBlockRendererProps) {
    const { t } = useTranslation();
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
                    />
                );

            case 'read':
                return (
                    <ReadToolBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                    />
                );

            case 'edit':
                return (
                    <EditToolBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                    />
                );

            case 'search':
                return (
                    <SearchToolGroupBlock
                        blocks={[block]}
                        findToolResult={findToolResult}
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
                        />
                    );
                }
                return (
                    <AgentGroupBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
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
                                />
                            );

                        case 'read':
                            return (
                                <ReadToolGroupBlock
                                    key={`group-${index}`}
                                    blocks={groupBlocks}
                                    findToolResult={findToolResult}
                                />
                            );

                        case 'edit':
                            return (
                                <EditToolGroupBlock
                                    key={`group-${index}`}
                                    blocks={groupBlocks}
                                    findToolResult={findToolResult}
                                />
                            );

                        case 'search':
                            return (
                                <SearchToolGroupBlock
                                    key={`group-${index}`}
                                    blocks={groupBlocks}
                                    findToolResult={findToolResult}
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
        </div>
    );
}
