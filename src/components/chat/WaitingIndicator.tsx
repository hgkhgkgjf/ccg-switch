import {useTranslation} from 'react-i18next';
import {Loader2} from 'lucide-react';

export default function WaitingIndicator() {
    const { t } = useTranslation();

    return (
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-3 py-2 text-sm text-base-content/50" aria-live="polite">
            <Loader2 size={16} className="animate-spin" />
            <span>{t('chat.message.waiting')}</span>
        </div>
    );
}
