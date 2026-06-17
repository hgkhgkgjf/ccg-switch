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
