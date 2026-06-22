import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import BashToolBlock from './BashToolBlock';

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

function renderBashToolBlock(expanded = false, copiedTarget: string | null = null): string {
  mockComponentState(expanded, copiedTarget);
  return renderToStaticMarkup(
    createElement(BashToolBlock, {
      name: 'Bash',
      input: {command: 'npm test', workdir: 'C:/guodevelop/ccg-switch'},
      result: {
        type: 'tool_result',
        tool_use_id: 'tool-bash',
        content: JSON.stringify({exit_code: 0, stdout: 'Tests passed', stderr: ''}),
        is_error: false,
      },
      toolId: 'tool-bash',
    }),
  );
}

describe('BashToolBlock header accessibility', () => {
  it('exposes the collapsible header as a keyboard-reachable button', () => {
    const html = renderBashToolBlock();

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('labels the collapsible header with an action and command target', () => {
    const html = renderBashToolBlock();

    expect(html).toContain('title="tools.bashDetailsToggle: npm test"');
    expect(html).toContain('aria-label="tools.bashDetailsToggle: npm test"');
  });

  it('mirrors compact header summaries into accessible labels', () => {
    const html = renderBashToolBlock();

    expect(html).toContain('class="tool-title-summary bash-command" title="npm test" aria-label="npm test"');
    expect(html).toContain('class="tool-title-secondary-summary" title="Tests passed" aria-label="Tests passed"');
  });
});

describe('BashToolBlock action accessibility', () => {
  it('gives copy command and copy output buttons target-specific labels and tooltips', () => {
    const html = renderBashToolBlock(true);

    expect(html).toContain('title="tools.copyCommandForCommand: npm test"');
    expect(html).toContain('aria-label="tools.copyCommandForCommand: npm test"');
    expect(html).toContain('title="tools.copyOutputForCommand: npm test"');
    expect(html).toContain('aria-label="tools.copyOutputForCommand: npm test"');
  });

  it('only marks the command copy button as copied when the command action was copied', () => {
    const html = renderBashToolBlock(true, 'command');
    const copiedButtons = html.match(/>tools\.copied<\/button>/g) ?? [];

    expect(copiedButtons).toHaveLength(1);
    expect(html).toContain('>tools.copied</button>');
    expect(html).toContain('>tools.copyOutput</button>');
  });
});
