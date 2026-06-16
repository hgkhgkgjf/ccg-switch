# 后续待做（Phase 3+ 优化）

当前状态：端到端可对话的 MVP demo，与 cc-gui 完整能力差距很大。

## 高优先级（核心体验）

### 1. 工具调用可视化 (toolBlocks)
- [ ] 解析 daemon 返回的 tool_use/tool_result
- [ ] 前端渲染折叠式工具块（参考 jcc-gui 的 ToolBlock 组件）
- [ ] 支持展开/折叠、复制、重试

### 2. Markdown 渲染
- [ ] 集成 markdown 渲染库（react-markdown + remark-gfm）
- [ ] 代码高亮（rehype-highlight 或 prism）
- [ ] 支持代码块复制按钮

### 3. Thinking 内容显示
- [ ] 解析 `<thinking>` 标签
- [ ] 折叠式渲染（默认收起）

### 4. 权限审批完整实现
- [ ] AskUserQuestion 的 multiSelect 支持
- [ ] PlanApproval 的完整交互（approval mode 切换）
- [ ] 权限状态持久化

## 中优先级（功能完整性）

### 5. 会话历史统一
- [ ] 读取 `~/.claude/projects/<project>/conversations/` 现有会话
- [ ] 左侧会话列表（可切换）
- [ ] 会话重命名、删除

### 6. 文件引用 (@file)
- [ ] 解析 `@` 触发器
- [ ] 文件选择器（支持模糊搜索）
- [ ] attachment 传递给 daemon

### 7. Web Diff 面板
- [ ] 监听 daemon 的 web_diff 事件
- [ ] 嵌入式 diff 查看器（monaco-diff 或 react-diff-view）

### 8. Agent/MCP 状态展示
- [ ] MCP 服务器状态监控
- [ ] Agent 列表展示
- [ ] 错误诊断面板

## 低优先级（优化体验）

### 9. Daemon 自动重启
- [ ] 检测 daemon 崩溃
- [ ] 自动重启 + 重连
- [ ] 用户友好的错误提示

### 10. 输入增强
- [ ] 多行输入（Shift+Enter 换行）
- [ ] 草稿自动保存
- [ ] 快捷指令（/help, /clear）

### 11. 性能优化
- [ ] 消息虚拟滚动（react-window）
- [ ] stream 内容防抖（避免高频渲染）

## 安全修复（遗留 from jcc-gui）

### 12. MCP 白名单强制
- [ ] GUI 层强制 MCP 白名单（不依赖 daemon 自觉）

### 13. Codex 审批前置
- [ ] Codex 请求到达 daemon 前先走前端审批

---

## 如何继续

新会话启动后：
1. 读取本文件了解待办
2. 选一个优先级高的任务（如工具可视化）
3. 创建新 Trellis task：`python ./.trellis/scripts/task.py create`
4. 按 Phase 1 → 2 → 3 工作流推进

