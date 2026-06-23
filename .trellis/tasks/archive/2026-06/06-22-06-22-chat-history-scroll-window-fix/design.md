# Design: Chat history scroll-load full-history bridge

## Corrected Root Cause

**The earlier "early-termination in `getRecentRenderableMessages`" theory was WRONG.**
That loop uses `continue`, not `break`, so it already traverses the full array and
computes `hiddenRenderableCount` correctly. Rewriting it fixes nothing.

**Actual root cause (data layer, not render layer):**

1. `useChatStore.loadSession()` only loads the last `SESSION_HISTORY_FIRST_PAINT_LIMIT = 120`
   messages for large histories via `get_unified_session_message_window`, marking
   `lastSessionLoadMetrics.status = 'windowed'` when `complete === false`
   (`useChatStore.ts:1198-1235`).
2. The store `messages` array therefore holds at most ~120 messages during normal browsing.
3. `MessageList` reveal (`getManualRevealWindow` / `shouldAutoRevealEarlierMessages`) can only
   reveal *within* that in-memory window. Once all in-window earlier messages are revealed,
   `collapsedCount` hits 0 and scroll-load stops.
4. But messages 121+ still exist on disk and were **never fetched** during browsing. The only
   existing full-history fetch path is search (`shouldRequestFullHistoryForSearch` →
   `loadActiveSessionFullHistory`, `ChatPage.tsx:481-528`).

This is the truncation the user sees: "明明上面还有，但滚不动了".

## Constraint: existing "Large History First-Paint Contract"

`state-management.md` says normal browsing must NOT auto-hydrate the full transcript on first
paint, because full reads move thousands of records through backend/IPC/mapping. Full reads must
be tied to an **explicit full-history intent**.

**Key reconciliation:** scrolling to the *top of the loaded window* is an explicit user gesture,
exactly like entering a search query. It is NOT first-paint auto-hydration. So loading the full
history at that boundary is allowed by the contract, as long as:
- It is triggered by reaching the window top, not on session click.
- It reuses the same `loadActiveSessionFullHistory()` ownership/token boundary.

## Approach (chosen: 触底自动加载完整历史)

When reveal reaches the top of the in-memory window AND `status === 'windowed'` (more history
exists on disk), trigger a full-history load. After it resolves, the store `messages` array is
replaced by the complete transcript, and the existing reveal mechanism continues paging within
the now-complete list.

### Store change (`useChatStore.ts`)

`loadActiveSessionFullHistory()` currently caches the full history and updates metrics but does
**NOT** replace the visible `messages` array (it only `return`s the mapped history;
`useChatStore.ts:1262-1361`). For browse-mode expansion we need the visible transcript to grow.

Add a new action `expandActiveSessionHistory()` (or extend the existing one with a `mode` flag):
- No-op if `status !== 'windowed'` or no active session, or if a load is already in flight.
- Reuse the loadToken / `isActiveSessionLoadCurrent` ownership guard.
- On success: `rememberSessionHistory`, set `messages` to the full mapped history, and set
  metrics `status = 'complete'`.
- On failure: keep current windowed transcript, set `error`, keep `status = 'windowed'` so the
  user can retry.
- Must respect the session-load token so a late expansion cannot overwrite a transcript after the
  user sent a new prompt or switched sessions (same boundary as `loadActiveSessionFullHistory`).

Keep `loadActiveSessionFullHistory()` (search path) returning the mapped array without mutating
`messages`, OR unify them carefully — decide during implementation, but do not regress the search
contract (search must still work on `windowed` sessions without permanently hydrating browse
state unless the user actually scrolled to top).

### Page change (`ChatPage.tsx`)

- Derive `hasEarlierServerHistory = !isSearchingTranscript && lastSessionLoadMetrics?.status === 'windowed'`.
- Pass to `MessageList`:
  - `hasEarlierServerHistory: boolean`
  - `isLoadingEarlierServerHistory: boolean` (from `lastSessionLoadMetrics.status === 'loading'`)
  - `onLoadEarlierServerHistory: () => void` → calls `expandActiveSessionHistory()`
- Preserve scroll anchoring: the messages array grows by prepending older messages. `MessageList`
  already anchors prepends via `getScrollTopAfterPrepend` keyed on `visibleMessages.length`; verify
  it also fires when `messages` grows from the store (not just from local reveal).

### MessageList change (`MessageList.tsx`)

- Accept the three new props.
- In `shouldAutoRevealEarlierMessages` / `handleAutoRevealScroll`: when in-window `collapsedCount`
  reaches 0 but `hasEarlierServerHistory` is true and not already loading, call
  `onLoadEarlierServerHistory()` instead of stopping.
- The top "load earlier messages" button must also remain available when
  `hasEarlierServerHistory` is true even if in-window `collapsedCount === 0`, so there is an
  explicit fallback.
- Guard against repeated triggers while the server load is pending (reuse `revealPendingRef`
  pattern or a new pending flag tied to `isLoadingEarlierServerHistory`).

## Compatibility / Rollback

- No backend command changes; reuses `get_unified_session_messages`.
- If the new action misbehaves, revert to current behavior by not wiring the props (button-only
  fallback). The store action is additive.

## Tests Required

- Store test: `expandActiveSessionHistory()` on a `windowed` session calls
  `get_unified_session_messages`, replaces `messages` with the full transcript, sets
  `status = 'complete'`, and caches the history.
- Store test: a late expansion result is dropped after the load token advances (new prompt /
  session switch).
- Store test: expansion failure keeps the windowed transcript and records `error`.
- MessageList test: when `hasEarlierServerHistory` is true and in-window collapsed messages are
  exhausted, scrolling to top calls `onLoadEarlierServerHistory`.
- MessageList test: the explicit top button is shown when `hasEarlierServerHistory` is true even
  if in-window `collapsedCount === 0`.
- Build + existing `MessageList.test.tsx`, `useChatStore.test.ts`, `chatUiBehavior.test.ts` pass.

## Spec correction owed (Phase 3.3)

The committed `state-management.md` "Chat Transcript Window Calculation Contract" section
(commit 105c7b8) is based on the wrong early-termination theory. During Phase 3.3 it must be
corrected to describe the real first-paint-window vs scroll-load-bridge contract, or removed.
