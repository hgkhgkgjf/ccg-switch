import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createInstance} from 'i18next';
import {I18nextProvider} from 'react-i18next';
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

function createKeyOnlyI18n() {
    const instance = createInstance();
    instance.init({
        lng: 'en',
        fallbackLng: false,
        resources: {},
        initImmediate: false,
        interpolation: {escapeValue: false},
    });
    return instance;
}

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
        expect(html).toContain('chat-diff-review-pane-focus-target');
        expect(html).toContain('data-chat-diff-review-pane="true"');
        expect(html).toMatch(/tabindex="-1"/i);
        expect(html).toMatch(/aria-label="(?:File diff: |文件差异：)src\/components\/chat\/ChatDiffReviewPane\.tsx"/);
        expect(html).toContain('edit-diff-panel');
        expect(html).toContain('edit-diff-panel-wrap');
        expect(html).toContain('line 1');
        expect(html).toContain('line 40');
        expect(html).not.toContain('edit-diff-hover-more');
    });

    it('names file actions with the selected diff target', () => {
        const html = renderToStaticMarkup(
            <ChatDiffReviewPane
                edit={edit}
                mode="unified"
                wrapLines
                onModeChange={() => undefined}
                onWrapLinesChange={() => undefined}
            />,
        );

        expect(html).toMatch(/aria-label="(?:Open file: |打开文件：)src\/components\/chat\/ChatDiffReviewPane\.tsx"/i);
        expect(html).toMatch(/aria-label="(?:Copy path: |复制路径：)src\/components\/chat\/ChatDiffReviewPane\.tsx"/i);
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

    it('falls back to readable diff review labels when i18n keys are unavailable', () => {
        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <ChatDiffReviewPane
                    edit={edit}
                    mode="unified"
                    wrapLines
                    onModeChange={() => undefined}
                    onWrapLinesChange={() => undefined}
                    onCollapse={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(html).toContain('File diff: src/components/chat/ChatDiffReviewPane.tsx');
        expect(html).toContain('File diff');
        expect(html).toContain('40 diff lines');
        expect(html).toContain('Diff view mode');
        expect(html).toContain('Unified diff view');
        expect(html).toContain('Split diff view');
        expect(html).toContain('Do not wrap diff lines; use horizontal scrolling');
        expect(html).toContain('Open file: src/components/chat/ChatDiffReviewPane.tsx');
        expect(html).toContain('Copy path: src/components/chat/ChatDiffReviewPane.tsx');
        expect(html).toContain('Collapse file diff panel');
        expect(html).not.toContain('chat.layout.diffPanelForFile');
        expect(html).not.toContain('chat.layout.diffPanel');
        expect(html).not.toContain('chat.layout.diffLineSummary');
        expect(html).not.toContain('chat.layout.diffViewMode');
        expect(html).not.toContain('chat.layout.diffUnifiedView');
        expect(html).not.toContain('chat.layout.diffSplitView');
        expect(html).not.toContain('chat.layout.diffLineNoWrap');
        expect(html).not.toContain('tools.openFileForPath');
        expect(html).not.toContain('tools.copyPathForPath');
        expect(html).not.toContain('chat.layout.collapseDiffPanel');
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
