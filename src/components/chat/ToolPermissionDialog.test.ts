import {createElement, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ToolPermissionRequest} from '../../types/permission';
import {
    default as ToolPermissionDialog,
    getToolPermissionDialogLabels,
    getToolPermissionInputPreview,
    getToolPermissionPrimaryInput,
    resolveToolPermissionShortcutAction,
    submitToolPermissionDecision,
} from './ToolPermissionDialog';

vi.mock('react-dom', async () => {
    const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
    return {
        ...actual,
        createPortal: (node: ReactNode) => node,
    };
});

vi.mock('react-i18next', () => ({
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined,
    },
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'chat.permission.toolDescription') {
                return `Tool ${String(options?.tool)} wants to run. Confirm whether to allow this operation.`;
            }
            return key;
        },
    }),
}));

const toolPermissionRequest: ToolPermissionRequest = {
    requestId: 'tool-permission-1',
    sessionId: 'session-1',
    toolName: 'Bash',
    inputs: {
        command: 'npm test',
        cwd: 'C:/guodevelop/ccg-switch',
    },
    cwd: 'C:/guodevelop/ccg-switch',
    timestamp: '2026-06-20T04:10:00.000Z',
};

function stubPortalDocument() {
    vi.stubGlobal('document', {body: {}});
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ToolPermissionDialog labels', () => {
    it('keeps tool permission labels readable when i18n keys are unavailable', () => {
        const labels = getToolPermissionDialogLabels((key) => key, 'Bash');

        expect(labels.title).toBe('Tool permission required');
        expect(labels.description).toBe('Tool Bash wants to run. Confirm whether to allow this operation.');
        expect(labels.parameters).toBe('Parameters');
        expect(labels.rawInput).toBe('Full input');
        expect(labels.cwd).toBe('Working directory:');
        expect(labels.deny).toBe('Deny');
        expect(labels.allowOnce).toBe('Allow once');
        expect(labels.shortcutAllow).toBe('Allow once');
        expect(labels.shortcutDeny).toBe('Deny');
        expect(labels.primaryCommand).toBe('Command');
        expect(labels.primaryContent).toBe('Content');
        expect(labels.primaryText).toBe('Text');
        expect(labels.copyPrimaryInput).toBe('Copy primary input');
        expect(labels.copiedPrimaryInput).toBe('Copied primary input');
    });

    it('preserves translated tool permission labels when they are available', () => {
        const labels = getToolPermissionDialogLabels((key, options) => {
            if (key === 'chat.permission.toolTitle') return '需要确认工具权限';
            if (key === 'chat.permission.toolDescription') return `工具 ${String(options?.tool)} 请求执行。请确认是否允许本次操作。`;
            if (key === 'chat.permission.parameters') return '参数';
            if (key === 'chat.permission.rawInput') return '完整输入';
            if (key === 'chat.permission.cwd') return '工作目录：';
            if (key === 'chat.permission.deny') return '拒绝';
            if (key === 'chat.permission.allowOnce') return '允许一次';
            if (key === 'chat.permission.shortcutAllow') return '允许一次';
            if (key === 'chat.permission.shortcutDeny') return '拒绝';
            if (key === 'chat.permission.primaryCommand') return '命令';
            if (key === 'chat.permission.primaryContent') return '内容';
            if (key === 'chat.permission.primaryText') return '文本';
            if (key === 'chat.permission.copyPrimaryInput') return '复制主输入';
            if (key === 'chat.permission.copiedPrimaryInput') return '已复制主输入';
            return key;
        }, 'Read');

        expect(labels.title).toBe('需要确认工具权限');
        expect(labels.description).toBe('工具 Read 请求执行。请确认是否允许本次操作。');
        expect(labels.parameters).toBe('参数');
        expect(labels.rawInput).toBe('完整输入');
        expect(labels.cwd).toBe('工作目录：');
        expect(labels.deny).toBe('拒绝');
        expect(labels.allowOnce).toBe('允许一次');
        expect(labels.shortcutAllow).toBe('允许一次');
        expect(labels.shortcutDeny).toBe('拒绝');
        expect(labels.primaryCommand).toBe('命令');
        expect(labels.primaryContent).toBe('内容');
        expect(labels.primaryText).toBe('文本');
        expect(labels.copyPrimaryInput).toBe('复制主输入');
        expect(labels.copiedPrimaryInput).toBe('已复制主输入');
    });
});

describe('ToolPermissionDialog shortcuts', () => {
    it('maps Enter and Escape to permission actions when focus is outside controls', () => {
        expect(resolveToolPermissionShortcutAction('Enter', null)).toBe('allow');
        expect(resolveToolPermissionShortcutAction('Escape', null)).toBe('deny');
        expect(resolveToolPermissionShortcutAction('Tab', null)).toBeNull();
    });

    it('maps numeric shortcut keys to the supported allow and deny decisions', () => {
        expect(resolveToolPermissionShortcutAction('1', null)).toBe('allow');
        expect(resolveToolPermissionShortcutAction('2', null)).toBe('deny');
        expect(resolveToolPermissionShortcutAction('3', null)).toBeNull();
    });

    it('does not steal numeric shortcut keys from editable controls', () => {
        expect(
            resolveToolPermissionShortcutAction('1', {tagName: 'INPUT'} as unknown as EventTarget),
        ).toBeNull();
        expect(
            resolveToolPermissionShortcutAction('2', {tagName: 'TEXTAREA'} as unknown as EventTarget),
        ).toBeNull();
    });

    it('does not allow when Enter belongs to a focused control', () => {
        expect(
            resolveToolPermissionShortcutAction('Enter', {tagName: 'BUTTON'} as unknown as EventTarget),
        ).toBeNull();
        expect(
            resolveToolPermissionShortcutAction('Enter', {tagName: 'TEXTAREA'} as unknown as EventTarget),
        ).toBeNull();
        expect(
            resolveToolPermissionShortcutAction('Enter', {
                tagName: 'DIV',
                isContentEditable: true,
            } as unknown as EventTarget),
        ).toBeNull();
    });

    it('keeps Escape available on buttons but avoids stealing it from editable controls', () => {
        expect(
            resolveToolPermissionShortcutAction('Escape', {tagName: 'BUTTON'} as unknown as EventTarget),
        ).toBe('deny');
        expect(
            resolveToolPermissionShortcutAction('Escape', {tagName: 'INPUT'} as unknown as EventTarget),
        ).toBeNull();
    });

    it('submits only the first permission decision after the dialog is marked submitted', () => {
        const submitted = {current: false};
        const calls: boolean[] = [];
        let busyCount = 0;

        const first = submitToolPermissionDecision(
            submitted,
            () => {
                busyCount += 1;
            },
            (allow) => calls.push(allow),
            true,
        );
        const second = submitToolPermissionDecision(
            submitted,
            () => {
                busyCount += 1;
            },
            (allow) => calls.push(allow),
            false,
        );

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(busyCount).toBe(1);
        expect(calls).toEqual([true]);
    });
});

describe('ToolPermissionDialog input preview', () => {
    it('extracts the primary permission input by command, content, then text priority', () => {
        expect(getToolPermissionPrimaryInput({
            text: 'fallback text',
            content: 'fallback content',
            command: 'npm test',
        })).toEqual(['command', 'npm test']);

        expect(getToolPermissionPrimaryInput({
            text: 'fallback text',
            content: 'write file content',
        })).toEqual(['content', 'write file content']);

        expect(getToolPermissionPrimaryInput({
            text: 'question text',
        })).toEqual(['text', 'question text']);
    });

    it('omits cwd from parameter preview when the working directory row already shows the same path', () => {
        const preview = getToolPermissionInputPreview(
            {
                command: 'npm test',
                cwd: 'C:/guodevelop/ccg-switch',
                description: 'run unit tests',
            },
            'C:/guodevelop/ccg-switch',
        );

        expect(preview).toEqual([
            ['command', 'npm test'],
            ['description', 'run unit tests'],
        ]);
    });

    it('keeps cwd in parameter preview when it differs from the request working directory', () => {
        const preview = getToolPermissionInputPreview(
            {
                command: 'npm test',
                cwd: 'C:/guodevelop/ccg-switch/packages/app',
            },
            'C:/guodevelop/ccg-switch',
        );

        expect(preview).toEqual([
            ['command', 'npm test'],
            ['cwd', 'C:/guodevelop/ccg-switch/packages/app'],
        ]);
    });

    it('can omit a promoted primary input from the parameter preview', () => {
        const preview = getToolPermissionInputPreview(
            {
                command: 'npm test',
                cwd: 'C:/guodevelop/ccg-switch',
                description: 'run unit tests',
            },
            'C:/guodevelop/ccg-switch',
            ['command'],
        );

        expect(preview).toEqual([
            ['description', 'run unit tests'],
        ]);
    });
});

describe('ToolPermissionDialog modal semantics', () => {
    it('exposes dialog semantics tied to the permission title and description', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(ToolPermissionDialog, {
                request: toolPermissionRequest,
                onAnswer: () => undefined,
            }),
        );

        expect(html).toContain('role="dialog"');
        expect(html).toContain('aria-modal="true"');
        expect(html).toContain('aria-labelledby="tool-permission-title"');
        expect(html).toContain('aria-describedby="tool-permission-description"');
        expect(html).toContain('<h3 id="tool-permission-title"');
        expect(html).toContain('id="tool-permission-description"');
    });
});

describe('ToolPermissionDialog shortcut hints', () => {
    it('renders visible numeric, Enter, and Escape hints for blocking permission decisions', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(ToolPermissionDialog, {
                request: toolPermissionRequest,
                onAnswer: () => undefined,
            }),
        );

        expect(html).toContain('<kbd>1</kbd>');
        expect(html).toContain('<span class="hint-label">Allow once</span>');
        expect(html).toContain('<kbd>2</kbd>');
        expect(html).toContain('<span class="hint-label">Deny</span>');
        expect(html).toContain('<kbd>Enter</kbd>');
        expect(html).toContain('<span class="hint-label">Allow once</span>');
        expect(html).toContain('<kbd>Esc</kbd>');
        expect(html).toContain('<span class="hint-label">Deny</span>');
    });

    it('includes shortcut context in footer action labels', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(ToolPermissionDialog, {
                request: toolPermissionRequest,
                onAnswer: () => undefined,
            }),
        );

        expect(html).toContain('title="Allow once (1 / Enter)"');
        expect(html).toContain('aria-label="Allow once (1 / Enter)"');
        expect(html).toContain('title="Deny (2 / Esc)"');
        expect(html).toContain('aria-label="Deny (2 / Esc)"');
    });
});

describe('ToolPermissionDialog primary input preview', () => {
    it('renders the primary command in a dedicated preview box', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(ToolPermissionDialog, {
                request: toolPermissionRequest,
                onAnswer: () => undefined,
            }),
        );

        expect(html).toContain('data-tool-permission-primary="command"');
        expect(html).toContain('Command');
        expect(html).toContain('npm test');
    });

    it('renders a copy action for the promoted primary input', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(ToolPermissionDialog, {
                request: toolPermissionRequest,
                onAnswer: () => undefined,
            }),
        );

        expect(html).toContain('data-tool-permission-primary-copy="command"');
        expect(html).toContain('title="Copy primary input"');
        expect(html).toContain('aria-label="Copy primary input"');
    });
});
