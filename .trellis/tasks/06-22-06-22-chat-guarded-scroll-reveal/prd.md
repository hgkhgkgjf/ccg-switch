# Restore guarded chat top-scroll auto reveal

## Goal

Restore top-scroll automatic reveal for collapsed earlier chat messages with guards against repeated loading and completed-window retriggers.

## User Value

Users can keep the natural "scroll up to see more history" flow while still having a stable top-of-list state after all earlier messages are loaded.

## Confirmed Facts

- The earlier explicit-click fix stopped the short-context bug where touching the top repeatedly triggered loading and made the scrollbar unable to settle at the top.
- Removing top-scroll auto reveal reduced the expected chat history browsing experience.
- The reveal pagination regression has already been addressed by separating remaining hidden count from already revealed count.
- The restored auto reveal must build on that corrected total-window calculation instead of reusing the old remaining-count-as-total behavior.

## Requirements

- Restore automatic reveal when the chat scroll container reaches or approaches the top while earlier messages remain collapsed.
- Keep the explicit "load earlier messages" button as an accessible fallback and visible state indicator.
- Prevent repeated auto-trigger loops while a reveal is already pending or the previous reveal has not produced a new stable scroll position.
- Stop triggering auto reveal once all collapsed earlier messages have been revealed, so the scrollbar can reach and remain at the true top.
- Preserve scroll anchoring after prepending newly revealed messages to avoid sudden viewport jumps.
- Keep the implementation scoped to frontend chat message rendering behavior and related tests.

## Acceptance Criteria

- [x] A chat with more than one reveal page can auto-reveal multiple pages, including a `46 -> 30 -> 16 -> 0` case.
- [x] When no collapsed earlier messages remain, scrolling to the top does not trigger another reveal.
- [x] A reveal already in progress cannot be retriggered by additional scroll events.
- [x] Clicking the explicit collapsed-history button still reveals the next page.
- [x] Existing search rendering behavior remains unchanged.
- [x] Relevant frontend tests and production build pass.

## Out of Scope

- Backend history loading changes.
- Changing the reveal page size.
- Reworking search-mode collapse behavior.
- Modifying unrelated dashboard or status panel behavior.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.

## Verification

- `npm test -- src/utils/chatUiBehavior.test.ts src/components/chat/MessageList.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` passed with 5 files and 68 tests.
- `npm run build` passed.
- IDE `build_project` passed with no problems.
- `git diff --check` passed with only Windows LF/CRLF conversion warnings.
