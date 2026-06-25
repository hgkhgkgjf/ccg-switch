// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ContextBar} from './ContextBar';
import {
    createAndCheckoutChatGitBranch,
    listChatGitBranches,
} from '../../../utils/chatWorkspaceStatus';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../../utils/chatWorkspaceStatus', async () => {
    const actual = await vi.importActual<typeof import('../../../utils/chatWorkspaceStatus')>(
        '../../../utils/chatWorkspaceStatus',
    );
    return {
        ...actual,
        listChatGitBranches: vi.fn(),
        createAndCheckoutChatGitBranch: vi.fn(),
    };
});

(
    globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean}
).IS_REACT_ACT_ENVIRONMENT = true;

const mockedListChatGitBranches = vi.mocked(listChatGitBranches);
const mockedCreateAndCheckoutChatGitBranch = vi.mocked(createAndCheckoutChatGitBranch);

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
    if (root) {
        await act(async () => {
            root?.unmount();
        });
    }
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
});

beforeEach(() => {
    mockedListChatGitBranches.mockReset();
    mockedCreateAndCheckoutChatGitBranch.mockReset();
});

async function renderContextBar(props: Partial<Parameters<typeof ContextBar>[0]> = {}) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
        root?.render(createElement(ContextBar, {
            attachments: [],
            percentage: 0,
            onRemoveAttachment: () => undefined,
            onAddAttachment: () => undefined,
            ...props,
        }));
    });

    return container;
}

describe('ContextBar workspace and git menus', () => {
    it('opens a workspace menu and switches to a selected project', async () => {
        const onWorkspaceChange = vi.fn();
        const rendered = await renderContextBar({
            cwd: 'C:/workspace/ccg-switch',
            workspaceProjects: [
                {
                    name: 'ccg-switch',
                    path: 'C:/workspace/ccg-switch',
                },
            ],
            onWorkspaceChange,
        });

        await act(async () => {
            rendered.querySelector<HTMLButtonElement>('[data-chat-workspace-menu-trigger]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        const menu = document.querySelector('[data-chat-workspace-menu]');
        expect(menu).not.toBeNull();
        expect(menu?.textContent).toContain('ccg-switch');
        expect(menu?.textContent).toContain('Open folder...');
        expect(
            document.querySelector('[data-chat-workspace-option="C:/workspace/ccg-switch"]')
                ?.getAttribute('aria-current'),
        ).toBe('true');

        await act(async () => {
            document.querySelector<HTMLButtonElement>('[data-chat-workspace-option="C:/workspace/ccg-switch"]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });

        expect(onWorkspaceChange).toHaveBeenCalledWith('C:/workspace/ccg-switch');
    });

    it('closes the workspace menu when pointer goes down outside of it', async () => {
        const rendered = await renderContextBar({
            cwd: 'C:/workspace/ccg-switch',
            workspaceProjects: [
                {name: 'ccg-switch', path: 'C:/workspace/ccg-switch'},
            ],
        });

        await act(async () => {
            rendered.querySelector<HTMLButtonElement>('[data-chat-workspace-menu-trigger]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });
        expect(document.querySelector('[data-chat-workspace-menu]')).not.toBeNull();

        await act(async () => {
            document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        });
        expect(document.querySelector('[data-chat-workspace-menu]')).toBeNull();
    });

    it('loads git branches and creates a checked out branch from the branch menu', async () => {
        mockedListChatGitBranches.mockResolvedValue([
            {name: 'main', current: false},
            {name: 'cc-gui', current: true},
        ]);
        mockedCreateAndCheckoutChatGitBranch.mockResolvedValue({
            isGitRepository: true,
            gitRoot: 'C:/workspace/ccg-switch',
            gitBranch: 'feature/workspace-switch',
        });
        vi.spyOn(window, 'prompt').mockReturnValue(' feature/workspace-switch ');
        const onWorkspaceStatusChange = vi.fn();
        const rendered = await renderContextBar({
            cwd: 'C:/workspace/ccg-switch',
            workspaceStatus: {
                isGitRepository: true,
                gitRoot: 'C:/workspace/ccg-switch',
                gitBranch: 'cc-gui',
            },
            onWorkspaceStatusChange,
        });

        await act(async () => {
            rendered.querySelector<HTMLButtonElement>('[data-chat-git-branch-trigger]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
            await Promise.resolve();
        });

        const menu = document.querySelector('[data-chat-git-branch-menu]');
        expect(menu).not.toBeNull();
        expect(menu?.textContent).toContain('cc-gui');
        expect(menu?.textContent).toContain('main');
        expect(mockedListChatGitBranches).toHaveBeenCalledWith('C:/workspace/ccg-switch');

        await act(async () => {
            document.querySelector<HTMLButtonElement>('[data-chat-git-create-branch]')
                ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
            await Promise.resolve();
        });

        expect(mockedCreateAndCheckoutChatGitBranch).toHaveBeenCalledWith(
            'C:/workspace/ccg-switch',
            'feature/workspace-switch',
        );
        expect(onWorkspaceStatusChange).toHaveBeenCalledWith({
            isGitRepository: true,
            gitRoot: 'C:/workspace/ccg-switch',
            gitBranch: 'feature/workspace-switch',
        });
    });
});
