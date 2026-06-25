# PRD: 迁移会话终端动作并移除独立 Workspaces 页面

## 1. 背景与目标

**背景**
- 旧的独立 Workspaces 页面承载过会话恢复、终端打开和会话预览等能力。
- Chat 模块现在已经拥有项目/会话侧边栏、最近会话、项目上下文菜单和会话上下文菜单。
- 用户希望工作区模块清理干净，不再保留独立 `/workspaces` 页面；会话终端动作应在 Chat 侧边栏完成。

**目标**
- Chat 侧边栏会话右键菜单提供两个终端动作：
  1. **在终端打开**：打开新的系统终端并切换到会话 `projectDir`。
  2. **恢复终端会话**：打开新的系统终端并执行会话扫描结果里的 `resumeCommand`。
- 删除独立 Workspaces 页面模块：
  - 删除 `src/pages/WorkspacesPage.tsx`。
  - 删除 `/workspaces` 路由。
  - 删除侧边栏 Workspaces 导航入口。
  - 清理仅供独立 Workspaces 页面使用的 i18n 文案。

**非目标**
- 不删除 Chat 内部的工作目录能力。`currentCwd`、workspace switcher、`@` 文件补全、Git 分支菜单、workspace status 仍是 Chat 发送和上下文展示的必要能力。
- 不删除 workspace metadata 存储。`workspace_metadata.rs` / `workspaceMetadataService.ts` 实际承载 Chat 项目/会话的置顶、归档、未读、重命名、移除状态。
- 不恢复 SessionsPage，不新增独立会话页面。
- 不实现 fork/worktree 等仍处于禁用占位的高风险动作。

---

## 2. 功能需求

### 2.1 在终端打开

**触发点**
- Chat 侧边栏会话行右键菜单：`在终端打开`。

**行为**
- 前端从 `session.projectDir` 取工作目录。
- 如果工作目录为空，Toast 提示“会话无有效工作目录”。
- 如果工作目录存在，调用 `chat_open_project_in_terminal({ projectDir })`。
- 后端校验路径非空、无控制字符、存在且是目录，然后根据平台打开终端并 `cd` 到目录。
- 失败时通过 Toast 展示错误。

### 2.2 恢复终端会话

**触发点**
- Chat 侧边栏会话行右键菜单：`恢复终端会话`。

**行为**
- 前端使用会话扫描结果里的 `session.resumeCommand`，不在 UI 里重新按 provider 拼接 CLI 参数。
- 如果 `resumeCommand` 为空，Toast 提示“会话无恢复命令”。
- 调用 `chat_resume_session_in_terminal({ resumeCommand, projectDir })`。
- 后端校验恢复命令非空且无控制字符；如果 `projectDir` 有效则先 `cd`，再执行 `resumeCommand`。
- 失败时通过 Toast 展示错误。

### 2.3 删除独立 Workspaces 页面

**行为**
- `/workspaces` 不再出现在主侧边栏或顶部导航。
- 应用路由不再注册 `/workspaces`。
- 独立页面文件删除。
- `nav.workspaces`、`dashboard.workspaces_desc` 和顶层 `workspaces.*` i18n namespace 删除。

---

## 3. 验收标准

### 3.1 功能验收
- [ ] Chat 侧边栏会话右键菜单有“在终端打开”和“恢复终端会话”两个菜单项。
- [ ] “在终端打开”调用 `chat_open_project_in_terminal`，参数为会话 `projectDir`。
- [ ] “恢复终端会话”调用 `chat_resume_session_in_terminal`，参数为会话 `resumeCommand` 和 `projectDir`，不再传旧的 `provider/sessionId` 组合。
- [ ] 缺少 `projectDir` 或 `resumeCommand` 时 Toast 可见提示。
- [ ] `/workspaces` 导航入口、路由和独立页面文件均已删除。

### 3.2 回归验收
- [ ] Chat 会话加载、置顶、归档、重命名、未读标记仍正常。
- [ ] Chat composer 工作目录切换、Git 分支状态、`@` 文件补全不受页面删除影响。
- [ ] Dashboard 项目统计和 Chat 项目列表仍可读取项目/会话数据。

### 3.3 质量验收
- [ ] 新增/更新前端回归测试覆盖导航入口删除和 `resumeCommand` 调用合同。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- [ ] `git diff --check` 通过。

---

## 4. 技术约束

- 前端 Tauri invoke 参数使用 camelCase：`projectDir`、`resumeCommand`。
- Rust 命令继续返回 `Result<(), String>`，错误由前端 Toast 展示。
- `resumeCommand` 由 provider session scanner 生成：
  - Claude: `claude --resume <sessionId>`
  - Codex: `codex resume <threadId>`
  - Gemini: `gemini --resume <sessionId>`
- 删除独立 Workspaces 页面时，不得删除 Chat 内部 workspace/cwd 相关命令和服务。

---

## 5. 风险与依赖

**风险**
- 误删 Chat workspace/cwd 能力会导致消息发送目录、文件补全和 Git 分支 UI 回归。
  - 缓解：仅删除独立页面、路由、导航和页面专属 i18n；保留 `chat_workspace_status`、`chat_list_workspace_files`、`workspaceMetadataService` 和 `workspace_metadata.rs`。
- `resumeCommand` 是命令字符串，仍依赖后端扫描器生成安全、正确的 CLI 命令。
  - 缓解：本轮保留控制字符校验；未来如需更强边界，可把恢复命令升级为结构化 `program + args`。
- 跨平台真实终端行为无法完全通过单元测试覆盖。
  - 缓解：本轮通过构建和命令注册验证，真实 Windows/macOS/Linux 终端启动留作手动验收项。

**依赖**
- `SessionMeta.resumeCommand` 已由 Claude / Codex / Gemini provider scanner 提供。
- Chat 会话右键菜单已具备菜单扩展和 Toast 错误提示路径。

---

## 6. 实施记录

- 已确认方案：独立 Workspaces 页面可删除，但 Chat 内部工作目录能力必须保留。
- 实现顺序：
  1. 增加导航删除回归测试，先确认旧 `/workspaces` 入口会失败。
  2. 删除 `/workspaces` 路由、导航入口、页面文件和页面专属 i18n。
  3. 增加 Chat 会话菜单测试，锁定 `resumeCommand` invoke 合同。
  4. 运行前端测试、构建、后端检查和 Trellis 检查。
