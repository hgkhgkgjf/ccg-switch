import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { memo, useMemo, useRef, useEffect } from 'react';
import hljs from 'highlight.js/lib/core';
import { markedHighlight } from 'marked-highlight';

// 导入常用语言
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

// 导入样式
import 'highlight.js/styles/github-dark.css';

// 注册语言
const languages = [
    ['bash', bash],
    ['css', css],
    ['diff', diff],
    ['go', go],
    ['java', java],
    ['javascript', javascript],
    ['json', json],
    ['kotlin', kotlin],
    ['python', python],
    ['rust', rust],
    ['sql', sql],
    ['typescript', typescript],
    ['xml', xml],
    ['yaml', yaml],
] as const;

languages.forEach(([name, lang]) => {
    hljs.registerLanguage(name, lang);
});

// 注册别名
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['sh', 'zsh'], { languageName: 'bash' });
hljs.registerAliases(['html'], { languageName: 'xml' });
hljs.registerAliases(['yml'], { languageName: 'yaml' });

// 配置 marked 使用语法高亮
marked.use(
    markedHighlight({
        highlight(code: string, lang: string) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch {
                    // Fall through
                }
            }
            return hljs.highlightAuto(code).value;
        },
    })
);

// 配置 marked 选项
marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // 换行符转换为 <br>
});

interface MarkdownBlockProps {
    content: string;
    isStreaming?: boolean;
}

/**
 * Markdown 渲染组件
 * 支持代码高亮、GFM、代码复制按钮
 */
function MarkdownBlock({ content, isStreaming = false }: MarkdownBlockProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // 渲染 Markdown
    const html = useMemo(() => {
        let markdown = content;

        // 流式渲染：自动补全未闭合的代码块
        if (isStreaming && content.includes('```')) {
            const openCount = (content.match(/```/g) || []).length;
            if (openCount % 2 === 1) {
                markdown = content + '\n```';
            }
        }

        try {
            const rawHtml = marked.parse(markdown) as string;
            // XSS 防护
            return DOMPurify.sanitize(rawHtml, {
                ALLOW_UNKNOWN_PROTOCOLS: true,
            });
        } catch (e) {
            console.error('[MarkdownBlock] Parse error:', e);
            return content;
        }
    }, [content, isStreaming]);

    // 添加复制按钮到代码块
    useEffect(() => {
        if (!containerRef.current) return;

        const codeBlocks = containerRef.current.querySelectorAll('pre > code');
        codeBlocks.forEach((codeBlock) => {
            const pre = codeBlock.parentElement;
            if (!pre || pre.querySelector('.copy-button')) return;

            // 创建复制按钮
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            button.title = 'Copy code';

            button.addEventListener('click', async () => {
                const code = codeBlock.textContent || '';
                try {
                    await navigator.clipboard.writeText(code);
                    button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                        button.classList.remove('copied');
                    }, 2000);
                } catch (e) {
                    console.error('[MarkdownBlock] Copy failed:', e);
                }
            });

            pre.style.position = 'relative';
            pre.appendChild(button);
        });
    }, [html]);

    return (
        <div
            ref={containerRef}
            className="markdown-block"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export default memo(MarkdownBlock);
