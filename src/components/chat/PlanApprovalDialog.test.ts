import {describe, expect, it} from 'vitest';
import {resolvePlanApprovalShortcutAction, submitPlanApprovalDecision} from './PlanApprovalDialog';

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
