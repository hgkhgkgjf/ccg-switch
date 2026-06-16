import { useMemo } from 'react';
import type { ContentBlock, ToolResultBlock } from '../../types/chat';
import GenericToolBlock from './GenericToolBlock';

interface ContentBlockRendererProps {
    blocks: ContentBlock[];
}

/**
 * 内容块渲染器 - 根据块类型路由到对应组件
 * 支持 text、tool_use、tool_result 三种块类型
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
        <>
            {blocks.map((block, index) => {
                switch (block.type) {
                    case 'text':
                        return (
                            <div key={index} className="whitespace-pre-wrap">
                                {block.text}
                            </div>
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
                            <div key={index} className="text-warning text-sm">
                                Unknown block: {(block as any).type}
                            </div>
                        );
                }
            })}
        </>
    );
}
