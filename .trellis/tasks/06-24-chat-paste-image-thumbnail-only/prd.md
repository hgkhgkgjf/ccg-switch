# 修复截图粘贴不进入输入框

## Goal

When a user pastes a screenshot or image into the chat composer, the image
should be attached and shown in the existing thumbnail area only. The composer
text input must not render or insert the pasted image itself.

## Requirements

- Pasted clipboard images are handled by the existing attachment / thumbnail
  flow.
- The text input prevents the browser or editor default behavior that inserts a
  pasted image into the editable content.
- Plain text paste behavior remains unchanged.
- If a paste payload includes image data plus text, image data must not be
  duplicated into the input content; any supported text handling should remain
  consistent with existing composer behavior.
- Keep the change scoped to the chat composer paste path unless investigation
  proves the root cause is in a shared attachment helper.

## Acceptance Criteria

- [x] Pasting a screenshot shows the image only as a thumbnail attachment.
- [x] The composer text area/contenteditable body does not display the pasted
      image, image data URL, or generated image markup.
- [x] Pasting ordinary text still inserts text normally.
- [x] `npm run build` passes.

## Notes

- Lightweight PRD-only task. No backend behavior or data migration is expected.
