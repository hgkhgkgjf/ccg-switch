import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import BashToolGroupBlock from './BashToolGroupBlock';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: {count?: number; target?: string}) => {
      if (options?.target) return `${key}: ${options.target}`;
      return typeof options?.count === 'number' ? `${key}:${options.count}` : key;
    },
  }),
}));

vi.mock('../../hooks/useIsToolDenied', () => ({
  useIsToolDenied: () => false,
}));

vi.mock('../../utils/bridge', () => ({
  copyToClipboard: vi.fn(),
}));

function renderBashToolGroupBlock(): string {
  const blocks: ToolUseBlock[] = [
    {
      type: 'tool_use',
      id: 'bash-1',
      name: 'Bash',
      input: {command: 'npm test', description: 'Run tests'},
    },
    {
      type: 'tool_use',
      id: 'bash-2',
      name: 'Bash',
      input: {command: 'npm run build', description: 'Build app'},
    },
    {
      type: 'tool_use',
      id: 'bash-3',
      name: 'Bash',
      input: {command: 'cargo test', description: 'Run backend tests'},
    },
    {
      type: 'tool_use',
      id: 'bash-4',
      name: 'Bash',
      input: {command: 'npm run tauri build', description: 'Build desktop app'},
    },
  ];
  const results: Record<string, ToolResultBlock> = {
    'bash-1': {
      type: 'tool_result',
      tool_use_id: 'bash-1',
      content: 'Tests passed',
      is_error: false,
    },
    'bash-2': {
      type: 'tool_result',
      tool_use_id: 'bash-2',
      content: 'Build passed',
      is_error: false,
    },
    'bash-3': {
      type: 'tool_result',
      tool_use_id: 'bash-3',
      content: 'Tests failed',
      is_error: true,
    },
  };

  return renderToStaticMarkup(
    createElement(BashToolGroupBlock, {
      blocks,
      findToolResult: (toolId: string) => results[toolId] ?? null,
    }),
  );
}

describe('BashToolGroupBlock item accessibility', () => {
  it('exposes each expandable command row as a keyboard-reachable button', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toContain('class="task-group-item-header" role="button" tabindex="0" aria-expanded="false"');
  });

  it('labels the group header toggle with an action and command target', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toContain('title="tools.bashGroupDetailsToggle: npm test · 2 tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('aria-label="tools.bashGroupDetailsToggle: npm test · 2 tools.success · 1 tools.failed · 1 tools.pending"');
  });

  it('shows the mixed execution status summary in the group header', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toContain('class="tool-command-chip tool-command-run" title="tools.commandCount:4" aria-label="tools.commandCount:4"');
    expect(html).toContain('class="tool-title-summary" title="npm test" aria-label="npm test"');
    expect(html).toContain('class="tool-title-secondary-summary" title="2 tools.success · 1 tools.failed · 1 tools.pending" aria-label="2 tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('2 tools.success · 1 tools.failed · 1 tools.pending');
  });

  it('labels each expandable command row with an action and command target', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toContain('title="tools.bashGroupItemDetailsToggle: npm test"');
    expect(html).toContain('aria-label="tools.bashGroupItemDetailsToggle: npm test"');
  });

  it('mirrors row command and result summaries into accessible labels', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toContain('class="task-group-item-command" title="npm test" aria-label="npm test"');
    expect(html).toContain('class="task-group-item-secondary " title="Tests passed" aria-label="Tests passed"');
    expect(html).toContain('class="task-group-item-secondary error" title="Tests failed" aria-label="Tests failed"');
  });

  it('labels each row status pill with command context', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toContain('class="tool-state-pill completed" title="Bash: npm test · tools.success" aria-label="Bash: npm test · tools.success"');
    expect(html).toContain('class="tool-state-pill error" title="Bash: cargo test · tools.failed" aria-label="Bash: cargo test · tools.failed"');
    expect(html).toContain('class="tool-state-pill pending" title="Bash: npm run tauri build · tools.pending" aria-label="Bash: npm run tauri build · tools.pending"');
  });
});

describe('BashToolGroupBlock action accessibility', () => {
  it('gives bulk expand and collapse buttons stable labels and tooltips', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toContain('title="tools.expandAllInGroup: npm test · 2 tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.expandAllInGroup: npm test · 2 tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('title="tools.collapseAllInGroup: npm test · 2 tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.collapseAllInGroup: npm test · 2 tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('>tools.expandAll</button>');
    expect(html).toContain('>tools.collapseAll</button>');
  });

  it('disables collapse all until at least one command row is expanded', () => {
    const html = renderBashToolGroupBlock();

    expect(html).toMatch(/aria-label="tools\.expandAllInGroup: npm test · 2 tools\.success · 1 tools\.failed · 1 tools\.pending">tools\.expandAll<\/button>/);
    expect(html).toMatch(/aria-label="tools\.collapseAllInGroup: npm test · 2 tools\.success · 1 tools\.failed · 1 tools\.pending" disabled="">tools\.collapseAll<\/button>/);
  });
});
