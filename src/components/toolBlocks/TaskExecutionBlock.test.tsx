import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import TaskExecutionBlock from './TaskExecutionBlock';

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

function renderTaskExecutionBlock(): string {
  return renderToStaticMarkup(
    createElement(TaskExecutionBlock, {
      name: 'Task',
      input: {
        description: 'Investigate chat rendering',
        prompt: 'Check message flow and summarize the issue.',
        agent_id: 'agent-123',
        model: 'sonnet',
      },
      result: {
        type: 'tool_result',
        tool_use_id: 'tool-task',
        content: 'Completed investigation.',
      },
      toolId: 'tool-task',
    }),
  );
}

describe('TaskExecutionBlock header accessibility', () => {
  it('exposes the collapsible header as a keyboard-reachable button', () => {
    const html = renderTaskExecutionBlock();

    expect(html).toContain('class="task-header" role="button" tabindex="0" aria-expanded="false"');
  });

  it('exposes a stable toggle action label with the task target', () => {
    const html = renderTaskExecutionBlock();

    expect(html).toContain('title="tools.taskDetailsToggle: Investigate chat rendering"');
    expect(html).toContain('aria-label="tools.taskDetailsToggle: Investigate chat rendering"');
  });

  it('mirrors compact header summaries into accessible labels', () => {
    const html = renderTaskExecutionBlock();

    expect(html).toContain('class="tool-title-summary task-summary-text" title="Investigate chat rendering" aria-label="Investigate chat rendering"');
    expect(html).toContain('class="tool-title-secondary-summary" title="Completed investigation." aria-label="Completed investigation."');
    expect(html).toContain('class="tool-title-summary tool-title-runtime-summary" title="sonnet · agent-12…" aria-label="sonnet · agent-12…"');
  });
});
