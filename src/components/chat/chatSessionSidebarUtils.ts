import type {SessionMeta} from '../../types/session';

export function formatShortDate(value: number | string | null): string {
    if (value === null) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function shortSessionId(sessionId: string): string {
    return sessionId.length <= 16
        ? sessionId
        : `${sessionId.slice(0, 7)}...${sessionId.slice(-5)}`;
}

export function sessionTitle(session: Pick<SessionMeta, 'sessionId' | 'title' | 'summary'>): string {
    const title = session.title?.trim();
    if (title) return title;

    const summary = session.summary?.trim();
    if (summary) return summary;

    return shortSessionId(session.sessionId);
}

export function getSessionProviderLabel(
    t: (key: string) => string,
    providerId: string,
): string {
    const normalized = providerId.trim().toLowerCase();
    const translated = t(`history.provider_${normalized}`);
    if (translated !== `history.provider_${normalized}`) {
        return translated;
    }

    return normalized
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
