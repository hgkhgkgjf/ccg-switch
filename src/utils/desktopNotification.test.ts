import {afterEach, describe, expect, it, vi} from 'vitest';
import {notifyChatTurnStopped, prepareChatTurnStoppedNotificationPermission,} from './desktopNotification';

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    isTauri: vi.fn(() => false),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
    isTauri: tauriMocks.isTauri,
}));

describe('desktopNotification', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        tauriMocks.invoke.mockReset();
        tauriMocks.isTauri.mockReset();
        tauriMocks.isTauri.mockReturnValue(false);
    });

    it('does nothing when system notifications are unavailable', () => {
        vi.stubGlobal('Notification', undefined);

        expect(() => notifyChatTurnStopped({outcome: 'success', provider: 'codex'})).not.toThrow();
    });

    it('shows a system notification when permission has already been granted', () => {
        const created: Array<{title: string; options?: NotificationOptions}> = [];
        class GrantedNotification {
            static permission: NotificationPermission = 'granted';
            static requestPermission = vi.fn();

            constructor(title: string, options?: NotificationOptions) {
                created.push({title, options});
            }
        }
        vi.stubGlobal('Notification', GrantedNotification);

        notifyChatTurnStopped({outcome: 'success', provider: 'codex', detail: 'Final answer'});

        expect(created).toEqual([
            {
                title: 'CCG Switch',
                options: {
                    body: 'Codex 任务已完成：Final answer',
                },
            },
        ]);
    });

    it('requests permission before showing a system notification', async () => {
        const created: Array<{title: string; options?: NotificationOptions}> = [];
        class DefaultNotification {
            static permission: NotificationPermission = 'default';
            static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);

            constructor(title: string, options?: NotificationOptions) {
                created.push({title, options});
            }
        }
        vi.stubGlobal('Notification', DefaultNotification);

        notifyChatTurnStopped({outcome: 'aborted', provider: 'claude'});
        await Promise.resolve();

        expect(DefaultNotification.requestPermission).toHaveBeenCalledTimes(1);
        expect(created[0]).toEqual({
            title: 'CCG Switch',
            options: {
                body: 'Claude 输出已停止。',
            },
        });
    });

    it('can preflight notification permission from a user action without showing a notification', async () => {
        const created: Array<{title: string; options?: NotificationOptions}> = [];
        class DefaultNotification {
            static permission: NotificationPermission = 'default';
            static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);

            constructor(title: string, options?: NotificationOptions) {
                created.push({title, options});
            }
        }
        vi.stubGlobal('Notification', DefaultNotification);

        prepareChatTurnStoppedNotificationPermission();
        await Promise.resolve();

        expect(DefaultNotification.requestPermission).toHaveBeenCalledTimes(1);
        expect(created).toEqual([]);
    });

    it('collapses whitespace and truncates long notification details', () => {
        const created: Array<{title: string; options?: NotificationOptions}> = [];
        class GrantedNotification {
            static permission: NotificationPermission = 'granted';

            constructor(title: string, options?: NotificationOptions) {
                created.push({title, options});
            }
        }
        vi.stubGlobal('Notification', GrantedNotification);

        notifyChatTurnStopped({
            outcome: 'error',
            provider: 'claude',
            detail: ` ${'a'.repeat(200)}\nnext line `,
        });

        expect(created[0].options?.body).toMatch(/^Claude 任务已失败：a+…$/);
        expect(created[0].options?.body).not.toContain('\n');
    });

    it('uses the Tauri native notification command in the desktop app', () => {
        tauriMocks.isTauri.mockReturnValue(true);
        tauriMocks.invoke.mockResolvedValue(undefined);
        const created: Array<{title: string; options?: NotificationOptions}> = [];
        class GrantedNotification {
            static permission: NotificationPermission = 'granted';

            constructor(title: string, options?: NotificationOptions) {
                created.push({title, options});
            }
        }
        vi.stubGlobal('Notification', GrantedNotification);

        notifyChatTurnStopped({outcome: 'success', provider: 'codex', detail: 'Final answer'});

        expect(tauriMocks.invoke).toHaveBeenCalledWith('chat_show_system_notification', {
            title: 'CCG Switch',
            body: 'Codex 任务已完成：Final answer',
        });
        expect(created).toEqual([]);
    });

    it('does not request WebView notification permission in the Tauri app', () => {
        tauriMocks.isTauri.mockReturnValue(true);
        class DefaultNotification {
            static permission: NotificationPermission = 'default';
            static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
        }
        vi.stubGlobal('Notification', DefaultNotification);

        prepareChatTurnStoppedNotificationPermission();

        expect(DefaultNotification.requestPermission).not.toHaveBeenCalled();
    });

    it('falls back to WebView notifications if the native command fails', async () => {
        tauriMocks.isTauri.mockReturnValue(true);
        tauriMocks.invoke.mockRejectedValue(new Error('missing command'));
        const created: Array<{title: string; options?: NotificationOptions}> = [];
        class GrantedNotification {
            static permission: NotificationPermission = 'granted';

            constructor(title: string, options?: NotificationOptions) {
                created.push({title, options});
            }
        }
        vi.stubGlobal('Notification', GrantedNotification);

        notifyChatTurnStopped({outcome: 'aborted', provider: 'claude'});
        await Promise.resolve();
        await Promise.resolve();

        expect(created).toEqual([
            {
                title: 'CCG Switch',
                options: {
                    body: 'Claude 输出已停止。',
                },
            },
        ]);
    });
});
