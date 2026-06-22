import type {ReactElement, ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import StatusPanel, {isStatusEditInspectActivationKey} from './StatusPanel';
import type {ChatStatusSummary} from '../../utils/chatStatusSummary';

type ReactElementNode = ReactElement<{
    children?: ReactNode;
    className?: string;
    onKeyDown?: (event: {key?: string; preventDefault?: () => void; stopPropagation?: () => void}) => void;
}>;

vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');

    return {
        ...actual,
        useEffect: () => undefined,
        useMemo: (factory: () => unknown) => factory(),
        useState: (initialValue: unknown) => {
            const value = typeof initialValue === 'function'
                ? (initialValue as () => unknown)()
                : initialValue;

            return [
                value,
                vi.fn(),
            ];
        },
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (typeof options?.file === 'string') return `${key}:${options.file}`;
            if (typeof options?.count === 'number') return `${key}:${options.count}`;
            return key;
        },
    }),
}));

vi.mock('../../utils/bridge', () => ({
    openFile: vi.fn(),
}));

function findElementByClassName(node: ReactNode, className: string): ReactElementNode {
    if (!node || typeof node !== 'object') {
        throw new Error(`Element with class ${className} not found`);
    }

    if (Array.isArray(node)) {
        for (const child of node) {
            try {
                return findElementByClassName(child, className);
            } catch {
                // Continue searching siblings.
            }
        }
        throw new Error(`Element with class ${className} not found`);
    }

    const element = node as ReactElementNode;
    if (typeof element.props?.className === 'string' && element.props.className.includes(className)) {
        return element;
    }

    return findElementByClassName(element.props?.children, className);
}

function renderStatusPanelElement(overrides: Partial<Parameters<typeof StatusPanel>[0]> = {}): ReactElement {
    const edit = {
        toolId: 'tool-edit',
        displayPath: 'src/components/chat/StatusPanel.tsx',
        openPath: 'src/components/chat/StatusPanel.tsx',
        additions: 2,
        deletions: 1,
        status: 'completed' as const,
        diffPreviewLines: [],
    };
    const statusSummary: ChatStatusSummary = {
        recentEdits: [edit],
        allEdits: [edit],
        touchedFileCount: 1,
        totalAdditions: 2,
        totalDeletions: 1,
        pendingToolCount: 0,
        completedToolCount: 1,
        errorToolCount: 0,
    };

    return StatusPanel({
        provider: 'codex',
        messageCount: 12,
        daemonReady: true,
        statusSummary,
        ...overrides,
    }) as ReactElement;
}

describe('StatusPanel nested open-file keyboard boundaries', () => {
    it('recognizes only keyboard activation keys for recent edit diff inspection rows', () => {
        expect(isStatusEditInspectActivationKey('Enter')).toBe(true);
        expect(isStatusEditInspectActivationKey(' ')).toBe(true);
        expect(isStatusEditInspectActivationKey('Escape')).toBe(false);
        expect(isStatusEditInspectActivationKey('ArrowDown')).toBe(false);
        expect(isStatusEditInspectActivationKey('a')).toBe(false);
    });

    it('inspects recent edit diff rows only from activation keys', () => {
        const onSelectedEditChange = vi.fn();
        const row = findElementByClassName(
            renderStatusPanelElement({onSelectedEditChange}),
            'status-edit-tree-file',
        );
        const enterEvent = {key: 'Enter', preventDefault: vi.fn()};
        const escapeEvent = {key: 'Escape', preventDefault: vi.fn()};

        row.props.onKeyDown?.(escapeEvent);
        row.props.onKeyDown?.(enterEvent);

        expect(escapeEvent.preventDefault).not.toHaveBeenCalled();
        expect(enterEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(onSelectedEditChange).toHaveBeenCalledTimes(1);
        expect(onSelectedEditChange).toHaveBeenCalledWith(
            expect.objectContaining({displayPath: 'src/components/chat/StatusPanel.tsx'}),
        );
    });

    it('stops keydown propagation from recent edit open-file buttons before the file row can inspect diff', () => {
        const button = findElementByClassName(renderStatusPanelElement(), 'status-edit-tree-open');
        const stopPropagation = vi.fn();

        button.props.onKeyDown?.({stopPropagation});

        expect(stopPropagation).toHaveBeenCalledTimes(1);
    });
});
