// @vitest-environment jsdom
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createInstance} from 'i18next';
import {I18nextProvider} from 'react-i18next';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it} from 'vitest';
import Sidebar from './Sidebar';

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

function renderSidebar(position: 'left' | 'top' = 'left'): string {
    return renderToStaticMarkup(createElement(
        I18nextProvider,
        {i18n: createKeyOnlyI18n()},
        createElement(
            MemoryRouter,
            {initialEntries: ['/chat']},
            createElement(Sidebar, {position}),
        ),
    ));
}

describe('Sidebar', () => {
    it('does not expose the removed Workspaces page in the main navigation', () => {
        const html = renderSidebar();

        expect(html).toContain('href="/chat"');
        expect(html).not.toContain('href="/workspaces"');
        expect(html).not.toContain('nav.workspaces');
    });

    it('does not expose the removed Workspaces page in the top navigation', () => {
        const html = renderSidebar('top');

        expect(html).toContain('href="/chat"');
        expect(html).not.toContain('href="/workspaces"');
        expect(html).not.toContain('nav.workspaces');
    });
});
