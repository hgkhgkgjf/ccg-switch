import {useEffect, useId, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ChevronDown, MessageCircle} from 'lucide-react';
import MarkdownBlock from './MarkdownBlock';

interface ThinkingBlockProps {
    content: string;
    defaultExpanded?: boolean;
    title?: string;
}

/**
 * Thinking 块组件 - 显示 Claude 的推理过程
 * 默认折叠，点击展开显示完整 Markdown 内容
 */
export default function ThinkingBlock({
    content,
    defaultExpanded = false,
    title,
}: ThinkingBlockProps) {
    const { t } = useTranslation();
    const panelId = useId();
    const manualToggleRef = useRef(false);
    const [expanded, setExpanded] = useState(defaultExpanded);

    useEffect(() => {
        if (defaultExpanded && !manualToggleRef.current) {
            setExpanded(true);
        }
    }, [defaultExpanded]);

    const handleToggle = () => {
        manualToggleRef.current = true;
        setExpanded((current) => !current);
    };

    return (
        <div className="thinking-block my-2 rounded-lg border border-base-300 bg-base-200/30">
            <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg p-3 text-left transition-colors hover:bg-base-200/50"
                onClick={handleToggle}
                aria-expanded={expanded}
                aria-controls={panelId}
            >
                <MessageCircle size={16} className="text-base-content/60 flex-shrink-0" />
                <span className="text-sm text-base-content/70 flex-1">
                    {title ?? t('chat.thinking.title')}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-base-content/60 transition-transform duration-200 flex-shrink-0 ${
                        expanded ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {expanded && (
                <div id={panelId} className="border-t border-base-300 px-3 pb-3 pt-1 animate-fadeIn">
                    <MarkdownBlock content={content} />
                </div>
            )}
        </div>
    );
}
