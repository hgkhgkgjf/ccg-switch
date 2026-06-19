import {describe, expect, it} from 'vitest';
import {resolveToolPermissionShortcutAction, submitToolPermissionDecision} from './ToolPermissionDialog';

describe('ToolPermissionDialog shortcuts', () => {
    it('maps Enter and Escape to permission actions when focus is outside controls', () => {
        expect(resolveToolPermissionShortcutAction('Enter', null)).toBe('allow');
        expect(resolveToolPermissionShortcutAction('Escape', null)).toBe('deny');
        expect(resolveToolPermissionShortcutAction('Tab', null)).toBeNull();
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
