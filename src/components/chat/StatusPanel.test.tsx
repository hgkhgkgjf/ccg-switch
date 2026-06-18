import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import StatusPanel from './StatusPanel';
import {type ChatStatusSummary, getChatStatusEditKey} from '../../utils/chatStatusSummary';

describe('StatusPanel', () => {
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
});
