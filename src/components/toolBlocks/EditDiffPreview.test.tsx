import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import EditDiffPreview from './EditDiffPreview';

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
});
