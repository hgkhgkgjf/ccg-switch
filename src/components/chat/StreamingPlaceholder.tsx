import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Loader2} from 'lucide-react';

interface StreamingPlaceholderProps {
    delayMs?: number;
}

export default function StreamingPlaceholder({ delayMs = 350 }: StreamingPlaceholderProps) {
    const { t } = useTranslation();
    const [showConnectedHint, setShowConnectedHint] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setShowConnectedHint(true), delayMs);
        return () => window.clearTimeout(timer);
    }, [delayMs]);

    return (
        <div className="flex items-center gap-2 text-sm text-base-content/50" aria-live="polite">
            <Loader2 size={16} className="animate-spin" />
            <span>
                {showConnectedHint
                    ? t('chat.message.streamingConnected')
                    : t('chat.message.waiting')}
            </span>
        </div>
    );
}
