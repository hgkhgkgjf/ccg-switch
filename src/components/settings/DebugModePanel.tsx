import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Bug, Copy, Trash2 } from 'lucide-react';
import { useConfigStore } from '../../stores/useConfigStore';
import { useChatStore } from '../../stores/useChatStore';
import type { DaemonLogEntry } from '../../types/chat';

function formatLogLine(entry: DaemonLogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const provider = entry.provider ? `[${entry.provider}] ` : '';
    const message = entry.message ? ` ${entry.message}` : '';
    return `${time}  ${provider}${entry.event}${message}`;
}

/**
 * Debug mode toggle + chat daemon diagnostic log viewer.
 *
 * Enabling debug mode persists `config.debugMode`, which makes the chat daemon
 * spawn with `CLAUDE_DEBUG=1` (verbose logs) on its next (re)start. The log
 * viewer surfaces the daemon's lifecycle / SDK / stderr events so failures like
 * an incompatible Node version or a missing SDK show their root cause instead
 * of failing silently.
 */
export default function DebugModePanel() {
    const { t } = useTranslation();
    const { config, saveConfig } = useConfigStore();
    const daemonLogs = useChatStore((s) => s.daemonLogs);
    const clearDaemonLogs = useChatStore((s) => s.clearDaemonLogs);

    const debugMode = config?.debugMode ?? false;

    const handleToggle = async (enabled: boolean) => {
        if (!config) return;
        await saveConfig({ ...config, debugMode: enabled });
    };

    const handleCopy = async () => {
        const text = daemonLogs.map(formatLogLine).join('\n');
        if (!text) return;
        try {
            await invoke('write_clipboard', { text });
        } catch {
            // ignore clipboard failures
        }
    };

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-base-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bug className="w-5 h-5 text-rose-500" />
                    <div>
                        <span className="font-semibold text-gray-900 dark:text-base-content">
                            {t('settings.debug_mode', '调试模式')}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {t('settings.debug_mode_hint', '开启后下方实时显示聊天 daemon 的诊断日志（Node/SDK 加载、错误原因等）；更详细的日志会在下次启动 daemon（重新进入聊天或重启应用）时生效')}
                        </p>
                    </div>
                </div>
                <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={debugMode}
                    onChange={(e) => handleToggle(e.target.checked)}
                />
            </div>

            {debugMode && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-base-200">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('settings.debug_daemon_log', 'Daemon 诊断日志')}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCopy}
                                disabled={daemonLogs.length === 0}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-base-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                {t('settings.debug_copy', '复制')}
                            </button>
                            <button
                                onClick={clearDaemonLogs}
                                disabled={daemonLogs.length === 0}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-base-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('settings.debug_clear', '清空')}
                            </button>
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 dark:bg-base-200 p-3 font-mono text-[11px] leading-5 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                        {daemonLogs.length === 0 ? (
                            <div className="text-gray-400">
                                {t('settings.debug_no_logs', '暂无日志。打开聊天页触发 daemon 启动后，诊断信息会显示在这里。')}
                            </div>
                        ) : (
                            daemonLogs.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={entry.event === 'sdk_load_error' || entry.event === 'stderr'
                                        ? 'text-red-500'
                                        : ''}
                                >
                                    {formatLogLine(entry)}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
