# Implementation Plan

## Phase 0: Confirmation Gate

- Present this plan to the user.
- Do not modify production code until the user confirms.
- After confirmation, run `python ./.trellis/scripts/task.py start 06-25-chat-workspace-session-actions-branch-menu`.

## Phase 1: RED Tests

1. `useChatStore` workspace state tests
   - Add/extend tests for empty initial state switching to `C:/project-a`.
   - Assert `currentCwd` updates without creating a fake history session.
   - Assert next `send()` passes `cwd: C:/project-a`.

2. `ContextBar` / workspace switcher render tests
   - Render no `currentCwd` + empty projects and assert stable “Open folder” entry.
   - Render Git workspace and assert folder chip + branch chip labels/aria/title.

3. Sidebar context menu tests
   - Right-click project row shows project actions.
   - Right-click session row shows session actions.
   - Disabled/unimplemented actions are visibly disabled and do not call mutation handlers.

4. Backend Git/path tests
   - Unit test branch-name validation: good branch passes, empty/control/dangerous names fail.
   - Integration-style temp Git repository test for listing branches and creating/checking out new branch when `git` is available.
   - Test non-Git directory returns a controlled error or empty status.

## Phase 2: Backend Commands

1. Add a small service module for workspace shell/Git actions.
   - Resolve cwd to existing directory.
   - Resolve Git root with `git -C <cwd> rev-parse --show-toplevel`.
   - Use `std::process::Command` argument arrays only.

2. Add Tauri commands.
   - `chat_open_path_in_explorer(path)`
   - `chat_git_list_branches(cwd)`
   - `chat_git_create_and_checkout_branch(cwd, branchName)`
   - Optional: `chat_session_rename(...)` if persistence location is confirmed.

3. Register commands in `src-tauri/src/lib.rs`.

## Phase 3: Frontend State and Services

1. Add typed service wrappers for workspace/Git commands.
2. Add explicit current workspace action to `useChatStore` if needed.
3. Ensure `startNewSession(cwd)` and direct workspace switch share the same projection rules.
4. Keep tab logic from saving a startup empty draft solely because cwd changed.

## Phase 4: UI

1. Build workspace directory selector above the input editor.
   - Use folder icon, project name, full path tooltip.
   - Show project list, current selection mark, empty state, and `Open folder...`.
   - Integrate folder picker if available; otherwise use backend/open dialog path after confirming Tauri API feasibility.

2. Extend Git branch chip.
   - Click opens branch list.
   - “Create and checkout new branch...” opens small input flow.
   - Refresh workspace status on success.

3. Add project context menu.
   - Use compact menu styling aligned with screenshots.
   - Wire safe actions; disable high-risk placeholders.

4. Add session context menu.
   - Wire safe actions; disable high-risk placeholders.
   - If rename persistence is implemented, refresh sessions after success.

5. Add i18n keys to `en.json` and `zh.json`.

## Phase 5: Verification

Run targeted checks first:

```bash
npm test -- src/stores/useChatStore.test.ts src/components/chat/chatSessionSidebarUtils.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/utils/chatWorkspaceStatus.test.ts
```

Run backend checks:

```bash
cargo test --manifest-path src-tauri/Cargo.toml chat_workspace
cargo check --manifest-path src-tauri/Cargo.toml
```

Run full frontend gate:

```bash
npm run build
```

Optional/full regression if time permits:

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

## Rollback Points

- After backend commands: revert command registration + service module if Git/path behavior is unstable.
- After store changes: ensure `useChatStore` tests cover startup empty tab before moving to UI.
- After UI menus: if context menu behavior regresses selection, disable menus behind a local flag and keep workspace switcher.

## Files Expected To Change

- `src/stores/useChatStore.ts`
- `src/stores/useChatStore.test.ts`
- `src/pages/ChatPage.tsx`
- `src/components/chat/composer/ContextBar.tsx`
- Potential new `src/components/chat/composer/WorkspaceContextSwitcher.tsx`
- `src/components/chat/ChatSessionSidebar.tsx`
- `src/components/chat/chatSessionSidebarUtils.ts`
- `src/components/chat/chatSessionSidebarUtils.test.ts`
- `src/utils/chatWorkspaceStatus.ts` or new workspace/Git service file
- `src/locales/en.json`
- `src/locales/zh.json`
- `src-tauri/src/commands/chat_commands.rs` or new `workspace_commands.rs`
- `src-tauri/src/lib.rs`
- Potential new `src-tauri/src/services/workspace_service.rs`
