import { useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import MarkdownBlock from './MarkdownBlock';

interface ThinkingBlockProps {
    content: string;
}

/**
 * Thinking 块组件 - 显示 Claude 的推理过程
 * 默认折叠，点击展开显示完整 Markdown 内容
 */
export default function ThinkingBlock({ content }: ThinkingBlockProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="thinking-block border border-base-300 rounded-lg my-2 bg-base-200/30">
            <div
                className="flex items-center gap-2 p-3 cursor-pointer hover:bg-base-200/50 rounded-lg transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <MessageCircle size={16} className="text-base-content/60 flex-shrink-0" />
                <span className="text-sm text-base-content/70 flex-1">
                    Claude is thinking...
                </span>
                <ChevronDown
                    size={16}
                    className={`text-base-content/60 transition-transform duration-200 flex-shrink-0 ${
                        expanded ? 'rotate-180' : ''
                    }`}
                />
            </div>

            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-base-300 animate-fadeIn">
                    <MarkdownBlock content={content} />
                </div>
            )}
        </div>
    );
}
