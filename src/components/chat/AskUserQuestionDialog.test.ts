import {describe, expect, it} from 'vitest';
import {resolveAskUserQuestionShortcutAction} from './AskUserQuestionDialog';

describe('AskUserQuestionDialog shortcuts', () => {
    it('maps Escape to cancel and does not use Enter as a global submit', () => {
        expect(resolveAskUserQuestionShortcutAction('Escape', null)).toBe('cancel');
        expect(resolveAskUserQuestionShortcutAction('Enter', null)).toBeNull();
        expect(resolveAskUserQuestionShortcutAction('Tab', null)).toBeNull();
    });

    it('keeps Escape available on buttons but avoids stealing it from editable controls', () => {
        expect(
            resolveAskUserQuestionShortcutAction('Escape', {tagName: 'BUTTON'} as unknown as EventTarget),
        ).toBe('cancel');
        expect(
            resolveAskUserQuestionShortcutAction('Escape', {tagName: 'INPUT'} as unknown as EventTarget),
        ).toBeNull();
        expect(
            resolveAskUserQuestionShortcutAction('Escape', {
                tagName: 'DIV',
                isContentEditable: true,
            } as unknown as EventTarget),
        ).toBeNull();
    });
});
