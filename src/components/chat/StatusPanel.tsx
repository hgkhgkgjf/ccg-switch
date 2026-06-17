import {Activity} from 'lucide-react';
import {useTranslation} from 'react-i18next';

interface StatusPanelProps {
    provider: string;
    messageCount: number;
    daemonReady: boolean;
}

export default function StatusPanel({ provider, messageCount, daemonReady }: StatusPanelProps) {
    const { t } = useTranslation();

    return (
        <aside className="hidden w-56 flex-shrink-0 border-l border-base-300 bg-base-100/70 p-3 xl:block">
            <div className="rounded-xl border border-base-300 bg-base-200/30 p-3 text-xs text-base-content/60">
                <div className="mb-2 flex items-center gap-2 font-medium text-base-content/70">
                    <Activity size={14} />
                    <span>{t('chat.layout.statusPanel')}</span>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.providerLabel')}</span>
                        <span className="font-medium text-base-content/70">{provider}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.layout.messageCount')}</span>
                        <span className="font-medium text-base-content/70">{messageCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>{t('chat.ready')}</span>
                        <span className={daemonReady ? 'font-medium text-success' : 'font-medium text-warning'}>
                            {daemonReady ? t('common.success') : t('chat.starting')}
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
