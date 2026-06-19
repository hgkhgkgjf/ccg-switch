import {describe, expect, it} from 'vitest';
import {
    buildChatMcpConnectivityState,
    type ChatMcpStatusResult,
    normalizeChatMcpConnectivityError,
} from './chatMcpConnectivity';

describe('chatMcpConnectivity', () => {
    it('indexes live MCP results by server id', () => {
        const results: ChatMcpStatusResult[] = [
            {serverId: 'filesystem', status: 'online', message: null, latencyMs: 32},
            {serverId: 'memory', status: 'timeout', message: 'Process detection timed out (5s)', latencyMs: 5000},
        ];

        const state = buildChatMcpConnectivityState({
            checking: false,
            checkedAt: 1710000000000,
            error: null,
            results,
        });

        expect(state.resultByServerId.filesystem).toEqual(results[0]);
        expect(state.resultByServerId.memory).toEqual(results[1]);
        expect(state.hasResults).toBe(true);
        expect(state.checkedAt).toBe(1710000000000);
    });

    it('normalizes command errors for compact status-panel display', () => {
        const normalized = normalizeChatMcpConnectivityError(`  ${'failed to check mcp '.repeat(20)}  `);

        expect(normalized).not.toBeNull();
        expect(normalized).not.toContain('  ');
        expect(normalized?.length).toBeLessThanOrEqual(140);
        expect(normalized?.endsWith('...')).toBe(true);
    });
});
