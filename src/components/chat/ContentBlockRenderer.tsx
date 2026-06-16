import { useMemo } from 'react';
import type { ContentBlock, ToolResultBlock } from '../../types/chat';
import GenericToolBlock from './GenericToolBlock';
import MarkdownBlock from './MarkdownBlock';
import ThinkingBlock from './ThinkingBlock';

interface ContentBlockRendererProps {
    blocks: ContentBlock[];
}

/**
 * 内容块渲染器 - 根据块类型路由到对应组件
 * 支持 text、tool_use、tool_result、thinking 四种块类型
 */
export default function ContentBlockRenderer({ blocks }: ContentBlockRendererProps) {
    // 构建 tool_use_id → tool_result 的映射
    const resultMap = useMemo(() => {
        const map = new Map<string, ToolResultBlock>();
        blocks.forEach(block => {
            if (block.type === 'tool_result') {
                map.set(block.tool_use_id, block);
            }
        });
        return map;
    }, [blocks]);

    return (
        <div className="space-y-2">
            {blocks.map((block, index) => {
                switch (block.type) {
                    case 'text':
                        return (
                            <MarkdownBlock
                                key={index}
                                content={block.text}
                            />
                        );

                    case 'thinking':
                        return (
                            <ThinkingBlock
                                key={index}
                                content={block.thinking}
                            />
                        );

                    case 'tool_use':
                        const result = resultMap.get(block.id);
                        return (
                            <GenericToolBlock
                                key={block.id}
                                name={block.name}
                                input={block.input}
                                result={result}
                                toolId={block.id}
                            />
                        );

                    case 'tool_result':
                        // 已在 tool_use 中显示，跳过
                        return null;

                    default:
                        console.warn('[ContentBlockRenderer] Unknown block type:', (block as any).type);
                        return (
                            <div key={index} className="text-warning text-sm bg-warning/10 px-3 py-2 rounded-lg">
                                Unknown block: {(block as any).type}
                            </div>
                        );
                }
            })}
        </div>
    );
}
