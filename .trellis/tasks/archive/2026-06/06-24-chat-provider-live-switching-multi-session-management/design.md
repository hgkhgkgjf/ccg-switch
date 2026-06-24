# Design: Chat provider live switching and multi-session management

## Architecture Boundaries

This task spans four boundaries:

1. Chat runtime state in `useChatStore`.
2. Tauri chat commands and `ChatManager` daemon lifecycle.
3. Node ai-bridge daemon request/runtime behavior.
4. Chat page session UI: sidebar, recent sessions, top tabs, composer controls.

The main design constraint is that the Node daemon serializes command requests because stdout/stderr tagging depends on one global `activeRequestId`. Therefore the first implementation should support multi-session continuity and fast switching, not true parallel model execution.

## State Model

Current state is single-transcript:

```ts
messages
provider
model
activeRequestId
sessionId
activeSession
currentCwd
```

The target model should introduce a stable conversation/session viewport layer:

```ts
interface ChatWorkspaceSnapshot {
    key: string;
    provider: ChatProvider;
    model: string;
    permissionMode: PermissionMode;
    reasoningEffort: ReasoningEffort;
    longContextEnabled: boolean;
    draft: string;
    messages: ChatMessage[];
    activeRequestId: string | null;
    sessionId: string | null;
    activeSession: SessionMeta | null;
    currentCwd: string | null;
    contextTokens: number;
    contextMaxTokens: number | null;
    lastSessionLoadMetrics: ChatSessionLoadMetrics | null;
    handoffContextProvider: ChatProvider | null;
    status: 'idle' | 'loading' | 'running' | 'queued' | 'error';
    error: string | null;
}
```

`useChatStore` may still expose the current active snapshot through the existing fields to reduce blast radius, but request events need an ownership map:

```ts
requestId -> snapshotKey
```

All stream/message/done handlers should first resolve the target snapshot by request id, then update that snapshot. If the target snapshot is currently active, the legacy top-level fields are refreshed from it. If not active, the tab/recent-session status changes but the visible transcript does not switch.

## Request Ownership Contract

At send time:

1. Capture active snapshot key, provider, model, permission mode, reasoning effort, long context flag, cwd, session id, and visible messages.
2. Optimistically append user/assistant messages to that snapshot.
3. Call `chat_send`.
4. When the backend returns `requestId`, register `requestId -> snapshotKey`.
5. Events for that request update only that snapshot.

If the user switches sessions while `chat_send` is still resolving, the send token should retire only that send's ownership, not invalidate all future session loads globally.

## Session Switching Contract

History/session navigation should no longer call global `chat_abort` by default.

New behavior:

- Switching away from a running snapshot saves the snapshot in store and marks its tab/recent row as running.
- Loading another history session creates or activates another snapshot.
- The old request continues through the daemon queue/runtime and updates the old snapshot by request id.
- Re-selecting the old tab shows the latest snapshot state.

Explicit destructive transitions remain:

- User clicks Stop on a running snapshot.
- User clears the active snapshot and confirms/accepts that current active turn will stop if needed.
- User closes a running tab only after an explicit policy decision. Recommended first version: closing a running tab hides it but keeps the snapshot until done, or disables close with a running indicator.

## Provider/Model Switching Contract

### Chat Runtime Provider

`setProvider()` / `setModel()` / related controls should not silently no-op during an active turn.

Recommended behavior:

- The active running request keeps the provider/model captured at send time.
- The visible control updates the active snapshot's "next turn" config immediately.
- If switching runtime provider while visible messages exist, keep the existing handoff context behavior: clear native session id for the new provider and set `handoffContextProvider` to the previous provider.
- The next send uses the snapshot's current provider/model and sends `sessionId` only for Claude or `threadId` only for Codex.

### Backend Provider Configuration

`ChatManager` currently reads active Claude Provider config only while constructing `DaemonClient`. To make provider config switching effective:

- Add a backend-side refresh path that restarts or recreates the cached daemon when the active provider config changes.
- Prefer an explicit `chat_refresh_provider_config` / `chat_restart_daemon` call after `switchProvider('claude', providerId)` succeeds, or make `chat_send` compare a provider-config signature and restart before sending.
- The signature must not include or log raw secrets. Use provider id plus non-secret URL/model metadata, or compute an internal hash that is never emitted.

The lower-risk first implementation is store-driven refresh after Provider switch:

1. `useProviderStore.switchProvider()` succeeds and reloads providers.
2. Chat integration triggers `chat_restart_daemon` only when the switched app affects Chat's current runtime provider and no command is active.
3. If a command is active, mark provider config dirty and refresh before the next send.

This avoids restarting the daemon in the middle of a turn.

## Recent Sessions Design

Data source:

- `get_dashboard_projects()` for project list and last activity.
- `list_sessions(projectPath)` for sessions within a project, already sorted by `last_active_at`.

Frontend should build a recent-session projection:

```ts
interface RecentChatProjectGroup {
    projectPath: string;
    projectName: string;
    sessions: SessionMeta[];
}
```

Rules:

- Reuse `normalizeProjectPathForCache`, `filterSupportedChatSessions`, `sessionTitle`, `getSessionProviderLabel`, `getSessionSelectionKey`.
- Keep per-project session scan caching and stale response rejection.
- Cap each project group initially, e.g. 5 sessions, with an "expand" control.
- Click session: open/focus tab and call `loadSession()` for that snapshot.
- Click project group: optional no-op or select group; avoid loading all projects' complete histories.

Backend optimization can be added later with a `list_recent_sessions(limitPerProject, projectLimit)` command if scanning all visible projects becomes slow. First version can reuse existing commands with a limited project count.

## Top Tab Design

Tabs represent opened snapshots, not every historical session.

Required tab data:

- `key`
- title from `sessionTitle(activeSession)` or draft/new chat fallback
- project folder basename
- provider icon
- status: idle/loading/running/queued/error
- close action if not running, or safe close behavior if running

UI placement:

- Top of the conversation pane, below global daemon/SDK header and above search/message list.
- Keep fixed height and horizontal overflow.
- Use icon buttons for close; use title/aria-label readable fallback.

## Compatibility

The store can preserve existing selectors during migration by exposing active snapshot fields as the current top-level fields. Components that do not need multiple snapshots can remain unchanged initially.

The most sensitive migration is `useChatStore.test.ts`: existing tests assert that `loadSession()` aborts active requests. Those tests must be intentionally replaced by new tests that assert switching snapshots preserves active requests and routes events by request id.

## Risk Points

- Global daemon abort cannot target arbitrary request ids. UI must not expose ambiguous stop controls for background sessions until targeted abort exists.
- Request id may arrive after the user switches tabs. The store must bind the returned id to the snapshot captured at send start, not the current active snapshot.
- Permission dialogs are currently global pending queues. If a background session triggers a permission prompt, the dialog should include session/workspace context and responses must keep the request `sessionId` payload intact.
- Provider config restart during active turn can terminate the request. Defer refresh until idle or before the next send.
- Recent-session scanning across many projects can be expensive. Limit first paint and avoid full-history reads.

## Rollback

The safest rollback is to keep new snapshot/tab/recent-session helpers isolated behind store actions. If event routing causes corruption, rollback to single active transcript and restore `loadSession()` abort semantics. Provider-config refresh can be rolled back independently by removing the dirty-refresh path while keeping front-end runtime provider/model switching.
