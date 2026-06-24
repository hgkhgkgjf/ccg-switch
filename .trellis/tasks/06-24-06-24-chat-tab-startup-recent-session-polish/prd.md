# Chat tab startup and recent-session polish

## Goal

Fix the remaining Chat tab and recent-session UX issues reported during the
multi-session iteration, and restore the full frontend test suite by repairing
the existing StatusPanel edit-preview data flow.

## Requirements

- R1. Opening a historical chat from the initial empty Chat view must not create
  an extra `New chat` tab. Empty draft state may be discarded when switching to
  a real session.
- R2. Non-empty draft or active request state must still be preserved as an open
  tab when switching away, so user text and background streaming work are not
  lost.
- R3. Conversation tabs should have a comfortable maximum width and should not
  fill the entire strip when only one or two tabs are open. Tabs should shrink
  only when the strip no longer has enough room, while remaining single-row and
  without scrollbars.
- R4. Recent chats must only include sessions whose latest activity is within
  the last seven days. Sessions older than seven days must be excluded from the
  Recent chats mode.
- R5. StatusPanel edit tree rows must render hover diff previews when preview
  lines are present in either the visible recent-edit entry or the matching
  all-edit entry. Rows without preview lines must not receive tooltip
  associations.

## Acceptance Criteria

- [ ] First click on a historical session from the startup/empty Chat state opens
      only that session tab, not an additional `New chat` tab.
- [ ] Switching away from a tab with draft text, messages, session id, or an
      active request still preserves that tab.
- [ ] One or two tabs render at bounded width; many tabs remain a fixed-height
      single row and compress without horizontal scroll chrome.
- [ ] Recent chats excludes sessions older than seven days and keeps sessions
      within seven days.
- [ ] `StatusPanel.test.tsx` edit-preview tests pass, including split preview
      and `aria-describedby` association.
- [ ] Targeted tests, `npm run build`, and `cargo check --manifest-path
      src-tauri/Cargo.toml` pass.

## Constraints

- Keep changes minimal and localized to Chat frontend state/components/utilities
  plus tests/spec notes.
- Do not abort background chat requests when closing or switching tabs.
- Do not change backend session listing contracts for this task.
- Preserve Windows-safe path handling and existing i18n fallback behavior.
