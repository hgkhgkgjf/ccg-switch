import {describe, expect, it} from 'vitest';
import {canReconnectChatDaemon, getChatDaemonDiagnosticText, getChatDaemonStatusKind,} from './chatDaemonStatus';

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
});
