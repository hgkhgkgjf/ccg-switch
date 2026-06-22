import type {ReactElement, ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import EditToolBlock from './EditToolBlock';
import GenericToolBlock from './GenericToolBlock';
import ReadToolBlock from './ReadToolBlock';

type ReactElementNode = ReactElement<{
  children?: ReactNode;
  className?: string;
  onKeyDown?: (event: {stopPropagation: () => void}) => void;
}>;

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    memo: (component: unknown) => component,
    useRef: (initialValue: unknown) => ({ current: initialValue }),
    useState: (initialValue: unknown) => [
      typeof initialValue === 'function'
        ? (initialValue as () => unknown)()
        : initialValue,
      vi.fn(),
    ],
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

vi.mock('./EditDiffPreview', () => ({
  default: () => null,
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

function expectHeaderFileButtonStopsKeydown(element: ReactElement) {
  const button = findElementByClassName(element, 'file-path-button');
  const stopPropagation = vi.fn();

  button.props.onKeyDown?.({stopPropagation});

  expect(stopPropagation).toHaveBeenCalledTimes(1);
}

describe('Single tool block header open-file keyboard boundaries', () => {
  it('stops keydown propagation from Generic header file buttons before the header can toggle', () => {
    expectHeaderFileButtonStopsKeydown(
      GenericToolBlock({
        name: 'CustomFileTool',
        input: {file_path: 'src/App.tsx'},
        result: null,
        toolId: 'generic-1',
      }) as ReactElement,
    );
  });

  it('stops keydown propagation from Read header file buttons before the header can toggle', () => {
    expectHeaderFileButtonStopsKeydown(
      ReadToolBlock({
        name: 'Read',
        input: {file_path: 'src/App.tsx', offset: 10, limit: 20},
        result: null,
        toolId: 'read-1',
      }) as ReactElement,
    );
  });

  it('stops keydown propagation from Edit header file buttons before the header can toggle', () => {
    expectHeaderFileButtonStopsKeydown(
      EditToolBlock({
        name: 'Edit',
        input: {
          file_path: 'src/App.tsx',
          old_string: 'const value = false;',
          new_string: 'const value = true;',
        },
        result: null,
        toolId: 'edit-1',
      }) as ReactElement,
    );
  });
});
