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
});
