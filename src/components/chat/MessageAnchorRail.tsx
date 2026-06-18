import {ArrowDown, ArrowUp, Circle, ListTree} from 'lucide-react';
import {useTranslation} from 'react-i18next';

interface MessageAnchorRailProps {
    hasMessages: boolean;
    anchorCount?: number;
    activeAnchorLabel?: string;
    onScrollToTop: () => void;
    onScrollToBottom: () => void;
}

export default function MessageAnchorRail({
    hasMessages,
    anchorCount = 0,
    activeAnchorLabel,
    onScrollToTop,
    onScrollToBottom,
}: MessageAnchorRailProps) {
    const { t } = useTranslation();

    return (
        <aside
            className="hidden w-12 flex-shrink-0 border-r border-base-300 bg-base-100/70 lg:flex lg:flex-col lg:items-center lg:gap-3 lg:py-4"
            aria-label={t('chat.layout.anchorRail')}
        >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content/50 shadow-sm">
                <ListTree size={15} />
            </div>
            <div className="flex flex-col items-center gap-1 text-[10px] text-base-content/45">
                <span>{anchorCount}</span>
                <span className="leading-none">{t('chat.layout.anchorRail')}</span>
            </div>
            <div className="h-12 w-px rounded-full bg-base-300/80" />
            {activeAnchorLabel && (
                <div className="max-w-full px-1 text-center text-[10px] leading-tight text-base-content/45" title={activeAnchorLabel}>
                    <Circle size={8} className="mx-auto mb-1 text-success/60" />
                    <div className="line-clamp-2 break-words">{activeAnchorLabel}</div>
                </div>
            )}
            <button
                type="button"
                className="btn btn-ghost btn-xs h-7 min-h-0 w-7 rounded-full p-0 text-base-content/45 hover:text-base-content disabled:opacity-30"
                title={t('chat.layout.scrollToTop')}
                aria-label={t('chat.layout.scrollToTop')}
                onClick={onScrollToTop}
                disabled={!hasMessages}
            >
                <ArrowUp size={14} />
            </button>
            <button
                type="button"
                className="btn btn-ghost btn-xs h-7 min-h-0 w-7 rounded-full p-0 text-base-content/45 hover:text-base-content disabled:opacity-30"
                title={t('chat.layout.scrollToBottom')}
                aria-label={t('chat.layout.scrollToBottom')}
                onClick={onScrollToBottom}
                disabled={!hasMessages}
            >
                <ArrowDown size={14} />
            </button>
        </aside>
    );
}
