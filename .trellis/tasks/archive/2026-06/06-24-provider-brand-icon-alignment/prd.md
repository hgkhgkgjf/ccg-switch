# Provider brand icon alignment

## Goal

Align provider-card icons for the visible providers (`claude`, `codex`, and
`gemini`) with the brand icon treatment already used in the Chat model/session
UI, replacing the current colored first-letter circles with recognizable SVG
brand glyphs.

## Confirmed Facts

- `src/components/providers/ProviderIcon.tsx` currently renders a rounded
  colored badge containing the first letter from `APP_LABELS`.
- Provider icons are used by `ProviderCard` and `ProvidersPage`.
- `ProvidersPage` also had provider identity shown as small colored dots in
  the top config-shortcut row, the app filter selector, and the table app-type
  column; those surfaces must use the same brand glyph treatment.
- Chat UI already has reusable Claude and Codex glyphs in
  `src/components/chat/composer/ModelIcon.tsx`.
- Visible provider app types are `claude`, `codex`, and `gemini`.
- The Gemini SVG provided by the user exists at
  `C:\Users\Administrator\Pictures\419e054b-2721-46f4-a27f-d3b9dec63ff5.svg`,
  but it contains a large embedded base64 image and metadata, so the
  implementation should prefer a compact vector glyph rather than copying the
  full file into the bundle.

## Requirements

- R1. Service-provider cards and provider-page provider icons must render SVG
  brand glyphs for `claude`, `codex`, and `gemini` instead of first-letter text.
- R2. Claude and Codex provider icons must reuse the Chat UI brand glyph
  source so provider identity stays visually consistent across Chat and
  provider-management surfaces.
- R3. Gemini must render a compact vector sparkle glyph with Gemini-like
  blue/purple brand treatment, using stable SVG markup rather than the large
  embedded-image SVG file.
- R4. Legacy or hidden app types (`opencode`, `openclaw`, unknown fallback)
  must keep the existing first-letter badge behavior so unsupported providers
  do not break.
- R5. Existing `ProviderIcon` props and callers must remain compatible.
- R6. Provider filtering UI, config shortcut rows, and table app-type cells
  must use provider brand glyphs instead of colored dot markers or native
  `<option>` text-only provider choices.

## Acceptance Criteria

- [ ] `claude`, `codex`, and `gemini` provider icons render SVGs and no longer
      show `C` / `G` first-letter text.
- [ ] Claude and Codex provider icons use the same brand glyph source as the
      Chat model/session provider icons.
- [ ] Gemini provider icon renders a compact SVG glyph with a Gemini-specific
      accessible label and no copied base64 payload.
- [ ] `opencode` and `openclaw` still render the previous rounded first-letter
      fallback.
- [ ] Existing provider-card layout does not change outside the icon graphic.
- [ ] Provider filter dropdown options show provider brand icons for Claude,
      Codex, and Gemini.
- [ ] Provider config shortcut row uses provider brand icons instead of
      orange/emerald/blue dot markers.
- [ ] Provider table app-type cells use provider brand icons instead of
      `APP_COLORS` dot markers.
- [ ] Targeted provider-icon tests and `npm run build` pass.

## Out of Scope

- Changing provider data models, backend commands, provider health checks, or
  provider switching behavior.
- Replacing all app-color constants.
- Importing the full user-provided Gemini SVG file as a static asset.

## Notes

- Lightweight frontend task; PRD-only is sufficient.
