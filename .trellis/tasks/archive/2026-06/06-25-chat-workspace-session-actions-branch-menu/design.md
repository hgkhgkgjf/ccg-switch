# Design: Chat 工作目录切换、会话菜单与 Git 分支操作

## Architecture

本任务围绕一个核心事实收敛：`useChatStore.currentCwd` 是 Chat 当前工作目录的单一前端状态源。工作目录切换器、会话切换、新建会话、Git 状态、`@` 文件补全和工具打开文件都必须从这个状态派生，不能各自维护独立目录。

建议新增/调整以下边界：

- `useChatStore`: 增加显式 `setCurrentCwd(cwd: string | null)` 或扩展 `startNewSession(cwd)` 的调用路径，保证“只切目录但未发送消息”的空白初始态也能持久停留在目标目录。
- `ChatPage`: 把当前目录、项目列表、Git 状态刷新和上下文栏操作串起来；目录变化后重新加载 `ChatWorkspaceStatus`。
- `ContextBar` 或拆出的 `WorkspaceContextSwitcher`: 输入框上方展示工作目录与 Git 分支，负责菜单 UI，不直接读写后端历史文件。
- `ChatSessionSidebar`: 项目/会话行补右键菜单；菜单动作通过 props 或薄服务调用后端。
- Rust `chat_commands` / 新 `workspace_commands`: 提供只读 Git 分支列表、创建并检出分支、打开资源管理器、选择文件夹或接收前端 dialog 结果后的路径校验。
- 会话元数据服务：置顶、重命名、归档、未读等持久化不要写入 provider 原生日志主体，优先使用应用自有元数据文件或数据库。

## Data Flow

### Workspace switch

1. UI 点击工作目录芯片。
2. 菜单展示 `get_dashboard_projects()` 的项目列表和 `Open folder...`。
3. 用户选择项目或文件夹。
4. 前端调用 `useChatStore.setCurrentCwd(nextCwd)` 或 `startNewSession(nextCwd)`。
5. `ChatPage` 监听 `currentCwd` 变化并调用 `loadChatWorkspaceStatus(currentCwd)`。
6. `ChatComposer` 接收新 `cwd`，后续 `send()` 和 `useCompletions({cwd})` 使用新目录。

### Git branch menu

1. `ChatPage` 已有 `loadChatWorkspaceStatus(currentCwd)` 获取 `gitRoot/gitBranch`。
2. 点击分支芯片后调用 `chat_git_list_branches(cwd)`。
3. 后端验证目录存在并位于 Git 仓库，执行 `git -C <root> branch --format ...` 或等价命令。
4. 用户选择已有分支时可扩展为 checkout；本轮明确需要“创建并检出新分支”，调用 `chat_git_create_and_checkout_branch(cwd, branchName)`.
5. 成功后重新调用 `loadChatWorkspaceStatus(currentCwd)`。

### Context menu actions

1. 右键项目/会话行，菜单只拿当前行 `project.path` 或 `SessionMeta`。
2. 只读/安全动作直接执行：打开资源管理器。
3. 持久元数据动作调用后端元数据命令，成功后刷新项目/会话扫描结果。
4. 高风险动作（归档、派生工作树）若未建立契约，第一阶段显示但禁用或弹出“暂未实现”，不修改文件。

## Contracts

### Proposed Tauri commands

```rust
#[tauri::command]
pub fn chat_open_path_in_explorer(path: String) -> Result<(), String>
```

- `path`: 文件或目录路径。
- 成功：系统资源管理器打开目录；如果是文件，尽量选中文件。
- 错误：路径为空、包含控制字符、路径不存在、系统打开失败。

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGitBranch {
    pub name: String,
    pub current: bool,
}

#[tauri::command]
pub fn chat_git_list_branches(cwd: String) -> Result<Vec<ChatGitBranch>, String>

#[tauri::command]
pub fn chat_git_create_and_checkout_branch(cwd: String, branch_name: String) -> Result<ChatWorkspaceStatus, String>
```

- `cwd` 必须是现有目录；后端解析到 Git root。
- `branchName` 必须 trim 后非空，且通过本地校验与 `git check-ref-format --branch`。
- 不接受 shell 字符串拼接；使用 `Command::new("git").arg("-C").arg(root)...`。

```rust
#[tauri::command]
pub fn chat_session_rename(provider_id: String, session_id: String, title: String) -> Result<(), String>
```

- 第一阶段建议仅在已有会话标题服务可对齐时实现。
- 标题 trim 后非空，最大长度限制，写入应用自有元数据或现有 `session-titles-service` 对齐位置。

### Frontend types

- 新增 `ChatGitBranch` TypeScript interface，与 Rust camelCase 响应一致。
- 项目类型应从重复的局部 `ProjectInfo` 提取为共享类型或保持局部但字段一致；若新增服务层，优先放 `src/types/session.ts` 或新 `src/types/workspace.ts`。

## Boundary Conditions

- `currentCwd = null`: 显示 “No folder” / “未选择文件夹”，仍允许打开目录菜单。
- `projects = []`: 菜单只展示空态和 `Open folder...`。
- `sessions = []`: 会话区域不影响工作目录切换。
- `activeSession = null`: 切目录不得创建假历史会话 tab；只有发送消息、加载会话或有草稿时才保存 tab。
- 非 Git 目录：分支芯片隐藏或显示 “No Git repository”，分支菜单禁用创建分支。
- Git 命令失败：不改变前端分支显示，不清空当前会话。
- 路径不存在：打开资源管理器返回错误 toast。

## Risk Points

- 目录状态重复：侧栏 `selectedProjectPath`、store `currentCwd`、Composer `cwd` 若不同步，会出现 UI 显示 A 目录但发送到 B 目录。
- 空白初始态：当前 tab 逻辑曾经因只有 `currentCwd` 保留空白 tab，新增目录切换必须避免回归。
- Git 命令安全：禁止把分支名拼进 shell 字符串，必须参数化调用。
- 会话元数据持久化：如果只改前端缓存，刷新后会丢失；如果直接改 provider 原生日志，回归风险高。
- 右键菜单体积：项目和会话菜单很多操作，必须避免嵌套卡片和过宽菜单。

## Rollback

- 前端菜单和上下文栏可通过移除新组件引用回退，不影响核心 `send()`。
- 后端新增命令应为独立薄命令；若出现问题，可从 `invoke_handler` 移除并让 UI 禁用相关入口。
- Git 创建分支是外部副作用，测试和实现阶段必须使用临时仓库，不在真实工作区执行。

## Recommended Scope Split

第一阶段建议实现：

- 工作目录显示与切换。
- 空状态工作目录入口。
- 打开资源管理器。
- Git 分支展示、列表、创建并检出新分支。
- 会话重命名（如果能安全复用现有标题元数据）。
- 项目/会话右键菜单 UI，其中高风险或缺少契约的操作先禁用。

第二阶段再实现：

- 置顶/未读/归档的完整排序和过滤语义。
- 派生到本地、派生到新工作树。
- 项目重命名与永久工作树管理。
