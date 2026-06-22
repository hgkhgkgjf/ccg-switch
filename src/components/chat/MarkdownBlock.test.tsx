import {describe, expect, it} from 'vitest';
import {getMarkdownCodeCopyLabels} from './MarkdownBlock';

describe('MarkdownBlock', () => {
    it('keeps code-copy labels readable when i18n keys are unavailable', () => {
        const labels = getMarkdownCodeCopyLabels((key) => key);

        expect(labels.copyCodeLabel).toBe('Copy code');
        expect(labels.copiedCodeLabel).toBe('Copied code');
    });

    it('uses translated code-copy labels when i18n provides them', () => {
        const labels = getMarkdownCodeCopyLabels((key) => {
            if (key === 'chat.markdown.copyCode') return '复制代码';
            if (key === 'chat.markdown.copiedCode') return '已复制代码';
            return key;
        });

        expect(labels.copyCodeLabel).toBe('复制代码');
        expect(labels.copiedCodeLabel).toBe('已复制代码');
    });
});
