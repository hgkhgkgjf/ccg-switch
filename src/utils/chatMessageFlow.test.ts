import {describe, expect, it} from 'vitest';
import type {ChatMessage, MessageRaw} from '../types/chat';
import {
    findToolResult,
    getRenderableContentBlocks,
    mergeRawChatMessage,
    shouldRenderChatMessage,
} from './chatMessageFlow';

const userRaw = (content: MessageRaw['message']['content'], uuid = 'user-uuid'): MessageRaw => ({
    type: 'user',
    uuid,
    message: {content},
});

const assistantRaw = (content: MessageRaw['message']['content']): MessageRaw => ({
    type: 'assistant',
    message: {content},
});

describe('chat message flow', () => {
    it('patches a matching user raw message without losing the original content', () => {
        const messages: ChatMessage[] = [
            {
                id: 'u1',
                role: 'user',
                content: 'read package.json',
                createdAt: 100,
            },
            {
                id: 'a1',
                role: 'assistant',
                content: '',
                streaming: true,
                createdAt: 101,
            },
        ];

        const next = mergeRawChatMessage(messages, userRaw([
            {type: 'text', text: 'read package.json'},
        ]));

        expect(next).toHaveLength(2);
        expect(next[0].content).toBe('read package.json');
        expect(next[0].raw?.uuid).toBe('user-uuid');
    });

    it('appends tool_result as a separate user message instead of overwriting the prompt', () => {
        const messages: ChatMessage[] = [
            {
                id: 'u1',
                role: 'user',
                content: 'read package.json',
                createdAt: 100,
            },
            {
                id: 'a1',
                role: 'assistant',
                content: '',
                raw: assistantRaw([
                    {
                        type: 'tool_use',
                        id: 'tool-1',
                        name: 'Read',
                        input: {file_path: 'package.json'},
                    },
                ]),
                streaming: true,
                createdAt: 101,
            },
        ];

        const next = mergeRawChatMessage(
            messages,
            userRaw([
                {
                    type: 'tool_result',
                    tool_use_id: 'tool-1',
                    content: 'file contents',
                    is_error: false,
                },
            ], 'tool-result-msg'),
            {createId: () => 'generated-tool-result-id', now: () => 200},
        );

        expect(next).toHaveLength(3);
        expect(next[0].content).toBe('read package.json');
        expect(next[2]).toMatchObject({
            id: 'generated-tool-result-id',
            role: 'user',
            content: '[tool_result]',
            createdAt: 200,
        });
        expect(next[2].raw?.message.content[0]).toMatchObject({
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: 'file contents',
        });
    });

    it('finds a tool_result in later messages for an assistant tool_use', () => {
        const messages: ChatMessage[] = [
            {
                id: 'u1',
                role: 'user',
                content: 'read package.json',
                createdAt: 100,
            },
            {
                id: 'a1',
                role: 'assistant',
                content: '',
                raw: assistantRaw([
                    {
                        type: 'tool_use',
                        id: 'tool-1',
                        name: 'Read',
                        input: {file_path: 'package.json'},
                    },
                ]),
                createdAt: 101,
            },
            {
                id: 'u2',
                role: 'user',
                content: '[tool_result]',
                raw: userRaw([
                    {
                        type: 'tool_result',
                        tool_use_id: 'tool-1',
                        content: 'file contents',
                        is_error: false,
                    },
                ], 'tool-result-msg'),
                createdAt: 102,
            },
        ];

        expect(findToolResult(messages, 'tool-1', 1)).toMatchObject({
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: 'file contents',
        });
    });

    it('does not render assistant messages that have no visible content', () => {
        const message: ChatMessage = {
            id: 'a-empty',
            role: 'assistant',
            content: '',
            raw: assistantRaw([
                {type: 'text', text: '   '},
            ]),
            createdAt: 100,
        };

        expect(getRenderableContentBlocks(message.raw)).toEqual([]);
        expect(shouldRenderChatMessage(message)).toBe(false);
    });

    it('keeps tool_use messages visible but hides internal tool_result user messages', () => {
        const assistantMessage: ChatMessage = {
            id: 'a-tool',
            role: 'assistant',
            content: '',
            raw: assistantRaw([
                {
                    type: 'tool_use',
                    id: 'tool-1',
                    name: 'Bash',
                    input: {command: 'pwd'},
                },
            ]),
            createdAt: 100,
        };
        const toolResultMessage: ChatMessage = {
            id: 'u-tool-result',
            role: 'user',
            content: '[tool_result]',
            raw: userRaw([
                {
                    type: 'tool_result',
                    tool_use_id: 'tool-1',
                    content: 'C:\\guodevelop\\ccg-switch',
                },
            ]),
            createdAt: 101,
        };

        expect(getRenderableContentBlocks(assistantMessage.raw)).toHaveLength(1);
        expect(shouldRenderChatMessage(assistantMessage)).toBe(true);
        expect(shouldRenderChatMessage(toolResultMessage)).toBe(false);
    });

    it('keeps empty streaming and error messages visible for status feedback', () => {
        expect(shouldRenderChatMessage({
            id: 'a-streaming',
            role: 'assistant',
            content: '',
            streaming: true,
            createdAt: 100,
        })).toBe(true);

        expect(shouldRenderChatMessage({
            id: 'a-error',
            role: 'assistant',
            content: '',
            error: '执行失败',
            createdAt: 101,
        })).toBe(true);
    });
});
