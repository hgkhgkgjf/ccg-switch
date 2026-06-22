import {createElement, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {PlanApprovalRequest} from '../../types/permission';
import PlanApprovalDialog, {
    getPlanApprovalDialogLabels,
    resolvePlanApprovalShortcutAction,
    submitPlanApprovalDecision,
} from './PlanApprovalDialog';

vi.mock('react-dom', async () => {
    const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
    return {
        ...actual,
        createPortal: (node: ReactNode) => node,
    };
});

vi.mock('dompurify', () => ({
    default: {
        sanitize: (html: string) => html,
    },
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'chat.planApproval.planSummary') return `Plan (${String(options?.count)} lines)`;
            if (key === 'chat.planApproval.allowedActions') return `Allowed actions (${String(options?.count)})`;
            return key;
        },
    }),
}));

const planApprovalRequest: PlanApprovalRequest = {
    requestId: 'plan-1',
    toolName: 'Plan',
    plan: [
        '## Implementation plan',
        '',
        '- Update the renderer',
        '- Verify code blocks',
        '',
        '```ts',
        'const mode = "safe";',
        '```',
    ].join('\n'),
    allowedPrompts: [
        {
            tool: 'Edit',
            prompt: 'Modify src/components/chat/PlanApprovalDialog.tsx',
        },
    ],
    timestamp: '2026-06-20T03:20:00.000Z',
    cwd: 'C:/guodevelop/ccg-switch',
};

function stubPortalDocument() {
    vi.stubGlobal('document', {
        body: {},
        createElement: (tagName: string) => {
            if (tagName !== 'template') return {};

            let html = '';
            return {
                content: {
                    querySelectorAll: () => [],
                },
                get innerHTML() {
                    return html;
                },
                set innerHTML(value: string) {
                    html = value;
                },
            };
        },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PlanApprovalDialog labels', () => {
    it('keeps approval labels readable when i18n keys are unavailable', () => {
        const labels = getPlanApprovalDialogLabels((key) => key, 3, 2);

        expect(labels.title).toBe('Plan approval required');
        expect(labels.subtitle).toBe('Review the plan before approving execution.');
        expect(labels.close).toBe('Close');
        expect(labels.planSummary).toBe('Plan (3 lines)');
        expect(labels.allowedActions).toBe('Allowed actions (2)');
        expect(labels.cwd).toBe('Working directory:');
        expect(labels.deny).toBe('Deny');
        expect(labels.approve).toBe('Approve');
        expect(labels.approveAuto).toBe('Approve & Auto');
        expect(labels.approveAutoTitle).toBe('Approve and switch to auto mode; future operations are allowed automatically.');
        expect(labels.approveAutoHint).toBe('Auto mode will allow future operations automatically after this approval.');
        expect(labels.shortcutApprove).toBe('Approve');
        expect(labels.shortcutDeny).toBe('Deny');
    });

    it('preserves translated approval labels when they are available', () => {
        const labels = getPlanApprovalDialogLabels((key, options) => {
            if (key === 'chat.planApproval.title') return '需要审批计划';
            if (key === 'chat.planApproval.subtitle') return '审批执行前请先核对计划。';
            if (key === 'common.close') return '关闭';
            if (key === 'chat.planApproval.planSummary') return `计划（${String(options?.count)} 行）`;
            if (key === 'chat.planApproval.allowedActions') return `允许的操作（${String(options?.count)}）`;
            if (key === 'chat.planApproval.cwd') return '工作目录：';
            if (key === 'chat.planApproval.deny') return '拒绝';
            if (key === 'chat.planApproval.approve') return '批准';
            if (key === 'chat.planApproval.approveAuto') return '批准并自动执行';
            if (key === 'chat.planApproval.approveAutoTitle') return '批准并切换到自动模式，后续操作自动放行。';
            if (key === 'chat.planApproval.approveAutoHint') return '自动模式会在本次批准后自动放行后续操作。';
            if (key === 'chat.planApproval.shortcutApprove') return '批准';
            if (key === 'chat.planApproval.shortcutDeny') return '拒绝';
            return key;
        }, 5, 4);

        expect(labels.title).toBe('需要审批计划');
        expect(labels.subtitle).toBe('审批执行前请先核对计划。');
        expect(labels.close).toBe('关闭');
        expect(labels.planSummary).toBe('计划（5 行）');
        expect(labels.allowedActions).toBe('允许的操作（4）');
        expect(labels.cwd).toBe('工作目录：');
        expect(labels.deny).toBe('拒绝');
        expect(labels.approve).toBe('批准');
        expect(labels.approveAuto).toBe('批准并自动执行');
        expect(labels.approveAutoTitle).toBe('批准并切换到自动模式，后续操作自动放行。');
        expect(labels.approveAutoHint).toBe('自动模式会在本次批准后自动放行后续操作。');
        expect(labels.shortcutApprove).toBe('批准');
        expect(labels.shortcutDeny).toBe('拒绝');
    });
});

describe('PlanApprovalDialog plan body', () => {
    it('renders the approval plan as markdown instead of a plain preformatted blob', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(PlanApprovalDialog, {
                request: planApprovalRequest,
                onApprove: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('<h2>Implementation plan</h2>');
        expect(html).toContain('<li>Update the renderer</li>');
        expect(html).toContain('<code class="language-ts">');
        expect(html).not.toContain('<pre class="bg-gray-50');
    });

    it('shows keyboard hints for approve and deny actions', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(PlanApprovalDialog, {
                request: planApprovalRequest,
                onApprove: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('<kbd>Enter</kbd>');
        expect(html).toContain('<kbd>Esc</kbd>');
        expect(html).toContain('<span class="hint-label">Approve</span>');
        expect(html).toContain('<span class="hint-label">Deny</span>');
    });

    it('exposes shortcut-aware accessible labels on footer approval actions', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(PlanApprovalDialog, {
                request: planApprovalRequest,
                onApprove: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('title="Deny (Esc)"');
        expect(html).toContain('aria-label="Deny (Esc)"');
        expect(html).toContain('title="Approve (Enter)"');
        expect(html).toContain('aria-label="Approve (Enter)"');
    });

    it('warns that Approve & Auto switches future operations to automatic approval', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(PlanApprovalDialog, {
                request: planApprovalRequest,
                onApprove: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('Auto mode will allow future operations automatically after this approval.');
        expect(html).toContain('title="Approve and switch to auto mode; future operations are allowed automatically."');
        expect(html).toContain('aria-label="Approve and switch to auto mode; future operations are allowed automatically."');
    });

    it('shows a concise subtitle explaining why approval is blocked', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(PlanApprovalDialog, {
                request: planApprovalRequest,
                onApprove: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('Review the plan before approving execution.');
    });

    it('exposes modal dialog semantics tied to the approval title and subtitle', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(PlanApprovalDialog, {
                request: planApprovalRequest,
                onApprove: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('role="dialog"');
        expect(html).toContain('aria-modal="true"');
        expect(html).toContain('aria-labelledby="plan-approval-title"');
        expect(html).toContain('aria-describedby="plan-approval-description"');
        expect(html).toContain('<h3 id="plan-approval-title"');
        expect(html).toContain('<p id="plan-approval-description"');
    });
});

describe('PlanApprovalDialog shortcuts', () => {
    it('maps Enter and Escape to approval actions when focus is outside controls', () => {
        expect(resolvePlanApprovalShortcutAction('Enter', null)).toBe('approve');
        expect(resolvePlanApprovalShortcutAction('Escape', null)).toBe('cancel');
        expect(resolvePlanApprovalShortcutAction('Tab', null)).toBeNull();
    });

    it('does not approve when Enter belongs to a focused control', () => {
        expect(
            resolvePlanApprovalShortcutAction('Enter', {tagName: 'BUTTON'} as unknown as EventTarget),
        ).toBeNull();
        expect(
            resolvePlanApprovalShortcutAction('Enter', {tagName: 'TEXTAREA'} as unknown as EventTarget),
        ).toBeNull();
        expect(
            resolvePlanApprovalShortcutAction('Enter', {
                tagName: 'DIV',
                isContentEditable: true,
            } as unknown as EventTarget),
        ).toBeNull();
    });

    it('keeps Escape available on buttons but avoids stealing it from editable controls', () => {
        expect(
            resolvePlanApprovalShortcutAction('Escape', {tagName: 'BUTTON'} as unknown as EventTarget),
        ).toBe('cancel');
        expect(
            resolvePlanApprovalShortcutAction('Escape', {tagName: 'INPUT'} as unknown as EventTarget),
        ).toBeNull();
    });

    it('submits only the first plan decision after the dialog is marked submitted', () => {
        const submitted = {current: false};
        const calls: Array<[boolean, string]> = [];
        let busyCount = 0;

        const first = submitPlanApprovalDecision(
            submitted,
            () => {
                busyCount += 1;
            },
            (approved, targetMode) => calls.push([approved, targetMode]),
            true,
            'default',
        );
        const second = submitPlanApprovalDecision(
            submitted,
            () => {
                busyCount += 1;
            },
            (approved, targetMode) => calls.push([approved, targetMode]),
            false,
            'auto',
        );

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(busyCount).toBe(1);
        expect(calls).toEqual([[true, 'default']]);
    });
});
