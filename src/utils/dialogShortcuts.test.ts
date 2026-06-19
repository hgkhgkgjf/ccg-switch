import {describe, expect, it, vi} from 'vitest';
import {isEditableShortcutTarget, isEnterShortcutControl, markDialogSubmitted,} from './dialogShortcuts';

describe('dialog shortcut helpers', () => {
    it('detects editable targets consistently', () => {
        expect(isEditableShortcutTarget({tagName: 'INPUT'} as unknown as EventTarget)).toBe(true);
        expect(isEditableShortcutTarget({tagName: 'TEXTAREA'} as unknown as EventTarget)).toBe(true);
        expect(isEditableShortcutTarget({tagName: 'SELECT'} as unknown as EventTarget)).toBe(true);
        expect(
            isEditableShortcutTarget({
                tagName: 'DIV',
                isContentEditable: true,
            } as unknown as EventTarget),
        ).toBe(true);
        expect(
            isEditableShortcutTarget({
                tagName: 'DIV',
                closest: (selector: string) => selector === '[contenteditable="true"]',
            } as unknown as EventTarget),
        ).toBe(true);
        expect(isEditableShortcutTarget({tagName: 'BUTTON'} as unknown as EventTarget)).toBe(false);
    });

    it('treats buttons and editable controls as Enter-owned controls', () => {
        expect(isEnterShortcutControl({tagName: 'BUTTON'} as unknown as EventTarget)).toBe(true);
        expect(isEnterShortcutControl({tagName: 'INPUT'} as unknown as EventTarget)).toBe(true);
        expect(isEnterShortcutControl(null)).toBe(false);
    });

    it('marks dialog submission once and reports duplicate attempts', () => {
        const submitted = {current: false};
        const onFirstSubmit = vi.fn();

        expect(markDialogSubmitted(submitted, onFirstSubmit)).toBe(true);
        expect(markDialogSubmitted(submitted, onFirstSubmit)).toBe(false);
        expect(submitted.current).toBe(true);
        expect(onFirstSubmit).toHaveBeenCalledTimes(1);
    });
});
