import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ThinkingBlock from './ThinkingBlock';

describe('ThinkingBlock', () => {
    it('renders compact assistant transcript styling when compact is enabled', () => {
        const html = renderToStaticMarkup(
            <ThinkingBlock
                compact
                content="整理一下实现思路"
                title="思考"
            />,
        );

        expect(html).toContain('text-[11.5px]');
        expect(html).toContain('rounded-md');
        expect(html).not.toContain('rounded-lg p-3');
    });

    it('keeps default styling when compact is not enabled', () => {
        const html = renderToStaticMarkup(
            <ThinkingBlock
                content="整理一下实现思路"
                title="思考"
            />,
        );

        expect(html).toContain('rounded-lg');
        expect(html).toContain('p-3');
        expect(html).not.toContain('text-[11.5px]');
    });
});
