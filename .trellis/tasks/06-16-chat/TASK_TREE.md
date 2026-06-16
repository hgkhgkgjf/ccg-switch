# Chat 功能完整性对标 - 任务树

**创建时间**: 2026-06-16  
**状态**: Planning (0/13 子任务完成)  
**参考项目**: jetbrains-cc-gui (CodeGraph 已索引)

---

## 任务结构

```
06-16-chat/ (父任务)
├── 高优先级 - 核心体验
│   ├── 06-16-toolblocks/              ⭐⭐⭐⭐ 工具调用可视化
│   ├── 06-16-markdown/                ⭐⭐⭐ Markdown 渲染
│   ├── 06-16-thinking/                ⭐⭐ Thinking 内容显示
│   └── 06-16-permission-approval-enhancement/  ⭐⭐⭐ 权限审批完整实现
│
├── 中优先级 - 功能完整性
│   ├── 06-16-session-history-management/  ⭐⭐⭐⭐ 会话历史统一
│   ├── 06-16-file-reference-file/     ⭐⭐⭐ 文件引用 (@file)
│   ├── 06-16-web-diff-panel/          ⭐⭐⭐⭐ Web Diff 面板
│   └── 06-16-agent-and-mcp-status-display/  ⭐⭐ Agent/MCP 状态展示
│
├── 低优先级 - 优化体验
│   ├── 06-16-daemon-auto-restart/     ⭐⭐⭐ Daemon 自动重启
│   ├── 06-16-input-enhancement/       ⭐⭐ 输入增强
│   └── 06-16-performance-optimization/  ⭐⭐⭐ 性能优化
│
└── 安全修复 - 遗留漏洞
    ├── 06-16-mcp-whitelist-enforcement/  ⭐⭐ MCP 白名单强制
    └── 06-16-codex-approval-pre-check/   ⭐ Codex 审批前置
```

---

## 子任务详情

### 1. 工具调用可视化 (ToolBlocks)
**任务**: `06-16-toolblocks/`  
**优先级**: ⭐⭐⭐⭐ High  
**复杂度**: 高（需设计通用架构 + 7 种专用组件）

**功能点**:
- 解析 daemon 返回的 `tool_use` / `tool_result` 块
- 实现 7 种专用工具块组件：
  - GenericToolBlock (通用，671 行)
  - BashToolBlock / BashToolGroupBlock (Bash 命令执行)
  - EditToolBlock / EditToolGroupBlock (文件编辑 + diff 预览)
  - ReadToolBlock / ReadToolGroupBlock (文件读取合并)
  - SearchToolGroupBlock (搜索结果聚合)
  - AgentGroupBlock (子代理调用)
  - TaskExecutionBlock (任务执行状态)
- 交互功能：折叠/展开、复制参数、重试、文件路径点击

**参考文件** (jcc-gui):
- `webview/src/components/toolBlocks/*.tsx`
- `webview/src/utils/messageUtils.ts`

---

### 2. Markdown 渲染
**任务**: `06-16-markdown/`  
**优先级**: ⭐⭐⭐ High  
**复杂度**: 中（集成现有库，关键是流式安全）

**功能点**:
- 集成 marked + highlight.js + DOMPurify + mermaid
- 代码高亮（28 种语言：bash, python, typescript, rust...）
- 代码块复制按钮
- Mermaid 图表渲染（流程图、时序图、类图）
- GFM 支持（表格、删除线、任务列表）
- 流式安全处理（未闭合代码块自动补全）

**参考文件** (jcc-gui):
- `webview/src/components/MarkdownBlock.tsx` (505 行)

---

### 3. Thinking 内容显示
**任务**: `06-16-thinking/`  
**优先级**: ⭐⭐ Medium  
**复杂度**: 低（复用 Markdown 渲染 + 简单折叠组件）

**功能点**:
- 解析 `[THINKING_DELTA]` 事件
- 灰色背景块，左侧 💭 图标
- 默认折叠（标题："Claude is thinking..."）
- 点击展开显示完整推理过程
- 内容用 Markdown 渲染

**参考文件** (jcc-gui):
- `webview/src/components/MessageItem/ContentBlockRenderer.tsx`
- `ai-bridge/services/claude/stream-event-processor.js`

---

### 4. 权限审批完整实现
**任务**: `06-16-permission-approval-enhancement/`  
**优先级**: ⭐⭐⭐ High  
**复杂度**: 中（UI 交互逻辑复杂，但架构已有）

**功能点**:
- **AskUserQuestion**:
  - multiSelect 支持（复选框模式）
  - Other 选项（自定义输入，最大 2000 字符）
  - 多问题流程（上一步/下一步/提交）
  - 超时机制（60 秒倒计时 + 黄色警告）
  - 折叠模式（最小化到右下角）
- **PlanApproval**:
  - 三种审批模式：Reject / Apply / Apply Always
  - Mode 切换（default / auto / bypassPermissions）
  - Plan 内容预览（Markdown 渲染）
- 状态持久化（permission_dir 写入响应）

**参考文件** (jcc-gui):
- `webview/src/components/AskUserQuestionDialog.tsx` (448 行)
- `webview/src/components/PlanApprovalDialog.tsx`

---

### 5. 会话历史统一
**任务**: `06-16-session-history-management/`  
**优先级**: ⭐⭐⭐⭐ High  
**复杂度**: 高（涉及文件系统扫描 + 大量数据处理）

**功能点**:
- 读取 `~/.claude/projects/<project-hash>/conversations/<session-id>.jsonl`
- 左侧会话列表（搜索、筛选、重命名、删除）
- 显示会话标题、最后消息时间、消息数量
- 会话切换时加载历史消息
- 合并历史消息 + 当前流式消息
- 虚拟滚动（历史消息可能上千条）

**参考文件** (jcc-gui):
- `src/main/java/com/github/claudecodegui/provider/claude/ClaudeHistoryReader.java`
- `webview/src/components/ConversationList.tsx`

---

### 6. 文件引用 (@file)
**任务**: `06-16-file-reference-file/`  
**优先级**: ⭐⭐⭐ Medium  
**复杂度**: 中（文件选择器 + MIME 检测 + base64 编码）

**功能点**:
- 输入框输入 `@` 显示文件选择器
- 模糊搜索（Fuzzy matching）
- 支持相对路径和绝对路径
- 文件类型图标（根据扩展名）
- 最近使用文件优先
- 大文件限制（如 10MB）
- 图片附件预览缩略图
- localStorage 草稿持久化（最大 2MB）

**参考文件** (jcc-gui):
- `webview/src/components/ChatInputBox/hooks/useAttachmentPersistence.ts`
- `webview/src/components/ChatInputBox/hooks/useAttachmentHandlers.ts`

---

### 7. Web Diff 面板
**任务**: `06-16-web-diff-panel/`  
**优先级**: ⭐⭐⭐⭐ High  
**复杂度**: 高（Diff 渲染 + 交互逻辑复杂）

**功能点**:
- 监听 daemon 的 `web_diff` 事件
- 集成 Monaco Editor Diff（或 react-diff-view）
- 双栏对比（左侧 original 只读，右侧 proposed 可编辑）
- 语法高亮（根据文件扩展名）
- 三个按钮：Reject / Apply / Apply Always
- 编辑后内容回传
- 取消/超时处理

**参考文件** (jcc-gui):
- `src/main/java/com/github/claudecodegui/handler/diff/InteractiveDiffManager.java` (432 行)

---

### 8. Agent/MCP 状态展示
**任务**: `06-16-agent-and-mcp-status-display/`  
**优先级**: ⭐⭐ Medium  
**复杂度**: 低（主要是 UI 展示）

**功能点**:
- MCP 服务器状态列表（名称、类型、状态）
- 连接状态：connected / checking / error / unknown
- 错误诊断（连接失败原因）
- 重启服务器按钮
- Agent 列表（显示所有自定义 Agent）
- Agent 名称、Prompt 预览
- 编辑/删除操作

**参考文件** (jcc-gui):
- `webview/src/components/settings/hooks/useAgentManagement.ts`
- `webview/src/types/mcp.ts`

---

### 9. Daemon 自动重启
**任务**: `06-16-daemon-auto-restart/`  
**优先级**: ⭐⭐⭐ Medium  
**复杂度**: 中（进程管理 + 重试策略）

**功能点**:
- 检测 daemon 进程退出
- 自动重启（最多 3 次，窗口期 60 秒）
- 失败后显示友好错误提示
- 心跳机制（每 10 秒发送 heartbeat，超时 30 秒判定为死亡）
- 有活跃请求时延长超时到 120 秒
- 前端显示"重新连接中..." + 手动重启按钮

**参考文件** (jcc-gui):
- `src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java` (`handleDaemonDeath()` 方法)

---

### 10. 输入增强
**任务**: `06-16-input-enhancement/`  
**优先级**: ⭐⭐ Low  
**复杂度**: 低（草稿保存简单，Slash Commands 需读取 Skill 列表）

**功能点**:
- 草稿自动保存（localStorage，会话切换时恢复）
- Slash Commands 补全（输入 `/` 显示命令列表）
- 命令提供者（Skill、Prompt、内置命令）
- 模糊搜索匹配
- 文件拖放上传
- 粘贴图片自动添加为附件

**参考文件** (jcc-gui):
- `webview/src/components/ChatInputBox/providers/slashCommandProvider.ts` (259 行)
- `src/main/java/com/github/claudecodegui/skill/SlashCommandRegistry.java`

---

### 11. 性能优化
**任务**: `06-16-performance-optimization/`  
**优先级**: ⭐⭐⭐ Medium  
**复杂度**: 中（虚拟滚动集成 + 防抖策略）

**功能点**:
- 虚拟滚动（react-window，消息超过 100 条时启用）
- 流式内容防抖（累积 50ms 的增量内容，合并渲染）
- 大消息截断（工具结果超过 10000 字符时折叠）
- Markdown 缓存（已渲染的内容缓存结果）

**参考文件** (jcc-gui):
- `webview/src/hooks/useStreamThrottle.ts`

---

### 12. MCP 白名单强制
**任务**: `06-16-mcp-whitelist-enforcement/`  
**优先级**: ⭐⭐ Medium  
**复杂度**: 低（逻辑简单，需设计白名单配置 UI）

**功能点**:
- GUI 层强制校验 MCP 工具调用
- 未授权工具直接拒绝，不传递给 daemon
- 维护 MCP 工具白名单（可配置）
- 修复 jcc-gui 的安全漏洞（ai-bridge 只警告不阻止）

**参考漏洞** (jcc-gui):
- `ai-bridge/safety/permission-safety.js` (`checkMcpToolPermission()` 只警告)

---

### 13. Codex 审批前置
**任务**: `06-16-codex-approval-pre-check/`  
**优先级**: ⭐ Low  
**复杂度**: 低（简单前置检查）

**功能点**:
- Codex 请求到达 daemon 前先走前端审批
- 前端弹窗确认后才调用 daemon
- 超时自动拒绝
- 修复 jcc-gui 的竞态问题

**参考漏洞** (jcc-gui):
- `ai-bridge/services/codex/codex-event-handler.js` (审批逻辑有竞态)

---

## 实施策略

### 短期目标 (Week 1-2) - M1: 核心体验
1. 工具调用可视化（启动最重要功能）
2. Markdown 渲染（基础体验）
3. Thinking 显示（快速实现）

**验收**: 基础对话体验与 jcc-gui 对等

### 中期目标 (Week 3-4) - M2: 功能完整性
4. 权限审批完整化
5. 会话历史
6. @file 文件引用
7. Web Diff 面板

**验收**: 生产力工具完备，可日常使用

### 长期目标 (Week 5-6) - M3: 高级特性
8. Agent/MCP 状态
9. Daemon 自动重启

**验收**: 可观测性和稳定性提升

### 优化阶段 (Week 7-8) - M4: 优化 & 安全
10. 输入增强
11. 性能优化
12. MCP 白名单强制
13. Codex 审批前置

**验收**: 性能达标，安全漏洞修复

---

## 工作流程

每个子任务遵循 Trellis 标准流程：

1. **Phase 1: Plan** (planning)
   - 读取 `FEATURE_ANALYSIS.md` 对应模块
   - 用 CodeGraph 追踪 jcc-gui 实现细节
   - 填充 prd.md / design.md / implement.md
   - 审查后 `task.py start` → status=in_progress

2. **Phase 2: Execute** (in_progress)
   - 按 implement.md 清单逐步实现
   - 遵循前端/后端开发规范（.trellis/spec/）
   - 编写单元测试
   - 运行 `trellis-check` 质量检查

3. **Phase 3: Finish** (completed → archived)
   - 端到端测试
   - 更新 spec（如有新规范）
   - Git commit
   - `task.py archive`

---

## 参考资源

### jcc-gui 源码
- **路径**: `C:\guodevelop\demo\jetbrains-cc-gui`
- **CodeGraph**: 已索引（55MB 数据库）
- **关键目录**:
  - `webview/src/components/toolBlocks/` - 工具块实现
  - `webview/src/components/MessageItem/` - 消息渲染
  - `ai-bridge/services/claude/` - daemon 事件处理
  - `src/main/java/.../handler/diff/` - Diff 面板

### 项目规范
- `.trellis/spec/frontend/index.md` - 前端开发规范
- `.trellis/spec/backend/index.md` - 后端开发规范
- `.trellis/workflow.md` - Trellis 工作流

### 已完成工作
- MVP 对话能力（commit `1f60294`）
- NEXT.md 待办清单（`.trellis/tasks/archive/.../NEXT.md`）

---

## 进度追踪

使用以下命令查看任务进度：

```bash
# 查看所有任务
python ./.trellis/scripts/task.py list

# 查看当前任务
python ./.trellis/scripts/task.py current

# 切换到子任务
cd .trellis/tasks/06-16-toolblocks/
```

**当前状态**: 0/13 子任务完成  
**预计完成**: 2026-08-11 (8 weeks)
