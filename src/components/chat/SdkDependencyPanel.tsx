import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {CheckCircle2, Download, Loader2, RefreshCw, Trash2} from 'lucide-react';
import {useSdkStore} from '../../stores/useSdkStore';

const SDK_DEPENDENCY_PANEL_FALLBACKS = {
    title: 'SDK Dependencies',
    close: 'Close',
    refresh: 'Refresh',
    hint: 'Install or repair the Claude/Codex SDK dependencies used by Chat.',
    installed: 'Installed',
    notInstalled: 'Not installed',
    uninstall: 'Uninstall',
    installing: 'Installing...',
    install: 'Install',
};

type TranslateFn = (key: string) => string;

function translateWithFallback(t: TranslateFn, key: string, fallback: string): string {
    const translated = t(key);
    return translated === key ? fallback : translated;
}

export function getSdkDependencyPanelLabels(t: TranslateFn) {
    return {
        title: translateWithFallback(t, 'chat.sdk.title', SDK_DEPENDENCY_PANEL_FALLBACKS.title),
        close: translateWithFallback(t, 'common.close', SDK_DEPENDENCY_PANEL_FALLBACKS.close),
        refresh: translateWithFallback(t, 'chat.sdk.refresh', SDK_DEPENDENCY_PANEL_FALLBACKS.refresh),
        hint: translateWithFallback(t, 'chat.sdk.hint', SDK_DEPENDENCY_PANEL_FALLBACKS.hint),
        installed: translateWithFallback(t, 'chat.sdk.installed', SDK_DEPENDENCY_PANEL_FALLBACKS.installed),
        notInstalled: translateWithFallback(t, 'chat.sdk.notInstalled', SDK_DEPENDENCY_PANEL_FALLBACKS.notInstalled),
        uninstall: translateWithFallback(t, 'chat.sdk.uninstall', SDK_DEPENDENCY_PANEL_FALLBACKS.uninstall),
        installing: translateWithFallback(t, 'chat.sdk.installing', SDK_DEPENDENCY_PANEL_FALLBACKS.installing),
        install: translateWithFallback(t, 'chat.sdk.install', SDK_DEPENDENCY_PANEL_FALLBACKS.install),
    };
}

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
    const labels = getSdkDependencyPanelLabels(t);

    useEffect(() => {
        init();
    }, [init]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-base-content">{labels.title}</h3>
                <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    title={labels.refresh}
                    aria-label={labels.refresh}
                    onClick={refresh}
                >
                    <RefreshCw size={14} />
                    {labels.refresh}
                </button>
            </div>

            <p className="text-sm text-base-content/60">{labels.hint}</p>

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
                                            ? labels.installed
                                            : labels.notInstalled}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {sdk.installed ? (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm text-error"
                                        title={labels.uninstall}
                                        aria-label={`${labels.uninstall}: ${sdk.displayName}`}
                                        onClick={() => uninstall(sdk.id)}
                                        disabled={!!installing}
                                    >
                                        <Trash2 size={15} />
                                        {labels.uninstall}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        title={isInstalling ? labels.installing : labels.install}
                                        aria-label={`${isInstalling ? labels.installing : labels.install}: ${sdk.displayName}`}
                                        onClick={() => install(sdk.id)}
                                        disabled={!!installing}
                                    >
                                        {isInstalling ? (
                                            <Loader2 size={15} className="animate-spin" />
                                        ) : (
                                            <Download size={15} />
                                        )}
                                        {isInstalling
                                            ? labels.installing
                                            : labels.install}
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
                            <code>{labels.installing}</code>
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
