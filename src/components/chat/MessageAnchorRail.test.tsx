import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import MessageAnchorRail, {getVisibleAnchorRailItems} from './MessageAnchorRail';

describe('MessageAnchorRail', () => {
    it('renders anchor summary metadata when provided', () => {
        const html = renderToStaticMarkup(
            <MessageAnchorRail
                hasMessages
                anchors={[
                    { id: 'anchor-1', label: '第一条用户消息', kind: 'text', sequence: 1, total: 3 },
                    { id: 'anchor-2', label: '第二条用户消息', kind: 'mixed', sequence: 2, total: 3 },
                    { id: 'anchor-3', label: '第三条用户消息', kind: 'image', sequence: 3, total: 3 },
                ]}
                activeAnchorId="anchor-2"
                activeAnchorLabel="最近一条用户消息摘要"
                containerRef={{ current: null }}
                messageNodeMap={{ current: new Map() }}
                onScrollToTop={() => {}}
                onScrollToBottom={() => {}}
            />,
        );

        expect(html).toContain('最近一条用户消息摘要');
        expect(html).toContain('3');
        expect(html).toContain('data-anchor-id="anchor-2"');
        expect(html).toContain('2 / 3');
        expect(html).toContain('bg-info/70');
    });

    it('disables controls when no messages are available', () => {
        const html = renderToStaticMarkup(
            <MessageAnchorRail
                hasMessages={false}
                anchors={[]}
                containerRef={{ current: null }}
                messageNodeMap={{ current: new Map() }}
                onScrollToTop={() => {}}
                onScrollToBottom={() => {}}
            />,
        );

        expect(html).toContain('disabled');
    });

    it('samples dense anchor lists while keeping the first, last and active anchor', () => {
        const anchors = Array.from({length: 80}, (_, index) => ({
            id: `anchor-${index + 1}`,
            label: `第 ${index + 1} 条用户消息`,
            kind: index % 2 === 0 ? 'text' as const : 'image' as const,
            sequence: index + 1,
            total: 80,
        }));

        const visible = getVisibleAnchorRailItems(anchors, 'anchor-41');

        expect(visible.length).toBeLessThanOrEqual(48);
        expect(visible[0].id).toBe('anchor-1');
        expect(visible[visible.length - 1].id).toBe('anchor-80');
        expect(visible.some((anchor) => anchor.id === 'anchor-41')).toBe(true);
        expect(visible.find((anchor) => anchor.id === 'anchor-41')).toMatchObject({
            sequence: 41,
            total: 80,
        });
        expect(visible.every((anchor) => anchor.top.endsWith('%'))).toBe(true);
    });

    it('prioritizes non-empty anchors when dense history contains many empty previews', () => {
        const anchors = Array.from({length: 80}, (_, index) => ({
            id: `anchor-${index + 1}`,
            label: index % 10 === 0 ? `有效消息 ${index + 1}` : `空消息 ${index + 1}`,
            kind: index % 10 === 0 ? 'text' as const : 'empty' as const,
            sequence: index + 1,
            total: 80,
        }));

        const visible = getVisibleAnchorRailItems(anchors, null, 12);

        expect(visible.length).toBeLessThanOrEqual(12);
        expect(visible.every((anchor) => anchor.kind !== 'empty')).toBe(true);
        expect(visible.map((anchor) => anchor.id)).toEqual([
            'anchor-1',
            'anchor-11',
            'anchor-21',
            'anchor-31',
            'anchor-41',
            'anchor-51',
            'anchor-61',
            'anchor-71',
        ]);
    });
});
