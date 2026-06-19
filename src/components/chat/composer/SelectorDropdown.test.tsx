import {Cpu} from 'lucide-react';
import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {SelectorDropdown} from './SelectorDropdown';

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        useState: <S,>(initial: S | (() => S)) => {
            const value = typeof initial === 'function'
                ? (initial as () => S)()
                : initial;
            return [value === false ? true : value, () => undefined];
        },
    };
});

describe('SelectorDropdown', () => {
    it('wraps trigger, option, and selected checkmark icons in fixed icon boxes', () => {
        const html = renderToStaticMarkup(
            <SelectorDropdown
                value="sonnet"
                options={[
                    {
                        id: 'sonnet',
                        label: 'Sonnet',
                        icon: <Cpu size={14} />,
                    },
                    {
                        id: 'opus',
                        label: 'Opus',
                        icon: <Cpu size={14} />,
                    },
                ]}
                onChange={() => undefined}
                buttonIcon={<Cpu size={14} />}
                buttonLabel="Sonnet"
                title="Model"
            />,
        );

        expect(html).toContain('selector-dropdown-icon-box selector-dropdown-trigger-icon');
        expect(html).toContain('selector-dropdown-icon-box--trigger');
        expect(html).toContain('selector-dropdown-icon-box selector-dropdown-option-icon');
        expect(html).toContain('selector-dropdown-icon-box--option');
        expect(html).toContain('selector-dropdown-icon-box selector-dropdown-check-icon');
        expect(html).toContain('selector-dropdown-icon-box--check');
    });
});
