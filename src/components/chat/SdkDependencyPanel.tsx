import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { useSdkStore } from '../../stores/useSdkStore';

/**
 * SDK 依赖管理面板 —— 安装 / 卸载 Claude / Codex SDK。
 *
 * SDK 不随应用打包，首次使用需通过本面板用系统 npm 安装到
 * ~/.ccg-switch/ai-bridge-deps/<sdkId>/。
 */
export default function SdkDependencyPanel() {
    const { t } = useTranslation();
    const { statuses, installing, logs, error, init, install, uninstall, refresh } =
        useSdkStore();

    useEffect(() => {
        init();
    }, [init]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-base-content">{t('chat.sdk.title')}</h3>
                <button className="btn btn-ghost btn-xs" onClick={refresh}>
                    <RefreshCw size={14} />
                    {t('chat.sdk.refresh')}
                </button>
            </div>

            <p className="text-sm text-base-content/60">{t('chat.sdk.hint')}</p>

            <div className="space-y-2">
                {statuses.map((sdk) => {
                    const isInstalling = installing === sdk.id;
                    return (
                        <div
                            key={sdk.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-base-300 bg-base-100"
                        >
                            <div className="flex items-center gap-3">
                                {sdk.installed ? (
                                    <CheckCircle2 size={18} className="text-success" />
                                ) : (
                                    <span className="inline-block w-[18px] h-[18px] rounded-full border-2 border-base-300" />
                                )}
                                <div>
                                    <div className="font-medium text-sm">{sdk.displayName}</div>
                                    <div className="text-xs text-base-content/50">
                                        {sdk.installed
                                            ? t('chat.sdk.installed')
                                            : t('chat.sdk.notInstalled')}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {sdk.installed ? (
                                    <button
                                        className="btn btn-ghost btn-sm text-error"
                                        onClick={() => uninstall(sdk.id)}
                                        disabled={!!installing}
                                    >
                                        <Trash2 size={15} />
                                        {t('chat.sdk.uninstall')}
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => install(sdk.id)}
                                        disabled={!!installing}
                                    >
                                        {isInstalling ? (
                                            <Loader2 size={15} className="animate-spin" />
                                        ) : (
                                            <Download size={15} />
                                        )}
                                        {isInstalling
                                            ? t('chat.sdk.installing')
                                            : t('chat.sdk.install')}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {error && <div className="alert alert-error py-2 text-sm">{error}</div>}

            {/* 安装日志 */}
            {(installing || logs.length > 0) && (
                <div className="mockup-code text-xs max-h-48 overflow-y-auto bg-base-300">
                    {logs.length === 0 ? (
                        <pre data-prefix="$">
                            <code>{t('chat.sdk.installing')}...</code>
                        </pre>
                    ) : (
                        logs.map((line, i) => (
                            <pre key={i} data-prefix=">" className="whitespace-pre-wrap">
                                <code>{line}</code>
                            </pre>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
