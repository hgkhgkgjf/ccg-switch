# Design: Chat assistant content block ordering

## Root cause (verified across layers)

Three contributing layers, all frontend:

1. **`loadSession` early-return** (`useChatStore.ts:1148-1157`): reopening the just-ran current
   session returns early, leaving live (clustered) messages on screen instead of disk-ordered
   history.
2. **Flat text accumulation** (`useChatStore.ts:377-396` `appendToStreamingAssistant`): every
   `[CONTENT_DELTA]` for a whole turn is concatenated into ONE `content` string.
3. **Discarded boundary signal** (`useChatStore.ts:803-805`): the daemon emits `[BLOCK_RESET]`
   at every `message_start` (each tool-use loop iteration; `stream-event-processor.js:41-54`),
   but the store ignores it. Combined with `syncAssistantRawWithStreamingContent` (347-371) and
   `mergeAssistantRaw` (`chatMessageFlow.ts:332-356`) seeding text to the FRONT, an interleaved
   turn `text1→tool1→text2→tool2` collapses into `[text1+text2 (clustered), tool1, tool2]`.

Backend + history mapping are clean (verified): Rust stores raw JSONL verbatim in source order;
`mapHistoryMessages` is 1:1; `groupToolBlocks` is order-preserving.

## Daemon protocol (ground truth for the live fix)

- Text → `[CONTENT_DELTA]` lines on `chat://stream`.
- Thinking → `[THINKING_DELTA]`.
- Tool calls → `chat://message` event carrying `raw.message.content` with `tool_use` blocks
  (emitted ONLY when the snapshot has tool_use; `shouldOutputMessage` line 167-169).
- Each turn/tool-loop iteration boundary → `[BLOCK_RESET]` line on `chat://stream`, emitted
  BEFORE that iteration's deltas.

So the true interleave order is recoverable live: text deltas between two `[BLOCK_RESET]` (or
between a reset and a tool message) form one text segment positioned where it arrived relative to
tool messages.

## Approach (both fixes, per user decision)

### Part A — History reload (low risk)

`loadSession` (`useChatStore.ts:1148-1157`): the early-return is an optimization to avoid
reloading the already-active session. Change so that when the active session was left in a
live/merged state, it still rebuilds an order-correct transcript.

- Safest scoped change: only skip the reload when we already hold an order-correct transcript for
  that session (e.g. a cached complete history or a fresh disk load), NOT when the current
  `messages` came from live merging. Practically: drop the early-return and let the normal
  cache-hit / window-load path run (it already replaces `messages` via `getLoadedSessionState`).
  The cache-hit path serves disk-ordered history; the window path re-reads from disk. Both are
  order-correct.
- Must preserve the `06-22-06-22-chat-history-scroll-window-fix` contracts: token ownership
  (`latestSessionLoadToken` / `isActiveSessionLoadCurrent`), windowed-vs-complete status, and not
  hydrating full history on normal browse. Reloading the window (≤120 tail) is fine and cheap.
- Edge: if the active session has an in-flight `activeRequestId` (still streaming), do NOT
  reload — keep the live transcript. Only reload settled sessions.

### Part B — Live interleave (honor `[BLOCK_RESET]`)

Change the streaming model so `raw.message.content` is the ordered source of truth, built in
arrival order:

1. On `[CONTENT_DELTA]`: extend the CURRENT trailing text segment in the streaming assistant's
   `raw.message.content`. If the last block is not an "open" text segment (because a
   `[BLOCK_RESET]` or a tool message sealed it), start a NEW text block appended at the end.
2. On `[BLOCK_RESET]`: seal the current text/thinking segment so the next delta starts a new
   block. (Track an "open segment" flag per streaming message, e.g. a module-level ref keyed by
   the streaming message id, mirroring how daemon comment describes `streamingContentRef`.)
3. On `chat://message` with tool_use: append tool_use block(s) at the END of
   `raw.message.content` in arrival order (current `mergeAssistantRaw` minus the text-front
   seeding). This naturally positions tools after the text that preceded them and before later
   text.
4. Keep `message.content` (flat string) as the concatenation of all text segments for copy/
   preview and as the no-raw fallback, but it is NO LONGER the rendering order source — rendering
   already uses `raw.message.content` via `MessageItem`/`ContentBlockRenderer`.
5. Remove the text-to-front seeding in `getAssistantRawMergeSeedBlocks` and
   `syncAssistantRawWithStreamingContent`; preserve their dedup behavior
   (`isTextAlreadyRepresentedInContent`) so the same text isn't duplicated.

**Visibility contract preserved**: streamed text remains a real text block in `raw`, so the
existing "streamed text not hidden by tool block" tests still hold — but the asserted ORDER
changes from "always text-first" to "arrival order".

**Test that must change**: `useChatStore.test.ts:1854-1868` currently asserts
`['text','tool_use']` with all text in one front block. Under the fix, a `text→tool→text` arrival
must assert `['text','tool_use','text']` (two text segments around the tool). Update it to encode
the corrected interleave contract. Audit the ~10 "Chat Message Raw Event Merging" tests in
`chatMessageFlow.test.ts` similarly — keep dedup/visibility assertions, update any that hard-code
text-first clustering.

## Data flow

```
chat://stream [BLOCK_RESET]      → seal open text segment
chat://stream [CONTENT_DELTA] x  → extend or open trailing text block in raw.content (+ flat content)
chat://message {tool_use}        → append tool_use block(s) to raw.content (no text reseat)
chat://stream [CONTENT_DELTA] y  → new text block after the tool (segment was sealed by reset/tool)
```

Result `raw.message.content`: `[text(x), tool_use, text(y)]` — true interleave.

## Tradeoffs / risks

- Part B touches the core streaming accumulator + a documented contract + ~10 tests. Mitigation:
  keep `content` flat-string semantics unchanged (only its role as render-order source is
  dropped), and drive all new behavior through `raw.message.content`. Extensive unit + store
  tests.
- If a provider/daemon does NOT emit `[BLOCK_RESET]` between text and a tool (older bridge), the
  fix degrades gracefully: a tool message still seals the open text segment (step 3 appends after
  current text), so subsequent text starts a new block. So interleave works even without explicit
  resets, as long as tool messages arrive between text runs.
- Codex provider: confirm its event handler also flows tool blocks through `chat://message` and
  text through deltas (it emits per response_item). The arrival-order model is provider-agnostic
  because it only depends on event arrival sequence.

## Rollback

- Part A and Part B are independent commits. If Part B regresses streaming, revert it alone; Part
  A still fixes every reopened session.

## Spec updates owed (Phase 3.3)

`state-management.md` "Chat Message Raw Event Merging": change the contract from "assistant raw
seeds text first" to "assistant raw preserves arrival/source order; `[BLOCK_RESET]` seals text
segments; tool messages append in arrival order". Update the Wrong/Correct example.
