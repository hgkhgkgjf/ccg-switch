export type ChatDaemonStatusKind = 'ready' | 'starting' | 'offline' | 'error' | 'unknown';

export const CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY = 'chat.daemon.readyTimeoutError';

interface ChatDaemonStatusInput {
    daemonReady: boolean;
    daemonStatus?: string | null;
    daemonReconnecting?: boolean;
}

interface ChatDaemonDiagnosticInput extends ChatDaemonStatusInput {
    error?: string | null;
}

const DAEMON_DIAGNOSTIC_MAX_LENGTH = 140;

function normalizeDiagnosticText(text?: string | null): string | null {
    const normalized = text?.replace(/\s+/g, ' ').trim() ?? '';
    if (!normalized) return null;
    if (normalized.length <= DAEMON_DIAGNOSTIC_MAX_LENGTH) return normalized;
    return `${normalized.slice(0, DAEMON_DIAGNOSTIC_MAX_LENGTH - 3)}...`;
}

function isGenericDaemonStatus(status: string): boolean {
    const normalized = status.trim().toLowerCase();
    return normalized === 'ready'
        || normalized === 'starting'
        || normalized === 'error'
        || normalized === 'failed'
        || normalized === 'shutdown'
        || normalized === 'offline';
}

export function getChatDaemonStatusKind({
    daemonReady,
    daemonStatus,
    daemonReconnecting = false,
}: ChatDaemonStatusInput): ChatDaemonStatusKind {
    if (daemonReady) return 'ready';
    if (daemonReconnecting) return 'starting';

    const status = daemonStatus?.trim().toLowerCase() ?? '';
    if (!status || status === 'ready') return 'starting';
    if (status === 'starting' || status.includes('starting')) return 'starting';
    if (
        status === 'shutdown'
        || status.includes('daemon exited')
        || status.includes('not running')
        || status.includes('offline')
    ) {
        return 'offline';
    }
    if (status.includes('error') || status.includes('failed')) return 'error';
    return 'unknown';
}

export function canReconnectChatDaemon(input: ChatDaemonStatusInput): boolean {
    const kind = getChatDaemonStatusKind(input);
    return kind === 'offline' || kind === 'error';
}

export function getChatDaemonDiagnosticText(input: ChatDaemonDiagnosticInput): string | null {
    const kind = getChatDaemonStatusKind(input);
    if (kind === 'ready' || kind === 'starting') return null;

    const errorText = normalizeDiagnosticText(input.error);
    if (errorText) return errorText;

    const statusText = normalizeDiagnosticText(input.daemonStatus);
    if (!statusText || isGenericDaemonStatus(statusText)) return null;
    return statusText;
}
