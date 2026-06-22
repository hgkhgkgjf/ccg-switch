import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import AgentGroupBlock from './AgentGroupBlock';

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

vi.mock('./SubagentHistoryPanel', () => ({
  default: () => createElement('span', {className: 'subagent-history-panel-test'}),
}));

function renderAgentGroupBlock(): string {
  return renderToStaticMarkup(
    createElement(AgentGroupBlock, {
      name: 'Agent',
      input: {
        description: 'Review frontend accessibility',
        prompt: 'Inspect tool block keyboard behavior.',
        agent_id: 'agent-review',
        model: 'sonnet',
      },
      result: {
        type: 'tool_result',
        tool_use_id: 'tool-agent',
        content: 'Completed accessibility review.',
      },
      toolId: 'tool-agent',
    }),
  );
}

describe('AgentGroupBlock header accessibility', () => {
  it('exposes the collapsible header as a keyboard-reachable button', () => {
    const html = renderAgentGroupBlock();

    expect(html).toContain('class="task-header" role="button" tabindex="0" aria-expanded="false"');
  });

  it('exposes a stable toggle action label with the agent target', () => {
    const html = renderAgentGroupBlock();

    expect(html).toContain('title="tools.agentDetailsToggle: Review frontend accessibility"');
    expect(html).toContain('aria-label="tools.agentDetailsToggle: Review frontend accessibility"');
  });

  it('mirrors compact header summaries into accessible labels', () => {
    const html = renderAgentGroupBlock();

    expect(html).toContain('class="tool-title-summary task-summary-text" title="Review frontend accessibility" aria-label="Review frontend accessibility"');
    expect(html).toContain('class="tool-title-secondary-summary" title="Completed accessibility review." aria-label="Completed accessibility review."');
    expect(html).toContain('class="tool-title-summary tool-title-runtime-summary" title="sonnet · agent-re…" aria-label="sonnet · agent-re…"');
  });
});
