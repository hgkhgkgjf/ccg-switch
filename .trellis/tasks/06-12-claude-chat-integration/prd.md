# 集成 Claude Code 交互能力

## Goal

将 jetbrains-cc-gui 的交互式 Claude Code 能力（聊天 / Agent / Diff / 权限）集成进
ccg-switch，从「配置管理器」升级为「配置管理 + AI 交互」一体化桌面应用。

## 已确认决策

1. 目标形态：完整移植交互能力
2. 桥接层：原样移植 ai-bridge 的 Node daemon，用 `tauri-plugin-shell` spawn
3. 前端 UI：用现有 DaisyUI/Tailwind 重写聊天组件（不引入 Antd）

## 架构

```
React(DaisyUI) ──invoke/event──► Rust(chat 模块) ──NDJSON/stdio──► ai-bridge daemon ──► Claude Code SDK
```

- 前端：`useChatStore`（Zustand）+ `ChatPage`，监听 `chat://stream` / `chat://done` / `chat://daemon` 事件
- Rust：`chat::DaemonClient`（端口自 Java `DaemonBridge`）+ `ChatManager` + `chat_commands`
- daemon：`src-tauri/resources/ai-bridge/`（随 bundle 打包，运行时 spawn）

## Requirements

### Phase 1 — 桥接基建（本次完成）
- [x] 移植 ai-bridge 到 `src-tauri/resources/ai-bridge`，bundle resources 打包
- [x] 修复 4 个安全问题中的 2 个（危险路径前缀锚定、path 字段重写）
- [x] `AI_BRIDGE_DEPS_DIR` 环境变量改造，SDK 装到 `~/.ccg-switch/ai-bridge-deps`
- [x] Rust `DaemonClient`：spawn、NDJSON 收发、requestId 解复用、心跳、优雅停止
- [x] Rust `ChatManager`：懒启动、生命周期事件转发、流式节流转发、心跳循环
- [x] `chat_commands`：chat_send / chat_abort / chat_is_running / chat_start_daemon
- [x] lib.rs 注册命令 + ChatState + 退出时 daemon shutdown

### Phase 2 — Claude 交互打通（本次完成 MVP）
- [x] 前端 `useChatStore` + `chat://*` 事件接入
- [x] daemon 标签行解析器（`daemonLineParser.ts`）
- [x] `ChatPage` 最小聊天 UI（DaisyUI）：发送 / 流式渲染 / 中止 / 清空 / provider 切换
- [x] 侧边栏导航 + 路由 + i18n（zh/en）

### Phase 2.5 — SDK 依赖安装（本次完成）
- [x] Rust `sdk_installer`：node/npm 探测、目录+package.json、`npm install --prefix`、
      日志流式回传、卸载、状态查询；Windows 经 `cmd /C` 路由 npm.cmd
- [x] 安装路径对齐 sdk-loader.js（`<deps>/dependencies/<sdkId>/node_modules/<pkg>`）
      —— 修复了缺少 `dependencies` 段会导致 daemon 找不到 SDK 的关键 bug
- [x] 安装后自动重启 daemon 以预加载新 SDK；`DaemonClient::restart`
- [x] 命令 chat_sdk_status / chat_install_sdk / chat_uninstall_sdk / chat_restart_daemon
- [x] 前端 `useSdkStore` + `SdkDependencyPanel` + ChatPage 缺失横幅/弹窗
- [x] **实测**：真实 npm 安装 @openai/codex-sdk 到预期路径，daemon
      isCodexSdkAvailable() 返回 true（端到端验证通过）

### Phase 3+ — 后续任务（未完成）
- [ ] 工具调用可视化（toolBlocks，DaisyUI 重写）
- [ ] 权限审批 IPC + 前端审批 UI（在此之前复杂任务需 bypassPermissions）
- [ ] Web Diff 组件 + 文件编辑 accept/reject
- [ ] Markdown 渲染（marked + highlight.js）
- [ ] 会话历史与现有 session_manager 只读历史统一
- [ ] Agent / MCP 探测整合 / @file 上下文 / prompt 增强
- [ ] 修复剩余 2 个安全问题（MCP 白名单强制、Codex 审批前置）
- [ ] node 运行时探测的健壮性增强 + daemon 自动重启

## Acceptance Criteria

- [x] ai-bridge daemon 可独立启动并完成 ready / heartbeat / send 往返（已实测）
- [x] 前端 `tsc --noEmit` 与 `vite build` 通过
- [x] Rust chat 模块外部 API 假设均经 crate 源码核对（tokio 1.49 / tauri 2.10）
- [ ] Rust `cargo check` 通过（本机缺 Windows SDK/RC.EXE，无法在此环境编译；
      需在装有 VS Build Tools + Windows SDK 的机器验证）
- [ ] 端到端：配置好 Claude 凭证后，在 Chat 页发消息能看到流式回复

## Notes / 已知限制

- 本机环境缺 Windows SDK（`rc.exe`/`cl.exe` 均不存在），无法运行 `cargo check`/构建。
  Rust 代码已逐文件核对依赖 API；需在完整 MSVC + Windows SDK 环境编译验证。
- Claude SDK 不随包分发，首次使用需安装到 `~/.ccg-switch/ai-bridge-deps/claude-sdk/`
  （`@anthropic-ai/claude-agent-sdk`）。后续需补「依赖安装」入口（对应源项目
  DependencyManager）。
- 权限审批 UI 未完成前，涉及工具/文件写入的复杂任务请使用 bypassPermissions 模式
  （仅在信任的工作目录），纯文本对话用 default 模式不受影响。
