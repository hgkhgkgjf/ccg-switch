# Chat 功能完整性对标分析

**目标**: 深度对标 jetbrains-cc-gui 的交互式 Chat 能力，实现功能对等

**基准项目**: `C:\guodevelop\demo\jetbrains-cc-gui` (CodeGraph 已索引)

**当前状态**: MVP 已完成（commit `1f60294`），基础对话、SDK 管理、权限弹窗可用

**功能差距**: 13 个核心模块待实现

---

## 功能模块清单

### 1. 工具调用可视化 (ToolBlocks)

**当前状态**: ❌ 缺失，daemon 返回的 tool_use/tool_result 未解析

**jcc-gui 实现**:
- **核心组件**: `webview/src/components/toolBlocks/`
  - `GenericToolBlock.tsx` (通用工具块，671 行)
  - `BashToolBlock.tsx` / `BashToolGroupBlock.tsx` (Bash 命令执行，合并同类命令)
  - `EditToolBlock.tsx` / `EditToolGroupBlock.tsx` (文件编辑，支持 diff 预览)
  - `ReadToolBlock.tsx` / `ReadToolGroupBlock.tsx` (文件读取，合并同文件读取)
  - `SearchToolGroupBlock.tsx` (搜索结果聚合)
  - `AgentGroupBlock.tsx` (子代理调用)
  - `TaskExecutionBlock.tsx` (任务执行状态)

- **数据流**:
  1. daemon 返回 `{ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }, ...] } }`
  2. 前端解析 `content` 数组，识别 `tool_use` 块
  3. 匹配工具名称到对应 Block 组件
  4. 渲染折叠式卡片：工具名称、参数预览、展开/折叠、复制、重试按钮

- **交互**:
  - 默认折叠，点击展开显示完整参数
  - 代码块支持语法高亮
  - 文件路径可点击（链接到编辑器）
  - 支持复制参数/结果
  - Bash 命令显示执行状态（运行中/成功/失败）

**技术要点**:
- 解析 `content` 数组，区分 text / tool_use / tool_result
- 动态匹配工具类型到组件
- 工具块分组逻辑（同类型工具合并显示，如多次 Read 同一文件）

**复杂度**: ⭐⭐⭐⭐ (需设计通用 Block 架构 + 7 种专用组件)

---

### 2. Markdown 渲染

**当前状态**: ❌ 缺失，纯文本显示

**jcc-gui 实现**:
- **核心文件**: `webview/src/components/MarkdownBlock.tsx` (505 行)
- **技术栈**:
  - `marked` (Markdown → HTML 解析)
  - `highlight.js` (代码高亮，28 种语言)
  - `DOMPurify` (XSS 防护)
  - `mermaid` (流程图渲染，懒加载)

- **功能**:
  - 代码块高亮（支持 28 种语言：bash, python, typescript, rust...）
  - 代码块复制按钮（点击复制到剪贴板）
  - Mermaid 图表渲染（流程图、时序图、类图）
  - GFM 支持（表格、删除线、任务列表）
  - 自动链接识别（URL 转可点击链接）
  - 内联代码样式
  - 流式安全（处理未闭合代码块）

- **流式渲染优化**:
  - `renderStreamingContent()` 轻量级渲染（避免完整 marked 解析）
  - 未闭合代码块自动补全 \`\`\`
  - 逐行追加，避免全量重渲染

**复杂度**: ⭐⭐⭐ (集成现有库，关键是流式安全处理)

---

### 3. Thinking 内容显示

**当前状态**: ❌ 缺失

**jcc-gui 实现**:
- **核心组件**: `ContentBlockRenderer.tsx` 中的 thinking 块处理
- **数据来源**: daemon 流式返回 `[THINKING_DELTA]` 事件，或 snapshot 的 `{ type: "thinking", thinking: "..." }`

- **UI 样式**:
  - 灰色背景块，左侧有 💭 图标
  - 默认折叠（只显示标题 "Claude is thinking..."）
  - 点击展开显示完整推理过程
  - 内容用 Markdown 渲染

- **流式处理**:
  - `ai-bridge/services/claude/stream-event-processor.js`:
    - `processStreamEvent()` 处理 `content_block_delta` 的 `thinking_delta`
    - 累积到 `turnState.lastThinkingContent`
    - 发送 `[THINKING_DELTA]` 事件到前端

**复杂度**: ⭐⭐ (复用 Markdown 渲染 + 简单折叠组件)

---

### 4. 权限审批完整实现

**当前状态**: ⚠️ 部分完成，AskUserQuestion 和 PlanApproval 基础弹窗已有，缺 multiSelect 和状态持久化

**jcc-gui 实现**:
- **AskUserQuestion** (`webview/src/components/AskUserQuestionDialog.tsx`, 448 行):
  - **multiSelect 支持**: 复选框模式，可选多个选项
  - **Other 选项**: 允许用户输入自定义答案（textarea，最大 2000 字符）
  - **多问题流程**: 支持一次请求多个问题，逐步导航（上一步/下一步/提交）
  - **超时机制**: 默认 60 秒倒计时，时间不足时黄色警告
  - **折叠模式**: 最小化到右下角，不阻塞界面
  - **数据格式兼容**: 解析多种 JSON 格式（question/text, options/choices, label/value）

- **PlanApproval** (`webview/src/components/PlanApprovalDialog.tsx`):
  - **三种审批模式**: Reject / Apply / Apply Always
  - **Mode 切换**: 下拉选择 default / auto / bypassPermissions
  - **Plan 内容预览**: Markdown 渲染，支持滚动
  - **Allowed Prompts**: 展示批准的操作类型（Read, Write, Bash...）

- **后端写回**:
  - `permission_dir/<sessionId>/<requestId>.json` 文件写入响应
  - daemon 轮询读取并继续执行

**复杂度**: ⭐⭐⭐ (UI 交互逻辑复杂，但架构已有)

---

### 5. 会话历史统一

**当前状态**: ❌ 缺失，每次刷新会话丢失

**jcc-gui 实现**:
- **数据来源**: 
  - `~/.claude/projects/<project-hash>/conversations/<session-id>.jsonl`
  - 每条消息一行 JSON

- **UI 组件**: 
  - 左侧会话列表（`ConversationList.tsx`）
  - 支持搜索、筛选、重命名、删除
  - 显示会话标题、最后消息时间、消息数量

- **后端逻辑** (`ClaudeHistoryReader.java`):
  - 扫描 projects 目录
  - 解析 JSONL
  - 生成会话摘要（第一条 user 消息作为标题）

- **前端状态**:
  - 会话切换时加载历史消息
  - 合并历史消息 + 当前流式消息

**技术要点**:
- Rust 读取 JSONL（逐行解析，避免大文件内存爆炸）
- 前端虚拟滚动（历史消息可能上千条）
- 会话切换时清空流式状态

**复杂度**: ⭐⭐⭐⭐ (涉及文件系统扫描 + 大量数据处理)

---

### 6. 文件引用 (@file)

**当前状态**: ❌ 缺失

**jcc-gui 实现**:
- **触发器**: 输入框输入 `@` 显示文件选择器
- **选择器** (`AttachmentPicker.tsx`):
  - 模糊搜索（Fuzzy matching）
  - 支持相对路径和绝对路径
  - 文件类型图标（根据扩展名）
  - 最近使用文件优先

- **Attachment 结构**:
  ```typescript
  interface Attachment {
    id: string;
    fileName: string;
    mediaType: string; // "text/plain", "image/png", ...
    data: string; // base64 编码
  }
  ```

- **数据流**:
  1. 用户选择文件 → 读取内容 → base64 编码
  2. 附件添加到 `attachments` 数组
  3. 发送消息时，attachments 传递给 daemon
  4. daemon 包装成 `content: [{ type: "document", source: { data, media_type } }, ...]`

- **持久化**:
  - `useAttachmentPersistence.ts` 保存草稿到 localStorage（最大 2MB）
  - 会话切换时清空

**技术要点**:
- Rust 读取文件，检测 MIME 类型
- 大文件限制（如 10MB）
- 图片附件预览缩略图
- 多文件上传

**复杂度**: ⭐⭐⭐ (文件选择器 + MIME 检测 + base64 编码)

---

### 7. Web Diff 面板

**当前状态**: ❌ 缺失

**jcc-gui 实现**:
- **触发**: daemon 发送 `web_diff` 事件（交互式 Diff 审批）
- **后端** (`InteractiveDiffManager.java`, 432 行):
  - 使用 IntelliJ Diff 框架（双栏对比）
  - 左侧：original（只读）
  - 右侧：proposed（可编辑）
  - 三个按钮：Reject / Apply / Apply Always

- **前端对应**:
  - 需集成 Web Diff 库（候选：`monaco-diff`, `react-diff-view`）
  - 监听 `chat://diff` 事件
  - 渲染 Diff 查看器
  - 用户审批后写回 permission_dir

- **数据格式**:
  ```json
  {
    "type": "web_diff",
    "requestId": "...",
    "filePath": "...",
    "originalContent": "...",
    "newFileContents": "...",
    "isNewFile": false,
    "isReadOnly": true
  }
  ```

**技术要点**:
- Monaco Editor Diff 集成
- 语法高亮（根据文件扩展名）
- 编辑后内容回传
- 取消/超时处理

**复杂度**: ⭐⭐⭐⭐ (Diff 渲染 + 交互逻辑复杂)

---

### 8. Agent/MCP 状态展示

**当前状态**: ❌ 缺失

**jcc-gui 实现**:
- **MCP 服务器状态** (`McpSettingsSection.tsx`):
  - 服务器列表（名称、类型、状态）
  - 连接状态：connected / checking / error / unknown
  - 错误诊断（连接失败原因）
  - 重启服务器按钮

- **Agent 列表** (`AgentTab.tsx`):
  - 显示所有自定义 Agent
  - Agent 名称、Prompt 预览
  - 编辑/删除操作

- **状态监控**:
  - daemon 启动时检测 MCP 服务器
  - 定期心跳检测连接状态
  - 错误时显示诊断信息

**复杂度**: ⭐⭐ (主要是 UI 展示，状态来自现有数据)

---

### 9. Daemon 自动重启

**当前状态**: ❌ 缺失，崩溃后需手动重启

**jcc-gui 实现**:
- **后端** (`DaemonBridge.java` 的 `handleDaemonDeath()` 方法):
  - 检测 daemon 进程退出
  - 自动重启（最多 3 次，窗口期 60 秒）
  - 失败后显示友好错误提示

- **心跳机制**:
  - 每 10 秒发送 heartbeat
  - 超时 30 秒判定为死亡
  - 有活跃请求时延长超时到 120 秒

- **前端提示**:
  - Daemon 重启中显示 loading 状态
  - 失败后显示错误 banner + 手动重启按钮

**技术要点**:
- Rust Process 监控
- 重启计数和窗口期限制（避免无限重启）
- 状态通知到前端

**复杂度**: ⭐⭐⭐ (进程管理 + 重试策略)

---

### 10. 输入增强

**当前状态**: ⚠️ 部分完成，基础多行输入已有，缺草稿保存和快捷指令

**jcc-gui 实现**:
- **多行输入**: Shift+Enter 换行，Enter 发送（已实现 ✅）
- **草稿自动保存**:
  - `useChatInputDraft.ts` 保存到 localStorage
  - 会话切换时恢复草稿
  - 发送后清空

- **快捷指令** (Slash Commands):
  - 输入 `/` 显示命令列表
  - 命令提供者：`slashCommandProvider.ts`
  - 支持 Skill、Prompt、内置命令
  - 模糊搜索匹配

- **输入框增强**:
  - 文件拖放上传
  - 粘贴图片自动添加为附件
  - @ 触发文件选择器
  - / 触发命令补全

**复杂度**: ⭐⭐ (草稿保存简单，Slash Commands 需读取 Skill 列表)

---

### 11. 性能优化

**当前状态**: ❌ 未优化

**jcc-gui 实现**:
- **虚拟滚动** (`react-window`):
  - 消息列表超过 100 条时启用
  - 只渲染可见区域消息

- **流式内容防抖**:
  - `useStreamThrottle.ts` 限制渲染频率
  - 累积 50ms 的增量内容，合并渲染

- **大消息截断**:
  - 工具结果超过 10000 字符时折叠
  - "Show more" 按钮展开

- **Markdown 缓存**:
  - 已渲染的 Markdown 缓存结果
  - 内容未变时跳过重渲染

**复杂度**: ⭐⭐⭐ (虚拟滚动集成 + 防抖策略)

---

### 12. MCP 白名单强制

**当前状态**: ❌ 安全漏洞，daemon 的 MCP 白名单形同虚设

**jcc-gui 漏洞**:
- `ai-bridge/safety/permission-safety.js` 的 `checkMcpToolPermission()` 只警告不阻止

**修复方案**:
- GUI 层强制校验 MCP 工具调用
- 未授权工具直接拒绝，不传递给 daemon
- 维护 MCP 工具白名单（可配置）

**复杂度**: ⭐⭐ (逻辑简单，需设计白名单配置 UI)

---

### 13. Codex 审批前置

**当前状态**: ❌ 安全漏洞，Codex 命令审批有竞态

**jcc-gui 漏洞**:
- `ai-bridge/services/codex/codex-event-handler.js` 的审批逻辑有竞态

**修复方案**:
- Codex 请求到达 daemon 前先走前端审批
- 前端弹窗确认后才调用 daemon
- 超时自动拒绝

**复杂度**: ⭐ (简单前置检查)

---

## 优先级评估

### 高优先级（核心体验）
1. ⭐⭐⭐⭐ 工具调用可视化 — 最重要，直接影响可用性
2. ⭐⭐⭐ Markdown 渲染 — 基础体验
3. ⭐⭐ Thinking 内容显示 — 差异化功能
4. ⭐⭐⭐ 权限审批完整实现 — 安全性

### 中优先级（功能完整性）
5. ⭐⭐⭐⭐ 会话历史统一 — 持久化体验
6. ⭐⭐⭐ 文件引用 (@file) — 生产力提升
7. ⭐⭐⭐⭐ Web Diff 面板 — 代码审查必需
8. ⭐⭐ Agent/MCP 状态展示 — 可观测性

### 低优先级（优化体验）
9. ⭐⭐⭐ Daemon 自动重启 — 稳定性
10. ⭐⭐ 输入增强 — 便利性
11. ⭐⭐⭐ 性能优化 — 大量消息场景

### 安全修复（遗留）
12. ⭐⭐ MCP 白名单强制 — 安全漏洞
13. ⭐ Codex 审批前置 — 安全漏洞

---

## 实施策略

### 短期目标（1-2 周）
- 工具调用可视化（最高优先级，启用完整交互）
- Markdown 渲染（基础体验）
- Thinking 显示（快速实现）

### 中期目标（3-4 周）
- 权限审批完整化
- 会话历史
- @file 文件引用
- Web Diff 面板

### 长期目标（5-6 周）
- Agent/MCP 状态
- Daemon 自动重启
- 输入增强
- 性能优化
- 安全修复 2 项

---

## 技术债务

从 jcc-gui 逆向分析中发现的已知问题（避免复制）：

1. **路径校验漏洞** (permission-safety.js:206-210)
   - 使用 `includes()` 子串匹配，可被绕过
   - 应改用路径前缀锚定

2. **参数重写不完整** (permission-safety.js:62)
   - 只处理 `file_path`，漏掉 `path` 参数

3. **MCP 白名单形同虚设**
   - 只警告不阻止

4. **Codex 审批竞态**
   - 需前置到 GUI 层

5. **大文件内存问题**
   - 历史消息加载应分页/流式

6. **localStorage 容量限制**
   - Attachment 草稿最大 2MB，大图片无法保存
   - 应迁移到 IndexedDB

---

## 下一步

选择一个模块开始实施：

```bash
# 推荐从工具调用可视化开始（最高价值）
python ./.trellis/scripts/task.py create --title "工具调用可视化 (ToolBlocks)" --parent chat-feature-parity
```
