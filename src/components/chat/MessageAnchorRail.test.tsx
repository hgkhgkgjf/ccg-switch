import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import MessageAnchorRail from './MessageAnchorRail';

describe('MessageAnchorRail', () => {
    it('renders anchor summary metadata when provided', () => {
        const html = renderToStaticMarkup(
            <MessageAnchorRail
                hasMessages
                anchorCount={3}
                activeAnchorLabel="最近一条用户消息摘要"
                onScrollToTop={() => {}}
                onScrollToBottom={() => {}}
            />,
        );

        expect(html).toContain('最近一条用户消息摘要');
        expect(html).toContain('3');
    });

    it('disables controls when no messages are available', () => {
        const html = renderToStaticMarkup(
            <MessageAnchorRail
                hasMessages={false}
                anchorCount={0}
                onScrollToTop={() => {}}
                onScrollToBottom={() => {}}
            />,
        );

        expect(html).toContain('disabled');
    });
});
