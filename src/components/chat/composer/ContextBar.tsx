import {useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {ChevronDown, Image as ImageIcon, Layers, Paperclip, X} from 'lucide-react';
import type {ChatAttachment} from '../../../types/chat';
import {getChatComposerInputLabel} from '../../../utils/chatUiBehavior';
import {TokenIndicator} from './TokenIndicator';

interface ContextBarProps {
    /** 当前图片附件 */
    attachments: ChatAttachment[];
    /** token 用量百分比 0-100 */
    percentage: number;
    usedTokens?: number;
    maxTokens?: number;
    onRemoveAttachment: (index: number) => void;
    onAddAttachment: (files: FileList) => void | Promise<void>;
    /** 状态面板是否展开 */
    statusPanelExpanded?: boolean;
    onToggleStatusPanel?: () => void;
}

/**
 * 输入区顶部上下文栏：附件按钮 + token 用量环 + 文件上下文芯片 + 状态面板开关。
 * 移植自 jcc-gui ContextBar，用 lucide + DaisyUI 重写。
 */
export function ContextBar({
    attachments,
    percentage,
    usedTokens,
    maxTokens,
    onRemoveAttachment,
    onAddAttachment,
    statusPanelExpanded = true,
    onToggleStatusPanel,
}: ContextBarProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachLabel = getChatComposerInputLabel({
        control: 'attach',
        translate: t,
    });
    const removeAttachmentLabel = getChatComposerInputLabel({
        control: 'remove-attachment',
        translate: t,
    });
    const statusPanelToggleLabel = getChatComposerInputLabel({
        control: statusPanelExpanded ? 'collapse-panel' : 'expand-panel',
        translate: t,
    });

    return (
        <div className="flex items-center gap-1.5 px-1 pb-1">
            {/* 附件 */}
            <button
                type="button"
                className="flex items-center justify-center w-7 h-7 rounded-md text-base-content/60 hover:bg-base-200 hover:text-base-content transition-colors"
                title={attachLabel}
                aria-label={attachLabel}
                onClick={() => fileInputRef.current?.click()}
            >
                <Paperclip size={15} />
            </button>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        void onAddAttachment(e.target.files);
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

            {attachments.length > 0 && (
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {attachments.map((attachment, index) => (
                        <div
                            key={`${attachment.fileName}-${index}`}
                            className="flex h-6 min-w-0 max-w-[11rem] items-center gap-1 rounded-md bg-base-200 pl-1.5 pr-1 text-xs text-base-content/80"
                            title={attachment.fileName}
                        >
                            <ImageIcon size={12} className="shrink-0 text-primary" />
                            <span className="truncate" dir="ltr">
                                {attachment.fileName}
                            </span>
                            <button
                                type="button"
                                className="shrink-0 rounded-sm hover:text-error focus:outline-none focus:ring-1 focus:ring-error/50"
                                onClick={() => onRemoveAttachment(index)}
                                title={removeAttachmentLabel}
                                aria-label={removeAttachmentLabel}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* 右侧：状态面板开关 */}
            <div className="ml-auto flex items-center gap-1">
                {onToggleStatusPanel && (
                    <button
                        type="button"
                        className="flex items-center justify-center w-7 h-7 rounded-md text-base-content/60 hover:bg-base-200 hover:text-base-content transition-colors"
                        onClick={onToggleStatusPanel}
                        title={statusPanelToggleLabel}
                        aria-label={statusPanelToggleLabel}
                    >
                        {statusPanelExpanded ? <ChevronDown size={15} /> : <Layers size={15} />}
                    </button>
                )}
            </div>
        </div>
    );
}
