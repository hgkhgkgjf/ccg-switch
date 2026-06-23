# Implementation plan: Chat assistant content block ordering

## Order of work

Two independent commits. Part A first (low risk, immediate user value), then Part B.

---

## Part A — History reload on reopen

### A1. Adjust `loadSession` early-return (`src/stores/useChatStore.ts:1148-1157`)
- Keep skipping reload ONLY when the active session has an in-flight turn
  (`activeRequestId` set) — don't disrupt live streaming.
- Otherwise, let the normal load path run (cache-hit serves disk-ordered complete history; window
  path re-reads the ≤120 tail from disk). Both replace `messages` via `getLoadedSessionState`,
  restoring source order.
- Preserve token ownership + windowed/complete status from
  [[06-22-06-22-chat-history-scroll-window-fix]].

### A2. Tests
- Store test: after a live turn settles on the active session, calling `loadSession(sameSession)`
  rebuilds an order-correct transcript (not the clustered live one).
- Store test: `loadSession` during an active streaming turn does NOT reload (keeps live
  transcript).
- Regression: existing `loadSession` tests (cache hit, window load, token guard) still pass.

### A3. Validate
- `npm test -- src/stores/useChatStore.test.ts`
- `npm run build`

---

## Part B — Live interleave honoring `[BLOCK_RESET]`

### B1. Streaming segment state
- Add per-streaming-message "open text/thinking segment" tracking. Prefer a module-level ref
  keyed by streaming message id (mirrors daemon's `streamingContentRef` model) or a transient
  field on the message. Reset on new turn.

### B2. `[BLOCK_RESET]` handling (`useChatStore.ts:803-805`)
- Stop ignoring it. On `[BLOCK_RESET]`, seal the current open text/thinking segment so the next
  `[CONTENT_DELTA]` starts a NEW text block at the end of `raw.message.content`.

### B3. Rework `appendToStreamingAssistant` (`useChatStore.ts:377-396`)
- Append/extend the trailing OPEN text block in `raw.message.content` in arrival order, instead
  of only growing the flat `content` string.
- Keep `content` flat string updated (concat of text segments) for copy/preview/fallback.

### B4. Rework text-front seeding
- `syncAssistantRawWithStreamingContent` (`useChatStore.ts:347-371`): stop forcing text to the
  front; sync the streamed text into its positioned text block.
- `getAssistantRawMergeSeedBlocks` (`chatMessageFlow.ts:308-323`): remove text-to-front seed;
  keep existing blocks in order.
- `mergeAssistantRaw` (`chatMessageFlow.ts:332-356`): append tool/new blocks in arrival order
  (already does `[...existing, ...next]`); keep dedup via `isTextAlreadyRepresentedInContent` and
  merge-key set.

### B5. Update contract tests
- `useChatStore.test.ts:1854-1868`: change expected interleave from `['text','tool_use']`
  (clustered) to arrival order `['text','tool_use','text']` for a text→tool→text live sequence,
  with two positioned text segments.
- Audit `chatMessageFlow.test.ts` "Chat Message Raw Event Merging" tests (~lines 200-320): keep
  visibility + dedup assertions; update any that hard-code text-first clustering to arrival
  order.
- Add: live `text1→[BLOCK_RESET]→tool1→text2→tool2` produces
  `['text','tool_use','text','tool_use']`.
- Add: dedup still prevents duplicate text when a text raw snapshot repeats streamed content.

### B6. Validate
- `npm test -- src/stores/useChatStore.test.ts src/utils/chatMessageFlow.test.ts src/components/chat/ContentBlockRenderer.test.tsx`
- `npm run build`
- Full suite to catch fallout: `npm test` (expect the 3 known pre-existing StatusPanel diff-hover
  failures unrelated to this task).

---

## Part C — Spec + commit (Phase 3.3 / 3.4)
- Update `state-management.md` "Chat Message Raw Event Merging" contract (arrival-order, BLOCK_RESET sealing).
- Commit Part A and Part B separately. Keep unrelated provider-icon WIP out.

## Review gates
- After Part A: manual check — reopen a clustered session, confirm interleave.
- After Part B: manual check — run a fresh live turn with multiple talk+tool cycles, confirm
  interleave during streaming.

## Rollback points
- Part B revertable independently of Part A.
