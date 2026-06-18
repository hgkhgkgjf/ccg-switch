import {describe, expect, it} from 'vitest';
import type {ChatMessage, MessageRaw} from '../../types/chat';
import {
    buildSubagentProcessModel,
    extractSubagentResultRuntimeMeta,
    resolveSubagentHistoryRequest,
    summarizeSubagentProcessToolCall,
} from './subagentHistoryUtils';

describe('resolveSubagentHistoryRequest', () => {
  it('falls back to currentCwd when the active Claude session has no sourcePath yet', () => {
    expect(
      resolveSubagentHistoryRequest({
        sessionId: 'session-42',
        sourcePath: null,
        currentCwd: 'C:/guodevelop/ccg-switch',
        agentId: 'agent-42',
        description: null,
      }),
    ).toEqual({
      requestSessionId: 'session-42',
      requestSourcePath: 'C:/guodevelop/ccg-switch',
      hasAgentIdentity: true,
      canLoad: true,
    });
  });

  it('derives the history session id from a jsonl source path when needed', () => {
    expect(
      resolveSubagentHistoryRequest({
        sessionId: null,
        sourcePath: 'C:/Users/Administrator/.claude/projects/project/session-99.jsonl',
        currentCwd: null,
        agentId: null,
        description: '逆向JetBrains插件后端Java',
      }),
    ).toEqual({
      requestSessionId: 'session-99',
      requestSourcePath: 'C:/Users/Administrator/.claude/projects/project/session-99.jsonl',
      hasAgentIdentity: true,
      canLoad: true,
    });
  });
});

describe('buildSubagentProcessModel', () => {
  it('extracts thought, read files, tool calls and final summary from subagent history messages', () => {
    const assistantTraceRaw: MessageRaw = {
      type: 'assistant',
      timestamp: '2026-06-18T09:00:00.000Z',
      message: {
        content: [
          { type: 'thinking', thinking: '先检查聊天渲染链路。' },
          {
            type: 'tool_use',
            id: 'tool-read-1',
            name: 'Read',
            input: {
              file_path: 'C:/guodevelop/ccg-switch/src/components/chat/MessageList.tsx',
              start_line: 24,
              end_line: 48,
            },
          },
          {
            type: 'tool_use',
            id: 'tool-grep-1',
            name: 'Grep',
            input: {
              pattern: 'subagentHistory',
            },
          },
          { type: 'text', text: '已定位到历史轨迹面板。' },
        ],
      },
    };

    const toolResultRaw: MessageRaw = {
      type: 'user',
      timestamp: '2026-06-18T09:00:01.000Z',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-read-1',
            content: 'file contents',
            is_error: false,
          },
          {
            type: 'tool_result',
            tool_use_id: 'tool-grep-1',
            content: [
              'src/components/toolBlocks/SubagentHistoryPanel.tsx:146: subagentHistory',
              'src/components/toolBlocks/subagentHistoryUtils.ts:432: subagentHistory',
            ].join('\n'),
            is_error: false,
          },
        ],
      },
    };

    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '已定位到历史轨迹面板。',
        raw: assistantTraceRaw,
        createdAt: 1,
      },
      {
        id: 'm2',
        role: 'user',
        content: '[tool_result]',
        raw: toolResultRaw,
        createdAt: 2,
      },
      {
        id: 'm3',
        role: 'assistant',
        content: '已完成轨迹面板接线，并验证了展示结果。',
        createdAt: 3,
      },
    ];

    expect(buildSubagentProcessModel(messages)).toMatchObject({
      thought: '先检查聊天渲染链路。',
      toolUseCount: 2,
      stepCount: 2,
      finalSummary: '已完成轨迹面板接线，并验证了展示结果。',
    });
    expect(buildSubagentProcessModel(messages).readFiles).toEqual([
      {
        id: 'C:/guodevelop/ccg-switch/src/components/chat/MessageList.tsx:24-48',
        openPath: 'C:/guodevelop/ccg-switch/src/components/chat/MessageList.tsx',
        displayPath: '…/src/components/chat/MessageList.tsx',
        lineStart: 24,
        lineEnd: 48,
      },
    ]);
    expect(buildSubagentProcessModel(messages).toolCalls).toEqual([
      expect.objectContaining({
        id: 'tool-grep-1',
        name: 'Grep',
        detail: 'subagentHistory',
        category: 'tool',
        resultSummary: '2 matches in 2 files',
        resultFile: {
          id: 'src/components/toolBlocks/SubagentHistoryPanel.tsx:146',
          openPath: 'src/components/toolBlocks/SubagentHistoryPanel.tsx',
          displayPath: 'src/components/toolBlocks/SubagentHistoryPanel.tsx',
          lineStart: 146,
        },
      }),
    ]);
  });

  it('preserves real file targets for non-read file tools so the summary can open them later', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '已修改文件。',
        raw: {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-edit-1',
                name: 'Edit',
                input: {
                  file_path: 'C:/guodevelop/ccg-switch/src/components/chat/MessageItem.tsx',
                  old_string: 'before',
                  new_string: 'after',
                },
              },
            ],
          },
        },
        createdAt: 1,
      },
    ];

    expect(buildSubagentProcessModel(messages).toolCalls).toEqual([
      {
        id: 'tool-edit-1',
        name: 'Edit',
        category: 'tool',
        target: {
          id: 'C:/guodevelop/ccg-switch/src/components/chat/MessageItem.tsx',
          openPath: 'C:/guodevelop/ccg-switch/src/components/chat/MessageItem.tsx',
          displayPath: '…/src/components/chat/MessageItem.tsx',
        },
      },
    ]);
  });

  it('extracts first file targets from list-like tool results and formats file-count summaries', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '已列出目录内容。',
        raw: {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-list-1',
                name: 'List',
                input: {},
              },
            ],
          },
        },
        createdAt: 1,
      },
      {
        id: 'm2',
        role: 'user',
        content: '[tool_result]',
        raw: {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-list-1',
                content: [
                  'src/components/toolBlocks/subagentHistoryUtils.ts',
                  'src/components/toolBlocks/SubagentHistoryPanel.tsx',
                ].join('\n'),
                is_error: false,
              },
            ],
          },
        },
        createdAt: 2,
      },
    ];

    expect(buildSubagentProcessModel(messages).toolCalls).toEqual([
      expect.objectContaining({
        id: 'tool-list-1',
        name: 'List',
        category: 'tool',
        resultSummary: '2 files',
        resultFile: {
          id: 'src/components/toolBlocks/subagentHistoryUtils.ts',
          openPath: 'src/components/toolBlocks/subagentHistoryUtils.ts',
          displayPath: 'src/components/toolBlocks/subagentHistoryUtils.ts',
        },
      }),
    ]);
  });

  it('uses parsed stdout summaries for command-like tool results instead of raw json blobs', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '已执行命令。',
        raw: {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-bash-1',
                name: 'Bash',
                input: {
                  command: 'npm run build',
                },
              },
            ],
          },
        },
        createdAt: 1,
      },
      {
        id: 'm2',
        role: 'user',
        content: '[tool_result]',
        raw: {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-bash-1',
                content: JSON.stringify({
                  stdout: 'Build completed successfully\nGenerated dist bundle',
                  stderr: '',
                  exit_code: 0,
                }),
                is_error: false,
              },
            ],
          },
        },
        createdAt: 2,
      },
    ];

    expect(buildSubagentProcessModel(messages).toolCalls).toEqual([
      expect.objectContaining({
        id: 'tool-bash-1',
        name: 'Bash',
        detail: 'npm run build',
        category: 'tool',
        resultSummary: 'Build completed successfully…',
      }),
    ]);
  });

  it('uses readable summaries for web-like tool results instead of raw json blobs', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '已抓取页面。',
        raw: {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-web-1',
                name: 'Fetch',
                input: {
                  url: 'https://example.com/docs',
                },
              },
            ],
          },
        },
        createdAt: 1,
      },
      {
        id: 'm2',
        role: 'user',
        content: '[tool_result]',
        raw: {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-web-1',
                content: JSON.stringify({
                  title: 'Example Domain',
                  status: 200,
                  content: 'Example Domain\nThis domain is for use in illustrative examples.',
                }),
                is_error: false,
              },
            ],
          },
        },
        createdAt: 2,
      },
    ];

    expect(buildSubagentProcessModel(messages).toolCalls).toEqual([
      expect.objectContaining({
        id: 'tool-web-1',
        name: 'Fetch',
        detail: 'https://example.com/docs',
        category: 'tool',
        resultSummary: 'Example Domain',
      }),
    ]);
  });

  it('formats glob-like tool results as file counts instead of match counts', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '已列出匹配文件。',
        raw: {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-glob-1',
                name: 'Glob',
                input: {
                  pattern: 'src/components/**/*.tsx',
                },
              },
            ],
          },
        },
        createdAt: 1,
      },
      {
        id: 'm2',
        role: 'user',
        content: '[tool_result]',
        raw: {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-glob-1',
                content: [
                  'src/components/toolBlocks/SubagentHistoryPanel.tsx',
                  'src/components/toolBlocks/subagentHistoryUtils.ts',
                ].join('\n'),
                is_error: false,
              },
            ],
          },
        },
        createdAt: 2,
      },
    ];

    expect(buildSubagentProcessModel(messages).toolCalls).toEqual([
      expect.objectContaining({
        id: 'tool-glob-1',
        name: 'Glob',
        detail: 'src/components/**/*.tsx',
        category: 'tool',
        resultSummary: '2 files',
        resultFile: {
          id: 'src/components/toolBlocks/SubagentHistoryPanel.tsx',
          openPath: 'src/components/toolBlocks/SubagentHistoryPanel.tsx',
          displayPath: 'src/components/toolBlocks/SubagentHistoryPanel.tsx',
        },
      }),
    ]);
  });

  it('uses human-readable fields from generic json tool results instead of raw blobs', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '已完成部署。',
        raw: {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-generic-1',
                name: 'ToolSearch',
                input: {
                  query: 'deployment logs',
                },
              },
            ],
          },
        },
        createdAt: 1,
      },
      {
        id: 'm2',
        role: 'user',
        content: '[tool_result]',
        raw: {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-generic-1',
                content: JSON.stringify({
                  status: 'ok',
                  message: 'Deployment finished successfully',
                  details: '2 services restarted',
                }),
                is_error: false,
              },
            ],
          },
        },
        createdAt: 2,
      },
    ];

    expect(buildSubagentProcessModel(messages).toolCalls).toEqual([
      expect.objectContaining({
        id: 'tool-generic-1',
        name: 'ToolSearch',
        detail: 'deployment logs',
        category: 'tool',
        resultSummary: 'Deployment finished successfully',
      }),
    ]);
  });

  it('keeps the final summary short even when the assistant result is multi-line', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '第一行结果\n第二行结果',
        createdAt: 1,
      },
    ];

    expect(buildSubagentProcessModel(messages)).toMatchObject({
      finalSummary: '第一行结果',
      stepCount: 0,
      toolUseCount: 0,
    });
  });

  it('uses the real output summary instead of the runtime json prefix when only tool result text exists', () => {
    const runtimeMeta = extractSubagentResultRuntimeMeta({
      type: 'tool_result',
      tool_use_id: 'task-1',
      is_error: false,
      content: `${JSON.stringify({
        totalDurationMs: 1200,
        totalTokens: 3456,
        totalToolUseCount: 7,
      })}\n最终输出第一行\n最终输出第二行`,
    });

    expect(buildSubagentProcessModel([], runtimeMeta)).toMatchObject({
      finalSummary: '最终输出第一行…',
      totalTokens: 3456,
      totalToolUseCount: 7,
    });
  });

  it('maps subagent tool calls to cc-gui-like operation rows', () => {
    expect(summarizeSubagentProcessToolCall({
      id: 'tool-read-1',
      name: 'Read',
      detail: '…/src/App.tsx',
      category: 'tool',
    })).toMatchObject({
      label: 'Read',
      accentClass: 'tool-command-read',
      iconKind: 'read',
    });

    expect(summarizeSubagentProcessToolCall({
      id: 'tool-grep-1',
      name: 'Grep',
      detail: 'subagentHistory',
      category: 'tool',
    })).toMatchObject({
      label: 'Search',
      accentClass: 'tool-command-search',
      iconKind: 'search',
    });
  });
});
