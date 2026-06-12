# Hook Guidelines

> Custom hook conventions in this project.

---

## Overview

Custom hooks live in `src/hooks/` and are named `useXxx.ts`. They are used for
**reusable stateful UI logic that is not global app state** — for example,
transient per-view async status. Global/shared data lives in Zustand stores
instead (see `state-management.md`), and one-off page logic stays inline in the
page component with `useState`/`useEffect`/`useMemo`.

There are few custom hooks today; `useHealthCheck` is the reference example.

---

## Custom Hook Patterns

- File and function: `useXxx` (camelCase), exported as a **named** export.
- Co-locate hook-specific types in the same file and export the ones consumers
  need (`useHealthCheck.ts` exports `HealthState` and `HealthStatus`).
- Return an object of named values and callbacks (not a positional tuple) so
  call sites destructure what they need:

```ts
return { statuses, checkSingle, checkBatch, isAnyChecking, clearAll };
```

- **Memoize callbacks with `useCallback`.** Every function a hook returns is
  wrapped in `useCallback` with correct deps, since they get passed to children
  and used in effect deps.
- **State updates use the functional updater form** to avoid stale closures,
  especially for map/record state:

```ts
setStatuses(prev => ({ ...prev, [providerId]: { state: 'checking' } }));
```

- **Async work is wrapped in try/catch**; failures are stored in state rather
  than thrown, so the UI can render an error/failed state.
- Concurrency control is explicit when needed — `useHealthCheck.checkBatch`
  implements a bounded worker pool (default concurrency 5) rather than firing
  all requests at once. Follow this pattern for batch operations.

---

## Data Fetching

- **No React Query / SWR.** Data is fetched by calling the Rust backend through
  Tauri `invoke` from `@tauri-apps/api/core`, typed with a generic:
  `await invoke<ProviderHealthResult>('check_provider_health', { providerId })`.
- Shared/server data is fetched and cached in **Zustand stores**, not hooks
  (see `state-management.md`). A hook is the right place only for transient,
  view-scoped async state (like an in-progress health check).
- Multi-call commands are usually wrapped in a `services/*Service.ts` function;
  ad-hoc single calls invoke directly inside the hook/component.

---

## App-level Effects (in App.tsx, not hooks)

`App.tsx` shows the project's pattern for startup/warmup side effects (kept in
the component, not extracted to hooks):
- Warmup store data during idle time using `requestIdleCallback` with a
  `setTimeout` fallback, and clean up the scheduled callback on unmount.
- Tauri event subscriptions use `listen(...)` and **must return the `unlisten`
  function** from the effect cleanup:

```ts
useEffect(() => {
  let unlisten: (() => void) | null = null;
  listen<UpdateInfo>('auto-update-available', e => { /* ... */ })
    .then(fn => { unlisten = fn; });
  return () => { if (unlisten) unlisten(); };
}, []);
```

---

## Naming Conventions

- Hooks start with `use` and use camelCase: `useHealthCheck`.
- File name matches the hook name: `useHealthCheck.ts`.
- Returned callbacks are verbs (`checkSingle`, `clearAll`); returned state is a
  noun (`statuses`, `isAnyChecking`).

---

## Common Mistakes

- Calling hooks conditionally or outside the top level — violates the Rules of
  Hooks.
- Missing/incorrect dependency arrays. Strict TypeScript is on, but **ESLint is
  not configured**, so there is no `react-hooks/exhaustive-deps` safety net — be
  deliberate about deps.
- Forgetting to clean up subscriptions, timers, or `listen` handlers in the
  effect return function.
- Putting shared/server state in a local hook when multiple views need it — use
  a Zustand store instead.
- Returning new object/function references without `useCallback`/`useMemo`,
  causing child re-renders.

---

## Examples

- `src/hooks/useHealthCheck.ts` — local async status map, `useCallback`,
  functional updates, bounded-concurrency batch runner.
- `src/App.tsx` — idle-time warmup effects and Tauri `listen` cleanup.
