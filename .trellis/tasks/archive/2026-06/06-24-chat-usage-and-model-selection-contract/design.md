# Design: Chat usage window and model selection contract

## Boundaries

This task touches the chat frontend only where it consumes `[USAGE]` and renders
the context-window ring, and touches the Claude Node sidecar where it resolves
model ids and emits usage protocol lines.

The provider management page remains the source that syncs provider defaults
into settings env values. Chat request handling must not treat those provider
defaults as higher priority than an explicit concrete Chat dropdown selection.

## Usage Event Contract

`[USAGE]` payloads are JSON objects with these existing fields:

```json
{
  "input_tokens": 0,
  "output_tokens": 0,
  "cache_creation_input_tokens": 0,
  "cache_read_input_tokens": 0
}
```

This task extends the payload with an optional positive number:

```json
{
  "max_tokens": 1000000
}
```

Rules:

- `max_tokens` is optional for compatibility.
- When present, it must be a finite positive number.
- Streaming accumulated usage and final assistant-message usage for the same
  request must use the same derivation source.
- The final assistant-message usage is authoritative for token counts, but it
  must not erase the context-window size that was already known during
  streaming.

## Context Window Derivation

The existing sidecar rule remains:

- Requested model id ending in `[1m]` means `1_000_000`.
- Any other Claude request means `200_000`.

The frontend may still use `contextWindowFor(model)` as a fallback for old
sidecar payloads or other providers, but Claude sidecar usage events should
carry the real value whenever possible.

## Model Resolution Contract

Inputs:

- `modelId`: concrete Chat request value from the frontend, for example
  `claude-opus-4-8`, `claude-opus-4-8[1m]`, or a third-party model id.
- `userEnv`: loaded settings env, including provider defaults such as
  `ANTHROPIC_DEFAULT_OPUS_MODEL`.

Priority:

1. `ANTHROPIC_MODEL` remains a global override. If configured, use it and apply
   request-owned `[1m]` suffix normalization.
2. Explicit concrete Claude request models are used as-is, except for suffix
   normalization. Provider family defaults must not replace their version.
3. Third-party/custom model ids pass through as-is unless the global override is
   set.

The important behavioral change is that `ANTHROPIC_DEFAULT_OPUS_MODEL` and
similar family defaults no longer rewrite an explicit concrete Chat dropdown
selection like `claude-opus-4-8` into `claude-opus-4-7`.

## Compatibility

Backward compatibility is maintained by:

- Keeping `max_tokens` optional.
- Keeping `emitUsageTag(msg)` callable with the old one-argument signature.
- Preserving global `ANTHROPIC_MODEL` override behavior.
- Preserving request-owned `[1m]` suffix normalization.
- Leaving non-Claude/custom model ids unmodified unless globally overridden.

## Tests

Regression tests should cover:

- `emitUsageTag(msg, 1000000)` includes `max_tokens`.
- `emitUsageTag(msg)` keeps the old payload shape.
- Stream `message_delta` and final assistant usage both include `max_tokens` in
  the persistent stream-event path.
- `resolveModelFromSettings('claude-opus-4-8', envWithOpus47)` returns
  `claude-opus-4-8`.
- `resolveModelFromSettings('claude-opus-4-8[1m]', envWithOpus47)` returns
  `claude-opus-4-8[1m]`.
- Old frontend usage payloads without `max_tokens` do not throw and preserve the
  fallback path.
- `ChatComposer` renders a 1M max value as `1000k` in the existing indicator.

## Rollback

The usage extension can be rolled back independently because old payloads are
still accepted. The model resolver change should be guarded by tests because it
changes priority semantics; rollback would restore provider family defaults
over explicit Chat selections and reintroduce the reported bug.
