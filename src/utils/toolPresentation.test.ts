import {describe, expect, it} from 'vitest';
import type {ToolResultBlock, ToolUseBlock} from '../types/chat';
import {getToolType} from '../types/tools';
import {
    collectEditToolItems,
    extractAgentToolMeta,
    extractResultText,
    formatToolResultDisplayText,
    getAgentToolExtraParams,
    getToolLineInfo,
    mergeEditToolItemsByFile,
    resolveToolTarget,
    shortenToolIdentifier,
    summarizeAgentToolHeader,
    summarizeAgentToolMeta,
    summarizeBashGroupHeader,
    summarizeBashHeaderResult,
    summarizeCommand,
    summarizeGroupBashItemResult,
    summarizeReadGroupHeader,
    summarizeSearchGroupHeader,
    summarizeSearchResultText,
    summarizeToolResultText,
} from './toolPresentation';

const completedResult: ToolResultBlock = {
    type: 'tool_result',
    tool_use_id: 'tool-1',
    content: 'ok',
};

describe('tool presentation', () => {
    it('summarizes commands by user-visible operation type', () => {
        expect(summarizeCommand('npm run build')).toMatchObject({
            label: 'Build',
            accentClass: 'tool-command-build',
        });
        expect(summarizeCommand('npm test -- src/utils/toolPresentation.test.ts')).toMatchObject({
            label: 'Test',
            accentClass: 'tool-command-test',
        });
        expect(summarizeCommand('Get-Content -Path src/pages/ChatPage.tsx')).toMatchObject({
            label: 'Read',
            accentClass: 'tool-command-read',
        });
        expect(summarizeCommand('rg -n "tool_use" src')).toMatchObject({
            label: 'Search',
            accentClass: 'tool-command-search',
        });
        expect(summarizeCommand('git status --short')).toMatchObject({
            label: 'Git',
            accentClass: 'tool-command-git',
        });
    });

    it('classifies Claude MultiEdit as an edit tool', () => {
        expect(getToolType('MultiEdit')).toBe('edit');
    });

    it('converts read offset and limit into a visible line range', () => {
        expect(getToolLineInfo({offset: 49, limit: 10})).toEqual({
            start: 50,
            end: 59,
        });
    });

    it('strips editor line and column suffixes from clickable file targets', () => {
        const target = resolveToolTarget({file_path: 'src/pages/ChatPage.tsx:122:7'});

        expect(target).toMatchObject({
            rawPath: 'src/pages/ChatPage.tsx:122:7',
            displayPath: 'src/pages/ChatPage.tsx',
            openPath: 'src/pages/ChatPage.tsx',
            lineStart: 122,
        });
        expect(target?.lineEnd).toBeUndefined();
    });

    it('expands a multi-edit input into visible edit list rows', () => {
        const block: ToolUseBlock = {
            type: 'tool_use',
            id: 'tool-1',
            name: 'MultiEdit',
            input: {
                file_path: 'src/AreaInfosDAO.java',
                edits: [
                    {old_string: 'dead code', new_string: ''},
                    {oldString: 'line one\nline two\nline three', newString: ''},
                ],
            },
        };

        const items = collectEditToolItems([block], () => completedResult);

        expect(items).toHaveLength(2);
        expect(items.map((item) => item.displayPath)).toEqual([
            'src/AreaInfosDAO.java',
            'src/AreaInfosDAO.java',
        ]);
        expect(items.map((item) => item.deletions)).toEqual([1, 3]);
        expect(items.map((item) => item.toolId)).toEqual(['tool-1', 'tool-1']);
        expect(items.every((item) => item.isCompleted)).toBe(true);
    });

    it('extracts individual file rows from apply_patch input', () => {
        const block: ToolUseBlock = {
            type: 'tool_use',
            id: 'tool-1',
            name: 'apply_patch',
            input: {
                patch: [
                    '*** Begin Patch',
                    '*** Update File: src/AreaInfosDAO.java',
                    '@@ -1,2 +1,1 @@',
                    ' keep',
                    '-remove',
                    '*** Update File: src/OtherDAO.java',
                    '@@ -5,1 +5,2 @@',
                    ' keep',
                    '+add',
                    '*** End Patch',
                ].join('\n'),
            },
        };

        const items = collectEditToolItems([block], () => completedResult);

        expect(items).toHaveLength(2);
        expect(items.map((item) => item.displayPath)).toEqual([
            'src/AreaInfosDAO.java',
            'src/OtherDAO.java',
        ]);
        expect(items.map((item) => ({additions: item.additions, deletions: item.deletions}))).toEqual([
            {additions: 0, deletions: 1},
            {additions: 1, deletions: 0},
        ]);
    });

    it('keeps patch context for edit hover previews', () => {
        const block: ToolUseBlock = {
            type: 'tool_use',
            id: 'tool-1',
            name: 'apply_patch',
            input: {
                patch: [
                    '*** Begin Patch',
                    '*** Update File: src/example.ts',
                    '@@ -10,3 +10,4 @@',
                    ' keep before',
                    '-remove me',
                    '+add me',
                    '+add another',
                    ' keep after',
                    '*** End Patch',
                ].join('\n'),
            },
        };

        const [item] = collectEditToolItems([block], () => completedResult);

        expect(item).toMatchObject({
            displayPath: 'src/example.ts',
            additions: 2,
            deletions: 1,
            lineStart: 10,
            lineEnd: 12,
        });
        expect(item.diffPreviewLines).toEqual([
            {kind: 'context', oldLineNumber: 10, newLineNumber: 10, text: 'keep before'},
            {kind: 'removed', oldLineNumber: 11, text: 'remove me'},
            {kind: 'added', newLineNumber: 11, text: 'add me'},
            {kind: 'added', newLineNumber: 12, text: 'add another'},
            {kind: 'context', oldLineNumber: 12, newLineNumber: 13, text: 'keep after'},
        ]);
    });

    it('merges repeated edit rows for the same file while preserving total stats and preview lines', () => {
        const blocks: ToolUseBlock[] = [
            {
                type: 'tool_use',
                id: 'patch-1',
                name: 'apply_patch',
                input: {
                    patch: [
                        '*** Begin Patch',
                        '*** Update File: src/styles/toolBlocks.css',
                        '@@ -10,2 +10,4 @@',
                        ' keep',
                        '-old padding',
                        '+new padding',
                        '+new border',
                        '+new shadow',
                        '*** End Patch',
                    ].join('\n'),
                },
            },
            {
                type: 'tool_use',
                id: 'patch-2',
                name: 'apply_patch',
                input: {
                    patch: [
                        '*** Begin Patch',
                        '*** Update File: src\\styles\\toolBlocks.css',
                        '@@ -30,3 +30,2 @@',
                        ' keep again',
                        '-old hover',
                        '-old color',
                        '+new hover',
                        '*** End Patch',
                    ].join('\n'),
                },
            },
        ];

        const items = collectEditToolItems(blocks, () => completedResult);
        const merged = mergeEditToolItemsByFile(items);

        expect(items).toHaveLength(2);
        expect(merged).toHaveLength(1);
        expect(merged[0]).toMatchObject({
            displayPath: 'src/styles/toolBlocks.css',
            openPath: 'src/styles/toolBlocks.css',
            additions: 4,
            deletions: 3,
            lineStart: 10,
            lineEnd: 32,
            isCompleted: true,
            isError: false,
        });
        expect(merged[0].diffPreviewLines.some((line) => line.text === 'new border')).toBe(true);
        expect(merged[0].diffPreviewLines.some((line) => line.text === 'old color')).toBe(true);
    });

    it('extracts clickable files and line numbers from search output', () => {
        const summary = summarizeSearchResultText([
            'src/pages/ChatPage.tsx:122:7:openFile(target.openPath)',
            'src/utils/bridge.ts:18:await invoke("open_file_in_editor")',
            'src/pages/ChatPage.tsx:124:another match',
        ].join('\n'));

        expect(summary).toMatchObject({
            matchCount: 3,
            fileCount: 2,
        });
        expect(summary.files).toEqual([
            {path: 'src/pages/ChatPage.tsx', lineStart: 122, snippet: 'openFile(target.openPath)'},
            {path: 'src/utils/bridge.ts', lineStart: 18, snippet: 'await invoke("open_file_in_editor")'},
            {path: 'src/pages/ChatPage.tsx', lineStart: 124, snippet: 'another match'},
        ]);
    });

    it('extracts Windows search result paths without confusing drive letters for line suffixes', () => {
        const summary = summarizeSearchResultText(
            'C:\\guodevelop\\ccg-switch\\src\\utils\\bridge.ts:18:3:await invoke',
        );

        expect(summary.files).toEqual([
            {path: 'C:\\guodevelop\\ccg-switch\\src\\utils\\bridge.ts', lineStart: 18, snippet: 'await invoke'},
        ]);
    });

    it('formats MCP text-block JSON output into readable multiline tool results', () => {
        const rawOutput = [
            'Wall time: 0.0035 seconds.',
            'Output:',
            JSON.stringify([
                {
                    type: 'text',
                    text: '**src/components/chat/MessageAnchorRail.tsx**\n\n```tsx\n1\timport {useMemo} from "react";\n2\tconst value = 1;\n```',
                },
            ]),
        ].join('\n');

        const formatted = formatToolResultDisplayText(rawOutput);

        expect(formatted).toContain('Wall time: 0.0035 seconds.');
        expect(formatted).toContain('Output:\n**src/components/chat/MessageAnchorRail.tsx**');
        expect(formatted).toContain('1\timport {useMemo} from "react";');
        expect(formatted).not.toContain('\\n2\\tconst value');
        expect(summarizeToolResultText(formatted)).toBe('**src/components/chat/MessageAnchorRail.tsx**…');
    });

    it('formats MCP wrapper objects and escaped codegraph newlines into readable output', () => {
        const formatted = formatToolResultDisplayText(JSON.stringify({
            content: [
                {
                    type: 'text',
                    text: '**src/utils/toolPresentation.ts**\\n\\n```typescript\\n1\\tconst value = 1;\\n2\\tconst next = value + 1;\\n```',
                },
            ],
        }));

        expect(formatted).toContain('**src/utils/toolPresentation.ts**\n\n```typescript');
        expect(formatted).toContain('1\tconst value = 1;');
        expect(formatted).toContain('2\tconst next = value + 1;');
        expect(formatted).not.toContain('\\n2\\tconst next');
    });

    it('extracts text from MCP wrapper object results without exposing raw JSON', () => {
        const text = extractResultText({
            content: {
                content: [
                    {
                        type: 'text',
                        text: 'line 1\\nline 2',
                    },
                ],
            },
        });

        expect(text).toBe('line 1\nline 2');
    });

    it('extracts multiline text from MCP array block results', () => {
        const text = extractResultText({
            content: [
                {
                    type: 'text',
                    text: 'first line\\nsecond line',
                },
                {
                    type: 'text',
                    text: 'third line',
                },
            ],
        });

        expect(text).toBe('first line\nsecond line\nthird line');
    });

    it('falls back to pretty JSON for unknown structured tool result content', () => {
        const text = extractResultText({
            content: {
                status: 'ok',
                count: 2,
            },
        });

        expect(text).toBe(JSON.stringify({status: 'ok', count: 2}, null, 2));
    });

    it('keeps malformed mixed tool result arrays readable', () => {
        const text = extractResultText({
            content: [
                undefined,
                {
                    type: 'text',
                    text: 'usable output',
                },
            ],
        });

        expect(text).toBe('undefined\nusable output');
    });

    it('extracts agent tool metadata from structured spawn-agent results', () => {
        const meta = extractAgentToolMeta(
            {
                description: 'Inspect the current renderer',
                prompt: 'Open the transcript renderer and summarize the gaps',
                nickname: 'worker',
            },
            {
                type: 'tool_result',
                tool_use_id: 'spawn-1',
                content: JSON.stringify({
                    agent_path: '12345678-1234-1234-1234-123456789abc',
                    nickname: 'render-worker',
                    model: 'gpt-5',
                    reasoning_effort: 'high',
                }),
            },
        );

        expect(meta).toMatchObject({
            description: 'Inspect the current renderer',
            prompt: 'Open the transcript renderer and summarize the gaps',
            nickname: 'render-worker',
            model: 'gpt-5',
            reasoningEffort: 'high',
            agentId: '12345678-1234-1234-1234-123456789abc',
        });
    });

    it('falls back to plain-text agent results when structured payloads are absent', () => {
        const meta = extractAgentToolMeta(
            {
                prompt: 'Review chat UI regressions',
                subagent_type: 'reviewer',
            },
            {
                type: 'tool_result',
                tool_use_id: 'agent-1',
                content: 'Created agent 87654321-1234-1234-1234-cba987654321 (gpt-5 medium)',
            },
        );

        expect(meta).toMatchObject({
            prompt: 'Review chat UI regressions',
            subagentType: 'reviewer',
            model: 'gpt-5',
            reasoningEffort: 'medium',
            agentId: '87654321-1234-1234-1234-cba987654321',
        });
    });

    it('builds compact agent transcript summaries from extracted metadata', () => {
        const meta = extractAgentToolMeta(
            {
                description: 'Inspect the transcript renderer',
                prompt: 'Inspect the transcript renderer and summarize follow-up work',
                subagent_type: 'reviewer',
            },
            {
                type: 'tool_result',
                tool_use_id: 'agent-2',
                content: JSON.stringify({
                    nickname: 'render-review',
                    model: 'gpt-5',
                    reasoning_effort: 'medium',
                    agent_id: '87654321-1234-1234-1234-cba987654321',
                }),
            },
        );

        expect(summarizeAgentToolMeta(meta, completedResult, 'agent')).toEqual({
            headerSummary: 'Inspect the transcript renderer',
            identitySummary: 'reviewer · render-review',
            runtimeSummary: 'gpt-5 medium · 87654321…',
            resultSummary: 'ok',
            hasVisibleMeta: true,
        });

        expect(summarizeAgentToolMeta(meta, completedResult, 'task')).toEqual({
            headerSummary: 'Inspect the transcript renderer',
            identitySummary: 'render-review',
            runtimeSummary: 'gpt-5 medium · 87654321…',
            resultSummary: 'ok',
            hasVisibleMeta: true,
        });
    });

    it('builds a compact agent header summary that prefers identity over runtime details', () => {
        const meta = extractAgentToolMeta(
            {
                description: 'Review the transcript renderer',
                prompt: 'Review the transcript renderer and summarize follow-up work',
                subagent_type: 'reviewer',
            },
            {
                type: 'tool_result',
                tool_use_id: 'agent-2',
                content: JSON.stringify({
                    nickname: 'render-review',
                    model: 'gpt-5',
                    reasoning_effort: 'medium',
                    agent_id: '87654321-1234-1234-1234-cba987654321',
                }),
            },
        );

        expect(summarizeAgentToolHeader(meta, completedResult, 'agent')).toEqual({
            primarySummary: 'Review the transcript renderer',
            secondarySummary: 'reviewer · render-review',
            runtimeSummary: 'gpt-5 medium · 87654321…',
            hasVisibleMeta: true,
        });
    });

    it('summarizes grouped bash headers from command state counts', () => {
        const blocks: ToolUseBlock[] = [
            {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'npm run build -- --watch' },
            },
            {
                type: 'tool_use',
                id: 'bash-2',
                name: 'Bash',
                input: { command: 'npm test' },
            },
        ];

        const results = new Map<string, ToolResultBlock>([
            ['bash-1', completedResult],
        ]);

        expect(summarizeBashGroupHeader(blocks, (toolId) => results.get(toolId) ?? null)).toEqual({
            primarySummary: 'npm run build -- --watch',
            completedCount: 1,
            errorCount: 0,
            pendingCount: 1,
            totalCount: 2,
        });
    });

    it('summarizes read group headers from the first visible file target', () => {
        const blocks: ToolUseBlock[] = [
            {
                type: 'tool_use',
                id: 'read-1',
                name: 'Read',
                input: { file_path: 'src/pages/ChatPage.tsx:12:4' },
            },
            {
                type: 'tool_use',
                id: 'read-2',
                name: 'Read',
                input: { file_path: 'src/components/chat/MessageItem.tsx:1:1' },
            },
        ];

        expect(summarizeReadGroupHeader(blocks)).toEqual({
            primarySummary: 'src/pages/ChatPage.tsx',
            secondarySummary: '2 files',
        });
    });

    it('summarizes search group headers from the first query and match stats', () => {
        const summary = summarizeSearchGroupHeader(
            'Glob',
            'src/components/**/*.tsx',
            {
                matchCount: 15,
                fileCount: 3,
                files: [{path: 'src/App.tsx', lineStart: 8}],
            },
        );

        expect(summary).toEqual({
            primarySummary: 'src/components/**/*.tsx',
            secondarySummary: '15 matches · 3 files',
            firstFileSummary: 'src/App.tsx',
        });
    });

    it('keeps multiple visible search result rows from the same file while counting unique files', () => {
        expect(summarizeSearchResultText([
            'src/App.tsx:12:const [value, setValue] = useState(false);',
            'src/App.tsx:48:const [count, setCount] = useState(0);',
        ].join('\n'))).toEqual({
            matchCount: 2,
            fileCount: 1,
            files: [
                {
                    path: 'src/App.tsx',
                    lineStart: 12,
                    snippet: 'const [value, setValue] = useState(false);',
                },
                {
                    path: 'src/App.tsx',
                    lineStart: 48,
                    snippet: 'const [count, setCount] = useState(0);',
                },
            ],
        });
    });

    it('reports omitted search result rows when the visible quick list is capped', () => {
        const summary = summarizeSearchResultText(Array.from(
            {length: 10},
            (_, index) => `src/App.tsx:${index + 1}:match ${index + 1}`,
        ).join('\n'));

        expect(summary.matchCount).toBe(10);
        expect(summary.fileCount).toBe(1);
        expect(summary.files).toHaveLength(8);
        expect(summary.files[summary.files.length - 1]).toMatchObject({
            path: 'src/App.tsx',
            lineStart: 8,
            snippet: 'match 8',
        });
        expect(summary.omittedResultCount).toBe(2);
    });

    it('falls back to tool result summaries when agent inputs do not carry descriptions', () => {
        const meta = extractAgentToolMeta(
            {
                subagentType: 'worker',
            },
            {
                type: 'tool_result',
                tool_use_id: 'agent-3',
                content: 'Created agent 12345678-1234-1234-1234-123456789abc (gpt-5 high)',
            },
        );

        expect(summarizeAgentToolMeta(meta, {
            type: 'tool_result',
            tool_use_id: 'agent-3',
            content: 'Created agent 12345678-1234-1234-1234-123456789abc (gpt-5 high)',
        }, 'agent')).toMatchObject({
            headerSummary: 'Created agent 12345678-1234-1234-1234-123456789abc (gpt-5 high)',
            identitySummary: 'worker',
            runtimeSummary: 'gpt-5 high · 12345678…',
        });
    });

    it('filters task execution extra params through the shared agent meta key list', () => {
        expect(
            getAgentToolExtraParams({
                description: 'Run follow-up checks',
                prompt: 'Run follow-up checks in the subagent',
                model: 'gpt-5',
                reasoningEffort: 'high',
                nickname: 'worker',
                agentId: '12345678-1234-1234-1234-123456789abc',
                cwd: 'C:/guodevelop/ccg-switch',
                approval_policy: 'never',
                retry_count: 2,
            }),
        ).toEqual([
            ['cwd', 'C:/guodevelop/ccg-switch'],
            ['approval_policy', 'never'],
            ['retry_count', 2],
        ]);
    });

    it('shortens long tool identifiers for compact transcript badges', () => {
        expect(shortenToolIdentifier('12345678-1234-1234-1234-123456789abc')).toBe('12345678…');
        expect(shortenToolIdentifier('short-id')).toBe('short-id');
        expect(shortenToolIdentifier('')).toBe('');
    });

    it('summarizes tool results into a single compact header line', () => {
        expect(summarizeToolResultText('  Found   12   matches  \n  in   3 files  ')).toBe('Found 12 matches…');
        expect(summarizeToolResultText('\n\nOperation completed successfully\n')).toBe('Operation completed successfully');
    });

    it('truncates overly long single-line tool results for header display', () => {
        expect(
            summarizeToolResultText('A'.repeat(120), 24),
        ).toBe(`${'A'.repeat(23)}…`);
    });

    it('prefers stdout for successful bash header summaries and stderr for failures', () => {
        expect(summarizeBashHeaderResult({
            exitCode: 0,
            stdout: 'Build completed successfully\nGenerated 4 bundles',
            stderr: '',
        })).toBe('Build completed successfully…');

        expect(summarizeBashHeaderResult({
            exitCode: 1,
            stdout: '',
            stderr: 'src/App.tsx:12:5 - error TS2322: Type mismatch',
        })).toBe('src/App.tsx:12:5 - error TS2322: Type mismatch');
    });

    it('falls back to exit code when bash output is empty', () => {
        expect(summarizeBashHeaderResult({
            exitCode: 2,
            stdout: '',
            stderr: '',
        })).toBe('Exit 2');
    });

    it('summarizes grouped bash items into compact row text', () => {
        expect(summarizeGroupBashItemResult({
            type: 'tool_result',
            tool_use_id: 'bash-1',
            content: JSON.stringify({
                exit_code: 0,
                stdout: 'Vitest passed\n23 tests complete',
                stderr: '',
            }),
        })).toBe('Vitest passed…');

        expect(summarizeGroupBashItemResult({
            type: 'tool_result',
            tool_use_id: 'bash-2',
            is_error: true,
            content: JSON.stringify({
                exit_code: 1,
                stdout: '',
                stderr: 'npm ERR! missing script: lint',
            }),
        })).toBe('npm ERR! missing script: lint');
    });

    it('summarizes bash group headers with a leading command and status counts', () => {
        const blocks: ToolUseBlock[] = [
            {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: {command: 'npm run build -- --watch'},
            },
            {
                type: 'tool_use',
                id: 'bash-2',
                name: 'Bash',
                input: {command: 'npm test'},
            },
            {
                type: 'tool_use',
                id: 'bash-3',
                name: 'Bash',
                input: {command: 'git status --short'},
            },
        ];
        const results = new Map<string, ToolResultBlock>([
            ['bash-1', completedResult],
            ['bash-2', {
                type: 'tool_result',
                tool_use_id: 'bash-2',
                is_error: true,
                content: 'npm ERR! missing script: test',
            }],
        ]);

        expect(summarizeBashGroupHeader(blocks, (toolId) => results.get(toolId) ?? null)).toEqual({
            primarySummary: 'npm run build -- --watch',
            completedCount: 1,
            errorCount: 1,
            pendingCount: 1,
            totalCount: 3,
        });
    });
});
