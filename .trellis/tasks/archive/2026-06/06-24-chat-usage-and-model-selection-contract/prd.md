# Chat usage window and model selection contract

## Goal

Fix two cross-layer chat regressions that share the same boundary: the frontend
sends a concrete Claude model selection, the Node sidecar resolves the SDK
request, and usage events drive the frontend context-window ring.

The desired result is:

- Final authoritative `[USAGE]` events include the effective context window
  (`max_tokens`) so the UI does not fall back to a stale 200K default after a
  streaming intermediate value already reported 1M.
- A concrete model selected in the Chat dropdown, such as
  `claude-opus-4-8` or `claude-opus-4-8[1m]`, is not silently replaced by the
  active provider family default, such as
  `ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-7`.

## Confirmed Facts

- `useChatStore.ts` already stores `contextMaxTokens` when a `[USAGE]` payload
  contains a positive numeric `max_tokens`.
- `ChatComposer.tsx` already consumes `contextMaxTokens` before falling back to
  `contextWindowFor(model)`.
- `usage-utils.js` already has `deriveContextWindow(modelId)` and
  `emitAccumulatedUsage(accumulated, maxTokens)`.
- Streaming `message_delta` paths in `message-sender.js` and
  `stream-event-processor.js` already pass `deriveContextWindow(...)` to
  `emitAccumulatedUsage(...)`.
- The final authoritative usage emitters still omit `max_tokens`:
  `services/claude/message-utils.js::emitUsageTag` and
  `services/claude/stream-event-processor.js::emitUsageTag`.
- `resolveModelFromSettings(modelId, userEnv)` currently maps Claude family
  model ids through `ANTHROPIC_DEFAULT_*_MODEL`; the existing test suite encodes
  this behavior for explicit Claude models.

## Requirements

- R1. Final `[USAGE]` tags emitted from assistant messages must optionally carry
  `max_tokens` using the same positive-number guard as accumulated streaming
  usage events.
- R2. The final usage emitters must remain backward compatible. If callers do
  not pass a max-token value, output must remain unchanged.
- R3. All streaming and persistent Claude paths must pass the effective context
  window to their final usage emitters using the request's model id.
- R4. `resolveModelFromSettings()` must treat explicit concrete Claude model
  versions as intentional user choices and return that requested model, while
  preserving or stripping the `[1m]` suffix according to the request.
- R5. Global `ANTHROPIC_MODEL` remains an explicit override and may still
  replace the requested model.
- R6. Third-party/custom provider model ids that are already concrete model
  names must continue to pass through unchanged unless the global override is
  set.
- R7. Existing 1M context behavior remains request-owned: `[1m]` on the request
  means 1,000,000; no suffix means 200,000.
- R8. Document the cross-layer contract in
  `.trellis/spec/backend/cross-layer-protocol.md`.

## Acceptance Criteria

- [ ] A final assistant `[USAGE]` payload can include
  `input_tokens`, `output_tokens`, cache token fields, and `max_tokens`.
- [ ] Streaming accumulated and final authoritative `[USAGE]` payloads report
  the same `max_tokens` for the same request.
- [ ] Old usage payloads without `max_tokens` remain accepted by the frontend
  without errors.
- [ ] Selecting `claude-opus-4-8` in Chat does not resolve to
  `claude-opus-4-7` solely because the active provider's Opus default is
  `claude-opus-4-7`.
- [ ] Selecting `claude-opus-4-8[1m]` keeps the explicit version and the `[1m]`
  suffix.
- [ ] The model resolver tests distinguish explicit Claude model selection from
  global override behavior and third-party model passthrough.
- [ ] Focused Node and Vitest tests pass.
- [ ] `npm run build` passes.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes or any pre-
  existing failure is clearly reported.

## Out Of Scope

- No changes to the provider management page layout.
- No changes to provider sync/save behavior in Rust.
- No changes to the completion dropdown UI line already implemented in the
  earlier task.
- No change to the current context-window rule: `[1m]` means 1M, otherwise
  Claude uses 200K.

## Notes

- Sidecar JavaScript changes require restarting the Tauri dev app or daemon;
  Vite HMR alone will not reload the Node sidecar.
- This is a complex Trellis task: `design.md` and `implement.md` are required
  before `task.py start`.
