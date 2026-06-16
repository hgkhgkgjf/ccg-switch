import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface CompletionItem {
    id: string;
    label: string;
    description?: string;
    /** 插入到输入框的值（不含触发符），默认用 label */
    insertText?: string;
}

interface CompletionMenuProps {
    items: CompletionItem[];
    activeIndex: number;
    loading?: boolean;
    emptyText: string;
    onSelect: (index: number) => void;
    onHover: (index: number) => void;
}

/**
 * 输入框上方的补全菜单（@文件 / #子代理 / !预设 / /命令 共用）。
 * 定位由父容器 relative 决定，菜单贴 textarea 顶部向上弹出。
 */
export function CompletionMenu({
    items,
    activeIndex,
    loading,
    emptyText,
    onSelect,
    onHover,
}: CompletionMenuProps) {
    const listRef = useRef<HTMLDivElement>(null);

    // 键盘移动时把高亮项滚进可视区
    useEffect(() => {
        const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    return (
        <div className="absolute bottom-full left-0 mb-2 z-[10000] w-[26rem] max-w-[90vw] max-h-72 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-xl">
            {loading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-base-content/50">
                    <Loader2 size={14} className="animate-spin" />
                    …
                </div>
            ) : items.length === 0 ? (
                <div className="px-3 py-3 text-xs text-base-content/40">{emptyText}</div>
            ) : (
                <div ref={listRef}>
                    {items.map((item, i) => (
                        <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelect(i);
                            }}
                            onMouseEnter={() => onHover(i)}
                            className={`w-full flex flex-col items-start px-3 py-1.5 text-left
                                ${i === activeIndex ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                        >
                            <span className="text-xs font-medium text-base-content truncate w-full">
                                {item.label}
                            </span>
                            {item.description && (
                                <span className="text-[11px] text-base-content/50 truncate w-full">
                                    {item.description}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
