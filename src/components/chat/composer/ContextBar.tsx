import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {ChevronDown, GitBranch, Image as ImageIcon, Layers, Paperclip, X} from 'lucide-react';
import type {ChatAttachment} from '../../../types/chat';
import {getChatComposerInputLabel} from '../../../utils/chatUiBehavior';
import type {ChatWorkspaceStatus} from '../../../utils/chatWorkspaceStatus';
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
    workspaceStatus?: ChatWorkspaceStatus;
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
    workspaceStatus,
    statusPanelExpanded = true,
    onToggleStatusPanel,
}: ContextBarProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewImage, setPreviewImage] = useState<{url: string; name: string} | null>(null);

    // ESC 键关闭预览
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && previewImage) {
                setPreviewImage(null);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [previewImage]);

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
    const gitBranch = workspaceStatus?.isGitRepository ? workspaceStatus.gitBranch : null;
    const translatedGitBranchLabel = t('chat.layout.inputStatusGitBranch');
    const gitBranchLabel = translatedGitBranchLabel === 'chat.layout.inputStatusGitBranch'
        ? 'Git'
        : translatedGitBranchLabel;
    const gitBranchTitle = gitBranch
        ? [
            `${gitBranchLabel}: ${gitBranch}`,
            workspaceStatus?.gitRoot,
        ].filter(Boolean).join(' · ')
        : undefined;

    return (
        <div className="flex min-w-0 items-center gap-1.5 px-1 pb-1">
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

            {(gitBranch || attachments.length > 0) && (
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {gitBranch && (
                        <div
                            className="chat-composer-git-branch flex h-6 min-w-0 max-w-[11rem] items-center gap-1 rounded-md bg-base-200 px-1.5 text-xs font-medium text-base-content/75 sm:max-w-[16rem] md:max-w-[20rem]"
                            title={gitBranchTitle}
                            aria-label={`${gitBranchLabel} ${gitBranch}`}
                        >
                            <GitBranch size={12} className="shrink-0 text-base-content/45" />
                            <span className="hidden shrink-0 text-base-content/45 sm:inline">
                                {gitBranchLabel}
                            </span>
                            <span className="min-w-0 truncate" dir="ltr">
                                {gitBranch}
                            </span>
                        </div>
                    )}
                    {attachments.map((attachment, index) => {
                        const imageUrl = attachment.data
                            ? `data:${attachment.mediaType};base64,${attachment.data}`
                            : attachment.path
                                ? `file://${attachment.path}`
                                : undefined;

                        return (
                            <div
                                key={`${attachment.fileName}-${index}`}
                                className="chat-attachment-preview relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-base-300 bg-base-200 cursor-pointer hover:border-primary transition-colors"
                                title={attachment.fileName}
                                onClick={() => {
                                    if (imageUrl) {
                                        setPreviewImage({url: imageUrl, name: attachment.fileName});
                                    }
                                }}
                            >
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={attachment.fileName}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-1 p-1">
                                        <ImageIcon size={16} className="text-primary" />
                                        <span className="truncate text-[9px] text-base-content/60" dir="ltr">
                                            {attachment.fileName}
                                        </span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-sm bg-base-100/90 text-base-content/70 hover:bg-error hover:text-error-content focus:outline-none focus:ring-1 focus:ring-error/50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveAttachment(index);
                                    }}
                                    title={removeAttachmentLabel}
                                    aria-label={removeAttachmentLabel}
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        );
                    })}
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

            {/* 图片预览全屏遮罩 - 使用 Portal 渲染到 body */}
            {previewImage && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    {/* 关闭按钮 */}
                    <button
                        type="button"
                        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-base-content/10 text-white hover:bg-base-content/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                        onClick={() => setPreviewImage(null)}
                        aria-label="关闭预览 (ESC)"
                        title="关闭预览 (ESC)"
                    >
                        <X size={20} />
                    </button>

                    {/* 图片 */}
                    <img
                        src={previewImage.url}
                        alt={previewImage.name}
                        className="max-h-[90vh] max-w-[90vw] object-contain animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* 底部文件名 */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/50 backdrop-blur-sm">
                        <div className="text-sm text-white/90 font-medium">
                            {previewImage.name}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
