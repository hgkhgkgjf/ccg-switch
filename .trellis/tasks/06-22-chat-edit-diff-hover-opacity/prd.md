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
- Preserve existing preview sizing, positioning, and line wrapping behavior.

## Acceptance Criteria

- [x] `src/styles/toolBlocks.css` has balanced CSS block structure around `.edit-diff-hover-preview-status` and `.edit-diff-hover-preview-readable`.
- [x] The status edit diff hover preview no longer renders transparent over chat text.
- [x] Status edit diff preview remains opaque and readable while adapting to light, dark, and custom themes.
- [x] Frontend build passes.
- [x] CSS diff check passes without whitespace errors.

## Out of Scope

- Reworking hover preview positioning.
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
- IDE `build_project` passed with no problems.
- `git diff --check -- src/styles/toolBlocks.css .trellis/tasks/06-22-chat-edit-diff-hover-opacity/prd.md` passed with only Windows LF/CRLF conversion warnings.
- `npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx src/components/chat/StatusPanel.test.tsx` still has 3 existing `StatusPanel.test.tsx` failures because the current `StatusPanel` SSR output does not render hover preview markup expected by those tests. This is outside the CSS-only scope of this task.
