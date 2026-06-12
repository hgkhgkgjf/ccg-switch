# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Quality is enforced primarily by the **TypeScript compiler in strict mode**.
The build command is `npm run build` (`tsc && vite build`); a type error or an
unused local/parameter fails the build. There is **no ESLint, Prettier, or
frontend test runner configured** in this project today — document and follow
conventions manually.

Verification commands:
- `npm run build` — type-check + production build (the gate that must pass).
- `npm run dev` / `npm run tauri dev` — run frontend / full desktop app.
- `cargo check --manifest-path src-tauri/Cargo.toml` — validate the Rust side.

---

## Forbidden / Discouraged Patterns

- **Hardcoded user-facing strings.** All visible text must go through i18n
  (`useTranslation` → `t('...')`) and be added to **both** `src/locales/en.json`
  and `src/locales/zh.json`. Some legacy `title`/toast literals are Chinese-only
  — do not copy that pattern.
- **`any`** — avoid; a few legacy fields use it (`customParams`, `settingsConfig`)
  but new code should use real types or `unknown` + narrowing.
- **Ad-hoc dialogs/notifications** — use the shared `ModalDialog` and
  `showToast` instead of building new ones.
- **Mutating store arrays in place after a backend mutation** — re-fetch from
  the backend instead (see `state-management.md`).
- **Unused imports/locals/params** — they break the build.
- **Editing generated output** — `dist/` and `src-tauri/target/` are build
  artifacts; never edit by hand.

---

## Required Patterns

- Function components with a typed `<Component>Props` interface; page components
  exported as `default`.
- Tailwind + DaisyUI utility classes, with `dark:` variants paired on every
  themed element. Use semantic DaisyUI tokens (`base-100`, `base-content`).
- `invoke<T>()` for all backend calls, with camelCase argument keys matching the
  Rust command and TS field names matching serde renames.
- Async store actions follow the loading/error/`hasLoaded` triad; mutations
  re-fetch and re-throw so callers can toast.
- Lazy-load non-initial pages via `React.lazy` + `Suspense` (see `App.tsx`).
- Clean up effects: timers, `requestIdleCallback`, and Tauri `listen` handlers.

---

## Testing Requirements

- **No frontend test framework is configured.** Per `AGENTS.md`, add tests
  alongside new features when introducing test infrastructure; until then,
  verify changes by running `npm run build` and exercising the app with
  `npm run tauri dev`.
- Rust logic is tested with `cargo test --manifest-path src-tauri/Cargo.toml`;
  cover at least one happy path and one error/edge path for new logic.
- If you add a frontend test runner, set it up with the ecosystem-standard
  choice (e.g. Vitest, given Vite) and wire a `test` script in `package.json`.

---

## Accessibility

- Use semantic elements (`<button>`, `<input>`, `<select>`); give icon-only
  buttons a `title`/`aria-label`; preserve visible focus states.
- Full WCAG compliance has **not** been validated for this project; treat a11y
  improvements as deliberate, verifiable changes rather than assumed-complete.

---

## Code Review Checklist

- [ ] `npm run build` passes (no type errors, no unused locals/params).
- [ ] New user-facing text is in i18n and added to both `en.json` and `zh.json`.
- [ ] Backend calls use `invoke<T>()` with correct camelCase keys; TS types match
      the Rust serde model.
- [ ] Store actions follow the loading/error/`hasLoaded` pattern; mutations
      re-fetch and re-throw.
- [ ] Reused `ModalDialog`/`showToast` instead of custom UI.
- [ ] Themed elements have `dark:` variants.
- [ ] Effects clean up timers/listeners; hook deps are correct.
- [ ] No edits to `dist/` or `src-tauri/target/`.
- [ ] New page components are lazy-loaded and `export default`.
