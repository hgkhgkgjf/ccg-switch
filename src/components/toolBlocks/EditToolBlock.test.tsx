import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import EditToolBlock from './EditToolBlock';

type NodeFsSubset = {
  readFileSync(path: string | URL, encoding: 'utf8'): string;
};

async function readToolBlocksCss(): Promise<string> {
  const processLike = (globalThis as unknown as {
    process?: { getBuiltinModule?: (specifier: 'node:fs') => NodeFsSubset };
  }).process;
  const fs = processLike?.getBuiltinModule?.('node:fs');
  if (!fs) {
    throw new Error('node:fs builtin module is unavailable in this test environment');
  }
  const { readFileSync } = fs;
  return readFileSync(new URL('../../styles/toolBlocks.css', import.meta.url), 'utf8');
}

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
    t: (
      key: string,
      options?: { file?: string; target?: string; additions?: number; deletions?: number },
    ) => {
      if (key === 'chat.layout.inputStatusEditFileStats' && options?.file) {
        return `Edit stats: ${options.file} · +${options.additions} / -${options.deletions}`;
      }
      return options?.file || options?.target ? `${key}: ${options.file ?? options.target}` : key;
    },
  }),
}));

vi.mock('../../hooks/useIsToolDenied', () => ({
  useIsToolDenied: () => false,
}));

vi.mock('../../stores/useChatStore', () => ({
  useChatStore: (selector: (state: { currentCwd: string }) => unknown) =>
    selector({ currentCwd: 'C:/guodevelop/ccg-switch' }),
}));

vi.mock('../../utils/bridge', () => ({
  copyToClipboard: vi.fn(),
  openFile: vi.fn(),
}));

vi.mock('./EditDiffPreview', () => ({
  default: () => null,
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

function renderEditToolBlock(expanded = false): string {
  mockComponentState(expanded);
  return renderToStaticMarkup(
    createElement(EditToolBlock, {
      name: 'Edit',
      input: {
        file_path: 'src/App.tsx',
        old_string: 'const label = "old";',
        new_string: 'const label = "new";',
      },
      result: {
        type: 'tool_result',
        tool_use_id: 'tool-edit',
        content: 'Edited src/App.tsx',
        is_error: false,
      },
      toolId: 'tool-edit',
    }),
  );
}

describe('EditToolBlock header accessibility', () => {
  it('exposes the collapsible header as a keyboard-reachable button', () => {
    const html = renderEditToolBlock();

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('labels the collapsible header with an action and edit target', () => {
    const html = renderEditToolBlock();

    expect(html).toContain('title="tools.editDetailsToggle: src/App.tsx"');
    expect(html).toContain('aria-label="tools.editDetailsToggle: src/App.tsx"');
  });

  it('renders the file target as a semantic open-file button with an action label', () => {
    const html = renderEditToolBlock();

    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('title="tools.openFile: src/App.tsx" aria-label="tools.openFile: src/App.tsx"');
    expect(html).toContain('<span class="edit-diff-hover-label">src/App.tsx</span>');
  });

  it('mirrors compact edit stats into an accessible target label', () => {
    const html = renderEditToolBlock();

    expect(html).toContain('class="edit-item-stats" title="Edit stats: src/App.tsx · +1 / -1" aria-label="Edit stats: src/App.tsx · +1 / -1"');
    expect(html).toContain('<span class="edit-stat-added" aria-hidden="true">+1</span>');
    expect(html).toContain('<span class="edit-stat-deleted" aria-hidden="true">-1</span>');
  });
});

describe('EditToolBlock hover preview styling', () => {
  it('does not weaken title summary descendants with parent opacity', async () => {
    const toolBlocksCss = await readToolBlocksCss();
    const opacityRules: string[] = [];

    for (const match of toolBlocksCss.matchAll(/([^{}]*\.tool-title-summary[^{}]*)\{([^{}]*)\}/g)) {
      const selector = match[1]?.trim();
      const body = match[2] ?? '';
      if (selector && /\bopacity\s*:/.test(body)) {
        opacityRules.push(selector);
      }
    }

    expect(opacityRules).toEqual([]);
  });
});

describe('EditToolBlock action accessibility', () => {
  it('gives the detail open file button a target-specific label and tooltip', () => {
    const html = renderEditToolBlock(true);

    expect(html).toContain(
      '<button type="button" class="btn btn-sm btn-ghost" title="tools.openFile: src/App.tsx" aria-label="tools.openFile: src/App.tsx"',
    );
  });

  it('gives copy path a target-specific label and tooltip', () => {
    const html = renderEditToolBlock(true);

    expect(html).toContain('title="tools.copyPathForPath: src/App.tsx"');
    expect(html).toContain('aria-label="tools.copyPathForPath: src/App.tsx"');
  });
});
