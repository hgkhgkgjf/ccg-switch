# Fix chat top-scroll reveal

## Goal

Prevent the chat transcript from loading older collapsed messages automatically when the scroll position reaches the top. Users should be able to scroll to the true top of the currently visible transcript window without the view immediately expanding older history and pushing the scrollbar back down.

## Requirements

- Disable scroll-top auto reveal for collapsed earlier messages in the chat message list.
- Keep a deliberate, keyboard-accessible control for loading earlier collapsed messages.
- Preserve the current scroll position after earlier messages are loaded manually, reusing the existing prepend scroll anchoring behavior.
- Update visible/i18n copy so it no longer tells users that scrolling to the top loads more messages.
- Keep search mode behavior unchanged: searching should still render the full searchable result window and should not use normal reveal behavior.

## Acceptance Criteria

- [x] Scrolling to the top of the chat transcript does not automatically reveal older collapsed messages.
- [x] When older messages are collapsed, the top notice renders as an actionable button to load earlier messages.
- [x] Activating the button reveals the next page of earlier messages and preserves the user's viewport position.
- [x] English and Chinese copy describe the explicit click action, not scroll-triggered loading.
- [x] `npm test -- src/components/chat/MessageList.test.tsx src/utils/chatUiBehavior.test.ts` passes.
- [x] `npm run build` passes.

## Notes

- Lightweight PRD-only task. Existing evidence points to `MessageList` scroll listener and `shouldAutoRevealEarlierMessages()` as the source of the unwanted auto-load behavior.
