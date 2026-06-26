import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import SdkDependencyPanel, {getSdkDependencyPanelLabels, getSdkDependencyVersionAction,} from './SdkDependencyPanel';
import type {NodeRuntimeStatus, SdkStatus} from '../../types/chat';

const storeState = vi.hoisted(() => ({
    statuses: [] as SdkStatus[],
    installing: null as string | null,
    logs: [] as string[],
    error: null as string | null,
    nodeRuntimeStatus: null as NodeRuntimeStatus | null,
    nodeRuntimeInstalling: false,
    nodeRuntimeLogs: [] as string[],
    init: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    installNodeRuntime: vi.fn(),
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
        t: (key: string, options?: Record<string, string>) => {
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
                'chat.sdk.targetVersion': 'Target version',
                'chat.sdk.description.claude': 'Required for Claude AI features. Includes Claude Code SDK and related dependencies.',
                'chat.sdk.description.codex': 'Required for Codex AI features. Includes OpenAI Codex SDK.',
                'chat.sdk.description.generic': 'Required for {{name}} features.',
                'chat.sdk.currentVersion': 'Current {{version}}',
                'chat.sdk.latestStableVersion': 'Latest stable {{version}}',
                'chat.sdk.defaultVersion': 'Default {{version}}',
                'chat.sdk.updateAvailable': 'Update available',
                'chat.sdk.currentVersionAction': 'Current version',
                'chat.sdk.installVersion': 'Install {{version}}',
                'chat.sdk.updateToVersion': 'Update to {{version}}',
                'chat.sdk.switchToVersion': 'Switch to {{version}}',
                'chat.sdk.noVersions': 'No versions available',
                'chat.sdk.installLog': 'Install log',
                'chat.sdk.nodeRuntime.title': 'Node.js runtime',
                'chat.sdk.nodeRuntime.missing': 'Node.js is required before installing SDKs.',
                'chat.sdk.nodeRuntime.privateInstall': 'Install private runtime',
                'chat.sdk.nodeRuntime.installing': 'Installing runtime...',
                'chat.sdk.nodeRuntime.noSystemChange': 'Uses CCG Switch private data only and does not modify system PATH.',
                'common.close': 'Close panel',
                'common.cancel': 'Cancel panel',
            };
            const translated = translations[key] ?? key;
            return Object.entries(options ?? {}).reduce(
                (text, [name, value]) => text.split(`{{${name}}}`).join(value),
                translated,
            );
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
            currentVersion: '1.2.0',
            defaultVersion: '^0.2.58',
            latestVersion: '1.3.0',
            availableVersions: ['1.3.0', '1.2.0', '1.1.0'],
        },
        {
            id: 'codex',
            displayName: 'Codex SDK',
            installed: false,
            path: '',
            defaultVersion: 'latest',
            latestVersion: '0.4.0',
            availableVersions: ['0.4.0', '0.3.0'],
        },
    ];
    storeState.installing = null;
    storeState.logs = [];
    storeState.error = null;
    storeState.nodeRuntimeStatus = {
        installed: true,
        nodePath: 'C:/node/node.exe',
        npmPath: 'C:/node/npm.cmd',
        version: 'v24.11.1',
        installDir: 'C:/node',
        source: 'system',
    };
    storeState.nodeRuntimeInstalling = false;
    storeState.nodeRuntimeLogs = [];
    storeState.init.mockClear();
    storeState.install.mockClear();
    storeState.uninstall.mockClear();
    storeState.installNodeRuntime.mockClear();
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
        const labels = getSdkDependencyPanelLabels((key) => key);

        expect(labels.title).toBe('SDK Dependencies');
        expect(html).not.toContain('>SDK Dependencies<');
        expect(html).toContain('Refresh');
        expect(html).toContain('Required for Claude AI features. Includes Claude Code SDK and related dependencies.');
        expect(html).toContain('Required for Codex AI features. Includes OpenAI Codex SDK.');
        expect(html).toContain('Installed');
        expect(html).toContain('Not installed');
        expect(html).toContain('Uninstall');
        expect(html).toContain('Installing...');
        expect(html).toContain('Install log');
        expect(html).toContain('Target version');
        expect(html).toContain('Current v1.2.0');
        expect(html).toContain('Latest stable v1.3.0');
        expect(html).toContain('Update available');
        expect(html).toContain('Update to v1.3.0');
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

        expect(html).not.toContain('>SDK Manager<');
        expect(html).toContain('Reload SDKs');
        expect(html).toContain('Required for Claude AI features. Includes Claude Code SDK and related dependencies.');
        expect(html).toContain('Required for Codex AI features. Includes OpenAI Codex SDK.');
        expect(html).toContain('Ready');
        expect(html).toContain('Missing');
        expect(html).toContain('Remove');
        expect(html).toContain('Target version');
        expect(html).toContain('Update to v1.3.0');
        expect(html).toContain('Install v0.4.0');
        expect(labels.title).toBe('SDK Manager');
        expect(labels.close).toBe('Close panel');
    });

    it('renders screenshot-style SDK cards with full-width version controls', () => {
        resetStoreState();

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('sdk-dependency-list');
        expect(html.match(/sdk-dependency-card/g)?.length).toBe(2);
        expect(html.match(/sdk-card-header/g)?.length).toBe(2);
        expect(html.match(/sdk-version-chip/g)?.length).toBe(2);
        expect(html.match(/sdk-version-arrow-chip/g)?.length).toBe(2);
        expect(html.match(/sdk-target-select-row/g)?.length).toBe(2);
        expect(html.match(/sdk-card-actions/g)?.length).toBe(2);
        expect(html.match(/sdk-card-meta/g)?.length).toBe(2);
        expect(html).toContain('→ v1.3.0');
        expect(html).not.toContain('sdk-dependency-row');
    });

    it('keeps the screenshot-style SDK cards readable in light and dark themes', () => {
        resetStoreState();

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('sdk-dependency-card rounded-lg border border-slate-200 bg-white');
        expect(html).toContain('dark:border-base-300 dark:bg-base-200/40');
        expect(html).toContain('sdk-version-chip rounded border border-slate-200 bg-slate-100');
        expect(html).toContain('dark:border-transparent dark:bg-base-300/80 dark:text-base-content');
        expect(html).toContain('sdk-update-pill rounded border border-blue-100 bg-blue-50');
        expect(html).toContain('dark:border-transparent dark:bg-info/15 dark:text-info');
        expect(html).toContain('border-slate-200 bg-white text-sm text-slate-900');
        expect(html).toContain('dark:border-base-300 dark:bg-base-100/60 dark:text-base-content');
        expect(html).toContain('bg-blue-50 text-blue-700 hover:bg-blue-100');
        expect(html).toContain('dark:bg-info/15 dark:text-info dark:hover:bg-info/20');
        expect(html).toContain('bg-red-50 px-4 text-red-700 hover:bg-red-100');
        expect(html).toContain('dark:bg-error/10 dark:text-error dark:hover:bg-error/15');
    });

    it('renders completed install logs as a collapsed light/dark compatible panel', () => {
        resetStoreState();
        storeState.logs = ['Installing Claude SDK...', 'Install complete'];

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('sdk-install-log rounded-lg border border-slate-200 bg-white');
        expect(html).toContain('dark:border-base-300 dark:bg-base-200/60 dark:text-base-content/70');
        expect(html).toContain('<summary');
        expect(html).toContain('Install log');
        expect(html).toContain('Installing Claude SDK...');
        expect(html).toContain('Install complete');
        expect(html).not.toContain('mockup-code');
        expect(html).not.toContain('mockup-code text-xs max-h-48 overflow-y-auto bg-base-300');
        expect(html).not.toContain('<details open');
    });

    it('keeps install logs expanded while an SDK install is running', () => {
        resetStoreState();
        storeState.installing = 'claude';
        storeState.logs = [];

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('<details open="" class="sdk-install-log');
        expect(html).toContain('Install log');
        expect(html).toContain('Installing SDK');
        expect(html).not.toContain('mockup-code');
    });

    it('renders version metadata and target version choices for each SDK', () => {
        resetStoreState();

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('Claude Code SDK');
        expect(html).toContain('Current v1.2.0');
        expect(html).toContain('Latest stable v1.3.0');
        expect(html).toContain('Update available');
        expect(html).toContain('Update to v1.3.0');
        expect(html).toContain('Codex SDK');
        expect(html).toContain('Install v0.4.0');
        expect(html).toContain('<select');
        expect(html).toContain('value="1.3.0"');
        expect(html).toContain('value="0.4.0"');
    });

    it('disables the primary action when the selected target is the current version', () => {
        resetStoreState();
        storeState.statuses = [
            {
                id: 'claude',
                displayName: 'Claude Code SDK',
                installed: true,
                path: 'C:/sdk/claude',
                currentVersion: '1.3.0',
                defaultVersion: '^0.2.58',
                latestVersion: '1.3.0',
                availableVersions: ['1.3.0', '1.2.0'],
            },
        ];

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('Current version');
        expect(html).toContain('disabled=""');
        expect(html).toContain('sdk-action-current');
    });

    it('shows a private Node runtime install card and disables SDK install when runtime is missing', () => {
        resetStoreState();
        storeState.nodeRuntimeStatus = {
            installed: false,
            nodePath: null,
            npmPath: null,
            version: 'v24.11.1',
            installDir: 'C:/Users/tester/.ccg-switch/runtime/node/v24.11.1/win-x64',
            source: 'missing',
        };

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('sdk-node-runtime-card');
        expect(html).toContain('Node.js runtime');
        expect(html).toContain('Node.js is required before installing SDKs.');
        expect(html).toContain('Install private runtime');
        expect(html).toContain('does not modify system PATH');
        expect(html).toContain('disabled=""');
    });

    it('keeps runtime install logs expanded while private Node runtime is installing', () => {
        resetStoreState();
        storeState.nodeRuntimeStatus = {
            installed: false,
            nodePath: null,
            npmPath: null,
            version: 'v24.11.1',
            installDir: 'C:/Users/tester/.ccg-switch/runtime/node/v24.11.1/win-x64',
            source: 'missing',
        };
        storeState.nodeRuntimeInstalling = true;
        storeState.nodeRuntimeLogs = ['Downloading Node.js...', 'Verifying SHA256...'];

        const html = renderToStaticMarkup(<SdkDependencyPanel/>);

        expect(html).toContain('<details open="" class="sdk-install-log');
        expect(html).toContain('Installing runtime...');
        expect(html).toContain('Downloading Node.js...');
        expect(html).toContain('Verifying SHA256...');
    });

    it('labels non-current selected installed versions as switch actions', () => {
        const labels = getSdkDependencyPanelLabels((key) => key);

        const action = getSdkDependencyVersionAction({
            installed: true,
            currentVersion: '1.3.0',
            targetVersion: '1.2.0',
            labels,
        });

        expect(action.kind).toBe('switch');
        expect(action.label).toBe('Switch to v1.2.0');
        expect(action.disabled).toBe(false);
    });
});
