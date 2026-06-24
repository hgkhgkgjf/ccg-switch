# SDK 依赖版本管理与 cc-gui 风格优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `trellis-before-dev` before code edits and `trellis-check` after implementation. Follow TDD: add failing tests before production changes.

**Goal:** 为 Chat SDK 依赖管理增加版本展示、版本选择、安装/升级/切换能力，并把弹窗调整为 cc-gui 风格紧凑面板。

**Architecture:** 后端扩展 SDK 状态合同和安装命令 optional version 参数；前端 store/type 同步合同；`SdkDependencyPanel` 负责版本选择和动作展示；`ChatPage` 只调整 modal footer 文案和取消按钮。

**Tech Stack:** React, TypeScript, Zustand, Vitest, Tauri command, Rust, reqwest, serde_json, regex.

---

## Files

- Modify: `src-tauri/src/chat/sdk_installer.rs`
- Modify: `src-tauri/src/chat/manager.rs`
- Modify: `src-tauri/src/commands/chat_commands.rs`
- Modify: `src/types/chat.ts`
- Modify: `src/stores/useSdkStore.ts`
- Modify: `src/components/chat/SdkDependencyPanel.tsx`
- Modify: `src/components/chat/SdkDependencyPanel.test.tsx`
- Modify: `src/pages/ChatPage.tsx`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify if needed: `.trellis/spec/backend/cross-layer-protocol.md`
- Modify if needed: `.trellis/spec/frontend/component-guidelines.md`

## Task 1: Rust Version Helpers

- [ ] Add failing tests in `src-tauri/src/chat/sdk_installer.rs` for reading installed package version, parsing registry metadata, filtering stable versions, and rejecting unsafe explicit versions.
  - Run: `cargo test --manifest-path src-tauri/Cargo.toml sdk_installer -- --nocapture`
  - Expected before implementation: tests fail because helpers do not exist.
- [ ] Implement small pure helpers:
  - `installed_package_version(deps_dir, sdk)`
  - `parse_registry_versions(json)`
  - `is_safe_explicit_version(version)`
  - `fallback_available_versions(current, default)`
- [ ] Run the same Rust tests.
  - Expected after implementation: tests pass.

## Task 2: Backend Status And Install Contract

- [ ] Add failing Rust tests for `SdkStatus` version fields and explicit `package@version` command spec construction.
- [ ] Extend `SdkStatus` with `currentVersion`, `defaultVersion`, `latestVersion`, `availableVersions`.
- [ ] Make status loading async if registry query is integrated into `all_status`; ensure registry failure returns local status instead of `Err`.
- [ ] Extend `chat_install_sdk` / `ChatManager::install_sdk` / `sdk_installer::install_sdk` to accept `Option<String>` version.
- [ ] Validate explicit version before command construction.
- [ ] Run:
  - `cargo test --manifest-path src-tauri/Cargo.toml sdk`
  - `cargo check --manifest-path src-tauri/Cargo.toml`

## Task 3: Frontend Type And Store Contract

- [ ] Add or update tests around `SdkDependencyPanel` with mocked store data containing `currentVersion`, `latestVersion`, and `availableVersions`.
- [ ] Update `src/types/chat.ts` `SdkStatus` interface without overwriting existing unrelated user edits.
- [ ] Update `useSdkStore.install(sdkId, version?)` to pass `{ sdkId, version }` to `chat_install_sdk`.
- [ ] Run targeted TypeScript/Vitest tests for SDK panel.

## Task 4: SDK Panel UI

- [ ] Add RED tests in `SdkDependencyPanel.test.tsx`:
  - key-only fallback does not expose `chat.sdk.*`.
  - uninstalled SDK displays target version select and `Install vX`.
  - installed outdated SDK displays current/latest metadata and `Update to vX`.
  - installed current SDK displays disabled `Current version`.
  - installed SDK can select a non-current version and shows `Switch to vX`.
- [ ] Refactor `SdkDependencyPanel.tsx` to cc-gui-style compact rows/cards:
  - status icon
  - version chips
  - target version select
  - install/update/current/switch action
  - uninstall action
  - logs/error area
- [ ] Keep operation disabling global while one SDK is installing.
- [ ] Run:
  - `npm test -- src/components/chat/SdkDependencyPanel.test.tsx`

## Task 5: Modal Footer And i18n

- [ ] Update `ChatPage.tsx` SDK modal props to include `onCancel` and `cancelText`.
- [ ] Add English and Chinese locale keys for all new labels.
- [ ] Ensure `getSdkDependencyPanelLabels()` has readable fallbacks for every new label.
- [ ] Run:
  - `npm test -- src/components/chat/SdkDependencyPanel.test.tsx`
  - `npm run build`

## Task 6: Spec Sync And Final Verification

- [ ] Update Trellis specs if new cross-layer contract or component rule should be retained.
- [ ] Run final checks:
  - `npm test -- src/components/chat/SdkDependencyPanel.test.tsx`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml sdk`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `git diff --check -- src-tauri/src/chat/sdk_installer.rs src-tauri/src/chat/manager.rs src-tauri/src/commands/chat_commands.rs src/types/chat.ts src/stores/useSdkStore.ts src/components/chat/SdkDependencyPanel.tsx src/components/chat/SdkDependencyPanel.test.tsx src/pages/ChatPage.tsx src/locales/en.json src/locales/zh.json`
- [ ] If build output directories are generated, clean generated `dist` / `out` only after verifying they are within the workspace.

## Rollback Points

- Backend command contract can be rolled back by ignoring `version` and restoring default `SdkDefinition.version` install behavior.
- Frontend UI can be rolled back to old `SdkDependencyPanel` because store state shape only adds optional fields.
- Registry query can be disabled while keeping local `currentVersion` display if network latency or registry shape causes regressions.
