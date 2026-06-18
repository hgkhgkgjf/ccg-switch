import {describe, expect, it} from 'vitest';
import {getSessionProviderLabel, sessionTitle, shortSessionId} from './chatSessionSidebarUtils';

const t = (key: string): string => {
    const map: Record<string, string> = {
        'history.provider_claude': 'Claude',
        'history.provider_codex': 'Codex',
    };
    return map[key] ?? key;
};

describe('chatSessionSidebarUtils', () => {
    it('uses localized provider labels when available', () => {
        expect(getSessionProviderLabel(t, 'claude')).toBe('Claude');
        expect(getSessionProviderLabel(t, 'codex')).toBe('Codex');
    });

    it('falls back to a readable provider label when translation is missing', () => {
        expect(getSessionProviderLabel(t, 'internal_agent')).toBe('Internal Agent');
        expect(getSessionProviderLabel(t, 'custom')).toBe('Custom');
    });

    it('prefers title then summary then shortened session id', () => {
        expect(sessionTitle({
            sessionId: '1234567890abcdef',
            title: 'Pinned title',
            summary: 'Ignored summary',
        })).toBe('Pinned title');

        expect(sessionTitle({
            sessionId: '1234567890abcdef',
            title: '   ',
            summary: 'Useful summary',
        })).toBe('Useful summary');

        expect(sessionTitle({
            sessionId: '1234567890abcdef123',
            title: '',
            summary: '',
        })).toBe(shortSessionId('1234567890abcdef123'));
    });
});
