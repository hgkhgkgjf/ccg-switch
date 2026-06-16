import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, X } from 'lucide-react';

interface PromptEnhancerDialogProps {
    isOpen: boolean;
    isLoading: boolean;
    originalPrompt: string;
    enhancedPrompt: string;
    onUseEnhanced: () => void;
    onKeepOriginal: () => void;
    onClose: () => void;
}

/**
 * Prompt 增强结果对比弹窗：左原文 / 右增强版，可采用或保留。
 * 自包含 portal 弹窗（ModalDialog 固定页脚，无法满足自定义按钮）。
 */
export function PromptEnhancerDialog({
    isOpen,
    isLoading,
    originalPrompt,
    enhancedPrompt,
    onUseEnhanced,
    onKeepOriginal,
    onClose,
}: PromptEnhancerDialogProps) {
    const { t } = useTranslation();

    useEffect(() => {
        if (!isOpen) return;
        const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onEsc);
        return () => window.removeEventListener('keydown', onEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="modal modal-open z-[100]">
            <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8 z-[110]" />
            <div className="modal-box relative max-w-3xl bg-white dark:bg-base-100 shadow-2xl rounded-2xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Sparkles size={18} className="text-primary" />
                        {t('chat.enhancer.title')}
                    </h3>
                    <button
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={onClose}
                        title={t('common.close')}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 overflow-hidden">
                    <div className="flex flex-col min-h-0">
                        <div className="text-xs font-medium text-base-content/50 mb-1">
                            {t('chat.enhancer.original')}
                        </div>
                        <div className="flex-1 rounded-lg border border-base-300 bg-base-200/50 p-3 text-sm whitespace-pre-wrap overflow-y-auto">
                            {originalPrompt}
                        </div>
                    </div>
                    <div className="flex flex-col min-h-0">
                        <div className="text-xs font-medium text-primary mb-1">
                            {t('chat.enhancer.enhanced')}
                        </div>
                        <div className="flex-1 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm whitespace-pre-wrap overflow-y-auto">
                            {isLoading ? (
                                <span className="flex items-center gap-2 text-base-content/50">
                                    <Loader2 size={14} className="animate-spin" />
                                    {t('chat.enhancer.loading')}
                                </span>
                            ) : (
                                enhancedPrompt
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <button className="btn btn-ghost btn-sm" onClick={onKeepOriginal}>
                        {t('chat.enhancer.keepOriginal')}
                    </button>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={onUseEnhanced}
                        disabled={isLoading || !enhancedPrompt}
                    >
                        {t('chat.enhancer.useEnhanced')}
                    </button>
                </div>
            </div>
            <div
                className="modal-backdrop bg-black/40 backdrop-blur-sm fixed inset-0 z-[-1]"
                onClick={onClose}
            />
        </div>,
        document.body,
    );
}
