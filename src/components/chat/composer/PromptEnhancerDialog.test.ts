import {describe, expect, it} from 'vitest';
import {resolvePromptEnhancerShortcutAction} from './PromptEnhancerDialog';

describe('PromptEnhancerDialog shortcuts', () => {
    it('uses the enhanced prompt on Enter only after a result is ready', () => {
        expect(resolvePromptEnhancerShortcutAction('Enter', null, {
            isLoading: false,
            hasEnhancedPrompt: true,
        })).toBe('use-enhanced');
        expect(resolvePromptEnhancerShortcutAction('Enter', null, {
            isLoading: true,
            hasEnhancedPrompt: true,
        })).toBeNull();
        expect(resolvePromptEnhancerShortcutAction('Enter', null, {
            isLoading: false,
            hasEnhancedPrompt: false,
        })).toBeNull();
    });

    it('closes on Escape unless focus is inside an editable control', () => {
        expect(resolvePromptEnhancerShortcutAction('Escape', null, {
            isLoading: false,
            hasEnhancedPrompt: true,
        })).toBe('close');
        expect(resolvePromptEnhancerShortcutAction(
            'Escape',
            {tagName: 'TEXTAREA'} as unknown as EventTarget,
            {
                isLoading: false,
                hasEnhancedPrompt: true,
            },
        )).toBeNull();
    });

    it('does not steal Enter from focused buttons or editable controls', () => {
        expect(resolvePromptEnhancerShortcutAction(
            'Enter',
            {tagName: 'BUTTON'} as unknown as EventTarget,
            {
                isLoading: false,
                hasEnhancedPrompt: true,
            },
        )).toBeNull();
        expect(resolvePromptEnhancerShortcutAction(
            'Enter',
            {
                tagName: 'DIV',
                isContentEditable: true,
            } as unknown as EventTarget,
            {
                isLoading: false,
                hasEnhancedPrompt: true,
            },
        )).toBeNull();
    });
});
