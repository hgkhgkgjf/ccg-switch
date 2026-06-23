import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import EditDiffPreview from './EditDiffPreview';

type NodeFsSubset = {
    readFileSync(path: string | URL, encoding: 'utf8'): string;
};

async function readToolBlocksCss(): Promise<string> {
    const processLike = (globalThis as unknown as {
        process?: { getBuiltinModule?: (specifier: 'node:fs') => NodeFsSubset };
    }).process;
    const fs = processLike?.getBuiltinModule?.('node:fs');
    if (!fs) {
        throw new Error('node:fs builtin module is unavailable in this test environment');
    }
    const { readFileSync } = fs;
    return readFileSync(new URL('../../styles/toolBlocks.css', import.meta.url), 'utf8');
}

describe('EditDiffPreview', () => {
    const diffLines = [
        {kind: 'context' as const, oldLineNumber: 10, newLineNumber: 10, text: 'keep before'},
        {kind: 'removed' as const, oldLineNumber: 11, text: 'remove me'},
        {kind: 'added' as const, newLineNumber: 11, text: 'add me'},
    ];

    it('renders a compact diff summary with line deltas in the hover header', () => {
        const html = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/example.ts"
                additions={3}
                deletions={1}
                lines={diffLines}
            />,
        );

        expect(html).toContain('src/example.ts');
        expect(html).toContain('3 added, 1 removed');
        expect(html).toContain('aria-label="src/example.ts"');
        expect(html).toContain('aria-label="3 added, 1 removed"');
        expect(html).toContain('class="edit-stat-added" aria-hidden="true"');
        expect(html).toContain('class="edit-stat-deleted" aria-hidden="true"');
        expect(html).toContain('class="edit-diff-hover-body" role="list"');
        expect(html).toContain('title="Context line 10: keep before" role="listitem" aria-label="Context line 10: keep before"');
        expect(html).toContain('title="Removed line 11: remove me" role="listitem" aria-label="Removed line 11: remove me"');
        expect(html).toContain('title="Added line 11: add me" role="listitem" aria-label="Added line 11: add me"');
        expect(html).toContain('+3');
        expect(html).toContain('-1');
    });

    it('wraps long lines by default in full panel mode', () => {
        const html = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/example.ts"
                additions={3}
                deletions={1}
                lines={diffLines}
                variant="panel"
            />,
        );

        expect(html).toContain('edit-diff-panel-wrap');
        expect(html).not.toContain('edit-diff-panel-nowrap');
    });

    it('can keep panel lines unwrapped for horizontal scrolling', () => {
        const html = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/example.ts"
                additions={3}
                deletions={1}
                lines={diffLines}
                variant="panel"
                wrapLines={false}
            />,
        );

        expect(html).toContain('edit-diff-panel-nowrap');
    });

    it('keeps contextual line labels in split diff mode', () => {
        const html = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/example.ts"
                additions={3}
                deletions={1}
                lines={diffLines}
                mode="split"
            />,
        );

        expect(html).toContain('edit-diff-hover-split-row removed" title="Removed line 11: remove me" role="listitem" aria-label="Removed line 11: remove me"');
        expect(html).toContain('edit-diff-hover-split-row added" title="Added line 11: add me" role="listitem" aria-label="Added line 11: add me"');
        expect(html).toContain('edit-diff-hover-split-cell old removed" title="Old side: Removed line 11: remove me" aria-label="Old side: Removed line 11: remove me"');
        expect(html).toContain('edit-diff-hover-split-cell new empty" title="New side: no content for Removed line 11: remove me" aria-label="New side: no content for Removed line 11: remove me"');
        expect(html).toContain('edit-diff-hover-split-cell old empty" title="Old side: no content for Added line 11: add me" aria-label="Old side: no content for Added line 11: add me"');
        expect(html).toContain('edit-diff-hover-split-cell new added" title="New side: Added line 11: add me" aria-label="New side: Added line 11: add me"');
    });

    it('marks status hover previews as solid high-contrast surfaces', () => {
        const html = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/example.ts"
                additions={3}
                deletions={1}
                lines={diffLines}
                surface="status"
                visible
            />,
        );

        expect(html).toContain('edit-diff-hover-preview-status');
        expect(html).toContain('edit-diff-hover-preview-solid');
        expect(html).toContain('edit-diff-hover-preview-readable');
        expect(html).toContain('edit-diff-hover-preview-wrap');
        expect(html).toContain('edit-diff-hover-preview-tall');
        expect(html).toContain('is-visible');
    });

    it('keeps the hidden diff line clue visible in the status hover header', () => {
        const longDiffLines = Array.from({length: 27}, (_, index) => ({
            kind: 'context' as const,
            oldLineNumber: index + 1,
            newLineNumber: index + 1,
            text: `line ${index + 1}`,
        }));

        const html = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/long-example.ts"
                additions={8}
                deletions={4}
                lines={longDiffLines}
                surface="status"
                visible
            />,
        );

        expect(html).toContain('edit-diff-hover-hidden-summary');
        expect(html).toContain('3 more lines');
        expect(html).toContain('aria-label="3 more lines"');
        expect(html).not.toContain('edit-diff-hover-more');
    });

    it('renders complete transcript hover previews while keeping status previews capped', () => {
        const longDiffLines = Array.from({length: 25}, (_, index) => ({
            kind: 'context' as const,
            oldLineNumber: index + 1,
            newLineNumber: index + 1,
            text: `budget line ${index + 1}`,
        }));

        const statusHtml = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/status-budget.ts"
                additions={12}
                deletions={2}
                lines={longDiffLines}
                surface="status"
                visible
            />,
        );

        expect(statusHtml).toContain('budget line 24');
        expect(statusHtml).not.toContain('budget line 25');
        expect(statusHtml).toContain('1 more lines');

        const defaultHtml = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/default-budget.ts"
                additions={12}
                deletions={2}
                lines={longDiffLines}
                visible
            />,
        );

        expect(defaultHtml).toContain('edit-diff-hover-preview-scrollable');
        expect(defaultHtml).toContain('budget line 25');
        expect(defaultHtml).not.toContain('more lines');
        expect(defaultHtml).not.toContain('edit-diff-hover-more');
    });

    it('keeps transcript hover preview bodies scrollable instead of clipped', async () => {
        const toolBlocksCss = await readToolBlocksCss();

        expect(toolBlocksCss).toMatch(
            /\.edit-diff-hover-preview-scrollable\s+\.edit-diff-hover-body\s*\{[^}]*\boverflow-y:\s*auto;/s,
        );
    });

    it('keeps scrollable transcript hover previews connected to the trigger hit area', async () => {
        const toolBlocksCss = await readToolBlocksCss();
        const scrollableRule = toolBlocksCss.match(/\.edit-diff-hover-preview-scrollable\s*\{(?<body>[^}]*)\}/s);

        expect(scrollableRule?.groups?.body).toMatch(/\bbottom:\s*100%;/);
        expect(scrollableRule?.groups?.body).toMatch(/\bpointer-events:\s*auto;/);
    });
});
