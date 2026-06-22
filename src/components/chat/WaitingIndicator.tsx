import {useTranslation} from 'react-i18next';
import {Loader2} from 'lucide-react';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string): string {
    const translated = t(key);
    return translated === key ? fallback : translated;
}

export default function WaitingIndicator() {
    const { t } = useTranslation();
    const waitingLabel = translateWithFallback(t, 'chat.message.waiting', 'Waiting for response...');

    return (
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-3 py-2 text-sm text-base-content/50" aria-live="polite">
            <Loader2 size={16} className="animate-spin" />
            <span>{waitingLabel}</span>
        </div>
    );
}
