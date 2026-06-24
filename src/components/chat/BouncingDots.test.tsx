import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import BouncingDots from './BouncingDots';

describe('BouncingDots', () => {
    it('renders three animated dots', () => {
        const html = renderToStaticMarkup(<BouncingDots />);
        const spanMatches = html.match(/<span/g);
        expect(spanMatches).toHaveLength(3);
        expect(html).toContain('animate-bounce');
        expect(html).toContain('rounded-full');
        expect(html).toContain('bg-current');
    });

    it('applies custom size via inline styles', () => {
        const html = renderToStaticMarkup(<BouncingDots size={8} />);
        expect(html).toContain('width:8px');
        expect(html).toContain('height:8px');
    });

    it('applies custom className to wrapper', () => {
        const html = renderToStaticMarkup(<BouncingDots className="text-primary" />);
        expect(html).toContain('text-primary');
    });

    it('has staggered animation delays', () => {
        const html = renderToStaticMarkup(<BouncingDots />);
        expect(html).toContain('animation-delay:0ms');
        expect(html).toContain('animation-delay:160ms');
        expect(html).toContain('animation-delay:320ms');
    });

    it('uses 1.4s animation duration', () => {
        const html = renderToStaticMarkup(<BouncingDots />);
        const durationMatches = html.match(/animation-duration:1\.4s/g);
        expect(durationMatches).toHaveLength(3);
    });

    it('has aria-hidden for accessibility', () => {
        const html = renderToStaticMarkup(<BouncingDots />);
        expect(html).toContain('aria-hidden="true"');
    });

    it('renders with default size of 4px', () => {
        const html = renderToStaticMarkup(<BouncingDots />);
        expect(html).toContain('width:4px');
        expect(html).toContain('height:4px');
    });
});
