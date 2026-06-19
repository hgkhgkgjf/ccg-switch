import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ChatDiffReviewPane from './ChatDiffReviewPane';
import type {ChatStatusEditSummary} from '../../utils/chatStatusSummary';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

const edit: ChatStatusEditSummary = {
    toolId: 'tool-edit',
    displayPath: 'src/components/chat/ChatDiffReviewPane.tsx',
    openPath: 'src/components/chat/ChatDiffReviewPane.tsx',
    additions: 20,
    deletions: 20,
    status: 'completed',
    diffPreviewLines: Array.from({length: 40}, (_, index) => ({
        kind: index % 2 === 0 ? 'removed' as const : 'added' as const,
        text: `line ${index + 1}`,
        oldLineNumber: index % 2 === 0 ? index + 1 : undefined,
        newLineNumber: index % 2 === 1 ? index + 1 : undefined,
    })),
};

describe('ChatDiffReviewPane', () => {
    it('renders the full selected diff instead of the hover preview limit', () => {
        const html = renderToStaticMarkup(
            <ChatDiffReviewPane
                edit={edit}
                mode="unified"
                wrapLines
                onModeChange={() => undefined}
                onWrapLinesChange={() => undefined}
            />,
        );

        expect(html).toContain('chat-diff-review-pane');
        expect(html).toContain('edit-diff-panel');
        expect(html).toContain('edit-diff-panel-wrap');
        expect(html).toContain('line 1');
        expect(html).toContain('line 40');
        expect(html).not.toContain('edit-diff-hover-more');
    });

    it('renders split diff mode when requested', () => {
        const html = renderToStaticMarkup(
            <ChatDiffReviewPane
                edit={edit}
                mode="split"
                wrapLines
                onModeChange={() => undefined}
                onWrapLinesChange={() => undefined}
            />,
        );

        expect(html).toContain('edit-diff-panel-split');
        expect(html).toContain('edit-diff-hover-split-row');
    });

    it('renders a collapse action when the diff pane can be hidden', () => {
        const html = renderToStaticMarkup(
            <ChatDiffReviewPane
                edit={edit}
                mode="unified"
                wrapLines
                onModeChange={() => undefined}
                onWrapLinesChange={() => undefined}
                onCollapse={() => undefined}
            />,
        );

        expect(html).toContain('chat-diff-review-collapse');
        expect(html).toMatch(/collapse file diff panel|收起文件差异面板/i);
    });

    it('renders a visible line-wrap toggle for dense three-pane diffs', () => {
        const html = renderToStaticMarkup(
            <ChatDiffReviewPane
                edit={edit}
                mode="unified"
                wrapLines
                onModeChange={() => undefined}
                onWrapLinesChange={() => undefined}
            />,
        );

        expect(html).toContain('chat-diff-review-wrap-toggle');
        expect(html).toMatch(/do not wrap diff lines|差异内容不换行/i);
    });

    it('renders a copy path action for the selected diff file', () => {
        const html = renderToStaticMarkup(
            <ChatDiffReviewPane
                edit={edit}
                mode="unified"
                wrapLines
                onModeChange={() => undefined}
                onWrapLinesChange={() => undefined}
            />,
        );

        expect(html).toContain('chat-diff-review-copy');
        expect(html).toMatch(/copy path|复制路径/i);
    });

    it('keeps the parent-controlled no-wrap diff mode after the pane remounts', () => {
        const html = renderToStaticMarkup(
            <ChatDiffReviewPane
                edit={edit}
                mode="unified"
                wrapLines={false}
                onModeChange={() => undefined}
                onWrapLinesChange={() => undefined}
            />,
        );

        expect(html).toContain('edit-diff-panel-nowrap');
        expect(html).toMatch(/wrap diff lines|差异内容自动换行/i);
    });
});
