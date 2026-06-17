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
| **Event-driven request (Tauri push)** | **Zustand store** | **`pendingAskUserQuestion` (权限审批)** |

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
- A user `raw` containing only text can patch the matching visible user prompt,
  but it must preserve that prompt's existing `content`.
- A user `raw` containing a `tool_result` is an internal protocol message. Store
  it as a separate `ChatMessage` with `content === '[tool_result]'`; do not
  overwrite the original user prompt.
- Tool rendering must resolve `tool_use.id` by scanning later messages for a
  matching `tool_result.tool_use_id`, starting at the assistant message index.
- UI bubbles must hide internal user `tool_result` messages from the transcript.
- UI bubbles must not render assistant messages that have no visible text,
  thinking block, tool block, error, or streaming status.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| `chat://message` payload cannot be parsed | Log and ignore; keep existing messages unchanged. |
| Assistant raw arrives before any assistant message exists | Append an assistant message derived from raw text blocks. |
| User text raw matches an existing prompt | Patch `raw`; keep original visible `content`. |
| User raw contains `tool_result` | Append or update the internal `[tool_result]` message. |
| Duplicate `tool_result` for the same `tool_use_id` arrives | Update the existing internal result message instead of appending duplicates. |
| Tool result arrives after the assistant tool block | UI finds it by cross-message lookup and updates the tool block status. |
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
