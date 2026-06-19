import {describe, expect, it} from 'vitest';
import type {ChatMessage, MessageRaw} from '../types/chat';
import {buildChatStatusSummary, mergeChatInputStatusSummary} from './chatStatusSummary';

function createRawMessage(type: 'user' | 'assistant', content: MessageRaw['message']['content']): MessageRaw {
    return {
        type,
        message: { content },
    };
}

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
    return {
        id: overrides.id ?? 'message-id',
        role: overrides.role ?? 'assistant',
        content: overrides.content ?? '',
        createdAt: overrides.createdAt ?? Date.now(),
        ...overrides,
    };
}

describe('chatStatusSummary', () => {
    it('prefers the latest pending tool as the active activity', () => {
        const messages: ChatMessage[] = [
            createMessage({
                id: 'assistant-1',
                role: 'assistant',
                raw: createRawMessage('assistant', [
                    { type: 'tool_use', id: 'tool-build', name: 'Bash', input: { command: 'npm run build' } },
                ]),
            }),
            createMessage({
                id: 'assistant-2',
                role: 'assistant',
                raw: createRawMessage('assistant', [
                    { type: 'tool_use', id: 'tool-search', name: 'Grep', input: { pattern: 'openFile' } },
                ]),
            }),
            createMessage({
                id: 'tool-result-1',
                role: 'user',
                content: '[tool_result]',
                raw: createRawMessage('user', [
                    { type: 'tool_result', tool_use_id: 'tool-build', content: 'Build completed successfully' },
                ]),
            }),
        ];

        const summary = buildChatStatusSummary(messages);

        expect(summary.activeTool).toMatchObject({
            toolId: 'tool-search',
            type: 'search',
            label: 'Search',
            summary: 'openFile',
            status: 'pending',
        });
        expect(summary.pendingToolCount).toBe(1);
        expect(summary.completedToolCount).toBe(1);
        expect(summary.errorToolCount).toBe(0);
    });

    it('exposes the full tool timeline and agent subset for input status tabs', () => {
        const messages: ChatMessage[] = [
            createMessage({
                id: 'assistant-tools',
                role: 'assistant',
                raw: createRawMessage('assistant', [
                    { type: 'tool_use', id: 'tool-build', name: 'Bash', input: { command: 'npm test' } },
                    {
                        type: 'tool_use',
                        id: 'tool-agent',
                        name: 'Task',
                        input: {
                            description: 'Review the chat composer status strip',
                            subagent_type: 'frontend-reviewer',
                            model: 'claude-sonnet-provider-20260601',
                        },
                    },
                    {
                        type: 'tool_use',
                        id: 'tool-edit',
                        name: 'Edit',
                        input: {
                            file_path: 'src/components/chat/ChatInputStatusTabs.tsx',
                            old_string: '',
                            new_string: 'export function ChatInputStatusTabs() {}',
                        },
                    },
                ]),
            }),
            createMessage({
                id: 'tool-results',
                role: 'user',
                content: '[tool_result]',
                raw: createRawMessage('user', [
                    { type: 'tool_result', tool_use_id: 'tool-build', content: 'Tests passed', is_error: false },
                    { type: 'tool_result', tool_use_id: 'tool-edit', content: 'Applied edit', is_error: false },
                ]),
            }),
        ];

        const summary = buildChatStatusSummary(messages);
        const toolTimeline = summary.toolTimeline ?? [];

        expect(toolTimeline.map((tool) => tool.toolId)).toEqual([
            'tool-build',
            'tool-agent',
            'tool-edit',
        ]);
        expect(toolTimeline.map((tool) => tool.type)).toEqual(['bash', 'agent', 'edit']);
        expect(summary.agentTools).toEqual([
            expect.objectContaining({
                toolId: 'tool-agent',
                type: 'agent',
                summary: 'Review the chat composer status strip',
                detail: 'frontend-reviewer · claude-sonnet-provider-20260601',
                status: 'pending',
            }),
        ]);
    });

    it('aggregates recent edited files with additions and deletions', () => {
        const messages: ChatMessage[] = [
            createMessage({
                id: 'assistant-edit',
                role: 'assistant',
                raw: createRawMessage('assistant', [
                    {
                        type: 'tool_use',
                        id: 'tool-edit-1',
                        name: 'MultiEdit',
                        input: {
                            file_path: 'src/pages/ChatPage.tsx',
                            edits: [
                                { old_string: 'old content', new_string: 'new content' },
                                { old_string: '', new_string: 'inserted line' },
                            ],
                        },
                    },
                    {
                        type: 'tool_use',
                        id: 'tool-edit-2',
                        name: 'Edit',
                        input: {
                            file_path: 'src/components/chat/StatusPanel.tsx',
                            old_string: 'const oldLine = true;',
                            new_string: '',
                        },
                    },
                ]),
            }),
            createMessage({
                id: 'tool-result-edit',
                role: 'user',
                content: '[tool_result]',
                raw: createRawMessage('user', [
                    { type: 'tool_result', tool_use_id: 'tool-edit-1', content: 'Applied edits', is_error: false },
                    { type: 'tool_result', tool_use_id: 'tool-edit-2', content: 'Removed line', is_error: false },
                ]),
            }),
        ];

        const summary = buildChatStatusSummary(messages);

        expect(summary.recentEdits).toHaveLength(2);
        expect(summary.recentEdits[0]).toMatchObject({
            displayPath: 'src/components/chat/StatusPanel.tsx',
            additions: 0,
            deletions: 1,
            status: 'completed',
        });
        expect(summary.recentEdits[0].diffPreviewLines).toEqual([
            expect.objectContaining({
                kind: 'removed',
                text: 'const oldLine = true;',
            }),
        ]);
        expect(summary.recentEdits[1]).toMatchObject({
            displayPath: 'src/pages/ChatPage.tsx',
            additions: 2,
            deletions: 1,
            status: 'completed',
        });
        expect(summary.recentEdits[1].diffPreviewLines).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'removed',
                text: 'old content',
            }),
            expect.objectContaining({
                kind: 'added',
                text: 'new content',
            }),
            expect.objectContaining({
                kind: 'added',
                text: 'inserted line',
            }),
        ]));
        expect(summary.totalAdditions).toBe(2);
        expect(summary.totalDeletions).toBe(2);
        expect(summary.touchedFileCount).toBe(2);
    });

    it('summarizes normalized Codex apply_patch history as recent edits', () => {
        const messages: ChatMessage[] = [
            createMessage({
                id: 'assistant-codex-patch',
                role: 'assistant',
                raw: createRawMessage('assistant', [
                    {
                        type: 'tool_use',
                        id: 'call-patch-1',
                        name: 'apply_patch',
                        input: {
                            patch: [
                                '*** Begin Patch',
                                '*** Update File: src/pages/ChatPage.tsx',
                                '@@ -10,2 +10,3 @@',
                                ' keep',
                                '-remove me',
                                '+add me',
                                '+add another',
                                '*** End Patch',
                            ].join('\n'),
                        },
                    },
                ]),
            }),
            createMessage({
                id: 'tool-result-codex-patch',
                role: 'user',
                content: '[tool_result]',
                raw: createRawMessage('user', [
                    { type: 'tool_result', tool_use_id: 'call-patch-1', content: 'Done!', is_error: false },
                ]),
            }),
        ];

        const summary = buildChatStatusSummary(messages);

        expect(summary.recentEdits).toHaveLength(1);
        expect(summary.recentEdits[0]).toMatchObject({
            displayPath: 'src/pages/ChatPage.tsx',
            additions: 2,
            deletions: 1,
            status: 'completed',
        });
        expect(summary.totalAdditions).toBe(2);
        expect(summary.totalDeletions).toBe(1);
    });

    it('keeps edit totals across all touched files while limiting the visible recent list', () => {
        const toolUses = Array.from({ length: 6 }, (_, index) => ({
            type: 'tool_use' as const,
            id: `tool-edit-${index}`,
            name: 'Edit',
            input: {
                file_path: `src/file-${index}.ts`,
                old_string: '',
                new_string: `line ${index}`,
            },
        }));
        const toolResults = toolUses.map((tool) => ({
            type: 'tool_result' as const,
            tool_use_id: tool.id,
            content: 'Applied edit',
            is_error: false,
        }));
        const messages: ChatMessage[] = [
            createMessage({
                id: 'assistant-many-edits',
                role: 'assistant',
                raw: createRawMessage('assistant', toolUses),
            }),
            createMessage({
                id: 'tool-results-many-edits',
                role: 'user',
                content: '[tool_result]',
                raw: createRawMessage('user', toolResults),
            }),
        ];

        const summary = buildChatStatusSummary(messages);

        expect(summary.recentEdits).toHaveLength(4);
        expect(summary.allEdits).toHaveLength(6);
        expect(summary.recentEdits.map((edit) => edit.displayPath)).toEqual([
            'src/file-5.ts',
            'src/file-4.ts',
            'src/file-3.ts',
            'src/file-2.ts',
        ]);
        expect(summary.allEdits.map((edit) => edit.displayPath)).toEqual([
            'src/file-5.ts',
            'src/file-4.ts',
            'src/file-3.ts',
            'src/file-2.ts',
            'src/file-1.ts',
            'src/file-0.ts',
        ]);
        expect(summary.touchedFileCount).toBe(6);
        expect(summary.totalAdditions).toBe(6);
        expect(summary.totalDeletions).toBe(0);
    });

    it('falls back to the latest finished tool when nothing is pending', () => {
        const messages: ChatMessage[] = [
            createMessage({
                id: 'assistant-read',
                role: 'assistant',
                raw: createRawMessage('assistant', [
                    { type: 'tool_use', id: 'tool-read', name: 'Read', input: { file_path: 'src/pages/ChatPage.tsx:12:4' } },
                ]),
            }),
            createMessage({
                id: 'tool-result-read',
                role: 'user',
                content: '[tool_result]',
                raw: createRawMessage('user', [
                    { type: 'tool_result', tool_use_id: 'tool-read', content: 'Read completed', is_error: false },
                ]),
            }),
        ];

        const summary = buildChatStatusSummary(messages);

        expect(summary.activeTool).toMatchObject({
            toolId: 'tool-read',
            type: 'read',
            label: 'Read',
            summary: 'src/pages/ChatPage.tsx',
            detail: 'L12',
            status: 'completed',
        });
        expect(summary.pendingToolCount).toBe(0);
        expect(summary.completedToolCount).toBe(1);
    });

    it('merges full-history status into the input strip summary without requiring the visible window to contain tools', () => {
        const visibleSummary = buildChatStatusSummary([
            createMessage({
                id: 'latest-user',
                role: 'user',
                raw: createRawMessage('user', [
                    { type: 'text', text: 'What changed?' },
                ]),
            }),
        ]);
        const completeSummary = buildChatStatusSummary([
            createMessage({
                id: 'assistant-early-tools',
                role: 'assistant',
                raw: createRawMessage('assistant', [
                    {
                        type: 'tool_use',
                        id: 'tool-agent-full',
                        name: 'Task',
                        input: {
                            description: 'Audit input status strip',
                            subagent_type: 'frontend-reviewer',
                        },
                    },
                    {
                        type: 'tool_use',
                        id: 'tool-edit-full',
                        name: 'Edit',
                        input: {
                            file_path: 'src/components/chat/ChatInputStatusTabs.tsx',
                            old_string: 'hidden',
                            new_string: 'visible',
                        },
                    },
                ]),
            }),
            createMessage({
                id: 'tool-results-full',
                role: 'user',
                content: '[tool_result]',
                raw: createRawMessage('user', [
                    { type: 'tool_result', tool_use_id: 'tool-edit-full', content: 'Applied edit', is_error: false },
                ]),
            }),
            createMessage({
                id: 'latest-user-full',
                role: 'user',
                raw: createRawMessage('user', [
                    { type: 'text', text: 'What changed?' },
                ]),
            }),
        ]);

        const merged = mergeChatInputStatusSummary(visibleSummary, completeSummary);

        expect(merged.toolTimeline?.map((tool) => tool.toolId)).toEqual([
            'tool-agent-full',
            'tool-edit-full',
        ]);
        expect(merged.agentTools?.map((tool) => tool.toolId)).toEqual(['tool-agent-full']);
        expect(merged.allEdits.map((edit) => edit.displayPath)).toEqual([
            'src/components/chat/ChatInputStatusTabs.tsx',
        ]);
        expect(merged.touchedFileCount).toBe(1);
    });
});
