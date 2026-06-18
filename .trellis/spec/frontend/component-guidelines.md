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
- Transcript history reveal should prefer scroll-triggered paging over repeated
  click-only affordances when the chat page owns a dedicated scroll container.
  When prepending older messages, preserve the user's viewport by capturing the
  previous `scrollHeight` and `scrollTop`, then restoring `scrollTop` with the
  delta after render. Do not snap the user back to the top after each reveal.
- Edit tool summaries should expose per-file additions/deletions and a hoverable
  diff preview. The preview data must come from structured `diffPreviewLines`
  emitted by shared presentation helpers so `apply_patch`, `edit_file`, and
  grouped edit payloads all render through the same hover component instead of
  building ad hoc preview strings inside the React layer.
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
