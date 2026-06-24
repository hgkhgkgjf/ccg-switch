# Implementation Plan

## Ordered Steps

- [ ] 1. Append this plan to `TODO_LIST.md` and keep implementation paused until the user approves the design.
- [ ] 2. Add focused RED tests for runtime provider/model switching during an active turn:
  - `setProvider()` / `setModel()` update next-turn config instead of silent no-op.
  - Current in-flight request keeps its captured request params.
- [ ] 3. Add focused RED tests for session switching without abort:
  - `loadSession()` with active request does not call `chat_abort`.
  - Old request stream/done events update the original snapshot, not the newly visible session.
- [ ] 4. Introduce snapshot/request ownership helpers in `useChatStore.ts` with minimal top-level compatibility:
  - active snapshot projection keeps existing fields usable.
  - request id ownership map routes stream/message/done events.
  - session load token ownership becomes snapshot-scoped where needed.
- [ ] 5. Change `loadSession()` / `startNewSession()` navigation semantics:
  - no default abort on switch.
  - create/focus snapshots.
  - keep explicit `abort()` behavior for the active running request.
- [ ] 6. Change provider/model control semantics:
  - remove active-turn silent no-op for next-turn config.
  - preserve handoff context rules.
  - keep send-time param capture stable.
- [ ] 7. Add backend provider-config refresh contract:
  - choose either deferred `chat_restart_daemon` after provider switch or send-time provider-config dirty refresh.
  - never log API keys/tokens.
  - add Rust tests for daemon restart/refresh decision where practical.
- [ ] 8. Build recent-session projection helpers and tests:
  - project grouping.
  - provider filtering.
  - sorting/capping.
  - Windows path cache normalization.
- [ ] 9. Add recent chats UI by extending the existing sidebar or extracting a shared session-list component:
  - group by project directory.
  - click opens/focuses a tab.
  - keep existing `ChatSessionSidebar` behavior intact.
- [ ] 10. Add top session tabs UI:
  - fixed-height horizontal tab strip.
  - status indicators.
  - close/focus behavior.
  - i18n keys in `en.json` and `zh.json`.
- [ ] 11. Update specs:
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/backend/cross-layer-protocol.md` if provider-config refresh touches backend command/daemon contracts.
- [ ] 12. Run focused tests, build, Rust check, and IDE build before reporting implementation complete.

## Validation Commands

```powershell
npm test -- src/stores/useChatStore.test.ts
npm test -- src/components/chat/chatSessionSidebarUtils.test.ts src/utils/chatUiBehavior.test.ts
npm test -- src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

If backend refresh logic changes `ChatManager` or `DaemonClient`, also run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml chat
```

If UI components are added, add the closest Vitest component tests and include them in the focused command list.

## Risky Files / Rollback Points

- `src/stores/useChatStore.ts`: highest risk; request routing and visible transcript ownership live here.
- `src/stores/useChatStore.test.ts`: existing abort-on-session-switch tests must be intentionally rewritten, not accidentally deleted.
- `src/pages/ChatPage.tsx`: tab strip/recent-session composition must not break diff/status/sidebar layout.
- `src/components/chat/ChatSessionSidebar.tsx`: reuse existing project/session cache rules; avoid a second divergent sidebar implementation.
- `src-tauri/src/chat/manager.rs`: provider config refresh must not restart daemon during active turn.
- `src-tauri/resources/ai-bridge/daemon.js`: avoid changing daemon serialization unless explicitly expanding scope to true parallel requests.

Rollback checkpoints:

1. Provider/model next-turn config can be reverted independently.
2. Recent sessions UI can be hidden without touching send/event routing.
3. Top tabs can be reverted to a single active snapshot if routing tests fail.
4. Backend provider-config refresh can be disabled while preserving UI switching.

## Review Gate Before Start

Implementation starts only after the user approves this plan. Then run:

```powershell
python ./.trellis/scripts/task.py start 06-24-chat-provider-live-switching-multi-session-management
```
