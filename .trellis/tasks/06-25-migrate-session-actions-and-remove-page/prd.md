# PRD: Chat 会话右键菜单补"恢复终端会话"与"在终端打开"

## 1. 背景与目标

**背景**
- 用户希望从 Chat 侧边栏直接在系统终端里恢复某个会话继续对话，或在终端打开会话的工作目录。
- 当前 Chat 侧边栏会话右键菜单有置顶、归档、重命名、未读标记等操作，但缺少终端相关操作。
- SessionsPage（独立的会话页面）在早期版本已被移除，其终端操作功能未迁移到 Chat 模块。

**目标**
- Chat 侧边栏会话行右键菜单补两个菜单项：
  1. **恢复终端会话**：在新终端窗口里用 CLI 命令（`claude` / `codex` / `gemini`）恢复这个会话继续对话。
  2. **在终端打开**：在新终端窗口打开会话的工作目录（`cd` 到 `projectDir`）。

**非目标**
- 不改动 Chat 侧边栏现有的会话列表、分组、搜索、右键菜单布局逻辑。
- 不恢复或重建 SessionsPage（该页面已被移除且不复用）。

---

## 2. 功能需求

### 2.1 恢复终端会话

**触发点**
- Chat 侧边栏会话行右键菜单，新增菜单项"恢复终端会话"。

**行为**
- 点击后，打开新的系统终端窗口，执行命令恢复会话：
  - 根据会话的 `provider` 类型选择命令：
    - `claude` → `cd <projectDir> && claude --resume <sessionId>`
    - `codex` → `cd <projectDir> && codex --session <sessionId>`
    - `gemini` → `cd <projectDir> && gemini --session <sessionId>`
  - 如果 `projectDir` 为空或无效，忽略 `cd` 部分，直接执行 `<cli> --resume/--session <sessionId>`。
- 失败时通过 Toast 提示错误（如"无法打开终端：<错误信息>"）。

**Tauri 命令**
- 新增 `chat_resume_session_in_terminal(provider: String, session_id: String, project_dir: Option<String>) -> Result<(), String>`
  - 根据平台调用系统终端：
    - Windows: `cmd /c start cmd /K "cd /d <projectDir> && <cli> --resume <sessionId>"`
    - macOS: `open -a Terminal` + AppleScript 或 `osascript -e 'tell app "Terminal" to do script "cd <projectDir> && <cli> --resume <sessionId>"'`
    - Linux: `x-terminal-emulator -e bash -c "cd <projectDir> && <cli> --resume <sessionId>; exec bash"` 或检测常见终端（gnome-terminal / konsole / xterm）
  - 路径验证：拒绝空 `sessionId`、控制字符。
  - 权限：复用现有 `shell:allow-execute` 或 `shell:allow-open`。

**前端改动**
- `ChatSessionSidebar.tsx`：
  - 会话右键菜单补"恢复终端会话"菜单项，i18n key `chat.sessionMenu.resumeInTerminal`。
  - 点击后调用 `invoke('chat_resume_session_in_terminal', {provider: session.provider, sessionId: session.sessionId, projectDir: session.projectDir})`。
  - 失败时 `showToast(错误信息, 'error')`。

**国际化**
- `zh.json`：`"chat.sessionMenu.resumeInTerminal": "恢复终端会话"`
- `en.json`：`"chat.sessionMenu.resumeInTerminal": "Resume Session in Terminal"`

### 2.2 在终端打开

**触发点**
- Chat 侧边栏会话行右键菜单，新增菜单项"在终端打开"。

**行为**
- 点击后，打开新的系统终端窗口，`cd` 到会话的 `projectDir`：
  - Windows: `cmd /c start cmd /K "cd /d <projectDir>"`
  - macOS: `osascript -e 'tell app "Terminal" to do script "cd <projectDir>"'`
  - Linux: `x-terminal-emulator -e bash -c "cd <projectDir>; exec bash"` 或检测常见终端
- 如果 `projectDir` 为空或不存在，Toast 提示"会话无有效工作目录"。
- 失败时通过 Toast 提示错误。

**Tauri 命令**
- 新增 `chat_open_project_in_terminal(project_dir: String) -> Result<(), String>`
  - 根据平台调用系统终端，`cd` 到 `projectDir`。
  - 路径验证：拒绝空路径、不存在的目录、控制字符。
  - 权限：复用现有 `shell:allow-execute` 或 `shell:allow-open`。

**前端改动**
- `ChatSessionSidebar.tsx`：
  - 会话右键菜单补"在终端打开"菜单项，i18n key `chat.sessionMenu.openInTerminal`。
  - 点击后调用 `invoke('chat_open_project_in_terminal', {projectDir: session.projectDir})`。
  - 失败时 `showToast(错误信息, 'error')`。

**国际化**
- `zh.json`：`"chat.sessionMenu.openInTerminal": "在终端打开"`
- `en.json`：`"chat.sessionMenu.openInTerminal": "Open in Terminal"`

---

## 3. 验收标准

### 3.1 功能验收
- [ ] Chat 侧边栏会话右键菜单有"恢复终端会话"和"在终端打开"两个菜单项。
- [ ] 点击"恢复终端会话"，新终端窗口打开，执行 `<cli> --resume/--session <sessionId>`，会话恢复到对话界面。
- [ ] 点击"在终端打开"，新终端窗口打开，工作目录为会话的 `projectDir`。
- [ ] 操作失败时（终端不可用、路径无效等）Toast 提示错误。
- [ ] 跨平台验证：Windows / macOS / Linux 都能正常打开终端（如有条件）。

### 3.2 回归验证
- [ ] Chat 侧边栏现有会话操作（加载、置顶、归档、重命名、未读标记）功能正常。
- [ ] 会话右键菜单其他项（工作目录切换、Git 分支、项目操作等）不受影响。

### 3.3 质量验收
- [ ] 前端测试通过（受影响：ChatSessionSidebar 右键菜单渲染测试）。
- [ ] 后端测试通过（如新增命令，补单元测试验证路径校验与错误处理）。
- [ ] `npm run build` 干净，`cargo check` 通过。
- [ ] i18n key 在 `zh.json` / `en.json` 均已补全，无 missing translation。

---

## 4. 技术约束

- **Tauri 权限**：`shell:allow-execute` 或 `shell:allow-open` 需在 tauri.conf.json 内联 `main-capability` 中配置。
- **跨平台**：
  - Windows: `cmd /c start cmd /K "<command>"`
  - macOS: `osascript -e 'tell app "Terminal" to do script "<command>"'`
  - Linux: 检测常见终端（gnome-terminal / konsole / xterm），fallback 到 `x-terminal-emulator`
- **CLI 命令**：假设用户系统已安装 `claude` / `codex` / `gemini` CLI，且在 PATH 中可访问。如未安装，终端会报错"命令不存在"，用户自行处理。
- **会话 ID 格式**：
  - Claude: session ID 格式需确认（可能是 UUID 或文件路径）
  - Codex / Gemini: 同上
  - 如果 CLI 不支持 `--resume` / `--session` 参数，改为 `cd <projectDir> && <cli>`（不带会话 ID），只打开 CLI 到工作目录，用户手动恢复。

---

## 5. 风险与依赖

**风险**
- 用户系统未安装对应 CLI（`claude` / `codex` / `gemini`），或 CLI 不在 PATH 中，终端执行命令会失败。
  - 缓解：Toast 提示用户检查 CLI 安装，或在文档里说明前置条件。
- 不同 Linux 发行版的默认终端不一致，可能需要检测多个终端模拟器。
  - 缓解：提供 fallback 链（gnome-terminal → konsole → xterm → x-terminal-emulator）。
- CLI 的会话恢复参数可能不统一（`--resume` / `--session` / `--continue`），需逐个验证。
  - 缓解：PRD 阶段先假设统一参数，实现时根据实际 CLI 文档调整。

**依赖**
- Chat 侧边栏现有右键菜单架构支持扩展新菜单项（已验证，上轮任务补了 8 个元数据菜单项）。
- `shell:allow-execute` 或 `shell:allow-open` 权限已配置（需确认，可能需要补充）。
- 会话对象 `SessionMeta` 有 `provider`、`sessionId`、`projectDir` 字段（已存在）。

---

## 6. 实现优先级

推荐分两阶段实现：
1. **阶段 1**：先实现"在终端打开"（只需打开终端 + cd 到目录，无需处理 CLI 会话恢复参数）。
2. **阶段 2**：再实现"恢复终端会话"（需验证各 CLI 的会话恢复参数，复杂度更高）。

如果用户希望一次实现两个功能，可同步进行，但需要提前确认各 CLI 的会话恢复命令格式。

---

## 7. 里程碑

1. **需求确认**：确认"恢复终端会话"与"在终端打开"的具体行为、CLI 命令格式、跨平台终端调用方式（本轮已明确）。
2. **实现**：backend 新增两个命令，frontend 补右键菜单项 + i18n。
3. **验证**：前后端测试 + 跨平台手动验证（如有条件）+ build 验证。

- [ ] 跨平台验证：Windows / macOS / Linux 都能正常打开（如有条件）。

### 3.2 回归验证
- [ ] Chat 侧边栏现有会话操作（加载、置顶、归档、重命名、未读标记）功能正常。
- [ ] 会话右键菜单其他项（工作目录切换、Git 分支、项目操作等）不受影响。

### 3.3 质量验收
- [ ] 前端测试通过（受影响：ChatSessionSidebar 右键菜单渲染测试）。
- [ ] 后端测试通过（如新增命令，补单元测试验证路径校验与错误处理）。
- [ ] `npm run build` 干净，`cargo check` 通过。
- [ ] i18n key 在 `zh.json` / `en.json` 均已补全，无 missing translation。

---

## 4. 技术约束

- **Tauri 权限**：`shell:allow-open` 已在 tauri.conf.json 内联 `main-capability` 中，新增命令可直接复用。
- **跨平台**：
  - 方案 A（`shell::open`）：Windows / macOS / Linux 都支持用默认程序打开文件。
  - 方案 B（`chat_open_in_explorer`）：已有跨平台路径处理，Windows 用 `explorer /select`，macOS 用 `open -R`，Linux 用 `xdg-open`。
- **i18n**：新增菜单项文案需同步 `zh.json` / `en.json`。

---

## 5. 风险与依赖

**风险**
- 用户系统未配置 .jsonl 文件的默认编辑器，`shell::open` 可能无操作或弹系统选择器。
  - 缓解：方案 A 失败时回退方案 B（文件管理器打开目录），或 Toast 提示用户手动配置默认编辑器。
  
**依赖**
- Chat 侧边栏现有右键菜单架构支持扩展新菜单项（已验证，上轮任务补了 8 个元数据菜单项）。
- `shell:allow-open` 权限已配置。
- 会话对象 `SessionMeta` 有 `sourcePath` 字段（已存在，Chat 模块加载会话时使用）。

---

## 6. 实现方案选择

推荐**方案 A**（新增 `chat_open_session_file` 用 `shell::open`）：
- 用户体验更直接（编辑器直接打开文件，无需再从文件管理器点击）。
- 代码更简洁（一行 `shell::open`，无需跨平台文件管理器命令拼接）。
- 失败时可 fallback 到方案 B。

备选**方案 B**（复用 `chat_open_in_explorer`）：
- 无需新增命令，复用现有代码。
- 但用户需额外点击文件管理器里的 .jsonl 文件才能用编辑器打开，多一步操作。

---

## 7. 里程碑

1. **需求确认**：SessionsPage 已不存在，唯一需求是 Chat 侧边栏补"打开会话文件"菜单项（已确认）。
2. **实现**：backend 新增命令（或复用现有），frontend 补右键菜单项 + i18n。
3. **验证**：前后端测试 + 跨平台手动验证（如有条件）+ build 验证。


