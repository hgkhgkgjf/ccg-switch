import {useEffect, useRef, useState} from 'react';
import {
    Check,
    Columns2,
    Copy,
    ExternalLink,
    FileDiff,
    PanelRightClose,
    Rows3,
    ScrollText,
    TextWrap
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {copyToClipboard, openFile} from '../../utils/bridge';
import type {ChatStatusEditSummary} from '../../utils/chatStatusSummary';
import {cn} from '../../utils/cn';
import EditDiffPreview, {type EditDiffPreviewMode} from '../toolBlocks/EditDiffPreview';

interface ChatDiffReviewPaneProps {
    edit?: ChatStatusEditSummary;
    mode: EditDiffPreviewMode;
    wrapLines: boolean;
    currentCwd?: string | null;
    onModeChange: (mode: EditDiffPreviewMode) => void;
    onWrapLinesChange: (wrapLines: boolean) => void;
    onCollapse?: () => void;
}

export default function ChatDiffReviewPane({
    edit,
    mode,
    wrapLines,
    currentCwd,
    onModeChange,
    onWrapLinesChange,
    onCollapse,
}: ChatDiffReviewPaneProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const copyTimerRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (copyTimerRef.current !== null) {
            window.clearTimeout(copyTimerRef.current);
        }
    }, []);

    const handleOpenFile = () => {
        if (!edit) return;
        void openFile(edit.openPath, edit.lineStart, edit.lineEnd, currentCwd);
    };

    const handleCopyPath = async () => {
        if (!edit) return;
        await copyToClipboard(edit.openPath || edit.displayPath);
        setCopied(true);
        if (copyTimerRef.current !== null) {
            window.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = window.setTimeout(() => {
            setCopied(false);
            copyTimerRef.current = null;
        }, 2000);
    };

    const diffModeButtonClass = (viewMode: EditDiffPreviewMode) => cn(
        'status-diff-mode-button',
        mode === viewMode && 'active',
    );

    return (
        <section className="chat-diff-review-pane" aria-label={t('chat.layout.diffPanel')}>
            <div className="chat-diff-review-header">
                <div className="chat-diff-review-title">
                    <FileDiff size={14} />
                    <div className="min-w-0">
                        <div className="chat-diff-review-heading">{t('chat.layout.diffPanel')}</div>
                        <div className="chat-diff-review-path" title={edit?.displayPath}>
                            {edit?.displayPath ?? t('chat.layout.diffPanelEmpty')}
                        </div>
                    </div>
                </div>
                <div className="chat-diff-review-actions">
                    {edit && (
                        <div className="chat-diff-review-stats" title={t('chat.layout.diffLineSummary', {count: edit.diffPreviewLines.length})}>
                            <span className="edit-stat-added">+{edit.additions}</span>
                            <span className="edit-stat-deleted">-{edit.deletions}</span>
                        </div>
                    )}
                    <div className="status-diff-mode-toggle" role="group" aria-label={t('chat.layout.diffViewMode')}>
                        <button
                            type="button"
                            className={diffModeButtonClass('unified')}
                            title={t('chat.layout.diffUnifiedView')}
                            aria-label={t('chat.layout.diffUnifiedView')}
                            aria-pressed={mode === 'unified'}
                            onClick={() => onModeChange('unified')}
                        >
                            <Rows3 size={12} />
                        </button>
                        <button
                            type="button"
                            className={diffModeButtonClass('split')}
                            title={t('chat.layout.diffSplitView')}
                            aria-label={t('chat.layout.diffSplitView')}
                            aria-pressed={mode === 'split'}
                            onClick={() => onModeChange('split')}
                        >
                            <Columns2 size={12} />
                            <span className="diff-mode-color-bars" aria-hidden="true">
                                <span className="diff-mode-color-bar deleted" />
                                <span className="diff-mode-color-bar added" />
                            </span>
                        </button>
                    </div>
                    <button
                        type="button"
                        className={cn('status-diff-mode-button chat-diff-review-wrap-toggle', wrapLines && 'active')}
                        title={wrapLines ? t('chat.layout.diffLineNoWrap') : t('chat.layout.diffLineWrap')}
                        aria-label={wrapLines ? t('chat.layout.diffLineNoWrap') : t('chat.layout.diffLineWrap')}
                        aria-pressed={wrapLines}
                        onClick={() => onWrapLinesChange(!wrapLines)}
                    >
                        {wrapLines ? <TextWrap size={12} /> : <ScrollText size={12} />}
                    </button>
                    <button
                        type="button"
                        className="chat-diff-review-open"
                        title={t('tools.openFile')}
                        aria-label={t('tools.openFile')}
                        disabled={!edit}
                        onClick={handleOpenFile}
                    >
                        <ExternalLink size={13} />
                    </button>
                    <button
                        type="button"
                        className={cn('chat-diff-review-copy', copied && 'copied')}
                        title={copied ? t('tools.copied') : t('tools.copyPath')}
                        aria-label={copied ? t('tools.copied') : t('tools.copyPath')}
                        disabled={!edit}
                        onClick={() => void handleCopyPath()}
                    >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    {onCollapse && (
                        <button
                            type="button"
                            className="chat-diff-review-collapse"
                            title={t('chat.layout.collapseDiffPanel')}
                            aria-label={t('chat.layout.collapseDiffPanel')}
                            onClick={onCollapse}
                        >
                            <PanelRightClose size={13} />
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-diff-review-body">
                {edit && edit.diffPreviewLines.length > 0 ? (
                    <EditDiffPreview
                        filePath={edit.displayPath}
                        additions={edit.additions}
                        deletions={edit.deletions}
                        lines={edit.diffPreviewLines}
                        mode={mode}
                        wrapLines={wrapLines}
                        variant="panel"
                        lineLimit={undefined}
                    />
                ) : (
                    <div className="chat-diff-review-empty">
                        <FileDiff size={18} />
                        <span>{t('chat.layout.diffPanelEmpty')}</span>
                    </div>
                )}
            </div>
        </section>
    );
}
