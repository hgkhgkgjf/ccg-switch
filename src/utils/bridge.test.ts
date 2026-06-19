import {beforeEach, describe, expect, it, vi} from 'vitest';
import {invoke} from '@tauri-apps/api/core';
import {openFile} from './bridge';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe('bridge openFile', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it('decodes percent-encoded navigation paths before invoking Tauri', async () => {
    await openFile('/Users/demo/my%20file.ts');
    await openFile('/Users/demo/%C3%BCber.txt');

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'open_file_in_editor', {
      filePath: '/Users/demo/my file.ts',
      lineStart: undefined,
      lineEnd: undefined,
      cwd: undefined,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'open_file_in_editor', {
      filePath: '/Users/demo/über.txt',
      lineStart: undefined,
      lineEnd: undefined,
      cwd: undefined,
    });
  });

  it('strips file URLs and preserves cwd for relative resolution', async () => {
    await openFile('file:///C:/Users/demo/my%20file.ts', undefined, undefined, 'C:/guodevelop/ccg-switch');

    expect(invokeMock).toHaveBeenCalledWith('open_file_in_editor', {
      filePath: 'C:/Users/demo/my file.ts',
      lineStart: undefined,
      lineEnd: undefined,
      cwd: 'C:/guodevelop/ccg-switch',
    });
  });

  it('keeps legal literal percent signs in file paths', async () => {
    await expect(openFile('src/reports/100% coverage.md', undefined, undefined, 'C:/guodevelop/ccg-switch'))
      .resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('open_file_in_editor', {
      filePath: 'src/reports/100% coverage.md',
      lineStart: undefined,
      lineEnd: undefined,
      cwd: 'C:/guodevelop/ccg-switch',
    });
  });

  it('parses line and range suffixes when explicit lines are absent', async () => {
    await openFile('src/pages/ChatPage.tsx:42');
    await openFile('src/pages/ChatPage.tsx:50-54');
    await openFile('C:\\guodevelop\\ccg-switch\\src\\utils\\bridge.ts:18:3');

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'open_file_in_editor', {
      filePath: 'src/pages/ChatPage.tsx',
      lineStart: 42,
      lineEnd: undefined,
      cwd: undefined,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'open_file_in_editor', {
      filePath: 'src/pages/ChatPage.tsx',
      lineStart: 50,
      lineEnd: 54,
      cwd: undefined,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'open_file_in_editor', {
      filePath: 'C:\\guodevelop\\ccg-switch\\src\\utils\\bridge.ts',
      lineStart: 18,
      lineEnd: undefined,
      cwd: undefined,
    });
  });

  it('keeps explicit line arguments ahead of suffix hints', async () => {
    await openFile('src/pages/ChatPage.tsx:42', 7, 9);

    expect(invokeMock).toHaveBeenCalledWith('open_file_in_editor', {
      filePath: 'src/pages/ChatPage.tsx',
      lineStart: 7,
      lineEnd: 9,
      cwd: undefined,
    });
  });

  it('does not invoke Tauri for malformed encoded or control-character paths', async () => {
    await expect(openFile('src/%E0%A4%A.ts')).resolves.toBe(false);
    await expect(openFile('src/pages/ChatPage.tsx\u0000')).resolves.toBe(false);

    expect(invokeMock).not.toHaveBeenCalled();
  });
});
