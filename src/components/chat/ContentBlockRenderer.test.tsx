import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ContentBlockRenderer, {ImageLightbox} from './ContentBlockRenderer';
import type {ContentBlock} from '../../types/chat';

vi.mock('@tauri-apps/api/core', () => ({
    convertFileSrc: (path: string) => `asset://${path}`,
    invoke: vi.fn(),
}));

describe('ContentBlockRenderer', () => {
    it('renders image content blocks as thumbnails with a data url', () => {
        const blocks = [
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgo=',
                },
                fileName: 'screen.png',
            },
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
            />,
        );

        expect(html).toContain('chat-image-thumbnail');
        expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
        expect(html).toContain('screen.png');
    });

    it('normalizes local file urls before rendering Tauri image assets', () => {
        const blocks = [
            {
                type: 'input_image',
                image_url: 'file:///C:/Users/Administrator/Pictures/screen.png',
            },
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
            />,
        );

        expect(html).toContain('src="asset://C:/Users/Administrator/Pictures/screen.png"');
        expect(html).not.toContain('asset://file:///');
    });

    it('renders user uploaded image blocks as compact thumbnails', () => {
        const blocks = [
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgo=',
                },
                fileName: 'screen.png',
            },
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
                imageDisplay="user-thumbnail"
            />,
        );

        expect(html).toContain('chat-image-block-user');
        expect(html).toContain('chat-image-thumbnail-user');
        expect(html).toContain('max-w-[52vw]');
        expect(html).toContain('sm:max-w-[200px]');
        expect(html).toContain('sr-only');
    });

    it('renders a visible image label inside the lightbox', () => {
        const html = renderToStaticMarkup(
            <ImageLightbox
                image={{
                    label: 'diagram-100% coverage.png',
                    mediaType: 'image/png',
                    src: 'asset://C:/screens/diagram-100% coverage.png',
                }}
                closeLabel="Close"
                onClose={() => undefined}
            />,
        );

        expect(html).toContain('diagram-100% coverage.png');
        expect(html).toContain('chat-image-lightbox-caption');
    });

    it('passes compact rendering through to single tool blocks', () => {
        const blocks = [
            {
                type: 'tool_use',
                id: 'tool-read-1',
                name: 'Read',
                input: {
                    file_path: 'src/components/chat/ContentBlockRenderer.tsx',
                    start_line: 10,
                    end_line: 20,
                },
            },
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
                compact
            />,
        );

        expect(html).toContain('task-container-compact');
        expect(html).toContain('task-header-compact');
        expect(html).not.toContain('task-details-compact');
        expect(html).not.toContain('file-path-display');
    });

    it('exposes a stable transcript anchor for a single tool block', () => {
        const blocks = [
            {
                type: 'tool_use',
                id: 'tool-read-anchor',
                name: 'Read',
                input: {
                    file_path: 'src/components/chat/ContentBlockRenderer.tsx',
                },
            },
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
                compact
            />,
        );

        expect(html).toContain('chat-tool-anchor');
        expect(html).toContain('data-chat-tool-id="tool-read-anchor"');
        expect(html).toContain('tabindex="-1"');
    });

    it('uses stable compact block spacing for assistant transcript flow', () => {
        const blocks = [
            {type: 'text', text: '先解释当前状态。'},
            {
                type: 'tool_use',
                id: 'tool-read-spacing',
                name: 'Read',
                input: {
                    file_path: 'src/pages/ChatPage.tsx',
                },
            },
            {type: 'text', text: '再给出下一步。'},
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
                compact
            />,
        );

        expect(html).toContain('chat-content-blocks');
        expect(html).toContain('chat-content-blocks-compact');
    });

    it('passes compact rendering through to grouped tool blocks', () => {
        const blocks = Array.from({length: 3}, (_, index) => ({
            type: 'tool_use',
            id: `tool-read-${index + 1}`,
            name: 'Read',
            input: {
                file_path: `src/example-${index + 1}.ts`,
            },
        })) as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
                compact
            />,
        );

        expect(html).toContain('task-group-container-compact');
        expect(html).toContain('task-group-header-compact');
        expect(html).toContain('aria-expanded="false"');
        expect(html).not.toContain('task-group-list');
        expect(html).not.toContain('task-group-actions');
        expect(html).not.toContain('task-group-item-header');
        expect(html).not.toContain('src/example-2.ts');
    });

    it('exposes grouped tool ids as one transcript anchor target', () => {
        const blocks = Array.from({length: 3}, (_, index) => ({
            type: 'tool_use',
            id: `tool-group-anchor-${index + 1}`,
            name: 'Read',
            input: {
                file_path: `src/grouped-${index + 1}.ts`,
            },
        })) as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
                compact
            />,
        );

        expect(html).toContain('chat-tool-anchor');
        expect(html).toContain('data-chat-tool-ids="tool-group-anchor-1 tool-group-anchor-2 tool-group-anchor-3"');
        expect(html).toContain('tabindex="-1"');
    });

    it('keeps grouped tool lists expanded outside compact rendering', () => {
        const blocks = Array.from({length: 3}, (_, index) => ({
            type: 'tool_use',
            id: `tool-bash-${index + 1}`,
            name: 'Bash',
            input: {
                command: `npm run check:${index + 1}`,
            },
        })) as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
            />,
        );

        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('task-group-list');
        expect(html).toContain('task-group-actions');
        expect(html).toContain('npm run check:2');
    });

    it('renders adjacent text blocks as one markdown document', () => {
        const blocks = [
            {type: 'text', text: '**上轮进展与阻塞**\n记录里声称完成。'},
            {type: 'text', text: '- **本轮规划**：先定位根因。'},
            {type: 'text', text: '- **验证结果**：保留列表。'},
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => null}
            />,
        );

        const markdownBlockCount = html.match(/markdown-block/g)?.length ?? 0;
        expect(markdownBlockCount).toBe(1);
        expect(html).toContain('记录里声称完成。\n\n- **本轮规划**：先定位根因。');
        expect(html).toContain('- **验证结果**：保留列表。');
    });

    it('merges repeated edit rows for the same file inside grouped edit output', () => {
        const blocks = [
            {
                type: 'tool_use',
                id: 'patch-1',
                name: 'apply_patch',
                input: {
                    patch: [
                        '*** Begin Patch',
                        '*** Update File: src/styles/toolBlocks.css',
                        '@@ -10,2 +10,4 @@',
                        ' keep',
                        '-old padding',
                        '+new padding',
                        '+new border',
                        '+new shadow',
                        '*** End Patch',
                    ].join('\n'),
                },
            },
            {
                type: 'tool_use',
                id: 'patch-2',
                name: 'apply_patch',
                input: {
                    patch: [
                        '*** Begin Patch',
                        '*** Update File: src\\styles\\toolBlocks.css',
                        '@@ -30,3 +30,2 @@',
                        ' keep again',
                        '-old hover',
                        '-old color',
                        '+new hover',
                        '*** End Patch',
                    ].join('\n'),
                },
            },
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={() => ({type: 'tool_result', tool_use_id: 'patch-1', content: 'ok'} as never)}
            />,
        );

        const rowCount = (html.match(/task-group-item-header/g) ?? []).length;
        expect(rowCount).toBe(1);
        expect(html).toContain('(1)');
        expect(html).toContain('src/styles/toolBlocks.css');
        expect(html).toContain('+4');
        expect(html).toContain('-3');
        expect(html).not.toContain('src\\styles\\toolBlocks.css');
    });

    it('keeps generic compact tool details collapsed by default', () => {
        const blocks = [
            {
                type: 'tool_use',
                id: 'tool-generic-1',
                name: 'shell_command',
                input: {
                    timeout_ms: 120000,
                    command: 'npm test -- src/components/chat/ContentBlockRenderer.test.tsx',
                },
            },
        ] as unknown as ContentBlock[];

        const html = renderToStaticMarkup(
            <ContentBlockRenderer
                blocks={blocks}
                findToolResult={(toolId) => toolId === 'tool-generic-1'
                    ? {
                        type: 'tool_result',
                        tool_use_id: toolId,
                        content: 'Test Files 3 passed\\nTests 36 passed',
                    } as never
                    : null}
                compact
            />,
        );

        expect(html).toContain('task-header-compact');
        expect(html).toContain('Test Files 3 passed');
        expect(html).not.toContain('tool-section-label');
        expect(html).not.toContain('tool-result-text');
    });
});
