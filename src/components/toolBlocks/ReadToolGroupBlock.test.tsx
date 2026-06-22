import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import ReadToolGroupBlock from './ReadToolGroupBlock';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { target?: string }) => (
      options?.target ? `${key}: ${options.target}` : key
    ),
  }),
}));

vi.mock('../../stores/useChatStore', () => ({
  useChatStore: (selector: (state: { currentCwd: string }) => unknown) =>
    selector({ currentCwd: 'C:/guodevelop/ccg-switch' }),
}));

vi.mock('../../hooks/useIsToolDenied', () => ({
  useIsToolDenied: () => false,
}));

vi.mock('../../utils/bridge', () => ({
  copyToClipboard: vi.fn(),
  openFile: vi.fn(),
}));

function renderReadToolGroupBlock(): string {
  const blocks: ToolUseBlock[] = [
    {
      type: 'tool_use',
      id: 'read-1',
      name: 'Read',
      input: {file_path: 'src/App.tsx', offset: 10, limit: 20},
    },
    {
      type: 'tool_use',
      id: 'read-2',
      name: 'Read',
      input: {file_path: 'src/main.tsx'},
    },
    {
      type: 'tool_use',
      id: 'read-3',
      name: 'Read',
      input: {file_path: 'src/error.tsx'},
    },
  ];
  const results: Record<string, ToolResultBlock> = {
    'read-1': {
      type: 'tool_result',
      tool_use_id: 'read-1',
      content: 'file content',
      is_error: false,
    },
    'read-3': {
      type: 'tool_result',
      tool_use_id: 'read-3',
      content: 'Read failed',
      is_error: true,
    },
  };

  return renderToStaticMarkup(
    createElement(ReadToolGroupBlock, {
      blocks,
      findToolResult: (toolId: string) => results[toolId] ?? null,
    }),
  );
}

describe('ReadToolGroupBlock item accessibility', () => {
  it('exposes each expandable file row as a keyboard-reachable button', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain('class="task-group-item-header" role="button" tabindex="0" aria-expanded="false"');
  });

  it('labels the group header toggle with an action and file target', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain('title="tools.readGroupDetailsToggle: src/App.tsx · 3 files · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('aria-label="tools.readGroupDetailsToggle: src/App.tsx · 3 files · tools.success · 1 tools.failed · 1 tools.pending"');
  });

  it('shows the mixed read status counts in the group header', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain('class="tool-title-summary" title="src/App.tsx" aria-label="src/App.tsx"');
    expect(html).toContain('class="tool-title-secondary-summary" title="3 files · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('aria-label="3 files · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('3 files · tools.success · 1 tools.failed · 1 tools.pending');
  });

  it('labels each expandable file row with an action and file target', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain('title="tools.readGroupItemDetailsToggle: src/App.tsx"');
    expect(html).toContain('aria-label="tools.readGroupItemDetailsToggle: src/App.tsx"');
  });

  it('renders file targets as semantic open-file buttons with action labels', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain(
      '<button type="button" class="task-group-item-file file-path-button clickable-file" title="tools.openFile: src/App.tsx" aria-label="tools.openFile: src/App.tsx"',
    );
  });

  it('labels compact line summaries with their read target', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain(
      'class="task-group-item-secondary" title="Read lines: src/App.tsx · L11-30" aria-label="Read lines: src/App.tsx · L11-30"',
    );
  });

  it('labels row status pills with their read target', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain('class="tool-state-pill completed" title="Read: src/App.tsx · tools.success" aria-label="Read: src/App.tsx · tools.success"');
    expect(html).toContain('class="tool-state-pill error" title="Read: src/error.tsx · tools.failed" aria-label="Read: src/error.tsx · tools.failed"');
  });
});

describe('ReadToolGroupBlock action accessibility', () => {
  it('gives bulk expand and collapse buttons stable labels and tooltips', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toContain('title="tools.expandAllInGroup: src/App.tsx · 3 files · tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.expandAllInGroup: src/App.tsx · 3 files · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('title="tools.collapseAllInGroup: src/App.tsx · 3 files · tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.collapseAllInGroup: src/App.tsx · 3 files · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('>tools.expandAll</button>');
    expect(html).toContain('>tools.collapseAll</button>');
  });

  it('disables collapse all until at least one file row is expanded', () => {
    const html = renderReadToolGroupBlock();

    expect(html).toMatch(/aria-label="tools\.expandAllInGroup: src\/App\.tsx · 3 files · tools\.success · 1 tools\.failed · 1 tools\.pending">tools\.expandAll<\/button>/);
    expect(html).toMatch(/aria-label="tools\.collapseAllInGroup: src\/App\.tsx · 3 files · tools\.success · 1 tools\.failed · 1 tools\.pending" disabled="">tools\.collapseAll<\/button>/);
  });
});
