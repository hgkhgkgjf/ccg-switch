# State Management

> How state is managed in this project.

---

## Overview

- **Global/shared state: Zustand 5** (`src/stores/`, one store per domain).
- **Local UI state: React `useState`/`useMemo`/`useRef`** inside the component
  that owns it (filters, view mode, which modal is open, drag state).
- **Server state**: there is no dedicated server-state library. The Rust backend
  is the source of truth; stores call Tauri `invoke`, hold the result in memory,
  and re-fetch after mutations.
- **URL/route state**: `react-router-dom` 7 with `createHashRouter` (HashRouter,
  required for the Tauri file:// context). Navigation is via hash, e.g.
  `window.location.hash = '/settings?tab=about'`.

---

## Zustand Store Pattern

Stores are created with `create<State>((set, get) => ({ ... }))` and exported as
`useXStore`. State fields and the actions that mutate them live in the **same**
interface and object.

```ts
interface ProviderState {
    providers: Provider[];
    hasLoaded: boolean;
    loading: boolean;
    error: string | null;

    loadAllProviders: (force?: boolean) => Promise<void>;
    addProvider: (data: Omit<Provider, 'id' | 'createdAt' | 'isActive'>) => Promise<void>;
    deleteProvider: (id: string) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
    providers: [],
    hasLoaded: false,
    loading: false,
    error: null,

    loadAllProviders: async (force = false) => {
        if (!force && get().hasLoaded) return;          // cache guard
        set({ loading: true, error: null });
        try {
            const providers = await invoke<Provider[]>('get_all_providers');
            set({ providers, loading: false, hasLoaded: true });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },
    // ...
}));
```

Conventions seen across stores (`useProviderStore`, `useConfigStore`,
`useAboutStore`, etc.):

- **Standard async-state triad**: `loading: boolean`, `error: string | null`,
  and a `hasLoaded` flag used to skip redundant loads (`if (!force && get().hasLoaded) return;`).
- **Async actions** set `loading: true, error: null` first, then `set(...)` on
  success, and on failure `set({ error: String(error), loading: false })`.
- **Errors are normalized with `String(error)`** and stored, not thrown — except
  in mutations (`add`/`update`/`switch`/`delete`) which **re-throw after setting
  state** so the calling page can `try/catch` and show a toast.
- **Mutations re-fetch instead of patching local arrays**: after
  `invoke('add_provider', ...)` the action calls `get().loadAllProviders(true)`
  to refresh from the backend (backend is source of truth).
- Use `get()` to read current state inside actions; use `set(...)` (object form,
  or functional form for derived updates) to write.
- ID/timestamp generation for new records happens in the store before invoke:
  `id: provider-${Date.now()}`, `createdAt: new Date().toISOString()`.

Stores can also own **event listeners and warmup** — e.g. `useAboutStore` exposes
`initEventListeners()` / `fetchToolVersions()` that `App.tsx` calls during idle
warmup.

---

## State Categories — where things live

| State | Where | Example |
|-------|-------|---------|
| Shared domain data fetched from backend | Zustand store | `providers`, `config`, tokens, usage |
| Page UI state (filters, view mode, open modal, search) | `useState` in the page | `ProvidersPage` `viewMode`, `searchQuery`, `deleteModal` |
| Derived/computed lists | `useMemo` in the component | `filteredProviders`, `allTags` |
| Transient async status for a view | custom hook | `useHealthCheck` statuses |
| Imperative drag tracking | `useRef` + `useState` | `ProvidersPage` `dragSourceRef` |
| Route | HashRouter | `App.tsx` `createHashRouter` |
| **Event-driven request (Tauri push)** | **Zustand store** | **`pendingAskUserQuestion` / `pendingToolPermission` (权限审批)** |

### Event-Driven State Pattern (Tauri → Frontend)

When the backend pushes events to the frontend (via `app.emit()`), store the
pending request in a Zustand store and conditionally render a modal/dialog:

```ts
interface ChatState {
    pendingAskUserQuestion: AskUserQuestionRequest | null;
    answerAskUserQuestion: (requestId: string, answers: Record<string, string>) => Promise<void>;
}

// In init():
const askUserUn = await listen<AskUserQuestionRequest>('permission://ask-user-question', (event) => {
    set({ pendingAskUserQuestion: event.payload });
});

// In action:
answerAskUserQuestion: async (requestId, answers) => {
    await invoke('permission_respond_ask_user_question', { requestId, answers });
    set({ pendingAskUserQuestion: null }); // Clear after response
}
```

**In the page**:
```tsx
{pendingAskUserQuestion && (
    <AskUserQuestionDialog
        request={pendingAskUserQuestion}
        onAnswer={(answers) => answerAskUserQuestion(pendingAskUserQuestion.requestId, answers)}
    />
)}
```

This pattern keeps event-driven modals decoupled from page state—any page can
show the dialog when the backend pushes the event.

### Permission Event Variants

Chat permissions have three event families and each must own an explicit pending
field plus a response action in `useChatStore`:

| Event | Pending state | Response action | Invoke command |
|-------|---------------|-----------------|----------------|
| `permission://tool` | `pendingToolPermission` | `answerToolPermission(requestId, allow)` | `permission_respond_tool` |
| `permission://ask-user-question` | `pendingAskUserQuestion` | `answerAskUserQuestion(requestId, answers)` | `permission_respond_ask_user_question` |
| `permission://plan-approval` | `pendingPlanApproval` | `approvePlan(requestId, approved, targetMode)` | `permission_respond_plan_approval` |

Each permission request payload may carry `sessionId`. Store it on the pending
request object and pass it back in the corresponding Tauri invoke payload:
`{ requestId, sessionId, ...decision }`. The daemon response filename uses
`sessionId`; losing it writes the response to `*-default-*` even when the
request file was `*-<custom-session>-*`. For backward compatibility with older
events or tests that lack the field, response actions must fall back to
`"default"`.

Do not treat generic tool permission as a visual-only tool block state. The
daemon is waiting on a filesystem response file; if the store does not listen
to `permission://tool` and call `permission_respond_tool`, tools such as
`Bash`, `Edit`, `Write`, or MCP calls can remain pending until the bridge
timeout and the chat appears frozen.

Same-family permission events must be queued FIFO instead of overwriting the
single visible `pendingXxx` field. `PermissionWatcher` can emit multiple
request files from one poll after deleting those files from disk; if the store
keeps only the last event, the earlier daemon request no longer has a frontend
entry point and waits until timeout. Keep `pendingAskUserQuestion`,
`pendingToolPermission`, and `pendingPlanApproval` as the visible head of their
own queue. When a response action starts, clear the visible pending request and
record the in-flight `requestId` so duplicate events for that same request are
ignored while other same-family events are appended behind it. After the invoke
succeeds, promote the next queued request. If the invoke fails, restore a fresh
object for the failed request at the head and keep the rest of the queue intact.

`AskUserQuestion` responses must be idempotent by `requestId`. Clear
`pendingAskUserQuestion` before awaiting `permission_respond_ask_user_question`
so a double cancel, overlay click, or duplicate callback cannot write two
response files. The invoke payload must include `sessionId` from the pending
request, or `"default"` for legacy events that omit it. If the invoke fails,
restore the same pending request only when no newer request has arrived. Restore
an equivalent new object instance rather than the original reference so dialog
components can reset submitted/busy state even if React batches the intermediate
`null` pending state.

Tool permission responses follow the same store-level idempotence rule. Clear
`pendingToolPermission` before awaiting `permission_respond_tool`, ignore
duplicate calls whose `requestId` no longer matches the pending request, and
restore the same pending request on invoke failure only when no newer tool
permission request has arrived. The invoke payload must include `sessionId`
from the pending request, or `"default"` for legacy events that omit it. This
store guard is mandatory even if the dialog disables or unmounts buttons,
because overlay clicks, keyboard shortcuts, and double-clicks can still race
through the callback boundary. Failure restore must use a fresh top-level
request object reference for the same reason as AskUserQuestion.

Plan approval responses follow the same store-level idempotence rule. Clear
`pendingPlanApproval` before awaiting `permission_respond_plan_approval`,
ignore duplicate calls whose `requestId` no longer matches the pending request,
and restore the same pending request on invoke failure only when no newer plan
approval request has arrived. The invoke payload must include `sessionId` from
the pending request, or `"default"` for legacy events that omit it.
Component-level submitted flags are useful for UX, but the store guard is the
final boundary because the dialog exposes multiple response paths such as
overlay cancel, close, deny, approve, and approve-auto. Failure restore must use
a fresh top-level request object reference so the dialog can re-enable controls
for retry even when the request id is unchanged.

### Chat Turn-Stopped Notifications

`useChatStore` owns the transition from an active streaming turn to a stopped
turn. Every terminal path must notify once through `notifyChatTurnStopped()`:

- `chat://done` with `success: true` → `outcome: 'success'`
- `chat://done` with `success: false` → `outcome: 'error'`
- user `abort()` after `chat_abort` succeeds → `outcome: 'aborted'`
- immediate `chat_send` failure before a backend request id exists → synthesize
  a stable `send-error:<assistantMessageId>` dedupe key

Notifications must be keyed by request id and deduplicated in the store because
the daemon can emit duplicate terminal events or a local abort can be followed by
a later done event. The store-level tests should cover success, error, abort,
and duplicate terminal events so Windows desktop notifications do not regress
into missing or repeated toasts.

### Chat Send Outcome Contract

`useChatStore.send()` returns `Promise<boolean>`:

- `true`: the composer should not restore the optimistic draft/attachments.
  This includes normal success where `chat_send` returned a backend request id,
  and the edge case where the user deliberately replaced the transcript
  (clear/start/load/abort) before that request id came back.
- `false`: nothing was sent (empty prompt without attachments) or `chat_send`
  failed before a backend request id was available.

Starting a real send must also cancel any pending history-load ownership in the
store: increment the session-load token and clear `pendingSessionKey` before
appending the optimistic user/assistant pair. A late
`get_unified_session_messages` result from a previously clicked history session
must not overwrite a transcript after the user has sent a new prompt.

The store still owns transcript/error updates on failure: it appends the visible
user message, marks the paired assistant message as non-streaming with the error,
stores `error`, and sends the deduplicated stopped notification. Composer-level
UI uses the boolean result only to restore local draft affordances such as
pending image attachments; it must not duplicate store error handling.

Required tests:
- Store test: `chat_send` failure returns `false` and leaves the failed assistant
  message visible with the error.
- Composer helper test: failed-send attachments are restored without duplicating
  attachments the user already added while the send was pending.

### Large History First-Paint Contract

`useChatStore.loadSession()` must use a window-first load for uncached
historical sessions:

1. Call `get_unified_session_message_window(providerId, sourcePath, tailLimit)`
   first and immediately render the returned recent window.
2. If `complete === false`, finish the normal browsing load with
   `ChatSessionLoadMetrics.status === "windowed"` and do not call
   `get_unified_session_messages()` automatically. The windowed state means the
   recent transcript is ready while older history remains unloaded by design.
3. If `complete === true`, cache the mapped history because the returned window
   is already the complete transcript.

Do not start `get_unified_session_messages()` from the ordinary history-click
path. Full-history reads can move thousands of records through the backend,
IPC, and JavaScript mapping layers, so they must be tied to an explicit
full-history intent. The current explicit intent is Chat transcript search on a
`windowed` historical session: `ChatPage` calls
`useChatStore.loadActiveSessionFullHistory()` only after the user enters a
search query. Future "load earlier pages from source" actions should follow the
same ownership and paging/indexing boundary.

Window messages must be mapped with the backend `startIndex` offset when
building history message ids. For example, a window item at offset `0` with
`startIndex = 4880` must become the same `history-...-4880` id it will have
inside the cached complete transcript. Do not map window messages from local
offset `0`, or React keys, anchors, and tool-result references will churn when
the same session is later loaded from cache.

`useChatStore.loadSession()` must not hydrate the normal Chat transcript with
the full loaded history after the first paint. Complete history may live in
`sessionHistoryCache` only when it came from a complete window or a future
explicit full-history intent, but the store `messages` field used by `ChatPage`
remains the loaded recent window in normal browsing mode. Cache hits follow the
same rule: derive a recent display window from the cached complete history and
set `windowMessageCount`, `totalMessageCount`, and `fullMessageCount` in
`ChatSessionLoadMetrics`; do not pass the cached complete array as visible
`messages`.

Components that derive expensive UI state from transcript history should use
`getRecentRenderableMessages()` to work on the visible tail plus explicitly
revealed pages, while preserving `originalIndex` for message identity and tool
result range lookups. Search is an explicit full-history intent: when a
`windowed` session is searched, the page may use the returned complete
`ChatMessage[]` as the temporary search source for `getRenderableMessages()` /
`filterRenderableMessages()`. Do not use that as permission to hydrate the main
store `messages` array; normal browsing must continue to render the recent
window. The complete search source should also not be passed wholesale into
`buildChatStatusSummary()` after filtering; use a bounded status context around
matched renderable messages so tool-result neighbors stay available without a
second full-history summary scan. Page-local search state should expose
full-history loading/error state to the transcript summary so users know
whether matches cover only the loaded window or the complete history. Retry
belongs to `ChatPage` page state: reset the page-local full-history search
snapshot and re-run the same explicit `loadActiveSessionFullHistory()` intent;
do not promote retry UI state into Zustand or let `MessageList` call store
actions directly.

Historical session cache entries are immutable-by-convention references to a
complete mapped `ChatMessage[]`. Do not clone the full array when storing or
reading `sessionHistoryCache`; repeated clicks on a cached large history
session should only slice the recent display window and must avoid another O(n)
visible-state hydration. State updates that append streamed messages or change
message fields must keep using immutable array/object replacement, never mutate
cached history messages in place.

Only cache complete histories: either an explicit full-history result, or a
first-paint window where `complete === true`. A partial window is display state,
not a reusable session cache entry.

Every async stage in `loadSession()` must check the current session-load token
before writing state. Sending a new prompt, switching sessions, clearing chat,
or starting a new session invalidates pending history loads.
`loadActiveSessionFullHistory()` must use the same token/ownership boundary so
a late full-history response from an older session cannot overwrite diagnostics
or cache after a user has already sent a new prompt from the first-paint window.

`useChatStore` also owns the latest `ChatSessionLoadMetrics` snapshot for
diagnosing slow historical session clicks. The snapshot is updated by the same
token-protected `loadSession()` stages that write transcript state: initial
loading, cache hit, first-paint window read/map, and error completion. Partial
large histories should end as `status: "windowed"` with `completedAt` and
`elapsedMs` set from the window stage, `fullMessageCount: null`, and no
`fullLoadMs` / `fullMapMs`. It is display-only state for `StatusPanel`;
components must not infer loading ownership from it or use it to trigger
another history read. Clear the snapshot when the user sends a new prompt,
switches providers, starts a new session, or clears the transcript so stale
diagnostics are not shown for a different conversation. `StatusPanel` may keep
local disclosure state for this snapshot: completed/windowed metrics should
default to collapsed, while loading/error metrics auto-expand. Do not store
this disclosure state in Zustand or use it to change the history-load ownership
token.

Only explicit full-history intents, currently search on a `windowed` historical
session, should call `getRenderableMessages()` / `filterRenderableMessages()`
across the whole transcript. Status summaries for normal browsing should be built from the
raw message slice beginning at the visible window's first original index, so
non-rendered tool-result records needed by visible tool-use blocks are still
available without scanning unrelated older turns. Regression tests for history
navigation helpers must cover original-index preservation and hidden renderable
counts. Store-level large-history tests must cover that incomplete windows
finish as `windowed`, do not invoke `get_unified_session_messages()`, and do
not cache partial windows; they must also cover that
`loadActiveSessionFullHistory()` is the explicit path that invokes
`get_unified_session_messages()`, caches the complete mapped transcript, and
keeps the normal visible `messages` array windowed.

### Chat Model List Loading Contract

`ChatComposer` owns the Chat model-list loading boundary. It should reuse the
existing `useProviderStore.loadAllProviders()` cache to read saved provider
configuration, then derive the selector list through
`buildChatModelList(provider, providers)`.

Model list source order:

1. Active provider model fields for the current Chat provider:
   `defaultSonnetModel`, `defaultOpusModel`, `defaultHaikuModel`, and
   `defaultReasoningModel`.
2. Local custom model config stored at
   `ccg-chat-custom-models:<provider>`, accepting either string model ids or
   `{ id, label?, description? }` objects.
3. Built-in fallback models from `constants.ts`.

The derived list must be deduped by `id`, and `ensureChatModelInList()` must
prepend the current selected model if it was restored from localStorage or a
history session but is not present in the dynamic sources. This prevents the
selector from silently falling back to the first built-in model label while the
store is still sending a different model id.

`ChatComposer` may surface provider-store loading/error state in the selector
footer, but it must keep the fallback list usable. Do not automatically call
remote model-fetch commands such as `fetch_models` from the Chat composer:
those commands contact the provider URL with an API key, can fail for
Anthropic-compatible sources that do not expose `/v1/models`, and should remain
user-triggered unless a bounded refresh UI is explicitly designed.

Required tests:
- `chatModels` helper tests for provider-derived models, custom storage shapes,
  invalid storage fallback, dedupe, and current-model preservation.
- `ButtonArea` SSR test for model-family icon rendering and injected dynamic
  model labels.
- `ChatComposer` render test proving provider-loaded models are passed to the
  bottom selector.

## Scenario: Chat Daemon Manual Recovery

### 1. Scope / Trigger

- Trigger: backend emits `chat://daemon` lifecycle events while the user is on
  the Chat page, especially `shutdown` after stdout closes or the daemon process
  exits unexpectedly.
- This is a cross-layer state contract. The Rust backend owns daemon startup and
  liveness, while the frontend owns how offline/error states are surfaced and how
  a user-triggered recovery command is serialized.

### 2. Signatures

```ts
interface ChatState {
    daemonReady: boolean;
    daemonStatus: string | null;
    daemonReconnecting: boolean;
    reconnectDaemon: () => Promise<void>;
}

interface ChatDaemonEvent {
    event: 'ready' | 'shutdown' | string;
    message?: string | null;
}

function getChatDaemonDiagnosticText(input: {
    daemonReady: boolean;
    daemonStatus?: string | null;
    daemonReconnecting?: boolean;
    error?: string | null;
}): string | null;
```

```ts
await invoke('chat_start_daemon');
```

### 3. Contracts

- `chat://daemon ready` sets `daemonReady: true`, `daemonStatus: 'ready'`, and
  `daemonReconnecting: false`.
- `chat://daemon shutdown` sets `daemonReady: false`,
  `daemonStatus: 'shutdown'`, and `daemonReconnecting: false`.
- `reconnectDaemon()` is the only frontend action that manually starts the
  daemon. It must no-op while `daemonReconnecting` is already true.
- Starting reconnect sets `daemonReady: false`, `daemonStatus: 'starting'`,
  `daemonReconnecting: true`, and clears the visible `error`.
- `chat_start_daemon` success does not clear `daemonReconnecting`; it starts a
  bounded frontend wait for the backend `ready` lifecycle event. The final ready
  state still comes from the backend `ready` event, not from command resolution.
- Initial daemon warm-up inside `init()` must also enter
  `daemonStatus: 'starting'` and start the same bounded ready wait after
  `chat_start_daemon` succeeds, unless a `ready` or `shutdown` lifecycle event
  has already resolved the state.
- If the ready wait expires while the store is not ready and
  `daemonStatus === 'starting'`, transition to the same recoverable error path
  as a failed start: `daemonReady: false`, `daemonStatus: 'error'`,
  `daemonReconnecting: false`, and a localized timeout diagnostic key in
  `error`.
- `chat_start_daemon` failure leaves `daemonReady: false`, sets
  `daemonStatus: 'error'`, clears `daemonReconnecting`, and stores
  `String(error)` in `error`.
- Initial daemon warm-up failure inside `init()` follows the same recoverable
  error state: `daemonReady: false`, `daemonStatus: 'error'`,
  `daemonReconnecting: false`, and `error: String(error)`. Do not leave
  `daemonStatus` as `null`, because the UI would keep presenting a generic
  starting state instead of the reconnect path.
- Components derive display state through shared daemon-status helpers rather
  than interpreting raw `daemonStatus` strings independently.
- Failure diagnostics are derived by `getChatDaemonDiagnosticText()`. Ready,
  starting, and reconnecting states return `null`; offline/error states prefer
  the explicit store `error`, then a meaningful non-generic `daemonStatus`.
  Generic values such as `error`, `shutdown`, `offline`, and `starting` are not
  repeated as diagnostics. Diagnostics must collapse whitespace and cap length
  before rendering in the status panel or top-header tooltip.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| `ready` event arrives during reconnect | Mark daemon ready, clear the ready timeout, and stop reconnect spinner. |
| `shutdown` event arrives while ready | Mark daemon offline and expose reconnect affordance. |
| `shutdown` event arrives while reconnect waits for ready | Clear the ready timeout, mark daemon offline, and stop reconnect spinner. |
| User clicks reconnect twice before command resolves | Only the first click invokes `chat_start_daemon`. |
| `chat_start_daemon` resolves before `ready` event | Keep `daemonReconnecting: true` and show starting state until `ready`, `shutdown`, or ready-timeout. |
| `chat_start_daemon` resolves but no `ready` event arrives before timeout | Show daemon error/offline recovery path and keep a localized timeout diagnostic visible. |
| `chat_start_daemon` rejects | Show daemon error/offline recovery path and keep the error visible. |
| Initial `init()` warm-up resolves but no `ready` event arrives before timeout | Show daemon error/offline recovery path and keep a localized timeout diagnostic visible. |
| Initial `init()` warm-up rejects | Mark daemon status as recoverable error and expose reconnect affordance. |
| Store `error` contains a concrete daemon failure | Show the sanitized diagnostic near the reconnect action and in the header tooltip. |
| Only generic status text is available (`error`, `shutdown`) | Do not render a duplicate diagnostic line. |
| Unknown non-ready status | Display diagnostic text, but do not claim success. |

### 5. Good/Base/Bad Cases

- Good: daemon stdout closes, backend emits `shutdown`, the header and status
  panel show offline with a compact reconnect button, and a user click calls
  `chat_start_daemon` once.
- Good: `chat_start_daemon` rejects with `Error: node executable not found`;
  the status panel still shows the reconnect button and adds that diagnosis as
  a compact one-line detail.
- Base: first app init still warms the daemon via `chat_start_daemon`, and the
  page shows starting until a ready event is received.
- Bad: rendering every non-ready state as "Starting..." with no recovery action;
  users cannot distinguish a healthy warmup from a dead daemon.
- Bad: showing only "Daemon error" after a failed reconnect while the actionable
  `String(error)` remains hidden in the page-level alert or store state.

### 6. Tests Required

- Store test: `reconnectDaemon()` sets pending state immediately, invokes
  `chat_start_daemon`, and keeps `daemonReconnecting` true after success until
  a backend lifecycle event or ready-timeout finishes the wait.
- Store test: `ready` during reconnect clears the ready timeout, marks daemon
  ready, and stops reconnecting.
- Store test: `shutdown` during reconnect clears the ready timeout, marks daemon
  offline, and stops reconnecting.
- Store test: reconnect success without a later `ready` event times out into a
  recoverable daemon error with a localized diagnostic key.
- Store test: reconnect failure stores `String(error)` and leaves the daemon in
  an error/offline recoverable state.
- Store test: initial `init()` warm-up success without a later `ready` event
  times out into a recoverable daemon error with a localized diagnostic key.
- Store test: initial `init()` warm-up failure stores `String(error)` and sets
  `daemonStatus: 'error'` so the recovery affordance is available on first load.
- Pure helper test: shutdown/daemon-exited map to offline, failed/error map to
  error, reconnecting maps to starting, ready wins over stale status text.
- Pure helper test: failure diagnostics prefer `error`, collapse whitespace,
  cap long text, hide during ready/starting/reconnecting, and avoid repeating
  generic statuses.
- Component test: status panel renders offline text plus a reconnect action when
  `daemonReady === false` and `daemonStatus === 'shutdown'`.
- Component test: status panel renders a concrete daemon failure diagnostic next
  to the reconnect action when `daemonStatus === 'error'` and `error` is set.
- Build check: `npm run build` must pass because `ChatState` additions are
  consumed by `ChatPage` and status components.

### 7. Wrong vs Correct

#### Wrong

```tsx
{daemonReady ? t('chat.ready') : daemonStatus || t('chat.starting')}
```

#### Correct

```tsx
const kind = getChatDaemonStatusKind({daemonReady, daemonStatus, daemonReconnecting});
const diagnostic = getChatDaemonDiagnosticText({daemonReady, daemonStatus, daemonReconnecting, error});
const canReconnect = daemonReconnecting || canReconnectChatDaemon({
    daemonReady,
    daemonStatus,
    daemonReconnecting,
});
```

---

## Scenario: Chat Request Ownership and Active Turn Guards

### 1. Scope / Trigger

- Trigger: chat streaming state consumes backend `chat://stream`,
  `chat://message`, and `chat://done` events while users can abort, switch
  sessions, start a new session, or send another turn.
- This is a cross-layer event ownership contract. All request-scoped events
  must be accepted or rejected inside `useChatStore` before they mutate
  messages, session ids, notifications, or loading state.

### 2. Signatures

```ts
interface ChatStreamEvent {
    requestId: string;
    kind: 'line' | 'stderr';
    text: string;
}

interface ChatDoneEvent {
    requestId: string;
    success: boolean;
    error?: string | null;
}

interface ChatMessageEvent {
    requestId: string;
    json: string;
}
```

Store actions that must be guarded during an active turn:

```ts
setProvider(provider: ChatProvider): void;
setPermissionMode(mode: PermissionMode): void;
setModel(modelId: string): void;
setReasoningEffort(level: ReasoningEffort): void;
answerAskUserQuestion(requestId: string, answers: Record<string, string>): Promise<void>;
answerToolPermission(requestId: string, allow: boolean): Promise<void>;
approvePlan(requestId: string, approved: boolean, targetMode: string): Promise<void>;
```

### 3. Contracts

- `activeRequestId` is the owner of the currently visible streaming assistant
  message once the backend request id is known.
- `chat://stream`, `chat://message`, and `chat://done` must carry `requestId`.
  Events with missing request ids are ignored.
- If `activeRequestId` exists, only events with the same `requestId` may mutate
  state.
- If `activeRequestId` is not known yet but the store has a streaming assistant
  message, the first non-retired request event may bind that streaming turn.
  This preserves the race where stream output arrives before `chat_send`
  resolves.
- Replacing or stopping a transcript while `chat_send` is still pending must
  invalidate that pending turn before the backend request id is known. If the
  old request id resolves later, it must be retired and must not become
  `activeRequestId`.
- Sending a new prompt while `loadSession()` is still waiting for history must
  invalidate that session load and clear `pendingSessionKey`; the user's new
  turn owns the transcript from that point forward.
- Completed or aborted request ids are retired. A retired request id must never
  bind to a later pending turn, even if the later `chat_send` has not returned
  its new request id yet.
- `chat://done` and `abort()` retire the request before clearing
  `activeRequestId`.
- `setProvider`, `setPermissionMode`, `setModel`, and `setReasoningEffort` are
  no-ops while there is an active request id or any streaming assistant message.
  UI controls should also be disabled, but the store guard is mandatory because
  keyboard shortcuts/tests can bypass the UI.
- `AskUserQuestion` cancel/answer paths are single-entry. Dialog cancel should
  call one callback, and the store must ignore duplicate/concurrent responses
  once the pending request has been cleared.
- `ToolPermission` allow/deny paths are also single-entry. The store must clear
  the pending request before awaiting `permission_respond_tool`, ignore
  duplicate/concurrent responses for the same request, and restore the original
  pending request on invoke failure only if no newer permission request exists.
- `PlanApproval` approve/deny/approve-auto/cancel paths are also single-entry.
  The store must clear the pending request before awaiting
  `permission_respond_plan_approval`, ignore duplicate/concurrent responses for
  the same request, and restore the original pending request on invoke failure
  only if no newer plan approval request exists.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Event `requestId` differs from current `activeRequestId` | Ignore; do not append text, merge raw, clear active state, or notify. |
| Event has no `requestId` | Ignore; keep current turn unchanged. |
| `activeRequestId` is null, streaming assistant exists, request id is not retired | Bind `activeRequestId` to that request and accept the event. |
| `activeRequestId` is null, streaming assistant exists, request id is retired | Ignore; this is a late event from a previous turn. |
| User clears/loads/starts a new session while `chat_send` is still pending | Invalidate the pending turn, invoke `chat_abort`, clear/replace transcript, and retire the old request id if it resolves later. |
| `chat://done` accepted for current request | Notify once, retire id, mark streaming assistant finished, clear `activeRequestId`. |
| User aborts current request | Invoke `chat_abort`, notify aborted once, retire id, mark streaming assistant stopped, clear `activeRequestId`. |
| User changes provider/model/mode/reasoning while active | No state change; no localStorage model/reasoning write. |
| AskUserQuestion answer/cancel called twice before invoke resolves | Only the first call invokes `permission_respond_ask_user_question`. |
| AskUserQuestion invoke fails | Set `error`; restore the same pending request only if no newer pending request exists. |
| ToolPermission allow/deny called twice before invoke resolves | Only the first call invokes `permission_respond_tool`. |
| ToolPermission invoke fails | Set `error`; restore the same pending request only if no newer pending request exists. |
| PlanApproval approve/deny/cancel called twice before invoke resolves | Only the first call invokes `permission_respond_plan_approval`. |
| PlanApproval invoke fails | Set `error`; restore the same pending request only if no newer pending request exists. |

### 5. Good/Base/Bad Cases

- Good: user aborts request A, immediately sends request B, then a late
  `[CONTENT_DELTA]` from A arrives while B is still waiting for `chat_send` to
  resolve. The late A event is ignored and B remains empty until B's own id
  arrives.
- Base: request B's first stream line arrives before `chat_send` resolves. The
  store binds B's id and appends the text.
- Bad: accepting any request id while a streaming assistant exists; this lets a
  stale done event stop the current turn or a stale tool raw message attach to
  the wrong assistant.

### 6. Tests Required

- Store test: stale stream/message/done from another active request is ignored.
- Store test: a retired request cannot bind to the next pending turn before the
  new `chat_send` resolves.
- Store test: a request id that resolves after `clear()` cannot bind to a later
  pending turn.
- Store test: provider/model/permission mode/reasoning setters are no-ops while
  active.
- Component test: composer selector buttons are disabled while `isLoading`.
- Store test: sequential and concurrent duplicate AskUserQuestion responses call
  the Tauri command once.
- Store test: sequential and concurrent duplicate ToolPermission responses call
  the Tauri command once, and invoke failure restores the same pending request.
- Store test: sequential and concurrent duplicate PlanApproval responses call
  the Tauri command once, and invoke failure restores the same pending request.
- Build checks: `npm test`, `npm run build`, `cargo check --manifest-path
  src-tauri/Cargo.toml`, and Rust tests must pass after changing event payloads.

### 7. Wrong vs Correct

#### Wrong

```ts
if (hasStreamingAssistant(state.messages)) {
    appendToStreamingAssistant(set, delta);
}
```

#### Correct

```ts
const stateBeforeStream = get();
if (!shouldAcceptRequestEvent(stateBeforeStream, requestId)) return;
bindPendingRequestIfNeeded(set, stateBeforeStream, requestId);
appendToStreamingAssistant(set, delta);
```

---

## Scenario: Chat Message Raw Event Merging

### 1. Scope / Trigger

- Trigger: frontend chat state consumes backend `chat://message` events that
  contain structured `MessageRaw` payloads.
- This is a cross-layer event contract. The Zustand store owns message merging;
  React components must not patch raw chat payloads directly.

### 2. Signatures

```ts
interface MessageRaw {
    type: 'user' | 'assistant';
    message: { content: ContentBlock[] };
    uuid?: string;
    timestamp?: string;
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

function mergeRawChatMessage(messages: ChatMessage[], raw: MessageRaw): ChatMessage[];
function findToolResult(
    messages: ChatMessage[],
    toolId: string | undefined,
    startIndex?: number,
): ToolResultBlock | null;
```

### 3. Contracts

- `chat://stream` updates the visible assistant `content` text; `chat://message`
  updates the structured `raw` payload.
- Assistant `raw` patches the current streaming assistant message first, then
  the latest assistant message. It must not erase streamed `content`.
- Assistant `raw` payloads are incremental structured events. When multiple
  assistant raw events arrive in one turn, merge their content blocks into the
  current assistant message instead of replacing the previous `raw`. If the
  assistant already has streamed `content` but no raw text block yet, seed the
  merged raw with that streamed text so a later `tool_use` block does not hide
  the visible answer text in `MessageItem`.
- After assistant `raw` exists, later `chat://stream` content deltas must also
  keep the assistant raw text block in sync with the full streamed `content`.
  `MessageItem` renders raw blocks before `message.content`, so updating only
  the hidden `content` field makes later text deltas disappear from the UI.
- Assistant text `raw` deltas or snapshots that are already represented by the
  full streamed `content` must be deduped instead of appended behind tool
  blocks. Otherwise a provider that emits both stream text and assistant text
  raw can show the same sentence twice in one turn.
- A user `raw` containing only text can patch the matching visible user prompt,
  but it must preserve that prompt's existing `content`.
- A user `raw` containing a `tool_result` is an internal protocol message. Store
  it as a separate `ChatMessage` with `content === '[tool_result]'`; do not
  overwrite the original user prompt.
- Tool rendering must resolve `tool_use.id` by scanning later messages for a
  matching `tool_result.tool_use_id`, starting at the assistant message index.
  If no later result is found, fall back to earlier internal `tool_result`
  messages for the same id. Later-message lookup stays first so ordinary
  transcript order wins, while the fallback covers out-of-order frontend event
  delivery where a `tool_result` raw event is stored before its assistant
  `tool_use` raw event arrives.
- `MessageList` may precompute a `toolResultById` map for visible-window
  rendering, but that map must follow the same later-first / earlier-fallback
  rule. Search result windows and collapsed transcripts must not hide an earlier
  internal `tool_result` from a visible assistant `tool_use` block.
- UI bubbles must hide internal user `tool_result` messages from the transcript.
- UI bubbles must not render assistant messages that have no visible text,
  thinking block, tool block, error, or streaming status.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| `chat://message` payload cannot be parsed | Log and ignore; keep existing messages unchanged. |
| Assistant raw arrives before any assistant message exists | Append an assistant message derived from raw text blocks. |
| Assistant streamed text is followed by a tool raw event | Keep the streamed text as a raw text block and append the tool block. |
| Assistant raw exists and more stream text arrives | Update the raw text block to the full streamed content so the transcript keeps rendering the later text. |
| Assistant text raw delta/snapshot repeats text already in streamed content | Skip that text raw block; keep one full raw text block plus the non-text blocks. |
| Assistant receives multiple raw events in one turn | Preserve prior raw blocks and append only new blocks, deduping repeated snapshots. |
| User text raw matches an existing prompt | Patch `raw`; keep original visible `content`. |
| User raw contains `tool_result` | Append or update the internal `[tool_result]` message. |
| Duplicate `tool_result` for the same `tool_use_id` arrives | Update the existing internal result message instead of appending duplicates. |
| Tool result arrives after the assistant tool block | UI finds it by cross-message lookup and updates the tool block status. |
| Tool result arrives before the assistant tool block | UI falls back to earlier internal `tool_result` lookup for the same id, after checking later messages first. |
| Search/collapsed window starts at a visible assistant tool block while its result is earlier | `MessageList` precomputed tool-result map still finds the earlier internal result and renders completed/error status, not pending. |
| Assistant message has empty content and only empty text/thinking blocks | Do not render an empty chat bubble. |
| Assistant message has empty content but is streaming or has an error | Render status feedback so loading/error remains visible. |

### 5. Good/Base/Bad Cases

- Good: prompt message stays visible, assistant tool block renders completed or
  failed state from a later internal `tool_result` message.
- Base: plain text conversations without tools still render from streamed
  `content` and optionally attach raw text blocks.
- Bad: replacing the last user message by role when a `tool_result` arrives;
  this corrupts the transcript by turning the user's prompt into tool output.

### 6. Tests Required

- Unit test: user raw patch preserves the original prompt `content`.
- Unit test: `tool_result` is appended as an internal user message and does not
  overwrite the prompt.
- Unit test: `findToolResult()` resolves a later `tool_result` for an earlier
  assistant `tool_use`.
- Unit test: `findToolResult()` resolves an earlier internal `tool_result` when
  assistant `tool_use` raw arrives out of order.
- Unit test: assistant raw merging preserves earlier text/raw blocks when a
  later tool raw event arrives.
- Unit test: streamed assistant text remains renderable when the first raw
  assistant event is a tool block.
- Store test: full live turn sequence keeps later streamed text visible after
  assistant tool raw blocks have already arrived.
- Store test: assistant text raw deltas/snapshots after raw sync do not create
  duplicate visible text blocks.
- Unit test: empty assistant messages are not renderable, while streaming/error
  assistant messages remain renderable.
- Build check: `npm run build` must pass because strict TypeScript catches unused
  imports and unsafe prop drift in the chat UI.

### 7. Wrong vs Correct

#### Wrong

```ts
const lastUserIndex = findLastIndex(messages, (m) => m.role === raw.type);
messages[lastUserIndex] = { ...messages[lastUserIndex], raw };
```

#### Correct

```ts
const messages = mergeRawChatMessage(state.messages, raw);
const result = findToolResult(messages, toolUse.id, assistantMessageIndex);
```

---

## Scenario: Chat Completion Command Payload Normalization

### 1. Scope / Trigger

- Trigger: a frontend completion hook consumes Tauri command payloads for chat
  composer candidates, especially `chat_list_workspace_files`.
- This is a cross-layer command contract. Rust structs do not automatically use
  frontend camelCase unless the backend type explicitly declares
  `#[serde(rename_all = "camelCase")]`.

### 2. Signatures

```rust
#[derive(serde::Serialize)]
pub struct WorkspaceFile {
    pub rel_path: String,
    pub name: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn chat_list_workspace_files(
    dir: Option<String>,
    query: Option<String>,
) -> Result<Vec<WorkspaceFile>, String>;
```

```ts
interface WorkspaceFilePayload {
    relPath?: unknown;
    rel_path?: unknown;
    name?: unknown;
    isDir?: unknown;
    is_dir?: unknown;
}

function normalizeWorkspaceFile(file: WorkspaceFilePayload): WorkspaceFile | null;
```

### 3. Contracts

- `chat_list_workspace_files` currently returns `rel_path`, `name`, and
  `is_dir`.
- Frontend command adapters may accept both `snake_case` and `camelCase` to
  tolerate future backend serialization changes.
- Rendering components must receive normalized `CompletionItem` data only.
  `label`, `id`, and `insertText` must never be `undefined`.
- Invalid command items are dropped before reaching `CompletionMenu`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Payload has `rel_path` / `is_dir` | Normalize to `relPath` / `isDir`. |
| Payload has future `relPath` / `isDir` | Accept it without backend changes. |
| Payload has no usable path | Return `null` and filter it out. |
| Payload has no `name` | Derive name from basename of the relative path. |
| Backend command fails | Close or empty the menu; do not render stale undefined labels. |

### 5. Good/Base/Bad Cases

- Good: `@src/pages/ChatPage.tsx` appears from a Rust payload shaped as
  `{ rel_path: "src/pages/ChatPage.tsx", is_dir: false }`.
- Base: a future adapter payload shaped as `{ relPath, isDir }` still works.
- Bad: mapping `f.relPath` directly from the Rust payload and rendering
  `undefined` candidates in the menu.

### 6. Tests Required

- Unit test: `snake_case` Rust payload normalizes to frontend shape.
- Unit test: `camelCase` payload remains accepted.
- Unit test: missing path returns `null`.
- Build check: `npm run build` must pass because strict TypeScript catches
  unsafe completion item drift.

### 7. Wrong vs Correct

#### Wrong

```ts
const files = await invoke<WorkspaceFile[]>('chat_list_workspace_files');
return files.map((file) => ({
    id: file.relPath,
    label: file.relPath,
    insertText: file.relPath,
}));
```

#### Correct

```ts
const files = await invoke<WorkspaceFilePayload[]>('chat_list_workspace_files');
return files
    .map(normalizeWorkspaceFile)
    .filter((file): file is WorkspaceFile => file !== null)
    .map((file) => ({
        id: file.relPath,
        label: file.relPath + (file.isDir ? '/' : ''),
        insertText: file.relPath,
    }));
```

---

## Scenario: Chat Session Transition Abort Boundary

### 1. Scope / Trigger

- Trigger: the user starts a new chat, clears the transcript, or loads a
  historical chat while a daemon request is still active.
- This is event-driven state. Tauri stream events can arrive after UI state has
  started transitioning, so the store owns the transition boundary.

### 2. Signatures

```ts
interface ChatState {
    activeRequestId: string | null;
    sessionId: string | null;
    currentCwd: string | null;
    activeSession: SessionMeta | null;

    loadSession: (session: SessionMeta) => Promise<void>;
    startNewSession: (cwd?: string | null) => Promise<void>;
    clear: () => Promise<void>;
    abort: () => Promise<void>;
}
```

```ts
await invoke('chat_abort');
await invoke<UnifiedSessionMessage[]>('get_unified_session_messages', {
    providerId: session.providerId,
    sourcePath: session.sourcePath,
});
```

### 3. Contracts

- If `activeRequestId` is present, `loadSession`, `startNewSession`, and
  `clear` must call `chat_abort` before replacing transcript/session state.
- `loadSession` then sets `provider`, `sessionId`, `currentCwd`,
  `activeSession`, and mapped history messages from
  `get_unified_session_messages`.
- `startNewSession` clears `messages`, `sessionId`, `activeSession`, active
  request state, and token counters while preserving or applying the target
  `cwd`.
- `clear` clears transcript/session state and active request state. It does not
  change provider/model settings.
- If `chat_abort` fails during a session transition, the transition may still
  continue so the user can recover from a stuck daemon, but the final store
  state must keep `error: String(error)`. Do not overwrite the abort failure
  with `error: null` in the final `loadSession`, `startNewSession`, or `clear`
  state update; otherwise the UI silently hides that the old daemon turn was
  not cleanly interrupted.
- If `loadSession` aborts an active turn and then
  `get_unified_session_messages` fails, keep the current transcript for data
  recovery, but mark any previous streaming assistant message as stopped/error.
  The store must not leave `streaming: true` after it has retired the old active
  request ownership.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Active request exists and user loads history | Abort first, then load history. |
| Active request exists and user starts a new chat | Abort first, then clear session state. |
| `chat_abort` fails | Store `String(error)` and still remove stale `activeRequestId`. |
| `chat_abort` fails while transition continues | Complete the requested transition, but preserve the abort error in final state. |
| History load fails after an active turn was aborted | Keep the old transcript visible, stop the old streaming assistant, clear `pendingSessionKey`, and show the history load error. |
| Unsupported history provider | Set an error and do not load messages. |
| History role is unknown | Normalize to `system` instead of throwing. |

### 5. Good/Base/Bad Cases

- Good: a streaming response is interrupted before a history session replaces
  the transcript.
- Base: loading a completed session with no active request skips `chat_abort`
  and only reads history.
- Bad: clearing messages while the old daemon response is still active, letting
  old stream events update the new chat.

### 6. Tests Required

- Unit test: `startNewSession()` with `activeRequestId` calls `chat_abort` and
  clears session state.
- Unit test: `loadSession()` with `activeRequestId` calls `chat_abort` before
  `get_unified_session_messages`.
- Unit test: abort failure during `startNewSession()`, `clear()`, and
  `loadSession()` keeps the abort error visible after the transition finishes.
- Unit test: `loadSession()` with an active turn and a rejected
  `get_unified_session_messages` call stops the previous streaming assistant
  instead of leaving an infinite loading placeholder.
- Build check: `npm run build` must pass because store action signatures are
  consumed by page callbacks.

### 7. Wrong vs Correct

#### Wrong

```ts
startNewSession: (cwd) => set({
    messages: [],
    sessionId: null,
    activeSession: null,
    currentCwd: cwd,
});
```

#### Correct

```ts
startNewSession: async (cwd) => {
    await abortActiveRequestIfNeeded(get, set);
    set((state) => ({
        messages: [],
        sessionId: null,
        activeSession: null,
        currentCwd: cwd ?? state.currentCwd,
        activeRequestId: null,
        contextTokens: 0,
        error: null,
    }));
};
```

---

## Scenario: Chat Provider Switch Context Handoff

### 1. Scope / Trigger

- Trigger: the chat UI lets the user switch between `claude` and `codex` while
  a visible transcript is already loaded.
- This is a cross-layer command/event contract. The UI presents one transcript,
  but providers keep incompatible native session identifiers:
  Claude uses `sessionId`; Codex uses `threadId`.

### 2. Signatures

```ts
interface ChatState {
    provider: ChatProvider;
    sessionId: string | null;
    activeSession: SessionMeta | null;
    handoffContextProvider: ChatProvider | null;
    messages: ChatMessage[];

    setProvider: (p: ChatProvider) => void;
    send: (text: string, opts?: { cwd?: string; model?: string }) => Promise<void>;
}
```

```ts
await invoke<string>('chat_send', {
    provider,
    command: 'send',
    params: {
        message,
        sessionId: provider === 'claude' ? sessionId : undefined,
        threadId: provider === 'codex' ? sessionId : undefined,
        cwd,
        model,
        permissionMode,
        reasoningEffort,
        streaming: true,
    },
});
```

### 3. Contracts

- The frontend may store both Claude session ids and Codex thread ids in the
  same `sessionId` field, but it must map them back to the provider-specific
  command parameter at send time.
- `chat://stream` lines starting with `[SESSION_ID]` and `[THREAD_ID]` both
  update `ChatState.sessionId`.
- On provider switch, `setProvider()` must clear the provider-native session id
  and `activeSession`, because Claude sessions cannot be resumed as Codex
  threads and vice versa.
- If visible text history remains after a provider switch, set
  `handoffContextProvider` to the previous provider. The next send with no
  native `sessionId`/`threadId` must prepend a bounded hidden transcript to the
  outbound payload. The visible UI message stays as the user's original input.
- Once a provider returns `[SESSION_ID]` or `[THREAD_ID]`, clear
  `handoffContextProvider`; the new provider-native session now owns future
  context.
- `loadSession()`, `startNewSession()`, and `clear()` must reset
  `handoffContextProvider`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Codex emits `[THREAD_ID] abc` | Store `sessionId === "abc"` and clear pending handoff. |
| Sending with `provider === "codex"` and `sessionId === "abc"` | Send `params.threadId === "abc"` and no Claude `sessionId`. |
| Sending with `provider === "claude"` and `sessionId === "abc"` | Send `params.sessionId === "abc"` and no Codex `threadId`. |
| User switches Claude -> Codex while transcript is visible | Clear native session id, remember Claude as handoff source, keep visible messages. |
| First Codex send after switch has no thread id | Outbound payload includes bounded prior transcript plus the user's new prompt. |
| User starts a new session or clears chat | Clear transcript and pending handoff; do not inject old context. |

### 5. Good/Base/Bad Cases

- Good: a loaded Claude history remains visible, the user switches to Codex, and
  Codex's first turn receives a hidden transcript so it can continue the work.
- Base: a normal Codex session saves `[THREAD_ID]` and resumes future sends with
  `threadId`.
- Bad: keeping the visible transcript while sending a brand-new Codex thread
  with only the latest user message. The UI implies context continuity but the
  model has none.

### 6. Tests Required

- Unit test: `[THREAD_ID]` updates `sessionId` and the next Codex send includes
  `threadId`.
- Unit test: Claude -> Codex provider switch injects visible history into the
  outbound payload while preserving the visible user message.
- Build check: `npm run build` must pass because strict TypeScript catches
  store interface drift and test-target library mismatches.

### 7. Wrong vs Correct

#### Wrong

```ts
const params = {
    message: text,
    sessionId: sessionId ?? undefined,
};
```

#### Correct

```ts
const params = {
    message: outboundMessage,
    sessionId: provider === 'claude' ? sessionId ?? undefined : undefined,
    threadId: provider === 'codex' ? sessionId ?? undefined : undefined,
};
```

---

## When to Use Global State

Promote to a Zustand store when **more than one page/component needs the same
data**, when it must survive route changes, or when it is backend-owned data
that benefits from a load/cache guard. Keep it local (`useState`) when it is
purely presentational and scoped to one component subtree.

---

## Server State

- No React Query/SWR. Each store is responsible for caching its own slice with
  `hasLoaded` and an explicit `force` parameter to bust the cache.
- After any mutation, re-fetch (`loadAllProviders(true)`) rather than mutating
  the in-memory array, so the UI always matches backend state.
- Cross-cutting backend pushes arrive as Tauri events (`listen(...)`), handled
  in `App.tsx` or in store `initEventListeners()` methods.

### Chat Composer Status Strip

- `buildChatStatusSummary()` is the owner for chat activity projections used by
  the right status panel and by the composer-adjacent status strip. It should
  return the active tool, recent/all edit summaries, aggregate edit totals,
  `toolTimeline`, and `agentTools`. Components must not rescan raw message
  payloads to build a private task or subagent list.
- `toolTimeline` is ordered by transcript order and represents the loaded
  transcript window, not necessarily the entire historical session when large
  histories are windowed for first paint. Components that need "latest first"
  should reverse a copy locally for display only.
- `mergeChatInputStatusSummary()` is the only place that should combine the
  first-paint visible-tail summary with a later full-history summary for the
  composer status strip. In normal browsing, large histories remain windowed and
  the strip should render from the lightweight visible summary only. If a future
  explicit full-history mode provides a wider summary, `ChatPage` may merge that
  display-only result here, but it must keep `StatusPanel` and first-paint
  navigation on the visible window. Do not synchronously or idle-schedule
  `buildChatStatusSummary(messages)` across an automatically loaded `windowed`
  history just to decide whether the composer strip shows tasks, subagents, or
  edits. `ChatPage` should gate this through
  `shouldBuildCompleteChatStatusSummary()` so post-load idle work does not
  re-scan heavy raw/tool payloads for large histories during ordinary browsing.
- `agentTools` is the filtered subset of `toolTimeline` where the normalized
  tool type is `agent`. Preserve the source `toolId` and status so UI selections
  and pending/running indicators can be tied back to the original tool call.
- `ChatInputStatusTabs` may derive a local task list from `toolTimeline`, but
  that task list must exclude `agent` tools because `agentTools` owns the
  subagent queue. Do not duplicate the same agent run in both the tasks and
  subagents tabs; this is a presentation split, not a new store field.
- The composer status strip is presentational state owned by the chat page
  subtree. Its open tab state should remain local to the strip component; global
  Zustand state is not needed unless backend-owned data or cross-route behavior
  is introduced later. Collapsed strip entries are compact quick-entry chips,
  not another source of status-detail state: counts and labels are derived from
  the existing summary, while expanded panels and the right `StatusPanel` remain
  the places for detailed rows. When the desktop right `StatusPanel` is visible,
  `ChatPage` may pass a presentational prop that makes the expandable strip tabs
  `xl:hidden`; this is a layout-density choice, not a new store field. Keep the
  Git branch chip available because it is a send-context signal rather than a
  duplicate diagnostics panel.
- Workspace Git status for the composer strip is also page-local display state.
  `ChatPage` may call the read-only `chat_workspace_status(cwd)` command when
  `currentCwd` changes, normalize the payload through `chatWorkspaceStatus.ts`,
  and pass the result down to the strip. Do not promote this to Zustand unless
  another route needs the same cached value. Command failures should normalize to
  a non-Git empty status so Chat sending and transcript rendering are never
  blocked by repository detection. Git chip density is presentational: keep the
  branch label/value truncation and accessible title/aria context in
  `ChatInputStatusTabs`, not in global state.
- MCP availability for the composer strip should be the same
  `ChatMcpAvailabilitySummary` that `ChatPage` passes to `StatusPanel`; do not
  recompute provider-specific enabled flags inside `ChatInputStatusTabs`. The
  strip should render the MCP entry only when there are configured servers,
  loading, or an error, and should keep its expanded/collapsed tab state local.
  This surface is a small-screen configuration details entry, not a live status
  checker, so it must not call `check_mcp_status`.

### Chat Runtime Context Surface

- `StatusPanel` is presentational for runtime context. It may receive
  `provider`, `model`, `permissionMode`, `reasoningEffort`, `currentCwd`, and
  the active `SdkStatus` from `ChatPage`, but it must not read stores directly or
  duplicate those values into a new Zustand store. Its compact-grid layout is
  component-local presentation only; do not introduce a store flag to track
  runtime context density or expanded/collapsed rows.
- Pending and failed tool counts shown in `StatusPanel` should be derived from
  the existing `statusSummary` and rendered with the current activity card. Do
  not duplicate those counts into top-level status rows, and do not introduce
  separate Zustand state for activity-card count visibility.
- The current-activity card visibility is also derived presentation state:
  render it only when `statusSummary.activeTool` exists, `isStreaming` is true,
  or pending/failed tool counts are non-zero. A fully idle steady state should
  not be stored or rendered as a large card.
- The recent-edits card in `StatusPanel` should use existing edit summary props
  as its visibility trigger: touched file count, `allEdits`, or the collapsed
  diff-pane reopen action. Its empty/hidden state is presentational; do not add
  Zustand state to remember whether a zero-edit card was hidden.
- `useChatStore` remains the owner of selected model, permission mode, reasoning
  effort, and current workspace. `useSdkStore` remains the owner of SDK
  installation status. `ChatPage` is the composition boundary that selects the
  active SDK row (`claude-sdk` / `codex-sdk`) for the current provider and passes
  it down.
- Rendering the runtime context must not perform remote model discovery, SDK
  installation, MCP connectivity checks, or daemon restarts. Those actions need
  explicit user-triggered controls because they may touch the filesystem,
  network, or child processes.

### Chat Model Selector Refresh

- Provider selector iconography is presentational. `useChatStore` remains the
  owner of the active provider and active-turn guards; `SelectorDropdown`
  compact mode and provider-specific icons must not introduce another provider
  store, local active-provider mirror, or side effect during render. Fixed
  selector icon boxes, including trigger icons, option icons, and selected
  checkmarks, are component-level layout only and must stay out of Zustand.
- Composer toolbar layout is also presentational. Stable wrapper classes such
  as `chat-composer-toolbar`, `chat-composer-toolbar-selectors`, and
  `chat-composer-toolbar-actions`, plus fixed square enhance/send/stop action
  sizing, belong in `ButtonArea` markup and tests. Do not add Zustand state for
  toolbar wrapping, action-group pinning, or icon-button dimensions.
- `useChatStore` owns the selected chat model, but it should not own the
  discovered model list. Model options are derived in the composer from
  Provider configuration, `ccg-chat-custom-models:<provider>` localStorage, and
  provider-specific fallback arrays through `chatModels.ts`.
- Manual model refresh is component-local state in `ChatComposer`: pending and
  error state should stay local to the composer toolbar because the operation is
  only triggered from that toolbar. Do not auto-refresh model lists on mount or
  provider switch; remote discovery calls the configured provider endpoint with
  an API key and must require explicit user intent.
- A successful refresh writes the normalized model ids to
  `ccg-chat-custom-models:<provider>` and dispatches the existing
  `localStorageChange` event with the same key, so the composer can reuse its
  current cache-version listener instead of adding another global store.
- Refresh failures should show a short, sanitized message in the model control
  and must not clear existing configured/fallback models. Empty remote results
  should fall back to configured/fallback models rather than blocking Chat send.

### Chat MCP Availability Summary

- `useMcpStoreV2` owns MCP server configuration fetched from `get_mcp_servers`.
  Chat UI may consume that store to show a lightweight availability summary, but
  it must derive display data through `buildChatMcpAvailabilitySummary()` rather
  than reading `enabledClaude` / `enabledCodex` / `enabledGemini` ad hoc inside
  components.
- The summary is configuration availability only: `totalServers`,
  `enabledServers`, `loading`, `error`, and `servers[]` for the active provider.
  Each `servers[]` item should include a stable id, display name, transport or
  config type when known, and whether that server is enabled for the active
  provider. It must not be labeled or treated as a live connectivity result
  unless the frontend has explicitly invoked the backend `check_mcp_status`
  command.
- Store loading errors should remain visible near the MCP summary in
  `StatusPanel`; counts should remain visible at the same time so users can
  distinguish "configuration exists but refresh failed" from "no MCP servers
  configured".
- The `StatusPanel` MCP row must be expandable. The collapsed summary keeps the
  enabled/total count, while the expanded detail lists configured servers with
  enabled/disabled labels for the active provider. Expansion is local
  `StatusPanel` UI state and should be driven by an explicit toggle button with
  `aria-expanded`; do not rely on native `<details>` state or store the expanded
  flag in Zustand. Do not call live MCP status commands from this expansion
  path.
- The composer status strip may render a separate MCP tab from the same summary
  so users can inspect MCP configuration when the wide-screen right panel is
  hidden. Keep that tab read-only: list server name, transport/config type, and
  enabled/disabled for the active provider, and leave manual connectivity checks
  in the right-side MCP details surface.
- Manual MCP connectivity checks are page-local state owned by `ChatPage`.
  `check_mcp_status(serverIds)` may spawn stdio MCP commands, so it must only be
  called from an explicit user action. The check target list should be the
  current provider's enabled server ids from `ChatMcpAvailabilitySummary`, not
  every configured server. Reset live results when that target key changes, and
  ignore stale command responses if the user switches provider or MCP
  configuration while a check is in flight.

---

## Common Mistakes

- Optimistically editing the in-memory array instead of re-fetching after a
  mutation — diverges from backend state. Follow the re-fetch pattern.
- Forgetting to re-throw in mutation actions, so the page can't surface a toast
  on failure. (Read actions like `loadAllProviders` intentionally swallow and
  store the error; mutations re-throw.)
- Putting page-local UI state (open modal, search text) into a global store.
- Throwing raw errors instead of `String(error)` for the `error` field.
- Skipping the `hasLoaded`/`force` guard and re-fetching on every mount.
