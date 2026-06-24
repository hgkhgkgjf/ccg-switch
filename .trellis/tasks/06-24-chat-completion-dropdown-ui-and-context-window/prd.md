# Chat @ 补全下拉框 UI 对标与上下文窗口修正

## Goal

让 ChatComposer 输入框的 @/#/!// 补全下拉框在视觉与信息密度上对标参考项目 jcc-gui（图标 + 文件名/路径双列布局），并修正输入区"小圆圈"上下文用量环把 1M 上下文模型错算成 200K 的 bug。

## Background

- 当前补全菜单 `src/components/chat/composer/CompletionMenu.tsx` 无图标，label/description 上下堆叠，`@` 项 label 直接是整段 relPath，观感差。
- 参考实现 `jetbrains-cc-gui/webview/.../Dropdown/DropdownItem.tsx`：每项含类型图标，文件名与所在路径区分展示，hover 显示完整描述。
- 上下文用量环 `TokenIndicator` 的 `percentage = contextTokens / maxTokens`。`maxTokens` 来自 `constants.ts` 的 `contextWindowFor(model)`，对所有 Claude 模型硬编码返回 `200_000`。启用 1M 上下文的模型实际窗口是 1,000,000，导致百分比被放大 5 倍。
- sidecar（ai-bridge）已通过 `[1m]` 模型后缀 / `CLAUDE_CODE_DISABLE_1M_CONTEXT` 感知 1M 状态，但 `[USAGE]` 事件（`usage-utils.js`）未携带上下文窗口大小。

## Requirements

### R1 补全下拉框 UI 对标
- 每个补全项左侧展示 lucide 类型图标，按类型区分：文件、目录、命令(/)、子代理(#)、预设(!)。
- `@` 文件项采用"文件名 + 路径"双列布局：主文本显示文件名（目录加 `/`），副文本以弱化样式显示其所在相对路径；不再把整段 relPath 当作单一标题。
- 保留现有键盘导航（↑↓/Enter/Tab/Esc）、loading、empty、高亮、滚动进可视区行为。
- 与项目现有 DaisyUI + lucide-react 体系一致，支持暗色主题。

### R2 上下文窗口修正（优先后端推送）
- sidecar 在 `[USAGE]` 负载中附带 `max_tokens`（当前会话真实上下文窗口：1M 状态下 1,000,000，否则 200,000）。
- 前端 `TokenIndicator` 的 `maxTokens` 优先使用后端推送值；后端未提供时回退到 `contextWindowFor(model)` 静态表。
- 百分比、tooltip（`x% · used / max`）随真实窗口正确显示。

## Acceptance Criteria

- [ ] @ 补全下拉项有 lucide 图标，文件名与路径分列展示，目录项名称带 `/`。
- [ ] #/!// 三类补全项也有对应类型图标，布局一致。
- [ ] 键盘导航、loading、empty、hover 高亮、选中替换逻辑均不回归，现有相关测试通过。
- [ ] 启用 1M 上下文的会话，小圆圈 maxTokens 显示 1,000,000（tooltip 显示 1000k），百分比按 1M 计算。
- [ ] 未启用 1M 的会话仍按 200K 计算。
- [ ] `[USAGE]` 事件解析向后兼容：旧负载（无 max_tokens）下前端回退静态表，不报错。
- [ ] `npm run build` 通过，相关单测通过。

## Constraints

- 不改动补全数据来源命令（`chat_list_workspace_files` 等）契约。
- 国际化文案需同步 zh/en（若新增）。
- 修改 sidecar JS 后需重启 tauri dev 生效（HMR 不覆盖 sidecar）。

## Notes

- 涉及两个仓库层：前端 React 组件 + Rust 侧打包的 ai-bridge Node sidecar。
- 复杂任务：含 design.md + implement.md。
