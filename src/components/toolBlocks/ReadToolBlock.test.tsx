import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ReadToolBlock from './ReadToolBlock';

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
    t: (key: string, options?: { file?: string; target?: string }) => (
      options?.file || options?.target ? `${key}: ${options.file ?? options.target}` : key
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

function mockComponentState(expanded: boolean) {
  let calls = 0;
  mockUseState.mockImplementation((initial: unknown) => {
    calls += 1;
    return [calls === 1 ? expanded : initial, vi.fn()];
  });
}

function renderReadToolBlock(expanded = false): string {
  mockComponentState(expanded);
  return renderToStaticMarkup(
    createElement(ReadToolBlock, {
      name: 'Read',
      input: {
        file_path: 'src/components/toolBlocks/ReadToolBlock.tsx',
        offset: 10,
        limit: 20,
      },
      result: {
        type: 'tool_result',
        tool_use_id: 'tool-read',
        content: 'Read 20 lines',
        is_error: false,
      },
      toolId: 'tool-read',
    }),
  );
}

describe('ReadToolBlock header accessibility', () => {
  it('exposes the collapsible header as a keyboard-reachable button', () => {
    const html = renderReadToolBlock();

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('labels the collapsible header with an action and file target', () => {
    const html = renderReadToolBlock();

    expect(html).toContain('title="tools.readDetailsToggle: src/components/toolBlocks/ReadToolBlock.tsx"');
    expect(html).toContain('aria-label="tools.readDetailsToggle: src/components/toolBlocks/ReadToolBlock.tsx"');
  });

  it('renders the file target as a semantic open-file button with an action label', () => {
    const html = renderReadToolBlock();

    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain(
      'title="tools.openFile: src/components/toolBlocks/ReadToolBlock.tsx" aria-label="tools.openFile: src/components/toolBlocks/ReadToolBlock.tsx"',
    );
    expect(html).toContain('src/components/toolBlocks/ReadToolBlock.tsx</button>');
  });

  it('mirrors compact line ranges into accessible labels', () => {
    const html = renderReadToolBlock();

    expect(html).toContain('class="tool-title-summary line-info" title="L11-L30" aria-label="L11-L30"');
  });
});

describe('ReadToolBlock action accessibility', () => {
  it('gives the detail open file button a target-specific label and tooltip', () => {
    const html = renderReadToolBlock(true);

    expect(html).toContain(
      '<button type="button" class="btn btn-sm btn-ghost" title="tools.openFile: src/components/toolBlocks/ReadToolBlock.tsx" aria-label="tools.openFile: src/components/toolBlocks/ReadToolBlock.tsx"',
    );
  });

  it('gives the copy path button a target-specific label and tooltip', () => {
    const html = renderReadToolBlock(true);

    expect(html).toContain('title="tools.copyPathForPath: src/components/toolBlocks/ReadToolBlock.tsx"');
    expect(html).toContain('aria-label="tools.copyPathForPath: src/components/toolBlocks/ReadToolBlock.tsx"');
  });
});
