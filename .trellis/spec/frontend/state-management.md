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
