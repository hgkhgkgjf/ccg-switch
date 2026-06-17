import {
    type ChangeEvent,
    type ClipboardEvent,
    type DragEvent,
    type KeyboardEvent,
    useCallback,
    useRef,
    useState,
} from 'react';
import {useTranslation} from 'react-i18next';
import {invoke} from '@tauri-apps/api/core';
import {useChatStore} from '../../../stores/useChatStore';
import {ContextBar} from './ContextBar';
import {ButtonArea} from './ButtonArea';
import {CompletionMenu} from './CompletionMenu';
import {PromptEnhancerDialog} from './PromptEnhancerDialog';
import {useCompletions} from './useCompletions';
import {type ChatProviderId, contextWindowFor} from './constants';

interface ChatComposerProps {
    /** 当前 provider 对应 SDK 是否缺失（缺失时拦截发送，提示安装） */
    sdkMissing: boolean;
    onSdkMissing: () => void;
    /** 工作目录（@ 文件补全用） */
    cwd?: string;
}

/**
 * 发送控制台：顶部上下文栏 + 富输入框（@/#/!// 补全）+ 底部控制工具栏。
 * 整合自 jcc-gui ChatInputBox 的交互能力，用 ccg-switch 现有栈重写。
 */
export function ChatComposer({ sdkMissing, onSdkMissing, cwd }: ChatComposerProps) {
    const { t } = useTranslation();
    const {
        provider,
        permissionMode,
        model,
        reasoningEffort,
        draft,
        contextTokens,
        activeRequestId,
        setProvider,
        setPermissionMode,
        setModel,
        setReasoningEffort,
        setDraft,
        send,
        abort,
    } = useChatStore();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const composingRef = useRef(false);
    const draftHistoryRef = useRef<string[]>([]);
    const historyCursorRef = useRef<number | null>(null);
    const [activeFile, setActiveFile] = useState<string | undefined>();
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [statusPanelExpanded, setStatusPanelExpanded] = useState(true);

    // Prompt 增强弹窗状态
    const [enhancerOpen, setEnhancerOpen] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [enhancedText, setEnhancedText] = useState('');

    const completions = useCompletions({ cwd });

    const isStreaming = activeRequestId !== null;
    const maxTokens = contextWindowFor(model);
    const percentage = maxTokens > 0 ? (contextTokens / maxTokens) * 100 : 0;

    // 自适应高度
    const autosize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }, []);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setDraft(value);
        completions.onTextChange(value, e.target.selectionStart ?? value.length);
        requestAnimationFrame(autosize);
    };

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || isStreaming) return;
        if (sdkMissing) {
            onSdkMissing();
            return;
        }
        // 把文件上下文作为前缀附加（@file 简化版）
        const finalText = activeFile ? `@${activeFile}\n${text}` : text;

        // 先清空 UI（立即生效）
        setActiveFile(undefined);
        if (draftHistoryRef.current[draftHistoryRef.current.length - 1] !== text) {
            draftHistoryRef.current = [...draftHistoryRef.current.slice(-49), text];
        }
        historyCursorRef.current = null;

        // 发送消息（store 内部会清空 draft）
        await send(finalText, { cwd });

        // 确保 textarea 高度重置
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (el) {
                el.style.height = 'auto';
                el.focus();
            }
        });
    };

    const applyDraftFromHistory = (historyIndex: number | null) => {
        const nextDraft = historyIndex === null ? '' : draftHistoryRef.current[historyIndex] ?? '';
        historyCursorRef.current = historyIndex;
        setDraft(nextDraft);
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(nextDraft.length, nextDraft.length);
            autosize();
        });
    };

    const navigateDraftHistory = (direction: 'previous' | 'next'): boolean => {
        const history = draftHistoryRef.current;
        if (history.length === 0 || draft.trim()) return false;

        if (direction === 'previous') {
            const current = historyCursorRef.current ?? history.length;
            applyDraftFromHistory(Math.max(0, current - 1));
            return true;
        }

        if (historyCursorRef.current === null) return false;

        const nextIndex = historyCursorRef.current + 1;
        applyDraftFromHistory(nextIndex >= history.length ? null : nextIndex);
        return true;
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // 补全菜单优先消费方向键 / Esc / Enter
        const consumed = completions.handleKeyDown(e);
        if (consumed) {
            // Enter / Tab：确认补全并写回文本
            if ((e.key === 'Enter' || e.key === 'Tab') && completions.isOpen) {
                const el = textareaRef.current;
                if (el) {
                    const result = completions.applySelection(
                        completions.activeIndex,
                        el.value,
                    );
                    if (result) {
                        setDraft(result.text);
                        requestAnimationFrame(() => {
                            el.focus();
                            el.setSelectionRange(result.caret, result.caret);
                            autosize();
                        });
                    }
                }
            }
            return;
        }

        if (e.key === 'ArrowUp' && navigateDraftHistory('previous')) {
            e.preventDefault();
            return;
        }

        if (e.key === 'ArrowDown' && navigateDraftHistory('next')) {
            e.preventDefault();
            return;
        }

        // 普通 Enter 发送，Shift+Enter 换行；IME 组合输入时 Enter 仅用于确认候选词。
        if (e.key === 'Enter' && !e.shiftKey && !composingRef.current && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void handleSend();
        }
    };

    const handleAddAttachment = (files: FileList) => {
        // 简化版：取第一个文件名作为文件上下文芯片。
        const first = files[0];
        if (first) setActiveFile(first.name);
    };

    const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        if (e.clipboardData.files.length > 0) {
            handleAddAttachment(e.clipboardData.files);
        }
    };

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
            setIsDraggingFile(true);
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
            setIsDraggingFile(true);
        }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        const nextTarget = e.relatedTarget as Node | null;
        if (nextTarget && e.currentTarget.contains(nextTarget)) return;

        setIsDraggingFile(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        if (e.dataTransfer.files.length === 0) return;

        e.preventDefault();
        setIsDraggingFile(false);
        handleAddAttachment(e.dataTransfer.files);
        textareaRef.current?.focus();
    };

    const handleEnhance = async () => {
        const text = draft.trim();
        if (!text || enhancing) return;
        setEnhancerOpen(true);
        setEnhancing(true);
        setEnhancedText('');
        try {
            const result = await invoke<string>('chat_enhance_prompt', {
                prompt: text,
                model,
            });
            setEnhancedText(result || text);
        } catch (e) {
            setEnhancedText('');
            // 失败时关闭弹窗、保留原文，避免误导。
            setEnhancerOpen(false);
            console.error('[ChatComposer] enhance failed:', e);
        } finally {
            setEnhancing(false);
        }
    };

    const applyEnhanced = () => {
        if (enhancedText) {
            setDraft(enhancedText);
            requestAnimationFrame(autosize);
        }
        setEnhancerOpen(false);
    };

    return (
        <div className="border-t border-base-300 px-3 py-2">
            {/* 顶部上下文栏 */}
            <ContextBar
                activeFile={activeFile}
                percentage={percentage}
                usedTokens={contextTokens}
                maxTokens={maxTokens}
                onClearFile={() => setActiveFile(undefined)}
                onAddAttachment={handleAddAttachment}
                statusPanelExpanded={statusPanelExpanded}
                onToggleStatusPanel={() => setStatusPanelExpanded((v) => !v)}
            />

            {/* 输入框 + 补全菜单 */}
            <div
                className={`relative rounded-lg transition-colors ${
                    isDraggingFile ? 'bg-primary/5 ring-2 ring-primary/30' : ''
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {completions.isOpen && (
                    <CompletionMenu
                        items={completions.items}
                        activeIndex={completions.activeIndex}
                        loading={completions.loading}
                        emptyText={t('chat.completion.empty')}
                        onSelect={(i) => {
                            const el = textareaRef.current;
                            if (!el) return;
                            const result = completions.applySelection(i, el.value);
                            if (result) {
                                setDraft(result.text);
                                requestAnimationFrame(() => {
                                    el.focus();
                                    el.setSelectionRange(result.caret, result.caret);
                                    autosize();
                                });
                            }
                        }}
                        onHover={completions.setActiveIndex}
                    />
                )}
                <textarea
                    ref={textareaRef}
                    className="textarea textarea-bordered w-full resize-none min-h-[52px] max-h-[200px] leading-relaxed"
                    rows={2}
                    placeholder={t('chat.richPlaceholder')}
                    value={draft}
                    onChange={handleChange}
                    onCompositionStart={() => {
                        composingRef.current = true;
                    }}
                    onCompositionEnd={() => {
                        composingRef.current = false;
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                />
                {isDraggingFile && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border border-dashed border-primary bg-primary/10 text-xs font-medium text-primary backdrop-blur-[1px]">
                        {t('chat.dropFileHint')}
                    </div>
                )}
                {!draft.trim() && draftHistoryRef.current.length > 0 && !isDraggingFile && (
                    <div className="mt-1 px-1 text-[11px] text-base-content/35">
                        {t('chat.historyHint')}
                    </div>
                )}
            </div>

            {/* 底部控制工具栏 */}
            <ButtonArea
                provider={provider as ChatProviderId}
                permissionMode={permissionMode}
                model={model}
                reasoningEffort={reasoningEffort}
                isLoading={isStreaming}
                isEnhancing={enhancing}
                hasInputContent={draft.trim().length > 0}
                onProviderChange={(p) => setProvider(p)}
                onModeChange={setPermissionMode}
                onModelChange={setModel}
                onReasoningChange={setReasoningEffort}
                onEnhance={handleEnhance}
                onSubmit={handleSend}
                onStop={abort}
            />

            <PromptEnhancerDialog
                isOpen={enhancerOpen}
                isLoading={enhancing}
                originalPrompt={draft}
                enhancedPrompt={enhancedText}
                onUseEnhanced={applyEnhanced}
                onKeepOriginal={() => setEnhancerOpen(false)}
                onClose={() => setEnhancerOpen(false)}
            />
        </div>
    );
}
