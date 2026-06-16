import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, X, Layers, ChevronDown, File as FileIcon } from 'lucide-react';
import { TokenIndicator } from './TokenIndicator';

interface ContextBarProps {
    /** 当前选中的文件上下文（@file 选中后） */
    activeFile?: string;
    /** token 用量百分比 0-100 */
    percentage: number;
    usedTokens?: number;
    maxTokens?: number;
    onClearFile?: () => void;
    onAddAttachment: (files: FileList) => void;
    /** 状态面板是否展开 */
    statusPanelExpanded?: boolean;
    onToggleStatusPanel?: () => void;
}

/**
 * 输入区顶部上下文栏：附件按钮 + token 用量环 + 文件上下文芯片 + 状态面板开关。
 * 移植自 jcc-gui ContextBar，用 lucide + DaisyUI 重写。
 */
export function ContextBar({
    activeFile,
    percentage,
    usedTokens,
    maxTokens,
    onClearFile,
    onAddAttachment,
    statusPanelExpanded = true,
    onToggleStatusPanel,
}: ContextBarProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fileName = activeFile ? activeFile.split(/[/\\]/).pop() || activeFile : '';

    return (
        <div className="flex items-center gap-2 px-1 pb-1.5">
            {/* 附件 */}
            <button
                type="button"
                className="flex items-center justify-center w-7 h-7 rounded-md text-base-content/60 hover:bg-base-200 hover:text-base-content transition-colors"
                title={t('chat.attach')}
                onClick={() => fileInputRef.current?.click()}
            >
                <Paperclip size={15} />
            </button>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        onAddAttachment(e.target.files);
                    }
                    e.target.value = '';
                }}
            />

            {/* token 用量环 */}
            <TokenIndicator
                percentage={percentage}
                usedTokens={usedTokens}
                maxTokens={maxTokens}
            />

            <div className="w-px h-4 bg-base-300" />

            {/* 文件上下文芯片 */}
            {activeFile ? (
                <div
                    className="flex items-center gap-1 h-6 pl-1.5 pr-1 rounded-md bg-base-200 text-xs text-base-content/80 max-w-[14rem]"
                    title={activeFile}
                >
                    <FileIcon size={12} className="shrink-0" />
                    <span className="truncate" dir="ltr">
                        {fileName}
                    </span>
                    <button
                        type="button"
                        className="shrink-0 hover:text-error"
                        onClick={onClearFile}
                        title={t('chat.removeFileContext')}
                    >
                        <X size={12} />
                    </button>
                </div>
            ) : (
                <span className="text-[11px] text-base-content/30 select-none">
                    {t('chat.noFileContext')}
                </span>
            )}

            {/* 右侧：状态面板开关 */}
            <div className="ml-auto flex items-center gap-1">
                {onToggleStatusPanel && (
                    <button
                        type="button"
                        className="flex items-center justify-center w-7 h-7 rounded-md text-base-content/60 hover:bg-base-200 hover:text-base-content transition-colors"
                        onClick={onToggleStatusPanel}
                        title={
                            statusPanelExpanded
                                ? t('chat.collapsePanel')
                                : t('chat.expandPanel')
                        }
                    >
                        {statusPanelExpanded ? <ChevronDown size={15} /> : <Layers size={15} />}
                    </button>
                )}
            </div>
        </div>
    );
}
