import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useSdkStore} from './useSdkStore';

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    listen: vi.fn(async (_eventName: string, _callback: (event: { payload: unknown }) => void) => vi.fn()),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: tauriMocks.listen,
}));

function resetSdkStore() {
    useSdkStore.setState({
        statuses: [],
        loading: false,
        installing: null,
        logs: [],
        error: null,
        nodeRuntimeStatus: null,
        nodeRuntimeInstalling: false,
        nodeRuntimeLogs: [],
        initialized: false,
    });
}

describe('useSdkStore', () => {
    beforeEach(() => {
        tauriMocks.invoke.mockReset();
        tauriMocks.listen.mockClear();
        resetSdkStore();
    });

    it('passes the selected SDK version to the install command', async () => {
        tauriMocks.invoke.mockResolvedValue(undefined);

        await useSdkStore.getState().install('codex-sdk', '0.4.0');

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_install_sdk', {
            sdkId: 'codex-sdk',
            version: '0.4.0',
        });
    });

    it('refreshes SDK and Node runtime status together', async () => {
        tauriMocks.invoke.mockImplementation(async (command: string) => {
            if (command === 'chat_sdk_status') return [];
            if (command === 'chat_node_runtime_status') {
                return {
                    installed: false,
                    nodePath: null,
                    npmPath: null,
                    version: 'v24.11.1',
                    installDir: 'C:/Users/tester/.ccg-switch/runtime/node/v24.11.1/win-x64',
                    source: 'missing',
                };
            }
            return undefined;
        });

        await useSdkStore.getState().refresh();

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_sdk_status');
        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_node_runtime_status');
        expect(useSdkStore.getState().nodeRuntimeStatus?.source).toBe('missing');
    });

    it('starts private Node runtime install through the dedicated command', async () => {
        tauriMocks.invoke.mockResolvedValue(undefined);

        await useSdkStore.getState().installNodeRuntime();

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_install_node_runtime');
        expect(useSdkStore.getState().nodeRuntimeInstalling).toBe(true);
    });
});
