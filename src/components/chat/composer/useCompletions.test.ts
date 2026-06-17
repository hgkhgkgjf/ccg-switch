import {describe, expect, it} from 'vitest';
import {normalizeWorkspaceFile} from './useCompletions';

describe('normalizeWorkspaceFile', () => {
    it('accepts snake_case payloads from Rust commands', () => {
        expect(normalizeWorkspaceFile({
            rel_path: 'src/pages/ChatPage.tsx',
            name: 'ChatPage.tsx',
            is_dir: false,
        })).toEqual({
            relPath: 'src/pages/ChatPage.tsx',
            name: 'ChatPage.tsx',
            isDir: false,
        });
    });

    it('accepts camelCase payloads from future frontend adapters', () => {
        expect(normalizeWorkspaceFile({
            relPath: 'src/components/chat',
            name: 'chat',
            isDir: true,
        })).toEqual({
            relPath: 'src/components/chat',
            name: 'chat',
            isDir: true,
        });
    });

    it('drops invalid items instead of rendering undefined candidates', () => {
        expect(normalizeWorkspaceFile({
            name: 'missing-path.ts',
            is_dir: false,
        })).toBeNull();
    });
});
