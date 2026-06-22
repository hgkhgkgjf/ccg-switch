import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ToolResultBlock} from '../../types/chat';
import GenericToolBlock from './GenericToolBlock';

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
    t: (key: string, options?: { target?: string }) => (
      options?.target ? `${key}: ${options.target}` : key
    ),
  }),
}));

vi.mock('../../hooks/useIsToolDenied', () => ({
  useIsToolDenied: () => false,
}));

vi.mock('../../utils/bridge', () => ({
  copyToClipboard: vi.fn(),
  openFile: vi.fn(),
}));

const mockChatState = {
  currentCwd: 'C:/guodevelop/ccg-switch',
};

vi.mock('../../stores/useChatStore', () => ({
  useChatStore: <T,>(selector: (state: typeof mockChatState) => T) => selector(mockChatState),
}));

beforeEach(() => {
  mockUseState.mockReset();
});

function mockComponentState(expanded: boolean, copiedTarget: string | null = null) {
  let calls = 0;
  mockUseState.mockImplementation((initial: unknown) => {
    calls += 1;
    return [calls === 1 ? expanded : calls === 2 ? copiedTarget : initial, vi.fn()];
  });
}

function renderGenericToolStatus(name: string, result: ToolResultBlock): string {
  mockComponentState(false);
  return renderToStaticMarkup(
    createElement(GenericToolBlock, {
      name,
      input: {prompt: 'Choose the next step'},
      result,
      toolId: `tool-${name}`,
    }),
  );
}

function renderGenericTool(
  input: Record<string, unknown>,
  result?: ToolResultBlock | null,
  expanded = false,
  copiedTarget: string | null = null,
): string {
  mockComponentState(expanded, copiedTarget);
  return renderToStaticMarkup(
    createElement(GenericToolBlock, {
      name: 'WebSearch',
      input,
      result,
      toolId: 'tool-web-search',
    }),
  );
}

describe('GenericToolBlock tool status', () => {
  it('keeps ordinary tool_result errors in the error state', () => {
    const html = renderGenericToolStatus('WebSearch', {
      type: 'tool_result',
      tool_use_id: 'tool-WebSearch',
      content: 'Search failed',
      is_error: true,
    });

    expect(html).toContain('tool-status-indicator error');
    expect(html).not.toContain('tool-status-indicator completed');
  });

  it('treats AskUserQuestion tool_result errors as completed user interaction', () => {
    const html = renderGenericToolStatus('AskUserQuestion', {
      type: 'tool_result',
      tool_use_id: 'tool-AskUserQuestion',
      content: 'User answered the question',
      is_error: true,
    });

    expect(html).toContain('tool-status-indicator completed');
    expect(html).not.toContain('tool-status-indicator error');
  });
});

describe('GenericToolBlock header accessibility', () => {
  it('exposes expandable generic tool headers as keyboard-reachable buttons', () => {
    const html = renderGenericTool(
      {query: 'chat ui parity'},
      {
        type: 'tool_result',
        tool_use_id: 'tool-web-search',
        content: 'Search completed',
        is_error: false,
      },
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('labels expandable generic tool headers with an action and target', () => {
    const html = renderGenericTool(
      {query: 'chat ui parity'},
      {
        type: 'tool_result',
        tool_use_id: 'tool-web-search',
        content: 'Search completed',
        is_error: false,
      },
    );

    expect(html).toContain('title="tools.genericDetailsToggle: chat ui parity"');
    expect(html).toContain('aria-label="tools.genericDetailsToggle: chat ui parity"');
  });

  it('mirrors compact header summaries into accessible labels', () => {
    const html = renderGenericTool(
      {query: 'chat ui parity'},
      {
        type: 'tool_result',
        tool_use_id: 'tool-web-search',
        content: 'Search completed',
        is_error: false,
      },
    );

    expect(html).toContain('class="tool-title-summary task-group-item-pattern" title="chat ui parity" aria-label="chat ui parity"');
    expect(html).toContain('class="tool-title-secondary-summary" title="Search completed" aria-label="Search completed"');
  });

  it('does not expose a button role when there is no expandable detail', () => {
    const html = renderGenericTool({command: 'noop'});

    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain('aria-expanded=');
  });

  it('renders file targets as semantic open-file buttons with action labels', () => {
    const html = renderGenericTool({file_path: 'src/App.tsx'});

    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('title="tools.openFile: src/App.tsx" aria-label="tools.openFile: src/App.tsx"');
    expect(html).toContain('src/App.tsx</button>');
  });
});

describe('GenericToolBlock action accessibility', () => {
  it('gives copy input and copy output buttons target-specific labels and tooltips', () => {
    const html = renderGenericTool(
      {query: 'chat ui parity'},
      {
        type: 'tool_result',
        tool_use_id: 'tool-web-search',
        content: 'Search completed',
        is_error: false,
      },
      true,
    );

    expect(html).toContain('title="tools.copyInputForTool: chat ui parity" aria-label="tools.copyInputForTool: chat ui parity"');
    expect(html).toContain('title="tools.copyOutputForTool: chat ui parity" aria-label="tools.copyOutputForTool: chat ui parity"');
  });

  it('only marks the input copy button as copied when the input action was copied', () => {
    const html = renderGenericTool(
      {query: 'chat ui parity'},
      {
        type: 'tool_result',
        tool_use_id: 'tool-web-search',
        content: 'Search completed',
        is_error: false,
      },
      true,
      'input',
    );
    const copiedButtons = html.match(/>tools\.copied<\/button>/g) ?? [];

    expect(copiedButtons).toHaveLength(1);
    expect(html).toContain('>tools.copied</button>');
    expect(html).toContain('>tools.copyOutput</button>');
  });
});
