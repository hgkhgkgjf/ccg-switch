# Component Guidelines

> How components are built in this project.

---

## Overview

Components are **function components** with TypeScript. There are no class
components. Props are typed with a local `interface` named `<Component>Props`.
Components are kept presentational where practical: page components own state
and pass data + callbacks down to feature components.

---

## Component Structure

Standard order within a component file:

1. Imports — lucide icons first is common, then React hooks, then Tauri APIs,
   then local types/components.
2. Exported `type`/`interface` the component needs to share (e.g. `ModalType`).
3. The `<Component>Props` interface.
4. Small module-scope pure helpers if needed (e.g. `maskApiKey`).
5. The component function with destructured props.
6. `export default` (most components) — required for any component used with
   `React.lazy` in `App.tsx`.

```tsx
interface ProviderCardProps {
    provider: Provider;
    isDragging?: boolean;
    onSwitch: (id: string) => void;
    onEdit: (provider: Provider) => void;
    onDelete: (id: string, name: string) => void;
    healthStatus?: HealthStatus;
}

export default function ProviderCard({
    provider,
    isDragging,
    onSwitch,
    onEdit,
    onDelete,
    healthStatus,
}: ProviderCardProps) {
    const { t } = useTranslation();
    const [showKey, setShowKey] = useState(false);
    return ( /* ... */ );
}
```

See `src/components/providers/ProviderCard.tsx` and
`src/components/common/ModalDialog.tsx` for the canonical shape.

---

## Props Conventions

- Define props with a local `interface` named `<Component>Props`. Do not inline
  the type in the function signature for non-trivial components.
- Optional props use `?` and are given defaults via destructuring
  (`type = 'confirm'`, `isDestructive = false`).
- Event callbacks are named `onXxx` and typed explicitly
  (`onSwitch: (id: string) => void`).
- Children/content slots use `children?: React.ReactNode`.
- Pass primitives and callbacks down; let the parent (usually a page) own the
  data fetching and mutation. Pages call the store, components receive results.

---

## Styling Patterns

- **TailwindCSS 3 + DaisyUI 4.** Styles are utility classes in `className`.
  There are no CSS modules or styled-components; only `App.css`/`index` global
  styles exist.
- DaisyUI component classes are used heavily: `btn`, `btn-ghost`, `btn-sm`,
  `badge`, `modal`, `input input-bordered`, `select`, `table`, `loading`.
- **Dark mode** is expressed inline with `dark:` variants and DaisyUI semantic
  tokens (`base-100`, `base-200`, `base-content`). Always pair light styles with
  a dark counterpart, e.g.
  `bg-white dark:bg-base-100 border border-gray-100 dark:border-base-200`.
- Recurring visual patterns (keep consistent with existing code):
  - Card: `bg-white dark:bg-base-100 rounded-xl shadow-sm border border-gray-100 dark:border-base-200`
  - Primary action button: gradient, e.g.
    `bg-gradient-to-r from-blue-500 to-purple-500 ... text-white border-none btn-sm`
  - Active/selected state: green ring/border accents.
- Master/detail sidebars must keep the detail region visible. Use separate
  `min-h-0` flex children with independent `overflow-y-auto` panes instead of
  putting both the master list and detail list in one long scroll container.
  Example: project list `basis-2/5 overflow-y-auto`, session list
  `flex-1 overflow-y-auto`.
- Chat session sidebars must use normalized Windows-safe cache keys for project
  paths. Cache `list_sessions(projectPath)` results by both the selected project
  path and each returned session's `projectDir` alias so later `currentCwd`
  updates do not re-scan the same history list just because slash, casing, or
  trailing separator forms changed. Do not cache or display sessions whose
  explicit `projectDir` normalizes to a different project path; stale provider
  scan results must not poison another project's cache key and make the sidebar
  appear unchanged after a project switch. The rendered session list must track
  the project path that produced it, so old-project rows are hidden immediately
  if the user switches projects while another scan or cache update is still
  settling. Cache hits count as a new ownership decision: increment or otherwise
  invalidate the previous session-list request before rendering cached rows, and
  accept async `list_sessions(projectPath)` responses only when both the request
  sequence and the currently selected normalized project key still match.
  Repeated clicks on the pending session should short-circuit before resetting
  transcript navigation. Repeated clicks on the active session should
  short-circuit only when no different session load is pending; if another
  session is pending, reselecting the active session is a valid user intent to
  cancel/override the pending selection. Keep this decision in a shared helper
  used by both the sidebar and `ChatPage`, otherwise the sidebar can allow the
  click while the page silently drops it.
  If a `list_sessions(projectPath)` request is already in flight for the
  normalized project path, do not start another scan unless the user explicitly
  forces a refresh. Forced refreshes should keep the existing session list
  visible and show a lightweight refresh status row instead of replacing the
  detail pane with a full spinner; otherwise users cannot tell whether they are
  seeing stale results or an in-progress reload.
- Tool block list renderers must group by the visible items users need to scan,
  not only by raw `tool_use` count. Edit tools must expand `MultiEdit` /
  `edit_file` `input.edits[]` and `apply_patch` patch hunks into file rows; if
  the resulting edit item count is 2+, render `EditToolGroupBlock` so the file
  list stays visible in live and historical sessions.
- Tool blocks should render as compact operation rows, not large text cards.
  Headers should expose the operation type, the primary target, and status in a
  single scan line. Command tools use `summarizeCommand()` chips such as
  `Build`, `Test`, `Git`, `Search`, `Read`, `Patch`, and `Run`; search tools use
  `SearchToolGroupBlock` even for a single search so the query and first matched
  file remain visible. Search result text that includes `path:line[:column]`
  rows should be normalized through shared presentation helpers and rendered as
  compact clickable file rows, passing `currentCwd` to `openFile(...)` just like
  Read/Edit tools. Read/Edit/Generic file targets must pass
  `currentCwd` to `openFile(path, start, end, currentCwd)` and stop click
  propagation for file links and action buttons so opening/copying does not also
  collapse the block. Prefer lucide icons for structural tool icons and
  expansion chevrons; do not introduce emoji icons in new tool-block UI. On
  narrow screens, keep a truncated primary summary visible and hide only
  secondary badges/statistics.
  `openFile()` path normalization should decode valid percent-encoded hrefs
  while preserving legal literal percent signs in normal filesystem paths
  (for example `100% coverage.md`). A malformed encoded path should not block a
  plain literal percent filename from reaching the Tauri editor command, but
  control characters must still be rejected before invoking the backend.
- Status-panel edit history should not be a flat pile of rows when the file
  count grows. Render touched files as a tree with folder-level collapse /
  expand controls, keep the tree body inside its own scrollable pane, and show
  the summary counts in the same scan line as the file row. Large edit trees
  should default to collapsed folder rows while small edit sets can stay
  expanded for immediate inspection; once the user manually expands/collapses
  folders, preserve that choice during subsequent transcript updates. Diff
  hover previews used from this panel should be solid, high-contrast surfaces
  that can sit outside the scroll pane without being clipped. When a
  split/unified diff view toggle is added, keep it compact and icon-driven so it
  reads like a control, not a second card. The Chat page layout should keep all
  visible desktop panes resizable: when the central diff pane is open, expose
  conversation-diff and diff-status resize handles; when the diff pane is
  collapsed or absent, expose a conversation-status handle so the fixed right
  sidebar can give space back to the transcript. Width clamping belongs in
  shared UI behavior helpers and must be unit-tested rather than hand-coded only
  inside `ChatPage`. Collapsing the diff pane must also leave an explicit reopen
  affordance on the right side of the status-panel edit header whenever the
  loaded transcript window has any edit record; do not rely on a selected edit
  key or clicking a file row as the hidden way to restore the central diff pane.
  Because the status panel is hidden below the desktop `xl` breakpoint and can
  be visually missed even on wide screens, `ChatPage` must also expose a
  page-level right-edge restore control whenever the diff pane is collapsed and
  there is a selected edit to reopen. This global control should float over the
  review layout instead of reserving a diff column, preserving the "collapsed
  means no central space used" contract.
  The full central diff
  pane should default to wrapped code lines so narrow three-pane layouts remain
  readable without constant horizontal scrolling, while still exposing a compact
  no-wrap toggle for exact long-line review. The wrap/no-wrap preference belongs
  to `ChatPage` state, not local pane state, so collapsing and remounting the
  central diff pane preserves the user's review mode. The central diff pane
  should expose the same low-friction file operations users expect from
  Read/Edit tool rows: at minimum Open File and Copy Path. Keep these controls
  icon-sized and reuse existing bridge helpers/i18n keys instead of adding a
  second command style.
- Chat daemon lifecycle status must be rendered as a recoverable state, not only
  a raw diagnostic string. Use shared helpers such as
  `getChatDaemonStatusKind()` and `canReconnectChatDaemon()` so the header and
  `StatusPanel` agree on `ready` / `starting` / `offline` / `error`. When the
  daemon is offline or failed, expose a compact reconnect action in both the
  top header and the right status panel if the panel is visible; keep it
  icon-first, low-noise, and disabled/spinning while `daemonReconnecting` is
  true. Surface a compact sanitized diagnostic from the store `error` or the
  meaningful daemon status text next to the recovery action, and reuse the same
  diagnostic as the top-header tooltip. If the store uses a known i18n key for a
  frontend-generated daemon diagnostic, translate it at the rendering boundary;
  backend/raw errors remain literal diagnostic strings. Do not label `shutdown`
  as `Starting...`, because that hides the recovery path after daemon stdout
  closes.
- Chat status panels should expose basic runtime readiness before the user sends
  a prompt. Provider, selected model, permission mode, reasoning effort,
  workspace path, SDK installation state, daemon state, and MCP
  configuration availability belong in the same compact status surface. Runtime
  context rows are display-only: they should consume existing `useChatStore` /
  `useSdkStore` state passed through `ChatPage`, not trigger model refreshes,
  SDK installs, or backend checks while rendering the panel. Render runtime
  context as a compact tile grid in the right `StatusPanel` rather than a tall
  vertical key/value list; keep full values in `title` attributes so truncated
  model ids and Windows workspace paths remain inspectable. Pending and failed
  tool counts belong in the `currentActivity` card header as compact pills when
  non-zero; do not duplicate those counts as standalone rows in the top status
  grid. The `currentActivity` card itself is trigger-based: render it only when
  an active tool exists, a reply is streaming, pending/failed tool counts are
  non-zero, or the loaded status summary has recent non-agent tool history to
  inspect. On desktop, this card is the primary task-list surface because the
  composer tasks tab is only a small-screen fallback; show a compact recent task
  list from `statusSummary.toolTimeline` excluding `agent` tools, keep the active
  tool as the primary row, and show a hidden-count row when older tasks are
  clipped. Subagent / Task activity should be shown as a separate compact list
  from `statusSummary.agentTools` inside the same card, not mixed into the normal
  task list and not hidden solely behind the composer subagents tab. Keep the
  active tool as the primary row so a currently running subagent is not repeated
  immediately below itself. When these activity lists are present, keep them in
  an internal scroll region with a local height cap so dense task history does
  not push recent edits, MCP, or runtime diagnostics out of the right pane. The
  scroll region itself must be keyboard-focusable and exposed as a named
  `region`, so users can focus the activity history and scroll the task /
  subagent list without first tabbing through every row.
  Recent task and subagent rows must also be real
  desktop navigation targets:
  clicking or keyboard-activating a row should jump to the corresponding
  transcript tool block instead of duplicating full tool details inside the
  right pane. These jump rows must use accurate accessible labels: subagent
  activity should not be announced as a generic tool task. Message-flow tool
  renderers must expose stable
  `data-chat-tool-id` anchors for single tools and `data-chat-tool-ids` anchors
  for grouped tools so status surfaces can locate the existing transcript block.
  After a status-panel jump, apply only a short-lived highlight to the target
  transcript anchor so users can confirm where they landed; do not turn the
  transcript row into a persistent selected state or duplicate the tool details
  in the status panel.
  Do not keep a full idle card in steady state just to say the chat is
  idle. The recent-edits card is also trigger-based: render it only when there
  are touched files, edit summaries, or a collapsed diff pane can be reopened.
  Do not keep a full card just to say there are no edits. MCP availability
  shown in Chat is a configuration summary for the active provider, derived from
  `useMcpStoreV2` and `buildChatMcpAvailabilitySummary()`: total configured
  servers, servers enabled for the current provider, loading state, and loading
  errors. The summary row must be expandable so users can inspect each
  configured server's name, transport/config type, and enabled/disabled state
  for the active provider without leaving Chat. Implement this expansion as an
  explicit controlled button with `aria-expanded` and conditional detail
  rendering, not as a native `<details>` disclosure, so the click target and
  rendered detail state stay testable and reliable inside the fixed status
  panel. Do not present this as a live
  connectivity check unless the UI is
  explicitly wired to `check_mcp_status`; live checks may spawn stdio MCP
  commands and should be user-triggered or otherwise carefully bounded. When a
  manual live check is exposed, keep it inside the MCP details surface, check
  only servers enabled for the active provider, and render the returned
  `online` / `offline` / `timeout` / `error` / `unknown` plus latency as a
  secondary signal next to the configuration enabled/disabled pill.
- Chat model selectors should follow cc-gui's compact icon + label pattern.
  The selector trigger and each option should render the same provider/vendor
  brand glyph set used by the provider selector via `ModelIcon`, not decorative
  capability icons such as Sparkles/Gem/Feather or a generic Terminal icon.
  Claude/Anthropic models use the Claude LobeHub glyph; Codex/OpenAI/GPT models
  use the shared Codex/OpenAI glyph. Keep `data-chat-model-icon` as the stable
  model-family semantic kind (for example `claude-sonnet` or `codex-codex`) and
  expose the actual rendered glyph through `data-chat-model-icon-glyph` so tests
  can guard both the model family and the vendor glyph. `ButtonArea` must receive
  a `models` prop from its parent and use the
  hardcoded built-in arrays only as a local fallback; do not make toolbar
  components fetch provider data or read provider stores directly. Keep the
  selected model visible even when it came from a loaded session or custom
  config that is not in the current dynamic list. `ModelIcon` and
  `SelectorDropdown` must wrap trigger, option, and checkmark icons in fixed
  icon boxes instead of tuning one-off SVG margins; the shared wrapper class is
  `selector-dropdown-icon-box` with trigger/option/check variants. Model-family
  glyphs have different intrinsic bounds and otherwise drift out of alignment in
  the compact toolbar.
- Chat provider selectors should follow cc-gui's compact provider icon pattern.
  The provider switch trigger should be icon-only with a tooltip, while dropdown
  options keep the provider label plus the same provider-specific icon. Claude
  Code and Codex must render distinct provider icons; do not use one generic
  `Terminal` icon for every provider. The Claude icon should match the
  `@lobehub/icons` Claude glyph used by cc-gui, not a generic starburst or
  other placeholder path. This is a presentational contract only: provider
  switching state remains owned by `useChatStore` and `ButtonArea` should
  receive it through props.
- `ContentBlockRenderer.compact` must be propagated to every tool surface,
  including single tool blocks, grouped Bash/Read/Edit/Search blocks, and
  Agent/Task blocks. Compact mode should be a component contract, not only a
  CSS side effect of `.assistant-message-flow`; otherwise subagent history and
  nested historical transcripts drift back into large card-style groups. A
  compact tool block still renders a one-line operation header and stays
  collapsed by default; do not render full parameters/results immediately in
  compact mode, or historical sessions become a stack of expanded output panes.
  Grouped compact tool blocks must also collapse the group body by default:
  render only the group header/summary row first, then reveal child rows and
  bulk expand/collapse actions only after the group header is explicitly
  expanded. The renderer root should expose stable spacing classes such as
  `chat-content-blocks` and `chat-content-blocks-compact`; compact mode may be
  dense, but it must still leave enough gap between adjacent text, thinking,
  image, and tool rows so historical assistant output does not collapse into an
  unreadable clump.
- Generic tool result display must normalize MCP text-block wrappers before
  rendering. Decode arrays or wrapper objects such as `{ content: [{ type:
  "text", text: "..." }] }`, and restore literal escaped newlines in codegraph
  output before handing the text to a `<pre>`. Do this in shared presentation
  helpers, not inside individual tool components.
- Agent-like tool blocks (`AgentGroupBlock`, `TaskExecutionBlock`) must share
  their transcript-summary shaping through `extractAgentToolMeta()`,
  `summarizeAgentToolMeta()`, `summarizeAgentToolHeader()`, and
  `getAgentToolExtraParams()` in `src/utils/toolPresentation.ts`. Do not
  hand-roll separate header-summary or input-filter logic per component, or the
  assistant flow will drift back into inconsistent chips/badges between
  `agent`, `task`, and `spawn_agent`.
- Subagent execution summaries should keep display text and interaction targets
  separate. If a process card shows compact file paths such as `…/src/foo.ts`,
  the backing model must still preserve the real `openPath` used by
  `openFile(path, start, end, currentCwd)`; do not try to reconstruct the path
  later from the truncated label. Pure summary presentation (for example
  `SubagentProcessSummary`) should stay decoupled from the async history-loading
  wrapper so the interaction layer can be regression-tested without depending on
  `useEffect` timing.
- Subagent execution summaries should keep the "other tools" section as a compact
  operation log rather than a generic badge pile. Reuse shared tool-summary
  helpers such as `summarizeCommand()` and the existing search/read/list/web
  semantics to classify the row, but keep the transcript-level interaction
  targets and the visual label separate. The summary row should remain
  scan-friendly and low contrast inside assistant flow, with file/open
  affordances still pointing at the preserved `openPath`.
- Chat transcript layout follows cc-gui's document-flow model: user messages may
  use a right-aligned compact bubble, but assistant messages must not be wrapped
  in a full card/bubble per response. Assistant text, thinking blocks and
  tool-use events should share one transparent flow container, with copy/meta
  affordances kept subtle. When rendering Markdown inside user bubbles, cap
  heading sizes so pasted prompts such as `# AGENTS.md` remain prompt text
  instead of becoming hero-scale typography. In assistant flow, tool blocks
  should use low-contrast operation-row styling (for example a subtle rail and
  one-line summary) rather than visually competing with the answer body.
- Large historical transcripts must not force the first Chat render to derive
  anchors, status summaries, search text, or tool-result lookups from the full
  `messages` array. In normal browsing mode, use the shared recent-window helper
  from `chatNavigation` to render only the visible tail plus any explicitly
  revealed earlier page, preserving each item's `originalIndex` for stable
  anchor behavior. Search is the explicit full-history mode and may scan all
  renderable messages, but only after `ChatPage` has triggered
  `useChatStore.loadActiveSessionFullHistory()` for a `windowed` session and
  received a complete search source. Normal-browsing status summaries should be
  built from the raw message slice that starts at the visible window's first
  original index so hidden `tool_result` records for visible tools remain
  available without summarizing unrelated older turns. Search-mode status
  summaries must not receive the complete search source again after filtering;
  derive them from a bounded context around matched renderable messages so
  matching tool results stay available without a second full-history scan. Tool
  result lookup should be pre-indexed for the
  visible/tail window at the list level instead of scanning the full transcript
  once per rendered tool block. Store-level history caches may keep complete
  mapped transcripts, but repeated session loads must still pass only the
  recent display window into `messages`; do not treat a cache hit as permission
  to hydrate React with the full transcript. Component code must continue
  treating `messages` as immutable data so cached message references cannot be
  invalidated by accidental in-place changes. First-paint history windowing is
  a store/backend contract: components should render the loaded `messages`
  window they receive and should not issue their own full-history command to
  compensate for a partial first paint. Partial large histories are a completed
  normal-browsing state: `useChatStore` reports them as `windowed` and must not
  automatically issue `get_unified_session_messages()` for cache/diagnostics.
  Full-history reads must be tied to an explicit search/reveal intent with its
  own paging or indexing boundary; the current search path uses the complete
  history as a temporary `MessageList` search source without replacing the
  normal visible `messages` window. While a `windowed` session search is
  loading its complete history, the transcript search summary must say that
  complete history is still being searched instead of presenting current-window
  matches as final. If that explicit full-history search fails, keep the loaded
  window searchable and expose a compact retry affordance owned by `ChatPage`;
  `MessageList` should receive this as display props and must not invoke the
  store directly. The right `StatusPanel` may show
  the latest session-load performance snapshot from `useChatStore`, including
  cache hits, first-paint window counts, windowed status, map times, and total
  elapsed time. This is diagnostic display only: rendering the panel must not
  trigger another history read, remote check, or cache mutation. Keep completed
  or windowed session-load metrics collapsed behind an explicit diagnostic
  toggle so normal status scanning stays compact; automatically expand the
  metrics only while a load is still running or when an error must remain
  visible.
- Chat composer completion menus own Enter/Tab while open, including the loading
  state before items arrive. A user typing `/`, `@path`, or `#agent` should not
  accidentally send the half-completed token just because the async completion
  query has not returned yet. Keep the keyboard-consumption decision in a shared
  helper so `/`, `@`, `#`, and `!` triggers follow the same behavior. If
  `useChatStore.send()` reports failure before a backend request id exists,
  `ChatComposer` should restore the local attachments it cleared for optimistic
  sending, merging them with any attachments the user added while the send was
  pending and avoiding duplicates. Restore draft text only when the current
  store draft is still empty so a user-typed replacement is not overwritten.
  `ChatComposer` must also hold a local pre-request submit guard before
  `activeRequestId` is available. `useChatStore.send()` sets `activeRequestId`
  only after `chat_send` returns a backend request id, so double-clicking the
  send button or pressing Enter twice in that gap can otherwise send the same
  draft twice. Represent this state separately from streaming: while waiting
  for the request id, disable send/enhance/selectors and show a disabled sending
  affordance, not the Stop button, because `chat_abort` cannot target a request
  id that does not exist yet. Prompt enhancement needs the same immediate
  ref-level guard in addition to rendered `enhancing` state: double-clicking the
  Sparkles button before React commits the loading state must not issue multiple
  `chat_enhance_prompt` invokes for the same prompt. On enhancement failure,
  keep the original draft intact and close the comparison dialog so users do not
  mistake an empty enhanced result for a valid rewrite. Once the enhanced prompt
  is available, the comparison dialog should support `Enter` to use the enhanced
  prompt and `Escape` to close, matching cc-gui's keyboard-speed path. Route
  these through a pure helper and do not steal `Enter` from focused buttons or
  editable controls, otherwise a focused footer button can invoke both native
  click behavior and the global shortcut.
- Plan approval dialogs should support the same keyboard-speed path as cc-gui:
  `Enter` approves the default execution mode and `Escape` denies/cancels the
  plan. Keep shortcut routing in a pure helper so it is testable without a DOM
  renderer. Do not steal `Enter` from focused buttons or editable controls;
  those elements should keep their native behavior. The store-level
  `approvePlan()` idempotence guard remains mandatory and is the final
  duplicate-response boundary. The component should still mark itself submitted
  on the first approve/deny/cancel path, disable response controls, and ignore
  repeated keyboard/backdrop/button triggers while the store writes the response.
  This mirrors cc-gui's `markSubmitted()` pattern and prevents users from seeing
  an apparently clickable blocking dialog after they have already answered it.
  Reset submitted state when the `request` object changes, not only when
  `requestId` changes; store failure recovery deliberately restores the same
  request id with a fresh object reference so the user can retry.
- Tool permission dialogs should offer the same fast path for the common
  allow/deny decision: `Enter` allows once and `Escape` denies. Keep the
  keyboard routing in a pure helper, avoid stealing `Enter` from focused buttons
  or editable controls, and rely on `answerToolPermission()` as the final
  request-id idempotence boundary. The component should also mark itself
  submitted on the first allow/deny/backdrop path, disable response controls,
  and ignore repeated keyboard/backdrop/button triggers until the store clears
  or restores the pending request. Reset submitted state when the `request`
  object changes, not only when `requestId` changes.
- AskUserQuestion dialogs should follow cc-gui's safer question flow: `Escape`
  cancels when focus is outside editable controls, but `Enter` must not be a
  global submit because question options and custom text inputs own their native
  keyboard behavior. The component should mark itself submitted on the first
  submit/cancel path, disable answer controls, and show a lightweight submitting
  state while the store-level `answerAskUserQuestion()` idempotence guard writes
  the response. Keep shared editable-target and single-submit primitives in
  `src/utils/dialogShortcuts.ts` so plan approval, tool permission, and
  AskUserQuestion dialogs do not drift into three different shortcut rules.
  Like the other blocking permission dialogs, reset submitted state when the
  `request` object changes so failure restoration of the same request id
  re-enables answer controls.
- `ChatPage` must mount only one blocking permission dialog at a time even when
  multiple pending permission events exist in the store. Use
  `getActivePermissionDialog()` to select the newest pending request by
  timestamp, with the visual fallback priority `tool-permission > plan-approval
  > ask-user-question` for ties, missing timestamps, or invalid timestamps.
  Candidate inclusion must be based on whether the pending request object
  exists, not on timestamp truthiness; an empty or malformed timestamp should
  still surface the blocking dialog and only lose ordering priority. Hidden
  pending requests stay in the store and surface after the active dialog
  responds. Do not render all permission portals simultaneously, because each
  dialog owns a global keyboard listener and one `Escape` / `Enter` press could
  otherwise answer multiple daemon-blocking requests.
- Chat history must treat uploaded images as structured content blocks, not as
  filename-only prompt text. `ContentBlockRenderer` owns `image` /
  `input_image` rendering: show a bounded thumbnail in the transcript, open a
  portal lightbox on click, and keep local-path/base64 source parsing in shared
  image-block helpers. Local `file:///C:/...` style image URLs from historical
  Codex/Claude payloads must be normalized to filesystem paths before calling
  Tauri asset conversion; do not feed the `file://` wrapper into the WebView as
  the final image source. The full-size lightbox must retain visible source
  context by rendering the image label/file name as a caption in addition to
  `alt`/`aria-label`, so users can inspect multiple screenshots or historical
  attachments without losing which file they opened. System-role history
  messages are protocol context and
  must be filtered out before transcript rendering or anchor generation. Some
  historical providers replay runtime context as user text instead of `system`;
  hide recognizable Codex/Claude system prompts, Tools/Skills/Plugins/Heartbeats
  blocks, sandbox/environment XML blocks, and model handoff summaries such as
  `Another language model started...` / `## Handoff Summary` from transcript
  rendering and provider-switch handoff context. Codex can also replay control
  markers as user
  text, including `<turn_aborted>`, `<user_action>`,
  `<subagent_notification>`, `<agents-instructions>`, and `<skill>`; route these
  through the same shared protocol-context predicate so they disappear from
  transcript rendering, search, anchor generation, and provider handoff. Do not
  hide all arbitrary XML-looking user text, because image placeholders and task
  prompts can carry real user-visible content. The narrow exception is Codex
  image wrapper text: when the same raw message contains a real `image` /
  `input_image` block, pure placeholder text such as `<image name=...>` and
  `</image>` should be filtered from rendering, merged visible content, search,
  and anchor labels while preserving the image block and the user's real prompt.
- Chat history text blocks are Markdown document fragments, not independent
  cards. After filtering non-user-visible image residue or protocol context,
  adjacent `text` blocks must be merged before `ContentBlockRenderer` calls
  `MarkdownBlock`; otherwise headings, blank lines, and list items from the same
  assistant answer can render as several cramped Markdown islands. Do not merge
  across `image`, `thinking`, `tool_use`, or other non-text blocks, because those
  boundaries represent real transcript structure.
- Long-session anchor rails should stay readable under dense histories. Generate
  anchors from renderable user messages in the currently revealed transcript
  window, then sample dense anchor lists through a pure helper that preserves
  the first, last, and active anchor. Keep point positions based on the original
  anchor index so the rail still communicates relative conversation progress.
  Anchor projections must preserve more than a display string: include the
  preview kind (`text`, `image`, `mixed`, or `empty`), visible sequence, total
  count, and timestamp when available. The rail uses that metadata for contrast,
  hover detail, and accessible labels; do not infer image/text state later from
  the truncated label. Dense sampling should prefer anchors with real content
  previews (`text`, `image`, or `mixed`) before `empty` anchors; preserve the
  active anchor even when it is empty, but do not let empty protocol remnants
  consume the visible rail budget. Anchor candidates must use a shared
  predicate for both rail data and `MessageList` node registration: user
  messages need visible prompt/image content, while internal `[tool_result]`,
  blank, or protocol-context user rows must not become anchors.
  Before `MessageList` reports its actual collapsed-count state for a newly
  loaded history session, page-level anchor derivation should assume the default
  collapsed transcript window rather than zero collapsed messages; otherwise the
  rail briefly creates anchors for historical messages whose DOM nodes are not
  mounted and jump targets appear wrong.
- In assistant flow, runtime metadata such as model / reasoning effort /
  short agent id and placeholder subagent-history surfaces are secondary
  signals. Render them with lower contrast than the primary action summary and
  avoid introducing standalone heavy badges or boxed placeholders that break
  the transcript's continuous reading rhythm. When a message has finished
  streaming, the metadata footer should stay compact and inline-style in the
  assistant flow instead of reintroducing a verbose label block; use the compact
  variant for final assistant rows so the transcript reads like a single
  continuous operation log rather than a stack of repeated footnotes.
- Chat composer layout should stay compact by default. The textarea starts as a
  single-row control and grows only with content; toolbars should not wrap into
  multiple rows at common desktop widths. Attachment chips must represent real
  payloads sent through `ChatAttachment`; do not fake image/file context by
  prepending `@filename` to the prompt. Empty composer context should stay quiet
  instead of rendering placeholder text that increases the input area's height.
  In the Chat page, place the composer inside the central conversation column
  and center its inner content with a bounded max width; it must not span across
  the session sidebar or status panel on wide screens. If the composer exposes a
  drag handle for resizing, the drag must update the textarea's visible height,
  not only a `max-height` cap, otherwise an empty draft appears non-resizable.
  Keep the default compact height near a single-row input, clamp the drag range
  through shared helpers, and keep the final height free of horizontal overflow
  in the central conversation column. The bottom composer toolbar should keep
  selectors in a flexible left group and prompt-enhance/send/stop actions in a
  fixed right group; under tight widths, selectors may wrap before primary
  actions are pushed off-screen. The toolbar wrappers should expose stable
  layout classes (`chat-composer-toolbar`,
  `chat-composer-toolbar-selectors`, `chat-composer-toolbar-actions`) so tests
  can guard the layout contract. Enhance/send/stop are icon-only action buttons:
  keep them fixed square (`h-7 w-7 shrink-0`) with `aria-label`, and do not
  reintroduce auto-width DaisyUI button classes for the primary send/stop
  affordance.
- Chat composer slash completions must not be maintained as a short frontend-only
  hardcoded list. The `/` trigger should call `chat_list_slash_commands` with
  the current `cwd` and provider, then normalize the backend registry payload
  into `CompletionItem`s. The frontend fallback list is only for backend
  failures and must stay aligned with cc-gui built-ins such as `/context`,
  `/plan`, `/resume`, `/batch`, `/claude-api`, `/debug`, `/loop`, `/simplify`,
  `/update-config`, and Codex `/diff`. Project command files from
  `.claude/commands/**/*.md` should show their source suffix (for example
  `[project]`) so users can distinguish built-in and local commands.
- Chat composer model selection should not be limited to the static fallback
  arrays in `constants.ts`. The selector should merge active Provider model
  fields, locally cached dynamic models, and fallback models through
  `chatModels.ts`. Remote model discovery must stay behind an explicit
  user-triggered refresh icon next to the model selector because it calls a
  provider API with the configured key. The refresh control is icon-only with a
  tooltip/accessible label, shows a spinner while pending, and surfaces concise
  errors without rendering API keys or other secrets.
- Transcript history reveal should prefer scroll-triggered paging over repeated
  click-only affordances when the chat page owns a dedicated scroll container.
  When prepending older messages, preserve the user's viewport by capturing the
  previous `scrollHeight` and `scrollTop`, then restoring `scrollTop` with the
  delta after render. Do not snap the user back to the top after each reveal.
  Reveal state must be scoped to a transcript key such as the first renderable
  message id; when a user switches sessions, the new history should start from
  the default recent-message window instead of inheriting an "all earlier
  messages revealed" state from the previous session.
- Edit tool summaries should expose per-file additions/deletions and a hoverable
  diff preview. The preview data must come from structured `diffPreviewLines`
  emitted by shared presentation helpers so `apply_patch`, `edit_file`, and
  grouped edit payloads all render through the same hover component instead of
  building ad hoc preview strings inside the React layer. Diff hover previews
  should use solid backgrounds, high z-index, and viewport-aware placement:
  center previews in the transcript area, and expand right-sidebar previews left
  into the conversation area so code is readable and not clipped by side panels.
  When the same file is edited multiple times in one grouped edit sequence,
  the visible file list must merge those rows into one per-file item while
  summing additions/deletions and preserving combined diff preview lines. Keep
  that merge in shared tool-presentation helpers so the transcript group and
  status panel report the same touched-file counts.
- Historical Codex file changes must enter the UI as normalized
  `tool_use{name:"apply_patch", input:{patch}}` blocks from the backend
  provider. The status panel should count those through
  `collectEditToolItems()` just like live edit tools; do not parse raw Codex
  JSONL payload variants directly in React components.
- Status-panel edit totals must be computed from the full aggregated edit set,
  even if the visible `recentEdits` list is capped for layout. Keep the sidebar
  list compact, but `touchedFileCount`, `totalAdditions`, and `totalDeletions`
  should reflect all touched files in the loaded transcript window so long
  Codex/Claude histories do not look like they only changed the four newest
  visible files. When the capped list hides additional files, show a compact
  "more files" row that can expand to the complete `allEdits` list and collapse
  back to recent edits, so the user can inspect every touched file without
  making the default sidebar dense.
- The chat input area must expose a compact status strip directly above the
  composer, but the strip is trigger-driven rather than always filled with zero
  placeholders. Show the current Git branch only when the current `cwd` resolves
  to a Git repository and a branch or detached-head label is available. Show the
  tasks, subagents, and edits entries only when their underlying data exists:
  tasks come from non-agent tools in the loaded `toolTimeline`, subagents come
  from `agentTools`, and edits come from `allEdits` / edit totals. Do not list
  agent/subagent runs in the tasks panel as well as the subagents panel; users
  read those as two different queues. The strip may also show an MCP entry when
  `ChatMcpAvailabilitySummary` has configured servers, a loading state, or an
  error; this is the small-screen fallback for the right
  `StatusPanel` MCP details. If none of those signals exist, do not render the
  strip at all. Keep the default surface compact and treat each tab as a quick
  entry chip: icon, short label, compact count pill, and a full `aria-label` /
  tooltip. On small widths the visual label may hide while the count pill stays
  visible. The Git branch chip follows the same density rule even though it is
  not expandable: hide its visual "branch" label on small widths, keep the
  branch value truncated, and put the full branch/root context in `aria-label`
  and `title`. Full diagnostic detail belongs in the expanded quick-detail
  popover and the right `StatusPanel`, not in the collapsed composer strip. The
  strip's quick-detail surface must be anchored to the strip container and
  absolutely positioned above the toolbar so opening tasks/subagents/edits/MCP
  details does not push, resize, or reflow the composer. Because this surface is
  transient, it should close when the user clicks outside the strip/panel or
  presses `Escape`, matching the popover behavior users expect from cc-gui.
  The popover's scroll container must also be keyboard-focusable and exposed as
  a named `region`, so users can focus and scroll task, subagent, edit, or MCP
  details without first tabbing through every row.
  Task and subagent rows inside this small-screen fallback should reuse the
  page-level transcript jump handler instead of becoming static duplicates:
  render them with `data-target-tool-id`, accurate task/subagent `aria-label`
  keys, and disabled read-only semantics only when no selection handler is
  available. After a successful task/subagent jump, close the transient
  quick-detail popover so the bottom-anchored panel does not obscure the
  highlighted transcript target on narrow screens. Selecting an edited file
  from this strip should reuse the page-level diff selection handler instead of
  opening a separate diff implementation. Edit rows must stay disabled and
  read-only when that handler is unavailable, and a successful edit selection
  should close the transient quick-detail popover so the selected page-level
  diff/context is not obscured. MCP details in the composer strip must list
  configuration availability only (server name,
  transport/config type, enabled/disabled) and must not run live connectivity
  checks. Do not add destructive controls such as undo, discard all, or keep all
  to this composer strip without a separate design review.
  For large historical sessions, the strip should render from the visible-tail
  summary in normal browsing. If explicit full-history search restores
  task/subagent/edit triggers from earlier collapsed messages, that merge must
  remain page-owned and display-only; do not move full-history scanning into
  the first-paint render path or trigger it merely because the strip is mounted.
  Automatically loaded `windowed` histories should also skip the idle
  complete-status-summary pass; ordinary browsing should keep using the visible
  tail until the user makes an explicit full-history request. On the desktop
  `xl` breakpoint where the right `StatusPanel` is visible, the
  composer strip's expandable tasks/subagents/edits/MCP tabs should act as a
  small-screen fallback and carry `xl:hidden` so the same detail surfaces are
  not duplicated above the composer. The Git branch chip may remain visible on
  desktop because it is a lightweight send-context signal rather than another
  expandable status panel.
- Conditional classes are composed with template strings today. A `cn()` helper
  (clsx + tailwind-merge) exists at `src/utils/cn.ts` — prefer it for new
  components with conditional class logic.
- Icons come from `lucide-react`, sized with `w-*/h-*` (commonly `w-4 h-4`,
  `w-3.5 h-3.5`); spinners use `<Loader2 className="animate-spin" />`.

---

## Modals, Toasts, and Portals

- **Modals/overlays render through `createPortal(..., document.body)`.** Use the
  shared `ModalDialog` (`components/common/ModalDialog.tsx`) for confirm/alert
  dialogs rather than building new ones. It handles ESC-to-close, backdrop
  click, icon/type theming, and destructive styling.
- Modal-open state lives in the page (`useState`), often as an object carrying
  the target row: `useState<{ isOpen; id; name }>`.
- **Toasts**: call the module-level `showToast(message, type, duration?, onClick?)`
  imported from `components/common/ToastContainer`. `<ToastContainer/>` must be
  mounted once near the root. Do not build ad-hoc notification UI.
- Chat turn-stopped desktop notifications are the exception to in-app toast
  guidance: route completion / failure / abort notifications through
  `src/utils/desktopNotification.ts`. In Tauri desktop runtime it must call the
  native `chat_show_system_notification` command first so Windows notifications
  come from the OS, while WebView `Notification` remains only a browser/test
  fallback. Stores and components should not instantiate `Notification`
  directly.
- Tauri window dragging: top regions use `data-tauri-drag-region`; modals add a
  fixed drag strip so the window stays movable behind the overlay.

### Event-Driven Modal Pattern (Backend → Frontend)

For modals triggered by backend events (e.g., permission requests via Tauri
`app.emit()`), the pattern is:

1. **Store the request** in a Zustand store field (`pendingAskUserQuestion: Request | null`)
2. **Listen to the event** in the store's `init()` method and set the field
3. **Conditionally render the modal** in the page: `{pendingRequest && <Dialog ... />}`
4. **Clear the field** after user responds (in the store action that calls `invoke`)

Example (permission approval dialog):
```tsx
// Store (useChatStore.ts)
interface ChatState {
    pendingAskUserQuestion: AskUserQuestionRequest | null;
    answerAskUserQuestion: (requestId: string, answers: Record<string, string>) => Promise<void>;
}

init: async () => {
    const askUserUn = await listen<AskUserQuestionRequest>('permission://ask-user-question', (event) => {
        set({ pendingAskUserQuestion: event.payload });
    });
    // ...
}

answerAskUserQuestion: async (requestId, answers) => {
    await invoke('permission_respond_ask_user_question', { requestId, answers });
    set({ pendingAskUserQuestion: null });
}

// Page (ChatPage.tsx)
const { pendingAskUserQuestion, answerAskUserQuestion } = useChatStore();

return (
    <>
        {/* ... main content */}
        {pendingAskUserQuestion && (
            <AskUserQuestionDialog
                request={pendingAskUserQuestion}
                onAnswer={(answers) => answerAskUserQuestion(pendingAskUserQuestion.requestId, answers)}
            />
        )}
    </>
);

// Component (AskUserQuestionDialog.tsx)
export default function AskUserQuestionDialog({ request, onAnswer }: Props) {
    return createPortal(
        <>
            <div className="fixed top-0 left-0 right-0 h-8 z-[9998]" data-tauri-drag-region />
            <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                {/* modal content */}
            </div>
        </>,
        document.body
    );
}
```

This pattern keeps the modal globally accessible (can be shown from any page)
without coupling to page-local state.

For chat permission approvals, generic tool permissions are a separate modal
path from ask-user-question and plan approval. The backend emits
`permission://tool` for request files named `request-<sessionId>-<requestId>.json`;
the page must render a tool permission dialog and answer through
`permission_respond_tool`. Do not rely on a pending tool block alone for this
case: the daemon is blocked until the response file
`response-<sessionId>-<requestId>.json` is written. The dialog should show the
tool name, working directory, and a compact preview of important inputs such as
`command`, `file_path`, `path`, `url`, `pattern`, or `query`, with full JSON
available behind a details disclosure.

---

## Accessibility

Current state (document reality): a11y is partial.
- Interactive controls use real `<button>`/`<input>`/`<select>` elements.
- Icon-only buttons carry a `title` attribute (acts as a tooltip; some are
  Chinese-only literals rather than i18n keys — see Common Mistakes).
- Focus styles are kept on actionable buttons in `ModalDialog`
  (`focus:outline-none focus:ring-2`).

When adding components, at minimum: use semantic elements, give icon-only
buttons an accessible label (`title` or `aria-label`), and keep visible focus
states. Note that full WCAG compliance has not been verified for this project.

---

## Common Mistakes

- **Hardcoded Chinese strings.** Some `title`/toast text is a literal Chinese
  string instead of a `t('...')` key (e.g. `title="拖拽排序"`, `'启动终端失败'`).
  New user-facing text must go through i18n and be added to both `en.json` and
  `zh.json`.
- Forgetting `export default` on a page component, which breaks `React.lazy`.
- Putting feature-specific components in `common/` — keep `common/` for true
  primitives.
- Adding a one-off confirm dialog instead of reusing `ModalDialog`.
- Light-only styling with no `dark:` variant.
- Putting a long master list and its dependent detail list into the same
  scrolling sidebar. Users can select a master item and still not see the
  detail rows because they are pushed below the rest of the master list.
- Rendering batch edit tools as a single generic/edit card. Users lose the
  changed-file list for `MultiEdit`, filesystem `edit_file`, and `apply_patch`
  unless those payloads are expanded into per-file edit items first.
- Rendering uploaded image history as `[Image: name]` / `[图片: name]` text.
  That loses the actual visual attachment and makes anchors look blank. Preserve
  raw `image` / `input_image` blocks and render thumbnails instead.
- Letting user-uploaded thumbnails expand to full bubble width. User message
  images should render as compact, click-to-preview thumbnails in the transcript
  and only use the lightbox for the full-size image. If historical raw content
  contains base64 image payload fragments as adjacent `text` blocks, filter
  those fragments out before rendering, copying, or deriving message previews.
