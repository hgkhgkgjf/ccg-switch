# Input Enhancement — 发送控制台对标

## Goal

把 cc-gui（jcc-gui）发送控制台的交互能力移植进 ccg-switch 的 ChatPage 输入区，
用现有 DaisyUI + Tailwind + lucide 重写（不引入 Antd / codicon）。

参考来源：`jetbrains-cc-gui/webview/src/components/ChatInputBox/`
（ContextBar / ButtonArea / 各 selector / 补全系统）。

## Requirements

### 1. 底部控制工具栏（ButtonArea）
- Provider 选择（Claude / Codex）
- 权限模式选择（default / plan / acceptEdits / bypassPermissions），bypass 用警告色高亮
- 模型选择（按 provider 切换列表；Claude 5 个、Codex 5 个）
- 推理强度选择（reasoning effort：low/medium/high/xhigh/max），按模型能力动态显隐档位
- Prompt 增强按钮（sparkle）
- 发送 / 停止按钮（流式中显示停止）

### 2. 顶部上下文栏（ContextBar）
- 附件按钮（触发文件选择）
- token 用量环形指示器（百分比 + hover 明细，按模型上下文窗口估算）
- 文件上下文占位/芯片（@file 选中后显示，可清除）
- 状态面板折叠开关（占位，可后续接 StatusPanel）

### 3. 富输入提示
- 占位文案提示 @文件 / #子代理 / !预设 / Enter 发送
- 草稿自动保存（localStorage，按 provider 维度）
- 补全系统：`@`→工作目录文件、`#`→子代理、`!`→Prompt 预设、`/`→Slash 命令
- 键盘导航（↑↓ 选择、Enter/Tab 确认、Esc 关闭）

### 4. Prompt 增强按钮
- 一键润色当前输入（弹窗对比原文/增强版，可采用或保留）
- 复用 `ai-bridge/services/prompt-enhancer.js`

## Constraints
- 仅用 DaisyUI / Tailwind / lucide-react，禁止 Antd / codicon
- 新增文案同时更新 zh.json + en.json
- 发送参数（model / permissionMode / reasoningEffort）直连 daemon，不做死 UI
- 新增 Tauri 命令需在 lib.rs 注册

## Acceptance Criteria

- [ ] 底部工具栏四个选择器可切换并影响发送参数
- [ ] 推理强度按模型动态显隐，Haiku 隐藏该选择器
- [ ] token 用量环随对话累积更新
- [ ] @ / # / ! / / 四类补全可触发、可键盘选择、可插入
- [ ] 草稿在切换页面后保留
- [ ] Prompt 增强按钮可润色输入
- [ ] `cargo check` 与 `tsc --noEmit` 通过
- [ ] zh/en 文案齐全

## Notes
- 工作目录补全暂以用户主目录为根（无 workspace 概念时的降级）。
- StatusPanel / 消息队列 / rewind 等先占位，留给后续任务。
