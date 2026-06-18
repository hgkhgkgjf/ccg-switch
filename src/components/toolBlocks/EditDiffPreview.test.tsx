import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import EditDiffPreview from './EditDiffPreview';

describe('EditDiffPreview', () => {
    it('renders a compact diff summary with line deltas in the hover header', () => {
        const html = renderToStaticMarkup(
            <EditDiffPreview
                filePath="src/example.ts"
                additions={3}
                deletions={1}
                lines={[
                    {kind: 'context', oldLineNumber: 10, newLineNumber: 10, text: 'keep before'},
                    {kind: 'removed', oldLineNumber: 11, text: 'remove me'},
                    {kind: 'added', newLineNumber: 11, text: 'add me'},
                ]}
            />,
        );

        expect(html).toContain('src/example.ts');
        expect(html).toContain('3 added, 1 removed');
        expect(html).toContain('+3');
        expect(html).toContain('-1');
    });
});
