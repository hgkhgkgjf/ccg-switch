# Fix chat edit diff hover preview opacity

## Goal

Fix transparent or unreadable edit diff hover previews in the chat area and correct related CSS block structure.

## User Value

When users hover over edited-file rows in the chat area, the diff preview must render as a readable opaque surface instead of blending into the chat text behind it.

## Confirmed Facts

- The reported failure is in the chat edited-file hover preview.
- The screenshot shows the preview content overlaying underlying chat text, making the diff unreadable.
- The user-provided patch target points to `src/styles/toolBlocks.css` and a suspicious extra closing brace near the dark-theme `.edit-diff-hover-preview-status` block.
- This is a frontend CSS-only bug unless inspection shows the class names are not applied.

## Requirements

- Correct the malformed CSS block structure around edit diff hover preview styles.
- Ensure the status edit diff hover preview has an opaque, high-contrast background in normal, dark, and custom themes.
- Use theme-adaptive DaisyUI CSS variables for the hover preview surface, text, borders, and diff row colors; do not hardcode a permanent dark preview.
- Keep the change scoped to `src/styles/toolBlocks.css` unless class application is proven incorrect.
- Preserve existing preview sizing and line wrapping behavior.
- For ordinary transcript edit hover previews that are scrollable, keep the preview shell connected to the trigger hit area so users can move the pointer into the preview and scroll it.

## Acceptance Criteria

- [x] `src/styles/toolBlocks.css` has balanced CSS block structure around `.edit-diff-hover-preview-status` and `.edit-diff-hover-preview-readable`.
- [x] The status edit diff hover preview no longer renders transparent over chat text.
- [x] Status edit diff preview remains opaque and readable while adapting to light, dark, and custom themes.
- [x] Ordinary transcript edit hover previews can be entered from the trigger row without dropping hover state before scroll interaction.
- [x] Frontend build passes.
- [x] CSS diff check passes without whitespace errors.

## Out of Scope

- Reworking hover preview positioning beyond the minimal transcript hover hit-area bridge.
- Replacing the hover preview component.
- Changing unrelated tool block styles.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.

## Verification

- `npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx` passed with 1 file and 7 tests.
- `npm test -- src/components/toolBlocks/EditToolBlock.test.tsx src/components/toolBlocks/EditToolGroupBlock.test.tsx src/components/toolBlocks/EditDiffPreview.test.tsx` passed with 3 files and 22 tests.
- `npm run build` passed.
- Theme-adaptive correction: hover preview shell, header, body, diff rows, split cells, and hidden-line badge now use DaisyUI theme variables with `--fallback-*` compatibility chains instead of hardcoded dark colors.
- Browser computed-style validation passed on a temporary local page: light and dark theme preview shell/header/body/context/removed/added rows all reported non-transparent background colors and `opacity: 1`.
- Chat surface adjustment: the main chat workspace is pure white in light theme and uses the same `base-100` surface as the sidebar in dark theme, avoiding the previous gray wash and the rejected pure-black background.
- Browser computed-style validation passed on a temporary local page: light chat workspace/review surface reported `rgb(255, 255, 255)`, and dark chat workspace/review/sidebar probe all reported `rgb(31, 41, 55)`.
- User image thumbnail adjustment: user-message `image` / `input_image` blocks now render through `imageDisplay="user-thumbnail"` as a compact right-aligned thumbnail strip when consecutive uploads are adjacent. The thumbnails use fixed-size frames in the transcript and preserve the existing click-to-preview lightbox for full-size inspection.
- `npm test -- src/components/chat/ContentBlockRenderer.test.tsx` passed with 1 file and 13 tests after adding coverage for grouped user-uploaded thumbnails.
- `npm run build` passed after the user image thumbnail adjustment.
- `git diff --check -- src/components/chat/ContentBlockRenderer.tsx src/components/chat/ContentBlockRenderer.test.tsx src/App.css .trellis/spec/frontend/component-guidelines.md .trellis/tasks/06-22-chat-edit-diff-hover-opacity/prd.md TODO_LIST.md` passed with only Windows LF/CRLF conversion warnings.
- IDE `build_project` passed with no problems.
- `git diff --check -- src/styles/toolBlocks.css .trellis/tasks/06-22-chat-edit-diff-hover-opacity/prd.md` passed with only Windows LF/CRLF conversion warnings.
- `npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx src/components/chat/StatusPanel.test.tsx` still has 3 existing `StatusPanel.test.tsx` failures because the current `StatusPanel` SSR output does not render hover preview markup expected by those tests. This is outside the CSS-only scope of this task.
- Regression fix 2026-06-23: transcript edit hover previews no longer inherit transparency from `.tool-title-summary` / assistant-flow parent `opacity`; muted summary chrome now uses theme-token color alpha so the nested hover preview can remain fully opaque.
- Regression fix 2026-06-23: ordinary transcript edit hover previews now render the full available `diffPreviewLines` by default inside a viewport-capped scrollable body. Status-panel hover previews remain capped at 24 lines with the hidden-line clue in the header.
- Regression fix 2026-06-23: scrollable ordinary transcript edit hover previews now sit directly against the trigger edge (`bottom: 100%`) so the pointer can move into the preview without crossing an unhoverable gap; status-panel hover preview spacing is unchanged.
- RED/GREEN verification 2026-06-23: `npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx` first failed on the missing `bottom: 100%` scrollable hover rule, then passed with 1 file and 9 tests after the CSS fix.
- Related verification 2026-06-23: `npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx src/components/toolBlocks/EditToolBlock.test.tsx src/components/toolBlocks/EditToolGroupBlock.test.tsx` passed with 3 files and 25 tests.
- RED/GREEN verification 2026-06-23: `npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx src/components/toolBlocks/EditToolBlock.test.tsx src/components/toolBlocks/EditToolGroupBlock.test.tsx` passed after first failing on the old 16-line transcript hover cap and missing scrollable CSS rule.
- Build verification 2026-06-23: `npm run build` passed; IDE `build_project` passed with `problems: []`; `git diff --check -- src/styles/toolBlocks.css src/components/toolBlocks/EditDiffPreview.test.tsx .trellis/spec/frontend/component-guidelines.md .trellis/tasks/06-22-chat-edit-diff-hover-opacity/prd.md TODO_LIST.md` passed with only Windows LF/CRLF conversion warnings.
- Build verification 2026-06-23: `npm run build` passed; IDE `build_project` passed with `problems: []`; `git diff --check -- src/components/toolBlocks/EditDiffPreview.tsx src/components/toolBlocks/EditDiffPreview.test.tsx src/components/toolBlocks/EditToolBlock.test.tsx src/styles/toolBlocks.css .trellis/spec/frontend/component-guidelines.md TODO_LIST.md .trellis/tasks/06-22-chat-edit-diff-hover-opacity/prd.md` passed with only Windows LF/CRLF conversion warnings.
