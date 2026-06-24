# Implementation Plan

## Ordered Steps

- [ ] 1. Append the current plan to `TODO_LIST.md` without overwriting existing
  SDK task notes.
- [ ] 2. Update `services/claude/message-utils.js::emitUsageTag` to accept an
  optional `maxTokens` argument and include `max_tokens` only when valid.
- [ ] 3. Update `services/claude/stream-event-processor.js::emitUsageTag` with
  the same optional argument and payload guard.
- [ ] 4. Pass `deriveContextWindow(state.modelId)` from
  `message-sender.js` when emitting final assistant usage.
- [ ] 5. Pass `deriveContextWindow(turnState.modelId)` from
  `persistent-query-service.js` when emitting final assistant usage.
- [ ] 6. Update `utils/model-utils.js::resolveModelFromSettings` so explicit
  concrete Claude model ids are not replaced by provider family defaults.
- [ ] 7. Update `utils/model-utils.test.mjs` to remove the old expectation that
  explicit Claude family models are rewritten by `ANTHROPIC_DEFAULT_*_MODEL`,
  and add regressions for `claude-opus-4-8` and `claude-opus-4-8[1m]`.
- [ ] 8. Update sidecar stream tests to assert both accumulated and final usage
  can carry `max_tokens`.
- [ ] 9. Update frontend tests for `[USAGE] max_tokens` and the composer
  indicator fallback/1M display chain if missing.
- [ ] 10. Update `.trellis/spec/backend/cross-layer-protocol.md` with the
  usage and model-selection contract.
- [ ] 11. Run focused tests and build checks.

## Validation Commands

```powershell
node --test src-tauri/resources/ai-bridge/utils/model-utils.test.mjs
node --test src-tauri/resources/ai-bridge/services/claude/stream-event-processor.test.js
npm test -- src/stores/useChatStore.test.ts src/components/chat/composer/ChatComposer.render.test.tsx
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

If npm test uses Vitest filtering differently in this repo, use the closest
equivalent focused `npx vitest run ...` command and report the exact command.

## Risk Points

- `resolveModelFromSettings()` currently mixes provider default family mapping
  and concrete request model resolution. Tests need to make the new priority
  explicit so future provider work does not reintroduce this bug.
- Sidecar JS requires daemon/Tauri restart for manual verification.
- `cargo check` may surface unrelated pre-existing Rust issues because this
  task is primarily JS/TS. Any such failure must be separated from task changes.

## Review Gate Before Start

Start implementation only after the user approves this plan. Then run:

```powershell
python ./.trellis/scripts/task.py start 06-24-chat-usage-and-model-selection-contract
```
