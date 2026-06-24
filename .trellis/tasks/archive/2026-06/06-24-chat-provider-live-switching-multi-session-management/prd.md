# Chat provider live switching and multi-session management

## Goal

让 Chat 的模型/服务商切换、多会话切换和最近会话入口具备可持续工作的体验：

- 用户切换后台服务商配置或 Chat 运行时提供方后，下一轮发送必须立即使用新的 provider/model 配置，不需要重启 Tauri app 或 ai-bridge daemon。
- 用户切换到其他历史会话或新会话时，正在输出的原会话不能被前端主动中断；原请求完成后仍能归属到发起它的会话。
- Chat 页面提供类似浏览器的顶部会话 tab，支持快速切换已打开/最近使用的会话。
- 最近聊天管理按项目目录分组展示会话，减少用户反复在项目/会话列表中查找的成本。

这里的“服务商”需要区分两层：

- Chat 运行时提供方：`claude` / `codex`。
- 后台服务商配置：Provider 表里的 API Key / Base URL / 默认模型等 Claude/Codex 配置。

本任务需要同时保证这两层切换的下一轮请求生效。

## Confirmed Facts

- 当前仓库是 Tauri + React + TypeScript；Chat 全局状态集中在 `src/stores/useChatStore.ts`。
- `useChatStore` 当前只有一份全局 transcript 状态：`messages`、`provider`、`model`、`activeRequestId`、`sessionId`、`activeSession`、`currentCwd`。
- `setProvider()`、`setModel()`、`setPermissionMode()`、`setLongContextEnabled()`、`setReasoningEffort()` 当前在 `hasActiveChatTurn(get())` 为真时直接 return，导致正在输出时无法切换运行时配置。
- `loadSession()` 和 `startNewSession()` 当前会通过 `abortActiveRequestIfNeeded()` 调用 `chat_abort`，因此切换历史会话或新建会话会主动中断当前请求。
- 后端 `ChatManager` 只缓存一个 `DaemonClient`；`DaemonClient` 支持 request id demux，但 Node daemon 的命令请求在 `daemon.js` 中串行排队，因为 stdout interception 依赖全局 `activeRequestId`。
- Node daemon 的 abort 是全局 active turn abort，不是按 session/request 精确 abort。
- Claude persistent runtime 支持按 session/runtime signature 复用，并支持动态 `setModel` / `setPermissionMode` / `setMaxThinkingTokens`，但 daemon 请求执行仍串行。
- `ChatManager::get_active_provider_config()` 只在 `DaemonClient` 首次创建时读取当前 Claude Provider 的 API Key/Base URL。后台 Provider 切换后，已缓存 daemon 不会自动重建，因此需要刷新 runtime 配置或重启 daemon 才能使用新 API Key/Base URL。
- 之前任务 `06-24-chat-usage-and-model-selection-contract` 已明确 Chat 下拉框里的显式模型选择优先于 provider family default，并扩展了 usage max token 合同。
- 当前会话管理已有 `ChatSessionSidebar`，通过 `get_dashboard_projects` 加载项目，通过 `list_sessions(projectPath)` 加载该项目下 Claude/Codex/Gemini 会话，并过滤出 Chat 支持的 Claude/Codex。
- 后端 `scan_sessions_for_project()` 已按 `last_active_at` 倒序合并 Claude/Codex/Gemini 会话，可作为最近会话分组的数据基础。
- 前端规范要求 Chat sidebar 使用 Windows-safe path cache key，master/detail 独立滚动，新增文本必须走 i18n 和 readable fallback。

## Requirements

- R1. Chat 运行时 provider/model/permission/reasoning/long-context 的选择控件在当前会话输出期间不应被 silent no-op；如果业务上不允许影响当前 active turn，也必须让新的选择成为“下一轮请求配置”并在 UI 上立即可见。
- R2. 后台 Provider 配置切换后，下一轮 Chat 请求必须使用最新 API Key/Base URL/默认模型配置，不要求用户手动重启 app 或 daemon。
- R3. 服务商配置刷新不能泄露 API Key/Base URL/Token 明文到日志、错误、通知或前端展示。
- R4. 切换到其他历史会话、新建会话、打开会话 tab、打开最近聊天项时，不得默认调用 `chat_abort` 中断正在输出的原会话。
- R5. 正在输出的请求必须绑定到发起时的会话/工作区快照；用户切走后，后续 `chat://stream`、`chat://message`、`chat://done` 事件要更新原会话快照，而不是污染当前可见会话。
- R6. 由于 daemon 命令队列当前是串行的，第一版多会话工作模式只承诺“多个会话可保持/切换/排队继续”，不承诺多个 provider turn 真正并行执行。
- R7. 用户主动点击停止时，只停止当前正在 active turn 的请求，并把对应会话标记为停止；非当前可见会话的停止入口需要明确 target，避免全局 abort 误伤。
- R8. 顶部会话 tab 应展示当前会话、新建会话草稿和最近打开的历史会话；支持快速切换、关闭 tab，并能标识 running/pending/error 状态。
- R9. 最近聊天管理应按项目目录分组展示最近会话，分组内按 `lastActiveAt` 倒序；每个会话展示标题/摘要 fallback、provider 图标、相对时间和状态。
- R10. 最近聊天列表应复用现有 session 扫描、path normalization、provider icon、session title fallback 和 i18n fallback 规则，避免与 `ChatSessionSidebar` 形成两套行为。
- R11. 历史会话加载仍遵守 large-history first-paint contract：普通点击只加载窗口化最近消息，不自动全量加载。
- R12. 新增或变更的跨层协议、store 状态和 UI 控件必须有 focused tests，并且每个阶段通过 `npm run build`；后端涉及 daemon/provider 配置时还需要 `cargo check --manifest-path src-tauri/Cargo.toml`。

## Acceptance Criteria

- [ ] 正在输出时切换 Chat provider/model，UI 立即显示新选择；当前请求不被中断，下一轮发送使用新选择。
- [ ] 切换后台 Claude Provider 配置后，下一轮 Claude Chat 请求使用新的 API Key/Base URL，无需重启 Tauri app；若需要 daemon refresh，应由前端/后端自动完成并保持用户可恢复。
- [ ] 切换历史会话或新建会话时，不再默认调用 `chat_abort`；原会话请求完成后不会写入当前可见会话。
- [ ] 旧请求的 stream/message/done 事件按 request id/session snapshot 路由；当前会话只渲染属于当前 active tab/session 的消息。
- [ ] 顶部会话 tab 可打开、切换、关闭，running/pending/error 状态可见且不挤压主对话区域。
- [ ] 最近聊天管理按项目分组展示最近会话，点击会话会打开/聚焦对应 tab，并加载窗口化历史。
- [ ] 最近会话列表、session sidebar 和 tab 对同一个 session 使用一致的 selection key、provider 图标、标题 fallback 和 Windows path normalization。
- [ ] 大历史会话普通打开仍只 first-paint 最近窗口；搜索/显式加载才进入完整历史路径。
- [ ] 关键回归测试覆盖：provider/model active-turn guard 改为下一轮生效、loadSession 不 abort、stream event 路由到原会话、recent sessions 分组排序、tab 打开/切换/关闭。
- [ ] `npm test -- src/stores/useChatStore.test.ts src/components/chat/chatSessionSidebarUtils.test.ts src/utils/chatUiBehavior.test.ts` 通过。
- [ ] `npm run build` 通过。
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` 通过，或清楚标注与本任务无关的既有失败。

## Out Of Scope

- 不在第一版实现真正并行的多 daemon / 多 active turn 执行。
- 不引入 React Query/SWR 或新的全局状态库。
- 不改历史 JSONL 文件格式，不迁移已有 Claude/Codex/Gemini 历史数据。
- 不新增后台 Provider 管理页的大规模改版；仅接入必要的“切换后 Chat 下一轮生效”合同。
- 不把 Gemini 纳入 Chat 发送能力；最近会话可继续识别/过滤 Gemini，但 Chat 可发送 provider 仍是 Claude/Codex。

## Open Question

- 最近聊天入口的常驻位置：建议放在左侧会话区域的上半部，顶部 tab 只放已打开/最近激活的短列表。这样能复用现有 sidebar 的项目/会话扫描和独立滚动结构，避免主对话区顶部变成过宽管理面板。

## Notes

- This is a complex Trellis task: `design.md` and `implement.md` are required before `task.py start`.
