import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import SearchToolGroupBlock from './SearchToolGroupBlock';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';

const mockUseState = vi.hoisted(() => vi.fn());

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: mockUseState,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: {count?: number; target?: string}) => {
      if (options?.target) return `${key}: ${options.target}`;
      return typeof options?.count === 'number' ? `${key}:${options.count}` : key;
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

beforeEach(() => {
  mockUseState.mockReset();
});

function mockComponentState(expandedSearchRows = new Set<number>()) {
  let calls = 0;
  mockUseState.mockImplementation((initial: unknown) => {
    calls += 1;
    if (calls === 2) {
      return [expandedSearchRows, vi.fn()];
    }

    return [initial, vi.fn()];
  });
}

function renderSearchToolGroupBlock(
  expandedSearchRows = new Set<number>(),
  searchResultContent = [
    'src/App.tsx:12:const [value, setValue] = useState(false);',
    'src/App.tsx:48:const [count, setCount] = useState(0);',
  ].join('\n'),
): string {
  mockComponentState(expandedSearchRows);
  const blocks: ToolUseBlock[] = [
    {
      type: 'tool_use',
      id: 'search-1',
      name: 'Grep',
      input: {pattern: 'useState', path: 'src'},
    },
    {
      type: 'tool_use',
      id: 'search-2',
      name: 'Glob',
      input: {pattern: '**/*.tsx', path: 'src/components'},
    },
    {
      type: 'tool_use',
      id: 'search-3',
      name: 'Grep',
      input: {pattern: 'failed query', path: 'src-tauri'},
    },
  ];
  const results: Record<string, ToolResultBlock> = {
    'search-1': {
      type: 'tool_result',
      tool_use_id: 'search-1',
      content: searchResultContent,
      is_error: false,
    },
    'search-3': {
      type: 'tool_result',
      tool_use_id: 'search-3',
      content: 'ripgrep failed',
      is_error: true,
    },
  };

  return renderToStaticMarkup(
    createElement(SearchToolGroupBlock, {
      blocks,
      findToolResult: (toolId: string) => results[toolId] ?? null,
    }),
  );
}

describe('SearchToolGroupBlock item accessibility', () => {
  it('exposes each expandable search row as a keyboard-reachable button', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('class="task-group-item-header" role="button" tabindex="0" aria-expanded="false"');
  });

  it('labels the group header toggle with an action and search target', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('title="tools.searchGroupDetailsToggle: useState · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('aria-label="tools.searchGroupDetailsToggle: useState · tools.success · 1 tools.failed · 1 tools.pending"');
  });

  it('shows the mixed search status counts in the group header', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('class="tool-title-summary" title="useState" aria-label="useState"');
    expect(html).toContain('class="tool-title-secondary-summary" title="tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('aria-label="tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('tools.success · 1 tools.failed · 1 tools.pending');
  });

  it('labels each expandable search row with an action and search target', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('title="tools.searchGroupItemDetailsToggle: useState"');
    expect(html).toContain('aria-label="tools.searchGroupItemDetailsToggle: useState"');
  });

  it('labels row pattern and result summaries with their search context', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('class="task-group-item-pattern" title="Search query: useState" aria-label="Search query: useState"');
    expect(html).toContain('class="task-group-item-secondary" title="Search results for useState: 2 matches · 1 file" aria-label="Search results for useState: 2 matches · 1 file"');
  });

  it('labels row status pills with their search target', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('class="tool-state-pill completed" title="Search: useState · tools.success" aria-label="Search: useState · tools.success"');
    expect(html).toContain('class="tool-state-pill error" title="Search: failed query · tools.failed" aria-label="Search: failed query · tools.failed"');
  });
});

describe('SearchToolGroupBlock action accessibility', () => {
  it('gives bulk expand and collapse buttons stable labels and tooltips', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('title="tools.expandAllInGroup: useState · tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.expandAllInGroup: useState · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('title="tools.collapseAllInGroup: useState · tools.success · 1 tools.failed · 1 tools.pending" aria-label="tools.collapseAllInGroup: useState · tools.success · 1 tools.failed · 1 tools.pending"');
    expect(html).toContain('>tools.expandAll</button>');
    expect(html).toContain('>tools.collapseAll</button>');
  });

  it('disables collapse all until at least one search row is expanded', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toMatch(/aria-label="tools\.expandAllInGroup: useState · tools\.success · 1 tools\.failed · 1 tools\.pending">tools\.expandAll<\/button>/);
    expect(html).toMatch(/aria-label="tools\.collapseAllInGroup: useState · tools\.success · 1 tools\.failed · 1 tools\.pending" disabled="">tools\.collapseAll<\/button>/);
  });

  it('labels search result file buttons with the open-file action and target path', () => {
    const html = renderSearchToolGroupBlock();

    expect(html).toContain('title="tools.openFile: src/App.tsx" aria-label="tools.openFile: src/App.tsx"');
  });

  it('shows match snippets in expanded result rows with contextual labels', () => {
    const html = renderSearchToolGroupBlock(new Set([0]));

    expect(html).toContain('class="search-result-file-snippet" title="const [value, setValue] = useState(false);" aria-label="Search result snippet: const [value, setValue] = useState(false);"');
    expect(html).toContain('title="Open search result: src/App.tsx · L12 · const [value, setValue] = useState(false);"');
    expect(html).toContain('aria-label="Open search result: src/App.tsx · L12 · const [value, setValue] = useState(false);"');
  });

  it('renders multiple same-file matches as separate expanded result rows', () => {
    const html = renderSearchToolGroupBlock(new Set([0]));

    expect(html).toContain('title="Open search result: src/App.tsx · L12 · const [value, setValue] = useState(false);"');
    expect(html).toContain('title="Open search result: src/App.tsx · L48 · const [count, setCount] = useState(0);"');
    expect(html).toContain('class="search-result-file-line" title="Search result line: src/App.tsx · L48" aria-label="Search result line: src/App.tsx · L48"');
    expect(html).toContain('class="search-result-file-snippet" title="const [count, setCount] = useState(0);" aria-label="Search result snippet: const [count, setCount] = useState(0);"');
  });

  it('shows an accessible overflow footer when expanded search rows are capped', () => {
    const searchResultContent = Array.from(
      {length: 10},
      (_, index) => `src/App.tsx:${index + 1}:match ${index + 1}`,
    ).join('\n');
    const html = renderSearchToolGroupBlock(new Set([0]), searchResultContent);

    expect(html).toContain('class="search-result-files-footer" title="tools.searchMoreResults:2" aria-label="tools.searchMoreResults:2"');
    expect(html).toContain('>tools.searchMoreResults:2</div>');
    expect(html).not.toContain('Open search result: src/App.tsx · L9 · match 9');
  });
});
