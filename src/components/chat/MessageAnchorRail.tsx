import {ArrowDown, ArrowUp, ListTree} from 'lucide-react';
import {useTranslation} from 'react-i18next';

interface MessageAnchorRailProps {
    hasMessages: boolean;
    onScrollToTop: () => void;
    onScrollToBottom: () => void;
}

export default function MessageAnchorRail({
    hasMessages,
    onScrollToTop,
    onScrollToBottom,
}: MessageAnchorRailProps) {
    const { t } = useTranslation();

    return (
        <aside
            className="hidden w-10 flex-shrink-0 border-r border-base-300 bg-base-100/70 lg:flex lg:flex-col lg:items-center lg:gap-3 lg:py-4"
            aria-label={t('chat.layout.anchorRail')}
        >
            <ListTree size={16} className="text-base-content/40" />
            <div className="h-12 w-px rounded-full bg-base-300" />
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
