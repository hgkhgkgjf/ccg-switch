# Chat 功能完整性对标

## Goal

深度对标 jetbrains-cc-gui 的交互式 Chat 能力，通过 CodeGraph 深度追踪其每个功能实现，建立 13 个独立子任务，实现功能对等。

## Background

**当前状态 (MVP 已完成)**:
- 基础对话能力：用户输入 → daemon 调用 → 流式响应 ✅
- SDK 依赖管理：安装/卸载 Claude SDK / Codex SDK ✅
- 权限弹窗基础版：AskUserQuestion / PlanApproval 基础交互 ✅
- Daemon 生命周期管理：启动/停止/状态监控 ✅

**参考项目**: `C:\guodevelop\demo\jetbrains-cc-gui` (CodeGraph 已索引，55MB 数据库)

**功能差距**: 13 个核心功能模块未实现，详见 `FEATURE_ANALYSIS.md`

## Requirements

### 13 个子任务（按优先级分组）

#### 高优先级 - 核心体验
1. **工具调用可视化 (ToolBlocks)** ⭐⭐⭐⭐
   - 解析 tool_use/tool_result
   - 7 种专用组件：Generic / Bash / Edit / Read / Search / Agent / Task
   - 折叠/展开、复制、重试交互

2. **Markdown 渲染** ⭐⭐⭐
   - marked + highlight.js + DOMPurify + mermaid
   - 代码高亮（28 种语言）+ 代码复制按钮
   - 流式安全处理

3. **Thinking 内容显示** ⭐⭐
   - 解析 THINKING_DELTA 事件
   - 折叠式灰色块 + Markdown 渲染

4. **权限审批完整实现** ⭐⭐⭐
   - AskUserQuestion multiSelect 支持
   - PlanApproval 完整交互
   - 状态持久化

#### 中优先级 - 功能完整性
5. **会话历史统一** ⭐⭐⭐⭐
   - 读取 ~/.claude/projects/*/conversations/*.jsonl
   - 左侧会话列表 + 切换/重命名/删除

6. **文件引用 (@file)** ⭐⭐⭐
   - @ 触发文件选择器 + 模糊搜索
   - base64 编码传递 + localStorage 草稿持久化

7. **Web Diff 面板** ⭐⭐⭐⭐
   - 监听 web_diff 事件
   - Monaco Diff 集成 + 双栏对比 + 编辑
   - Apply / Reject 交互

8. **Agent/MCP 状态展示** ⭐⭐
   - MCP 服务器状态列表 + 连接诊断
   - Agent 列表管理

#### 低优先级 - 优化体验
9. **Daemon 自动重启** ⭐⭐⭐
   - 进程死亡检测 + 自动重启（最多 3 次）

10. **输入增强** ⭐⭐
    - 草稿自动保存 + Slash Commands 补全

11. **性能优化** ⭐⭐⭐
    - 虚拟滚动 (react-window) + 流式内容防抖

#### 安全修复 - 遗留漏洞
12. **MCP 白名单强制** ⭐⭐
    - GUI 层强制校验 + 可配置白名单

13. **Codex 审批前置** ⭐
    - 前端前置检查 + 超时自动拒绝

### Constraints

- **前端**: React 19 + TypeScript + DaisyUI（不引入 Antd）
- **后端**: Rust (Tauri 2)，复用现有 daemon_client 架构
- **数据流**: 保持现有事件协议（chat://stream, chat://done）
- **兼容性**: ai-bridge 原样移植，兼容现有会话格式

## Acceptance Criteria

### 功能完整性
- [ ] 13 个子任务全部完成并通过 trellis-check
- [ ] 每个模块有对应的集成测试
- [ ] 文档完整（每个模块的 README）

### 对标验证
- [ ] 工具调用可视化：7 种 ToolBlock 行为与 jcc-gui 一致
- [ ] Markdown 渲染：代码高亮、Mermaid、复制按钮功能对等
- [ ] 会话历史：加载 jcc-gui 历史会话文件无错误
- [ ] Diff 面板：Apply/Reject 流程与 jcc-gui 一致

### 性能标准
- [ ] 1000 条消息加载时间 < 2 秒（虚拟滚动）
- [ ] 流式渲染帧率 > 30 FPS（防抖优化）
- [ ] Daemon 崩溃恢复时间 < 5 秒

### 安全标准
- [ ] MCP 白名单强制生效（未授权工具拒绝）
- [ ] Markdown XSS 防护（DOMPurify 配置正确）
- [ ] 路径遍历攻击防护（文件引用校验）

## Milestones

- **M1: 核心体验** (Week 1-2) - 工具可视化、Markdown、Thinking
- **M2: 功能完整性** (Week 3-4) - 权限、会话历史、@file
- **M3: 高级特性** (Week 5-6) - Diff、Agent/MCP、自动重启
- **M4: 优化 & 安全** (Week 7-8) - 输入增强、性能、安全修复

## Notes

- 这是一个**父任务**，不直接实现代码，通过 13 个子任务完成
- 每个子任务独立开发、测试、提交
- 详细功能分析见 `FEATURE_ANALYSIS.md`
- CodeGraph 追踪结果见子任务的 research/ 目录
