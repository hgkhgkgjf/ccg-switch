import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import EditToolGroupBlock from './EditToolGroupBlock';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { target?: string; file?: string; additions?: number; deletions?: number },
    ) => {
      if (key === 'chat.layout.inputStatusEditFileStats' && options?.file) {
        return `Edit stats: ${options.file} · +${options.additions} / -${options.deletions}`;
      }
      return options?.target ? `${key}: ${options.target}` : key;
    },
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

vi.mock('./EditDiffPreview', () => ({
  default: () => createElement('span', {className: 'edit-diff-preview-test'}),
}));

function renderEditToolGroupBlock(): string {
  const blocks: ToolUseBlock[] = [
    {
      type: 'tool_use',
      id: 'edit-1',
      name: 'Edit',
      input: {
        file_path: 'src/App.tsx',
        old_string: 'const oldValue = true;',
        new_string: 'const newValue = false;',
      },
    },
    {
      type: 'tool_use',
      id: 'edit-2',
      name: 'Edit',
      input: {
        file_path: 'src/main.tsx',
        old_string: 'renderApp();',
        new_string: 'renderApp({ strict: true });',
      },
    },
    {
      type: 'tool_use',
      id: 'edit-3',
      name: 'Edit',
      input: {
        file_path: 'src/error.tsx',
        old_string: 'throw oldError;',
        new_string: 'throw newError;',
      },
    },
  ];
  const results: Record<string, ToolResultBlock> = {
    'edit-1': {
      type: 'tool_result',
      tool_use_id: 'edit-1',
      content: 'Updated src/App.tsx',
      is_error: false,
    },
    'edit-3': {
      type: 'tool_result',
      tool_use_id: 'edit-3',
      content: 'Edit failed',
      is_error: true,
    },
  };

  return renderToStaticMarkup(
    createElement(EditToolGroupBlock, {
      blocks,
      findToolResult: (toolId: string) => results[toolId] ?? null,
    }),
  );
}

describe('EditToolGroupBlock item accessibility', () => {
  it('exposes each expandable edit row as a keyboard-reachable button', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain('class="task-group-item-header" role="button" tabindex="0" aria-expanded="false"');
  });

  it('labels the group header toggle with an action and edit target', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain('title="tools.editGroupDetailsToggle: src/App.tsx · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('aria-label="tools.editGroupDetailsToggle: src/App.tsx · tools.success · 1 tools.failed · 1 tools.pending"');
  });

  it('shows the mixed edit status counts in the group header', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain('class="tool-title-secondary-summary" title="tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('tools.success · 1 tools.failed · 1 tools.pending');
  });

  it('mirrors group total edit stats into an accessible target label', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain('class="edit-total-stats" title="Edit stats: src/App.tsx · 3 files · +3 / -3" aria-label="Edit stats: src/App.tsx · 3 files · +3 / -3"');
    expect(html).toContain('<span class="edit-stat-added" aria-hidden="true">+3</span>');
    expect(html).toContain('<span class="edit-stat-deleted" aria-hidden="true">-3</span>');
  });

  it('labels each expandable edit row with an action and edit target', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain('title="tools.editGroupItemDetailsToggle: src/App.tsx"');
    expect(html).toContain('aria-label="tools.editGroupItemDetailsToggle: src/App.tsx"');
  });

  it('renders editable file targets as semantic open-file buttons with target labels', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain(
      '<button type="button" class="task-group-item-file file-path-button clickable-file edit-diff-hover-trigger" title="tools.openFile: src/App.tsx" aria-label="tools.openFile: src/App.tsx"',
    );
    expect(html).toContain('<span class="edit-diff-hover-label">src/App.tsx</span>');
    expect(html).toContain('class="edit-diff-preview-test"');
  });

  it('mirrors row edit stats into accessible file-scoped labels', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain('class="task-group-item-badge edit-item-stats" title="Edit stats: src/App.tsx · +1 / -1" aria-label="Edit stats: src/App.tsx · +1 / -1"');
    expect(html).toContain('class="task-group-item-badge edit-item-stats" title="Edit stats: src/main.tsx · +1 / -1" aria-label="Edit stats: src/main.tsx · +1 / -1"');
    expect(html).toContain('class="task-group-item-badge edit-item-stats" title="Edit stats: src/error.tsx · +1 / -1" aria-label="Edit stats: src/error.tsx · +1 / -1"');
  });
});

describe('EditToolGroupBlock action accessibility', () => {
  it('gives bulk expand and collapse buttons stable labels and tooltips', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toContain('title="tools.expandAllInGroup: src/App.tsx · tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.expandAllInGroup: src/App.tsx · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('title="tools.collapseAllInGroup: src/App.tsx · tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.collapseAllInGroup: src/App.tsx · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('>tools.expandAll</button>');
    expect(html).toContain('>tools.collapseAll</button>');
  });

  it('disables collapse all until at least one edit row is expanded', () => {
    const html = renderEditToolGroupBlock();

    expect(html).toMatch(/aria-label="tools\.expandAllInGroup: src\/App\.tsx · tools\.success · 1 tools\.failed · 1 tools\.pending">tools\.expandAll<\/button>/);
    expect(html).toMatch(/aria-label="tools\.collapseAllInGroup: src\/App\.tsx · tools\.success · 1 tools\.failed · 1 tools\.pending" disabled="">tools\.collapseAll<\/button>/);
  });
});
