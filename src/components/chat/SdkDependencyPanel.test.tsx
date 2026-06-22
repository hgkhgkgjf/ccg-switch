import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import SdkDependencyPanel, {getSdkDependencyPanelLabels} from './SdkDependencyPanel';
import type {SdkStatus} from '../../types/chat';

const storeState = vi.hoisted(() => ({
    statuses: [] as SdkStatus[],
    installing: null as string | null,
    logs: [] as string[],
    error: null as string | null,
    init: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock('../../stores/useSdkStore', () => ({
    useSdkStore: () => storeState,
}));

const translationState = vi.hoisted(() => ({
    keyOnly: false,
}));

vi.mock('react-i18next', () => ({
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined,
    },
    useTranslation: () => ({
        t: (key: string) => {
            if (translationState.keyOnly) return key;
            const translations: Record<string, string> = {
                'chat.sdk.title': 'SDK Manager',
                'chat.sdk.refresh': 'Reload SDKs',
                'chat.sdk.hint': 'Install missing SDKs before chatting.',
                'chat.sdk.installed': 'Ready',
                'chat.sdk.notInstalled': 'Missing',
                'chat.sdk.uninstall': 'Remove',
                'chat.sdk.installing': 'Installing SDK',
                'chat.sdk.install': 'Install SDK',
                'common.close': 'Close panel',
            };
            return translations[key] ?? key;
        },
    }),
}));

function resetStoreState() {
    storeState.statuses = [
        {
            id: 'claude',
            displayName: 'Claude Code SDK',
            installed: true,
            path: 'C:/sdk/claude',
        },
        {
            id: 'codex',
            displayName: 'Codex SDK',
            installed: false,
            path: '',
        },
    ];
    storeState.installing = null;
    storeState.logs = [];
    storeState.error = null;
    storeState.init.mockClear();
    storeState.install.mockClear();
    storeState.uninstall.mockClear();
    storeState.refresh.mockClear();
}

describe('SdkDependencyPanel', () => {
    afterEach(() => {
        translationState.keyOnly = false;
        resetStoreState();
    });

    it('keeps SDK dependency chrome readable when i18n keys are unavailable', () => {
        resetStoreState();
        translationState.keyOnly = true;
        storeState.installing = 'codex';
        storeState.logs = [];

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('SDK Dependencies');
        expect(html).toContain('Refresh');
        expect(html).toContain('Install or repair the Claude/Codex SDK dependencies used by Chat.');
        expect(html).toContain('Installed');
        expect(html).toContain('Not installed');
        expect(html).toContain('Uninstall');
        expect(html).toContain('Installing...');
        expect(html).not.toContain('chat.sdk.');
    });

    it('preserves translated SDK dependency labels when they are available', () => {
        resetStoreState();

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);
        const labels = getSdkDependencyPanelLabels((key) => {
            if (key === 'chat.sdk.title') return 'SDK Manager';
            if (key === 'common.close') return 'Close panel';
            return key;
        });

        expect(html).toContain('SDK Manager');
        expect(html).toContain('Reload SDKs');
        expect(html).toContain('Install missing SDKs before chatting.');
        expect(html).toContain('Ready');
        expect(html).toContain('Missing');
        expect(html).toContain('Remove');
        expect(html).toContain('Install SDK');
        expect(labels.title).toBe('SDK Manager');
        expect(labels.close).toBe('Close panel');
    });
});
