# Fix chat reveal pagination regression

## Goal

Fix the regression where manual "load earlier messages" can reveal only the first page of older chat history and then gets stuck when the remaining hidden count is less than the reveal page size.

## Requirements

- Preserve the previous fix that disables scroll-top auto reveal.
- Manual "load earlier messages" must continue advancing until all collapsed earlier messages are visible.
- Do not mix up "total revealable earlier messages" with "currently remaining hidden messages" when computing reveal state.
- Cover the 46-collapsed-messages scenario: first click reveals 30, second click reveals the remaining 16.
- Capture the prevention rule in frontend Trellis specs so future reveal/window code distinguishes total count from remaining count.

## Acceptance Criteria

- [x] A test proves `getNextRevealState()` continues from 30 to 46 when the total revealable count is 46.
- [x] `MessageList` uses the stable total revealable count for reveal-state advancement and the remaining hidden count only for UI copy.
- [x] The top collapsed-history control still requires an explicit click; scrolling to top does not auto-load older history.
- [x] Frontend spec/guideline mentions total-vs-remaining count separation for transcript reveal/windowing.
- [x] `npm test -- src/components/chat/MessageList.test.tsx src/utils/chatUiBehavior.test.ts` passes.
- [x] `npm run build` passes.

## Notes

- Root cause: the previous manual reveal fix passed `renderableWindow.hiddenRenderableCount` (remaining hidden count) into `getNextRevealState()`, whose contract expects total revealable earlier messages.
- Lightweight PRD-only regression fix.
