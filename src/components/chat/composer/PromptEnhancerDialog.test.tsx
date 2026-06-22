import {describe, expect, it} from 'vitest';
import {getPromptEnhancerDialogLabels} from './PromptEnhancerDialog';

describe('PromptEnhancerDialog', () => {
    it('keeps modal chrome readable when i18n keys are unavailable', () => {
        const labels = getPromptEnhancerDialogLabels((key) => key);

        expect(labels.title).toBe('Enhance prompt');
        expect(labels.close).toBe('Close');
        expect(labels.original).toBe('Original prompt');
        expect(labels.enhanced).toBe('Enhanced prompt');
        expect(labels.loading).toBe('Enhancing prompt...');
        expect(labels.keepOriginal).toBe('Keep original');
        expect(labels.useEnhanced).toBe('Use enhanced');
    });

    it('uses translated modal labels when i18n provides them', () => {
        const labels = getPromptEnhancerDialogLabels((key) => {
            if (key === 'chat.enhancer.title') return '优化提示词';
            if (key === 'common.close') return '关闭';
            if (key === 'chat.enhancer.original') return '原始提示词';
            if (key === 'chat.enhancer.enhanced') return '优化后提示词';
            if (key === 'chat.enhancer.loading') return '正在优化...';
            if (key === 'chat.enhancer.keepOriginal') return '保留原文';
            if (key === 'chat.enhancer.useEnhanced') return '使用优化版';
            return key;
        });

        expect(labels).toEqual({
            title: '优化提示词',
            close: '关闭',
            original: '原始提示词',
            enhanced: '优化后提示词',
            loading: '正在优化...',
            keepOriginal: '保留原文',
            useEnhanced: '使用优化版',
        });
    });
});
