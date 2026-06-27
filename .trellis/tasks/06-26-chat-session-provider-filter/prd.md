# Chat session provider filter

## Goal

Add quick Claude / Codex provider filter buttons beside the Chat session search
input so users can switch the visible session list to one provider without
typing a query.

## Confirmed Facts

- The target UI is `ChatSessionSidebar` in the project-session mode session
  list, beside the existing session search input.
- Chat sessions currently support Claude and Codex providers through
  `isSupportedChatProvider`.
- Existing session rows already use shared provider brand icons via
  `ProviderBrandIcon` / `SessionProviderBadge`.
- The repository already contains an earlier matching Trellis task
  `.trellis/tasks/06-26-filter-sessions-by-provider/` and uncommitted code
  changes for provider filtering. These changes must be reviewed and completed
  rather than overwritten.

## Requirements

- Place two icon buttons on the right side of the session search input:
  `codex` and `claude`.
- Use the same provider brand icon style as the Chat session provider badges.
- Filtering behavior:
  - Default state is `all`; both buttons are inactive and all supported sessions
    are visible.
  - Clicking Codex shows only `providerId === 'codex'` sessions.
  - Clicking Claude shows only `providerId === 'claude'` sessions.
  - Clicking the currently active provider clears the filter back to `all`.
  - Claude and Codex filters are mutually exclusive.
- Provider filtering must compose with the existing text search. The provider
  filter should narrow the list first, then `sessionQuery` applies to the
  narrowed list.
- The provider filter is local UI state for the current sidebar session and does
  not need localStorage persistence in this task.
- Buttons must expose `aria-pressed`, readable `title` / `aria-label`, and stable
  `data-chat-session-provider-filter="codex|claude"` attributes for tests.
- User-facing labels must be present in both `src/locales/en.json` and
  `src/locales/zh.json`.

## Acceptance Criteria

- [ ] The project-session list search row shows Codex and Claude icon buttons
      beside the search input.
- [ ] Clicking Codex shows only Codex sessions and sets Codex
      `aria-pressed="true"`.
- [ ] Clicking Claude shows only Claude sessions and sets Claude
      `aria-pressed="true"`.
- [ ] Clicking the active provider again clears the filter and shows all sessions.
- [ ] Provider filtering and text search work together.
- [ ] Recent chats mode is unchanged unless a separate task explicitly expands
      provider filtering there.
- [ ] Unit tests cover the pure filter/toggle logic and component interaction.
- [ ] `npm test`, `npm run build`, and relevant diff checks pass.

## Out Of Scope

- Persisting provider filter preference.
- Adding providers beyond Claude and Codex.
- Changing backend session scanning or session metadata contracts.
- Filtering the Recent chats grouped view.
