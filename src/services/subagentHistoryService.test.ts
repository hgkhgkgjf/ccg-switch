import {describe, expect, it, vi} from 'vitest';
import {loadClaudeSubagentHistory} from './subagentHistoryService';

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
}));

describe('subagentHistoryService', () => {
    it('forwards the Claude subagent history lookup payload to Tauri', async () => {
        tauriMocks.invoke.mockResolvedValue([]);

        await loadClaudeSubagentHistory({
            sessionId: 'session-1',
            sourcePath: 'C:/Users/Administrator/.claude/projects/C--guodevelop-ccg-switch/parent-session.jsonl',
            agentId: 'agent-a12c75a82930fb687',
            description: '逆向JetBrains插件后端Java',
        });

        expect(tauriMocks.invoke).toHaveBeenCalledWith('get_claude_subagent_session_messages', {
            sessionId: 'session-1',
            sourcePath: 'C:/Users/Administrator/.claude/projects/C--guodevelop-ccg-switch/parent-session.jsonl',
            agentId: 'agent-a12c75a82930fb687',
            description: '逆向JetBrains插件后端Java',
        });
    });
});
