import {describe, expect, it} from 'vitest';
import type {ChatMessage} from '../types/chat';
import {
    filterRenderableMessages,
    getAnchorPreview,
    getAnchorPreviewLabel,
    getMessageSearchText,
    getRenderableMessages,
    getVisibleAnchorMessages,
    isMessageAnchorCandidate,
} from './chatNavigation';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
    return {
        id: overrides.id ?? 'message-id',
        role: overrides.role ?? 'user',
        content: overrides.content ?? '',
        createdAt: overrides.createdAt ?? Date.now(),
        ...overrides,
    };
}

describe('chatNavigation', () => {
    it('builds search text from raw content blocks as well as top-level content', () => {
        const message = createMessage({
            role: 'assistant',
            content: '',
            raw: {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Search helper text' },
                        { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'src/App.tsx' } },
                    ],
                },
            },
        });

        const searchText = getMessageSearchText(message);

        expect(searchText).toContain('search helper text');
        expect(searchText).toContain('read');
        expect(searchText).toContain('src/app.tsx');
    });

    it('filters renderable messages with the normalized search query and hides system prompts', () => {
        const messages = [
            createMessage({ id: '1', role: 'user', content: 'first prompt' }),
            createMessage({ id: '2', role: 'assistant', content: 'second answer' }),
            createMessage({ id: '3', role: 'system', content: 'hidden', raw: undefined }),
        ];

        const renderableMessages = getRenderableMessages(messages);
        const filtered = filterRenderableMessages(renderableMessages, 'second');

        expect(renderableMessages).toHaveLength(2);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].message.id).toBe('2');
    });

    it('summarizes user messages into compact anchor labels', () => {
        const message = createMessage({
            content: '这是一个很长的用户输入，需要在导航锚点里截断显示，避免把整个侧栏撑满，同时保留足够的上下文信息。',
        });

        const preview = getAnchorPreview(message, '消息锚点', 24);
        const label = getAnchorPreviewLabel(message, '消息锚点', 24);

        expect(preview).toEqual({
            label: '这是一个很长的用户输入，需要在导航锚点里截断显示...',
            kind: 'text',
        });
        expect(label).toBe('这是一个很长的用户输入，需要在导航锚点里截断显示...'); 
    });

    it('falls back when the message has no readable text', () => {
        const message = createMessage({ content: '   ' });

        expect(getAnchorPreview(message, '消息锚点')).toEqual({
            label: '消息锚点',
            kind: 'empty',
        });
        expect(getAnchorPreviewLabel(message, '消息锚点')).toBe('消息锚点');
    });

    it('uses image raw blocks when building anchor labels and search text', () => {
        const message = createMessage({
            content: '',
            raw: {
                type: 'user',
                message: {
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: 'iVBORw0KGgo=',
                            },
                            fileName: 'screen.png',
                        },
                        { type: 'text', text: '这张截图里有什么问题？' },
                    ],
                },
            },
        });

        expect(getAnchorPreview(message, '消息锚点')).toEqual({
            label: '图片 screen.png · 这张截图里有什么问题？',
            kind: 'mixed',
        });
        expect(getAnchorPreviewLabel(message, '消息锚点')).toBe('图片 screen.png · 这张截图里有什么问题？');
        expect(getMessageSearchText(message)).toContain('screen.png');
    });

    it('omits Codex image placeholder tags from anchor labels and search text', () => {
        const message = createMessage({
            content: '<image name=[Image #1]>\n</image>\n截图里的按钮太大了',
            raw: {
                type: 'user',
                message: {
                    content: [
                        { type: 'text', text: '<image name=[Image #1]>' },
                        {
                            type: 'input_image',
                            image_url: 'file:///C:/Users/Administrator/Pictures/screen.png',
                        },
                        { type: 'text', text: '</image>' },
                        { type: 'text', text: '截图里的按钮太大了' },
                    ],
                },
            },
        });

        expect(getAnchorPreview(message, '消息锚点')).toEqual({
            label: '图片 screen.png · 截图里的按钮太大了',
            kind: 'mixed',
        });
        expect(getMessageSearchText(message)).toContain('screen.png');
        expect(getMessageSearchText(message)).toContain('截图里的按钮太大了');
        expect(getMessageSearchText(message)).not.toContain('<image name=');
    });

    it('marks image-only anchors as image anchors', () => {
        const message = createMessage({
            content: '',
            raw: {
                type: 'user',
                message: {
                    content: [
                        {
                            type: 'input_image',
                            image_url: { url: 'file:///C:/tmp/screen.png' },
                            fileName: 'screen.png',
                        },
                    ],
                },
            },
        });

        expect(getAnchorPreview(message, '消息锚点')).toEqual({
            label: '图片 screen.png',
            kind: 'image',
        });
    });

    it('excludes Codex internal user tool results and blank user messages from anchor candidates', () => {
        const toolResultMessage = createMessage({
            id: 'tool-result',
            role: 'user',
            content: '[tool_result]',
            raw: {
                type: 'user',
                message: {
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: 'call-1',
                            content: 'command output',
                        },
                    ],
                },
            },
        });
        const blankUserMessage = createMessage({
            id: 'blank-user',
            role: 'user',
            content: '   ',
        });
        const promptMessage = createMessage({
            id: 'real-user',
            role: 'user',
            content: '继续推进任务',
        });

        expect(isMessageAnchorCandidate(toolResultMessage)).toBe(false);
        expect(isMessageAnchorCandidate(blankUserMessage)).toBe(false);
        expect(isMessageAnchorCandidate(promptMessage)).toBe(true);
    });

    it('excludes protocol context text from anchor candidates even when raw content has readable text', () => {
        const protocolMessage = createMessage({
            id: 'protocol-context',
            role: 'user',
            content: 'Visible wrapper text',
            raw: {
                type: 'user',
                message: {
                    content: [
                        {
                            type: 'text',
                            text: '<environment_context>\n  <cwd>C:\\guodevelop\\ccg-switch</cwd>\n</environment_context>',
                        },
                    ],
                },
            },
        });

        expect(isMessageAnchorCandidate(protocolMessage)).toBe(false);
    });

    it('excludes Codex control markers from anchor candidates', () => {
        const turnAbortedMessage = createMessage({
            id: 'turn-aborted',
            role: 'user',
            content: '<turn_aborted>',
            raw: {
                type: 'user',
                message: {
                    content: [
                        {
                            type: 'text',
                            text: '<turn_aborted>',
                        },
                    ],
                },
            },
        });
        const userActionMessage = createMessage({
            id: 'user-action',
            role: 'user',
            content: '<user_action>\n<context>User initiated a review task.</context>\n</user_action>',
            raw: {
                type: 'user',
                message: {
                    content: [
                        {
                            type: 'text',
                            text: '<user_action>\n<context>User initiated a review task.</context>\n</user_action>',
                        },
                    ],
                },
            },
        });

        expect(isMessageAnchorCandidate(turnAbortedMessage)).toBe(false);
        expect(isMessageAnchorCandidate(userActionMessage)).toBe(false);
    });

    it('excludes handoff summaries from renderable messages and anchors', () => {
        const handoffMessage = createMessage({
            id: 'handoff-context',
            role: 'user',
            content: 'Another language model started to solve this problem and produced a summary of its thinking process.\n\n## Handoff Summary\n\n- Current task: continue Chat UI parity.',
            raw: {
                type: 'user',
                message: {
                    content: [
                        {
                            type: 'text',
                            text: 'Another language model started to solve this problem and produced a summary of its thinking process.\n\n## Handoff Summary\n\n- Current task: continue Chat UI parity.',
                        },
                    ],
                },
            },
        });
        const realPrompt = createMessage({
            id: 'real-prompt',
            role: 'user',
            content: '继续推进任务',
        });

        expect(getRenderableMessages([handoffMessage, realPrompt]).map(({message}) => message.id)).toEqual(['real-prompt']);
        expect(isMessageAnchorCandidate(handoffMessage)).toBe(false);
    });

    it('builds anchor candidates from the currently revealed message window', () => {
        const messages = Array.from({length: 6}, (_, index) => createMessage({
            id: `message-${index + 1}`,
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: `message ${index + 1}`,
        }));
        const renderableMessages = getRenderableMessages(messages);

        expect(getVisibleAnchorMessages(renderableMessages, 2).map(({message}) => message.id)).toEqual([
            'message-3',
            'message-4',
            'message-5',
            'message-6',
        ]);
        expect(getVisibleAnchorMessages(renderableMessages, -1)).toHaveLength(6);
    });
});
