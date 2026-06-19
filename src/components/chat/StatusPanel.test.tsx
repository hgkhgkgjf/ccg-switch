import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import StatusPanel from './StatusPanel';
import {type ChatStatusSummary, getChatStatusEditKey} from '../../utils/chatStatusSummary';

describe('StatusPanel', () => {
    it('renders runtime context for model, mode, workspace, and SDK readiness', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady
                model="claude-sonnet-4-6"
                permissionMode="bypassPermissions"
                reasoningEffort="high"
                currentCwd="C:/guodevelop/ccg-switch"
                sdkStatus={{
                    id: 'claude-sdk',
                    displayName: 'Claude Code SDK',
                    installed: true,
                    path: 'C:/deps/claude-sdk',
                }}
            />,
        );

        expect(html).toContain('status-runtime-context');
        expect(html).toContain('status-runtime-context-grid');
        expect((html.match(/status-runtime-context-item/g) ?? []).length).toBe(5);
        expect(html).toContain('status-runtime-context-value');
        expect(html).toContain('claude-sonnet-4-6');
        expect(html).toMatch(/Auto Mode|自动模式/i);
        expect(html).toMatch(/High|高/i);
        expect(html).toContain('C:/guodevelop/ccg-switch');
        expect(html).toContain('Claude Code SDK');
        expect(html).toMatch(/Installed|已安装/i);
    });

    it('consolidates tool counts into the current activity card header', () => {
        const statusSummary: ChatStatusSummary = {
            activeTool: {
                toolId: 'tool-bash',
                type: 'bash',
                label: 'Bash',
                accentClass: 'accent-terminal',
                summary: 'npm run build',
                detail: 'Running build verification',
                status: 'pending',
            },
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 3,
            completedToolCount: 2,
            errorToolCount: 1,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-activity-tool-counts');
        expect(html).toContain('status-activity-tool-count pending');
        expect(html).toContain('status-activity-tool-count error');
        expect(html).toMatch(/title="(?:Pending tools|进行中工具)"/i);
        expect(html).toMatch(/title="(?:Failed tools|失败工具)"/i);
        expect(html).not.toMatch(/<span>(?:Pending tools|进行中工具)<\/span>/i);
        expect(html).not.toMatch(/<span>(?:Failed tools|失败工具)<\/span>/i);
    });

    it('renders a recent desktop task list in the current activity card with subagents separated', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-oldest',
                    type: 'bash',
                    label: 'Bash',
                    accentClass: 'accent-terminal',
                    summary: 'oldest hidden task',
                    detail: 'first command',
                    status: 'completed',
                },
                {
                    toolId: 'tool-read',
                    type: 'read',
                    label: 'Read',
                    accentClass: 'accent-read',
                    summary: 'read src/App.tsx',
                    detail: 'src/App.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'tool-agent',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'spawn review agent',
                    detail: 'subagent history',
                    status: 'completed',
                },
                {
                    toolId: 'tool-grep',
                    type: 'search',
                    label: 'Search',
                    accentClass: 'accent-search',
                    summary: 'grep StatusPanel',
                    detail: 'src/components/chat',
                    status: 'completed',
                },
                {
                    toolId: 'tool-edit',
                    type: 'edit',
                    label: 'Edit',
                    accentClass: 'accent-edit',
                    summary: 'edit StatusPanel.tsx',
                    detail: 'src/components/chat/StatusPanel.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'tool-build',
                    type: 'bash',
                    label: 'Build',
                    accentClass: 'accent-terminal',
                    summary: 'npm run build',
                    detail: 'type-check and bundle',
                    status: 'completed',
                },
                {
                    toolId: 'tool-test',
                    type: 'bash',
                    label: 'Test',
                    accentClass: 'accent-terminal',
                    summary: 'npm test -- StatusPanel',
                    detail: 'targeted regression',
                    status: 'completed',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 0,
            completedToolCount: 6,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-activity-task-list');
        expect(html).toContain('status-activity-task-row');
        expect(html).toContain('status-activity-scroll-region');
        expect(html).toContain('role="region"');
        expect(html).toMatch(/tabindex="0"/i);
        expect(html).toMatch(/aria-label="(?:Activity history|活动历史)"/i);
        expect(html).toContain('max-h-64');
        expect(html).toContain('overflow-y-auto');
        expect(html).toContain('npm test -- StatusPanel');
        expect(html).toContain('npm run build');
        expect(html).toContain('edit StatusPanel.tsx');
        expect(html).toContain('status-activity-subagent-list');
        expect(html).toContain('spawn review agent');
        expect(html).not.toContain('oldest hidden task');
        expect(html).toMatch(/1 earlier tools hidden|还有 1 个更早工具未显示/i);
    });

    it('renders desktop task rows as transcript jump targets when a selector is provided', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-test',
                    type: 'bash',
                    label: 'Test',
                    accentClass: 'accent-terminal',
                    summary: 'npm test -- StatusPanel',
                    detail: 'targeted regression',
                    status: 'completed',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
                onSelectTool={() => undefined}
            />,
        );

        expect(html).toContain('<button');
        expect(html).toContain('status-activity-task-row');
        expect(html).toContain('data-target-tool-id="tool-test"');
        expect(html).toMatch(/aria-label="(?:Jump to tool task: |定位工具任务：)npm test -- StatusPanel"/i);
        expect(html).not.toContain('disabled=""');
    });

    it('renders recent desktop subagent activity as transcript jump targets without mixing it into tasks', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-read',
                    type: 'read',
                    label: 'Read',
                    accentClass: 'accent-read',
                    summary: 'read src/App.tsx',
                    detail: 'src/App.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'agent-oldest',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'oldest hidden subagent',
                    detail: 'reviewer',
                    status: 'completed',
                },
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer · opus',
                    status: 'completed',
                },
                {
                    toolId: 'agent-test',
                    type: 'agent',
                    label: 'Task',
                    accentClass: 'accent-agent',
                    summary: 'write regression coverage',
                    detail: 'test-runner · sonnet',
                    status: 'pending',
                },
            ],
            agentTools: [
                {
                    toolId: 'agent-oldest',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'oldest hidden subagent',
                    detail: 'reviewer',
                    status: 'completed',
                },
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer · opus',
                    status: 'completed',
                },
                {
                    toolId: 'agent-test',
                    type: 'agent',
                    label: 'Task',
                    accentClass: 'accent-agent',
                    summary: 'write regression coverage',
                    detail: 'test-runner · sonnet',
                    status: 'pending',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 1,
            completedToolCount: 3,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
                onSelectTool={() => undefined}
            />,
        );

        expect(html).toContain('status-activity-task-list');
        expect(html).toContain('read src/App.tsx');
        expect(html).toContain('status-activity-subagent-list');
        expect(html).toContain('write regression coverage');
        expect(html).toContain('review maintainability risks');
        expect(html).not.toContain('oldest hidden subagent');
        expect(html).toContain('data-target-tool-id="agent-test"');
        expect(html).toContain('data-target-tool-id="agent-review"');
        expect(html).toMatch(/aria-label="(?:Jump to subagent activity: |定位子代理活动：)write regression coverage"/i);
        expect(html).not.toMatch(/aria-label="(?:Jump to tool task: |定位工具任务：)write regression coverage"/i);
        expect(html).toMatch(/1 earlier subagents hidden|还有 1 个更早子代理未显示/i);
    });

    it('does not show the idle activity message when only subagent history is visible', () => {
        const statusSummary: ChatStatusSummary = {
            agentTools: [
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer · opus',
                    status: 'completed',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-activity-subagent-list');
        expect(html).toContain('review maintainability risks');
        expect(html).not.toMatch(/Idle|当前空闲/i);
    });

    it('omits the recent edits card when there are no edits to inspect', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
            />,
        );

        expect(html).not.toMatch(/Recent edits|最近改动/i);
        expect(html).not.toMatch(/No file edits to show yet|暂时没有可展示的文件改动/i);
        expect(html).not.toContain('status-edit-tree-scroll');
    });

    it('omits the current activity card while the chat is completely idle', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
            />,
        );

        expect(html).not.toMatch(/Current activity|当前活动/i);
        expect(html).not.toMatch(/Idle|当前空闲/i);
        expect(html).not.toContain('status-activity-tool-counts');
    });

    it('keeps the current activity card visible while a reply is streaming', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
                isStreaming
            />,
        );

        expect(html).toMatch(/Current activity|当前活动/i);
        expect(html).toMatch(/Streaming reply|正在生成回复|正在回复/i);
    });

    it('renders completed history session load metrics as a collapsed diagnostic entry', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 120,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: false,
                        status: 'complete',
                        startedAt: 1000,
                        completedAt: 1161,
                        elapsedMs: 161,
                        windowMessageCount: 120,
                        totalMessageCount: 5000,
                        fullMessageCount: 5000,
                        windowLoadMs: 40,
                        windowMapMs: 7,
                        fullLoadMs: 50,
                        fullMapMs: 11,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-metrics');
        expect(html).toContain('status-session-load-toggle');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toMatch(/History load|历史加载/i);
        expect(html).toContain('5000');
        expect(html).toContain('120');
        expect(html).toContain('161ms');
        expect(html).not.toContain('status-session-load-details');
        expect(html).not.toContain('40ms');
        expect(html).not.toContain('50ms');
    });

    it('renders windowed history session load metrics as a ready collapsed entry', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 120,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: false,
                        status: 'windowed',
                        startedAt: 1000,
                        completedAt: 1057,
                        elapsedMs: 57,
                        windowMessageCount: 120,
                        totalMessageCount: 5000,
                        fullMessageCount: null,
                        windowLoadMs: 40,
                        windowMapMs: 7,
                        fullLoadMs: null,
                        fullMapMs: null,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-metrics');
        expect(html).toContain('status-session-load-toggle');
        expect(html).toContain('aria-expanded=\"false\"');
        expect(html).toMatch(/Window ready|窗口就绪/i);
        expect(html).toContain('120');
        expect(html).toContain('5000');
        expect(html).toContain('57ms');
        expect(html).not.toContain('status-session-load-details');
        expect(html).not.toMatch(/Loading|加载中/i);
    });

    it('auto-expands history session load metrics while loading or errored', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 120,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: false,
                        status: 'loading',
                        startedAt: 1000,
                        completedAt: null,
                        elapsedMs: null,
                        windowMessageCount: 120,
                        totalMessageCount: 5000,
                        fullMessageCount: null,
                        windowLoadMs: 40,
                        windowMapMs: 7,
                        fullLoadMs: null,
                        fullMapMs: null,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-toggle');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('status-session-load-details');
        expect(html).toContain('40ms');
    });

    it('renders cache-hit history session load metrics without full-stage noise', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 5000,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: true,
                        status: 'complete',
                        startedAt: 2000,
                        completedAt: 2002,
                        elapsedMs: 2,
                        windowMessageCount: 0,
                        totalMessageCount: 5000,
                        fullMessageCount: 5000,
                        windowLoadMs: null,
                        windowMapMs: null,
                        fullLoadMs: null,
                        fullMapMs: null,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-metrics');
        expect(html).toMatch(/Cache hit|缓存命中/i);
        expect(html).not.toContain('Full 0ms');
    });

    it('renders recent edit diff hover previews from status summary data', () => {
        const statusSummary: ChatStatusSummary = {
            recentEdits: [
                {
                    toolId: 'tool-edit',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 1,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [
                        {
                            kind: 'removed',
                            text: 'old status row',
                            oldLineNumber: 12,
                        },
                        {
                            kind: 'added',
                            text: 'new status row',
                            newLineNumber: 12,
                        },
                    ],
                },
            ],
            allEdits: [
                {
                    toolId: 'tool-edit',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 1,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            touchedFileCount: 1,
            totalAdditions: 1,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-edit-diff-trigger');
        expect(html).toContain('edit-diff-hover-preview');
        expect(html).toContain('old status row');
        expect(html).toContain('new status row');
        expect(html).toContain('src/components/chat/StatusPanel.tsx');
    });

    it('renders all-file edit totals even when the visible recent list is shorter', () => {
        const statusSummary: ChatStatusSummary = {
            recentEdits: [
                {
                    toolId: 'tool-edit-latest',
                    displayPath: 'src/latest.ts',
                    openPath: 'src/latest.ts',
                    additions: 1,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            allEdits: [
                {
                    toolId: 'tool-edit-latest',
                    displayPath: 'src/latest.ts',
                    openPath: 'src/latest.ts',
                    additions: 1,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden',
                    displayPath: 'src/hidden.ts',
                    openPath: 'src/hidden.ts',
                    additions: 11,
                    deletions: 3,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-2',
                    displayPath: 'src/hidden-2.ts',
                    openPath: 'src/hidden-2.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-3',
                    displayPath: 'src/hidden-3.ts',
                    openPath: 'src/hidden-3.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-4',
                    displayPath: 'src/hidden-4.ts',
                    openPath: 'src/hidden-4.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-5',
                    displayPath: 'src/hidden-5.ts',
                    openPath: 'src/hidden-5.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            touchedFileCount: 6,
            totalAdditions: 12,
            totalDeletions: 3,
            pendingToolCount: 0,
            completedToolCount: 6,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={12}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toMatch(/6\s*(files|个文件)/);
        expect(html).toContain('+12 / -3');
        expect(html).toContain('src/latest.ts');
        expect(html).toMatch(/5\s*(more files|个文件)/);
        expect(html).not.toContain('src/hidden.ts');
    });

    it('renders edit files as a scrollable tree with diff mode controls', () => {
        const statusSummary: ChatStatusSummary = {
            recentEdits: [
                {
                    toolId: 'tool-edit-a',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 2,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [
                        {kind: 'removed', text: 'old line', oldLineNumber: 1},
                        {kind: 'added', text: 'new line', newLineNumber: 1},
                    ],
                },
                {
                    toolId: 'tool-edit-b',
                    displayPath: 'src/components/chat/MessageList.tsx',
                    openPath: 'src/components/chat/MessageList.tsx',
                    additions: 3,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-c',
                    displayPath: 'src/utils/toolPresentation.ts',
                    openPath: 'src/utils/toolPresentation.ts',
                    additions: 4,
                    deletions: 2,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-d',
                    displayPath: 'src/styles/toolBlocks.css',
                    openPath: 'src/styles/toolBlocks.css',
                    additions: 1,
                    deletions: 5,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            allEdits: [
                {
                    toolId: 'tool-edit-a',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 2,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [
                        {kind: 'removed', text: 'old line', oldLineNumber: 1},
                        {kind: 'added', text: 'new line', newLineNumber: 1},
                    ],
                },
                {
                    toolId: 'tool-edit-b',
                    displayPath: 'src/components/chat/MessageList.tsx',
                    openPath: 'src/components/chat/MessageList.tsx',
                    additions: 3,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-c',
                    displayPath: 'src/utils/toolPresentation.ts',
                    openPath: 'src/utils/toolPresentation.ts',
                    additions: 4,
                    deletions: 2,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-d',
                    displayPath: 'src/styles/toolBlocks.css',
                    openPath: 'src/styles/toolBlocks.css',
                    additions: 1,
                    deletions: 5,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            touchedFileCount: 4,
            totalAdditions: 10,
            totalDeletions: 8,
            pendingToolCount: 0,
            completedToolCount: 4,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-edit-tree-scroll');
        expect(html).toContain('status-edit-tree-toggle');
        expect(html).toContain('status-diff-mode-toggle');
        expect(html).toContain('status-edit-tree-folder');
        expect(html).toContain('status-edit-tree-file');
        expect(html).toContain('src');
        expect(html).toContain('components');
        expect(html).toContain('toolPresentation.ts');
        expect(html).toMatch(/split diff view|拆分差异视图/i);
    });

    it('collapses large edit trees to folder rows by default', () => {
        const edits = Array.from({length: 30}, (_, index) => ({
            toolId: `tool-edit-${index}`,
            displayPath: `src/features/chat/file-${index}.ts`,
            openPath: `src/features/chat/file-${index}.ts`,
            additions: index + 1,
            deletions: index % 3,
            status: 'completed' as const,
            diffPreviewLines: [],
        }));
        const statusSummary: ChatStatusSummary = {
            recentEdits: edits.slice(0, 4),
            allEdits: edits,
            touchedFileCount: edits.length,
            totalAdditions: edits.reduce((sum, edit) => sum + edit.additions, 0),
            totalDeletions: edits.reduce((sum, edit) => sum + edit.deletions, 0),
            pendingToolCount: 0,
            completedToolCount: edits.length,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={150}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-edit-tree-folder');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('src');
        expect(html).not.toContain('status-edit-tree-file');
        expect(html).not.toContain('file-0.ts');
    });

    it('marks the selected edit row for the central diff review pane', () => {
        const selectedEdit = {
            toolId: 'tool-edit-a',
            displayPath: 'src/components/chat/StatusPanel.tsx',
            openPath: 'src/components/chat/StatusPanel.tsx',
            additions: 2,
            deletions: 1,
            status: 'completed' as const,
            diffPreviewLines: [
                {kind: 'removed' as const, text: 'old line', oldLineNumber: 1},
                {kind: 'added' as const, text: 'new line', newLineNumber: 1},
            ],
        };
        const statusSummary: ChatStatusSummary = {
            recentEdits: [selectedEdit],
            allEdits: [selectedEdit],
            touchedFileCount: 1,
            totalAdditions: 2,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
                selectedEditKey={getChatStatusEditKey(selectedEdit)}
                diffViewMode="split"
            />,
        );

        expect(html).toContain('status-edit-tree-file-selected');
        expect(html).toContain('aria-current="true"');
        expect(html).toContain('status-edit-tree-open');
        expect(html).toContain('edit-diff-hover-preview-split');
        expect(html).toContain('edit-diff-hover-preview-status');
    });

    it('renders an explicit reopen action when the central diff pane is collapsed without relying on selection', () => {
        const selectedEdit = {
            toolId: 'tool-edit-a',
            displayPath: 'src/components/chat/StatusPanel.tsx',
            openPath: 'src/components/chat/StatusPanel.tsx',
            additions: 2,
            deletions: 1,
            status: 'completed' as const,
            diffPreviewLines: [
                {kind: 'removed' as const, text: 'old line', oldLineNumber: 1},
                {kind: 'added' as const, text: 'new line', newLineNumber: 1},
            ],
        };
        const statusSummary: ChatStatusSummary = {
            recentEdits: [selectedEdit],
            allEdits: [selectedEdit],
            touchedFileCount: 1,
            totalAdditions: 2,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
                isDiffPaneCollapsed
                onOpenDiffPanel={() => undefined}
            />,
        );

        expect(html).toContain('status-diff-pane-reopen');
        expect(html).toContain('status-diff-pane-reopen-header');
        expect(html).toMatch(/expand file diff panel|展开文件差异面板/i);
    });

    it('renders daemon offline status with a manual reconnect action', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady={false}
                daemonStatus="shutdown"
                onReconnectDaemon={() => undefined}
            />,
        );

        expect(html).toContain('status-daemon-reconnect');
        expect(html).toMatch(/daemon offline|守护进程离线/i);
        expect(html).toMatch(/reconnect daemon|重新连接守护进程/i);
    });

    it('renders daemon failure diagnostics next to the manual recovery path', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady={false}
                daemonStatus="error"
                daemonError="Error: node executable not found"
                onReconnectDaemon={() => undefined}
            />,
        );

        expect(html).toContain('status-daemon-diagnostic');
        expect(html).toContain('Error: node executable not found');
        expect(html).toContain('status-daemon-reconnect');
    });

    it('renders MCP availability behind an explicit collapsed toggle for the active provider', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={4}
                daemonReady
                mcpStatus={{
                    totalServers: 5,
                    enabledServers: 2,
                    loading: false,
                    error: null,
                    servers: [
                        {id: 'filesystem', name: 'filesystem', enabled: true, transport: 'stdio'},
                        {id: 'browser', name: 'browser', enabled: false, transport: 'sse'},
                    ],
                }}
            />,
        );

        expect(html).toContain('status-mcp-summary');
        expect(html).toContain('status-mcp-toggle');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toMatch(/MCP/i);
        expect(html).toContain('2 / 5');
        expect(html).toMatch(/available|可用/i);
        expect(html).not.toContain('status-mcp-details');
        expect(html).not.toContain('filesystem');
        expect(html).not.toContain('browser');
    });

    it('renders MCP loading and error diagnostics without hiding configured counts', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady
                mcpStatus={{
                    totalServers: 4,
                    enabledServers: 1,
                    loading: true,
                    error: 'failed to load mcp config',
                    servers: [
                        {id: 'filesystem', name: 'filesystem', enabled: true, transport: 'stdio'},
                    ],
                }}
            />,
        );

        expect(html).toContain('status-mcp-summary');
        expect(html).toContain('status-mcp-toggle');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('status-mcp-details');
        expect(html).toContain('1 / 4');
        expect(html).toContain('failed to load mcp config');
        expect(html).toMatch(/loading|正在加载/i);
        expect(html).toContain('filesystem');
    });

    it('renders user-triggered MCP connectivity checks and live results', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={4}
                daemonReady
                mcpStatus={{
                    totalServers: 2,
                    enabledServers: 1,
                    loading: false,
                    error: null,
                    servers: [
                        {id: 'filesystem', name: 'filesystem', enabled: true, transport: 'stdio'},
                        {id: 'browser', name: 'browser', enabled: false, transport: 'sse'},
                    ],
                }}
                mcpConnectivity={{
                    checking: true,
                    checkedAt: 1710000000000,
                    error: null,
                    hasResults: true,
                    resultByServerId: {
                        filesystem: {
                            serverId: 'filesystem',
                            status: 'online',
                            message: null,
                            latencyMs: 24,
                        },
                    },
                }}
                onCheckMcpConnectivity={() => undefined}
            />,
        );

        expect(html).toContain('status-mcp-toggle');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('status-mcp-details');
        expect(html).toContain('status-mcp-check');
        expect(html).toMatch(/Check live|检测连通性/i);
        expect(html).toMatch(/Checking|检测中/i);
        expect(html).toContain('status-mcp-live-result');
        expect(html).toMatch(/Online|在线/i);
        expect(html).toContain('24ms');
    });
});
