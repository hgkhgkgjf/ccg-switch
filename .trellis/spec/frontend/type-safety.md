# Type Safety

> TypeScript conventions in this project.

---

## Overview

TypeScript 5.8 in **strict mode**. `tsconfig.json` enables:
`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
plus bundler mode (`moduleResolution: "bundler"`, `isolatedModules`, `noEmit`,
`jsx: "react-jsx"`). The build runs `tsc && vite build`, so **type errors and
unused locals/params fail the build** — there is no separate lint step.

---

## Type Organization

- **Shared types live in `src/types/`, one file per domain** (`provider.ts`,
  `app.ts`, `config.ts`, `mcp.ts`, `session.ts`, ...). Import them where needed.
- **Component-local types stay in the component file**: the `<Component>Props`
  interface, and small unions like `type ViewMode = 'card' | 'table'` or
  `type ModalType = 'confirm' | 'success' | 'error' | 'info'`.
- **Hook-specific types live with the hook** and are exported if consumers need
  them (`HealthState`, `HealthStatus` in `useHealthCheck.ts`).
- `interface` is used for object shapes (props, store state, domain models);
  `type` is used for unions and aliases. Both appear; follow the local file.
- A `V2` suffix on a types file (`types/mcpV2.ts`) marks a newer parallel model
  during migration — check which one the page imports before editing.

---

## Domain Model Conventions

- Domain models are plain `interface`s with optional fields marked `?`
  (`url?: string`, `tags?: string[]`). See `types/provider.ts`.
- **Field names are camelCase** and must match the Rust backend's serde rename
  (`#[serde(rename = "apiKey")]`). The TS type is the contract for the `invoke`
  payload/response, so keep field names and optionality in sync with the Rust
  model.
- String-literal unions model enums and are paired with a const array and
  lookup maps (`Record<...>`) in the same file:

```ts
export type AppType = 'claude' | 'codex' | 'gemini' | 'opencode' | 'openclaw';
export const VISIBLE_APP_TYPES: AppType[] = ['claude', 'codex', 'gemini'];
export const APP_LABELS: Record<AppType, string> = { claude: 'Claude', /* ... */ };
```

---

## Tauri `invoke` Typing

- Always type the result with the generic parameter:
  `await invoke<Provider[]>('get_all_providers')`.
- The argument object keys are **camelCase** and must match the Rust command's
  parameter names (`invoke('switch_provider', { app, providerId })`).
- Services in `services/*Service.ts` are thin typed wrappers around `invoke`
  and are the preferred place to centralize a command's signature.

---

## Validation

- **No runtime validation library** (no Zod/Yup/io-ts). Trust is placed in the
  `invoke<T>()` generic and the Rust serde contract. Data crossing the boundary
  is assumed to match its declared type.
- Because there's no runtime schema check, keeping TS types aligned with the
  Rust models is the only guard — treat type drift as a real bug source.

---

## Common Patterns

- Derive insert/update DTOs from the model with utility types instead of new
  interfaces: `Omit<Provider, 'id' | 'createdAt' | 'isActive' | 'lastUsed'>`,
  `Partial<Provider>`.
- Narrow with explicit string-literal unions and `switch` (exhaustive switches
  benefit from `noFallthroughCasesInSwitch`).
- `Record<K, V>` for keyed maps (`Record<string, HealthStatus>`,
  `Record<AppType, string>`).

---

## Forbidden / Discouraged Patterns

- **Avoid `any`.** It still appears in a few legacy spots
  (`customParams?: Record<string, any>`, `settingsConfig?: any` in
  `types/provider.ts`) — treat these as tech debt, not a template. Prefer
  `unknown` + narrowing, or a real type, for new code.
- Avoid unsafe `as` assertions to silence the compiler; the existing
  `e.target.value as AppType | 'all'` cast is acceptable for known
  `<select>` value sets but should not be used to paper over genuine mismatches.
- Don't leave unused imports, locals, or parameters — they fail the build under
  `noUnusedLocals`/`noUnusedParameters`.
- Don't let TS types and Rust serde field names drift apart.
