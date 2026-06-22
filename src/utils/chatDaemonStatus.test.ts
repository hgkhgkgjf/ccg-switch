import {describe, expect, it} from 'vitest';
import {
    canReconnectChatDaemon,
    CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY,
    getChatDaemonDiagnosticDisplayText,
    getChatDaemonDiagnosticText,
    getChatDaemonReconnectLabel,
    getChatDaemonReconnectShortLabel,
    getChatDaemonStatusKind,
    getChatDaemonStatusText,
} from './chatDaemonStatus';

describe('chatDaemonStatus', () => {
    it('treats ready state as healthy regardless of stale status text', () => {
        expect(getChatDaemonStatusKind({
            daemonReady: true,
            daemonStatus: 'shutdown',
        })).toBe('ready');
        expect(canReconnectChatDaemon({
            daemonReady: true,
            daemonStatus: 'shutdown',
        })).toBe(false);
    });

    it('maps shutdown and daemon-exited messages to offline', () => {
        expect(getChatDaemonStatusKind({
            daemonReady: false,
            daemonStatus: 'shutdown',
        })).toBe('offline');
        expect(getChatDaemonStatusKind({
            daemonReady: false,
            daemonStatus: 'daemon exited',
        })).toBe('offline');
        expect(canReconnectChatDaemon({
            daemonReady: false,
            daemonStatus: 'shutdown',
        })).toBe(true);
    });

    it('keeps manual reconnect in starting state without showing another reconnect action', () => {
        expect(getChatDaemonStatusKind({
            daemonReady: false,
            daemonStatus: 'shutdown',
            daemonReconnecting: true,
        })).toBe('starting');
        expect(canReconnectChatDaemon({
            daemonReady: false,
            daemonStatus: 'shutdown',
            daemonReconnecting: true,
        })).toBe(false);
    });

    it('maps failed/error status to error and allows reconnect', () => {
        expect(getChatDaemonStatusKind({
            daemonReady: false,
            daemonStatus: 'start failed: node missing',
        })).toBe('error');
        expect(canReconnectChatDaemon({
            daemonReady: false,
            daemonStatus: 'start failed: node missing',
        })).toBe(true);
    });

    it('keeps daemon status text readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getChatDaemonStatusText({
            daemonReady: true,
            daemonStatus: 'shutdown',
            translate: keyOnlyTranslate,
        })).toBe('Ready');

        expect(getChatDaemonStatusText({
            daemonReady: false,
            daemonStatus: 'shutdown',
            translate: keyOnlyTranslate,
        })).toBe('Offline');

        expect(getChatDaemonStatusText({
            daemonReady: false,
            daemonStatus: 'start failed: node missing',
            translate: keyOnlyTranslate,
        })).toBe('Daemon error');

        expect(getChatDaemonStatusText({
            daemonReady: false,
            daemonStatus: null,
            translate: keyOnlyTranslate,
        })).toBe('Starting');
    });

    it('keeps meaningful unknown daemon status text instead of replacing it', () => {
        expect(getChatDaemonStatusText({
            daemonReady: false,
            daemonStatus: 'waiting for socket handoff',
            translate: () => 'unused',
        })).toBe('waiting for socket handoff');
    });

    it('keeps daemon reconnect action labels readable when translations return keys', () => {
        const keyOnlyTranslate = (key: string) => key;

        expect(getChatDaemonReconnectLabel({
            daemonReconnecting: false,
            translate: keyOnlyTranslate,
        })).toBe('Reconnect daemon');

        expect(getChatDaemonReconnectLabel({
            daemonReconnecting: true,
            translate: keyOnlyTranslate,
        })).toBe('Reconnecting daemon');

        expect(getChatDaemonReconnectShortLabel({
            daemonReconnecting: false,
            translate: keyOnlyTranslate,
        })).toBe('Reconnect');

        expect(getChatDaemonReconnectShortLabel({
            daemonReconnecting: true,
            translate: keyOnlyTranslate,
        })).toBe('Reconnecting');
    });

    it('returns null diagnostics for ready, starting, and reconnecting states', () => {
        expect(getChatDaemonDiagnosticText({
            daemonReady: true,
            daemonStatus: 'shutdown',
            error: 'Error: stale failure',
        })).toBeNull();
        expect(getChatDaemonDiagnosticText({
            daemonReady: false,
            daemonStatus: null,
            error: 'Error: still warming up',
        })).toBeNull();
        expect(getChatDaemonDiagnosticText({
            daemonReady: false,
            daemonStatus: 'shutdown',
            daemonReconnecting: true,
            error: 'Error: reconnecting',
        })).toBeNull();
    });

    it('prefers explicit error text for failed daemon diagnostics', () => {
        expect(getChatDaemonDiagnosticText({
            daemonReady: false,
            daemonStatus: 'error',
            error: 'Error: node executable not found',
        })).toBe('Error: node executable not found');
    });

    it('uses meaningful non-generic status text when no error is available', () => {
        expect(getChatDaemonDiagnosticText({
            daemonReady: false,
            daemonStatus: 'daemon exited with code 1',
            error: null,
        })).toBe('daemon exited with code 1');
        expect(getChatDaemonDiagnosticText({
            daemonReady: false,
            daemonStatus: 'error',
            error: null,
        })).toBeNull();
    });

    it('collapses whitespace and caps long daemon diagnostics', () => {
        const diagnostic = getChatDaemonDiagnosticText({
            daemonReady: false,
            daemonStatus: 'error',
            error: `Error: ${'missing '.repeat(40)}`,
        });

        expect(diagnostic).not.toContain('\n');
        expect(diagnostic).toHaveLength(140);
        expect(diagnostic?.endsWith('...')).toBe(true);
    });

    it('keeps frontend-generated daemon diagnostics readable when translations return keys', () => {
        expect(getChatDaemonDiagnosticDisplayText({
            diagnosticText: CHAT_DAEMON_READY_TIMEOUT_ERROR_KEY,
            translate: (key) => key,
        })).toBe('Daemon did not become ready in time');

        expect(getChatDaemonDiagnosticDisplayText({
            diagnosticText: 'Error: node executable not found',
            translate: () => 'unused',
        })).toBe('Error: node executable not found');

        expect(getChatDaemonDiagnosticDisplayText({
            diagnosticText: null,
            translate: () => 'unused',
        })).toBeNull();
    });
});
