import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ContentBlockRenderer from './ContentBlockRenderer';
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
