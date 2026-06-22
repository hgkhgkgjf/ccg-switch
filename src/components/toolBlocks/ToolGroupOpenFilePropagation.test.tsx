import type {ReactElement, ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import ReadToolGroupBlock from './ReadToolGroupBlock';
import SearchToolGroupBlock from './SearchToolGroupBlock';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';

type ReactElementNode = ReactElement<{children?: ReactNode; className?: string; onKeyDown?: (event: {stopPropagation: () => void}) => void}>;

const mockReactState = vi.hoisted(() => ({
  values: [] as unknown[],
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    memo: (component: unknown) => component,
    useMemo: (factory: () => unknown) => factory(),
    useState: (initialValue: unknown) => {
      const value = mockReactState.values.length > 0
        ? mockReactState.values.shift()
        : typeof initialValue === 'function'
        ? (initialValue as () => unknown)()
        : initialValue;

      return [
        value,
        vi.fn(),
      ];
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: {count?: number}) =>
      typeof options?.count === 'number' ? `${key}:${options.count}` : key,
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

function renderReadGroupElement(): ReactElement {
  const blocks: ToolUseBlock[] = [
    {
      type: 'tool_use',
      id: 'read-1',
      name: 'Read',
      input: {file_path: 'src/App.tsx', offset: 10, limit: 20},
    },
  ];

  return ReadToolGroupBlock({
    blocks,
    findToolResult: () => null,
  }) as ReactElement;
}

function renderSearchGroupElement(): ReactElement {
  const blocks: ToolUseBlock[] = [
    {
      type: 'tool_use',
      id: 'search-1',
      name: 'Grep',
      input: {pattern: 'useState', path: 'src'},
    },
  ];
  const result: ToolResultBlock = {
    type: 'tool_result',
    tool_use_id: 'search-1',
    content: 'src/App.tsx:12:const [value, setValue] = useState(false);',
    is_error: false,
  };

  return SearchToolGroupBlock({
    blocks,
    findToolResult: () => result,
  }) as ReactElement;
}

function withMockedUseStateValues<T>(values: unknown[], callback: () => T): T {
  mockReactState.values = [...values];
  try {
    return callback();
  } finally {
    mockReactState.values = [];
  }
}

describe('Tool group nested open-file keyboard boundaries', () => {
  it('stops keydown propagation from Read group file buttons before row handlers can toggle', () => {
    const button = findElementByClassName(renderReadGroupElement(), 'file-path-button');
    const stopPropagation = vi.fn();

    button.props.onKeyDown?.({stopPropagation});

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('stops keydown propagation from Search group header file buttons before row handlers can toggle', () => {
    const button = findElementByClassName(renderSearchGroupElement(), 'search-file-link');
    const stopPropagation = vi.fn();

    button.props.onKeyDown?.({stopPropagation});

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('stops keydown propagation from expanded Search result file rows before row handlers can toggle', () => {
    const element = withMockedUseStateValues([true, new Set([0])], renderSearchGroupElement);
    const button = findElementByClassName(element, 'search-result-file-row');
    const stopPropagation = vi.fn();

    button.props.onKeyDown?.({stopPropagation});

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});
