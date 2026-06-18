import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import MessageMeta from './MessageMeta';

describe('MessageMeta', () => {
    it('renders a compact assistant-style summary without verbose labels', () => {
        const html = renderToStaticMarkup(
            <MessageMeta
                compact
                durationMs={83_000}
                usage={{
                    input_tokens: 1_200,
                    output_tokens: 345,
                    cache_creation_input_tokens: 200,
                    cache_read_input_tokens: 100,
                }}
            />,
        );

        expect(html).toContain('耗时');
        expect(html).toContain('1:23');
        expect(html).toContain('tokens 1.5K / out 345');
        expect(html).not.toContain('本次耗时');
        expect(html).not.toContain('输入 1.5K / 输出 345');
    });

    it('renders the default verbose summary for non-compact contexts', () => {
        const html = renderToStaticMarkup(
            <MessageMeta
                durationMs={3_723_000}
                usage={{
                    input_tokens: 800,
                    output_tokens: 1200,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                }}
            />,
        );

        expect(html).toContain('本次耗时');
        expect(html).toContain('1:02:03');
        expect(html).toContain('输入 800 / 输出 1.2K');
    });

    it('omits token metadata when no usage is available', () => {
        const html = renderToStaticMarkup(
            <MessageMeta durationMs={1_000} />,
        );

        expect(html).toContain('本次耗时');
        expect(html).toContain('0:01');
        expect(html).not.toContain('输入');
        expect(html).not.toContain('tokens');
    });
});
