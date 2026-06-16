import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CompletionItem } from './CompletionMenu';

/** 触发符类型。 */
export type CompletionTrigger = '@' | '#' | '!' | '/';

interface SlashCommand {
    id: string;
    label: string;
    description: string;
}

/** 内置 Slash 命令（参考 Claude Code 常用指令的子集）。 */
const SLASH_COMMANDS: SlashCommand[] = [
    { id: 'clear', label: '/clear', description: '清空当前会话' },
    { id: 'compact', label: '/compact', description: '压缩上下文' },
    { id: 'init', label: '/init', description: '生成 CLAUDE.md' },
    { id: 'review', label: '/review', description: '审查代码改动' },
    { id: 'help', label: '/help', description: '查看可用命令' },
];

interface WorkspaceFile {
    relPath: string;
    name: string;
    isDir: boolean;
}

interface PromptPreset {
    name: string;
    content: string;
    filePath: string;
}

interface Subagent {
    name: string;
    content: string;
    filePath: string;
}

/** 当前激活的补全状态。 */
interface ActiveCompletion {
    trigger: CompletionTrigger;
    /** 触发符在文本中的起始下标 */
    start: number;
    /** 触发符后已输入的查询词 */
    query: string;
}

/**
 * 扫描光标前文本，判断是否处于某个触发符的补全上下文。
 * 规则：触发符需位于行首或空白后；查询词内不含空白。
 */
function detectTrigger(text: string, caret: number): ActiveCompletion | null {
    const triggers: CompletionTrigger[] = ['@', '#', '!', '/'];
    // 从光标往前找最近的触发符
    for (let i = caret - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === ' ' || ch === '\n' || ch === '\t') return null;
        if ((triggers as string[]).includes(ch)) {
            const before = i === 0 ? '' : text[i - 1];
            const atBoundary = i === 0 || before === ' ' || before === '\n' || before === '\t';
            if (!atBoundary) return null;
            // `/` 仅在输入起始处作为 slash 命令（避免误触路径）
            if (ch === '/' && i !== 0) return null;
            return {
                trigger: ch as CompletionTrigger,
                start: i,
                query: text.slice(i + 1, caret),
            };
        }
    }
    return null;
}

interface UseCompletionsOptions {
    /** 工作目录（@ 文件补全用，缺省主目录） */
    cwd?: string;
}

export interface CompletionState {
    isOpen: boolean;
    items: CompletionItem[];
    activeIndex: number;
    loading: boolean;
    trigger: CompletionTrigger | null;
    /** 文本/光标变化时调用，刷新补全上下文 */
    onTextChange: (text: string, caret: number) => void;
    /** 键盘事件预处理；返回 true 表示已消费（阻止默认） */
    handleKeyDown: (e: React.KeyboardEvent) => boolean;
    setActiveIndex: (i: number) => void;
    /** 选中第 index 项，返回替换后的 {text, caret}，由调用方写回 */
    applySelection: (
        index: number,
        text: string,
    ) => { text: string; caret: number } | null;
    close: () => void;
}

/**
 * 输入框补全控制器。集中处理 @ / # / ! / / 四类触发的检测、数据拉取、
 * 键盘导航与文本替换。数据源：
 *   @  → chat_list_workspace_files（Rust）
 *   #  → list_subagents
 *   !  → list_prompts
 *   /  → 内置 SLASH_COMMANDS
 */
export function useCompletions({ cwd }: UseCompletionsOptions = {}): CompletionState {
    const [active, setActive] = useState<ActiveCompletion | null>(null);
    const [items, setItems] = useState<CompletionItem[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const reqSeq = useRef(0);

    const close = useCallback(() => {
        setActive(null);
        setItems([]);
        setActiveIndex(0);
        setLoading(false);
    }, []);

    // 拉取补全项（带请求序号防竞态）
    useEffect(() => {
        if (!active) return;
        const seq = ++reqSeq.current;
        setLoading(true);

        const fetchItems = async (): Promise<CompletionItem[]> => {
            const q = active.query.toLowerCase();
            switch (active.trigger) {
                case '/': {
                    return SLASH_COMMANDS.filter(
                        (c) => c.id.includes(q) || c.label.includes(q),
                    ).map((c) => ({
                        id: c.id,
                        label: c.label,
                        description: c.description,
                        insertText: c.label,
                    }));
                }
                case '@': {
                    const files = await invoke<WorkspaceFile[]>(
                        'chat_list_workspace_files',
                        { dir: cwd, query: active.query },
                    );
                    return files.map((f) => ({
                        id: f.relPath,
                        label: f.relPath + (f.isDir ? '/' : ''),
                        description: f.isDir ? '目录' : undefined,
                        insertText: f.relPath,
                    }));
                }
                case '#': {
                    const agents = await invoke<Subagent[]>('list_subagents');
                    return agents
                        .filter((a) => a.name.toLowerCase().includes(q))
                        .map((a) => ({
                            id: a.name,
                            label: a.name,
                            insertText: a.name,
                        }));
                }
                case '!': {
                    const prompts = await invoke<PromptPreset[]>('list_prompts');
                    return prompts
                        .filter((p) => p.name.toLowerCase().includes(q))
                        .map((p) => ({
                            id: p.name,
                            label: p.name,
                            insertText: p.name,
                        }));
                }
                default:
                    return [];
            }
        };

        fetchItems()
            .then((result) => {
                if (seq !== reqSeq.current) return;
                setItems(result);
                setActiveIndex(0);
                setLoading(false);
            })
            .catch(() => {
                if (seq !== reqSeq.current) return;
                setItems([]);
                setLoading(false);
            });
    }, [active, cwd]);

    const onTextChange = useCallback(
        (text: string, caret: number) => {
            const detected = detectTrigger(text, caret);
            setActive((prev) => {
                if (!detected) return null;
                if (
                    prev &&
                    prev.trigger === detected.trigger &&
                    prev.start === detected.start &&
                    prev.query === detected.query
                ) {
                    return prev;
                }
                return detected;
            });
        },
        [],
    );

    const applySelection = useCallback(
        (index: number, text: string) => {
            if (!active || !items[index]) return null;
            const item = items[index];
            const insert = item.insertText ?? item.label;
            const before = text.slice(0, active.start);
            const after = text.slice(active.start + 1 + active.query.length);
            // 文件/代理/预设保留触发符；slash 命令直接替换为命令本身
            const replacement =
                active.trigger === '/' ? insert : `${active.trigger}${insert}`;
            const newText = `${before}${replacement} ${after}`;
            const caret = before.length + replacement.length + 1;
            close();
            return { text: newText, caret };
        },
        [active, items, close],
    );

    const isOpen = active !== null && (loading || items.length > 0);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent): boolean => {
            if (!isOpen) return false;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % Math.max(items.length, 1));
                return true;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1));
                return true;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return true;
            }
            // Enter / Tab 确认由调用方负责文本替换（需要拿到 textarea 值），
            // 这里只标记“已消费”，交给 ChatComposer 调 applySelection。
            if ((e.key === 'Enter' || e.key === 'Tab') && items.length > 0) {
                e.preventDefault();
                return true;
            }
            return false;
        },
        [isOpen, items.length, close],
    );

    return {
        isOpen,
        items,
        activeIndex,
        loading,
        trigger: active?.trigger ?? null,
        onTextChange,
        handleKeyDown,
        setActiveIndex,
        applySelection,
        close,
    };
}
