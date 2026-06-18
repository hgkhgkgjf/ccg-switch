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
  settling. Repeated clicks on the active or
  pending session should short-circuit before resetting transcript navigation.
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
  central diff pane preserves the user's review mode.
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
  expanded.
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
- Chat history must treat uploaded images as structured content blocks, not as
  filename-only prompt text. `ContentBlockRenderer` owns `image` /
  `input_image` rendering: show a bounded thumbnail in the transcript, open a
  portal lightbox on click, and keep local-path/base64 source parsing in shared
  image-block helpers. Local `file:///C:/...` style image URLs from historical
  Codex/Claude payloads must be normalized to filesystem paths before calling
  Tauri asset conversion; do not feed the `file://` wrapper into the WebView as
  the final image source. System-role history messages are protocol context and
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
  in the central conversation column.
- Chat composer slash completions must not be maintained as a short frontend-only
  hardcoded list. The `/` trigger should call `chat_list_slash_commands` with
  the current `cwd` and provider, then normalize the backend registry payload
  into `CompletionItem`s. The frontend fallback list is only for backend
  failures and must stay aligned with cc-gui built-ins such as `/context`,
  `/plan`, `/resume`, `/batch`, `/claude-api`, `/debug`, `/loop`, `/simplify`,
  `/update-config`, and Codex `/diff`. Project command files from
  `.claude/commands/**/*.md` should show their source suffix (for example
  `[project]`) so users can distinguish built-in and local commands.
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
