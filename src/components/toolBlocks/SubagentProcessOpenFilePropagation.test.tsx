import type {ReactElement, ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {SubagentProcessSummary} from './SubagentHistoryPanel';
import {buildSubagentProcessModel} from './subagentHistoryUtils';

type ReactElementNode = ReactElement<{
  children?: ReactNode;
  className?: string;
  onKeyDown?: (event: {stopPropagation: () => void}) => void;
}>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: {count?: number; file?: string}) => {
      if (options?.file) return `${key}: ${options.file}`;
      if (typeof options?.count === 'number') return `${key}: ${options.count}`;
      return key;
    },
  }),
}));

vi.mock('../../utils/bridge', () => ({
  openFile: vi.fn(),
}));

function findElementByClassName(node: ReactNode, className: string): ReactElementNode {
  if (!node || typeof node !== 'object') {
    throw new Error(`Element with class ${className} not found`);
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      try {
        return findElementByClassName(child, className);
      } catch {
        // Continue searching siblings.
      }
    }
    throw new Error(`Element with class ${className} not found`);
  }

  const element = node as ReactElementNode;
  if (typeof element.props?.className === 'string' && element.props.className.includes(className)) {
    return element;
  }

  return findElementByClassName(element.props?.children, className);
}

function createProcessWithReadAndSearchTargets() {
  return buildSubagentProcessModel([
    {
      id: 'm1',
      role: 'assistant',
      content: 'Read files and search results.',
      raw: {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-read-1',
              name: 'Read',
              input: {
                file_path: 'C:/guodevelop/ccg-switch/src/components/chat/MessageList.tsx',
                start_line: 24,
                end_line: 48,
              },
            },
            {
              type: 'tool_use',
              id: 'tool-grep-1',
              name: 'Grep',
              input: {
                pattern: 'subagentHistory',
              },
            },
            {
              type: 'tool_result',
              tool_use_id: 'tool-grep-1',
              content: [
                'src/components/toolBlocks/SubagentHistoryPanel.tsx:146: subagentHistory',
                'src/components/toolBlocks/subagentHistoryUtils.ts:432: subagentHistory',
              ].join('\n'),
              is_error: false,
            },
          ],
        },
      },
      createdAt: 1,
    },
  ]);
}

describe('Subagent process open-file keyboard boundaries', () => {
  it('stops keydown propagation from read file chips and tool row targets', () => {
    const process = createProcessWithReadAndSearchTargets();
    const element = SubagentProcessSummary({
      agentId: 'agent-42',
      requestSessionId: 'session-42',
      currentCwd: 'C:/guodevelop/ccg-switch',
      process,
    }) as ReactElement;
    const readFileButton = findElementByClassName(element, 'subagent-file-chip');
    const toolTargetButton = findElementByClassName(element, 'subagent-tool-row-target');
    const readStopPropagation = vi.fn();
    const toolStopPropagation = vi.fn();

    readFileButton.props.onKeyDown?.({stopPropagation: readStopPropagation});
    toolTargetButton.props.onKeyDown?.({stopPropagation: toolStopPropagation});

    expect(readStopPropagation).toHaveBeenCalledTimes(1);
    expect(toolStopPropagation).toHaveBeenCalledTimes(1);
  });
});
