# 当前任务计划

## Chat UI cc-gui parity 持续迭代

- [ ] 历史会话结构化块渲染：加载 Claude/Codex 历史会话时保留 `thinking`、`tool_use`、`tool_result` 等 content blocks，避免退化成一段长文本。
  - 验证方式：新增历史消息映射单元测试；`npm test`；`npm run build`；如改 Rust 会话解析则执行 `cargo check --manifest-path src-tauri/Cargo.toml`。
  - 当前状态：已实现并验证；Claude 历史保留原始 raw，Codex 历史转换 reasoning/function_call/function_call_output 为统一 raw blocks，前端 `loadSession()` 映射回 `ChatMessage.raw`。已补齐历史图片后端链路：Claude `image/input_image` 也算结构化历史内容，图片-only 消息不再因文本为空被跳过；Codex `message.content[]` 中的 `input_image/image` 会透传到统一 raw blocks。本轮继续补齐 Codex 历史 patch 链路：`custom_tool_call/apply_patch` 与 `custom_tool_call_output` 按 `call_id` 转成统一 `tool_use/tool_result`，`function_call exec_command/shell_command` 内嵌的 `*** Begin Patch` 也会归一化为 `apply_patch`，右侧“最近改动”即可复用现有 `collectEditToolItems()` 统计文件和增删行；同时新增 store 级回归测试，验证 `loadSession()` 后 normalized Codex patch 会直接进入 `buildChatStatusSummary()`。历史系统上下文过滤继续收口，`# AGENTS.md instructions` 与 `<heartbeat>` 这类用户角色重放块不会进入 transcript。验证通过：`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::codex -- --nocapture`、`npm test -- src/utils/chatStatusSummary.test.ts src/utils/toolPresentation.test.ts`、`npm test`、`cargo test --manifest-path src-tauri/Cargo.toml`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`。
- [ ] 工具块 UI 与 Open File 打磨：按命令类型提供不同摘要展示，压缩工具块布局；修复 `Open File` 对相对路径、JetBrains/VS Code 不同环境的打开失败。
  - 验证方式：`cargo test --manifest-path src-tauri/Cargo.toml editor_commands`；`cargo check --manifest-path src-tauri/Cargo.toml`；`npm run build`；浏览器/桌面手动点击 Read/Edit 的 Open File。
  - 当前状态：已实现并验证；前端所有 Read/Edit/Generic/Search 文件入口传 `currentCwd`，按钮/文件链接阻止折叠冒泡；后端支持相对路径、`/c/...`、`/mnt/c/...`、`file://...` 和 `file.ts:line[:column]` 归一化，VS Code/Cursor/JetBrains Toolbox/Program Files 发现和系统默认打开兜底；命令摘要区分 Build/Test/Git/Search/Read/List/Patch/Run，Search 单个工具也走专用块并把搜索结果文件行渲染为可点击列表。最新补充：`GenericToolBlock` 现在会把 tool result 的首行摘要直接显示在 header，压缩空白、多行自动省略，进一步贴近 cc-gui 的“操作行 + 轻结果”扫描体验；`EditToolBlock` 已补 `compact` 模式，分组展开项不再重复渲染完整头部卡片，而是直接呈现详情内容；`Read/Search/Agent/Task` 的组头又统一压成更轻的主摘要 + 二级摘要 + 低对比状态，`Agent/Task` 头部改由共享 `summarizeAgentToolHeader()` 消费；`EditDiffPreview` 本轮又补了一层 hover 顶栏摘要，直接显示“新增/删除行数”总览，减少只靠 `+/-` 数字理解 diff 的成本；本轮继续解码 MCP/codegraph text-block wrapper 与字面量 `\n` 输出，避免 codegraph 代码块在 Generic 工具结果里挤成一坨，并补 `extractResultText()` 对 wrapper object、array block、未知结构回退的单测。验证通过：`npm test -- src/utils/toolPresentation.test.ts`、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`；真实 Open File 点击需在 Tauri 桌面运行时继续点测。
  - 本轮新增：状态面板改成树状文件列表，150+ 文件进入独立滚动区，文件夹支持折叠/展开，diff 预览新增 unified / split 两种模式按钮；hover 预览改为不透明固定浮层，避免在滚动列表里被裁掉。验证通过：`npm test -- src/components/chat/StatusPanel.test.tsx src/utils/chatStatusSummary.test.ts src/utils/toolPresentation.test.ts`、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`git diff --check`。
  - 本轮修复：同一个文件被多次 `apply_patch` / `MultiEdit` 修改时，批量编辑文件列表按 normalized path 合并成一条文件记录，增删行与 hover diff 合并统计；`StatusPanel` 复用同一聚合 helper，避免右侧摘要和 transcript 列表计数漂移。验证通过：`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/utils/toolPresentation.test.ts src/utils/chatStatusSummary.test.ts src/components/chat/StatusPanel.test.tsx`、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`git diff --check`。
  - 本轮修复：中间 `文件差异` 面板新增显式收起按钮，收起后完全不渲染 diff 面板与 resize handle，不再占用中间页面空间；右侧点击文件会自动重新展开完整 diff；右侧最近改动 hover diff 改为状态栏专用窄预览，限制宽度和 split 行布局，避免浮层跨到聊天/完整 diff 内容区造成遮挡。验证通过：`npm test -- src/components/chat/ChatDiffReviewPane.test.tsx src/components/chat/StatusPanel.test.tsx`、`npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx`、`npm test`、`npm run build`、`git diff --check`。
- [ ] 消息流视觉打磨：对齐 cc-gui 的 transcript 结构，用户消息保留紧凑右侧气泡，assistant 消息改为无大卡片的连续内容流；thinking/edit/run/search 等工具事件在 assistant 流内以轻量操作行呈现，避免一次 AI 响应被多个大框割裂。
  - 验证方式：`npm run build`；`npm test -- src/stores/useChatStore.test.ts src/utils/toolPresentation.test.ts`；浏览器检查 Chat 页面无横向滚动，长用户 Markdown 不出现巨大标题，assistant 回复不再每段一个大气泡。
  - 当前状态：已实现并持续收口；`MessageItem` 已分离 user/assistant shell，assistant 透明流式展示，user bubble 限制宽度并压低 Markdown 标题层级；assistant 上下文内 thinking/tool blocks 弱化为低对比左边界操作行。最新补充：`Edit` 分组展开项改为 compact 详情，`Read/Search` 首屏摘要已回到主扫描行，assistant transcript 内的 `tool-command-chip`、`tool-state-pill` 与操作按钮又做了一轮降权，`Agent/Task` 两类块也改为共享摘要逻辑并继续压低 runtime/历史占位的视觉重量，`MessageMeta` 在 assistant 收尾处改为 compact inline 摘要，`Read/Search/Agent/Task` 的组头进一步统一成更轻的操作行结构；本轮把 `MessageList` 的历史折叠计算抽到共享逻辑，顶部入口从强交互按钮压成轻提示，并继续沿用触顶自动加载旧消息的连续滚动方式；同时搜索框 placeholder 也改成真实可用文案，不再显示“预留入口”。本轮继续补齐 `ContentBlockRenderer.compact`，让 assistant 主消息与子代理历史共用紧凑渲染路径；`ThinkingBlock` 增加 compact 变体，assistant 流内的 think/tool 节点统一压低圆角、内边距和块间距，进一步减少“一次响应一个大框”的割裂感；本轮继续把 `compact` 透传到 Bash/Read/Edit/Generic 单工具块以及 Bash/Read/Edit/Search 分组块、Agent/Task 块，避免子代理历史或紧凑流里重新出现默认大头部卡片；针对截图反馈，compact 单工具块改为默认折叠，只显示操作行摘要，点击后才展开参数/结果，避免历史会话默认铺开大段输出。验证通过：`npm test -- src/components/chat/ThinkingBlock.test.tsx src/components/chat/MessageMeta.test.tsx src/components/toolBlocks/SubagentHistoryPanel.test.tsx src/components/toolBlocks/subagentHistoryUtils.test.ts`、`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/utils/toolPresentation.test.ts src/components/chat/StatusPanel.test.tsx`、`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageAnchorRail.test.tsx`、`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatNavigation.test.ts src/components/chat/MessageAnchorRail.test.tsx`、`npm run build`；浏览器与桌面态 smoke 仍需继续点测。
- [ ] Composer 紧凑布局与图片附件：输入框默认一行，不显示空文件上下文占位；图片上传/粘贴/拖拽必须作为真实附件 payload 发送给 AI，不能退化为 `@filename` 文本。
  - 验证方式：`npm test -- src/stores/useChatStore.test.ts`；`npm run build`；Node bridge 直接验证 Codex base64 图片可落盘为 `local_image`；浏览器/桌面手动检查输入区高度和图片 chip。
  - 当前状态：已实现；`ChatComposer` 读取 PNG/JPEG/WebP/GIF 为 base64 并保留 Tauri 本地 path，支持纯图片发送；Claude 走 `sendWithAttachments`，Codex path 走 `local_image`，Codex base64 由 bridge 写入临时文件后转 `local_image`。输入区已改为中间列内居中的紧凑面板，默认一行，桌面与 900px 窗口浏览器几何检查无横向溢出。本轮继续补齐当前发送消息的 `raw.image` 结构化块，live 消息和历史消息共用缩略图渲染路径，不再只显示 `[Image: name]` / `[图片: name]` 文本；历史图片渲染新增 `file:///C:/...` 归一化，先转本地路径再交给 Tauri asset URL。最新补充：用户上传图在用户气泡内改为 cc-gui 风格的小缩略图（桌面约 200px 宽、移动端按视口收缩），点击仍打开 lightbox；历史 raw blocks 中图片前后的疑似 base64 payload 残片会从可渲染文本和合并消息文本中过滤，不再在气泡里显示 `SUVORK5CYII=` / `Jggg==` 这类残留。`/` 补全不再只依赖前端 5 条硬编码命令，新增 Rust `chat_list_slash_commands` registry，按 Claude/Codex provider 返回 cc-gui parity 内置命令，并扫描当前项目向上的 `.claude/commands/**/*.md`；前端 `useCompletions` 优先调用后端 registry，失败时才回退内置兜底，已覆盖 `/context`、`/plan`、`/resume`、`/batch`、`/claude-api`、`/debug`、`/loop`、`/simplify`、`/update-config`、`/diff` 等候选。验证通过：`npm test -- src/stores/useChatStore.test.ts`、`npm test -- src/stores/useChatStore.test.ts src/components/chat/ContentBlockRenderer.test.tsx`、`npm test -- src/components/chat/composer/useCompletions.test.ts src/stores/useChatStore.test.ts src/components/chat/ContentBlockRenderer.test.tsx`、`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatMessageFlow.test.ts`、`npm test`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml chat::slash_commands -- --nocapture`、`cargo test --manifest-path src-tauri/Cargo.toml`、`cargo check --manifest-path src-tauri/Cargo.toml`、`git diff --check`、Node bridge 直接验证。
- [ ] 会话管理第一版：在 Chat 页面接入项目/会话侧栏，支持选择已有会话加载历史并继续发送，支持新建会话保留项目 cwd。
  - 验证方式：`npm run build`；手动选择项目、选择 session、发送新消息检查 `sessionId/cwd/provider`。
  - 当前状态：已实现并持续收口；新增活跃请求切换会话前 abort 保护、会话列表搜索和刷新、项目列表/会话列表分栏布局优化。最新补充：会话切换时会先显示 `pendingSessionKey` 的加载态，连续点击历史会话时用 token 防止旧请求覆盖新选择。本轮继续优化点击历史会话的列表性能：按项目路径缓存 `list_sessions` 结果，非强制刷新直接复用；刷新中保留已有会话列表，不再整体替换为大 spinner；`loadSession()` 对当前已激活 session 重复点击直接短路，并按 `provider/sourcePath/sessionId/lastActiveAt` 缓存已映射历史消息，历史会话来回切换时减少后端读取和大数组映射，`lastActiveAt` 变化会重新读取；本轮补充项目路径缓存别名，会同时按 `list_sessions(projectPath)` 和 session 自带 `projectDir` 建 key，配合 ChatPage/侧栏对 active/pending 会话的点击短路，减少点击历史会话后由 `currentCwd` 变化带来的重复会话列表加载；侧栏还新增同项目 in-flight 请求去重，已有 `list_sessions(projectPath)` 未完成时不会再发第二次扫描。后端 Codex 项目会话扫描也改为先读取 `session_meta.payload.cwd` 过滤项目，只有匹配当前项目的 jsonl 才继续提取标题，避免为无关项目读取大型 Codex 历史。本轮新增修复：用户手动点击项目后，侧栏不会再被当前会话的 `currentCwd` 自动拉回；切换到未缓存项目时会立即清空旧会话列表并显示加载态，避免新项目下继续看到旧项目会话。验证通过：`npm test -- src/stores/useChatStore.test.ts src/components/chat/chatSessionSidebarUtils.test.ts`、`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts src/stores/useChatStore.test.ts src/utils/desktopNotification.test.ts`、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`。真实桌面 session 选择/继续发送仍需继续做点测。
- [ ] 长会话导航与运行摘要：继续对标 cc-gui 的消息锚点与状态面板，让长会话下的定位、回看和运行态读取更高效。
  - 验证方式：`npm test -- src/components/chat/MessageAnchorRail.test.tsx`；`npm run build`；浏览器/桌面态检查左侧锚点栏与右侧状态面板在长会话下的信息密度和可读性。
  - 本轮补充：历史会话里的 Bash/Read/Edit/Search 分组在 `compact` 模式下默认只显示一行操作摘要，点击组头后才显示子项列表和“展开全部/折叠全部”；Codex/长历史锚点在列表尚未回传折叠状态时先按默认可见窗口生成，避免为未挂载的历史消息创建不可跳转锚点。
  - 当前状态：进行中；当前项目原本只有左侧回顶/到底按钮和右侧 provider/messageCount 静态摘要。上一轮已把 `MessageAnchorRail` 补成“锚点数量 + 当前摘要 + 回顶/到底”复合控件；本轮继续推进为真实消息锚点导航：`MessageList` 会把当前可见 user message 节点注册到 `ChatPage`，`MessageAnchorRail` 改为沿纵向轨道分布的可点击点阵锚点，并用 `IntersectionObserver` + 滚动回退逻辑跟踪当前 active anchor，右侧 `StatusPanel` 也改为显示当前视口对应的用户消息摘要，不再固定显示“最后一条用户消息”。同时把搜索/渲染/锚点摘要的共享逻辑抽到 `src/utils/chatNavigation.ts`，避免 `ChatPage` 与 `MessageList` 重复维护消息过滤和文案截断。本轮补齐 system prompt 过滤与图片锚点摘要：`role=system` 不再进入 transcript/锚点/跨模型 handoff，图片 raw block 会生成 `图片 screen.png` 这类可读锚点和搜索文本；本轮进一步扩大协议上下文识别，覆盖 Codex/Claude system 开场、Tools/Skills/Plugins/Heartbeats 等历史上下文块，且 handoff 构造时也会过滤这类内容。最新补充：锚点轨道新增密集列表降采样，超长会话只渲染代表点并保留首尾/active 锚点，点位仍按原始消息序号定位，避免大量点重叠后看起来空白或不可见。本轮继续增强锚点 hover：`chatNavigation` 会输出 `text/image/mixed/empty` 预览类型，`ChatPage` 传入用户消息序号、总数与时间，`MessageAnchorRail` 以更高对比度的点阵、类型胶囊和四行预览浮层展示，图片-only 与图文消息不再表现成一批难以区分的空白点；右侧最近编辑 hover 改为向左展开，中间 diff hover 改为居中展开并使用不透明深色背景，避免侧栏截断和透明难读。当前轮继续修正状态面板编辑统计：`recentEdits` 列表仍限制为最近 4 个文件以保持侧栏紧凑，但 `touchedFileCount`、`totalAdditions`、`totalDeletions` 改为按全量聚合 edit set 计算，并在面板标题显示“文件数 · +增量 / -删量”，避免长历史会话只按可见 4 项低估变更规模；如果实际变更文件超过可见列表，会显示“还有 N 个文件未显示”的低对比入口，并可展开查看完整 `allEdits` 列表再收起。本轮又把密集锚点抽样改为优先选择 `text/image/mixed` 非空预览，避免 empty 锚点占满可见轨道预算；锚点 hover 改为不透明浮层，中间与右侧 diff hover 也提高 z-index 和对比度。针对 Codex 锚点异常，新增 `isMessageAnchorCandidate()` 并让 `ChatPage` 与 `MessageList` 共享，只有真实可见的用户输入/图片消息注册锚点，`[tool_result]`、空白和协议上下文用户行不会进入锚点轨道。验证通过：`npm test -- src/utils/chatNavigation.test.ts src/components/chat/MessageAnchorRail.test.tsx`、`npm test -- src/utils/chatStatusSummary.test.ts src/components/chat/StatusPanel.test.tsx src/utils/toolPresentation.test.ts`、`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageAnchorRail.test.tsx`、`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatNavigation.test.ts src/components/chat/MessageAnchorRail.test.tsx`、`npm test`（18 files / 122 tests）、`npm run build`、`git diff --check`（仅 CRLF 提示）、`cargo check --manifest-path src-tauri/Cargo.toml`（仅既有 `ChatMessageEvent` dead code warning）。剩余差距：Tauri 桌面态真实点测、锚点与右侧运行摘要更细的联动仍待继续打磨。
- [ ] Claude 子代理历史接入：Agent/Task 工具块按 cc-gui 思路懒加载 `subagents/agent-*.jsonl` 历史，展示结构化 thinking / tool_use / tool_result，而不是长期停留在占位文案。
  - 验证方式：Rust 单测覆盖按 `agentId` 与 `.meta.json description` 两条查找路径；`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::claude`；前端测试覆盖 agent/task 元信息驱动的调用参数；`npm test -- src/utils/toolPresentation.test.ts src/stores/useChatStore.test.ts` 或新增相关测试；`npm run build`；桌面态手动展开历史会话中的 Agent/Task 工具块验证真实轨迹。
  - 当前状态：已实现前端接入并持续收口；`SubagentHistoryPanel` 现在会在 Claude 历史会话与当前活跃会话中懒加载真实 `agent-*.jsonl` 轨迹，当前活跃会话在缺少 `activeSession.sourcePath` 时会回退到 `currentCwd` 作为查找根路径，不再因为只拿到 `sessionId` 而长期显示占位文案。面板顶部新增轻量过程摘要，会从 structured blocks 中提炼“思考 / 读取文件 / 其他工具 / 结果”概览，下方仍保留原始 transcript 级 thinking/tool_use 渲染。最新补充：过程卡片已接入 tool result runtime 元信息，显示耗时、工具调用数、读取文件数与 token 统计；当结果文本以 JSON runtime 前缀开头时，首屏结果摘要会跳过该前缀直接显示真实输出首行，并支持“查看完整输出”折叠。进一步收口：子代理过程摘要已拆成可单测的纯渲染组件 `SubagentProcessSummary`，读取文件项现在同时保留 `displayPath`、真实 `openPath` 和读取行号，展示层渲染为可点击的轻量文件行并复用 `openFile(path, start, end, currentCwd)` 直接定位到对应范围；“其他工具”区域本轮又从统一 `Wrench` 胶囊收口为类型化操作行，复用现有 `summarizeCommand()` / 搜索分类语义区分 `Search / Run / Patch / List / Web / Agent` 等类别，且对 `Edit / Write` 这类非 Read 的文件型工具额外保留真实 target，允许直接从过程摘要打开对应文件，不再只显示一串静态路径文本。继续补齐后，`Search / Grep` 这类搜索工具现在也会从 `tool_result` 中提取首个命中文件和行号，过程摘要优先展示为可点击文件目标，并把查询词与 `x matches in y files` 统计分层展示，进一步贴近 cc-gui 的扫描式操作流；`Glob / List` 这类文件枚举工具则已经和真正的搜索命中语义拆开，摘要统一改为更自然的 `N files`。此外 `Bash / Run / Command` 类结果现在会复用主工具块的 bash 结果摘要逻辑，优先显示 `stdout` 的真实首行，不再直接露出 JSON blob；`Fetch / Web` 类结果也开始优先取 `title / name / url / content / summary` 之类结构化字段，避免继续把 JSON 原文露出来；剩余 generic JSON 结果也补了统一回退，会优先取 `message / title / name / summary / description / result / output / stdout / content` 等常见字段，进一步减少子代理过程行里直接出现原始对象。本轮又额外压掉了明显重复的 JSON 次级 detail，避免工具行在已经有可读摘要时再次挂出原始对象文本。验证通过：`npm test -- src/components/toolBlocks/subagentHistoryUtils.test.ts src/components/toolBlocks/SubagentHistoryPanel.test.tsx`、`npm run build`；Rust 侧历史查找链路与桌面态展开历史 Agent/Task 工具块的真实点测仍待继续完成。
- [ ] 文案与可访问性：新增用户可见文案同步 `zh.json` / `en.json`，按钮提供 title/aria 语义。
  - 验证方式：`npm run build`；检查浅色/深色基础布局不遮挡输入区。
  - 当前状态：中英文 key 已补齐；普通工具权限弹窗新增 `chat.permission.*` 文案，按钮提供 `title` / `aria-label`；`npm run build` 通过；浏览器默认主题未发现遮挡；深色主题和真实桌面视觉待验证。
- [ ] 权限审批假死修复：对齐 cc-gui 的普通工具权限文件协议，`request-<sessionId>-<requestId>.json` 必须弹出确认框并写回 `response-<sessionId>-<requestId>.json`，避免 MCP/Chrome DevTools、Bash、Edit 等工具一直 pending。
  - 验证方式：store 单测覆盖 `permission://tool` → `pendingToolPermission` → `permission_respond_tool`；Rust 单测覆盖 `write_tool_permission_response()` 生成 `{allow}` 响应和缺省 inputs 归一；`npm test`；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`；`cargo check --manifest-path src-tauri/Cargo.toml`；`git diff --check`。
  - 当前状态：已实现普通工具权限闭环；Rust `PermissionWatcher` 现在监听 `request-default-*.json`，emit `permission://tool`，前端 `ToolPermissionDialog` 展示工具名、cwd、关键参数和完整 JSON，用户允许/拒绝后调用 `permission_respond_tool` 写 `response-default-*.json`，payload 严格为 `{ "allow": true|false }`。已记录 backend/frontend spec，桌面态真实 MCP 权限弹窗仍需在 Tauri app 中点测。
- [ ] Trellis 质量门：执行 `trellis-check`，必要时更新 spec，再提交当前阶段。
  - 验证方式：`npm run build` 通过；如仅改前端则记录无需 `cargo check`。
  - 本轮验证：`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatNavigation.test.ts src/components/chat/MessageAnchorRail.test.tsx` 通过（3 files / 19 tests）；`npm test` 通过（18 files / 126 tests）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`git diff --check` 无空白错误，仅 LF/CRLF 提示。最新补充：`chat://done` 成功/失败、发送失败和显式 abort 都会触发 Windows WebView 系统通知，通知去重按 requestId 控制；验证通过 `npm test -- src/utils/desktopNotification.test.ts src/stores/useChatStore.test.ts`。
  - 当前状态：已执行 Trellis check 要求的差异检查、单测、前端构建、Rust 单测、`cargo check` 和 `git diff --check`；上一轮验证：`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::codex -- --nocapture` 通过（4 tests），`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 warning），`cargo test --manifest-path src-tauri/Cargo.toml` 通过（80 tests）。当前轮新增验证：`npm test -- src/utils/chatStatusSummary.test.ts src/components/chat/StatusPanel.test.tsx src/utils/toolPresentation.test.ts` 通过（3 files / 38 tests），`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageAnchorRail.test.tsx` 通过（2 files / 8 tests），`npm test -- src/components/chat/composer/useCompletions.test.ts` 通过（6 tests），`npm test -- src/stores/useChatStore.test.ts` 通过（15 tests），`cargo test --manifest-path src-tauri/Cargo.toml write_tool_permission_response_writes_bridge_allow_payload tool_permission_request_allows_missing_inputs` 通过（2 tests），`npm test` 通过（19 files / 140 tests），`npm run build` 通过，`cargo test --manifest-path src-tauri/Cargo.toml` 通过（84 tests），`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 warning：`ChatMessageEvent` dead code），`git diff --check` 无 whitespace error（仅 CRLF 提示）。已更新 frontend/backend spec 与 TODO；待提交当前阶段。

## 迭代记录 2026-06-18 12:16 heartbeat

- 上轮实际进展：代码中确实存在 diff 面板完全收起、不占页面空间；系统通知入口已接在 `chat://done`、发送失败和 abort；会话侧栏已加手动项目选择锁，切项目不会继续显示旧项目会话。阻塞：系统通知尚未在真实 Tauri 桌面态观察 Windows 右下角弹出；当前仍依赖 WebView Notification API，若系统权限或 WebView 行为不稳定，后续再切 Tauri 原生通知插件。
- 本轮诊断（补齐 cc-gui）：cc-gui changelog 明确有“task completion toast notification”且展示会话标题/最新回答预览；本项目上一轮只显示“任务已完成/停止/失败”，缺少结果预览，用户离开窗口后难以判断是哪次任务完成。
- 本轮诊断（超越 cc-gui）：用户要求的是电脑右下角通知，不是应用内 toast；本项目保留系统通知路线，并补充最终回答/停止时部分输出预览，解决多任务并行或长任务等待时“弹了但不知道完成了什么”的痛点。
- 本轮规划：优先实现系统通知预览，价值高、实现成本低、风险小；暂不引入 `tauri-plugin-notification`，避免同时改 Rust capabilities 和前端 API，先把现有通知内容做完整并保持可回退。
- 本轮完成：`src/utils/desktopNotification.ts` 清洗、折叠空白并截断通知 detail；`src/stores/useChatStore.ts` 从最新 assistant 的最后 text block 或流式文本提取预览，成功和中断通知都会带预览，失败通知继续带错误原因；更新 `desktopNotification` 与 `useChatStore` 单测。
- 本轮验证：`npm test -- src/utils/desktopNotification.test.ts src/stores/useChatStore.test.ts` 通过（2 files / 21 tests）；`npm test` 通过（20 files / 150 tests）；`npm run build` 初次发现 `Array.prototype.at()` 与当前 TS target 不兼容，已改为索引写法后通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`git diff --check` 无 whitespace error（仅 CRLF 提示）。
- 下一步候选：1) Tauri 桌面态真实点测系统通知权限与弹出稳定性，必要时接原生通知插件；2) 继续对标 cc-gui 的 completion toast 设置项，为通知增加开关/静默模式；3) 对历史会话锚点和状态面板做真实长会话桌面点测，定位仍然“点不准/看不清”的剩余场景。

## 迭代记录 2026-06-18 继续推进

- 上轮实际进展：系统通知已支持成功/失败/中断三类停止输出通知，并带最终回答或 partial 输出预览；`npm test`、`npm run build`、`cargo check` 和 `git diff --check` 已通过。阻塞仍是未在真实 Tauri 桌面态观察 Windows 右下角弹窗。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 completion toast 有设置入口和通知内容，但当前项目更关键的问题是 WebView Notification 权限可能在任务结束事件里才请求，容易因为不在用户手势内被系统或 WebView 忽略。
- 本轮诊断（超越 cc-gui）：把通知权限请求提前到用户点击发送/停止的动作路径，能减少“任务结束了但系统通知没弹”的概率，同时不引入应用内 toast，不违背用户要求的右下角系统通知。
- 本轮规划：先做前端通知权限预热，不引入 `tauri-plugin-notification`；理由是改动小、可单测、风险低。若真实桌面点测仍不稳定，再升级为 Tauri 原生通知。
- 本轮完成：`src/utils/desktopNotification.ts` 新增 `prepareChatTurnStoppedNotificationPermission()`，只请求权限不创建通知；`src/stores/useChatStore.ts` 在 `send()` 和显式 `abort()` 用户动作路径调用预热；`src/utils/desktopNotification.test.ts` 覆盖预热不弹通知；`src/stores/useChatStore.test.ts` 覆盖发送与停止路径会调用预热。
- 本轮验证：`npm test -- src/utils/desktopNotification.test.ts src/stores/useChatStore.test.ts` 通过（2 files / 22 tests）；`npm test` 通过（20 files / 151 tests）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`git diff --check` 无 whitespace error（仅 CRLF 提示）。
- 下一步候选：1) 真实 Tauri 桌面运行后发送一条短消息并点击停止，观察权限提示和 Windows 右下角通知；2) 若预热仍不能稳定弹出，接 Tauri 原生通知插件并补 capabilities；3) 回到长会话锚点/状态面板点测，继续修复可见但跳转不准的场景。

## 迭代记录 2026-06-18 native notification

- 上轮实际进展：WebView `Notification` 已在发送/停止的用户动作路径预热权限，并在 `chat://done`、发送失败和显式 abort 时触发；单测、前端构建和 Rust 检查均通过。阻塞：真实 Tauri 桌面态仍未观察到 Windows 右下角通知，且 WebView 通知权限在桌面 WebView 中存在被静默忽略的风险。
- 本轮诊断（补齐 cc-gui）：cc-gui 有任务完成 toast/通知类能力；当前项目虽然已有通知内容，但主路径依赖浏览器通知 API，和用户要求的“电脑右下角系统通知”不够一致。
- 本轮诊断（超越 cc-gui）：改为 Tauri 原生通知主路径后，停止输出提醒不再依赖 WebView permission prompt；成功/失败/中断通知仍保留最终回答、partial 输出或错误原因预览，解决用户离开窗口等待长任务时“任务停了但不知道发生什么”的痛点。
- 本轮规划：优先引入 Rust 侧 `tauri-plugin-notification` 并新增薄命令 `chat_show_system_notification`，前端 `desktopNotification.ts` 只做运行时分流和文案清洗；不使用前端 `@tauri-apps/plugin-notification`，因为其发送实现仍是 `new window.Notification(...)`，无法解决 WebView 依赖问题。
- 本轮完成：`src-tauri/Cargo.toml` / `Cargo.lock` 增加 `tauri-plugin-notification`；`src-tauri/src/lib.rs` 初始化 notification 插件并注册 `chat_show_system_notification`；`src-tauri/src/commands/chat_commands.rs` 新增系统通知命令；`src-tauri/capabilities/default.json` 与 `src-tauri/tauri.conf.json` 同步 `notification:default`；`src/utils/desktopNotification.ts` 改为 Tauri runtime 下先调用原生命令，失败或非 Tauri 环境再回退 WebView；`src/utils/desktopNotification.test.ts` 增加 native 主路径、Tauri 下不请求 WebView 权限、native 失败兜底的回归测试；`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/backend/cross-layer-protocol.md` 已同步新约定。
- 本轮验证：`npm test -- src/utils/desktopNotification.test.ts` 通过（8 tests）；`npm test -- src/stores/useChatStore.test.ts` 通过（17 tests）；`npm test` 通过（20 files / 154 tests）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（85 tests，doc tests 仅既有 ignored）；真实 Tauri 桌面右下角弹窗仍需运行 `npm run tauri dev` 后人工观察。
- 下一步候选：1) 桌面态点测发送完成、失败和停止三类通知是否稳定弹出；2) 回到用户反馈的 Codex 锚点不准/长会话空锚点，做真实长历史滚动与跳转验证；3) 继续优化 diff 三栏和状态面板在 150+ 文件时的滚动、收缩和 hover 预览细节。

## 迭代记录 2026-06-18 12:46 heartbeat

- 上轮实际进展：代码中确实存在 Tauri 原生系统通知主路径，`src-tauri/src/lib.rs` 已初始化 `tauri_plugin_notification`，`chat_show_system_notification` 已注册，前端 `desktopNotification.ts` 会先调用原生命令再回退 WebView；验证记录中的 `npm test`、`npm run build`、`cargo check`、`cargo test` 已完成。阻塞：仍未真实运行 Tauri 桌面观察 Windows 右下角弹窗。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `MessageList.tsx` 在 first message id 变化时重置 `revealedCount`，避免历史分页展开状态跨 session 继承；当前项目 `MessageList.tsx` 只按 `totalEarlierMessages` clamp 旧状态，如果用户在上一个历史会话触顶展开过全部消息，再打开另一个历史会话，新会话可能默认全部展开，符合用户“历史会话全部默认展开”的反馈。
- 本轮诊断（超越 cc-gui）：当前项目已经做了触顶连续加载，比 cc-gui 点击“show earlier”更省操作；本轮保留连续滚动加载，同时把 reveal 状态绑定到 transcript key，解决“切会话继承展开状态”的痛点，并避免新会话首帧产生不可跳转锚点。
- 本轮规划：优先修复 `MessageList` reveal state 继承问题；价值高（直接对应用户反馈）、出现频率高（频繁切历史会话）、实现成本低（纯前端状态 helper + 单测），暂不扩展到真实桌面点测和 diff 布局大改。
- 本轮完成：`src/utils/chatUiBehavior.ts` 新增 `TranscriptRevealState`、`getEffectiveRevealedCount()`、`getClampedRevealState()`、`getNextRevealState()`；`src/components/chat/MessageList.tsx` 改为按第一条可渲染消息 id 作为 transcript key 派生 revealed count，切换历史时同步回到默认最近 15 条窗口；`src/utils/chatUiBehavior.test.ts` 覆盖跨 transcript 必须归零、同 transcript 分页继续保留；`.trellis/spec/frontend/component-guidelines.md` 记录 reveal state 不得跨会话继承。
- 本轮验证：`npm test -- src/utils/chatUiBehavior.test.ts src/utils/chatNavigation.test.ts src/components/chat/MessageAnchorRail.test.tsx` 通过（3 files / 21 tests）；`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/StatusPanel.test.tsx` 通过（2 files / 12 tests）；`npm test` 通过（20 files / 156 tests）；`npm run build` 通过。未运行 `cargo check`，本轮仅改前端/文档。
- 下一步候选：1) 真实桌面点测历史会话切换后默认只显示最近窗口、触顶继续分页加载、锚点只指向已挂载用户消息；2) 继续排查 Codex 锚点“点不准”的真实数据样本，重点看 normalized Codex history 是否仍混入内部用户行；3) 继续做 Tauri 桌面态系统通知人工点测。

## 迭代记录 2026-06-18 12:56 heartbeat

- 上轮实际进展：Trellis 记录中声称完成的 reveal state 隔离在代码中确实存在，`MessageList` 已按首条可渲染消息 id 作为 transcript key，切换历史会话会回到默认最近 15 条窗口；Tauri 原生系统通知代码也确实存在。阻塞仍是：未运行真实 Tauri 桌面点测系统通知；未从 UI 人工确认长 Codex 历史锚点跳转体验。
- 本轮诊断（补齐 cc-gui）：对照 cc-gui 后确认锚点应只来自可见 user 消息；本项目已有共享 `isMessageAnchorCandidate()`，但只读抽样本机 Codex 历史时发现最新 ccg-switch 会话 97 条 user message 中有 51 条协议/运行上下文，且当前规则漏掉 `<turn_aborted>`，会把 Codex 内部中断标记渲染为用户气泡和锚点。
- 本轮诊断（超越 cc-gui）：不是把所有 XML-looking 文本都隐藏，而是只把明确的 Codex 控制标记纳入协议上下文过滤；这样可以清掉空锚点/假用户消息，同时保留 `<image name=...>`、`<TASK>` 这类可能承载真实用户内容的历史文本，降低误杀风险。
- 本轮规划：优先补共享协议上下文过滤和标题提取过滤，价值高（直接影响历史显示、搜索、锚点、会话标题）、实现成本低（前端 shared helper + 后端私有 title helper）、风险可通过单测覆盖；暂不扩大到图片文本占位解析和真实桌面点测。
- 本轮完成：`src/utils/chatMessageFlow.ts` 将 `<turn_aborted>`、`<user_action>`、`<subagent_notification>`、`<agents-instructions>`、`<skill>` 纳入协议上下文前缀；`src/utils/chatMessageFlow.test.ts` 与 `src/utils/chatNavigation.test.ts` 覆盖这些 Codex 控制标记不渲染且不成为锚点；`src-tauri/src/session_manager/providers/codex.rs` 的 `is_system_instruction()` 同步识别这些控制标记和 Codex/Claude/API system prompt，避免它们优先成为 Codex 会话标题；`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/backend/cross-layer-protocol.md` 已记录该跨层约定。
- 本轮验证：`npm test -- src/utils/chatMessageFlow.test.ts src/utils/chatNavigation.test.ts` 通过（2 files / 23 tests）；`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::codex -- --nocapture` 通过（5 tests）；`npm test` 通过（20 files / 158 tests）；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（86 tests，doc tests 2 ignored）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。
- 下一步候选：1) 运行 `npm run tauri dev` 做真实桌面点测：历史会话默认窗口、Codex 锚点跳转、系统通知弹出；2) 继续处理历史图片中的文本占位 `<image name=...>`，确认是否能从 Codex 原始记录恢复可点击缩略图；3) 继续优化 diff 三栏在长 diff/150+ 文件场景下的空间分配与滚动体验。

## 迭代记录 2026-06-18 13:09 heartbeat

- 上轮实际进展：12:56 记录中提到的 Codex 控制标记过滤在代码中确实存在，`chatMessageFlow`、`chatNavigation` 与 Codex provider 的标题提取都已避开 `<turn_aborted>` 等协议标记；阻塞仍是未做真实 Tauri 桌面点测（系统通知、历史默认窗口、锚点跳转、Open File）。
- 本轮诊断（补齐 cc-gui）：只读抽样全局 Codex 历史发现 `<image name=...>` 样本都出现在同一条 `content[]` 中，结构是 `input_text` 图片 wrapper、真实 `input_image`、`</image>`、再接真实用户说明。若直接渲染这些 wrapper，本项目会在历史 transcript、搜索文本和锚点里显示无意义 XML 占位；cc-gui 的历史图片展示不会把这类 wrapper 当成正文。
- 本轮诊断（超越 cc-gui）：不能把所有 XML-looking 文本都隐藏，因为用户 prompt 里可能包含任务 XML 或示例文本。本轮采用更窄规则：只有同条 raw 消息存在真实 `image/input_image` block 时，才过滤纯 `<image ...>` / `</image>` wrapper，既清掉污染又降低误杀真实 prompt 的风险。
- 本轮规划：优先补 Codex 历史图片占位清洗，价值高（直接解决“历史图片丢失/占位文本污染/锚点异常”）、出现频率高（图片反馈多次出现）、实现成本中低（已有共享 image helper 和 raw block 渲染链路）；暂不扩大到真实桌面点测和 diff 布局继续重构。
- 本轮完成：`src/utils/chatImageBlocks.ts` 新增 `isImagePlaceholderText()`；`src/utils/chatMessageFlow.ts` 在 raw 中存在图片块时过滤纯图片 wrapper 和相邻 base64 残片；`src/utils/chatNavigation.ts` 让搜索/锚点文本也排除图片 wrapper；`src-tauri/src/session_manager/providers/codex.rs` 在 Codex provider 统一 raw blocks 时丢弃同条图片消息里的纯占位 text，保留 `input_image` 和真实用户说明；新增/更新 `chatMessageFlow`、`chatNavigation` 与 Codex provider 回归测试；`.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/backend/cross-layer-protocol.md` 已记录该窄口径跨层规则。
- 本轮验证：`npm test -- src/utils/chatMessageFlow.test.ts src/utils/chatNavigation.test.ts src/components/chat/ContentBlockRenderer.test.tsx` 通过（3 files / 34 tests）；`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::codex -- --nocapture` 通过（6 tests）；`npm test` 通过（20 files / 161 tests）；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（87 tests，doc tests 2 ignored）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。
- 下一步候选：1) 真实 Tauri 桌面点测历史图片缩略图与 lightbox，确认 `<image name=...>` 不再出现在 transcript/搜索/锚点；2) 继续点测 Codex 长历史锚点跳转是否仍有错位，若有用真实 session jsonl 反推注册/折叠状态；3) 继续优化 diff 三栏在长 diff/150+ 文件时的可视范围、区域 resize 和收起按钮；4) 桌面态验证系统通知与 Open File 点击链路。

## 迭代记录 2026-06-18 13:21 heartbeat

- 上轮实际进展：Codex 历史图片 wrapper 清洗在代码中确实存在，前端 raw 渲染/合并内容/搜索锚点与 Rust Codex provider 都有对应测试；`npm test`、`npm run build`、`cargo test`、`cargo check` 已通过。阻塞仍是未做真实 Tauri 桌面点测，特别是图片 lightbox、系统通知、Open File、长历史锚点跳转。
- 本轮诊断（补齐 cc-gui）：当前项目已经有三栏 diff review，但 `ChatPage` 只在 diff 展开时暴露 conversation-diff 与 diff-status resize handle；一旦用户点击收起 diff，布局退化成“对话 + 固定右侧状态栏”，右侧宽度不能调，和用户要求的“对话框、diff 区域、最右侧区域都可以调节大小”仍有差距。
- 本轮诊断（超越 cc-gui）：diff 收起后不占页面空间是正确方向，但两栏状态也要保持可调；否则用户为了回看长 transcript 还要被右侧状态栏占固定宽度。新增 conversation-status resize handle 可以在无 diff 或 diff 已收起时把空间还给对话区，解决“宝贵页面空间被固定侧栏占住”的痛点。
- 本轮规划：优先补 diff 收起后的右侧调宽能力，价值高（直接改善长 diff/长会话空间分配）、出现频率高（用户会频繁收起 diff 回到对话）、成本低（复用既有 resizer 交互）。同时把 pane width clamp 迁到 `chatUiBehavior` 并补测试，避免页面内继续堆局部尺寸算法。
- 本轮完成：`src/utils/chatUiBehavior.ts` 新增 pane width 常量、`clampPaneResizeDelta()` 与 `getPaneWidthsAfterResize()`；`src/pages/ChatPage.tsx` 复用共享 helper，新增 `conversation-status` resize 边界，并在 diff 不显示时渲染右侧调宽手柄；`src/utils/chatUiBehavior.test.ts` 覆盖左右两侧宽度 clamp；`src/locales/zh.json` / `src/locales/en.json` 增加 `resizeConversationStatus` title/aria 文案；`.trellis/spec/frontend/component-guidelines.md` 已记录该布局契约。
- 本轮验证：`npm test -- src/utils/chatUiBehavior.test.ts src/components/chat/ChatDiffReviewPane.test.tsx src/components/chat/StatusPanel.test.tsx` 通过（3 files / 16 tests）；`npm test` 通过（20 files / 162 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮仅改前端布局、i18n、测试与文档，未运行 Rust check。
- 下一步候选：1) 真实桌面点测三种拖拽边界：conversation-diff、diff-status、conversation-status；2) 继续验证长 diff panel 在 split/unified 模式下是否仍横向挤压，必要时给 diff body 增加更明确的横向滚动/列宽策略；3) 桌面态验证历史图片 lightbox、系统通知、Open File、Codex 锚点跳转。

## 迭代记录 2026-06-18 diff reopen fix

- 上轮实际进展：diff 收起后已完全不渲染中间 diff 面板，并补了 conversation-status resize；代码里确实存在 `diffPaneCollapsed` 状态和右侧宽度调节手柄。阻塞：用户反馈差异对比关闭后没有按钮再次打开，说明恢复入口过于隐式。
- 本轮诊断（补齐 cc-gui）：`ChatPage` 的 `handleSelectedEditChange()` 会在点击右侧文件行时重新展开 diff，但 UI 没有明确告诉用户“这里能重新打开”；如果当前文件已经选中，用户更容易认为 diff 面板被永久关闭。
- 本轮诊断（超越 cc-gui）：收起行为应该可逆且可发现。显式 reopen 按钮能保留“收起后不占空间”的优点，同时避免用户为了恢复 diff 只能猜测点击文件行。
- 本轮规划：在右侧最近改动工具栏增加一个仅在 `isDiffPaneCollapsed && selectedEditKey` 时显示的图标按钮，点击后调用 `onOpenDiffPanel()`；不新增占位面板，不改变文件行点击重新展开的现有逻辑。
- 本轮完成：`src/components/chat/StatusPanel.tsx` 新增 `isDiffPaneCollapsed` / `onOpenDiffPanel` props，并在 edit toolbar 渲染 `status-diff-pane-reopen` 按钮；`src/pages/ChatPage.tsx` 传入 `diffPaneCollapsed` 和 `setDiffPaneCollapsed(false)`；`src/locales/zh.json` / `src/locales/en.json` 增加 `expandDiffPanel` 文案；`src/components/chat/StatusPanel.test.tsx` 增加显式恢复按钮回归测试；`.trellis/spec/frontend/component-guidelines.md` 已记录收起后必须有显式恢复入口。
- 本轮验证：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatDiffReviewPane.test.tsx src/utils/chatUiBehavior.test.ts` 通过（3 files / 17 tests）；`npm test` 通过（20 files / 163 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮仅改前端，不需要 Rust check。
- 下一步候选：1) 桌面态点测：收起 diff 后右侧最近改动工具栏出现展开按钮，点击能恢复同一个 selected edit；2) 继续验证 split/unified 长 diff 横向滚动和列宽；3) 继续验证 Open File、系统通知、Codex 锚点。

## 迭代记录 2026-06-18 diff line wrap

- 上轮实际进展：diff 收起后显式恢复按钮已在代码中存在，`StatusPanel` 会在 `isDiffPaneCollapsed && selectedEditKey` 时展示 `status-diff-pane-reopen`，`ChatPage` 会传入 `setDiffPaneCollapsed(false)`；对应测试和构建已通过。阻塞仍是未做真实 Tauri 桌面点测。
- 本轮诊断（补齐 cc-gui）：cc-gui 主要用状态面板文件变更列表打开 IDE diff；当前项目已有更强的中间三栏 diff pane，但 `EditDiffPreview` panel 样式使用 `max-content` 列和长行不换行，窄三栏下用户容易只能看到局部代码，需要频繁横向滚动。
- 本轮诊断（超越 cc-gui）：中间 diff pane 应默认适配当前面板宽度，让用户在对话区、diff 区和右侧状态区同时存在时也能读完整变更；同时保留不换行模式，满足格式敏感代码或超长行精确审查。
- 本轮规划：优先给中间完整 diff 增加 wrap/no-wrap 展示切换，默认 wrap；价值高（直接对应“diff 看不全”和“三栏空间不足”）、频率高（每次查看长 diff 都会遇到）、成本低（纯展示层 CSS 与小状态），暂不扩大到后端 diff 数据或桌面权限链路。
- 本轮完成：`src/components/toolBlocks/EditDiffPreview.tsx` 新增 panel-only `wrapLines` 支持并默认开启；`src/components/chat/ChatDiffReviewPane.tsx` 增加可发现的图标切换按钮，默认自动换行，切换后进入横向滚动不换行；`src/styles/toolBlocks.css` 为 `edit-diff-panel-wrap` / `edit-diff-panel-nowrap` 分别定义三栏适配和横向滚动策略；`src/locales/zh.json` / `src/locales/en.json` 增加换行模式文案；`EditDiffPreview` 与 `ChatDiffReviewPane` 测试覆盖默认换行和切换入口；`.trellis/spec/frontend/component-guidelines.md` 已记录该 diff pane 约定。
- 本轮验证：`npm test -- src/components/toolBlocks/EditDiffPreview.test.tsx src/components/chat/ChatDiffReviewPane.test.tsx` 通过（2 files / 7 tests）；`npm run build` 通过；`npm test` 通过（20 files / 166 tests）；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮仅改前端展示、i18n、测试与文档，未运行 Rust check。
- 下一步候选：1) 真实桌面点测三栏 diff：默认换行是否解决长 diff 看不全，切换不换行是否保留横向滚动；2) 继续点测 diff 收起/展开按钮和三种 resize handle；3) 继续验证 Open File、系统通知、历史图片 lightbox、Codex 锚点跳转。

## 迭代记录 2026-06-18 diff wrap persistence

- 上轮实际进展：代码中确实存在 diff 默认换行、wrap/no-wrap 图标切换和收起后显式恢复按钮；`EditDiffPreview` 的 panel 变体默认 `wrapLines ?? true`，`StatusPanel` 在 `isDiffPaneCollapsed && selectedEditKey` 时显示 reopen 按钮。阻塞仍是未做真实 Tauri 桌面点测。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 diff 入口更多依赖 IDE 打开；当前项目新增了中间 diff pane 后，用户会频繁在三栏、两栏、收起/展开之间切换。如果换行偏好是 pane 内部 state，收起再展开会丢失用户刚选的审查模式。
- 本轮诊断（超越 cc-gui）：把换行偏好提升到 `ChatPage` 能让三栏审查行为更稳定，用户在看长 diff 时不需要每次重新切换 wrap/no-wrap，解决“收起来再打开又回默认”的重复操作痛点。
- 本轮规划：本轮不扩大改动面，只确认并固化 `ChatPage` 持有 `diffWrapLines`、`ChatDiffReviewPane` 受控渲染的现有实现，再补全全量验证和 Trellis 规范记录。
- 本轮完成：`src/pages/ChatPage.tsx` 已确认持有 `diffWrapLines` 并通过 `onWrapLinesChange={setDiffWrapLines}` 控制中间 diff pane；`src/components/chat/ChatDiffReviewPane.tsx` 已确认 `wrapLines` 为必传受控 prop；`.trellis/spec/frontend/component-guidelines.md` 新增“wrap/no-wrap preference belongs to ChatPage state”的组件契约。
- 本轮验证：`npm test` 通过（20 files / 167 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。
- 下一步候选：1) 真实桌面点测三栏 diff：wrap/no-wrap 切换后收起再展开是否保持偏好；2) 点测 diff 收起/展开按钮和三种 resize handle；3) 回到仍未闭环的 Open File、系统通知、历史图片 lightbox、Codex 锚点跳转。

## 迭代记录 2026-06-18 open file bridge normalization

- 上轮实际进展：diff wrap 状态已经由 `ChatPage` 持有并完成前端全量验证；阻塞仍是未在真实 Tauri 桌面点测 Open File、系统通知、图片 lightbox 和 Codex 锚点。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/utils/bridge.ts` 会在 `openFile()` 中解码 percent-encoded 路径、剥离 `file://` wrapper、解析 `:line` / `:line-endLine` 后再发给宿主；当前项目 `src/utils/bridge.ts` 直接把原始字符串传给 Tauri，遇到 `my%20file.ts`、`file:///C:/...`、Markdown/Search 里的 `path:line` 更容易打开失败。
- 本轮诊断（超越 cc-gui）：本项目后端已经支持 `cwd`、VS Code/Cursor/JetBrains 多编辑器发现和 Windows slash-drive / WSL 路径归一化；把前端导航字符串先清洗成后端命令参数，可以让右侧状态树、中间 diff、Read/Search 工具块和 Markdown 文件链接共用同一稳定 Open File 链路。
- 本轮规划：优先补 `src/utils/bridge.ts` 的路径清洗和行号解析，并加桥接层单测；不重写后端编辑器发现策略，避免扩大风险。
- 本轮完成：`src/utils/bridge.ts` 新增 `normalizeOpenFileTarget()`、`splitEditorLineSuffix()` 等局部 helper，`openFile()` 现在会 decode `%xx`、剥离 `file://`、解析 `:line` / `:line:column` / `:line-endLine`，显式 line 参数优先级高于路径后缀，并保留 `cwd` 传给 Tauri；`src/utils/bridge.test.ts` 新增回归测试；`.trellis/spec/backend/cross-layer-protocol.md` 更新 Editor Open File 命令契约。
- 本轮验证：`npm test -- src/utils/bridge.test.ts src/utils/toolPresentation.test.ts` 通过（2 files / 37 tests）；`cargo test --manifest-path src-tauri/Cargo.toml editor_commands -- --nocapture` 通过（5 tests）；`npm test` 通过（21 files / 172 tests）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。
- 下一步候选：1) 真实 Tauri 桌面点测状态面板、Read/Edit/Search、Markdown 文件链接的 Open File；2) 若仍失败，收集失败路径并补后端 fuzzy filename / project-root display path 兜底；3) 继续点测系统通知、历史图片 lightbox、Codex 长历史锚点。

## 迭代记录 2026-06-18 open file backend fuzzy fallback

- 上轮实际进展：`StatusPanel` 中已确认存在 `status-diff-pane-reopen` 显式恢复按钮，`ChatPage` 会传入 `diffPaneCollapsed` 和 `setDiffPaneCollapsed(false)`；前端 `openFile()` 也已完成 percent decode、`file://` 剥离和 line suffix 解析。阻塞仍是未做真实 Tauri 桌面点测，且后端仍缺 cc-gui 的短路径 fuzzy 兜底。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/handler/file/OpenFileHandler.java`，cc-gui 在直接路径和 project/session cwd 解析失败后，会通过文件名和路径后缀搜索项目文件；当前项目 `src-tauri/src/commands/editor_commands.rs` 只返回 `cwd + relative`，当工具块/历史只给 `linkify.ts` 或 `utils/linkify.ts` 时仍可能交给编辑器一个不存在的路径。
- 本轮诊断（超越 cc-gui）：Tauri 端没有 IDE 索引，所以不能无界递归扫整个项目；本轮采用有上限的项目目录搜索，并跳过 `.git`、`node_modules`、`target`、`dist` 等生成/依赖目录，优先路径后缀精确匹配，再退回文件名和常见源码目录偏好，避免 Open File 因短路径变慢或误开依赖文件。
- 本轮规划：优先补后端 `resolve_file_path()` fuzzy fallback，并用 Rust 单测锁住短文件名、路径后缀优先级和跳过依赖目录三类边界；暂不扩大到真实桌面启动和点击测试。
- 本轮完成：`src-tauri/src/commands/editor_commands.rs` 新增 bounded fuzzy search helper，`resolve_file_path()` 在 `cwd + relative` 不存在时会按文件名/路径后缀从 `cwd` 下查找最佳文件；同时新增 `MAX_FUZZY_SEARCH_ENTRIES` 与跳过目录规则，避免大型项目卡顿；`.trellis/spec/backend/cross-layer-protocol.md` 已补充 Editor Open File 的后端 fuzzy fallback 跨层契约。
- 本轮验证：`cargo test --manifest-path src-tauri/Cargo.toml editor_commands -- --nocapture` 通过（8 tests）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（90 tests，doc tests 2 ignored）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。未运行真实 Tauri 桌面点测。
- 下一步候选：1) 运行 `npm run tauri dev` 桌面点测状态树、Read/Edit/Search、Markdown 文件链接 Open File 是否能打开短路径和路径后缀；2) 点测 diff 收起/展开、wrap/no-wrap 和三种 resize handle；3) 继续验证 Windows 右下角系统通知、历史图片 lightbox、Codex 长历史锚点跳转。

## 迭代记录 2026-06-18 session refresh visibility

- 上轮实际进展：后端 Open File fuzzy fallback 已落地并通过 Rust 定向/全量测试；`StatusPanel` 的 diff 重新打开按钮、会话列表缓存、手动项目选择锁、普通工具权限弹窗和原生系统通知主路径在代码中均真实存在。阻塞仍是未做真实 Tauri 桌面点测。
- 本轮诊断（补齐 cc-gui）：会话侧栏已经具备项目/会话分栏与缓存，但强制刷新会话时保留旧列表且只有刷新按钮旋转。用户之前反馈“切项目/加载会话列表慢、列表不变”，在这种状态下容易误判为没有触发刷新。
- 本轮诊断（超越 cc-gui）：刷新时不清空旧列表是正确的，能避免空白闪烁；但需要一个低对比、明确的状态行告诉用户“旧列表仍可看，新数据正在加载”，解决可感知反馈不足的问题。
- 本轮规划：优先给 `ChatSessionSidebar` 增加刷新状态行，价值中高（会话入口高频、直接回应列表不变的误解）、成本低（纯前端展示 + i18n + 单测），不扩大到真实桌面点测或后端扫描策略。
- 本轮完成：`src/components/chat/chatSessionSidebarUtils.ts` 新增 `shouldShowSessionRefreshStatus()`；`src/components/chat/ChatSessionSidebar.tsx` 在刷新已有会话列表时保留旧列表并显示 `role="status"` 的紧凑刷新行；`src/locales/zh.json` / `src/locales/en.json` 新增 `chat.sessionPanel.refreshingSessions`；`src/components/chat/chatSessionSidebarUtils.test.ts` 补充刷新状态判断测试；`.trellis/spec/frontend/component-guidelines.md` 记录刷新时保留列表并显示轻量状态行的组件约定。
- 本轮验证：`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts` 通过（12 tests）；`npm run build` 通过；`npm test` 通过（21 files / 173 tests）；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮仅改前端展示/文案/文档，未运行 Rust check。
- 下一步候选：1) 真实 Tauri 桌面点测会话侧栏：切项目、强制刷新、点击历史会话加载与继续发送；2) 真实点测 Open File、系统通知、历史图片 lightbox、Codex 长历史锚点；3) 若桌面点测发现列表扫描仍慢，再回到 Rust session provider 做增量读取/取消扫描优化。

## 迭代记录 2026-06-18 diff reopen discoverability

- 上轮实际进展：会话侧栏刷新状态行已在代码中存在并通过定向测试、全量前端测试和构建；`StatusPanel` 也确实已有 `status-diff-pane-reopen` 按钮。阻塞：用户继续反馈“差异对比关闭，没有按钮再次打开”，说明上一轮按钮虽然存在，但过于隐式且显示条件依赖 `selectedEditKey`，真实使用中仍可能不可见或不够可发现；真实 Tauri 桌面点测仍未完成。
- 本轮诊断（补齐 cc-gui）：对照当前 `StatusPanel.tsx` 代码，diff 恢复入口位于 edit toolbar 左侧的小图标，并且条件是 `isDiffPaneCollapsed && selectedEditKey && onOpenDiffPanel`。如果用户没有明确选中文件、或者只看“最近改动”标题行右侧，就会认为收起后没有恢复入口。
- 本轮诊断（超越 cc-gui）：中间 diff pane 收起后应保持“不占页面空间”，但恢复入口必须固定、右侧、可发现。把入口放到“最近改动”标题行最右侧，并放宽为“diff 已收起 + 当前加载窗口有任意 edit 记录”，可以避免把恢复行为藏在文件行点击或选中状态里。
- 本轮规划：优先修复 diff 恢复入口可发现性，价值高（直接回应用户刚反馈的断点）、频率高（查看 diff 后频繁收起/恢复）、成本低（纯展示层 + 回归测试）；暂不扩大到桌面启动和会话扫描后端优化。
- 本轮完成：`src/components/chat/StatusPanel.tsx` 新增 `canReopenDiffPane`，恢复按钮移到“最近改动”标题行右侧，显示条件从依赖 `selectedEditKey` 改为依赖 `allEdits.length > 0`；`src/styles/toolBlocks.css` 为标题行恢复按钮增加更明确的浅/深色主题强调；`src/components/chat/StatusPanel.test.tsx` 把回归测试改为“不传 selectedEditKey 也必须显示恢复入口”；`.trellis/spec/frontend/component-guidelines.md` 更新组件契约，明确恢复入口不应依赖 selected edit。
- 本轮验证：`npm test -- src/components/chat/StatusPanel.test.tsx` 通过（5 tests）；`npm test -- src/components/chat/ChatDiffReviewPane.test.tsx src/utils/chatUiBehavior.test.ts` 通过（2 files / 14 tests）；`npm test` 通过（21 files / 173 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮仅改前端展示、测试与 Trellis 规范，未运行 Rust check。
- 下一步候选：1) 真实 Tauri 桌面点测：收起 diff 后“最近改动”标题行右侧是否一直能看到恢复按钮，点击是否恢复同一条/第一条 edit；2) 继续点测 Open File、系统通知、历史图片 lightbox、Codex 长历史锚点；3) 若会话切项目或历史加载仍慢，回到 Rust session provider 做增量读取/取消扫描优化。

## 迭代记录 2026-06-18 handoff summary filtering

- 上轮实际进展：diff 恢复入口可发现性已经在代码中落地，`StatusPanel` 的恢复按钮条件确实不再依赖 `selectedEditKey`；对应定向测试、全量前端测试、构建和 `git diff --check` 已通过。阻塞：真实 Tauri 桌面点测仍未完成；另外上一轮 handoff-summary 过滤虽然代码和测试已完成，但尚未写入 Trellis 迭代记录。
- 本轮诊断（补齐 cc-gui）：历史会话加载会把运行时 handoff summary 当作用户消息带入 transcript、搜索和锚点，这类内容与 cc-gui 的可见聊天历史语义不一致，属于运行上下文而非用户提示词。
- 本轮诊断（超越 cc-gui）：跨模型续聊需要隐藏上下文转交信息，但不能让这些文字再次进入 provider-switch handoff prompt，否则会污染下一轮模型上下文并制造伪用户输入。统一走 shared protocol-context predicate 可以同时保护 transcript、anchors、search 和 provider handoff。
- 本轮规划：优先扩展共享协议上下文判断，覆盖 `Another language model started to solve this problem...` 与 `## Handoff Summary`，并补前端回归测试；不新增组件分支，避免每个渲染入口自行过滤。
- 本轮完成：`src/utils/chatMessageFlow.ts` 的 `PROTOCOL_CONTEXT_PREFIXES` 增加 handoff summary 前缀；`src/utils/chatMessageFlow.test.ts` 覆盖 handoff summary 不渲染；`src/utils/chatNavigation.test.ts` 覆盖 handoff summary 不进入 renderable messages 与 anchors；`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/backend/cross-layer-protocol.md` 已记录该协议上下文规则。
- 本轮验证：`npm test -- src/utils/chatMessageFlow.test.ts src/utils/chatNavigation.test.ts` 通过（2 files / 28 tests）；`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageAnchorRail.test.tsx` 通过（2 files / 12 tests）；`npm test` 通过（21 files / 175 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮是前端共享过滤与文档更新，未运行 Rust check。
- 下一步候选：1) 真实 Tauri 桌面点测：历史会话中 AGENTS、heartbeat、handoff summary、system prompt 不显示且不生成锚点；2) 继续点测 diff 收起/恢复、Open File、系统通知、历史图片 lightbox；3) 若长历史锚点仍错位，继续用真实 Codex/Claude session jsonl 反推折叠窗口与 DOM 注册状态。

## 迭代记录 2026-06-18 large edit tree default collapse

- 上轮实际进展：handoff summary 过滤已在代码中确实存在，本轮已补齐 Trellis 记录；diff 恢复按钮和三栏 diff 的前端验证仍保持通过。阻塞：真实 Tauri 桌面点测仍未完成，尤其是 Open File、系统通知、图片 lightbox 和长历史锚点。
- 本轮诊断（补齐 cc-gui）：状态面板已经有树状文件列表、文件夹展开/收起按钮和独立滚动区，但 `collapsedFolders` 初始为空，导致大量改动文件默认全展开；用户之前明确反馈 150 个文件时列表难滚动，希望是树状结构并能收缩展开。
- 本轮诊断（超越 cc-gui）：大文件数默认折叠到文件夹行，小文件数保持展开，能兼顾扫描效率和直接可见性；同时保留用户手动展开/收起后的选择，避免流式更新时反复重置视图。
- 本轮规划：只改 `StatusPanel` 的展示默认值和状态保持逻辑，价值高（大量修改场景高频且痛点明显）、成本低（纯前端展示）、风险低（不碰后端和 diff 数据聚合）。
- 本轮完成：`src/components/chat/StatusPanel.tsx` 新增 `AUTO_COLLAPSE_EDIT_TREE_FILE_THRESHOLD`、编辑集 key 和默认折叠文件夹集合；超过阈值时初始收起文件夹，小列表保持展开，用户手动调整后在后续 transcript 更新中保留该选择；`src/components/chat/StatusPanel.test.tsx` 新增 30 文件默认折叠回归测试，并确认既有小列表树仍展开；`.trellis/spec/frontend/component-guidelines.md` 记录大文件树默认折叠契约。
- 本轮验证：`npm test -- src/components/chat/StatusPanel.test.tsx` 通过（1 file / 6 tests）；`npm test -- src/utils/chatMessageFlow.test.ts src/utils/chatNavigation.test.ts` 通过（2 files / 28 tests）；`npm test` 通过（21 files / 176 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮仅改前端展示、测试与 Trellis spec，未运行 Rust check。
- 下一步候选：1) 真实 Tauri 桌面点测：150+ 文件状态树默认是否折叠、展开/收起按钮是否顺手、diff 恢复按钮是否可见；2) 继续点测 Open File、系统通知、历史图片 lightbox、Codex 长历史锚点；3) 若会话切项目或历史加载仍慢，进入 Rust session provider 的增量扫描/取消扫描优化。

## 迭代记录 2026-06-18 session cache project boundary

- 上轮实际进展：大文件树默认折叠已经在代码中落地，`StatusPanel` 有阈值默认折叠、用户手动状态保留和回归测试；`npm test`、`npm run build`、`git diff --check` 均已通过。阻塞仍是未做真实 Tauri 桌面点测。
- 本轮诊断（补齐 cc-gui）：用户曾反馈“点击 ccg-switch 项目有会话，再切换到别的项目，会话列表不变”。当前会话侧栏已经有项目列表、缓存、in-flight 去重和刷新状态，但 `rememberProjectSessions()` 会把一次 `list_sessions(projectPath)` 返回的所有 `session.projectDir` 都写成缓存别名；如果后端扫描结果混入其它项目 session，前端就可能把旧项目结果缓存到新项目 key。
- 本轮诊断（超越 cc-gui）：缓存应提升速度，但不能牺牲项目边界。前端需要把“明确属于其它 projectDir 的 session”挡在展示和缓存之外，避免一次脏扫描污染后续项目切换，让用户误判为点击项目没有生效。
- 本轮规划：优先收紧 `chatSessionSidebarUtils` 的项目过滤与缓存别名策略。价值高（直接对应会话列表不变反馈）、成本低（纯 helper + 单测）、风险低（保留 `projectDir=null` 的 legacy session，避免误删无法归属但已由后端 scoped 的历史）。
- 本轮完成：`src/components/chat/chatSessionSidebarUtils.ts` 新增 `filterProjectChatSessions()` 与项目归属判断；`rememberProjectSessions()` 只保留 provider 支持且 `projectDir` 为空或等于当前项目的 session，并且不再把明确不同项目的 `projectDir` 写入 cache key；`src/components/chat/chatSessionSidebarUtils.test.ts` 新增跨项目过滤和缓存污染回归测试；`.trellis/spec/frontend/component-guidelines.md` 记录会话缓存不得跨项目污染的组件契约。
- 本轮验证：`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts` 通过（1 file / 14 tests）；`npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts` 通过（2 files / 29 tests）；`npm test` 通过（21 files / 178 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮仅改前端 helper、测试与 Trellis spec，未运行 Rust check。
- 下一步候选：1) 真实 Tauri 桌面点测：切换 ccg-switch 与其它项目时，旧会话列表是否立即清空/刷新且不被缓存污染；2) 若桌面点测仍慢，再进入 Rust `list_sessions(projectPath)` 做增量扫描和取消扫描优化；3) 继续点测 Open File、系统通知、历史图片 lightbox、Codex 长历史锚点。

## 迭代记录 2026-06-18 codex session metadata cache

- 上轮实际进展：前端会话缓存项目边界已经在代码中落地，`rememberProjectSessions()` 会过滤明确属于其他项目的 session，相关前端测试/构建通过。阻塞仍是未做真实 Tauri 桌面点测；用户此前反馈的“点击项目/加载会话慢”在后端仍可能由 Codex 会话目录重复扫描放大。
- 本轮诊断（补齐 cc-gui）：对照 cc-gui 的 `SessionLoadService`，历史加载请求显式携带 `sessionId + projectPath`，项目语境是核心约束。当前项目后端 `list_sessions(projectPath)` 已先读 `session_meta.payload.cwd` 过滤无关 JSONL，但每次项目切换仍会递归收集并重新打开解析 `.codex/sessions` 下所有历史文件。
- 本轮诊断（超越 cc-gui）：前端缓存解决的是同项目重复点击；后端 metadata cache 解决的是跨项目来回切换。用 JSONL 路径 + 文件长度 + modified timestamp 做失效键，可以在不改变 Tauri 命令协议的前提下，复用已解析的 `cwd/title/timestamps`，让会话列表刷新更接近“只确认文件是否变更”，降低假死感。
- 本轮规划：只改 Codex provider 的会话列表扫描，不碰历史消息加载、前端侧栏和现有返回结构。优先级高：用户价值高（会话入口高频）、出现频率高（项目切换/刷新）、实现成本中低（provider 内部缓存 + Rust 单测）。
- 本轮完成：`src-tauri/src/session_manager/providers/codex.rs` 新增进程内 `CODEX_SESSION_META_CACHE`，缓存 `session_id/project_dir/title/created_at/last_active_at/source_path/title_scanned`；项目不匹配时只缓存 `cwd` 和时间戳，不继续读取标题；之后切到匹配项目时会补读标题并更新缓存；文件长度或 modified timestamp 变化会自动失效；`.trellis/spec/backend/cross-layer-protocol.md` 同步记录 Codex session metadata cache 契约。
- 本轮验证：`cargo fmt --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::codex -- --nocapture` 通过（8 tests）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（92 tests，doc tests 2 ignored）；`npm test` 通过（21 files / 178 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。未运行真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测会话侧栏项目切换耗时与列表是否清空/刷新；2) 继续点测 diff 恢复按钮、Open File、系统通知、历史图片 lightbox、Codex 长历史锚点；3) 若项目切换仍慢，继续把 Codex 文件枚举本身做目录级缓存或最近日期目录优先策略。

## 迭代记录 2026-06-18 codex session file list cache

- 上轮实际进展：`src-tauri/src/session_manager/providers/codex.rs` 中已确认存在进程内 `CODEX_SESSION_META_CACHE`，可以按 JSONL 路径 + 文件长度 + modified timestamp 复用 `cwd/title/timestamps`；`StatusPanel` 的 diff 恢复入口也已在代码中确认存在，条件是 `diffPaneCollapsed && allEdits.length > 0`，不再依赖 `selectedEditKey`。阻塞仍是未运行真实 Tauri 桌面点测，无法直接量化项目切换列表耗时和按钮可见性。
- 本轮诊断（补齐 cc-gui）：cc-gui 的会话加载始终带 `sessionId + projectPath`，项目切换的响应应稳定且明确。当前项目虽然已避免重复解析 Codex JSONL 内容，但每次 `list_sessions(projectPath)` 仍会重新递归枚举 `~/.codex/sessions` 下所有日期目录和 JSONL 文件，大历史目录下仍可能表现为切项目慢或刷新假死。
- 本轮诊断（超越 cc-gui）：只缓存 per-file metadata 还不够，目录枚举本身也应缓存；但不能用纯 project filter 缓存，否则新增/删除会话可能不可见。本轮采用目录树 stamp 作为文件列表缓存失效依据：项目间切换复用 JSONL 路径列表，新增/删除会话通过日期目录 modified timestamp 触发重新枚举，文件内容变化仍交给 per-file metadata cache。
- 本轮规划：优先补 Codex provider 内部文件列表缓存，价值高（直接针对会话入口慢）、频率高（项目切换/刷新/项目 provider map 都会触发）、实现成本中（Rust provider 内部改动 + 单测），不改变 Tauri 命令参数和前端状态结构。
- 本轮完成：`src-tauri/src/session_manager/providers/codex.rs` 新增 `CODEX_SESSION_FILE_LIST_CACHE`、`CodexSessionDirectoryStamp`、`CachedCodexSessionFileList` 和 `collect_jsonl_files_cached()`；`scan_codex_sessions_inner()` 与 `scan_codex_project_dirs()` 统一复用缓存路径列表；新增两个 Rust 单测覆盖“目录 stamp 相同则复用缓存”和“目录 stamp 变化则重新枚举”；为避免全量测试并发污染全局缓存，新增测试级 mutex 隔离文件列表缓存测试；`.trellis/spec/backend/cross-layer-protocol.md` 记录目录级缓存的失效边界。
- 本轮验证：`cargo fmt --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::codex -- --nocapture` 通过（10 tests）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（仅既有 `ChatMessageEvent` dead_code warning）；`npm test` 通过（21 files / 178 tests）；`npm run build` 通过；首次并行 `cargo test --manifest-path src-tauri/Cargo.toml` 暴露新增测试共享全局缓存的隔离问题，修复后复跑通过（94 tests，doc tests 2 ignored）；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。未运行真实 Tauri 桌面点测。
- 下一步候选：1) 运行真实 `npm run tauri dev` 点测会话侧栏：切换 ccg-switch 与其它项目时列表是否立即清空/刷新、第二次切换是否明显变快；2) 点测 diff 收起后右侧恢复按钮是否始终可见且能恢复同一/第一条 edit；3) 继续点测 Open File、系统通知、历史图片 lightbox、Codex 长历史锚点；4) 若会话列表仍慢，再考虑最近日期目录优先或给 `list_sessions` 增加显式 force/refresh 参数。

## 迭代记录 2026-06-18 diff reopen global affordance 待确认

- 上轮实际进展：Codex 会话文件列表缓存已在代码中存在，`scan_codex_sessions_inner()` 与 `scan_codex_project_dirs()` 复用目录 stamp 缓存；上一轮验证记录显示 Rust 定向/全量测试、前端测试、构建均通过。阻塞仍是 `npm run tauri dev` 被已有 1420 Vite 进程占用，真实桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：`StatusPanel.tsx` 当前确实有 `canReopenDiffPane = isDiffPaneCollapsed && allEdits.length > 0 && onOpenDiffPanel`，恢复按钮渲染在右侧状态栏“最近改动”标题行。但 `StatusPanel` 外层是 `hidden xl:block`，且中间 `ChatDiffReviewPane` 收起后完全卸载；在非 xl 宽度、右侧栏不可见或用户视线不在右侧栏时，会表现为“差异对比关闭后没有按钮再次打开”。
- 本轮诊断（超越 cc-gui）：收起 diff pane 不应继续占用中间空间，但恢复入口应独立于状态栏可见性。页面级浮动恢复按钮可以固定在 Chat review 区域最右侧，只在 `diffPaneCollapsed && selectedEdit` 时出现，点击后恢复中间 diff pane，同时保留右侧状态栏已有入口。
- 本轮规划：按 `AGENTS.md` bug 修复确认机制，先等待用户确认再改代码。拟改范围：`src/pages/ChatPage.tsx` 增加页面级恢复按钮；`src/styles/toolBlocks.css` 或现有全局样式增加按钮样式；`src/locales/zh.json` / `src/locales/en.json` 复用或补充 i18n 文案；`src/components/chat/ChatDiffReviewPane.test.tsx` 或 `src/utils/chatUiBehavior.test.ts` 以现有测试能力补回归；`.trellis/spec/frontend/component-guidelines.md` 记录恢复入口不依赖右侧栏。
- 本轮验证：本轮仅完成诊断与方案记录，未改业务代码，未运行构建/测试。
- 下一步候选：用户确认后先实现 diff 页面级恢复入口并跑 `npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatDiffReviewPane.test.tsx src/utils/chatUiBehavior.test.ts`、`npm test`、`npm run build`、`git diff --check`；随后继续真实桌面点测 diff 收起/恢复、会话切换、Open File、系统通知、历史图片 lightbox 与 Codex 锚点。

## 迭代记录 2026-06-18 diff reopen global affordance

- 上轮实际进展：上一条记录已确认 diff 恢复入口的真实缺口：`StatusPanel` 的恢复按钮存在，但右侧状态栏在 `xl` 以下隐藏，且用户视线不一定落在右侧栏，所以收起中间 diff pane 后仍可能表现为没有重新打开按钮。阻塞仍是没有完成 Tauri 桌面态点测。
- 本轮诊断（补齐 cc-gui）：当前项目已经有中间 diff pane、右侧 edit tree、split/unified toggle 和收起按钮；缺的是不依赖状态栏可见性的恢复入口。cc-gui 这类 IDE 风格面板交互通常保留显式 affordance，本项目原先把 affordance 放在可能隐藏的区域，和用户反馈一致。
- 本轮诊断（超越 cc-gui）：恢复入口应满足两个约束：一是收起 diff pane 后中间区域完全释放，不保留占位列；二是任何宽度下都能发现恢复按钮。本轮采用 Chat review layout 右侧浮动按钮，只在 `diffPaneCollapsed && selectedEdit` 时显示，按钮浮在布局上方而不参与三栏 flex 宽度分配。
- 本轮规划：优先修复 diff 恢复入口可发现性，价值高（直接回应最新用户反馈）、频率高（diff 查看/收起是高频操作）、实现成本低（纯前端 helper + UI + CSS + 回归测试），不扩大到真实 Tauri 点测或后端逻辑。
- 本轮完成：`src/utils/chatUiBehavior.ts` 新增 `shouldShowDiffPaneReopenControl()` 并由 `src/pages/ChatPage.tsx` 复用；`ChatPage` 在 diff 已收起且仍有 selected edit 时渲染 `chat-diff-pane-reopen-floating` 右侧浮动按钮，点击恢复中间 diff pane；`src/styles/toolBlocks.css` 为 Chat review layout 增加相对定位和浅/深色浮动按钮样式；`src/utils/chatUiBehavior.test.ts` 先红后绿覆盖恢复入口显示条件；`.trellis/spec/frontend/component-guidelines.md` 记录恢复入口不能只依赖右侧状态栏。
- 本轮验证：先运行 `npm test -- src/utils/chatUiBehavior.test.ts` 得到预期 RED（`shouldShowDiffPaneReopenControl is not a function`）；实现后复跑通过（10 tests）；`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatDiffReviewPane.test.tsx src/utils/chatUiBehavior.test.ts` 通过（3 files / 21 tests）；`npm test` 通过（21 files / 179 tests）；`npm run build` 通过；`git diff --check` 无 whitespace error，仅既有 LF/CRLF 提示。未运行 Rust check，因为本轮只改前端展示/helper/spec；未完成真实 Tauri 桌面点测。
- 下一步候选：1) 复用现有 1420 Vite 服务或调整 Tauri dev 启动方式，真实点测 diff 收起后右侧浮动恢复按钮是否可见且能恢复；2) 继续点测会话侧栏项目切换、历史加载耗时和列表缓存边界；3) 继续点测 Open File、Windows 系统通知、历史图片 lightbox、Codex 长历史锚点跳转；4) 若真实点测确认恢复按钮位置遮挡状态栏内容，再把浮动按钮改为贴边半露出的 vertical tab。

## 迭代记录 2026-06-18 session list project owner guard

- 上轮实际进展：diff 收起后的页面级恢复入口已在代码中存在，并通过定向测试、全量前端测试、构建和 `git diff --check`；阻塞仍是尚未完成真实 Tauri 桌面点测。两份项目路径本轮已确认可读：`C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui`，两边 `.codegraph/` 也存在。
- 本轮诊断（补齐 cc-gui）：cc-gui 的会话加载服务明确携带 `sessionId + projectPath`，项目语境是会话历史的边界。当前项目虽然已有项目缓存、跨项目过滤和 in-flight 去重，但 UI 只有一个 `sessions` 数组；如果项目切换、缓存更新或请求竞态出现状态漂移，旧项目列表仍可能短暂展示在新选中项目下，让用户继续感觉“切项目后列表没变”。
- 本轮诊断（超越 cc-gui）：会话列表不只要缓存快，还要让“当前列表属于哪个项目”成为状态契约。将列表归属项目独立记录，可以在新项目扫描未完成时立即隐藏旧项目行，同时强制刷新失败时保留当前项目旧列表，降低空白闪烁和误判。
- 本轮规划：优先做前端小范围状态守卫，价值高（直接对应项目切换列表不变反馈）、频率高（会话侧栏高频入口）、成本低（纯 helper + 组件状态 + 单测），暂不扩大到 Rust provider 新扫描策略。
- 本轮完成：`src/components/chat/chatSessionSidebarUtils.ts` 新增 `getVisibleProjectSessions()`，只有列表归属项目与当前选中项目规范化一致时才返回可见列表，并继续过滤 unsupported provider 和其它项目 session；`src/components/chat/ChatSessionSidebar.tsx` 新增 `sessionsProjectPath`，缓存命中、清空、成功和失败分支都会标记列表归属，渲染和搜索统一使用 `visibleSessions`，强制刷新失败不清空当前项目已有列表；`src/components/chat/chatSessionSidebarUtils.test.ts` 新增旧项目列表隐藏、当前项目列表过滤两条回归测试；`.trellis/spec/frontend/component-guidelines.md` 补充会话列表必须跟踪列表归属项目的组件契约。
- 本轮验证：`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts` 通过（16 tests）；`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts` 通过（3 files / 45 tests）；`npm run build` 通过；`npm test` 通过（21 files / 181 tests）；`git diff --check` 无 whitespace error，仅既有 LF/CRLF 提示。本轮仅改前端组件/helper/spec/TODO，未运行 Rust check；真实 Tauri 桌面点测仍未完成。
- 下一步候选：1) 真实 Tauri 桌面点测会话侧栏：在 `ccg-switch` 与其它项目间切换，确认旧项目行立即隐藏、缓存命中正常、刷新失败不误清空当前项目列表；2) 复测 diff 收起后的页面级恢复按钮、Open File、Windows 右下角系统通知、历史图片 lightbox、Codex 长历史锚点；3) 若真实点测仍感觉切项目慢，再进入 Rust `list_sessions(projectPath)` 做最近日期目录优先、显式刷新/取消扫描或增量返回。

## 迭代记录 2026-06-18 turn stopped notification dedupe

- 上轮实际进展：会话列表项目归属守卫已经在代码中落地，`ChatSessionSidebar` 用 `sessionsProjectPath` 防止旧项目列表展示到新项目下，相关测试、构建和 `git diff --check` 已通过。阻塞仍是没有完成真实 Tauri 桌面点测；本轮确认 1420 前端服务可访问（`HTTP 200`），但未重启/接管 Tauri 桌面进程。
- 本轮诊断（补齐 cc-gui）：用户明确要求任务完成、中断等停止输出场景要走 Windows 右下角通知。当前代码中 `chat://done` success/error、`abort()` 和 `chat_send` 失败路径已经调用 `notifyStoppedRequestOnce()`，但 store 层缺少“同一 request 多个终止事件只通知一次”的回归测试，未来改动容易造成重复 OS 通知。
- 本轮诊断（超越 cc-gui）：桌面通知要可靠但不能打扰。daemon 可能重复发 terminal done，用户 abort 后也可能再收到迟到 done；以 request id 去重能保证用户收到停止状态，但不会因为重复事件被连续弹窗打断。
- 本轮规划：不改运行时代码，优先补 store 级幂等回归测试并同步状态管理规范。价值中高（直接覆盖用户要求的系统通知行为）、成本低（单测 + spec）、风险低（不触碰 Tauri 通知命令实现）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增 `deduplicates stopped notifications for the same request id`，模拟同一 `chat://done` 连续到达两次，只允许 `notifyChatTurnStopped()` 调用一次；`.trellis/spec/frontend/state-management.md` 新增 Chat Turn-Stopped Notifications 场景，记录 success/error/aborted/send-error 覆盖范围、request id 去重和测试要求。
- 本轮验证：`npm test -- src/stores/useChatStore.test.ts` 通过（18 tests）；`npm test -- src/stores/useChatStore.test.ts src/utils/desktopNotification.test.ts` 通过（2 files / 26 tests）；`npm run build` 通过；`npm test` 通过（21 files / 182 tests）；`git diff --check` 无 whitespace error，仅既有 LF/CRLF 提示。本轮仅改前端测试、Trellis spec/TODO，未运行 Rust check；真实 Windows 通知弹窗仍需在 Tauri 桌面态点测。
- 下一步候选：1) 真实 Tauri 桌面点测 Windows 右下角通知：完成、失败、abort 是否各弹一次且重复 done 不重复弹；2) 点测会话侧栏项目切换和历史加载速度；3) 继续点测 diff 全局恢复按钮、Open File、历史图片 lightbox、Codex 长历史锚点；4) 若真实点测仍不能覆盖，可考虑给 Tauri `chat_show_system_notification` 增加后端命令级 smoke test。

## 迭代记录 2026-06-19 notification backend guard 待确认

- 上轮实际进展：会话停止通知的前端 store 层去重测试已在代码中存在，`notifyStoppedRequestOnce()` 能避免同一 request id 重复触发系统通知；`desktopNotification.ts` 已优先调用 Tauri 原生命令，失败后回退 Web Notification。阻塞仍是未做真实 Tauri 桌面点测，无法直接观察 Windows 右下角弹窗。
- 本轮诊断（补齐 cc-gui）：本轮已确认 `src-tauri/src/lib.rs` 初始化了 `tauri_plugin_notification`，`chat_show_system_notification` 已注册到 `generate_handler!`，`src-tauri/capabilities/default.json` 和 `src-tauri/tauri.conf.json` 均包含 `notification:default`，`src-tauri/Cargo.toml` 已包含 `tauri-plugin-notification = "2.3.3"`。因此当前主链路不是“未接插件/权限”，而是 Rust 命令 payload 边界缺少单测守护。
- 本轮诊断（超越 cc-gui）：系统通知是长任务完成后的跨窗口提醒，应该稳定但不打扰。把标题/正文 trim、空标题拒绝等边界抽成纯 helper 并补 Rust 单测，可以在不触发真实 OS 通知的情况下守住命令入参契约，降低后续改动造成通知悄悄失效的风险。
- 本轮规划：根据 `AGENTS.md` 的 Bug 修复确认机制，本轮先不改业务代码。拟在用户确认后，仅修改 `src-tauri/src/commands/chat_commands.rs`：新增私有 `normalize_system_notification_payload(title, body) -> Result<(&str, &str), String>` 或等价 owned helper，`chat_show_system_notification` 复用它，并添加 `#[cfg(test)]` 单测覆盖 title/body trim、空 title 报错、空 body 允许发送。若实现需要 owned 字符串，会选择最小生命周期风险方案。
- 本轮验证：本轮只做只读核实与方案记录，未运行构建/测试，未改业务代码。
- 下一步候选：1) 用户确认后实现通知 payload helper + Rust 单测，运行 `cargo test --manifest-path src-tauri/Cargo.toml commands::chat_commands -- --nocapture`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm test -- src/stores/useChatStore.test.ts src/utils/desktopNotification.test.ts`、`npm run build`、`git diff --check`；2) 真实 Tauri 桌面点测 Windows 通知；3) 继续点测会话侧栏项目切换、diff 全局恢复按钮、Open File、历史图片 lightbox、Codex 长历史锚点。

## 迭代记录 2026-06-19 notification backend guard 等待确认

- 上轮实际进展：`TODO_LIST.md` 已记录通知后端 payload guard 的具体方案；本轮复查确认两份项目路径与 `.codegraph/` 仍可读，工作区仍有大量既有未提交改动。
- 本轮阻塞：根据 `AGENTS.md`，Bug 修复/脚本执行/高风险文件修改必须先出方案并等待用户确认。当前尚未收到对 `src-tauri/src/commands/chat_commands.rs` 通知 payload helper + Rust 单测方案的明确确认，因此本轮不改业务代码、不运行验证命令。
- 下一步候选：用户确认后实施上一条方案并执行 Rust/前端验证；若用户希望跳过该 guard，则转入真实 Tauri 桌面点测会话切换、diff 恢复按钮、Open File、系统通知、历史图片 lightbox 与 Codex 锚点。

## 迭代记录 2026-06-19 chat interaction bug audit 待确认

- 上轮实际进展：通知后端 payload guard 仍处于待确认状态，尚未改业务代码；用户最新要求转向“仔细排查聊天交互方面的 bug”。本轮按 Trellis 恢复记录，并用 CodeGraph 复查 `ccg-switch` 与 `jetbrains-cc-gui` 关键聊天链路。两份代码路径均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：`src-tauri/src/chat/manager.rs` 已给 `chat://stream` / `chat://done` 带 `requestId`，但 `src/stores/useChatStore.ts` 的 stream/done/message 监听仍按全局“最后一条 streaming assistant”处理，没有校验 active request。`chat://message` 事件甚至没有携带 `requestId`。这会导致 abort、切会话、新建会话、切 provider 后的迟到事件污染当前会话或错误结束新请求。cc-gui 后端会把发送时的 provider/session/model 固定在 `SessionState` / `runtimeSessionEpoch` 一类会话状态中，本项目前端全局 store 更需要显式 request ownership guard。
- 本轮诊断（补齐 cc-gui）：`src/components/chat/composer/ButtonArea.tsx` 在 `isLoading` 时仍允许切 provider / mode / model / reasoning；`src/stores/useChatStore.ts` 的 `setProvider()` 会清空 `sessionId/activeSession` 并设置 handoff。流式输出中切换这些选项会放大上面的 request 归属错乱。
- 本轮诊断（超越 cc-gui）：`src/components/chat/composer/useCompletions.ts` 在补全菜单 loading 且 `items.length === 0` 时不消费 Enter/Tab，`ChatComposer` 会继续把半成品 `/`、`@path`、`#agent` 直接发送。现有 `useCompletions.test.ts` 只覆盖纯函数，缺少键盘交互回归。
- 本轮诊断（超越 cc-gui）：`src/components/chat/composer/ChatComposer.tsx` 会在 `await send(...)` 前立即 `setAttachments([])`；而 store 的 `send()` catch 会吞掉 `chat_send` 错误，只写 error 状态，不把失败反馈给 composer。后端 invoke 失败时图片附件会丢失，用户需要重新上传。
- 本轮诊断（补齐 cc-gui）：`src/components/chat/AskUserQuestionDialog.tsx` 的 `handleCancel()` 同时调用 `onAnswer({})` 和 `onCancel()`，而 `src/pages/ChatPage.tsx` 又把 `onCancel` 绑定为 `answerAskUserQuestion(...,{})`，取消/点击遮罩会对同一 request 响应两次，可能造成权限响应竞态或后端日志噪声。
- 本轮规划：根据 `AGENTS.md` bug 修复确认机制，本轮只记录排查结果与方案，不直接改业务代码。建议第一批优先修 P0/P1：1) request ownership guard + `chat://message` requestId 补齐；2) active request 期间冻结 provider/model/mode/reasoning 的 UI 和 store action；3) AskUserQuestion 取消只响应一次。第二批再修补全 loading Enter/Tab 与发送失败附件恢复，因为它们影响面较小但体验价值明确。
- 本轮验证：本轮只读核实与 Trellis 记录更新，未运行构建/测试，未改业务代码。用户确认后先写失败测试，再实现，最后执行 `npm test -- src/stores/useChatStore.test.ts src/components/chat/composer/useCompletions.test.ts`、`npm test`、`npm run build`、如改 Rust 事件 payload 则执行 `cargo test --manifest-path src-tauri/Cargo.toml chat -- --nocapture`、`cargo check --manifest-path src-tauri/Cargo.toml`、`git diff --check`。
- 下一步候选：用户确认后先进入第一批修复；若需要更稳，可拆成 P0 request ownership 单独一轮，权限/输入区交互作为后一轮。

## 迭代记录 2026-06-19 chat request ownership guard

- 上轮实际进展：用户已确认 `chat interaction bug audit` 中的第一批修复方案。本轮复查确认两份代码路径可读：`C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui`；两边 `.codegraph/` 均存在。记录里声称的风险也在代码中确实存在：`chat://stream` / `chat://done` 之前虽然有 requestId，但前端监听缺少归属过滤；`chat://message` 之前缺少 requestId；composer selector 在 loading 中仍可点击；AskUserQuestion cancel 路径存在重复响应风险。
- 本轮诊断（补齐 cc-gui）：cc-gui 的会话/运行状态会把一次发送的 provider、session、model 与 runtime 请求绑定；本项目全局 Zustand store 必须显式按 `requestId` 拦截迟到 `stream/message/done`，否则 abort、切会话或新建会话后的旧事件会污染当前 transcript。进一步排查还发现一个更细竞态：旧 request 已 done/abort 后，如果用户马上发新请求，而新 `chat_send` 还没返回 requestId，旧 request 的迟到事件会借新的 streaming assistant 绑定进去。
- 本轮诊断（超越 cc-gui）：active turn 期间不仅要禁用 UI 下拉，也要让 store action 自身 no-op，防止测试、快捷键或未来入口绕过 UI；AskUserQuestion 取消/遮罩/重复点击应是幂等响应，避免后端权限文件被写两次导致日志噪声或等待状态异常。
- 本轮规划：第一批只修 P0/P1 交互正确性：1) request ownership guard + `chat://message` 携带 requestId；2) active request 期间冻结 provider/model/permission mode/reasoning；3) AskUserQuestion 取消只响应一次。暂不处理第二批 `/` 补全 loading Enter/Tab 和发送失败附件恢复，避免本轮范围过大。
- 本轮完成：`src-tauri/src/models/chat.rs` 扩展 Rust `ChatMessageEvent { requestId, json }`；`src-tauri/src/chat/manager.rs` 用该 struct emit `chat://message` 并保留原始 stream 行；`src/types/chat.ts` 新增前端 `ChatMessageEvent`；`src/stores/useChatStore.ts` 新增 request event 归属过滤、pending request 绑定、retired request id 集合、active turn setter no-op 和 AskUserQuestion 乐观清空/失败恢复；`src/components/chat/AskUserQuestionDialog.tsx` 的 cancel 路径改为单入口；`src/components/chat/composer/SelectorDropdown.tsx` 支持 disabled 并自动关闭菜单；`src/components/chat/composer/ButtonArea.tsx` 在 `isLoading` 时禁用 provider/mode/model/reasoning selector；`src/stores/useChatStore.test.ts` 与 `src/components/chat/composer/ButtonArea.test.tsx` 补齐回归测试；`.trellis/spec/frontend/state-management.md` 和 `.trellis/spec/backend/cross-layer-protocol.md` 同步记录请求归属与事件 payload 契约。
- 本轮验证：先新增回归测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败于“retired request 绑定下一轮 pending turn”和“并发 AskUserQuestion 重复 invoke”；实现后 `npm test -- src/stores/useChatStore.test.ts` 通过（23 tests）；`npm test -- src/stores/useChatStore.test.ts src/components/chat/composer/ButtonArea.test.tsx` 通过（2 files / 24 tests）；`npm test` 通过（22 files / 188 tests）；首次 `npm run build` 暴露新增测试用了项目 TS lib 不支持的 `Array.prototype.at()`，已改成兼容索引写法；复跑 `npm run build` 通过；`cargo fmt --manifest-path src-tauri/Cargo.toml` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过且已无 `ChatMessageEvent` dead_code warning；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（94 tests，2 doctests ignored）。尚未运行真实 Tauri 桌面点测。
- 下一步候选：1) 第二批聊天交互修复：补全菜单 loading 时拦截 Enter/Tab，避免发送半成品 `/`、`@path`、`#agent`；2) 发送失败时恢复 composer 图片附件，避免 `chat_send` invoke 失败后用户必须重新上传；3) 真实 Tauri 桌面点测 request ownership、权限弹窗取消、会话切换、diff 恢复按钮、Open File、系统通知、历史图片 lightbox 与 Codex 长历史锚点。

## 迭代记录 2026-06-19 composer completion and failed send recovery

- 上轮实际进展：request ownership guard 已在代码中落地并验证，`chat://message` 已携带 requestId，active turn selector 与 store setter 已冻结，AskUserQuestion 响应已幂等；`npm test`、`npm run build`、`cargo check`、`cargo test` 均通过。阻塞仍是没有真实 Tauri 桌面点测。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/ChatInputBox/hooks/useCompletionDropdown.ts`，补全菜单只要打开就会消费 Enter/Tab；当前项目 `useCompletions.handleKeyDown()` 只有 `items.length > 0` 才消费 Enter/Tab，异步 loading 且空列表时会让 `ChatComposer` 把半成品 `/`、`@path`、`#agent` 直接发送。
- 本轮诊断（超越 cc-gui）：当前项目支持图片附件和 `chat_send` 前 optimistic 清空附件，但 store 原先吞掉失败且不返回结果，composer 无法知道需要恢复。对用户来说，发送失败后重新上传图片是高摩擦；失败发生在后端 request id 产生前时，应该保留可重试输入上下文。
- 本轮规划：只处理两个输入区交互点，优先级高（高频键盘路径 + 发送失败恢复）、成本低（纯前端 store/component/helper + tests）、风险低（不改后端命令协议）。暂不扩大到真实桌面点测或更多 slash command 数据源。
- 本轮完成：`src/components/chat/composer/useCompletions.ts` 新增 `shouldConsumeCompletionKey()`，补全菜单打开时 Enter/Tab 一律消费，避免 loading 空项误发送；`src/stores/useChatStore.ts` 将 `send()` 返回值改为 `Promise<boolean>`，成功拿到 requestId 返回 true，空输入或 `chat_send` 失败返回 false，同时保留原有 transcript/error/通知处理；`src/components/chat/composer/ChatComposer.tsx` 新增 `restoreFailedSendAttachments()`，发送失败时把刚清空的附件合并回当前附件列表，避免重复，并在当前 store draft 仍为空时恢复原 prompt；`src/components/chat/composer/useCompletions.test.ts`、`src/components/chat/composer/ChatComposer.test.ts`、`src/stores/useChatStore.test.ts` 补齐回归测试；`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 同步记录新契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/composer/useCompletions.test.ts src/components/chat/composer/ChatComposer.test.ts src/stores/useChatStore.test.ts` 失败于缺少 `shouldConsumeCompletionKey`、缺少 `restoreFailedSendAttachments`、`send()` 失败返回 `undefined`；实现后同命令通过（3 files / 34 tests）；`npm test` 通过（23 files / 193 tests）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）。本轮未运行 Rust 全量测试，因为只改前端逻辑与文档，Rust 侧未新增改动。
- 下一步候选：1) 真实 Tauri 桌面点测：补全 loading 时按 Enter/Tab 是否不发送半成品、`chat_send` 失败时附件和 prompt 是否恢复；2) 系统通知后端 payload guard 之前已记录方案但未实施，当前用户已授权无需确认，可在下一轮补 Rust helper + 单测；3) 继续真实点测会话切换、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 迭代记录 2026-06-19 notification backend payload guard

- 上轮实际进展：composer 补全菜单 Enter/Tab 拦截与发送失败附件恢复已经在代码中落地并验证；通知后端 guard 此前只记录过方案，用户后续已明确授权无需确认。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：系统通知链路已接通，`src/utils/desktopNotification.ts` 会优先 invoke `chat_show_system_notification`，`src-tauri/src/lib.rs` 已初始化 `tauri_plugin_notification` 并注册命令，`src-tauri/capabilities/default.json` 包含 `notification:default`。缺口不是插件/权限，而是 `src-tauri/src/commands/chat_commands.rs` 里 payload trim/空标题校验写在命令体内，缺少可单测的命令边界契约。
- 本轮诊断（超越 cc-gui）：系统通知是长任务完成、失败、中断后的跨窗口反馈。把 title/body 归一化抽成纯 helper 后，可以不触发真实 OS 通知也能锁住“trim、空标题拒绝、空 body 允许”的边界，避免后续改动让 Windows 通知静默失效。
- 本轮规划：本轮只处理通知命令 payload guard，价值中高（停止通知是后台长任务高频反馈）、频率中高（success/error/abort 都走该链路）、成本低（Rust helper + 单测）、风险低（不改前端文案和 Tauri 插件配置）。
- 本轮完成：`src-tauri/src/commands/chat_commands.rs` 新增私有 `SystemNotificationPayload` 与 `normalize_system_notification_payload()`，`chat_show_system_notification` 复用 helper 后再调用 `tauri-plugin-notification`；新增 3 个 Rust 单测覆盖 title/body trim、空 title 报错、空 body 允许；`.trellis/spec/backend/cross-layer-protocol.md` 将 Chat Turn-Stopped System Notification 升级为 7 段式可执行契约。
- 本轮验证：先新增 Rust 单测并确认 RED，`cargo test --manifest-path src-tauri/Cargo.toml commands::chat_commands -- --nocapture` 失败于 helper 未定义；实现后同命令通过（3 tests）。后续验证通过：`cargo check --manifest-path src-tauri/Cargo.toml`；`npm test -- src/stores/useChatStore.test.ts src/utils/desktopNotification.test.ts`（2 files / 32 tests）；`npm test`（23 files / 193 tests）；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`cargo fmt --manifest-path src-tauri/Cargo.toml`；`git diff --check` 无 whitespace error，仅 LF/CRLF 提示。未做真实 Windows 右下角通知点测。
- 下一步候选：1) 真实 Tauri 桌面点测系统通知：完成、失败、abort 是否各弹一次，native 失败时 WebView fallback 是否可接受；2) 继续真实点测会话侧栏项目切换、diff 恢复按钮、Open File、历史图片 lightbox、Codex 长历史锚点；3) 下一轮继续排查聊天交互 bug，优先看历史加载/切会话与 active request 的真实桌面竞态，以及附件恢复在真实 `chat_send` 失败时的表现。

## 迭代记录 2026-06-19 pending send invalidation guard

- 上轮实际进展：系统通知后端 payload guard 已落地，Rust/前端全量验证通过；阻塞仍是真实 Tauri 桌面点测未完成。本轮按记录继续排查聊天交互竞态，并复查 `useChatStore.ts` 与现有 store 测试。
- 本轮诊断（补齐 cc-gui）：`useChatStore` 已按 requestId 过滤 stream/message/done，但仍存在 requestId 生成前的空窗：`send()` 先创建 streaming assistant，再等待 `chat_send` 返回 requestId；如果用户在这段时间点击清空/新建/加载历史，原先 `abortActiveRequestIfNeeded()` 只看 `activeRequestId`，不会 abort 这个 pending turn。旧 `chat_send` 返回后会把旧 requestId 写回当前 store，并可能绑定到下一轮 pending assistant。
- 本轮诊断（超越 cc-gui）：用户主动清空或切会话意味着旧 turn 不应恢复输入、不应污染新 turn，也不应因为旧 requestId 迟到锁住 provider/model 选择。需要一个 UI turn token 覆盖“requestId 未知但已有 streaming assistant”的阶段，而不是只依赖后端 requestId。
- 本轮规划：只修 store 层 pending send invalidation。优先级高（清空/切会话/重新发送是高频恢复路径，污染当前会话属于严重交互正确性问题）、成本低（单个 Zustand store + 单测 + spec）、风险低（不改 Tauri 命令协议和组件结构）。
- 本轮完成：`src/stores/useChatStore.ts` 新增 `latestChatTurnToken`，`send()` 创建 turn 时递增 token；`clear()` / `startNewSession()` / `loadSession()` 通过 `abortActiveRequestIfNeeded()` 在存在 streaming assistant 但尚无 requestId 时也调用 `chat_abort` 并废弃 pending turn；`abort()` 同样废弃 pending turn；旧 `chat_send` 成功或失败在 token 失效后不再改写 active state / error / notification，成功返回的旧 requestId 会 retire，避免迟到 stream/message/done 绑定到下一轮 pending turn。`src/stores/useChatStore.test.ts` 新增回归测试覆盖清空后第一轮 requestId 迟到、第二轮仍 pending 时旧 stream 被忽略且新 stream 正常接管；`.trellis/spec/frontend/state-management.md` 更新 Chat Send Outcome 与 Request Ownership 契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败于 `clear()` 没有调用 `chat_abort`；实现后同命令通过（25 tests）。后续验证通过：`npm test -- src/stores/useChatStore.test.ts src/components/chat/composer/ChatComposer.test.ts src/utils/desktopNotification.test.ts`（3 files / 35 tests）；`npm test`（23 files / 194 tests）；`npm run build`；`git diff --check` 无 whitespace error，仅 LF/CRLF 提示。本轮仅改前端 store/test/spec/TODO，未运行 Rust check；未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 pending send：发送后立刻清空/切会话/再发，确认旧输出不回流、新 turn 正常；2) 继续点测系统通知、diff 恢复按钮、Open File、历史图片 lightbox、Codex 长历史锚点；3) 下一轮继续排查聊天交互 bug，重点看 `loadSession()` 缓存命中、pendingSessionKey 和用户快速连点历史会话是否还有可感知错位。

## 迭代记录 2026-06-19 pending history load invalidation

- 上轮实际进展：pending send invalidation guard 已在 `useChatStore` 中落地并通过定向、全量前端测试与构建；本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 代码和 `.codegraph/` 均可读。阻塞仍是真实 Tauri 桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：cc-gui 的会话加载请求携带 `sessionId + projectPath`，用户切历史会话时有明确的请求归属。当前项目 `loadSession()` 已用 `latestSessionLoadToken` 防止旧历史加载覆盖新历史选择，但 `send()` 没有废弃正在等待的历史加载；用户点击历史会话后若马上发送新消息，迟到的 `get_unified_session_messages` 结果仍可能把刚发送的 transcript 覆盖成旧历史。
- 本轮诊断（超越 cc-gui）：用户主动发送新 prompt 是比 pending history load 更强的意图，输入区应立即重新获得 transcript ownership。此时需要清掉 `pendingSessionKey`，否则侧边栏仍显示旧会话 loading，且迟到历史回写会造成“我刚发的消息消失”的高损伤体验。
- 本轮规划：只修 `useChatStore.send()` 与 store 回归测试。优先级高：用户价值高（避免消息丢失/错会话覆盖）、出现频率中高（历史加载慢时常见）、实现成本低（已有 session load token 机制，只需让 send 参与失效）、风险低（不改 Tauri 命令协议和组件结构）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增回归测试 `ignores a pending history load after the user sends a new message`；`src/stores/useChatStore.ts` 在真实发送开始时递增 `latestSessionLoadToken`，并在 optimistic user/assistant 状态更新中清空 `pendingSessionKey`，确保迟到历史加载被 token 拦截且不会覆盖新发送；`.trellis/spec/frontend/state-management.md` 更新 Chat Send Outcome 与 Request Ownership 契约，明确发送新 prompt 必须废弃 pending history load。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败于 `pendingSessionKey` 仍为旧历史会话 key；实现后同命令通过（26 tests）。后续验证通过：`npm test -- src/stores/useChatStore.test.ts src/components/chat/chatSessionSidebarUtils.test.ts src/components/chat/composer/ChatComposer.test.ts`（3 files / 44 tests）；`npm test`（23 files / 195 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`git diff --check` 无 whitespace error，仅 LF/CRLF 提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测：点击历史会话后立刻发送，确认 pending 状态消失、旧历史不覆盖新消息；2) 继续真实点测 pending send 清空/切会话/再发、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点；3) 继续排查聊天交互 bug，下一轮优先看 `answerToolPermission()` 是否需要与 AskUserQuestion 一样做并发幂等/失败恢复，避免权限按钮双击或失败重试造成状态错位。

## 迭代记录 2026-06-19 tool permission response idempotence

- 上轮实际进展：pending history load invalidation 已在 `useChatStore.send()` 中落地并通过定向、全量前端测试、构建、`cargo check` 与 `git diff --check`；本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 代码和 `.codegraph/` 均可读。阻塞仍是真实 Tauri 桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/PermissionDialog.tsx`，普通工具权限弹窗使用 `markSubmitted()` 阻止重复提交；当前项目 `ToolPermissionDialog` 有遮罩拒绝、右上关闭、底部拒绝和允许按钮等多个入口，但 `answerToolPermission()` 原先在 `permission_respond_tool` 成功后才清 `pendingToolPermission`，双击/快速点击会重复 invoke 并可能写两次权限响应。
- 本轮诊断（超越 cc-gui）：普通工具权限和 AskUserQuestion 一样都是后端等待响应文件的阻塞点。store 层应作为最终幂等边界：先按 requestId 校验当前 pending，再乐观清空；失败时恢复同一个 pending 请求，且不能覆盖后续新请求。这能避免双击制造日志噪声，也能在写响应失败时保留用户可重试入口。
- 本轮规划：只修 `answerToolPermission()` 和 store 回归测试。优先级高：用户价值高（权限弹窗阻塞工具执行，重复/失败会卡住聊天）、出现频率高（Bash/Edit/Write/MCP 都可能触发）、实现成本低（复用 AskUserQuestion 同模式）、风险低（不改 Tauri 命令协议和 UI 结构）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增 3 条回归测试，覆盖顺序重复工具权限响应、并发重复响应、invoke 失败恢复原 pending；`src/stores/useChatStore.ts` 将 `answerToolPermission()` 改为先校验 `pendingToolPermission.requestId`、立即清 pending、失败时只在没有新请求时恢复原 pending；`.trellis/spec/frontend/state-management.md` 更新 Permission Event 和 Chat Request Ownership 契约，明确 ToolPermission 与 AskUserQuestion 一样必须 store 层幂等。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败于顺序重复和并发重复都调用了两次 `permission_respond_tool`；实现后同命令通过（29 tests）。后续验证通过：`npm test -- src/stores/useChatStore.test.ts src/utils/desktopNotification.test.ts`（2 files / 37 tests）；`npm test`（23 files / 198 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测普通工具权限：双击允许/拒绝、点击遮罩后快速点按钮，确认只响应一次，失败时可重试；2) 继续排查 `approvePlan()` 是否也需要同样幂等/失败恢复，避免 plan approval 多入口重复响应；3) 继续真实点测 pending send、历史加载后立刻发送、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 迭代记录 2026-06-19 plan approval response idempotence

- 上轮实际进展：普通工具权限 `answerToolPermission()` 已经按 requestId 做 store 层幂等，顺序重复、并发重复和失败恢复均有回归测试；pending send / pending history load / AskUserQuestion 等交互竞态也已在记录和代码中落地。阻塞仍是真实 Tauri 桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/PlanApprovalDialog.tsx`，cc-gui 的计划审批弹窗通过 `markSubmitted()` 在组件层阻止重复提交；当前项目 `src/components/chat/PlanApprovalDialog.tsx` 有遮罩取消、右上关闭、Deny、Approve、Approve & Auto 多个入口，但 `src/stores/useChatStore.ts` 的 `approvePlan()` 原先成功后才清 `pendingPlanApproval`，重复点击或并发点击会两次调用 `permission_respond_plan_approval`。
- 本轮诊断（超越 cc-gui）：计划审批和工具权限一样都是 daemon 等待响应文件的阻塞点。仅靠组件层禁用按钮不够，store 层必须成为最终边界：先校验 pending requestId，再乐观清空，失败时恢复同一个 pending 且不覆盖新请求。这样 overlay、关闭、按钮和未来快捷键都能复用同一幂等语义。
- 本轮规划：只修 `approvePlan()` 和 store 回归测试。优先级高：用户价值高（计划审批阻塞后续执行，重复响应会写两次响应文件）、出现频率中高（计划模式/审批流常见）、实现成本低（复用 ToolPermission 模式）、风险低（不改 Tauri 命令协议和 UI 结构）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增 3 条回归测试，覆盖顺序重复计划审批响应、并发重复响应、invoke 失败恢复原 pending；`src/stores/useChatStore.ts` 将 `approvePlan()` 改为先校验 `pendingPlanApproval.requestId`、立即清 pending、失败时只在没有新请求时恢复原 pending；`.trellis/spec/frontend/state-management.md` 更新 Permission Event 和 Chat Request Ownership 契约，明确 PlanApproval 与 AskUserQuestion / ToolPermission 一样必须 store 层幂等。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败于顺序重复和并发重复都调用了两次 `permission_respond_plan_approval`；实现后同命令通过（32 tests）。后续验证通过：`npm test -- src/stores/useChatStore.test.ts src/utils/desktopNotification.test.ts`（2 files / 40 tests）；`npm test`（23 files / 201 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅既有 LF/CRLF 提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测普通工具权限和计划审批：双击允许/拒绝/Approve & Auto、遮罩后快速点按钮，确认只响应一次，失败时可重试；2) 真实点测 pending send 清空/切会话/再发、历史加载后立刻发送，确认旧输出和旧历史不回流；3) 继续排查聊天交互 bug，优先看 PlanApprovalDialog 是否需要组件层提交中状态/键盘快捷键、弹窗超时/关闭路径和真实 Windows 通知；4) 继续点测 diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 迭代记录 2026-06-19 plan approval keyboard shortcuts

- 上轮实际进展：`approvePlan()` 已具备 store 层 requestId 幂等、提交前清 pending 和失败恢复；普通工具权限、AskUserQuestion、pending send、pending history load 等关键聊天竞态也已有回归测试。阻塞仍是真实 Tauri 桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/PlanApprovalDialog.tsx`，cc-gui 计划审批弹窗支持 `Enter` 批准、`Escape` 拒绝；当前项目 `src/components/chat/PlanApprovalDialog.tsx` 只能鼠标点遮罩/关闭/Deny/Approve/Approve & Auto，键盘审批流缺失。高频审批时用户需要离开键盘去点按钮，效率低，也容易在长计划弹窗中误操作。
- 本轮诊断（超越 cc-gui）：快捷键不应只做全局抢占。当前弹窗内有折叠按钮和多个操作按钮，`Enter` 如果焦点在按钮或可编辑控件上，应保留原生行为，避免用户想展开/按钮确认时被全局批准计划。`Escape` 可在按钮焦点下快速拒绝，但不抢输入/可编辑控件。
- 本轮规划：只改 `PlanApprovalDialog` 交互层和纯 helper 测试。优先级中高：用户价值高（审批流高频且键盘用户明显受益）、出现频率中（计划模式触发）、实现成本低（一个组件 + 一个测试文件）、风险低（store 幂等已经兜底，不改命令协议）。
- 本轮完成：`src/components/chat/PlanApprovalDialog.tsx` 新增 `resolvePlanApprovalShortcutAction()` 纯 helper，并通过 `useEffect` 监听 `window.keydown`；`Enter` 在非控件焦点下触发默认批准，`Escape` 在非编辑目标下触发拒绝；`src/components/chat/PlanApprovalDialog.test.ts` 新增 3 条测试覆盖快捷键映射、Enter 不抢按钮/textarea/contenteditable、Escape 在按钮焦点可用但不抢 input；`.trellis/spec/frontend/component-guidelines.md` 记录计划审批快捷键契约。新增测试文件已执行 `git add -- src/components/chat/PlanApprovalDialog.test.ts`。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/PlanApprovalDialog.test.ts` 失败于 `resolvePlanApprovalShortcutAction is not a function`；实现后同命令通过（3 tests）。后续验证通过：`npm test -- src/components/chat/PlanApprovalDialog.test.ts src/stores/useChatStore.test.ts`（2 files / 35 tests）；`npm test`（24 files / 204 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测计划审批：Enter/Escape、按钮焦点 Enter、Approve & Auto、遮罩/关闭重复操作是否符合预期；2) 给普通工具权限弹窗补同类键盘路径（Enter 允许、Escape 拒绝）并确保不抢控件行为；3) 继续真实点测 pending send 清空/切会话/再发、历史加载后立刻发送、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 迭代记录 2026-06-19 tool permission keyboard shortcuts

- 上轮实际进展：计划审批弹窗已支持 `Enter` 默认批准、`Escape` 拒绝，并且快捷键决策有纯 helper 回归测试；store 层 `answerToolPermission()` 和 `approvePlan()` 均已具备 requestId 幂等和失败恢复。阻塞仍是真实 Tauri 桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/PermissionDialog.tsx`，cc-gui 普通工具权限弹窗支持键盘快速选择；当前项目 `src/components/chat/ToolPermissionDialog.tsx` 只能鼠标点击遮罩、关闭、拒绝或允许一次。普通工具权限覆盖 Bash/Edit/Write/MCP 等高频工具，缺少键盘路径会让用户在连续审批中频繁离开键盘。
- 本轮诊断（超越 cc-gui）：本项目当前只有“允许一次/拒绝”两个动作，没有 cc-gui 的 approve-always 模式。本轮只补 `Enter` 允许一次、`Escape` 拒绝，避免引入本项目没有的权限模式；同时不抢按钮/输入/可编辑控件的 `Enter`，减少误允许风险。最终重复响应边界仍由 store 的 `answerToolPermission()` 负责。
- 本轮规划：只改 `ToolPermissionDialog` 交互层和纯 helper 测试。优先级中高：用户价值高（工具权限是高频阻塞点）、出现频率高（大量工具调用会触发）、实现成本低（一个组件 + 一个测试文件）、风险低（不改后端命令协议和权限模型）。
- 本轮完成：`src/components/chat/ToolPermissionDialog.tsx` 新增 `resolveToolPermissionShortcutAction()` 纯 helper，并通过 `useEffect` 监听 `window.keydown`；`Enter` 在非控件焦点下触发允许一次，`Escape` 在非编辑目标下触发拒绝；`src/components/chat/ToolPermissionDialog.test.ts` 新增 3 条测试覆盖快捷键映射、Enter 不抢按钮/textarea/contenteditable、Escape 在按钮焦点可用但不抢 input；`.trellis/spec/frontend/component-guidelines.md` 记录普通工具权限快捷键契约。新增测试文件已执行 `git add -- src/components/chat/ToolPermissionDialog.test.ts`。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/ToolPermissionDialog.test.ts` 失败于 `resolveToolPermissionShortcutAction is not a function`；实现后同命令通过（3 tests）。后续验证通过：`npm test -- src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/stores/useChatStore.test.ts`（3 files / 38 tests）；`npm test`（25 files / 207 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测普通工具权限：Enter/Escape、按钮焦点 Enter、遮罩/关闭重复操作是否符合预期；2) 继续真实点测计划审批快捷键、pending send 清空/切会话/再发、历史加载后立刻发送；3) 继续排查聊天交互 bug，优先看 AskUserQuestionDialog 是否也需要明确键盘路径和提交中视觉状态；4) 继续点测系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 ask-user-question dialog interaction guard

- 目标：排查并修复 `AskUserQuestionDialog` 相比 cc-gui 和本项目 plan/tool permission 弹窗仍缺失的聊天交互边界。
- 功能点 1：确认根因与对标行为。验证方式：读取本项目 `AskUserQuestionDialog` / `useChatStore` 与 cc-gui `AskUserQuestionDialog`，明确是否应支持全局 `Enter`。
- 功能点 2：补回归测试。验证方式：新增 `src/components/chat/AskUserQuestionDialog.test.ts`，先运行定向测试确认 RED。
- 功能点 3：实现最小交互修复。验证方式：定向测试通过，并复跑 plan/tool permission 相关测试，确认共享快捷键判断不回归。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：按 `package.json` 确认脚本后运行定向测试、`npm test`、`npm run build`、Rust check/test（因工作区含 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 ask-user-question dialog interaction guard

- 上轮实际进展：普通工具权限弹窗已支持 `Enter` 允许一次、`Escape` 拒绝，并通过相邻测试、全量前端测试、构建和 Rust 验证；PlanApproval / ToolPermission 的 store 层响应也已有 requestId 幂等。阻塞仍是真实 Tauri 桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/AskUserQuestionDialog.tsx`，cc-gui 的 AskUserQuestion 支持 `Escape` 取消，并通过 `markSubmitted()` 防重复提交；当前项目 `src/components/chat/AskUserQuestionDialog.tsx` 只有鼠标 Cancel/Submit，缺少键盘取消和组件层提交中视觉状态。
- 本轮诊断（超越 cc-gui）：本项目同时已有 PlanApproval / ToolPermission 两套相似快捷键 target 判断，再给 AskUserQuestion 复制第三份会造成规则漂移。本轮抽出 `src/utils/dialogShortcuts.ts`，让三个阻塞弹窗共享 editable target、Enter-owned control 和一次性提交 guard；AskUserQuestion 不做全局 `Enter` 提交，避免抢占 radio/checkbox 与未来自定义输入的原生键盘语义。
- 本轮规划：优先修 AskUserQuestion 的 `Escape` 取消、提交中禁用和重复入口 guard。优先级中高：用户价值高（阻塞式提问弹窗会中断聊天流，重复提交/取消容易写两次响应）、出现频率中（AskUserQuestion 比工具权限少但一旦出现就是强阻塞）、实现成本低（一个组件 + 共享 helper + 纯测试）、风险低（不改 Tauri 命令协议和 store 响应语义）。
- 本轮完成：`src/components/chat/AskUserQuestionDialog.tsx` 新增 `resolveAskUserQuestionShortcutAction()`、`Escape` 快捷取消、`submitted` 视觉状态、禁用答案控件和 `markDialogSubmitted()` 一次性响应 guard；`src/utils/dialogShortcuts.ts` 新增共享 shortcut target 与提交 guard；`src/components/chat/PlanApprovalDialog.tsx` / `src/components/chat/ToolPermissionDialog.tsx` 改为复用共享 target helper；`src/components/chat/AskUserQuestionDialog.test.ts` 和 `src/utils/dialogShortcuts.test.ts` 覆盖新契约；`.trellis/spec/frontend/component-guidelines.md` 记录 AskUserQuestion 与共享 helper 规则。新增文件已执行 `git add`。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/AskUserQuestionDialog.test.ts src/utils/dialogShortcuts.test.ts` 失败于缺少 `resolveAskUserQuestionShortcutAction` 和 `dialogShortcuts`；实现后同命令通过（2 files / 5 tests）。后续验证通过：`npm test -- src/components/chat/AskUserQuestionDialog.test.ts src/utils/dialogShortcuts.test.ts src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/stores/useChatStore.test.ts`（5 files / 43 tests）；`npm test`（27 files / 212 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅工作区既有 LF/CRLF 提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 AskUserQuestion：`Escape`、Submit 后禁用/加载状态、失败恢复后能否重试；2) 真实点测普通工具权限和计划审批快捷键：按钮焦点 Enter、遮罩/关闭重复操作；3) 继续排查聊天交互 bug，优先看历史加载/切会话与 active request 的真实桌面竞态，以及附件恢复在真实 `chat_send` 失败时的表现；4) 继续点测系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 active permission dialog gate

- 目标：修复 `ChatPage` 同时挂载 AskUserQuestion / PlanApproval / ToolPermission 时，多个 portal 和全局快捷键监听器可能同时响应一次键盘操作的问题。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目 `ChatPage` / 三个 dialog / store 事件监听，并对照 cc-gui `AppDialogs`。
- 功能点 2：补回归测试。验证方式：在 `src/utils/chatUiBehavior.test.ts` 新增 active permission dialog 推导测试，先运行定向测试确认 RED。
- 功能点 3：实现页面层唯一 active dialog。验证方式：`ChatPage` 只根据 helper 渲染一个阻塞权限弹窗，定向测试和相邻弹窗测试通过。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向测试、`npm test`、`npm run build`、Rust check/test（因工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 active permission dialog gate

- 上轮实际进展：AskUserQuestion 已支持 `Escape` 快捷取消、提交中禁用和共享 shortcut helper；`npm test`、`npm run build`、`cargo check`、`cargo test`、`git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面点测未完成。
- 本轮诊断（补齐 cc-gui）：本项目 `src/pages/ChatPage.tsx` 会同时条件渲染 `AskUserQuestionDialog`、`PlanApprovalDialog`、`ToolPermissionDialog` 三个 portal；三者都拥有 `window.keydown` 监听。若 daemon 事件短时间叠加，用户一次 `Escape` / `Enter` 可能被多个监听器处理，造成多个阻塞请求同时响应。cc-gui 通过统一 `AppDialogs` 管理顶层弹窗状态，本项目需要页面层唯一 active dialog gate。
- 本轮诊断（超越 cc-gui）：三个 pending request 都有 timestamp，页面层可以按“最新 pending 请求优先”挂载唯一弹窗；时间戳缺失/相同则按当前视觉层级 `tool-permission > plan-approval > ask-user-question` 兜底。未激活的 pending request 保留在 store，当前弹窗响应后再显示下一个，避免同时丢失请求或同时响应。
- 本轮规划：只改 `ChatPage` 和 `chatUiBehavior` 纯 helper。优先级高：用户价值高（避免一次键盘操作误响应多个 daemon-blocking 请求）、出现频率低到中（正常情况下较少叠加，但一旦出现后果严重）、实现成本低（纯前端 helper + 页面渲染 gate + 单测）、风险低（不改 store/后端响应协议）。
- 本轮完成：`src/utils/chatUiBehavior.ts` 新增 `getActivePermissionDialog()` 和 `ActivePermissionDialog` 类型；`src/pages/ChatPage.tsx` 基于 helper 只挂载一个 active permission dialog；`src/utils/chatUiBehavior.test.ts` 新增多 pending 时选择唯一 active dialog 的回归测试；`.trellis/spec/frontend/component-guidelines.md` 记录页面层唯一权限弹窗契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/utils/chatUiBehavior.test.ts` 失败于 `getActivePermissionDialog is not a function`；实现后同命令通过（1 file / 11 tests）。后续验证通过：`npm test -- src/components/chat/AskUserQuestionDialog.test.ts src/utils/dialogShortcuts.test.ts src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/utils/chatUiBehavior.test.ts`（5 files / 22 tests）；`npm test`（27 files / 213 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅工作区既有 LF/CRLF 提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测三类权限弹窗叠加场景：构造/模拟多个 pending 时只显示最新一个，响应后显示下一个；2) 继续真实点测 AskUserQuestion 的失败恢复、普通工具权限和计划审批快捷键；3) 继续排查聊天交互 bug，优先看历史加载/切会话与 active request 的真实桌面竞态，以及真实 `chat_send` 失败时附件恢复；4) 继续点测系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 active permission dialog timestamp presence guard

- 目标：修复唯一 active 权限弹窗选择逻辑中“pending 请求存在但 timestamp 为空字符串时被隐藏”的边界缺陷。
- 功能点 1：确认根因与对标行为。验证方式：读取 `ChatPage` / `chatUiBehavior` 当前实现，并对照 cc-gui 顶层 dialog 入口，确认候选存在性不应依赖 timestamp 真值。
- 功能点 2：补回归测试。验证方式：在 `src/utils/chatUiBehavior.test.ts` 增加空 timestamp 仍显示 pending dialog 的用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：`getActivePermissionDialog()` 改为显式 `hasXxx` 判断候选存在，timestamp 只用于排序，`ChatPage` 传入 pending 对象存在性。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向测试、相邻弹窗测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 active permission dialog timestamp presence guard

- 上轮实际进展：`ChatPage` 已经只挂载一个 active permission dialog，PlanApproval / ToolPermission / AskUserQuestion 的快捷键与 store 幂等边界均已落地；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 通过统一 `AppDialogs` 管理顶层权限类弹窗；本项目上一轮已经补了唯一 active dialog gate，但 `getActivePermissionDialog()` 用 timestamp 真值判断候选是否存在。如果 daemon/migration/malformed payload 带来了空 timestamp，真实 pending 请求会被页面层隐藏，用户看不到必须响应的阻塞弹窗。
- 本轮诊断（超越 cc-gui）：权限弹窗的“是否存在”和“谁最新”是两个不同契约。存在性应来自 pending request 对象，timestamp 只用于排序；空/缺失/非法 timestamp 只应降低排序优先级，再用 `tool-permission > plan-approval > ask-user-question` 兜底，避免后台请求被静默卡住。
- 本轮规划：只修 active permission helper 与 `ChatPage` 调用点。优先级中高：用户价值高（避免阻塞权限请求不可见）、出现频率低到中（异常 payload/兼容迁移场景，但后果严重）、实现成本低（纯前端 helper + 单测 + spec）、风险低（不改 store/后端协议）。
- 本轮完成：`src/utils/chatUiBehavior.ts` 为 `getActivePermissionDialog()` 增加 `hasAskUserQuestion` / `hasPlanApproval` / `hasToolPermission` 显式存在性输入，并保留旧 timestamp-only 调用的兼容行为；`src/pages/ChatPage.tsx` 改为按 pending 对象存在性传参；`src/utils/chatUiBehavior.test.ts` 增加空 timestamp 仍显示 pending dialog 的回归测试；`.trellis/spec/frontend/component-guidelines.md` 记录候选存在性不能依赖 timestamp 真值。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/utils/chatUiBehavior.test.ts` 失败于期望 `ask-user-question` 但收到 `null`；实现后同命令通过（12 tests）。后续验证通过：`npm test -- src/components/chat/AskUserQuestionDialog.test.ts src/utils/dialogShortcuts.test.ts src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/utils/chatUiBehavior.test.ts`（5 files / 23 tests）；`npm test`（27 files / 214 tests）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅工作区既有 LF/CRLF 提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测三类权限弹窗叠加与空/非法 timestamp 模拟，确认只显示一个且响应后继续显示队列下一项；2) 继续排查历史加载/切会话与 active request 的真实竞态，重点看 `loadSession()` 后立刻发送和 pending request 回流；3) 真实点测 AskUserQuestion 失败恢复、ToolPermission/PlanApproval 快捷键、真实 `chat_send` 失败附件恢复；4) 继续点测系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 session sidebar cached switch ownership guard

- 目标：修复 `ChatSessionSidebar` 在“项目 A 请求未返回 -> 切到有缓存的项目 B -> A 迟到返回”时，旧项目响应仍可能覆盖当前项目会话列表归属的问题。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目 `ChatSessionSidebar` / `chatSessionSidebarUtils`，并对照 cc-gui 历史会话入口确认 projectPath 是会话历史边界。
- 功能点 2：补回归测试。验证方式：在 `src/components/chat/chatSessionSidebarUtils.test.ts` 增加会话列表响应归属判断用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：`loadSessions()` 缓存命中也必须使旧 in-flight 请求失效；异步响应同时校验 request seq 和当前选中项目 key。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向测试、相邻聊天状态测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 session sidebar cached switch ownership guard

- 上轮实际进展：权限类弹窗唯一 active gate 与空 timestamp 存在性守卫已在代码中落地，PlanApproval / ToolPermission / AskUserQuestion 的快捷键与 store 幂等边界均已验证；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的历史会话入口以 projectPath 作为会话历史边界；本项目 `ChatSessionSidebar` 也已有项目缓存和 `sessionsProjectPath`，但 `loadSessions()` 在缓存命中时直接返回，没有递增 `sessionRequestSeqRef`。如果项目 A 的扫描仍在 flight，用户切到已有缓存的项目 B，A 的迟到响应仍满足旧序号并覆盖 `sessionsProjectPath`，导致 B 的列表被 `getVisibleProjectSessions()` 隐藏成空。
- 本轮诊断（超越 cc-gui）：会话列表不只要隐藏旧项目 rows，还要把“当前响应是否仍属于最新选中项目”做成可测试契约。异步响应必须同时满足 request seq 最新和 normalized selected project key 匹配；缓存命中也代表新的列表归属决策，必须退休旧请求。
- 本轮规划：只修会话侧栏项目切换竞态。优先级高：用户价值高（会话入口一旦显示空列表或旧列表会直接阻断历史恢复）、出现频率中高（项目切换和缓存命中是高频操作）、实现成本低（纯前端 helper + 组件 ref + 单测）、风险低（不改 Tauri 命令协议和后端扫描逻辑）。
- 本轮完成：`src/components/chat/chatSessionSidebarUtils.ts` 新增 `shouldAcceptSessionListResponse()`，统一判断 session list 响应归属；`src/components/chat/ChatSessionSidebar.tsx` 新增 `selectedProjectKeyRef`，缓存命中时递增 `sessionRequestSeqRef`、清空逻辑 in-flight 状态并关闭加载态，异步成功/失败分支同时校验 request seq 和当前选中项目 key；`src/components/chat/chatSessionSidebarUtils.test.ts` 新增响应归属回归测试；`.trellis/spec/frontend/component-guidelines.md` 记录会话侧栏缓存命中与 async response ownership 规则。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts` 失败于 `shouldAcceptSessionListResponse is not a function`；实现后同命令通过（17 tests）。后续验证通过：`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts`（3 files / 61 tests）；`npm test`（27 files / 215 tests）；`cargo check --manifest-path src-tauri/Cargo.toml`；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测会话侧栏：项目 A 扫描中切到已有缓存项目 B，确认 B 的列表不被迟到 A 响应清空；2) 继续排查聊天交互 bug，优先看 `loadSession()` 后立刻发送、pending request 回流和真实 `chat_send` 失败附件恢复；3) 真实点测三类权限弹窗队列、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 active session reselection while history pending

- 目标：修复历史会话 B 正在加载时，用户点击当前 active 会话 A 想留在 A，却被 `ChatPage` 粗粒度 active-session 判断吞掉点击，导致 pending B 继续完成并切走的问题。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取 `ChatPage.handleSessionSelect`、`ChatSessionSidebar.shouldIgnoreSessionClick`、`useChatStore.loadSession`，确认页面层和侧栏层判断不一致。
- 功能点 2：补回归测试。验证方式：在 `src/utils/chatUiBehavior.test.ts` 新增 session selection helper 用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：抽出页面与侧栏共用的 session selection ignore helper，`ChatPage` 和 `chatSessionSidebarUtils` 统一调用。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向测试、相邻 sidebar/store/navigation 测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 active session reselection while history pending

- 上轮实际进展：会话侧栏缓存命中时的旧请求退休和 async response ownership guard 已落地，并通过定向、全量前端、构建、Rust check/test、`git diff --check` 验证；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的会话切换由统一状态入口处理，当前项目则有两层判断：`ChatSessionSidebar.shouldIgnoreSessionClick()` 在有另一个 pending session 时允许点击 active session，但 `ChatPage.handleSessionSelect()` 仍粗暴拦截所有 active session 点击。结果是用户在历史会话 B 加载中点击当前会话 A 试图留在 A，侧栏放行，页面层却吞掉点击，pending B 最终仍可能完成并切走。
- 本轮诊断（超越 cc-gui）：历史列表的“重复点击忽略”必须区分两种意图：没有 pending 时点击 active session 是无效重复操作；有另一个 pending session 时点击 active session 是明确的取消/覆盖 pending 选择意图。这个判断必须在页面层和侧栏层共用，不能各写一份。
- 本轮规划：只修 session selection ignore 规则。优先级中高：用户价值高（避免用户无法取消一次误点的历史加载）、出现频率中（历史加载慢或快速点击时出现）、实现成本低（纯 helper + 两个调用点 + 单测）、风险低（不改 Tauri 命令协议和 store load token）。
- 本轮完成：`src/utils/chatUiBehavior.ts` 新增 `shouldIgnoreChatSessionSelection()`；`src/pages/ChatPage.tsx` 的 `handleSessionSelect()` 改为复用该 helper；`src/components/chat/chatSessionSidebarUtils.ts` 的 `shouldIgnoreSessionClick()` 也复用同一 helper；`src/utils/chatUiBehavior.test.ts` 增加 active session 在另一个 pending session 存在时不应被忽略的回归测试；`.trellis/spec/frontend/component-guidelines.md` 记录该交互契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/utils/chatUiBehavior.test.ts` 失败于 `shouldIgnoreChatSessionSelection is not a function`；实现后 `npm test -- src/utils/chatUiBehavior.test.ts` 通过（13 tests），`npm test -- src/components/chat/chatSessionSidebarUtils.test.ts` 通过（17 tests）。后续验证通过：`npm test -- src/utils/chatUiBehavior.test.ts src/components/chat/chatSessionSidebarUtils.test.ts src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts`（4 files / 74 tests）；`npm test`（27 files / 216 tests）；`cargo check --manifest-path src-tauri/Cargo.toml`；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测历史会话快速切换：B 加载中点击 active A，确认 pending B 被覆盖且不会最终切走；2) 继续排查聊天交互 bug，优先看 abort 失败/daemon 离线时的切会话状态呈现，以及 pending permission dialog 失败恢复的实际 WebView 表现；3) 继续点测系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 session transition abort failure visibility

- 目标：修复会话新建/清空/加载历史时 `chat_abort` 失败被后续 `error: null` 覆盖，用户看不到 daemon 未正常中止的交互反馈问题。
- 功能点 1：确认根因与现有契约。验证方式：CodeGraph 读取 `useChatStore.abortActiveRequestIfNeeded()`、`startNewSession()`、`clear()`、`loadSession()` 与现有 store 测试。
- 功能点 2：补回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 增加 abort 失败后 transition 仍完成但错误保留的用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：让 session transition 的最终状态保留 abort 失败错误，同时不改变“尽量继续切换/清空”的恢复策略。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 store 测试、相关聊天交互测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 session transition abort failure visibility

- 上轮实际进展：active 会话重选规则已落地，页面层和侧栏层共享 `shouldIgnoreChatSessionSelection()`，解决“历史会话 B 加载中点击 active A 被页面层吞掉”的问题；全量前端、构建、Rust check/test、`git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的会话切换由统一状态边界处理；本项目已有 `abortActiveRequestIfNeeded()` 防止旧请求事件污染新 transcript，但它在 `chat_abort` 失败时只短暂 `set({ error })`，随后 `startNewSession()`、`clear()`、`loadSession()` 的最终状态又写回 `error: null`。结果是 daemon 未正常接受中止的事实被静默隐藏，用户无法判断旧请求是否真的被干净打断。
- 本轮诊断（超越 cc-gui）：为了从 stuck daemon 中恢复，会话新建/清空/加载历史可以继续执行；但交互反馈不能丢。最终 store 状态应同时表达“用户请求的 transition 已完成”和“上一轮 abort 失败，需要留意 daemon 状态”。这比直接阻塞切换更符合恢复场景，也比吞错更可诊断。
- 本轮规划：只修 store 的 session transition abort 错误保留。优先级中高：用户价值高（避免中止失败被隐藏，减少会话状态错判）、出现频率低到中（daemon 离线/卡死时出现，但后果严重）、实现成本低（helper 返回错误 + 三条状态落点）、风险低（不改后端协议，不改变成功路径）。
- 本轮完成：`src/stores/useChatStore.ts` 让 `abortActiveRequestIfNeeded()` 返回 `String(error) | null`，`loadSession()`、`startNewSession()`、`clear()` 在最终状态中保留 abort 错误；`src/stores/useChatStore.test.ts` 新增三条回归测试覆盖新建、清空、加载历史时 abort 失败仍完成 transition 且错误可见；`.trellis/spec/frontend/state-management.md` 记录该 session transition abort 边界契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败 3 项，均为期望 abort 错误但实际 `error: null`。实现后同命令通过（1 file / 35 tests）。后续验证通过：`npm test -- src/stores/useChatStore.test.ts src/utils/chatUiBehavior.test.ts src/components/chat/chatSessionSidebarUtils.test.ts src/utils/chatNavigation.test.ts`（4 files / 77 tests）；`npm test`（27 files / 219 tests）；`cargo check --manifest-path src-tauri/Cargo.toml`；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 abort 失败/daemon 离线场景：新建、清空、加载历史后错误是否可见且旧流不会写入新 transcript；2) 继续排查 pending permission dialog 失败恢复的实际 WebView 表现，尤其组件 submitted 状态与 store restore 的生命周期；3) 真实点测历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。
## 本轮 PLAN 2026-06-19 permission dialogs submitted guard

- 目标：修复 `PlanApprovalDialog` 与 `ToolPermissionDialog` 在首次响应后仍允许按钮/遮罩/键盘重复触发的交互缺陷，让组件层与 store 级 requestId 幂等边界形成双保险。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目三类权限弹窗与 store 响应动作，并对照 cc-gui `PermissionDialog` / `PlanApprovalDialog` 的 `markSubmitted()` 单入口 guard。
- 功能点 2：补回归测试。验证方式：在 `PlanApprovalDialog.test.ts` 与 `ToolPermissionDialog.test.ts` 增加 submitted helper 用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：Plan/Tool 弹窗复用 `markDialogSubmitted()`，首次响应后设置 `submitted`，禁用响应按钮和关闭入口，键盘/遮罩重复触发不再调用回调。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向弹窗测试、相邻 dialog/store 测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 permission dialogs submitted guard

- 上轮实际进展：session transition abort 失败可见性已在 store 层落地并通过全量前端、构建、Rust check/test 与 `git diff --check` 验证；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `PermissionDialog` 与 `PlanApprovalDialog` 都通过 `markSubmitted()` 把按钮、键盘和超时响应收敛成第一次提交单入口。本项目 AskUserQuestion 已有组件级 submitted guard，但 `PlanApprovalDialog` 与 `ToolPermissionDialog` 只依赖 store 级 requestId 幂等。store 能阻止重复写响应文件，但用户双击、按住 Enter 或连续点击遮罩时，UI 在 pending 被清除/恢复前仍表现为可重复提交。
- 本轮诊断（超越 cc-gui）：权限类弹窗应有两层边界：组件层负责即时交互反馈和禁用重复入口，store 层负责最终 requestId 幂等与失败恢复。这样即使 invoke 失败、store 恢复同一个 pending 请求，组件也会随重新挂载/新 requestId 重置 submitted 状态，用户可以明确重试。
- 本轮规划：只修 PlanApproval / ToolPermission 组件级 submitted guard。优先级中高：用户价值高（阻塞弹窗的重复提交会直接影响聊天继续执行）、出现频率中（键盘/双击高频）、实现成本低（复用已有 `markDialogSubmitted()` + 单测）、风险低（不改后端协议和 store 响应语义）。
- 本轮完成：`src/components/chat/PlanApprovalDialog.tsx` 新增 `submitPlanApprovalDecision()`、submitted ref/state、requestId 切换重置、`aria-busy`、按钮禁用和 spinner，Approve / Approve Auto / Deny / Cancel / 遮罩 / Enter / Escape 都先走单入口 guard；`src/components/chat/ToolPermissionDialog.tsx` 新增 `submitToolPermissionDecision()`、submitted ref/state、requestId 切换重置、`aria-busy`、按钮禁用和 allow spinner，Allow / Deny / 遮罩 / Enter / Escape 都先走单入口 guard；`src/components/chat/PlanApprovalDialog.test.ts` 与 `src/components/chat/ToolPermissionDialog.test.ts` 增加重复提交回归测试；`.trellis/spec/frontend/component-guidelines.md` 记录 Plan/Tool 弹窗组件级 submitted 契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/PlanApprovalDialog.test.ts src/components/chat/ToolPermissionDialog.test.ts` 失败于 `submitPlanApprovalDecision is not a function` / `submitToolPermissionDecision is not a function`。实现后同命令通过（2 files / 8 tests）。后续验证通过：`npm test -- src/components/chat/AskUserQuestionDialog.test.ts src/utils/dialogShortcuts.test.ts src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/stores/useChatStore.test.ts src/utils/chatUiBehavior.test.ts`（6 files / 61 tests）；`npm test`（27 files / 221 tests）；`cargo check --manifest-path src-tauri/Cargo.toml`；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测三类权限弹窗：双击、按住 Enter/Escape、遮罩点击、invoke 失败后恢复同一 pending 请求是否可重试；2) 继续排查 pending permission dialog 失败恢复的真实 WebView 生命周期，尤其 store 恢复同一个 requestId 时是否一定重新挂载；3) 真实点测 abort 失败/daemon 离线、新建/清空/加载历史、历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。
## 本轮 PLAN 2026-06-19 permission failure restored request identity

- 目标：修复权限/计划/提问弹窗在响应 invoke 失败后恢复同一 pending request 时，组件 submitted 状态可能不复位导致用户无法重试的边界问题。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取 `useChatStore` 三类响应失败恢复、`ChatPage` 弹窗挂载点和三个 dialog 的 submitted reset 依赖，对照 cc-gui `markSubmitted()` 请求 key 重置模式。
- 功能点 2：补回归测试。验证方式：在 `useChatStore.test.ts` 增加三类 pending 恢复后对象引用必须更新的测试，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：失败恢复 pending 时 clone 原 request，并让 AskUserQuestion / ToolPermission / PlanApproval 的 submitted reset effect 依赖 request 对象变化。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/state-management.md`、`.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 store/dialog 测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 permission failure restored request identity

- 上轮实际进展：PlanApproval / ToolPermission 弹窗已补组件级 submitted guard，阻止首次响应后按钮/遮罩/键盘重复触发；全量前端测试、构建、Rust check/test 和 `git diff --check` 均通过。阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 dialog submitted 状态会按请求 key 重置；本项目上轮虽有组件级 submitted guard，但 `useChatStore` 在三类权限响应失败时把原 pending 对象原样恢复，三个 dialog 又只按 `request.requestId` 重置 submitted。如果 React 批处理掉中间 `pending=null` 的卸载过程，失败恢复同一个 requestId 可能保留 `submitted=true`，用户看到恢复的弹窗但控件仍禁用，无法重试。
- 本轮诊断（超越 cc-gui）：失败恢复应同时表达“还是同一个业务请求”和“这是新一轮可交互提交周期”。store 保留 requestId/内容不变，但用新的顶层 request 对象引用作为 UI reset 信号；组件则监听 request 对象变化，而不是只监听 requestId。
- 本轮规划：只修失败恢复 request identity 与 dialog submitted reset。优先级中高：用户价值高（响应写入失败后必须可重试，否则聊天被阻塞）、出现频率低到中（失败少见但影响严重）、实现成本低（store clone + effect dependency + 单测）、风险低（不改后端协议和 payload 语义）。
- 本轮完成：`src/stores/useChatStore.ts` 新增 `clonePermissionRequest()`，`answerAskUserQuestion()` / `answerToolPermission()` / `approvePlan()` 在 invoke 失败恢复 pending 时返回等价的新对象引用；`src/components/chat/AskUserQuestionDialog.tsx`、`src/components/chat/ToolPermissionDialog.tsx`、`src/components/chat/PlanApprovalDialog.tsx` 的 submitted reset effect 改为依赖 `request` 对象变化；`src/stores/useChatStore.test.ts` 新增/调整三类失败恢复测试，要求恢复对象 `toEqual` 原 pending 但 `not.toBe` 原 pending；`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 记录该契约。
- 本轮验证：先新增/调整测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败 3 项，均为恢复对象仍与原 pending `Object.is` 相等。实现后同命令通过（1 file / 36 tests）。后续验证通过：`npm test -- src/components/chat/AskUserQuestionDialog.test.ts src/utils/dialogShortcuts.test.ts src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/stores/useChatStore.test.ts src/utils/chatUiBehavior.test.ts`（6 files / 62 tests）；`npm test`（27 files / 222 tests）；`cargo check --manifest-path src-tauri/Cargo.toml`；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`（97 tests，2 doctests ignored）；`git diff --check` 无 whitespace error，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测三类权限响应失败恢复：模拟/制造 invoke 失败后确认同一 requestId 的弹窗重新可点；2) 继续排查真实 WebView 生命周期下权限队列响应后下一个 pending 是否稳定浮现；3) 继续点测 abort 失败/daemon 离线、新建/清空/加载历史、历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 permission request queue

- 目标：修复同类权限请求在用户响应前连续到达时被单个 pending 槽位覆盖的问题，确保 watcher 已删除的旧 request 文件仍有前端可响应入口。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取 `PermissionWatcher.poll_once()`、`useChatStore.init()` 的 permission listener、三类响应 action，并对照 cc-gui 的阻塞 permission 入口。
- 功能点 2：补回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 模拟两个同类 permission event 连续到达，先运行定向测试确认 RED：响应第一个后第二个应浮现并最终响应。
- 功能点 3：实现最小修复。验证方式：在 store 内为 AskUserQuestion / ToolPermission / PlanApproval 分别维护队列，保持现有 `pendingXxx` 对外 API 表示队首请求；响应成功弹出队首，失败恢复队首且不丢后续请求。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 store 测试、dialog/chatUiBehavior 相邻测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 permission request queue

- 上轮实际进展：三类权限弹窗 submitted guard 与失败恢复 request identity 已落地并通过全量前端、构建、Rust check/test 与 `git diff --check`；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：`src-tauri/src/chat/permission_watcher.rs` 的 `poll_once()` 会在一次轮询里遍历多个 permission request 文件，emit 后立即删除 request 文件；但 `src/stores/useChatStore.ts` 原先每类只保留一个 `pendingXxx`。同类请求连续到达时，后一个会覆盖前一个，前一个 request 文件已经被删除且没有响应入口，daemon 只能等超时。
- 本轮诊断（超越 cc-gui）：同类权限请求不只要“只显示一个 active dialog”，还必须有 FIFO 队列和 in-flight requestId 去重。响应写入过程中，如果同一 requestId 的重复事件到达，应丢弃；如果其他同类请求到达，应排在后面，避免键盘/遮罩/后端 watcher 时序把请求顺序打乱。
- 本轮规划：只修 store 的三类 permission request queue。优先级高：用户价值高（权限请求丢失会直接卡住聊天）、出现频率中（并行工具或快速连续 permission 文件时出现）、实现成本中低（store 队列 + 单测）、风险低（不改后端文件 IPC 命名，不改 dialog props）。
- 本轮完成：`src/stores/useChatStore.ts` 新增三类 pending 队列与 in-flight requestId 字段，`permission://ask-user-question` / `permission://tool` / `permission://plan-approval` listener 改为 FIFO 入队；三类响应 action 成功后提升下一条 queued request，失败时恢复当前请求的新对象引用并保留队列。`src/stores/useChatStore.test.ts` 新增三类同类请求排队回归测试，并补充“响应写入中重复 tool permission event 不会重新入队”的边界测试。`.trellis/spec/frontend/state-management.md` 记录 permission queue 契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 3 项，证明同类请求被后到事件覆盖；随后新增 in-flight 重复事件测试再失败 1 项，证明正在响应的同 requestId 会被重新入队。GREEN：`npm test -- src/stores/useChatStore.test.ts` 通过（40 tests）；`npm test -- src/stores/useChatStore.test.ts src/components/chat/AskUserQuestionDialog.test.ts src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/utils/chatUiBehavior.test.ts` 通过（5 files / 63 tests）；`npm test` 通过（27 files / 226 tests）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run build` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（97 tests，2 doctests ignored）；`git diff --check` 退出 0，仅 LF/CRLF 提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测并行/连续 permission 文件：连续两个工具权限、两个 AskUserQuestion、两个 PlanApproval，确认队首响应后下一条稳定浮现；2) 修复/固化 permission response 的 sessionId 协议债，目前 manager 和响应命令都写死 `default`，未来一旦启用随机 `CLAUDE_SESSION_ID` 会造成 response 文件名不匹配；3) 继续点测 abort 失败/daemon 离线、新建/清空/加载历史、历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 permission response session id

- 目标：修复权限响应链路丢失 `sessionId` 的协议缺口，避免 daemon 使用非 `default` `CLAUDE_SESSION_ID` 时前端响应写到错误文件名，导致聊天卡在权限等待。
- 功能点 1：确认跨层根因。验证方式：CodeGraph 读取 `PermissionWatcher`、三类 `write_*_response`、`permission_respond_*` 命令和 `useChatStore` 三类响应 action，并对照 cc-gui 的 permission 请求/响应文件 IPC 行为。
- 功能点 2：补前端回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 覆盖 AskUserQuestion / ToolPermission / PlanApproval 响应 invoke 必须携带 `sessionId`，并覆盖旧事件缺失 `sessionId` 时回退 `default`，先运行定向测试确认 RED。
- 功能点 3：补后端回归测试。验证方式：在 Rust permission watcher / command 附近覆盖三类请求反序列化包含 `sessionId`，以及响应 writer 能写入自定义 session 文件名；先运行定向 Rust 测试确认 RED。
- 功能点 4：实现最小修复。验证方式：请求模型增加 `sessionId`，watcher 从文件名或自身 session 注入缺失字段；前端类型与 store 响应 action 传回 `sessionId ?? 'default'`；Rust Tauri 命令按传入 session 写响应文件。
- 功能点 5：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/backend/cross-layer-protocol.md`、`.trellis/spec/frontend/state-management.md` 与本文件最终记录。
- 功能点 6：质量验证。验证方式：运行定向前端/Rust 测试、相关权限 dialog/store 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、`git diff --check`。

## 迭代记录 2026-06-19 permission response session id

- 上轮实际进展：permission request queue 已在 store 层落地，三类权限请求可 FIFO 入队、响应成功后提升下一条，响应写入中的重复 requestId 会被丢弃；全量前端测试、构建、Rust check/test 与 `git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：本项目 permission request 文件名包含 session 维度：`request-<sessionId>-<requestId>.json`、`ask-user-question-<sessionId>-<requestId>.json`、`plan-approval-<sessionId>-<requestId>.json`；但 `src-tauri/src/commands/chat_commands.rs` 三类响应命令原先按硬编码 `default` 写 response 文件，`src/stores/useChatStore.ts` 的响应 action 也没有传回 `sessionId`。当前能工作只是因为 watcher/daemon 默认都使用 `default`，一旦 `CLAUDE_SESSION_ID` 变成非默认值，前端会写到错误文件名，daemon 会一直等待正确 session 的响应。
- 本轮诊断（超越 cc-gui）：sessionId 不应只在后端文件名里隐式存在，应该成为前端 pending request 与响应命令之间的显式协议字段。watcher 需要兼容旧 JSON：缺失或空白 `sessionId` 时用文件名/自身 session 补齐；前端响应时始终回传规范化后的 session；后端命令再按该 session 写 response 文件。这样既保留旧事件兼容，也为未来多 session / 随机 session id 打基础。
- 本轮规划：只修 permission response `sessionId` 透传链路。优先级高：用户价值高（权限等待卡死会直接阻断聊天）、出现频率中（当前默认 session 下不暴露，但一旦启用非默认 session 就是必现）、实现成本中低（类型字段 + store payload + Rust 命令参数/normalize helper + 测试）、风险可控（保持 `default` fallback，不改 UI 结构和 response payload 语义）。
- 本轮完成：`src/types/permission.ts` 为 `AskUserQuestionRequest`、`ToolPermissionRequest`、`PlanApprovalRequest` 增加可选 `sessionId`；`src/stores/useChatStore.ts` 新增 `DEFAULT_PERMISSION_SESSION_ID` 与 `permissionSessionId()`，三类响应 action 都把 pending request 的 `sessionId` 传给 Tauri invoke，旧事件回退 `default`；`src-tauri/src/chat/permission_watcher.rs` 为三类 request 增加 `session_id` 字段、默认值、normalize/fill helper，并在 emit 前把缺失 session 补齐；`src-tauri/src/chat/mod.rs` re-export `permission_response_session_id()`；`src-tauri/src/chat/manager.rs` 让 `PermissionWatcher` 使用 daemon 的 `SESSION_ID`；`src-tauri/src/commands/chat_commands.rs` 三类 `permission_respond_*` 命令接受可选 `session_id` 并按规范化 session 写响应文件；`src/stores/useChatStore.test.ts` 和 `permission_watcher.rs` 测试覆盖自定义 session、旧事件 fallback、三类 request 反序列化与 normalize；`.trellis/spec/backend/cross-layer-protocol.md` 与 `.trellis/spec/frontend/state-management.md` 同步记录 permission session 协议。
- 本轮验证：RED 阶段已确认：`npm test -- src/stores/useChatStore.test.ts` 失败于三类 invoke payload 缺少 `sessionId`；`cargo test --manifest-path src-tauri/Cargo.toml permission_watcher -- --nocapture` 失败于 request 结构未保留 `sessionId`。GREEN 与回归验证通过：`npm test -- src/stores/useChatStore.test.ts`（40 tests）；`cargo test --manifest-path src-tauri/Cargo.toml permission_watcher -- --nocapture`（7 tests）；`npm test -- src/stores/useChatStore.test.ts src/components/chat/AskUserQuestionDialog.test.ts src/components/chat/ToolPermissionDialog.test.ts src/components/chat/PlanApprovalDialog.test.ts src/utils/chatUiBehavior.test.ts`（5 files / 63 tests）；`npm test`（27 files / 226 tests）；`cargo check --manifest-path src-tauri/Cargo.toml`；`npm run build`；`cargo test --manifest-path src-tauri/Cargo.toml`（102 tests，2 doctests ignored）；`git diff --check` 退出 0，仅 LF/CRLF 转换提示。接手收尾后再次复跑 `npm test -- src/stores/useChatStore.test.ts`（40 tests）、`cargo test --manifest-path src-tauri/Cargo.toml permission_watcher -- --nocapture`（7 tests）和 `git diff --check`，均通过。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测非默认 `sessionId`：制造/观察 `request-custom-req.json`，确认前端事件携带 `sessionId`，响应文件写成 `response-custom-req.json`；2) 真实 Tauri 桌面点测连续权限队列：连续两个 ToolPermission、两个 AskUserQuestion、两个 PlanApproval，确认 FIFO 队首响应后下一条稳定浮现；3) 继续排查聊天交互 bug，优先看 daemon offline / abort failure 的真实 WebView 表现、pending permission 失败恢复生命周期、历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 composer pre-request send guard

- 目标：修复 `ChatComposer` 在 `chat_send` 返回 `requestId` 前的提交空窗，避免用户双击发送按钮或快速按 Enter 造成同一草稿被发送两次。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目 `ChatComposer` / `ButtonArea` / `useChatStore.send()` 与 cc-gui `ChatInputBox` / `useSubmitHandler`，确认当前项目没有消息队列，因此需要本地 in-flight guard。
- 功能点 2：补回归测试。验证方式：在 `ChatComposer.test.ts` 增加提交阻塞 helper 用例，在 `ButtonArea.test.tsx` 增加 pre-request submitting 状态渲染用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：`ChatComposer` 增加 ref + state 的本地 `isSending`，发送开始立即阻塞后续提交，`finally` 释放；`ButtonArea` 区分 `isSubmitting` 与 `isLoading`，pre-request 阶段显示禁用发送按钮而不是 Stop。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 composer/button 测试、相邻 store 测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 composer pre-request send guard

- 上轮实际进展：permission response `sessionId` 已显式贯穿三类权限 pending request、前端 invoke、Rust Tauri 命令与 response 文件名；前端/Rust 权限测试、全量前端测试、构建、Rust check/test 与 `git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `ChatInputBox` 发送链路由 `useSubmitHandler()` 清输入后交给父层，且有 message queue 语义兜底；当前项目 `src/components/chat/composer/ChatComposer.tsx` 没有消息队列，`isStreaming` 只来自 `activeRequestId !== null`。但 `useChatStore.send()` 要等 `chat_send` 返回 requestId 才设置 `activeRequestId`，这之前双击发送按钮或快速按两次 Enter 会穿过同一个 render 的旧 closure，重复调用 `send()`，同一草稿可能被追加并发送两次。
- 本轮诊断（超越 cc-gui）：pre-requestId 阶段和 streaming 阶段不是同一种状态。前者不能显示 Stop，因为 `chat_abort` 还没有可定位的 requestId；正确交互是立即禁用发送、增强和 selector，显示一个轻量 sending affordance，等 requestId 返回后再进入真正 streaming/Stop 状态。
- 本轮规划：只修 composer 的 pre-request send guard。优先级高：用户价值高（重复发送会产生重复消息、重复工具执行和重复费用/副作用）、出现频率中高（双击按钮、键盘连击很常见）、实现成本低（本地 ref/state + ButtonArea 状态区分 + 单测）、风险低（不改 store/后端协议，不引入消息队列）。
- 本轮完成：`src/components/chat/composer/ChatComposer.tsx` 新增 `shouldBlockChatComposerSubmit()` 纯 helper、`sendInFlightRef` 与 `isSending`，在发送开始前立即阻塞后续提交，并在 `finally` 中释放；发送失败恢复附件/草稿逻辑保留。`src/components/chat/composer/ButtonArea.tsx` 新增 `isSubmitting` prop，selector/enhance 在 pre-requestId 阶段禁用，发送按钮显示 disabled loader，只有 `isLoading` 才显示 Stop。`src/components/chat/composer/ChatComposer.test.ts` 增加提交阻塞 helper 测试；`src/components/chat/composer/ButtonArea.test.tsx` 增加 submitting 状态渲染测试；`.trellis/spec/frontend/component-guidelines.md` 记录 composer pre-request submit guard 契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/composer/ChatComposer.test.ts src/components/chat/composer/ButtonArea.test.tsx` 失败于 `shouldBlockChatComposerSubmit is not a function`，且 ButtonArea 在 `isSubmitting` 下仍渲染可点击发送按钮。实现后同命令通过（2 files / 7 tests）；相邻验证 `npm test -- src/components/chat/composer/ChatComposer.test.ts src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/useCompletions.test.ts src/stores/useChatStore.test.ts` 通过（4 files / 55 tests）；全量 `npm test` 通过（27 files / 230 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（102 tests，2 doctests ignored）；`git diff --check` 退出 0，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 composer：双击 Send、快速按 Enter、SDK 缺失、`chat_send` 失败附件恢复，确认只发一次且 UI 状态符合 pre-request/streaming 区分；2) 继续真实 Tauri 点测非默认 permission `sessionId` 和连续权限队列；3) 继续排查聊天交互 bug，优先看 prompt enhance 的并发/失败恢复、历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 prompt enhancer duplicate guard

- 目标：修复 `ChatComposer` Prompt Enhance 在 React `enhancing` 状态刷新前的重复点击空窗，避免同一提示词并发触发多次 `chat_enhance_prompt`。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目 `ChatComposer.handleEnhance` / `ButtonArea` / `PromptEnhancerDialog`，并对照 cc-gui `usePromptEnhancer`，确认本项目没有即时 in-flight guard。
- 功能点 2：补回归测试。验证方式：在 `ChatComposer.test.ts` 增加 prompt enhance 阻塞 helper 用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：`ChatComposer` 增加 prompt enhancer ref guard，handler 入口立即阻止重复 enhance；保持失败时关闭弹窗、保留原文的现有策略。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 composer/button 测试、相邻 store/completion 测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 prompt enhancer duplicate guard

- 上轮实际进展：composer pre-request send guard 已在 `ChatComposer` / `ButtonArea` 落地，发送开始到 `requestId` 返回前会禁用发送、增强和 selector，避免同一草稿重复发送；全量前端测试、构建、Rust check/test 与 `git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/ChatInputBox/hooks/usePromptEnhancer.ts`，cc-gui 的增强入口会打开对比弹窗并置 `isEnhancing`，但没有 ref 级即时防重。本项目 `src/components/chat/composer/ChatComposer.tsx` 的 `handleEnhance()` 也只检查 `enhancing` state，双击 Sparkles 或快速触发两次 handler 时，第二次可能在 React commit 前穿过旧 closure，向 `chat_enhance_prompt` 并发发送同一提示词。
- 本轮诊断（超越 cc-gui）：Prompt Enhance 是高成本、可能返回乱序结果的异步改写动作，应该像发送一样区分“已触发但 UI 尚未重渲染”的 pre-render 空窗。用 ref 作为立即边界、state 负责视觉反馈，可以避免重复请求、重复弹窗内容回写和用户误以为增强结果不稳定。
- 本轮规划：只修 `ChatComposer` 的 Prompt Enhance 防重。优先级中高：用户价值高（避免重复请求和 stale enhanced result 覆盖）、出现频率中（增强按钮天然容易双击）、实现成本低（纯 helper + ref）、风险低（不改后端命令协议，不改变失败时保留原文/关闭弹窗策略）。
- 本轮完成：`src/components/chat/composer/ChatComposer.tsx` 新增 `shouldBlockPromptEnhance()` 纯 helper 和 `enhanceInFlightRef`，在 `chat_enhance_prompt` invoke 前同步置位，`finally` 释放；`handleEnhance()` 继续在失败时清空增强文本、关闭弹窗并保留原草稿。`src/components/chat/composer/ChatComposer.test.ts` 已有 3 条 helper 回归测试覆盖 in-flight、空文本和 rendered loading 状态。`.trellis/spec/frontend/component-guidelines.md` 记录 Prompt Enhance ref-level guard 与失败策略。
- 本轮验证：接手前 RED 已确认：`npm test -- src/components/chat/composer/ChatComposer.test.ts` 失败于 `shouldBlockPromptEnhance is not a function`。实现后验证通过：`npm test -- src/components/chat/composer/ChatComposer.test.ts`（1 file / 8 tests）；`npm test -- src/components/chat/composer/ChatComposer.test.ts src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/useCompletions.test.ts src/stores/useChatStore.test.ts`（4 files / 58 tests）；`npm test`（27 files / 233 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（102 tests，2 doctests ignored）；`git diff --check` 退出 0，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 composer：双击 Prompt Enhance、增强失败、Enhance 进行中再发送/切 selector，确认只触发一次且失败保留原文；2) 真实 Tauri 点测双击 Send、快速 Enter、`chat_send` 失败附件恢复，补齐上一轮未验证项；3) 继续排查聊天交互 bug，优先看 daemon offline / abort failure 的真实 WebView 表现、历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 prompt enhancer dialog enter shortcut

- 目标：补齐 `PromptEnhancerDialog` 相比 cc-gui 缺失的“增强结果就绪后按 Enter 采用增强版”键盘路径，同时避免焦点在按钮/输入控件上时发生全局快捷键与原生控件行为双触发。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目 `PromptEnhancerDialog` / `ChatComposer` 与 cc-gui `PromptEnhancerDialog`，确认本项目只处理 `Escape`。
- 功能点 2：补回归测试。验证方式：新增 `src/components/chat/composer/PromptEnhancerDialog.test.ts`，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：新增纯 helper 解析 `Escape` / `Enter`，复用 `dialogShortcuts` 避免抢按钮/编辑控件；弹窗 keydown 根据 helper 调用 `onClose` 或 `onUseEnhanced`。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 enhancer/composer 测试、相邻 dialog shortcut 测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 prompt enhancer dialog enter shortcut

- 上轮实际进展：Prompt Enhance 重复触发 guard 已在 `ChatComposer` 落地，`chat_enhance_prompt` invoke 前会用 `enhanceInFlightRef` 即时防重，失败时关闭弹窗并保留原草稿；全量前端测试、构建、Rust check/test、IDE 文件构建和 `git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/ChatInputBox/PromptEnhancerDialog.tsx`，cc-gui 在增强结果就绪后支持 `Enter` 直接采用增强版、`Escape` 关闭；本项目 `src/components/chat/composer/PromptEnhancerDialog.tsx` 只监听 `Escape`，键盘用户必须 Tab 到按钮或改用鼠标，和输入区“键盘优先”的交互不一致。
- 本轮诊断（超越 cc-gui）：直接照抄全局 `Enter` 会产生新风险：焦点在 footer button 上时，浏览器原生 Enter click 和 window keydown 可能同时调用回调。本轮用纯 helper 复用 `dialogShortcuts` 的 editable / button target 判断，让全局 Enter 只在焦点不属于控件时采用增强版；Escape 保持可关闭但不抢编辑控件。
- 本轮规划：只修 Prompt Enhancer 对比弹窗快捷键。优先级中高：用户价值高（增强结果确认是高频键盘路径）、出现频率中（每次使用 enhancer 都会遇到）、实现成本低（纯 helper + effect）、风险低（不改 `chat_enhance_prompt` 协议，不改 ChatComposer 状态流）。
- 本轮完成：`src/components/chat/composer/PromptEnhancerDialog.tsx` 新增 `resolvePromptEnhancerShortcutAction()`，支持 `Enter` 在非 loading 且存在增强结果时采用增强版，`Escape` 关闭，并避开 button / editable target；弹窗 keydown effect 改为根据该 helper 调用 `onUseEnhanced` / `onClose`。新增 `src/components/chat/composer/PromptEnhancerDialog.test.ts` 覆盖 Enter ready/loading/empty、Escape、按钮和 contenteditable target。`.trellis/spec/frontend/component-guidelines.md` 记录 enhancer 对比弹窗快捷键契约。新增测试文件已执行 `git add -- src/components/chat/composer/PromptEnhancerDialog.test.ts`。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/components/chat/composer/PromptEnhancerDialog.test.ts` 失败于 `resolvePromptEnhancerShortcutAction is not a function`。实现后验证通过：`npm test -- src/components/chat/composer/PromptEnhancerDialog.test.ts`（1 file / 3 tests）；`npm test -- src/components/chat/composer/PromptEnhancerDialog.test.ts src/components/chat/composer/ChatComposer.test.ts src/components/chat/composer/ButtonArea.test.tsx src/utils/dialogShortcuts.test.ts src/components/chat/PlanApprovalDialog.test.ts src/components/chat/ToolPermissionDialog.test.ts`（6 files / 24 tests）；`npm test`（28 files / 236 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（102 tests，2 doctests ignored）；IDE `build_project` 针对 `PromptEnhancerDialog.tsx` 通过；`git diff --check` 退出 0，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 Prompt Enhancer：增强完成后 Enter 是否采用增强版、按钮焦点 Enter 是否只触发一次、Escape 是否关闭、loading 中 Enter 是否无效；2) 继续真实点测 composer 双击 Send / 双击 Enhance / `chat_send` 失败附件恢复；3) 继续排查聊天交互 bug，优先看 daemon offline / abort failure 的真实 WebView 表现、历史会话快速切换、系统通知、diff 恢复按钮、Open File、历史图片 lightbox 与 Codex 长历史锚点。

## 本轮 PLAN 2026-06-19 open file percent path guard

- 目标：修复 Chat 工具块 / 搜索结果里的 Open File 在合法文件名包含普通 `%` 字符时被前端桥接层误判为 malformed encoded path、导致点击无效的问题。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目 `src/utils/bridge.ts` / `src/utils/bridge.test.ts`，并对照 `jetbrains-cc-gui/webview/src/utils/bridge.ts` 与 `linkify.ts` 的 `normalizeFileNavigationTarget()`。
- 功能点 2：补回归测试。验证方式：在 `src/utils/bridge.test.ts` 增加普通 `%` 文件名不应阻断 invoke、有效 percent-encoding 仍应解码的用例，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：`openFile()` 的归一化改为尽力解码，遇到非法 percent escape 时保留原始合法路径，不再直接返回 null；仍继续拒绝控制字符。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行 `npm test -- src/utils/bridge.test.ts src/utils/toolPresentation.test.ts`、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、必要 Rust editor command 测试和 `git diff --check`。

## 迭代记录 2026-06-19 open file percent path guard

- 上轮实际进展：Prompt Enhancer 对比弹窗已补齐 `Enter` 采用增强版与 `Escape` 关闭，并避开 button/editable target；定向测试、相邻对话框测试、全量前端测试、构建、Rust check/test、IDE 构建与 `git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/utils/bridge.ts` 与 `linkify.ts`，cc-gui 的 `openFile()` 会通过 `normalizeFileNavigationTarget()` 尽力规范化 href，不会因为普通文件名里的 `%` 直接丢掉 Open File。当前项目 `src/utils/bridge.ts` 对整个 path 直接 `decodeURIComponent()`，合法文件名如 `src/reports/100% coverage.md` 会触发 `URI malformed`，`openFile()` 返回 `false`，工具块/搜索结果点击没有任何 Tauri 调用。
- 本轮诊断（超越 cc-gui）：Chat 工具结果里的路径来源混杂：有 URL 编码的 file URI，也有 shell/rg 原样输出的本地路径。桥接层应区分“普通文件系统路径里的字面量 `%`”与“真正损坏的 UTF-8 percent-encoding”，否则用户会误以为工具块文件入口坏了，而且这类 bug 很难从 UI 上看出原因。
- 本轮规划：只修 `openFile()` 的前端路径解码边界。优先级中高：用户价值高（Open File 是工具块核心回看路径）、出现频率中（报告、覆盖率、URL 命名文件常见 `%`）、实现成本低（桥接层 helper + 单测）、风险低（不改后端命令协议，控制字符拦截保持不变）。
- 本轮完成：`src/utils/bridge.test.ts` 新增合法字面量 `%` 文件名回归测试；`src/utils/bridge.ts` 新增 `decodeOpenFileTarget()`，将非 percent-escape 的 `%` 转义后再解码，最多三轮处理重复编码；遇到真正无法解码的损坏 percent payload 仍返回 `null`，并继续在 invoke 前拒绝控制字符。`.trellis/spec/frontend/component-guidelines.md` 记录 Open File 路径归一化契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/utils/bridge.test.ts` 失败于 `expected false to be true`，证明当前实现确实阻断 `src/reports/100% coverage.md`。实现后验证通过：`npm test -- src/utils/bridge.test.ts`（6 tests）；`npm test -- src/utils/bridge.test.ts src/utils/toolPresentation.test.ts`（2 files / 38 tests）；`npm test`（28 files / 237 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（102 tests，2 doctests ignored）；IDE `build_project` 针对 `src/utils/bridge.ts` 和 `src/utils/bridge.test.ts` 通过；`git diff --check` 退出 0，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点击 Open File 点测。
- 下一步候选：1) 真实 Tauri 桌面点测 Open File：普通 `%` 文件名、`file:///C:/...%20...`、`path:line`、相对路径 + `currentCwd`、搜索结果行号；2) 继续排查 daemon offline / abort failure 的 WebView 恢复路径，尤其是错误提示、按钮状态和附件/草稿恢复是否一致；3) 继续真实点测历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换。

## 本轮 PLAN 2026-06-19 load session failure after abort closes streaming turn

- 目标：修复加载历史会话时先成功中止当前流式回复、随后历史读取失败，旧 assistant 消息仍保持 `streaming: true` 导致 UI 永久显示生成中且按钮状态不一致的问题。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取 `useChatStore.loadSession()` / `abortActiveRequestIfNeeded()` / `ChatComposer` / `ChatPage` streaming 状态来源，并对照 cc-gui 的会话切换边界。
- 功能点 2：补回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 模拟 active turn + `chat_abort` 成功 + `get_unified_session_messages` 失败，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：当历史加载失败且本次切换已经中止过活跃 turn 时，保留当前 transcript，但把旧 streaming assistant 收口为 stopped/error 状态，避免 WebView 无限 loading。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 store 测试、相邻聊天交互测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 load session failure after abort closes streaming turn

- 上轮实际进展：Prompt Enhancer 对比弹窗、Open File `%` 路径、permission 队列/失败恢复、composer pre-request 防重等此前迭代均已记录并通过自动化验证；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的会话切换会在统一状态边界内结束旧 turn；当前项目 `loadSession()` 虽会先 `chat_abort`，但当 `get_unified_session_messages` 失败时只设置 `error` 和清 `pendingSessionKey`，会保留原 transcript。因为旧 assistant 仍是 `streaming: true`、`activeRequestId` 已被清空，WebView 可能同时呈现“还在生成”和“可继续操作”的矛盾状态。
- 本轮诊断（超越 cc-gui）：历史读取失败时保留旧 transcript 是合理恢复策略，但必须把已被主动中止的旧 assistant 收口为 stopped/error。这样用户既不会丢上下文，也不会误判 daemon 仍在为旧消息生成。
- 本轮规划：只修 `loadSession` 的“abort 后历史读取失败”分支。优先级中高：用户价值高（避免永久 loading 与按钮状态错乱）、出现频率低到中（历史文件损坏/移动/权限错误时触发）、实现成本低（store helper + 单测）、风险低（不改后端协议，不改成功加载路径）。
- 本轮完成：`src/stores/useChatStore.ts` 新增 `stopStreamingAssistantMessages()`，在 `loadSession()` 记录本次是否中止过活跃 turn；若后续历史读取失败，则保留旧 transcript，但把旧 streaming assistant 标记为 `streaming: false`、`error: 已停止输出` 并写入 `durationMs`。`src/stores/useChatStore.test.ts` 新增回归测试覆盖 active turn + abort 成功 + history load 失败。`.trellis/spec/frontend/state-management.md` 增补该状态边界契约。
- 本轮验证：先新增测试并确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败 1 项，实际旧 assistant 仍为 `streaming: true`。实现后验证通过：`npm test -- src/stores/useChatStore.test.ts`（1 file / 41 tests）；`npm test -- src/stores/useChatStore.test.ts src/components/chat/composer/ChatComposer.test.ts src/components/chat/composer/ButtonArea.test.tsx src/utils/chatUiBehavior.test.ts src/components/chat/chatSessionSidebarUtils.test.ts src/utils/chatNavigation.test.ts`（6 files / 93 tests）；`npm test`（28 files / 238 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（102 tests，2 doctests ignored）；IDE `build_project` 针对 `src/stores/useChatStore.ts` 和 `src/stores/useChatStore.test.ts` 通过；`git diff --check` 退出 0，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测加载历史失败场景：删除/移动历史文件后在流式回复中切换，确认旧消息停止、错误可见且可继续发送；2) 继续排查 daemon offline / abort failure 的真实 WebView 表现，尤其 `chat_abort` 失败时旧事件是否被退休且不会污染当前 transcript；3) 继续真实点测 Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换。

## 本轮 PLAN 2026-06-19 daemon stdout close offline recovery

- 目标：修复 daemon 子进程 stdout 关闭后后端仍可能认为 daemon running、前端顶部状态仍显示 ready、下一次发送可能写到旧 stdin 的恢复问题。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取 `DaemonClient.start()` reader loop、`ChatManager.send()` / `warm_up()`、前端 `chat://daemon` 状态消费，并对照 cc-gui `SessionState` busy/loading/error 边界。
- 功能点 2：补回归测试。验证方式：在 `src-tauri/src/chat/daemon_client.rs` 增加 stdout close 后必须标记 stopped、drain pending、emit shutdown 的 Rust 单测，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：reader loop 结束时统一收口 daemon 状态；`ChatManager` 获取已存在但 stopped 的 client 时重启并重新拉起 heartbeat。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/backend/cross-layer-protocol.md` 或相关 frontend state spec，并追加本文件最终记录。
- 功能点 5：质量验证。验证方式：运行定向 Rust 测试、Rust 全量测试、前端相关测试、`npm test`、`npm run build`、`cargo check` 和 `git diff --check`。

## 迭代记录 2026-06-19 daemon stdout close offline recovery

- 上轮实际进展：历史加载失败后 streaming assistant 收口已在 `useChatStore` 落地，定向 store 测试、相关前端测试、全量前端测试、构建、Rust check/test、IDE 构建与 `git diff --check` 均已通过；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java`，cc-gui 的 reader thread 在 stdout 结束后进入 `handleDaemonDeath()`，会用 `compareAndSet(true,false)` 关闭 running、失败 pending request、通知 lifecycle listener，并按限制重启。当前项目 `src-tauri/src/chat/daemon_client.rs` 旧 reader loop 只 drain pending，不会把 `running` 置 false，也不会 emit `chat://daemon shutdown`；`src-tauri/src/chat/manager.rs` 旧 `send()`/`warm_up()` 直接复用 cached client，下一次发送可能写到 stale stdin。
- 本轮诊断（超越 cc-gui）：本项目先不做后台无限自启，而是把异常 stdout close 明确变成 offline 状态，并在下一次用户触发的 `send()` / `warm_up()` 前重启。这样避免 daemon 崩溃后 UI 继续显示 ready，同时减少无用户操作时反复重启的噪声。
- 本轮规划：只修 daemon stdout close 恢复边界。优先级高：用户价值高（避免 ready 假象和下一次发送失败）、出现频率中（daemon crash、SDK 加载异常、stdout pipe 关闭都会触发）、实现成本低到中（Rust helper + manager restart guard）、风险可控（不改前端事件形状，不改 daemon JS 协议）。
- 本轮完成：`src-tauri/src/chat/daemon_client.rs` 将 `running` 改为 `Arc<AtomicBool>` 供 stdout reader 共享；新增 `handle_stdout_closed()`，stdout close 时清理 stdin/child、drain pending 为 `Done { success: false, error: "daemon exited" }`，并只在 `running` 从 true 切到 false 时 emit `shutdown`，避免主动 stop/restart 后重复 shutdown。新增两条 Rust 单测覆盖异常退出和 already stopped 不重复事件。`src-tauri/src/chat/manager.rs` 已通过 `running_client()` 让 `send()` / `warm_up()` 在 cached client 已停止时 restart 并重启 heartbeat；`abort()` 保持不主动拉起 daemon。`.trellis/spec/backend/cross-layer-protocol.md` 新增 `Chat Daemon Stdout-Close Recovery` 7 段契约。
- 本轮验证：接手前 RED 已确认：`cargo test --manifest-path src-tauri/Cargo.toml chat::daemon_client::tests::stdout_close_marks_stopped_drains_pending_and_emits_shutdown` 失败于缺少 `handle_stdout_closed`。本轮补充的重复 shutdown 边界实现后验证通过：`cargo test --manifest-path src-tauri/Cargo.toml chat::daemon_client::tests::stdout_close`（2 tests）；`npm test -- src/stores/useChatStore.test.ts`（41 tests）；`npm test`（28 files / 238 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo test --manifest-path src-tauri/Cargo.toml`（104 tests，2 doctests ignored）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；IDE `build_project` 针对 `src-tauri/src/chat/daemon_client.rs` 与 `src-tauri/src/chat/manager.rs` 通过。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 daemon offline 恢复：手动 kill daemon 后确认顶部状态变 shutdown、当前请求失败可见、下一次发送/预热可恢复；2) 为 `ChatManager::running_client()` 增加可注入 fake client 的 manager-level 回归，验证 stopped cached client 的 restart/heartbeat 行为；3) 继续真实点测历史加载失败、Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换。

## 本轮 PLAN 2026-06-19 daemon offline manual reconnect

- 目标：把后端已能发出的 `chat://daemon shutdown` 状态接到前端可见、可恢复的 Chat UI 入口，避免用户只看到“启动中”却不知道如何恢复。
- 功能点 1：确认本项目与 cc-gui 对标行为。验证方式：CodeGraph 读取本项目 `useChatStore` / `ChatPage` / `StatusPanel`，并对照 cc-gui `DaemonBridge.handleDaemonDeath()` / `ClaudeSession.restart()`。
- 功能点 2：补回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 覆盖 `reconnectDaemon()` 成功/失败状态；在 `src/components/chat/StatusPanel.test.tsx` 覆盖离线状态文本与恢复按钮。
- 功能点 3：实现最小恢复入口。验证方式：`useChatStore` 新增 `daemonReconnecting` 与 `reconnectDaemon()`，顶部与右侧状态面板在 daemon offline/shutdown/error 时显示低噪声恢复按钮；成功等待后端 `ready` 事件，失败保留错误。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md`，最后追加本轮记录。
- 功能点 5：质量验证。验证方式：运行定向 store/status 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、`git diff --check`；如 IDE 可用再执行相关文件构建。

## 迭代记录 2026-06-19 daemon offline manual reconnect

- 上轮实际进展：daemon stdout close 后端恢复已落地，异常 stdout close 会标记 stopped、drain pending、emit `chat://daemon shutdown`，`ChatManager.send()` / `warm_up()` 会在 cached client stopped 时重启；定向 Rust、前端 store、全量前端、Rust 全量、构建、IDE 构建与 `git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面 kill daemon 点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java`，cc-gui 在 reader 结束后进入 `handleDaemonDeath()`，会关闭 running、失败 pending request、通知 lifecycle listener 并尝试 restart；本项目后端已能发 `shutdown`，但 `src/pages/ChatPage.tsx` 和 `src/components/chat/StatusPanel.tsx` 只把 non-ready 显示成启动中，用户没有显式恢复入口。
- 本轮诊断（超越 cc-gui）：本项目不做静默无限自启，而是在 offline/error 时给出低噪声手动重连入口。这样用户能分辨“正常启动中”和“daemon 已离线”，也能在发送前主动恢复，避免下一次发送才暴露错误。
- 本轮规划：只补 daemon offline 前端恢复路径。优先级高：用户价值高（daemon crash 后可见可恢复）、出现频率中（stdout close / Node/SDK 异常会触发）、实现成本低（store action + 两个展示入口）、风险低（不改后端事件形状，不改 send 协议）。
- 本轮完成：`src/stores/useChatStore.ts` 新增 `daemonReconnecting` 和 `reconnectDaemon()`，调用 `chat_start_daemon`，成功后等待后端 `ready` 事件确认 ready，失败时保留 `error` 与 `daemonStatus='error'`；`chat://daemon ready/shutdown` 会清理 reconnecting。`src/utils/chatDaemonStatus.ts` 新增共享状态派生 helper，顶部和右侧状态面板统一识别 ready/starting/offline/error。`src/pages/ChatPage.tsx` 在 offline/error 时显示重连按钮；`src/components/chat/StatusPanel.tsx` 显示守护进程状态与 icon-only 重连按钮；`src/styles/toolBlocks.css` 补状态面板按钮样式；`src/locales/en.json` / `src/locales/zh.json` 补 i18n 文案。新增 `src/utils/chatDaemonStatus.test.ts`，并扩展 `src/stores/useChatStore.test.ts`、`src/components/chat/StatusPanel.test.tsx`。`.trellis/spec/frontend/state-management.md` 新增 7 段 daemon 手动恢复契约，`.trellis/spec/frontend/component-guidelines.md` 记录展示约束。新增文件已执行 `git add -- src/utils/chatDaemonStatus.ts src/utils/chatDaemonStatus.test.ts`。
- 本轮验证：先确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败于 `reconnectDaemon is not a function`；`npm test -- src/components/chat/StatusPanel.test.tsx` 失败于缺少 `status-daemon-reconnect`。实现后验证通过：`npm test -- src/utils/chatDaemonStatus.test.ts src/stores/useChatStore.test.ts src/components/chat/StatusPanel.test.tsx`（3 files / 54 tests）；`npm test`（29 files / 245 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（104 tests，2 doctests ignored）；IDE `build_project` 针对 `useChatStore.ts`、`StatusPanel.tsx`、`ChatPage.tsx`、`chatDaemonStatus.ts` 通过；`git diff --check` 退出 0，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面 kill daemon 点测。
- 下一步候选：1) 真实 Tauri 桌面点测 daemon offline 恢复：手动 kill daemon 后确认顶部/右侧显示离线，点击重连后 ready 事件恢复，重连失败时错误可见；2) 为 `ChatManager::running_client()` 增加 manager-level fake client 回归，验证 stopped cached client restart + heartbeat 行为；3) 继续真实点测历史加载失败、Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换。

## 本轮 PLAN 2026-06-19 daemon init warmup failure recoverable

- 目标：修复 Chat 页面首次 `init()` 预热 daemon 失败后只设置 `error`、未进入 `daemonStatus='error'` 的状态缺口，避免 UI 长期显示“启动中”且缺少重连入口。
- 功能点 1：确认根因与对标行为。验证方式：CodeGraph 读取本项目 `useChatStore.init()` / `reconnectDaemon()`，并对照 cc-gui `DaemonBridge.handleDaemonDeath()` 的 daemon 死亡状态边界。
- 功能点 2：补回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 模拟 `chat_start_daemon` 在 `init()` 阶段 reject，先运行定向测试确认 RED。
- 功能点 3：实现最小修复。验证方式：`init()` warm-up 失败时设置 `daemonReady: false`、`daemonStatus: 'error'`、`daemonReconnecting: false` 并保留 `String(error)`。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/state-management.md` 的 daemon 手动恢复契约，并在本文件追加最终记录。
- 功能点 5：质量验证。验证方式：运行定向 store/daemon 状态测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与 `git diff --check`。

## 迭代记录 2026-06-19 daemon init warmup failure recoverable

- 上轮实际进展：daemon stdout close 后端恢复与前端手动重连入口已落地，`chat://daemon shutdown` 可被顶部/右侧状态面板识别为 offline/error 并暴露重连按钮；定向测试、全量前端测试、构建、Rust check/test、IDE 构建与 `git diff --check` 均已通过。阻塞仍是真实 Tauri 桌面 kill daemon / 重连点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java`，cc-gui 在 reader 结束或 daemon 死亡时会关闭 running、失败 pending request、通知 lifecycle listener 并尝试 restart。当前项目上一轮已补 shutdown 后的恢复入口，但 `src/stores/useChatStore.ts` 的首次 `init()` warm-up 失败只设置 `error`，没有把 `daemonStatus` 置为 `error`，因此 UI 仍可能按 starting 展示。
- 本轮诊断（超越 cc-gui）：本项目采用低噪声手动恢复而非静默无限自启，前提是所有 daemon 启动失败入口都进入同一个 recoverable state。首启失败也应该立即给用户“失败 + 可重连”的状态，而不是等用户下一次发送时才暴露。
- 本轮规划：只修 `init()` warm-up 失败分支。优先级高：用户价值高（首屏 daemon 启动失败是阻断性体验）、出现频率中（Node/SDK/路径问题常在首启暴露）、实现成本极低（store catch 分支 + 单测）、风险低（不改成功路径、不改 Tauri 命令协议）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增 `init()` warm-up 失败回归测试；`src/stores/useChatStore.ts` 在 `chat_start_daemon` 预热失败时设置 `daemonReady: false`、`daemonStatus: 'error'`、`daemonReconnecting: false` 和 `error: String(e)`；`.trellis/spec/frontend/state-management.md` 补充首启 warm-up 失败的 daemon recoverable error 契约。
- 本轮验证：先确认 RED：`npm test -- src/stores/useChatStore.test.ts` 失败于 `daemonStatus` 实际为 `null`、期望 `error`。实现后验证通过：`npm test -- src/stores/useChatStore.test.ts`（44 tests）；`npm test -- src/utils/chatDaemonStatus.test.ts src/stores/useChatStore.test.ts src/components/chat/StatusPanel.test.tsx`（3 files / 55 tests）；`npm test`（29 files / 246 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（104 tests，2 doctests ignored）；IDE `build_project` 针对 `src/stores/useChatStore.ts` 与 `src/stores/useChatStore.test.ts` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，仅 LF/CRLF 转换提示。未做真实 Tauri 桌面首启失败/kill daemon 点测。
- 下一步候选：1) 真实 Tauri 桌面点测 daemon recoverable path：首启失败、手动 kill daemon、点击重连、重连失败时顶部/右侧状态是否一致；2) 为 `ChatManager::running_client()` 增加 manager-level fake client 回归，验证 stopped cached client restart + heartbeat 行为；3) 继续真实点测历史加载失败、Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换。

## 本轮 PLAN 2026-06-19 daemon failure diagnostic visibility

- 目标：把 store 已保存的 daemon 启动/重连失败原因以低噪声方式展示在 Chat 状态面板与顶部状态 tooltip 中，避免用户只看到泛化“错误/离线”而不知道恢复动作失败的具体原因。
- 功能点 1：确认差距与对标行为。验证方式：CodeGraph 读取 `chatDaemonStatus`、`StatusPanel`、`ChatPage`，并对照 cc-gui `DaemonBridge.handleDaemonDeath()` lifecycle 行为。
- 功能点 2：补回归测试。验证方式：在 `src/utils/chatDaemonStatus.test.ts` 覆盖诊断文本优先级、空白压缩、长度截断与 ready/starting 隐藏；在 `src/components/chat/StatusPanel.test.tsx` 覆盖 daemon error 诊断与重连按钮同屏出现，先运行定向测试确认 RED。
- 功能点 3：实现最小展示。验证方式：新增共享 `getChatDaemonDiagnosticText()`，`StatusPanel` 接收并渲染 compact 诊断，`ChatPage` 将 store `error` 传入面板并把顶部状态 `title` 设为诊断/状态文本。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，最后追加本轮记录。
- 功能点 5：质量验证。验证方式：运行定向 helper/status/store 测试、`npm test`、`npm run build`、Rust check/test、IDE 构建与 `git diff --check`。

## 迭代记录 2026-06-19 daemon failure diagnostic visibility

- 上轮实际进展：daemon stdout close 后端恢复、前端手动重连入口、首启 warm-up 失败进入 recoverable error 已落地并通过自动化验证；阻塞仍是真实 Tauri 桌面首启失败 / kill daemon / 重连点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java`，cc-gui daemon 死亡会进入 lifecycle listener，并在日志/请求错误里保留原因。本项目已有 offline/error 与重连按钮，但 `src/components/chat/StatusPanel.tsx` 只显示泛化 `chat.daemon.error` / `chat.daemon.offline`，具体 `error` 只留在 store/page alert，右侧恢复入口附近看不到原因。
- 本轮诊断（超越 cc-gui）：本项目采用用户可控的手动恢复路径，恢复按钮旁边应显示一行清洗后的失败原因；顶部状态保持克制，只在 tooltip 中复用同一诊断，避免主工具栏变吵。
- 本轮规划：只补 daemon 失败诊断展示。优先级中高：用户价值高（Node/SDK/path/权限失败时能直接知道原因）、出现频率中（首启/重连失败常见）、实现成本低（纯 helper + 两处透传）、风险低（不改 daemon 协议，不新增 i18n 文案）。
- 本轮完成：`src/utils/chatDaemonStatus.ts` 新增 `getChatDaemonDiagnosticText()`，在 ready/starting/reconnecting 时隐藏诊断，offline/error 时优先使用 store `error`，再使用非泛化 `daemonStatus`，并压缩空白、140 字符截断。`src/components/chat/StatusPanel.tsx` 新增 `daemonError` prop，失败时在 daemon 行下方渲染 `status-daemon-diagnostic`，同时保留重连按钮。`src/pages/ChatPage.tsx` 传入 store `error`，并把顶部 daemon 状态容器 `title` 设置为同一诊断/状态文本。`src/utils/chatDaemonStatus.test.ts` 和 `src/components/chat/StatusPanel.test.tsx` 增加回归测试。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 同步记录诊断展示契约。
- 本轮验证：先确认 RED：`npm test -- src/utils/chatDaemonStatus.test.ts src/components/chat/StatusPanel.test.tsx` 失败于 `getChatDaemonDiagnosticText is not a function` 与缺少 `status-daemon-diagnostic`。实现后验证通过：`npm test -- src/utils/chatDaemonStatus.test.ts src/components/chat/StatusPanel.test.tsx`（2 files / 16 tests）；`npm test -- src/utils/chatDaemonStatus.test.ts src/components/chat/StatusPanel.test.tsx src/stores/useChatStore.test.ts`（3 files / 60 tests）；`npm test`（29 files / 251 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；`cargo test --manifest-path src-tauri/Cargo.toml`（104 tests，2 doctests ignored）；IDE `build_project` 针对本轮 5 个 TS/TSX 文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，未发现空白错误，仅 `git diff --check` 输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面点测。
- 下一步候选：1) 真实 Tauri 桌面点测 daemon recoverable path：首启失败、手动 kill daemon、点击重连失败/成功时，顶部 tooltip、右侧诊断、page alert 是否一致；2) 为 `ChatManager::running_client()` 增加 manager-level fake client 回归，验证 stopped cached client restart + heartbeat 行为；3) 继续真实点测历史加载失败、Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换。

## 本轮 PLAN 2026-06-19 daemon manager stopped-client regression

- 目标：补齐 `ChatManager::running_client()` 的 manager-level 回归保护，锁住 cached daemon stopped 后 `send()` / `warm_up()` 必须先 restart、并重新拉起 heartbeat 的行为。
- 功能点 1：确认差距与对标行为。验证方式：CodeGraph 读取本项目 `ChatManager` / `DaemonClient` 以及 cc-gui `DaemonBridge.handleDaemonDeath()`；区分当前代码已实现与测试未覆盖。
- 功能点 2：补 RED 测试。验证方式：在 `src-tauri/src/chat/manager.rs` 增加 fake daemon client 测试，先运行定向 Rust 测试确认缺少测试 seam 或行为失败。
- 功能点 3：实现最小测试 seam。验证方式：生产路径仍创建真实 `DaemonClient`；测试路径通过内部 trait/fake 覆盖 stopped cached client restart、running cached client 不 restart、restart 失败不 spawn heartbeat。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/backend/cross-layer-protocol.md` 的测试契约，并在本文件追加最终记录。
- 功能点 5：质量验证。验证方式：运行定向 Rust 测试、`cargo test --manifest-path src-tauri/Cargo.toml`、`cargo check --manifest-path src-tauri/Cargo.toml`、前端全量测试/构建，以及 `git diff --check`。

## 迭代记录 2026-06-19 daemon manager stopped-client regression

- 上轮实际进展：daemon stdout close 后端恢复、前端手动重连入口、首启 warm-up 失败可恢复、失败诊断可见性均已落地并通过自动化验证；阻塞仍是真实 Tauri 桌面首启失败 / kill daemon / 重连点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java`，cc-gui 的 `handleDaemonDeath()` 会关闭 running、失败 pending request、通知 lifecycle listener 并在限制内尝试 restart。当前项目已有 `ChatManager::running_client()` 让 `send()` / `warm_up()` 在 cached client stopped 时 restart，但 CodeGraph 显示该 manager 决策边界没有测试覆盖。
- 本轮诊断（超越 cc-gui）：本项目继续保持“用户触发前恢复”的低噪声策略，不做后台无限自启；本轮通过 fake daemon client 锁住 manager 判断，而不是启动真实 Node daemon，减少测试 flake 与环境依赖。
- 本轮规划：只补 manager-level 回归保护。优先级中高：用户价值高（避免 daemon crash 后下一次发送写 stale stdin）、出现频率中（daemon stdout close / restart / SDK 异常路径都会触发）、实现成本低到中（内部 trait seam + 单文件单测）、风险可控（不改 Tauri 命令协议、不改前端状态）。
- 本轮完成：`src-tauri/src/chat/manager.rs` 新增内部 `ManagerDaemonClient` trait 与 future type alias，让生产 `DaemonClient` 和测试 fake client 走同一条 manager 决策路径；`ChatManager` 仍在生产路径懒创建真实 daemon client，`send()` / `warm_up()` 继续通过 `running_client()`，`abort()` 仍不主动 restart。新增三条 Rust 单测覆盖 stopped cached client restart + heartbeat、running cached client 复用、restart 失败不 spawn heartbeat。`.trellis/spec/backend/cross-layer-protocol.md` 在 `Chat Daemon Stdout-Close Recovery` 的 Tests Required 中补充 fake-client manager regression 契约。
- 本轮验证：先确认 RED：`cargo test --manifest-path src-tauri/Cargo.toml chat::manager::tests::running_client_restarts_stopped_cached_client_and_spawns_heartbeat` 失败于缺少 `ManagerDaemonClient` / `ClientFuture` / `ClientResultFuture` / `ensure_running_client_with_heartbeat`。实现后验证通过：`cargo test --manifest-path src-tauri/Cargo.toml chat::manager::tests::running_client`（3 tests）；`cargo test --manifest-path src-tauri/Cargo.toml`（107 tests，2 doctests ignored）；`npm test`（29 files / 251 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build`；`cargo check --manifest-path src-tauri/Cargo.toml`；IDE `build_project` 针对 `src-tauri/src/chat/manager.rs` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面 kill daemon / 重连点测。
- 下一步候选：1) 真实 Tauri 桌面点测 daemon recoverable path：首启失败、手动 kill daemon、点击重连失败/成功时，顶部 tooltip、右侧诊断、page alert 是否一致；2) 继续真实点测历史加载失败、Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换；3) 若桌面点测发现 daemon 重启耗时较长，再评估顶部状态增加短期“重启中/等待 ready”细分反馈。

## 本轮 PLAN 2026-06-19 daemon reconnect waits for ready

- 目标：修复 `reconnectDaemon()` 在 `chat_start_daemon` resolve 后过早清除 `daemonReconnecting` 的状态空窗，确保手动重连一直保持 pending，直到后端 `ready` / `shutdown` 事件或前端等待超时收口。
- 功能点 1：确认差距与对标行为。验证方式：CodeGraph 读取本项目 `useChatStore.reconnectDaemon()` / daemon lifecycle listener，并对照 cc-gui `DaemonBridge.start()` ready latch / timeout 行为。
- 功能点 2：补 RED 回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 覆盖 `chat_start_daemon` resolve 后仍保持 reconnecting、`ready` 事件清除 pending、`shutdown` 事件清除 pending、等待 ready 超时进入 recoverable error。
- 功能点 3：实现最小等待 ready 状态机。验证方式：`reconnectDaemon()` success 不再清 pending；新增模块级 ready timeout helper；`ready` / `shutdown` / reconnect failure 清理 timeout；timeout 仅在仍处于 reconnecting + starting + not ready 时写入 error。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 的 daemon manual recovery 契约、验证矩阵和 Tests Required。
- 功能点 5：质量验证。验证方式：运行定向 store/daemon 状态测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与 `git diff --check` / `git diff --cached --check`。

## 迭代记录 2026-06-19 daemon reconnect waits for ready

- 上轮实际进展：`ChatManager::running_client()` manager-level fake client 回归已落地，覆盖 stopped cached client restart + heartbeat、running client 复用、restart failure 不启动 heartbeat；Rust 全量、前端全量、构建、IDE 构建与空白检查均已通过。阻塞仍是真实 Tauri 桌面 kill daemon / 重连点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java`，cc-gui `start()` 会等待 ready latch，并在进程提前退出或 ready timeout 时保持失败语义；当前项目 `src/stores/useChatStore.ts` 的 `reconnectDaemon()` 在 `chat_start_daemon` resolve 后立即清除 `daemonReconnecting`，导致“启动命令成功但 ready 事件没到”的空窗没有 pending 反馈和超时收口。
- 本轮诊断（超越 cc-gui）：本项目继续保留用户可控的手动重连策略，但把“命令已发起”和“daemon 已 ready”拆成两个状态。手动重连期间 UI 一直保持 starting/reconnecting，直到 backend `ready` / `shutdown` 或前端 ready timeout 给出明确结果，避免用户误以为恢复已经完成。
- 本轮规划：只修前端 store 的重连等待 ready 边界。优先级高：用户价值高（daemon 恢复失败不会卡在无反馈 starting）、出现频率中（Node/SDK/daemon 启动慢或 ready 事件丢失时出现）、实现成本低（store timer + 单测 + i18n key）、风险低（不改 Tauri 命令和后端协议）。
- 本轮完成：`src/stores/useChatStore.ts` 新增 ready timeout helper，`reconnectDaemon()` 在 `chat_start_daemon` success 后保持 `daemonReconnecting: true` 并等待 `ready` / `shutdown` / timeout；`ready` 和 `shutdown` 事件都会清理 timeout；timeout 只在仍处于 reconnecting + starting + not ready 时转入 recoverable error。`src/stores/useChatStore.test.ts` 增加三条回归测试覆盖 success-before-ready、shutdown-before-ready、ready timeout。`src/utils/chatDaemonStatus.ts` 新增 timeout 诊断 key；`src/pages/ChatPage.tsx` 与 `src/components/chat/StatusPanel.tsx` 在展示边界翻译该 key，普通后端错误仍原样显示。`src/locales/en.json` / `src/locales/zh.json` 增加 timeout 文案。`.trellis/spec/frontend/state-management.md` 和 `.trellis/spec/frontend/component-guidelines.md` 同步更新契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 3 项，均证明旧实现会在 `chat_start_daemon` resolve 后提前把 `daemonReconnecting` 置为 false。GREEN：`npm test -- src/stores/useChatStore.test.ts` 通过（46 tests）；`npm test -- src/stores/useChatStore.test.ts src/utils/chatDaemonStatus.test.ts src/components/chat/StatusPanel.test.tsx` 通过（3 files / 62 tests）；`npm test` 通过（29 files / 253 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对 `useChatStore.ts`、`useChatStore.test.ts`、`chatDaemonStatus.ts`、`StatusPanel.tsx`、`ChatPage.tsx` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面 daemon ready timeout / kill daemon / 重连点测。
- 下一步候选：1) 真实 Tauri 桌面点测 daemon recoverable path：首启失败、手动 kill daemon、点击重连成功、点击重连后 ready 长时间不到时顶部 tooltip / 右侧诊断 / page alert 是否一致；2) 继续真实点测历史加载失败、Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换；3) 若真实点测发现 daemon ready 时间常超过 15s，再结合日志调整 ready timeout 或把“等待 ready”状态细分成更明确的长等待提示。

## 本轮 PLAN 2026-06-19 daemon init waits for ready

- 目标：修复 Chat 页面首次 `init()` warm-up 在 `chat_start_daemon` resolve 后未收到 `ready` 事件时长期停留在启动中的状态缺口，确保首屏 daemon 预热也有 bounded ready wait。
- 功能点 1：确认差距与对标行为。验证方式：CodeGraph 读取本项目 `useChatStore.init()` / daemon listener / ready timeout helper，并对照 cc-gui `DaemonBridge.start()` ready latch / timeout。
- 功能点 2：补 RED 回归测试。验证方式：在 `src/stores/useChatStore.test.ts` 模拟 `init()` warm-up resolve 但没有 `chat://daemon ready`，用 fake timer 断言进入 recoverable error。
- 功能点 3：实现最小修复。验证方式：复用 ready timeout helper，让 `init()` warm-up success 后在未 ready 时启动 timeout；如果 ready 已经先到或 shutdown 到来，则不再误触发 timeout。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 的 daemon manual recovery 契约和 Tests Required。
- 功能点 5：质量验证。验证方式：运行定向 store/daemon 状态测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与 `git diff --check` / `git diff --cached --check`。

## 迭代记录 2026-06-19 daemon init waits for ready

- 上轮实际进展：手动 `reconnectDaemon()` 已改为等待 backend `ready` / `shutdown` / ready-timeout，而不是在 `chat_start_daemon` resolve 后提前结束 pending；前端全量、构建、Rust check/test、IDE 构建和空白检查均已通过。阻塞仍是真实 Tauri 桌面 daemon ready timeout / kill daemon / 重连点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/src/main/java/com/github/claudecodegui/provider/common/DaemonBridge.java`，cc-gui `start()` 会阻塞等待 ready 或 timeout；当前项目上一轮只补了手动重连路径，`src/stores/useChatStore.ts` 的首次 `init()` warm-up 在 `chat_start_daemon` resolve 且没有 ready 事件时仍可能保持 `daemonStatus: null/starting`，没有 timeout 收口。
- 本轮诊断（超越 cc-gui）：首屏 warm-up 与手动重连应共享同一条 bounded ready wait。用户首次进入 Chat 时，如果 daemon 没有真正 ready，应在短时间后给出可恢复错误与诊断，而不是无限展示启动中，让用户误以为只是正常预热。
- 本轮规划：只修 `init()` warm-up success-without-ready。优先级高：用户价值高（首屏阻断状态可见且可恢复）、出现频率中（Node/SDK/daemon 启动慢或 ready 事件丢失时出现）、实现成本低（复用上一轮 helper + 单测）、风险低（不改后端协议，不新增 UI 文案）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增 `init()` warm-up success 后 ready 缺失的 fake-timer 回归测试；`src/stores/useChatStore.ts` 在 `init()` 开始时显式进入 `daemonStatus: 'starting'`，并在 warm-up success 后如果仍未 ready 就调度同一个 ready timeout；ready/shutdown 事件继续清理 timeout。ready timeout helper 的触发条件从“必须正在手动 reconnect”放宽为“已调度、未 ready、仍为 starting”，因此首屏 warm-up 和手动重连共用收口逻辑。`.trellis/spec/frontend/state-management.md` 同步记录 init warm-up bounded ready wait 契约和测试要求。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 1 项，证明 `init()` success 后 `daemonStatus` 仍为 `null` 且没有 timeout 进入 recoverable error。GREEN：`npm test -- src/stores/useChatStore.test.ts` 通过（47 tests）；`npm test -- src/stores/useChatStore.test.ts src/utils/chatDaemonStatus.test.ts src/components/chat/StatusPanel.test.tsx` 通过（3 files / 63 tests）；`npm test` 通过（29 files / 254 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对 `useChatStore.ts`、`useChatStore.test.ts` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面首屏 ready timeout / kill daemon / 重连点测。
- 下一步候选：1) 真实 Tauri 桌面点测 daemon recoverable path：首屏 ready 缺失/启动失败、手动 kill daemon、点击重连成功/失败，确认顶部 tooltip、右侧诊断、page alert 与按钮状态一致；2) 继续真实点测历史加载失败、Open File、历史图片 lightbox、diff 恢复按钮、长历史 Codex 锚点与会话快速切换；3) 如果真实点测发现首屏 ready 经常超过 15s，再结合 daemon 日志把 timeout 调整为后端可观测的启动 SLA 或增加更明确的长等待提示。

## 本轮 PLAN 2026-06-19 image lightbox visible context

- 目标：让 Chat 图片/历史图片全屏预览在大图之外保留可见文件名/标签上下文，避免用户检查多张截图或附件时丢失来源。
- 功能点 1：确认差距与对标行为。验证方式：CodeGraph 读取本项目 `ContentBlockRenderer` 图片 lightbox 与 cc-gui `ContentBlockRenderer` image preview，确认本项目已有 portal lightbox、但没有可见 caption。
- 功能点 2：补 RED 测试。验证方式：新增/补充 `ContentBlockRenderer` 测试，点击图片后断言 dialog 内出现可见 caption；先运行定向测试确认失败。
- 功能点 3：实现最小展示层增强。验证方式：在 portal lightbox 底部渲染当前图片 label，沿用已有 `ImageRenderData.label`，不新增后端字段或新依赖。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 的图片预览契约，并在本文件追加最终记录。
- 功能点 5：质量验证。验证方式：运行定向图片渲染测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与 `git diff --check`。

## 迭代记录 2026-06-19 image lightbox visible context

- 上轮实际进展：首屏 `init()` daemon warm-up 已复用 bounded ready wait，`chat_start_daemon` resolve 后若没有 `ready` 事件会在 timeout 后进入可恢复错误；前端全量、构建、Rust check/test、IDE 构建和空白检查均已通过。阻塞仍是真实 Tauri 桌面 daemon 首屏失败 / kill daemon / 重连点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `jetbrains-cc-gui/webview/src/components/MessageItem/ContentBlockRenderer.tsx`，cc-gui 的图片块可点击进入全屏预览。本项目 `src/components/chat/ContentBlockRenderer.tsx` 已经有 React portal lightbox、Escape 关闭和缩略图入口，因此“图片可放大”能力已补齐。
- 本轮诊断（超越 cc-gui）：本项目的 lightbox 只显示大图，文件名/标签只存在于 `alt` / `aria-label` / 缩略图隐藏 caption 中。用户连续检查多张历史截图或附件时，进入全屏后会丢失来源上下文，尤其是文件名相近或带 `%`、截图编号的场景。
- 本轮规划：只做图片 lightbox 可见上下文。优先级中等：用户价值高（历史图片回看和多图比对不会丢来源）、出现频率中（截图/附件越来越常见）、实现成本低（同文件小组件 + 单测）、风险低（不改图片解析、不改后端、不新增 i18n 文案）。
- 本轮完成：`src/components/chat/ContentBlockRenderer.tsx` 导出 `ImageLightbox` 小组件，portal 改为复用该组件；lightbox 底部新增 `chat-image-lightbox-caption`，展示当前 `ImageRenderData.label`，并保留 `title` 以便长文件名查看完整值；关闭按钮补充 `stopPropagation()`，避免按钮点击同时冒泡到遮罩。`src/components/chat/ContentBlockRenderer.test.tsx` 新增 lightbox caption 回归测试。`.trellis/spec/frontend/component-guidelines.md` 记录图片全屏预览必须保留可见文件名/标签上下文。
- 本轮验证：RED：`npm test -- src/components/chat/ContentBlockRenderer.test.tsx` 先失败 1 项，原因是 `ImageLightbox` 尚未导出，证明新增断言未被旧实现满足。GREEN：`npm test -- src/components/chat/ContentBlockRenderer.test.tsx` 通过（9 tests）；`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageMeta.test.tsx src/utils/chatNavigation.test.ts src/utils/chatImageBlocks.test.ts` 通过（3 files / 24 tests；其中 `chatImageBlocks.test.ts` 当前未匹配到测试文件）；`npm test` 通过（29 files / 255 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对 `ContentBlockRenderer.tsx` / `ContentBlockRenderer.test.tsx` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面点击图片 lightbox 点测。
- 下一步候选：1) 真实 Tauri 桌面点测图片 lightbox：历史图片、本轮上传图片、长文件名、Escape/遮罩/关闭按钮关闭路径，确认 caption 不遮挡主体；2) 真实 Tauri 桌面点测 daemon recoverable path：首屏 ready 缺失/启动失败、手动 kill daemon、重连成功/失败；3) 继续补齐高价值 Chat UI：diff 恢复按钮的真实文件回滚路径、Open File 真实点击、长历史 Codex 锚点与快速会话切换。

## 本轮 PLAN 2026-06-19 diff pane copy path action

- 目标：给中心 `ChatDiffReviewPane` 增加 Copy Path 快捷操作，让用户在审阅文件 diff 时能直接复制当前文件路径，而不必回到工具块详情或手选路径文本。
- 功能点 1：确认差距与对标行为。验证方式：CodeGraph 读取 `ChatDiffReviewPane`、`ReadToolBlock`、`EditToolBlock` 与 cc-gui 文件操作/工具块，确认本项目 diff 面板已有 Open File 但缺少 Copy Path。
- 功能点 2：补 RED 测试。验证方式：在 `ChatDiffReviewPane.test.tsx` 断言选中 edit 时渲染 `chat-diff-review-copy` 和既有 `tools.copyPath` 文案/标题，先运行定向测试确认失败。
- 功能点 3：实现最小展示层增强。验证方式：`ChatDiffReviewPane` 复用 `copyToClipboard(edit.openPath || edit.displayPath)`，按钮复制后短暂显示 `tools.copied`；空状态禁用该按钮。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 的 diff 面板局部操作契约，并在本文件追加最终记录。
- 功能点 5：质量验证。验证方式：运行定向 diff 面板测试、相邻 tool block/bridge 测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 diff pane copy path action

- 上轮实际进展：图片 lightbox 已在 `src/components/chat/ContentBlockRenderer.tsx` 补充可见 caption，并通过定向测试、前端全量测试、构建、Rust check/test、IDE 构建和空白检查；阻塞仍是真实 Tauri 桌面图片点击路径未点测。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：本项目中心 `src/components/chat/ChatDiffReviewPane.tsx` 已有 Open File、视图模式切换、换行切换和折叠入口，但缺少 Copy Path；同项目 `src/components/toolBlocks/ReadToolBlock.tsx` / `src/components/toolBlocks/EditToolBlock.tsx` 已有复制路径能力，因此用户在中心 diff 审阅流里需要回到工具块详情或手选路径文本，操作不一致。
- 本轮诊断（超越 cc-gui）：把文件级低成本操作直接放在中心 diff 面板，能减少审阅时的上下文切换。用户在比对变更、记录问题或把路径贴给外部工具时，可以在当前视觉焦点内完成复制，不必离开 diff。
- 本轮规划：只补 Copy Path，不做 diff restore/revert。优先级中高：用户价值高（代码审阅中复制路径频繁）、出现频率中高（每次查看 diff 都可能用到）、实现成本低（复用 `copyToClipboard` 和既有 i18n key）、风险低（不改后端、不改 diff 数据结构）。restore/revert 涉及跨层写文件、确认与回滚安全，保留为后续独立设计。
- 本轮完成：`src/components/chat/ChatDiffReviewPane.tsx` 新增 Copy Path icon button、复制成功态和卸载清理 timer，复制目标使用 `edit.openPath || edit.displayPath`；`src/components/chat/ChatDiffReviewPane.test.tsx` 新增 SSR 回归，确保选中 diff 文件时渲染复制路径入口；`src/styles/toolBlocks.css` 将复制按钮纳入中心 diff 面板操作样式，并补充 hover/focus/disabled 与 copied 成功态；`.trellis/spec/frontend/component-guidelines.md` 记录中心 diff 面板应同时暴露 Open File 和 Copy Path，且继续复用桥接 helper 与 i18n key。
- 本轮验证：RED：`npm test -- src/components/chat/ChatDiffReviewPane.test.tsx` 先失败于缺少 `chat-diff-review-copy`。GREEN：`npm test -- src/components/chat/ChatDiffReviewPane.test.tsx` 通过（6 tests）；`npm test -- src/components/chat/ChatDiffReviewPane.test.tsx src/components/toolBlocks/EditDiffPreview.test.tsx src/utils/bridge.test.ts` 通过（3 files / 15 tests）；IDE `build_project` 针对 `src/components/chat/ChatDiffReviewPane.tsx`、`src/components/chat/ChatDiffReviewPane.test.tsx`、`src/styles/toolBlocks.css` 通过；`npm test` 通过（29 files / 256 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；`git diff --check` 与 `git diff --cached --check` 退出 0，仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面 WebView 点击复制点测。
- 下一步候选：1) 真实 Tauri 桌面点测中心 diff Copy Path：点击后剪贴板内容是否为预期路径、成功态是否显示并自动恢复；2) 真实 Tauri 桌面点测图片 lightbox：历史图片、本轮上传图片、长文件名、Escape/遮罩/关闭按钮关闭路径；3) 真实 Tauri 桌面点测 daemon recoverable path：首屏 ready 缺失/启动失败、手动 kill daemon、重连成功/失败；4) 若继续做 diff restore/revert，需要先设计确认跨层写文件、旧内容提取、确认弹窗和失败回滚策略。

## 本轮 PLAN 2026-06-19 chat mcp availability status

- 目标：在 Chat 右侧状态面板展示当前 provider 的 MCP 配置可用性摘要，让用户发送前能看到 MCP 基础状态，而不是必须切到 MCP 页面检查。
- 功能点 1：确认当前进度与差距。验证方式：CodeGraph 读取 `StatusPanel`、`ChatPage`、`useMcpStoreV2`、`McpPage` 与后端 `check_mcp_status`，区分“配置启用可见性”和“真实连通性检测”。
- 功能点 2：补 RED 测试。验证方式：在 `StatusPanel.test.tsx` 断言传入 MCP 摘要时渲染 `status-mcp-summary`、当前 provider 可用数量和 loading/error 诊断；先运行定向测试确认旧 UI 不满足。
- 功能点 3：实现最小展示层增强。验证方式：新增共享 MCP 摘要 helper，`ChatPage` 复用 `useMcpStoreV2` 加载服务器列表并按当前 provider 派生 enabled/total/error/loading，`StatusPanel` 渲染 compact 摘要。
- 功能点 4：同步 i18n 与 Trellis 规范。验证方式：新增 `en.json` / `zh.json` 文案，更新 `.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/frontend/state-management.md`。
- 功能点 5：质量验证。验证方式：运行 MCP 摘要 helper / StatusPanel / ChatPage 邻近测试、`npm test`、`npm run build`、Rust check/test（工作区已有 Rust 改动）和 `git diff --check`。

## 迭代记录 2026-06-19 chat mcp availability status

- 上轮实际进展：中心 diff 面板 Copy Path 已落地并通过定向测试、前端全量测试、构建、Rust check/test、IDE 构建和空白检查；阻塞仍是真实 Tauri 桌面点击复制、图片 lightbox、daemon recoverable path 点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 当前任务进度判断：`06-16-toolblocks` 的工具块基础能力已基本完成，后续真实差距集中在 Chat UI 的“发送前可判断性”和“运行时基础信息可见性”。已有状态面板能显示 provider、消息数、锚点、daemon、pending/failed tools、当前工具和编辑摘要；缺口是 MCP 配置可用性、工具/agent/MCP 实时连通性、模型/权限模式/工作区等基础上下文还不够集中可见。
- 本轮诊断（补齐 cc-gui）：cc-gui 的工具/daemon 状态更强调运行过程可见；本项目已有 MCP 管理页和 `useMcpStoreV2`，也有后端 `check_mcp_status`，但 Chat 页没有展示当前 provider 对应的 MCP 基础可用数。用户发送前无法判断当前 provider 到底启用了几个 MCP server。
- 本轮诊断（超越 cc-gui）：本轮先展示“配置可用性”，不自动触发真实连通性检测。原因是后端 `check_mcp_status` 对 stdio MCP 会实际启动命令，放在 Chat 首屏自动轮询会有噪声和风险。先把当前 provider 的 enabled/total、加载状态和加载错误放到右侧状态面板，能解决最高频判断问题，同时为下一轮手动连通性检测留出清晰入口。
- 本轮规划：只做 Chat 状态面板 MCP 配置摘要。优先级高：用户价值高（发送前知道 MCP 是否对当前 provider 可用）、出现频率高（每次切 provider / 进入 Chat 都相关）、实现成本低（复用已有 store 和配置开关）、风险低（不改后端、不启动 MCP 进程、不改协议）。
- 本轮完成：`src/utils/chatMcpStatus.ts` 新增 `buildChatMcpAvailabilitySummary()` 和 provider enablement 映射，按 `enabledClaude` / `enabledCodex` / `enabledGemini` 计算当前 provider 的 MCP 可用数，并清洗加载错误；`src/utils/chatMcpStatus.test.ts` 覆盖 provider 映射、摘要计算、错误压缩截断。`src/pages/ChatPage.tsx` 接入 `useMcpStoreV2`，进入 Chat 时加载 MCP server 列表并把摘要传入状态面板。`src/components/chat/StatusPanel.tsx` 新增 `status-mcp-summary` compact 行，展示 `enabled / total`、loading spinner 和错误诊断；`src/components/chat/StatusPanel.test.tsx` 新增 MCP 可用性与 loading/error 断言。`src/locales/en.json` / `src/locales/zh.json` 新增 MCP 状态面板文案。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 记录“Chat 中展示的是 MCP 配置可用性，不是实时连通性”的契约。新增文件已执行 `git add -- src/utils/chatMcpStatus.ts src/utils/chatMcpStatus.test.ts`。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 2 项，证明旧 UI 缺少 `status-mcp-summary`。GREEN：`npm test -- src/utils/chatMcpStatus.test.ts src/components/chat/StatusPanel.test.tsx` 通过（2 files / 13 tests）；`npm test -- src/utils/chatMcpStatus.test.ts src/components/chat/StatusPanel.test.tsx src/utils/chatDaemonStatus.test.ts` 通过（3 files / 21 tests）；`npm test` 通过（30 files / 261 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对 `chatMcpStatus.ts`、`chatMcpStatus.test.ts`、`StatusPanel.tsx`、`StatusPanel.test.tsx`、`ChatPage.tsx` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，仅 `git diff --check` 输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面 Chat 状态面板视觉点测，也未触发真实 MCP 连通性检测。
- 下一步候选：1) Chat 右侧状态面板继续补基础上下文：当前模型、权限模式、工作区路径、SDK installed 状态，用同一 compact surface 展示；2) 做 MCP 手动连通性检测入口：只在用户点击时调用 `check_mcp_status`，展示 online/offline/timeout/error 和延迟，避免自动启动 stdio MCP；3) 把 agent/subagent 可用状态纳入状态面板：可用 subagent 数、当前 agent-like tool 的模型/耗时/token 摘要；4) 真实 Tauri 桌面点测本轮 UI：切换 claude/codex 后 MCP enabled/total 是否变化，MCP 加载失败时诊断是否可见。

## 本轮 PLAN 2026-06-19 large history first-paint optimization

- 目标：优化点击历史大会话后的首屏加载速度，减少 React 首屏对全量历史消息的同步派生和工具结果扫描。
- 功能点 1：完成根因诊断与 cc-gui 对标。验证方式：CodeGraph 读取 `useChatStore.loadSession()`、`ChatPage`、`MessageList`、`chatNavigation`、`findToolResult` 与 cc-gui `MessageList`，确认慢点来自全量历史读取后仍全量派生。
- 功能点 2：补 RED 测试。验证方式：在 `src/utils/chatNavigation.test.ts` 增加最近可渲染窗口测试，断言非搜索首屏只扫描尾部窗口且保留原始索引。
- 功能点 3：实现最小前端优化。验证方式：新增共享窗口 helper；`ChatPage` 非搜索时只用最近窗口计算锚点/status；`MessageList` 非搜索时只从最近窗口渲染并用窗口内 tool result map，搜索时保留全量匹配。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，最后追加本轮完成记录。
- 功能点 5：质量验证。验证方式：运行定向 `chatNavigation` / `chatUiBehavior` / `chatStatusSummary` / store 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与空白检查。

## 迭代记录 2026-06-19 large history first-paint optimization

- 上轮实际进展：Chat 状态面板已展示当前 provider 的 MCP 配置可用性摘要，并通过前端全量测试、构建、Rust check/test、IDE 构建和空白检查；阻塞仍是真实 Tauri 桌面视觉/交互点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui `webview/src/components/MessageList.tsx` 在普通浏览时只渲染最近 15 条并逐页 reveal。当前项目虽然已有折叠窗口，但 `src/pages/ChatPage.tsx` 仍对全量 `messages` 做 `getRenderableMessages()`、搜索过滤、锚点、`buildChatStatusSummary()`，`src/components/chat/MessageList.tsx` 也先全量 renderable/filter 后再 slice；每个 `MessageItem` 还把全量 `messages` 交给工具结果查找。
- 本轮诊断（超越 cc-gui）：本项目的右侧状态、锚点和中心 diff 面板比 cc-gui 信息密度更高，所以更需要把“首屏可见窗口”和“显式全量搜索”区分开。普通浏览应先围绕可见尾部稳定显示，只有用户搜索或继续 reveal earlier 时才逐步扩大派生范围。
- 本轮规划：先做前端首屏窗口化，不改后端 Tauri 命令。优先级高：用户价值高（点击大会话更快看到最近上下文）、出现频率高（历史会话越长越明显）、实现成本低到中（纯前端 helper + 三处接入）、风险可控（搜索仍保留全量；store 仍保留完整历史；不改 provider 文件解析）。
- 本轮完成：`src/utils/chatNavigation.ts` 新增 `getRecentRenderableMessages()`，返回最近可渲染窗口、隐藏可渲染数量、总可渲染数量并保留 `originalIndex`；`src/utils/chatNavigation.test.ts` 增加回归测试。`src/components/chat/MessageList.tsx` 非搜索时按最近窗口 + revealed count 渲染，不再先构造全量 renderable/filter；同时为当前可见尾部预建 `toolResultById` map，`src/components/chat/MessageItem.tsx` 改为接收窗口级 `findToolResult`。`src/pages/ChatPage.tsx` 非搜索时用最近窗口驱动锚点和消息计数，并用从首个可见原始下标开始的 raw slice 构建状态摘要，避免全量历史 edit/tool 汇总拖慢首屏；搜索时仍扫描完整历史。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 记录长历史首屏窗口化契约。
- 本轮验证：RED：`npm test -- src/utils/chatNavigation.test.ts` 先失败于 `getRecentRenderableMessages is not a function`。GREEN：`npm test -- src/utils/chatNavigation.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatStatusSummary.test.ts` 通过（31 tests）；`npm test -- src/stores/useChatStore.test.ts` 通过（47 tests）；`npm test` 通过（30 files / 262 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对本轮 5 个 TS/TSX 文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面大会话点击性能点测，也未改后端全量读取/序列化。
- 下一步候选：1) 增加后端尾部窗口命令，例如 `get_unified_session_messages_window(providerId, sourcePath, tailCount)`，先让 Claude/Codex JSONL provider 只解析尾部有效消息并返回 `total/hasMore`，从源头减少 Tauri 序列化和前端映射；2) 为大会话点击加入轻量性能埋点或测试夹具，记录 backend invoke、history map、first render 三段耗时；3) 真实 Tauri 桌面点测 1k/5k/10k 历史会话：点击到首屏可见、滚动顶部 reveal earlier、搜索全量、状态面板 edit/diff 是否随 reveal 扩大；4) 继续补 Chat 状态面板基础上下文：当前模型、权限模式、工作区路径、SDK installed 状态。

## 本轮 PLAN 2026-06-19 chat model selector icons and dynamic models

- 目标：把 Chat 输入区模型切换改成 cc-gui 同类的模型图标 + 短标签呈现，并把模型列表从组件硬编码改为动态配置层加载，保留内置模型兜底。
- 功能点 1：确认对标和现状。验证方式：CodeGraph 读取本项目 `ButtonArea` / `ChatComposer` / `useChatStore` / `constants`，对照 cc-gui `ModelSelect` / `ButtonArea` / `ProviderModelIcon`，区分真实动态合并与未经核实的在线拉取。
- 功能点 2：补 RED 测试。验证方式：新增 `chatModels` 工具测试覆盖 Provider 默认模型、本地自定义模型、去重、当前模型保留；扩展 `ButtonArea` / `ChatComposer` 测试覆盖模型图标与动态模型透传。
- 功能点 3：实现最小改动。验证方式：新增共享模型列表 helper；`ChatComposer` 复用 `useProviderStore.loadAllProviders()` 动态读取 Provider 模型配置；`ButtonArea` 只消费传入模型，不再直接读取硬编码数组；模型 selector 触发按钮和列表项使用模型家族图标。
- 功能点 4：同步 Trellis 规范和迭代记录。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md`，并在本文件追加最终记录。
- 功能点 5：质量验证。验证方式：运行新增/相邻前端测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与空白检查；不做自动在线模型拉取。

## 迭代记录 2026-06-19 chat model selector icons and dynamic models

- 上轮实际进展：Chat 状态面板 MCP 配置摘要和大会话首屏窗口化均已落地并通过自动化验证；阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 均可读，两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui `webview/src/components/ChatInputBox/selectors/ModelSelect.tsx` 的模型 selector 是“provider/model 图标 + 短标签”，并在 `ButtonArea.tsx` 中把内置模型与 localStorage 自定义模型、Claude 模型映射动态合并。当前项目 `src/components/chat/composer/ButtonArea.tsx` 旧实现直接调用 `modelsForProvider()`，模型列表来自 `constants.ts` 静态数组，触发按钮和列表项都用通用 `Terminal` 图标；`src/stores/useChatStore.ts` 默认模型也直接取静态数组第一项。
- 本轮诊断（超越 cc-gui）：本项目已有 Provider 配置和 `fetch_models` 表单能力，但 Chat 首屏不应自动调用远端 `/v1/models`：该命令会携带 API Key 访问 provider URL，且现有实现不一定适配所有 Anthropic-compatible 源。更稳妥的第一步是把 Chat 模型列表做成动态配置层：读取当前 provider 的已保存模型字段、本地自定义模型，再叠加内置兜底；后续再设计用户点击触发的刷新入口。
- 本轮规划：只做模型 selector 图标化 + 动态配置列表，不改后端命令、不做自动远端拉取。优先级高：用户价值高（发送前能看到实际 provider 配置模型，模型切换更像 cc-gui）、出现频率高（每次发消息都会看到/可能切换模型）、实现成本低到中（纯前端 helper + store 复用 + 测试）、风险低（内置模型兜底保留，失败不阻断发送）。
- 本轮完成：`src/utils/chatModels.ts` 新增模型列表合并层，按“active Provider 默认模型字段 -> localStorage `ccg-chat-custom-models:<provider>` -> 内置 fallback”合并并去重，`ensureChatModelInList()` 确保历史/本地保存的当前模型不会在 selector 上显示成错误的 fallback 标签。`src/components/chat/composer/ModelIcon.tsx` 新增模型家族图标，区分 Claude Opus/Sonnet/Haiku/Fable/custom 与 Codex/GPT/custom。`src/components/chat/composer/ButtonArea.tsx` 改为接收 `models` / loading / error，模型按钮和选项使用 `ModelIcon`，只在未传入列表时才回退 `modelsForProvider()`。`src/components/chat/composer/ChatComposer.tsx` 接入 `useProviderStore.loadAllProviders()`，从 Provider 配置派生模型列表并监听本地自定义模型 storage 变更。`src/stores/useChatStore.ts` 默认模型兜底改用共享 helper，不再直接读 `CLAUDE_MODELS` / `CODEX_MODELS`。`src/locales/en.json` / `src/locales/zh.json` 增加模型配置加载/失败文案。新增/扩展 `chatModels`、`ButtonArea`、`ChatComposer` 测试。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步该模型列表契约。新增文件已执行 `git add -- src/utils/chatModels.ts src/utils/chatModels.test.ts src/components/chat/composer/ModelIcon.tsx src/components/chat/composer/ChatComposer.render.test.tsx`。
- 本轮验证：RED：`npm test -- src/utils/chatModels.test.ts src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx` 先失败于缺少 `chatModels` 模块、模型按钮仍显示 `Opus 4.8` 和通用 Terminal。GREEN：同命令通过（3 files / 9 tests）；`npm test -- src/utils/chatModels.test.ts src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ChatComposer.test.ts src/stores/useChatStore.test.ts` 通过（5 files / 64 tests）；`npm run build` 通过；`npm test` 通过（32 files / 269 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对本轮 TS/TSX 文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面视觉点测，也未做自动远端模型拉取。
- 下一步候选：1) 给模型 selector 增加用户触发的“刷新模型”入口，点击后调用当前 active Provider 的 `fetch_models`，结果写入 `ccg-chat-custom-models:<provider>` 并显示错误/耗时；2) 在 Chat 右侧状态面板补当前模型、权限模式、工作区路径、SDK installed 状态，和本轮模型来源保持一致；3) 给 Provider 表单的模型获取结果增加持久化选项，避免用户每次打开表单重新获取；4) 真实 Tauri 桌面点测模型 selector：active Provider 默认模型是否出现在首位、切换 Claude/Codex 后图标和列表是否正确、本地自定义模型变更是否刷新。

## 本轮 PLAN 2026-06-19 chat mcp expandable details

- 目标：修复 Chat 右侧状态面板 MCP 摘要点击后无法展开查看的问题，让用户能直接看到当前 provider 下每个 MCP server 的配置启用状态。
- 功能点 1：确认根因与对标上下文。验证方式：CodeGraph 读取 `StatusPanel` / `chatMcpStatus` / `ChatPage`，确认当前只有 compact summary，没有 server 明细和展开 affordance；复查 cc-gui 可读路径。
- 功能点 2：补 RED 测试。验证方式：扩展 `chatMcpStatus.test.ts` 和 `StatusPanel.test.tsx`，断言 summary 派生 server detail，且状态面板渲染可展开 details、server 名称和启用/未启用标签。
- 功能点 3：实现最小交互增强。验证方式：`buildChatMcpAvailabilitySummary()` 返回 server 明细；`StatusPanel` 用原生 `<details>/<summary>` 展开列表，不自动触发 `check_mcp_status`。
- 功能点 4：同步 i18n 与 Trellis 规范。验证方式：新增中英文文案，并更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md` 的 MCP 配置可用性契约。
- 功能点 5：质量验证。验证方式：运行定向 MCP / StatusPanel 测试、全量前端测试、前端构建、Rust check/test、IDE 构建与空白检查。

## 迭代记录 2026-06-19 chat mcp expandable details

- 上轮实际进展：大会话首屏窗口化、模型 selector 图标化与动态配置列表、Chat MCP 配置摘要均已落地并通过自动化验证；阻塞仍是真实 Tauri 桌面视觉/交互点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读，用户给定的 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`，且两个仓库都有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：`src/components/chat/StatusPanel.tsx` 的 MCP 区域只有 `status-mcp-summary` 普通容器，`src/utils/chatMcpStatus.ts` 的 `ChatMcpAvailabilitySummary` 也只有 enabled/total/loading/error；所以点击 MCP 无法展开不是事件失效，而是没有展开交互和 server detail 数据。
- 本轮诊断（超越 cc-gui）：展开详情只展示配置可用性，不自动调用 `check_mcp_status`。这样用户能发送前检查当前 provider 到底启用了哪些 MCP server，同时避免展开面板时启动 stdio MCP 命令或产生误导性的 online/offline 标签。
- 本轮规划：只修 MCP 摘要的可展开详情。优先级高：用户价值高（直接回应“点击 mcp 无法展开查看”且补齐基础信息）、出现频率高（进入 Chat / 切 provider / 发送前都会看状态）、实现成本低（纯前端 helper + 原生 disclosure + 测试）、风险低（不改后端、不启动 MCP 进程）。
- 本轮完成：`src/utils/chatMcpStatus.ts` 新增 `ChatMcpAvailabilityServerSummary`，`buildChatMcpAvailabilitySummary()` 返回每个 server 的 id/name/enabled/transport，并继续按 provider 映射 enabled count。`src/components/chat/StatusPanel.tsx` 把 MCP 摘要改为原生 `<details>/<summary>`，保留 compact enabled/total 行，展开后展示配置服务器列表、transport 和启用/未启用标签，loading/error 时默认展开诊断。`src/styles/toolBlocks.css` 增加 MCP chevron 旋转与 summary marker 处理。`src/locales/en.json` / `src/locales/zh.json` 增加 MCP details 文案。`src/utils/chatMcpStatus.test.ts` 与 `src/components/chat/StatusPanel.test.tsx` 增加展开详情回归测试。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 同步记录“配置明细可展开、不是实时连通性”的契约。
- 本轮验证：RED：`npm test -- src/utils/chatMcpStatus.test.ts src/components/chat/StatusPanel.test.tsx` 先失败 3 项，分别证明旧 helper 缺少 `servers` 明细、旧面板缺少 `status-mcp-details`。GREEN：同命令通过（2 files / 13 tests）；`npm test -- src/utils/chatMcpStatus.test.ts src/components/chat/StatusPanel.test.tsx src/utils/chatDaemonStatus.test.ts` 通过（3 files / 21 tests）；`npm test` 通过（32 files / 269 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对本轮 7 个文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面点击展开点测，也未做真实 MCP 连通性检测。
- 下一步候选：1) 真实 Tauri 桌面点测 MCP details：切 Claude/Codex 后 enabled/disabled 是否随 provider 切换、loading/error 默认展开是否合理；2) 增加用户触发的 MCP 手动连通性检测入口，点击后调用 `check_mcp_status` 并展示 online/offline/timeout/error/耗时，明确区别于配置可用性；3) Chat 状态面板继续补基础上下文：当前模型、权限模式、工作区路径、SDK installed 状态；4) 给模型 selector 增加用户触发的“刷新模型”入口，调用当前 active Provider 的 `fetch_models` 并写入本地自定义模型缓存。

## 本轮 PLAN 2026-06-19 chat composer task-subagent-edit tabs

- 目标：补齐输入框上方的「任务 / 子代理 / 编辑」三栏状态入口，对齐 cc-gui `StatusPanel` 在 composer 上方展示 todo/subagent/files tabs 的基础体验，并复用本项目已有工具时间线和编辑摘要。
- 功能点 1：确认差距与对标上下文。验证方式：CodeGraph 读取本项目 `ChatPage` / `ChatComposer` / `StatusPanel` / `buildChatStatusSummary()`，并对照 `C:/guodevelop/demo/jetbrains-cc-gui/webview/src/components/StatusPanel/StatusPanel.tsx`。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/utils/chatStatusSummary.test.ts`，新增 `src/components/chat/ChatInputStatusTabs.test.tsx`，先运行定向测试确认旧代码缺少 `toolTimeline` / `agentTools` 与输入区状态 tabs。
- 功能点 3：实现最小 UI 与数据层。验证方式：`buildChatStatusSummary()` 输出工具时间线和 agent/task 子集；新增 `ChatInputStatusTabs` 三栏入口，点击/默认展开可看任务、子代理、编辑明细；`ChatPage` 将其插入 `ChatComposer` 上方并把编辑点击接入现有 diff 选择。
- 功能点 4：同步 i18n 与 Trellis 规范。验证方式：新增中英文文案，并在 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md` 记录 composer 状态入口和 summary 数据契约。
- 功能点 5：质量验证。验证方式：运行定向组件/summary 测试、全量前端测试、前端构建、Rust check/test、IDE 构建与空白检查。

## 迭代记录 2026-06-19 chat composer task-subagent-edit tabs

- 上轮实际进展：大会话首屏窗口化、模型 selector 图标化 + 动态配置列表、Chat MCP 配置摘要与可展开 server 明细均已落地并通过自动化验证；阻塞仍是真实 Tauri 桌面视觉/交互点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`，且有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：对照 `C:/guodevelop/demo/jetbrains-cc-gui/webview/src/components/ChatScreen.tsx` 与 `webview/src/components/StatusPanel/StatusPanel.tsx`，cc-gui 在 `ChatInputBox` 上方渲染 `StatusPanel`，三栏为 todo/subagent/files。当前项目 `src/pages/ChatPage.tsx` 只有 `MessageList -> ScrollControl -> ChatComposer`，右侧 `src/components/chat/StatusPanel.tsx` 虽有活动/编辑/MCP 信息，但没有用户截图所指的输入框上方「任务 / 子代理 / 编辑」入口。
- 本轮诊断（超越 cc-gui）：本项目暂不复制 cc-gui 的 undo/discard/keep all 高风险操作，而是先把高频、低风险的运行态信息固定在 composer 上方。任务来自当前加载窗口内的工具时间线，子代理来自 agent/task 工具子集，编辑复用现有 diff selection；这样用户发送前能快速确认当前动作、子代理和文件改动，同时避免新增后端协议或破坏性操作。
- 本轮规划：聚焦 composer 上方三栏状态入口。优先级高：用户价值高（直接回应输入框上方入口缺失，发送前可见任务/子代理/编辑基础信息）、出现频率高（每轮对话都会看到 composer）、实现成本低到中（复用已有 `buildChatStatusSummary()` 和 diff handler）、风险低（纯前端展示，不改 daemon/Tauri 命令）。
- 本轮完成：`src/utils/chatStatusSummary.ts` 扩展 `ChatStatusSummary`，新增 `toolTimeline` 与 `agentTools`，并让 agent/task 摘要保留 subagent type / nickname / model 等可见元数据；`src/components/chat/ChatInputStatusTabs.tsx` 新增输入框上方三栏入口，支持任务、子代理、编辑三类 inline 展开详情，编辑项点击复用现有 diff 选择；`src/pages/ChatPage.tsx` 在 `ScrollControl` 和 `ChatComposer` 之间插入该入口，并传入 `statusSummary`、streaming 状态和 `handleSelectedEditChange`；`src/locales/en.json` / `src/locales/zh.json` 增加入口条文案；`src/utils/chatStatusSummary.test.ts` 与新增 `src/components/chat/ChatInputStatusTabs.test.tsx` 覆盖工具时间线、子代理列表、三栏入口和编辑选择态；`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 记录 composer status strip 的 UI/状态契约。新增文件已执行 `git add -- src/components/chat/ChatInputStatusTabs.tsx src/components/chat/ChatInputStatusTabs.test.tsx`。
- 本轮验证：RED：`npm test -- src/utils/chatStatusSummary.test.ts src/components/chat/ChatInputStatusTabs.test.tsx` 先失败于缺少 `ChatInputStatusTabs` 模块和 `summary.toolTimeline` 为 `undefined`。GREEN：同命令通过（2 files / 9 tests）；相邻验证 `npm test -- src/utils/chatStatusSummary.test.ts src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx` 通过（4 files / 20 tests）；`npm run build` 通过；`npm test` 通过（33 files / 273 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（107 tests，2 doctests ignored）；IDE `build_project` 针对本轮 TS/TSX/i18n 文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，其中 `git diff --check` 仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面视觉点测，也未用浏览器手动点击 tabs。
- 下一步候选：1) 真实 Tauri 桌面点测 composer 状态条：空会话、普通工具流、Task/Agent 调用、编辑文件点击打开 diff pane、长历史窗口化后统计范围是否符合预期；2) 若用户希望更接近 cc-gui，再设计输入区状态条的 popover 定位和外部点击关闭，不把破坏性 undo/discard/keep all 放进首轮；3) Chat 右侧状态面板继续补基础上下文：当前模型、权限模式、工作区路径、SDK installed 状态；4) 给模型 selector 增加用户触发的“刷新模型”入口，调用当前 active Provider 的 `fetch_models` 并写入本地自定义模型缓存。

## 本轮 PLAN 2026-06-19 chat status strip git branch and conditional buttons

- 目标：让 Chat 输入区状态条支持 Git 分支可见性，并把状态条按钮改成触发式显示隐藏：当前 cwd 是 Git 仓库才显示分支；任务、子代理、编辑只有存在对应数据时才显示；完全无状态时不占位。
- 功能点 1：确认数据来源和对标边界。验证方式：CodeGraph 读取 `ChatInputStatusTabs`、`ChatPage`、`StatusPanel`、`chat_commands`，确认当前无 Git 分支命令且状态条固定显示三栏 0。
- 功能点 2：补 RED 测试。验证方式：扩展 `ChatInputStatusTabs.test.tsx` 覆盖 Git 分支显示、空状态隐藏、单类状态动态布局；扩展 Rust `chat_commands` 测试覆盖非 Git 目录返回 none、`.git/HEAD` 分支解析。
- 功能点 3：实现只读 Git 工作区摘要。验证方式：新增 `chat_workspace_status(cwd)` Tauri 命令，从 cwd 向上找 `.git` 并解析 HEAD；前端新增 helper，`ChatPage` 随 `currentCwd` 加载并传入状态条。
- 功能点 4：实现状态条触发式显示。验证方式：`ChatInputStatusTabs` 根据 Git/任务/子代理/编辑 presence 构造可见项；无可见项返回 null；不再显示 0 占位按钮。
- 功能点 5：同步 i18n 与 Trellis 规范。验证方式：新增 Git 分支文案，更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md`，最后追加本轮完成记录。
- 功能点 6：质量验证。验证方式：运行定向前端/Rust 测试、前端全量测试、前端构建、Rust check/test、IDE 构建与空白检查。

## 本轮 PLAN 2026-06-19 large history transcript hydration

- 目标：修复比较大的历史会话加载到聊天区域后仍卡顿的问题，保证普通浏览路径只渲染最近窗口，后台完整历史只用于缓存与诊断指标，不再自动把几千条消息回灌到 `messages`。
- 功能点 1：锁定根因。验证方式：复查 `useChatStore.loadSession()`、`ChatPage`、`MessageList`，确认 full history 完成后仍替换 `messages`，cache hit 也会直接塞入完整数组。
- 功能点 2：补 RED 测试。验证方式：更新 `src/stores/useChatStore.test.ts`，断言 full load 完成后 `messages` 仍为首屏窗口长度，`lastSessionLoadMetrics` 完整，重复点击缓存大会话也只恢复窗口。
- 功能点 3：实现最小 store 修复。验证方式：`loadSession()` 首屏窗口继续写入 `messages`；后台完整历史只 `rememberSessionHistory()` 和更新 metrics；cache hit 从完整缓存派生最近窗口写入显示状态。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 和必要的组件规范，记录普通浏览不得自动 full-hydrate 聊天区。
- 功能点 5：质量验证。验证方式：运行定向 store/navigation 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与空白检查；未做真实 Tauri 桌面体感点测需明确标注。

## 迭代记录 2026-06-19 large history transcript hydration

- 上轮实际进展：历史大会话已有首屏窗口加载、缓存复用和 `lastSessionLoadMetrics` 诊断面板；输入区任务/子代理/编辑曾通过 idle 完整摘要补齐；Markdown 挤压问题已通过后端正文保留换行和前端相邻 text block 合并修复。用户最新反馈“比较大的历史会话加载到聊天区域依然卡顿”属实：代码复查确认 `useChatStore.loadSession()` 在首屏窗口后仍会把后台完整历史替换进 `messages`，cache hit 也会直接把完整缓存数组写入聊天区。阻塞仍是真实 Tauri 桌面体感点测未完成。
- 本轮诊断（补齐 cc-gui）：`C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。本项目已有 cc-gui 风格的 recent-window 首屏策略，但没有守住“普通浏览只消费窗口”的后半段契约；后台 full 完成后触发 `ChatPage` / `MessageList` / 状态摘要重新处理 5000+ 条消息，造成可见卡顿。
- 本轮诊断（超越 cc-gui）：用户点击大会话时最重要的是首屏可交互和滚动稳定，而不是立即把全量历史塞进 React 树。完整历史应先作为缓存与诊断数据存在；搜索、展开全历史、跨全量历史恢复输入区活动入口应走显式分页/索引，不应由后台 full load 隐式触发 UI 大更新。
- 本轮规划：只改 `useChatStore` 的历史加载状态契约与测试，不改后端读取命令、不改 ChatPage 布局、不引入虚拟列表。优先级高：用户价值高（直接降低大会话点击后的主线程压力）、出现频率高（历史会话切换常见）、实现成本低（已有窗口/缓存/metrics 结构）、风险可控（完整历史仍缓存，metrics 仍记录 full 阶段）。
- 本轮完成：`src/stores/useChatStore.test.ts` 将大会话回归契约改为 RED：full resolve 后 `messages` 仍为 120 条首屏窗口，cache hit 重选大会话也只显示 120 条窗口，同时保留 `fullMessageCount/totalMessageCount` 指标。`src/stores/useChatStore.ts` 新增 `getSessionHistoryDisplayWindow()`；cache hit 从完整缓存派生最近窗口写入 `messages`；后台 `get_unified_session_messages` 完成后只 `rememberSessionHistory()` 并更新 `lastSessionLoadMetrics`，不再调用 `getLoadedSessionState(...mappedHistory...)` 替换聊天区。`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 已同步“完整历史缓存/指标和可见 transcript 分离”的契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 3 项，失败点均为旧实现把 `messages` 扩成 5000。GREEN：同命令通过（52 tests）；相邻验证 `npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatStatusSummary.test.ts src/components/chat/MessageList.test.tsx` 通过（3 files / 72 tests；其中不存在的 `MessageList.test.tsx` 未匹配到测试文件）。全量验证通过：`npm test`（35 files / 303 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests，2 doctests ignored）、IDE `build_project`、`git diff --check`、`git diff --cached --check`。`git diff --check` 仅输出既有 LF/CRLF 提示。`npm run build` 生成的未跟踪 `out/` 已校验在工作区内并删除。未做真实 Tauri 桌面点击大会话体感点测。
- 下一步候选：1) 真实 Tauri 桌面点测 1k/5k/10k 历史会话：首次打开、cache hit 重复点击、A/B 大会话切换、full metrics 完成后滚动是否仍卡；2) 若仍卡，下一轮把后台 full fetch 改为显式搜索/展开触发，避免 IPC 反序列化和 full map 抢主线程；3) 给完整历史的任务/子代理/编辑入口做轻量索引或 worker 化，避免用 `messages` full hydration 恢复输入区状态；4) 设计“加载更多历史/搜索全历史”的明确入口和分页协议，替代隐式自动全量回灌。

## 迭代记录 2026-06-19 chat status strip git branch and conditional buttons

- 上轮实际进展：输入框上方「任务 / 子代理 / 编辑」状态条已落地并通过自动化验证，但用户指出的问题属实：旧实现固定显示三栏 0，占位噪声较大；Git 分支、非 Git 隐藏、以及状态按钮按数据触发显示均未实现。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 在输入区附近更强调当前 workspace/task/file 状态可判断性；当前项目 `src/components/chat/ChatInputStatusTabs.tsx` 只有任务、子代理、编辑三栏，且没有仓库上下文。`src-tauri/src/commands/chat_commands.rs` 也没有只读 workspace Git 状态命令，导致前端无可靠数据源展示当前分支。
- 本轮诊断（超越 cc-gui）：触发式状态条比固定 0 占位更适合本项目的长历史和密集状态面板。用户在空会话或非 Git 目录时不应看到无意义按钮；一旦有 Git、工具、子代理或编辑活动，状态条才出现，降低 composer 区域噪声。
- 本轮规划：只做 Git 分支只读检测 + 状态条触发式显示，不做分支切换、Git dirty 状态或 live Git 命令。优先级高：用户价值高（发送前立即知道当前项目分支和活动状态）、出现频率高（每次 Chat composer 都可见）、实现成本低到中（新增只读命令 + 组件条件渲染）、风险低（不执行外部 `git`，不改发送链路）。
- 本轮完成：`src-tauri/src/commands/chat_commands.rs` 新增 `ChatWorkspaceStatus`、`chat_workspace_status(cwd)` 和纯文件读取的 Git 解析逻辑，支持普通 `.git/HEAD` 与 worktree/submodule `gitdir:` 文件，并把非 Git / 不存在路径规范化为空状态；`src-tauri/src/lib.rs` 注册该命令。`src/utils/chatWorkspaceStatus.ts` 新增前端归一化与失败兜底；`src/pages/ChatPage.tsx` 随 `currentCwd` 加载 workspace status 并传入状态条。`src/components/chat/ChatInputStatusTabs.tsx` 新增 GitBranch chip，任务/子代理/编辑改为有数据才渲染，全部无内容时返回 null，不再显示 0 占位。`src/locales/en.json` / `src/locales/zh.json` 新增 Git 状态条文案；`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/state-management.md`、`.trellis/spec/backend/cross-layer-protocol.md` 同步记录触发式状态条与 `chat_workspace_status` 跨层契约。新增文件已执行 `git add -- src/utils/chatWorkspaceStatus.ts src/utils/chatWorkspaceStatus.test.ts`。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败于缺少 `workspaceStatus` prop / Git chip / 空状态隐藏；`cargo test --manifest-path src-tauri/Cargo.toml commands::chat_commands::tests::resolves_workspace_status` 先失败于缺少 `resolve_chat_workspace_status`。GREEN：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/utils/chatWorkspaceStatus.test.ts` 通过（2 files / 9 tests）；`cargo test --manifest-path src-tauri/Cargo.toml commands::chat_commands::tests::resolves_workspace_status` 通过（3 tests，含 worktree `gitdir:`）；`npm test` 通过（34 files / 279 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（110 tests，2 doctests ignored）；IDE `build_project` 针对本轮前端/Rust/i18n 文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面视觉点测。
- 下一步候选：1) 真实 Tauri 桌面点测 composer 状态条：Git 仓库显示分支、非 Git 目录完全隐藏、工具/子代理/编辑活动出现后可展开；2) 在右侧状态面板补完整基础上下文：当前模型、权限模式、工作区路径、SDK installed 状态，与 composer 状态条分工清晰；3) 给 Git chip 增加可选扩展：显示 repo root tooltip 已有，后续可增加 dirty/clean 只读状态，但必须评估扫描成本；4) 给模型 selector 增加用户触发的“刷新模型”入口，调用当前 active Provider 的 `fetch_models` 并写入本地自定义模型缓存。

## 本轮 PLAN 2026-06-19 chat markdown newline preservation

- 目标：修复历史聊天消息里个别 assistant/user Markdown 被压成一坨的问题，保留正文中的段落、列表、标题和代码块换行，让 `MarkdownBlock` 能按真实 Markdown 渲染。
- 功能点 1：定位根因。验证方式：CodeGraph 读取 `MessageItem`、`ContentBlockRenderer`、`MarkdownBlock`、`chatMessageFlow`、Claude/Codex session providers，确认换行是否在前端渲染前已经被压平。
- 功能点 2：补 RED 测试。验证方式：扩展 Rust provider tests，覆盖 Codex `output_text` 与 Claude JSONL text content 中的 `\n\n- item` Markdown，断言 `content` 和 raw text block 保留换行。
- 功能点 3：实现正文专用清理。验证方式：新增保留 Markdown 换行的正文清理函数；仅切换消息正文路径，保留标题/摘要使用单行 `sanitize_session_text()`。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md` 或 backend contract，记录历史正文清理不得折叠 Markdown 换行。
- 功能点 5：质量验证。验证方式：运行定向 Claude/Codex provider tests、前端相邻渲染测试、`npm test`、`npm run build`、`cargo check`、`cargo test`、IDE 构建与空白检查；未做真实 Tauri 桌面截图点测需明确标注。

## 迭代记录 2026-06-19 chat markdown newline preservation

- 上轮实际进展：Chat UI 已持续补齐 provider 图标、动态模型、输入区任务/子代理/编辑状态、MCP/daemon/workspace 状态、历史会话缓存和大历史首屏加载等多轮能力；这些在工作区代码和测试中已有对应实现。阻塞仍是用户最新截图反馈的个别历史 assistant final answer 被压成一坨，真实 Tauri 桌面截图点测未完成。
- 本轮诊断（补齐 cc-gui）：`MarkdownBlock` 能正常解析保留换行的 Markdown；问题发生在进入渲染前。Rust 历史 provider 共用 `sanitize_session_text()`，该函数把正文按行 `join(" ")` 并 `split_whitespace()`，会把标题、空行、列表压成一行；同时前端 `getRenderableContentBlocks()` 只过滤不合并，相邻 `text` blocks 会被 `ContentBlockRenderer` 拆成多个独立 `MarkdownBlock`。
- 本轮诊断（超越 cc-gui）：只靠 CSS 间距无法修复语义。正确方案是后端保留 transcript body 的 Markdown 换行，前端把 provider 拆分的相邻 text fragments 重新视为一个 Markdown 文档；同时不跨 image/thinking/tool_use 边界合并，避免破坏真实 transcript 结构。
- 本轮规划：优先修复“历史正文 Markdown 换行保真 + 相邻 text block 合并”。优先级高：用户价值高（直接解决长 final answer 难读）、出现频率中高（历史会话/长回复常见）、成本中低（provider 清理函数 + 共享前端 helper + 回归测试）；暂不扩大到其它状态栏/MCP/模型切换需求。
- 本轮完成：`src-tauri/src/session_manager/providers/utils.rs` 新增 `sanitize_session_markdown_text()`，保留 Markdown 换行并过滤内部噪声；`claude.rs` / `codex.rs` 的正文、reasoning 文本路径切到正文专用清理，标题/摘要仍保留单行清理；`src/utils/chatMessageFlow.ts` 新增 `mergeAdjacentTextContentBlocks()`，`getRenderableContentBlocks()` 和 `getTextFromRaw()` 共用；`src/components/chat/ContentBlockRenderer.tsx` 在工具分组前合并相邻 text blocks；对应 Rust/前端测试新增 Markdown 换行与相邻 text block 回归；`.trellis/spec/backend/cross-layer-protocol.md` 与 `.trellis/spec/frontend/component-guidelines.md` 已同步契约。
- 本轮验证：先补 RED，`cargo test --manifest-path src-tauri/Cargo.toml preserves_markdown_line_breaks` 与 `npm test -- src/utils/chatMessageFlow.test.ts src/components/chat/ContentBlockRenderer.test.tsx` 均按预期失败；实现后上述定向测试通过。全量验证通过：`npm test`（35 files / 303 tests）、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests）、IDE `build_project`、`git diff --check`。`git diff --check` 仅输出既有 LF/CRLF 提示，无 whitespace error。未做真实 Tauri 桌面截图点测。
- 下一步候选：1) 用真实 Tauri 桌面加载用户截图对应的长历史会话，确认 final answer 段落/列表/标题不再挤压；2) 继续点测和收口用户反馈的 MCP 展开、输入框上方任务/子代理/编辑触发区、Git 分支触发式显示、Claude Code/Codex 图标一致性；3) 若仍有个别消息挤压，抓取对应 raw `message.content[]`，判断是否还有 provider 特有 wrapper 或工具结果文本需要结构化处理。

## 本轮 PLAN 2026-06-19 chat provider switch brand icons

- 目标：把 Chat 输入区 Claude Code / Codex provider 切换按钮从通用 Terminal 图标改为 provider 专属图标，并对齐 cc-gui `ProviderSelect` 的 compact provider 图标行为。
- 功能点 1：确认对标实现。验证方式：读取 `C:/guodevelop/demo/jetbrains-cc-gui/webview/src/components/ChatInputBox/selectors/ProviderSelect.tsx` 与 `ProviderModelIcon.tsx`，确认 cc-gui 触发按钮和下拉选项都使用 provider/model vendor 图标。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/components/chat/composer/ButtonArea.test.tsx`，断言 Claude/Codex provider 切换控件渲染 `data-chat-provider-icon="claude|codex"`，且不再依赖统一 Terminal。
- 功能点 3：实现最小展示层改动。验证方式：`ButtonArea` 增加 provider 专属图标渲染，provider 触发按钮和 option 共用同一 helper；不新增依赖、不改 provider 切换状态逻辑。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 provider selector 不得回退为通用 Terminal 图标。
- 功能点 5：质量验证。验证方式：运行定向 `ButtonArea` 测试、相邻 composer 测试、`npm test`、`npm run build`、Rust check/test、IDE 构建与空白检查；未做真实 Tauri 桌面点测需明确标注。

## 迭代记录 2026-06-19 chat provider switch brand icons

- 上轮实际进展：记录中声称模型 selector 图标化/手动动态刷新、MCP 右侧 details 与输入区 MCP tab、输入区任务/子代理/编辑/Git/MCP 触发式状态条、右侧运行上下文、历史大会话加载诊断都已存在；代码复查确认这些能力确实分布在 `ChatComposer`、`ButtonArea`、`ChatInputStatusTabs`、`StatusPanel`、`useChatStore` 和相关 utils 中。用户最新指出的 provider 切换图标问题属实：`src/components/chat/composer/ButtonArea.tsx` 的 provider options 和 trigger 在本轮前仍统一使用 `Terminal`。已知阻塞仍是真实 Tauri 桌面视觉/点击点测不足。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 可读，用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/components/ChatInputBox/selectors/ProviderSelect.tsx` 在 compact 模式下只渲染 `ProviderModelIcon`，下拉选项同样渲染 provider 专属图标；`webview/src/components/shared/ProviderModelIcon.tsx` 将 Claude 映射到 Claude 图标，将 Codex 映射到 OpenAI 图标。本项目 provider selector 此前没有同等区分，Claude Code 与 Codex 都显示通用终端图标，用户切换时无法形成稳定 provider 视觉锚点。
- 本轮诊断（超越 cc-gui）：本项目没有引入 `@lobehub/icons`，因此本轮不新增依赖，而是在 composer 内保留轻量 inline provider 图标。这样能获得 cc-gui 的“provider 专属、compact toolbar”体验，同时不扩大依赖面、不影响动态模型刷新或 provider store。
- 本轮规划：只做 provider 切换控件展示层修正，不改 provider 状态、发送链路、模型列表动态加载或 MCP 状态。优先级高：用户价值高（切 Claude/Codex 时一眼识别上下文）、出现频率高（每次发送前都在输入区可见）、实现成本低（纯前端展示 + SSR 测试）、风险低（状态仍由 `useChatStore` 和 props 驱动）。
- 本轮完成：`src/components/chat/composer/ButtonArea.test.tsx` 新增 RED/GREEN 测试，断言 Claude/Codex provider 按钮分别渲染 `data-chat-provider-icon="claude|codex"` 且不再是 provider 按钮内的 `lucide-terminal`。`src/components/chat/composer/SelectorDropdown.tsx` 增加 `compact` 模式，紧凑按钮只显示图标并保留 disabled 关闭逻辑。`src/components/chat/composer/ButtonArea.tsx` 新增 `ProviderBrandIcon`，Claude Code 使用 Claude 风格橙色标识，Codex 使用 OpenAI/Codex 风格线性标识；provider trigger 改为 icon-only compact，dropdown options 复用同一 provider 图标并保留 label。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步 provider selector 图标与状态边界契约。
- 本轮验证：RED：`npm test -- src/components/chat/composer/ButtonArea.test.tsx` 先失败 1 项，失败点为缺少 `data-chat-provider-icon="claude"` 且旧按钮仍输出 `lucide-terminal`。GREEN：同命令通过（1 file / 6 tests）；相邻验证 `npm test -- src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ChatComposer.test.ts` 通过（3 files / 16 tests）；`npm test -- src/components/chat/composer/ButtonArea.test.tsx src/utils/chatModels.test.ts` 通过（2 files / 14 tests）；`npm test` 通过（35 files / 301 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run build` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（112 tests，2 doctests ignored）；IDE `build_project` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，只有既有 LF/CRLF 转换提示。`npm run build` 产生的 `out/` 已确认位于工作区内并删除。未做真实 Tauri 桌面视觉点测，因此图标在 WebView 里的最终视觉大小/色彩仍需 smoke 确认。
- 下一步候选：1) 真实 Tauri 桌面点测 provider selector：Claude/Codex 切换、compact 图标点击范围、下拉选项图标+label、禁用态、暗色主题；2) 如果需要更接近 cc-gui，可评估是否引入统一 provider/model 图标组件或受控图标资源，但要先评估依赖体积与许可；3) 真实桌面点测模型刷新、MCP details/live check、输入区任务/子代理/编辑/Git/MCP 展开项；4) 若用户继续反馈大会话慢，用 `lastSessionLoadMetrics` 分段数据定位下一轮是后端 tail reader、前端 map，还是 idle 完整摘要补齐。

## 本轮 PLAN 2026-06-19 chat status panel runtime context

- 目标：在 Chat 右侧状态面板补齐基础上下文：当前模型、权限模式、推理强度、工作区路径、SDK 安装状态，让用户发送前能一次性确认运行上下文。
- 功能点 1：确认上下文来源。验证方式：CodeGraph 读取 `StatusPanel`、`ChatPage`、`useChatStore`、`ChatComposer`、`useSdkStore`，确认这些字段已在前端状态中存在，不新增后端命令。
- 功能点 2：补 RED 测试。验证方式：扩展 `StatusPanel.test.tsx`，断言传入模型/权限/推理/工作区/SDK 后渲染 `status-runtime-context`、模型 id、权限文案、工作区末尾路径和 SDK installed/missing 状态。
- 功能点 3：实现最小展示层增强。验证方式：`StatusPanel` 增加可选 props 并在顶部 summary 下方渲染 compact runtime context；`ChatPage` 从 `useChatStore` / `useSdkStore` 传入现有字段。
- 功能点 4：同步 i18n 与 Trellis 规范。验证方式：新增中英文状态面板文案，更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md`。
- 功能点 5：质量验证。验证方式：运行定向 `StatusPanel` 测试、相邻 Chat composer/store 测试、`npm test`、`npm run build`、Rust check/test、IDE 构建与空白检查。

## 迭代记录 2026-06-19 chat status panel runtime context

- 上轮实际进展：输入框上方状态条已支持 Git 分支、非 Git 隐藏、任务/子代理/编辑触发式显示，并通过前端全量测试、构建、Rust check/test、IDE 构建和空白检查；阻塞仍是真实 Tauri 桌面视觉点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：右侧 `StatusPanel` 旧实现已有 provider、daemon、MCP、工具计数、当前活动和编辑摘要，但缺少用户发送前最常核对的运行上下文：当前模型、权限模式、推理强度、工作区路径和 SDK 安装状态。对应数据在 `useChatStore` 与 `useSdkStore` 已存在，缺口是展示层没有集中呈现。
- 本轮诊断（超越 cc-gui）：把模型/模式/推理/工作区/SDK 放在右侧 compact context 中，可减少用户反复展开 composer 下拉、依赖弹窗或顶部状态来确认环境。此处只展示已有状态，不触发模型刷新、SDK 安装、MCP 连通性检测或 daemon 重启，避免状态面板变成隐式副作用入口。
- 本轮规划：只做 `StatusPanel` 运行上下文展示和 `ChatPage` 接线。优先级高：用户价值高（发送前避免用错模型/工作区/权限模式）、出现频率高（每轮 Chat 都相关）、实现成本低（复用已有 store 状态和 i18n）、风险低（纯前端展示，不改后端协议和发送链路）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 新增 RED/GREEN 测试，覆盖 `status-runtime-context`、模型、权限模式、推理强度、工作区和 SDK installed 文案。`src/components/chat/StatusPanel.tsx` 增加可选 `model` / `permissionMode` / `reasoningEffort` / `sdkStatus` props，在顶部 summary 下方渲染运行上下文卡片，并复用 composer constants 的模式/推理 i18n 映射。`src/pages/ChatPage.tsx` 从 `useChatStore` 取现有模型、权限模式、推理强度，并把当前 provider 对应的 `currentSdk` 传给右侧面板。`src/locales/en.json` / `src/locales/zh.json` 新增 runtime context、workspace、SDK 状态面板文案。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步“运行上下文只消费已有状态，不新增 store/副作用”的契约。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败于缺少 `status-runtime-context`。GREEN：同命令通过（1 file / 11 tests）；相邻验证 `npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/stores/useChatStore.test.ts` 通过（4 files / 64 tests）；`npm run build` 通过；`npm test` 通过（34 files / 280 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（110 tests，2 doctests ignored）；IDE `build_project` 针对本轮前端/i18n 文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面视觉点测。
- 下一步候选：1) 真实 Tauri 桌面点测右侧状态面板：Claude/Codex 切换后模型、权限、推理、工作区、SDK 和 MCP 展开详情是否同步刷新；2) 增加用户触发的 MCP 手动连通性检测入口，点击后调用 `check_mcp_status` 并展示 online/offline/timeout/error/耗时，明确区别于配置可用性；3) 给模型 selector 增加用户触发的“刷新模型”入口，调用当前 active Provider 的 `fetch_models` 并写入本地自定义模型缓存；4) 给 Git chip 增加可选 dirty/clean 只读状态，但必须评估扫描成本，避免影响大会话首屏。

## 本轮 PLAN 2026-06-19 chat mcp manual connectivity check

- 目标：在 Chat 右侧 MCP 展开详情中增加用户触发的真实连通性检测入口，复用现有 `check_mcp_status(server_ids)` 命令，展示当前 provider 已启用 MCP server 的 online/offline/timeout/error/unknown 和延迟。
- 功能点 1：确认命令与状态边界。验证方式：CodeGraph 读取 `check_mcp_status`、`mcp_status_service`、`chatMcpStatus`、`StatusPanel`、`ChatPage`，确认检测会启动 stdio MCP，只能由用户点击触发。
- 功能点 2：补 RED 测试。验证方式：新增 `chatMcpConnectivity` 工具测试覆盖结果归一化、错误截断和 serverId 映射；扩展 `StatusPanel.test.tsx` 覆盖手动检测按钮、checking 状态、online/latency 结果。
- 功能点 3：实现最小交互增强。验证方式：`ChatPage` 维护 page-local MCP 检测状态，只检测当前 provider 已启用的 server id；`StatusPanel` 展示检测按钮和每个 server 的最近结果，不自动检测。
- 功能点 4：同步 i18n 与 Trellis 规范。验证方式：新增中英文文案，更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md`。
- 功能点 5：质量验证。验证方式：运行定向 MCP/StatusPanel 测试、全量前端测试、前端构建、Rust check/test、IDE 构建与空白检查。

## 迭代记录 2026-06-19 chat mcp manual connectivity check

- 上轮实际进展：右侧 `StatusPanel` 已补齐运行上下文，能展示当前模型、权限模式、推理强度、工作区路径和 SDK 安装状态，并通过定向/全量前端测试、构建、Rust check/test、IDE 构建和空白检查；阻塞仍是真实 Tauri 桌面视觉/交互点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：Chat 右侧 MCP 区域此前只有配置可用性（enabled/total、server 列表、transport、enabled/disabled），没有真实连通性结果。后端已有 `check_mcp_status(server_ids)` 和 `mcp_status_service`，但前端没有调用入口，用户无法在 Chat 内确认 MCP server 是否能实际启动或连接。
- 本轮诊断（超越 cc-gui）：真实检测不能自动触发，因为 stdio MCP 检测会启动命令并立即 kill；HTTP/SSE 检测也会发请求。把检测做成 MCP details 内的显式按钮，并且只检测当前 provider 已启用的 server，可让用户在发送前获得可信 live 状态，同时避免进入 Chat 或展开详情就产生副作用。
- 本轮规划：只做 MCP 手动 live 检测入口，不改后端命令、不做自动轮询。优先级高：用户价值高（发送前能区分“已启用配置”和“真的可用”）、出现频率中高（MCP 配置变化或切 provider 后会用）、实现成本低到中（复用既有 Tauri 命令 + page-local state）、风险可控（显式点击、stale response 防护）。
- 本轮完成：`src/utils/chatMcpConnectivity.ts` 新增前端 MCP live status 类型、`checkChatMcpConnectivity(serverIds)` 命令封装、结果按 serverId 索引和错误压缩工具；`src/utils/chatMcpConnectivity.test.ts` 覆盖结果映射和错误截断。`src/pages/ChatPage.tsx` 新增 page-local `mcpConnectivity` 状态、enabled server target 派生、手动检测 handler 和 stale-response 防护，provider/target 变化时清空旧结果。`src/components/chat/StatusPanel.tsx` 在 MCP details 内新增 `status-mcp-check` 按钮、checking 状态、错误诊断，以及每个 enabled server 的 live status/latency pill；disabled server 不显示 live 结果，避免误导。`src/components/chat/StatusPanel.test.tsx` 增加手动检测按钮和 online/latency 展示回归。`src/locales/en.json` / `src/locales/zh.json` 新增 live 检测文案。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 同步记录“手动检测、只测当前 provider 已启用 server、忽略过期响应”的契约。新增文件已执行 `git add -- src/utils/chatMcpConnectivity.ts src/utils/chatMcpConnectivity.test.ts`。
- 本轮验证：RED：`npm test -- src/utils/chatMcpConnectivity.test.ts src/components/chat/StatusPanel.test.tsx` 先失败于缺少 `chatMcpConnectivity` 模块和 `status-mcp-check`。GREEN：同命令通过（2 files / 14 tests）；相邻验证 `npm test -- src/utils/chatMcpConnectivity.test.ts src/utils/chatMcpStatus.test.ts src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx` 通过（4 files / 22 tests）；`npm test` 通过（35 files / 283 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（110 tests，2 doctests ignored）；IDE `build_project` 针对本轮前端/i18n 文件通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面点击 `check_mcp_status` 点测，因此真实 MCP 命令启动/HTTP 请求结果仍未人工确认。
- 下一步候选：1) 真实 Tauri 桌面点测 MCP live 检测：无 enabled server、stdio 成功/命令不存在、HTTP/SSE online/offline/timeout、切 provider 时 stale result 是否清空；2) 给模型 selector 增加用户触发的“刷新模型”入口，调用当前 active Provider 的 `fetch_models` 并写入本地自定义模型缓存；3) 给 Git chip 增加可选 dirty/clean 只读状态，但必须评估扫描成本，避免影响大会话首屏；4) 做真实桌面全链路点测清单：MCP details、运行上下文、输入区状态条、历史大会话首屏、图片 lightbox、diff Copy Path。

## 本轮 PLAN 2026-06-19 chat model selector manual refresh

- 目标：给 Chat 模型选择器增加用户触发的动态模型刷新入口，复用现有 `fetch_models(url, apiKey)` 命令，将当前 active provider 返回的模型列表写入 `ccg-chat-custom-models:<provider>` 缓存，并刷新 selector 选项。
- 功能点 1：确认现状与数据来源。验证方式：CodeGraph 读取 `ChatComposer`、`ButtonArea`、`SelectorDropdown`、`chatModels`、Provider store 和 `fetch_models` 命令，确认当前列表来自 Provider 配置 + localStorage + fallback，但缺少 Chat 内刷新入口。
- 功能点 2：补 RED 测试。验证方式：扩展 `chatModels.test.ts` 覆盖远端模型缓存序列化/事件 key；扩展 `ChatComposer.render.test.tsx` 或 `ButtonArea` 测试覆盖刷新按钮、loading、错误文案。
- 功能点 3：实现最小交互。验证方式：`ChatComposer` 从当前 active provider 读取 `apiBaseUrl/baseUrl/url` 与 `apiKey/key`，点击刷新时调用 `fetch_models`，成功后写入本地缓存并触发现有 `localStorageChange`，失败在模型菜单 footer 显示短错误；不自动拉取、不输出密钥。
- 功能点 4：同步 i18n 与 Trellis 规范。验证方式：新增中英文文案，更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md` 的模型选择器契约。
- 功能点 5：质量验证。验证方式：运行定向模型/Composer 测试、前端全量测试、前端构建、Rust check/test、IDE 构建与空白检查。

## 迭代记录 2026-06-19 chat model selector manual refresh

- 上轮实际进展：右侧 MCP 展开详情已增加用户触发的 live 连通性检测，复用 `check_mcp_status(server_ids)`，只检测当前 provider 已启用 servers，并通过前端/Rust/IDE/空白检查；阻塞仍是真实 Tauri 桌面 MCP 点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：模型选择器此前已经有模型图标、Provider 配置模型和 localStorage 缓存合并，但 Chat 内没有用户触发的动态刷新入口；用户只能依赖静态 fallback 或先去 Provider/Token 页面获取模型，和“在输入区快速确认/切换模型”的使用场景不匹配。
- 本轮诊断（超越 cc-gui）：模型发现会带着 Provider API key 访问远端 `/v1/models`，因此不能在打开 Chat、切 provider 或展开下拉时自动调用。本轮把它做成模型 selector 旁的显式图标按钮，只有当前 provider 同时有 `url` 和 `apiKey` 才显示；成功结果写入本地缓存，失败保留现有模型列表。
- 本轮规划：只做手动刷新当前 provider 模型，不做自动轮询、不改后端命令、不把模型列表提升到全局 store。优先级高：用户价值高（解决模型列表写死/滞后）、出现频率高（每次切模型都相关）、实现成本低到中（复用现有 `fetch_models` 和 `chatModels`）、风险可控（显式点击、错误不清空现有列表、不输出密钥）。
- 本轮完成：`src/utils/chatModels.ts` 新增 `getChatModelRefreshSource()`、`normalizeFetchedChatModelIds()`、`storeFetchedChatModels()`，负责从当前 Provider 解析刷新源、去重远端模型 id、写入 `ccg-chat-custom-models:<provider>` 并 dispatch `localStorageChange`。`src/components/chat/composer/ButtonArea.tsx` 在模型 selector 后增加 icon-only 刷新按钮，支持刷新中 spinner 和错误 title，模型下拉 footer 继续展示 loading/error。`src/components/chat/composer/ChatComposer.tsx` 从 active Provider 取 `url`/`apiKey`，点击后调用 `fetch_models`，成功写缓存并刷新模型选项，空结果/保存失败/请求失败均保留已有模型。`src/locales/en.json` / `src/locales/zh.json` 新增刷新文案。`src/utils/chatModels.test.ts`、`src/components/chat/composer/ButtonArea.test.tsx`、`src/components/chat/composer/ChatComposer.render.test.tsx` 增加回归测试。`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/state-management.md`、`.trellis/spec/backend/cross-layer-protocol.md` 同步记录模型刷新契约。
- 本轮验证：RED：`npm test -- src/utils/chatModels.test.ts src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx` 先失败 6 项，分别证明缺少 refresh source/cache helper、刷新按钮、刷新状态和 ChatComposer 接线。GREEN：同命令通过（3 files / 15 tests）；相邻验证 `npm test -- src/utils/chatModels.test.ts src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ChatComposer.test.ts src/components/chat/composer/useCompletions.test.ts` 通过（5 files / 31 tests）；`npm test` 通过（35 files / 289 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 首次失败于测试漏传 `onModelChange`，补齐后通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（110 tests，2 doctests ignored）；IDE `build_project` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面点击模型刷新点测，也未对真实 Provider API 做网络验证。
- 下一步候选：1) 真实 Tauri 桌面点测模型刷新：active provider 有/无 URL+API key、成功返回模型、空列表、401/网络失败、刷新后 selector 是否立即出现新模型；2) 真实 Tauri 桌面点测 MCP live 检测：无 enabled server、stdio 成功/命令不存在、HTTP/SSE online/offline/timeout、provider 切换 stale result；3) 针对历史大会话加载慢继续做性能诊断，优先检查 session list/meta 缓存、消息窗口化首屏、点击会话后的重复解析；4) Git chip 后续可增加 dirty/clean 只读状态，但必须先评估扫描成本，避免拖慢大会话首屏。

## 本轮 PLAN 2026-06-19 chat large history cache reuse

- 目标：优化点击历史大会话后的二次加载速度，优先消除 `useChatStore.loadSession()` 命中历史缓存时仍对完整 `messages` 数组做 O(n) 浅拷贝的问题。
- 功能点 1：确认慢点与对标边界。验证方式：CodeGraph 读取 `useChatStore.loadSession()`、`sessionHistoryCache`、`MessageList` 窗口化路径，并读取 cc-gui 历史加载/索引路径，区分代码中确实存在的问题与记录中声称完成的能力。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts`，构造 5000 条历史消息，断言第二次加载同一 session 复用缓存数组引用且不再调用 `get_unified_session_messages`。
- 功能点 3：实现最小性能改动。验证方式：`sessionHistoryCache` 保存/返回已映射历史数组引用，不再在缓存读写时全量 clone；保留 LRU 刷新和 `lastActiveAt` cache key 失效规则。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md`，记录大会话缓存复用与不可原地 mutation 的约束。
- 功能点 5：质量验证。验证方式：运行定向 store 测试、相邻 Chat navigation/status 测试、`npm test`、`npm run build`、Rust check/test、IDE 构建与空白检查。

## 迭代记录 2026-06-19 chat large history cache reuse

- 上轮实际进展：模型选择器已改为图标化并支持用户手动动态刷新模型，MCP 展开详情已有手动 live 检测，输入框上方状态条已支持任务/子代理/编辑触发式显示和 Git 分支只读显示，右侧状态面板已补运行上下文。上述能力在代码中可见并已通过自动化验证；阻塞仍是真实 Tauri 桌面点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 历史侧有后端索引缓存与前端虚拟列表，避免大会话重复做重活。本项目虽已有最近窗口渲染和 session list 缓存，但 `src/stores/useChatStore.ts` 的 `sessionHistoryCache` 在写入和命中读取时都会 `messages.map({...message})` 全量浅拷贝；几千条历史会话重复点击或切回来时，不再读后端但仍有 O(n) CPU 和内存分配。
- 本轮诊断（超越 cc-gui）：本项目可以保留完整 transcript 的功能语义，同时让普通浏览路径复用已映射消息数组引用。用户痛点是点击大会话后列表和 transcript 迟迟不稳定；去掉缓存命中的重复数组克隆能直接降低二次进入同一历史会话的等待和 GC 抖动。
- 本轮规划：只优化 store 历史缓存读写，不改后端 `get_unified_session_messages`、不引入分页协议、不调整窗口化渲染。优先级高：用户价值高（直接命中“点击历史大会话慢”）、出现频率高（历史切换常用）、成本低（两处缓存 helper）、风险可控（保留 `lastActiveAt` cache key 和 LRU，新增回归测试约束 immutable usage）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增 5000 条历史消息回归测试，断言第二次加载同一 session 不再调用后端且复用第一次映射出的 `messages` 数组引用。`src/stores/useChatStore.ts` 删除缓存读写阶段的全量浅拷贝，`rememberSessionHistory()` 保存已映射数组引用，`getCachedSessionHistory()` 命中后刷新 LRU 并直接返回该引用。`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 已同步大会话缓存复用契约：状态更新继续不可变替换，不允许组件或 store action 原地 mutation 历史消息。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败于新增用例 `reuses cached large history without cloning the message array`，证明当前缓存命中仍返回新数组引用。GREEN：同命令通过（1 file / 48 tests）；相邻验证 `npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatStatusSummary.test.ts` 通过（3 files / 67 tests）；`npm test` 通过（35 files / 290 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（110 tests，2 doctests ignored）。未做真实 Tauri 桌面点击大会话性能点测，后端首读超大历史仍可能受文件解析成本影响。
- 下一步候选：1) 真实 Tauri 桌面点测历史大会话：首次打开、重复点击同一 session、切 A/B 大会话、进入搜索全历史模式的体感耗时；2) 若首次打开仍慢，继续做后端分页或轻量首屏加载：先加载最近 N 条 + 后台补全全文，但需要设计跨层协议；3) 给 session 详情加载加性能埋点或开发态日志，分辨后端 JSONL 解析、前端 map、React commit、状态摘要计算各自耗时；4) 继续补真实桌面点测清单：模型刷新、MCP live 检测、Git 状态条、右侧运行上下文。

## 本轮 PLAN 2026-06-19 chat large history first-paint window

- 目标：优化历史大会话首次打开速度。`loadSession()` 未命中缓存时先加载最近消息窗口用于首屏显示，再后台补齐完整历史并写入缓存，避免首屏等待完整 JSONL 读取结果通过 IPC 和前端全量映射。
- 功能点 1：确认对标与根因边界。验证方式：CodeGraph 读取本项目 `loadSession()` / `MessageList` / provider 历史解析与 cc-gui `MessageList` / HistoryReader，区分已具备的渲染窗口化与仍缺的数据窗口化。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts`，模拟 5000 条完整历史和 120 条窗口历史，断言 window promise resolve 后 store 已显示窗口消息且 pending 清空，full promise resolve 后替换为完整历史并缓存；同时覆盖用户在 full 未返回前发送新消息时旧 full 结果不会覆盖当前 transcript。
- 功能点 3：新增最小跨层命令。验证方式：Rust 新增 `get_unified_session_message_window(providerId, sourcePath, tailLimit)` 和 `session_manager::load_message_window()`，返回 `{messages,startIndex,totalCount,complete}`；Claude/Codex 解析复用现有行级语义，只保留尾部窗口，避免 IPC 传完整历史。
- 功能点 4：前端接入首屏窗口。验证方式：`useChatStore.loadSession()` 先请求窗口并按 `startIndex` 生成稳定 history id，窗口不完整时继续请求 full；full 到达后写入 `sessionHistoryCache` 并替换；缓存命中仍直接复用完整数组。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/backend/cross-layer-protocol.md` 与 `.trellis/spec/frontend/state-management.md` 的大会话首屏窗口契约。
- 功能点 6：质量验证。验证方式：运行定向 store/Rust session tests、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与空白检查。

## 迭代记录 2026-06-19 chat large history first-paint window

- 上轮实际进展：历史大会话二次进入已优化为复用 `sessionHistoryCache` 中的完整 `ChatMessage[]` 引用，不再在缓存命中时做 O(n) 浅拷贝；模型 selector 图标化 + 手动动态刷新、MCP 展开详情 + 手动 live 检测、输入框上方任务/子代理/编辑/Git 触发式状态条、右侧运行上下文均已在代码中存在并通过自动化验证。已知阻塞仍是真实 Tauri 桌面点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/components/MessageList.tsx` 有最近 15 条 + 每次 reveal 30 条的窗口渲染，后端历史 reader/index service 也减少 session list/meta 成本。本项目 `src/components/chat/MessageList.tsx` 已有渲染窗口化，但 `src/stores/useChatStore.ts` 的 `loadSession()` 未命中缓存时仍先等待完整 `get_unified_session_messages` 返回并完成前端全量 map，导致首次点击大会话时首屏被 JSONL 全量解析、IPC 传输和前端映射共同拖慢。
- 本轮诊断（超越 cc-gui）：首屏先显示最近 120 条统一历史消息，后台再补齐完整 transcript，可在保留完整历史、搜索和状态摘要能力的同时降低用户感知等待。用户痛点是“点击历史大会话后列表迟迟不出现”；窗口首屏让最近上下文先可读，full load 只负责补齐旧内容和缓存。
- 本轮规划：只做历史消息数据层首屏窗口，不引入通用分页 UI、不改变搜索全历史入口、不重写 session list。优先级高：用户价值高（直击首次打开慢）、出现频率高（历史切换常用）、成本中等（新增一个 Tauri 命令 + provider tail parser + store 接线）、风险可控（token 防迟到覆盖、完整历史仍后台加载）。
- 本轮完成：`src/types/session.ts` 新增 `UnifiedSessionMessageWindow`。`src-tauri/src/session_manager/mod.rs` 新增 `UnifiedSessionMessageWindow`、`MessageWindowBuilder`、`load_message_window()` 和 tailLimit 1..500 归一化，Gemini 保留 full-load 后裁剪兜底。`src-tauri/src/session_manager/providers/claude.rs` / `codex.rs` 抽出行级 parser 并新增 tail window loader；Codex fallback tool id 改为基于原始解析序号，保证 window 与 full 一致。`src-tauri/src/commands/session_commands.rs` 新增 `get_unified_session_message_window(providerId, sourcePath, tailLimit)`，`src-tauri/src/lib.rs` 注册命令。`src/stores/useChatStore.ts` 的 `loadSession()` 未命中缓存时先请求 120 条窗口并用 `startIndex` 映射稳定 history id，`complete=false` 时后台请求 full、写入完整缓存并替换；窗口阶段和 full 阶段都使用 session-load token 防止迟到响应覆盖用户新 prompt。`src/stores/useChatStore.test.ts` 新增大会话首屏窗口和迟到 full 防护回归。`.trellis/spec/frontend/state-management.md`、`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/backend/cross-layer-protocol.md` 已同步首屏窗口跨层契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败于新增用例未观察到 `get_unified_session_message_window` 调用和窗口首屏状态。GREEN：同命令通过（1 file / 50 tests）；相邻验证 `npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatStatusSummary.test.ts` 通过（3 files / 69 tests）；Rust 定向 `cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::claude -- --nocapture` 通过（5 tests），`cargo test --manifest-path src-tauri/Cargo.toml session_manager::providers::codex -- --nocapture` 通过（11 tests）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm test` 通过（35 files / 292 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（112 tests，2 doctests ignored）；`npm run build` 通过；IDE `build_project` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面点击大会话性能点测，因此首次打开的体感耗时改善仍需桌面态确认。
- 下一步候选：1) 真实 Tauri 桌面点测历史大会话：首次打开、full 补齐前后滚动/reveal、重复点击缓存命中、A/B 大会话切换、搜索全历史模式；2) 给历史加载加开发态性能分段埋点，拆分后端 JSONL 解析、IPC 序列化、前端 map、React commit、状态摘要计算耗时；3) 继续检查 MCP 展开/模型刷新/输入区状态条/Git chip 的真实桌面交互，覆盖用户反馈的“点击 MCP 无法展开”“动态模型列表”“状态栏触发显示隐藏”；4) 若首屏窗口仍不够快，再设计真正的后端分页/按需 reveal 协议，但需单独评估搜索、锚点、tool_result 查找和状态摘要的完整性。

## 本轮 PLAN 2026-06-19 chat mcp details controlled expansion

- 目标：修复 Chat 右侧 MCP 区域“点击无法展开查看”的可靠性问题，把当前依赖原生 `<details>` 的展开交互改为显式受控按钮，确保用户点击 MCP 行能看到 server 名称、transport/config type、enabled/disabled 和手动 live 检测入口。
- 功能点 1：确认根因与对标方式。验证方式：CodeGraph 读取本项目 `StatusPanel` / `StatusPanel.test.tsx` / `ChatPage` MCP 链路，并读取 cc-gui `ServerCard` 的受控展开模式，区分静态渲染存在与真实点击可靠性。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言普通 MCP summary 初始渲染为显式 `button`、带 `aria-expanded="false"`，且不把 server 详情直接铺在初始 DOM；loading/error/checking/live result 状态应自动展开以保留诊断。
- 功能点 3：实现最小修复。验证方式：`StatusPanel` 用 `useState` 管理 MCP details 展开状态，用 `button.status-mcp-toggle` 替代 `<details>/<summary>`，在 loading/error/checking/已有 live result 时自动展开；检测按钮阻止冒泡，避免点击 live check 时误折叠。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 的 MCP 展开契约，明确 Chat MCP details 必须是显式受控交互。
- 功能点 5：质量验证。验证方式：运行定向 `StatusPanel` / MCP 工具测试、前端全量测试、前端构建、Rust check、IDE 构建与空白检查；如能启动前端，再做浏览器/桌面点击 smoke。

## 迭代记录 2026-06-19 chat mcp details controlled expansion

- 上轮实际进展：历史大会话首屏窗口、模型 selector 图标化与手动动态刷新、MCP 手动 live 检测、输入框上方任务/子代理/编辑/Git 触发式状态条、右侧运行上下文都已在代码中存在并通过自动化验证；阻塞仍是真实 Tauri 桌面点测不足。用户继续反馈“点击 MCP 无法展开查看”，本轮复查确认这不是能力完全缺失，而是 `StatusPanel` MCP 详情依赖原生 `<details>`，测试仅覆盖静态 HTML，未覆盖显式点击入口和受控展开状态。`C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 MCP server card 使用受控 `isExpanded` 和整行 header click，展开内容由 React 条件渲染；本项目虽然在 DOM 中有 MCP server 明细，但普通状态下是原生 `<details>` 子树，且没有稳定的 `button` / `aria-expanded` 可测入口。固定右侧面板与原生 disclosure 的组合会让“代码里有详情”不等于“真实点击可靠展开”。
- 本轮诊断（超越 cc-gui）：本项目保留普通状态下的轻量 collapsed summary，只在用户点击后渲染 server 明细；loading、error、checking 或已有 live result 会自动展开，避免诊断信息被折叠隐藏。这样既减少默认右侧噪音，又让异常和连通性结果立即可见。
- 本轮规划：只修复 MCP details 展开可靠性，不扩大到小屏 composer 状态条、不改 `check_mcp_status` 后端、不增加自动检测。优先级高：用户价值高（直接解决用户点不开）、出现频率中高（MCP 配置和发送前检查常用）、实现成本低（单组件受控状态 + 样式选择器 + 测试）、风险低（不改变数据来源和后端命令）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 新增/调整 MCP 展开回归：普通 MCP summary 必须渲染 `status-mcp-toggle`、`aria-expanded="false"`，初始 DOM 不铺开 server 明细；loading/error/checking/live result 自动 `aria-expanded="true"` 并渲染 details。`src/components/chat/StatusPanel.tsx` 用 `mcpExpanded` 本地状态替代原生 `<details>`，summary 改为整行 `button.status-mcp-toggle`，详情区条件渲染；loading/error/checking/hasResults 自动展开，live check 按钮阻止冒泡并复用现有 handler。`src/styles/toolBlocks.css` 将 chevron 旋转从 `[open]` 选择器改为 `.status-mcp-summary-expanded`。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已记录 Chat MCP details 必须使用显式受控按钮与本地 UI state。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 3 项，失败点为缺少 `status-mcp-toggle`，证明旧实现没有显式受控展开入口。GREEN：同命令通过（1 file / 12 tests）；相邻验证 `npm test -- src/components/chat/StatusPanel.test.tsx src/utils/chatMcpStatus.test.ts src/utils/chatMcpConnectivity.test.ts src/components/chat/ChatInputStatusTabs.test.tsx` 通过（4 files / 22 tests）；`npm test` 通过（35 files / 292 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run build` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（112 tests，2 doctests ignored）；IDE `build_project` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，前者仅有既有 LF/CRLF 提示。`npm run build` 产生的未跟踪 `out/` 已确认位于工作区内并删除。未做真实 Tauri 桌面点击 MCP 展开点测，原因是本轮未启动桌面运行态；真实 WebView 下的点击仍需下一步 smoke 确认。
- 下一步候选：1) 真实 Tauri 桌面点测 MCP details：右侧可见窗口点击展开/收起、点击 live check 不折叠、provider 切换后 stale result 清空、loading/error 自动展开；2) 检查小屏或 `xl` 以下 Chat UI 是否需要把 MCP summary 入口放入 composer 状态条，否则右侧状态面板隐藏时用户仍无法查看 MCP；3) 给历史大会话首屏窗口加开发态性能分段埋点，拆分后端 JSONL、IPC、前端 map、React commit 和状态摘要耗时；4) 继续真实桌面点测模型刷新、Git chip、输入区任务/子代理/编辑展开项。

## 本轮 PLAN 2026-06-19 chat composer mcp status strip entry

- 目标：在 Chat 输入区状态条补 MCP 触发式入口，让 `xl` 以下右侧状态面板隐藏时，用户仍能查看 MCP 配置摘要和 server 明细。
- 功能点 1：确认差距与数据来源。验证方式：CodeGraph 读取 `ChatInputStatusTabs` / `ChatPage` / `chatMcpStatus` / `StatusPanel`，确认当前 MCP 只传给右侧面板，输入区状态条没有 MCP tab。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，断言有 MCP server 时显示 MCP chip；展开后显示 server 名称、transport、enabled/disabled、enabled/total；无 server 且无 loading/error 时保持触发式隐藏。
- 功能点 3：实现最小前端入口。验证方式：`ChatInputStatusTabs` 增加 `mcpStatus` 可选 prop 和 `mcp` tab，本地 state 管理展开；只展示配置可用性，不触发 live check；`ChatPage` 传入现有 `mcpStatus`。
- 功能点 4：同步 i18n 与 Trellis 规范。验证方式：新增中英文输入区 MCP 文案，并更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md`，记录小屏 composer 状态条承载 MCP 配置入口。
- 功能点 5：质量验证。验证方式：运行定向 `ChatInputStatusTabs` / `StatusPanel` / MCP utils 测试、前端全量测试、前端构建、Rust check/test、IDE 构建与空白检查；如未做真实桌面点测，明确标注。

## 迭代记录 2026-06-19 chat composer mcp status strip entry

- 上轮实际进展：历史大会话首屏窗口、缓存复用、模型 selector 图标化和手动动态刷新、MCP 右侧 details 受控展开与手动 live 检测、输入区任务/子代理/编辑/Git 触发式状态条、右侧运行上下文都已在代码中存在并通过自动化验证；阻塞仍是真实 Tauri 桌面视觉/点击点测不足。记录中提到的小屏 MCP 入口在本轮开始前确实不存在：`ChatPage` 只把 `mcpStatus` 传给右侧 `StatusPanel`，`ChatInputStatusTabs` 只支持 `tasks/subagents/edits` 三类可展开 tab，Git 是静态 chip。
- 本轮诊断（补齐 cc-gui）：cc-gui 在 composer 附近提供任务/文件/状态可见性；本项目右侧面板在 `xl` 以下隐藏后，用户无法从输入区查看 MCP server 配置明细。已有 `buildChatMcpAvailabilitySummary()` 能提供 server id/name/enabled/transport，缺口是输入区没有消费这份数据。
- 本轮诊断（超越 cc-gui）：输入区 MCP 入口保持触发式：有配置、loading 或 error 才出现；展开只展示配置可用性和 enabled/disabled，不运行 `check_mcp_status`，避免小屏查看详情时隐式启动 stdio MCP 进程或网络检测。
- 本轮规划：只做 `ChatInputStatusTabs` MCP tab 与 `ChatPage` 接线，不改后端、不新增 store、不把 live check 挪到输入区。优先级高：用户价值高（回应“小屏/右侧隐藏时 MCP 看不到、点击不可查看”）、出现频率中高（发送前常看 MCP 可用状态）、实现成本低（复用现有 summary）、风险低（纯前端展示）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增 MCP 状态条回归测试，覆盖有 server 时显示 `chat-input-status-tab-mcp`、默认展开时展示 server name/transport/enabled/disabled、空 idle MCP 配置不渲染占位。`src/components/chat/ChatInputStatusTabs.tsx` 新增 `mcpStatus` prop、`mcp` tab、MCP server 明细面板和紧凑 `enabled / total` 计数；展开状态仍由组件本地 `openTab` 管理。`src/pages/ChatPage.tsx` 把已存在的 `mcpStatus` 传给输入区状态条。`src/locales/en.json` / `src/locales/zh.json` 增加 MCP server 溢出文案。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已记录 composer MCP 入口契约。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 2 项，失败点为旧组件返回空字符串，缺少 `chat-input-status-tab-mcp` 与 `chat-input-status-mcp-server`。GREEN：同命令通过（1 file / 8 tests）；相邻验证 `npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/utils/chatMcpStatus.test.ts src/utils/chatMcpConnectivity.test.ts` 通过（4 files / 25 tests）；`npm test` 通过（35 files / 295 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run build` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（112 tests，2 doctests ignored）；IDE `build_project` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，其中 `git diff --check` 仅输出既有 LF/CRLF 转换提示。未做真实 Tauri 桌面小屏点击点测，也未做真实 MCP server 配置切换视觉点测。
- 下一步候选：1) 真实 Tauri 桌面点测小屏/窄宽度：右侧状态面板隐藏时 MCP chip 出现、点击展开/收起、loading/error/空配置边界；2) 真实 Tauri 桌面点测右侧 MCP live 检测与输入区只读 MCP 详情的分工，确认用户不会把配置可用性误解为在线状态；3) 给历史大会话首屏窗口加开发态性能分段埋点，拆分后端 JSONL、IPC、前端 map、React commit 和状态摘要耗时；4) 继续真实桌面点测模型刷新、Git chip、输入区任务/子代理/编辑展开项。

## 本轮 PLAN 2026-06-19 chat session load performance snapshot

- 目标：补齐历史大会话加载速度的可见诊断信息。记录最近一次历史 session 加载的 cache/window/full/map 阶段耗时，并在右侧状态面板展示，帮助判断“点击大会话慢”卡在缓存未命中、首屏窗口读取、前端映射还是后台 full 补齐。
- 功能点 1：确认差距与边界。验证方式：CodeGraph 读取 `useChatStore.loadSession()`、`StatusPanel`、`ChatPage` 和对标 cc-gui `MessageList` / `StatusPanel`，确认本轮只做性能诊断展示，不改变加载协议、不自动触发重新加载。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts` 覆盖 window/full/cache 指标；扩展 `src/components/chat/StatusPanel.test.tsx` 断言指标区渲染阶段耗时和 cache hit。
- 功能点 3：实现最小数据层。验证方式：`useChatStore` 新增最近一次 `sessionLoadMetrics`，在 cache hit、window resolve/map、full resolve/map、失败/完成路径按 token 保护更新；`startNewSession` / `clear` / `send` 清理陈旧诊断。
- 功能点 4：实现最小展示层。验证方式：`ChatPage` 将指标传给 `StatusPanel`，状态面板以只读 compact 模块展示 cache、window、full、message count 和 completed/error 状态。
- 功能点 5：同步 i18n 与 Trellis 规范。验证方式：新增中英文文案，并更新 `.trellis/spec/frontend/state-management.md` / `.trellis/spec/frontend/component-guidelines.md` 的历史加载诊断契约。
- 功能点 6：质量验证。验证方式：运行定向 store/status 测试、相邻测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、必要时 `cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与空白检查；如未做真实 Tauri 桌面体感点测，最终明确标注。

## 迭代记录 2026-06-19 chat session load performance snapshot

- 上轮实际进展：历史大会话首屏窗口、缓存复用、模型 selector 图标化和手动动态刷新、MCP 右侧 details 受控展开与手动 live 检测、输入区任务/子代理/编辑/Git/MCP 触发式状态条、右侧运行上下文都已在代码中存在并通过自动化验证。已知阻塞仍是真实 Tauri 桌面视觉/点击点测不足。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：本项目已有 `get_unified_session_message_window` 首屏窗口和 `sessionHistoryCache` 缓存复用，但用户反馈“点击历史大会话加载到列表特别慢”仍缺可见证据。当前 UI 无法区分慢在 cache miss、窗口读取、前端 map、后台 full 读取还是 full map；因此每次优化后仍只能靠体感判断。
- 本轮诊断（超越 cc-gui）：把最近一次历史加载分段耗时放进右侧状态面板，能让用户和开发者直接看到“首屏窗口多少条 / 总计多少条 / window load / map / full load / full map / 总耗时”。这不是单纯美化，而是把大会话慢的问题变成可定位、可回归的诊断面板。
- 本轮规划：只做只读性能快照，不改后端协议、不加日志、不自动重新加载历史。优先级高：用户价值高（直击大会话慢且帮助后续定位）、出现频率中高（历史会话切换常用）、实现成本低（纯前端 store + 状态面板）、风险低（指标受 session-load token 保护，不改变 transcript 数据）。
- 本轮完成：`src/types/session.ts` 新增 `ChatSessionLoadMetrics`。`src/stores/useChatStore.ts` 新增 `lastSessionLoadMetrics`，在 `loadSession()` 的 initial/cache/window/full/error 路径记录 cacheHit、status、message counts、window/full read/map ms、elapsed ms，并在 send/startNewSession/clear/provider switch 清理陈旧指标；所有异步写入继续受 `latestSessionLoadToken` 保护。`src/pages/ChatPage.tsx` 将指标传给 `StatusPanel`。`src/components/chat/StatusPanel.tsx` 增加 `status-session-load-metrics` 只读模块，展示 cache hit 或 window/full 分段耗时与错误。`src/locales/en.json` / `src/locales/zh.json` 新增历史加载诊断文案。`src/stores/useChatStore.test.ts` 覆盖 cache hit 指标和 window/full 分段耗时，`src/components/chat/StatusPanel.test.tsx` 覆盖状态面板指标渲染。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已记录该只读诊断契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts src/components/chat/StatusPanel.test.tsx` 先失败 4 项，失败点为 `lastSessionLoadMetrics` 为 `null` 且状态面板缺少 `status-session-load-metrics`。GREEN：同命令通过（2 files / 66 tests）；相邻验证 `npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatStatusSummary.test.ts src/components/chat/StatusPanel.test.tsx` 通过（4 files / 85 tests）；`npm test` 通过（35 files / 299 tests，仅 Browserslist/caniuse-lite 过期提示）；`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（112 tests，2 doctests ignored）；IDE `build_project` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，其中 `git diff --check` 仅输出既有 LF/CRLF 转换提示。`npm run build` 生成的未跟踪 `out/` 已确认位于工作区内并删除。未做真实 Tauri 桌面点击大会话体感点测。
- 下一步候选：1) 真实 Tauri 桌面点测 1k/5k/10k 历史会话：首次打开、cache hit 重复点击、A/B 大会话切换、full 补齐后滚动和搜索全历史；2) 若指标显示 window load 仍慢，继续做 provider 级 tail reader 优化或真正分页/reveal 协议；3) 若指标显示 full load/map 慢但首屏可用，给状态面板增加“full background still loading”的更明确提示；4) 继续真实桌面点测模型刷新、MCP live 检测、Git chip、输入区任务/子代理/编辑/MCP 展开项。

## 本轮 PLAN 2026-06-19 chat input status full-history trigger restore

- 目标：修复长历史/折叠窗口下输入区任务、子代理、编辑状态入口“代码存在但用户看不到”的问题，同时保留大会话首屏窗口化性能优化。
- 功能点 1：确认差距与边界。验证方式：复查 `ChatPage` 当前只用可见尾部 `statusMessages` 构建 `statusSummary`，因此早期工具/编辑记录会让输入区触发按钮消失；对照 cc-gui 输入区与状态可见性，确认本轮只修输入区状态条，不重写工具块或后端历史协议。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/utils/chatStatusSummary.test.ts`，断言输入区状态摘要能从“首屏可见摘要 + 空闲补全的全量摘要”合并出任务、子代理和编辑入口数据。
- 功能点 3：实现最小前端修复。验证方式：新增共享合并 helper；`ChatPage` 保持右侧状态面板使用首屏可见摘要，另在浏览器 idle 阶段构建完整摘要并仅传给 `ChatInputStatusTabs`，避免首屏同步扫描全量历史。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，记录输入区状态条的“首屏摘要 + idle 完整摘要”契约。
- 功能点 5：质量验证。验证方式：运行定向 status summary / input tabs / ChatPage 相邻测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、必要时 `cargo test --manifest-path src-tauri/Cargo.toml`、IDE 构建与空白检查；未做真实 Tauri 桌面点测需明确标注。

## 迭代记录 2026-06-19 chat input status full-history trigger restore

- 上轮实际进展：记录中声称历史大会话首屏窗口、缓存复用、模型 selector 图标化/动态刷新、MCP 右侧 details 与输入区 MCP tab、输入区任务/子代理/编辑/Git 触发式状态条、右侧运行上下文都已存在。代码复查确认这些能力确实在 `ChatPage`、`ChatInputStatusTabs`、`StatusPanel`、`chatMcpStatus`、`chatWorkspaceStatus` 等文件中存在；但输入区任务/子代理/编辑的触发条件只依赖 `ChatPage` 为首屏性能裁剪后的可见尾部 `statusSummary`，因此长历史里早期工具/编辑记录会被折叠窗口隐藏，用户看到的效果就是“功能依旧没有”。已知阻塞仍是真实 Tauri 桌面视觉/点击点测不足。本轮复查确认 `C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 可读，用户原始对标路径 `C:/guodevelop/jetbrains-cc-gui` 不存在。
- 本轮诊断（补齐 cc-gui）：cc-gui 的输入区附近不把历史活动入口和首屏渲染窗口强绑定。本项目在大会话优化后，`StatusPanel` 和输入区状态条共享同一个可见尾部摘要，导致早期 `Task` / `Agent` / `Edit` 无法触发输入区按钮。Git 分支显示链路代码存在：后端 `chat_workspace_status` 能从 `.git/HEAD` 和 `gitdir:` 文件读取分支，前端只有在 `currentCwd` 已解析到 Git 项目且返回分支时显示；初始空会话没有 cwd 时按触发式规则隐藏。
- 本轮诊断（超越 cc-gui）：输入区状态条既要能从完整历史恢复“任务 / 子代理 / 编辑”入口，又不能把全量 `buildChatStatusSummary(messages)` 放回首屏同步路径。否则会抵消大会话首屏优化。本轮采用“可见尾部摘要立即渲染 + idle 完整摘要补齐输入区触发”的折中：右侧状态面板保持轻量首屏摘要，输入区在浏览器空闲后获得全量历史中的任务/子代理/编辑入口。
- 本轮规划：只修输入区状态条的长历史触发缺口，不改后端历史协议、不改 MCP live 检测、不改变 Git chip 的“有 Git 才显示”规则。优先级高：用户价值高（直接回应任务/子代理/编辑入口缺失）、出现频率中高（长历史/折叠窗口常见）、实现成本低（纯前端 helper + page-local idle state）、风险可控（不阻塞首屏、不改变右侧状态面板数据）。
- 本轮完成：`src/utils/chatStatusSummary.ts` 新增 `mergeChatInputStatusSummary()`，把首屏可见摘要与空闲阶段完整摘要合并给输入区状态条使用，并保留可见窗口中的 pending active tool 优先级。`src/pages/ChatPage.tsx` 新增 page-local `completeStatusSummaryState`，在非搜索、非空 transcript 下通过 `requestIdleCallback`（无支持时 fallback `setTimeout`）构建完整 `buildChatStatusSummary(messages)`，只将合并结果传给 `ChatInputStatusTabs`；`StatusPanel` 仍使用轻量 `statusSummary`。`src/utils/chatStatusSummary.test.ts` 新增回归测试，覆盖可见窗口没有工具但完整历史有 Task/Edit 时，输入区摘要仍能恢复任务、子代理和编辑入口数据。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步该契约。
- 本轮验证：RED：`npm test -- src/utils/chatStatusSummary.test.ts` 先失败 1 项，失败点为 `mergeChatInputStatusSummary is not a function`。GREEN：同命令通过（1 file / 7 tests）；`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 通过（1 file / 8 tests）；相邻验证 `npm test -- src/utils/chatStatusSummary.test.ts src/components/chat/ChatInputStatusTabs.test.tsx src/utils/chatUiBehavior.test.ts src/utils/chatWorkspaceStatus.test.ts` 通过（4 files / 32 tests）；`npm run build` 通过；`npm test` 通过（35 files / 300 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`cargo test --manifest-path src-tauri/Cargo.toml` 通过（112 tests，2 doctests ignored）；IDE `build_project` 通过；`git diff --check` 与 `git diff --cached --check` 退出 0，其中 `git diff --check` 仅输出既有 LF/CRLF 转换提示。`npm run build` 生成的未跟踪 `out/` 已确认位于工作区内并删除。未做真实 Tauri 桌面长历史点击、Git chip、MCP 展开或输入区状态条视觉点测。
- 下一步候选：1) 真实 Tauri 桌面点测：打开含早期 Task/Agent/Edit 的大会话，确认首屏后输入区状态条在 idle 补齐后出现任务/子代理/编辑，点击可展开；2) 点测 Git chip：选中带 `projectDir` 的历史会话或新会话 cwd 后显示当前分支，非 Git cwd 不显示；3) 点测 MCP：右侧 details 展开/收起、live check 不折叠，小屏输入区 MCP 只读 tab 可展开；4) 如果用户仍反馈大会话慢，用 `lastSessionLoadMetrics` 的分段数据决定是继续优化 provider tail reader，还是把完整摘要构建移到 worker/增量索引。

## 本轮 PLAN 2026-06-19 chat claude provider glyph parity

- 目标：修正 Chat 输入区 provider 切换按钮的 Claude 图标，替换上一轮手写近似 placeholder，按 cc-gui 的 `@lobehub/icons@5.8.0` Claude glyph 形态渲染。
- 功能点 1：确认真实对标与根因。验证方式：读取 cc-gui `ProviderModelIcon.tsx` / `ProviderSelect.tsx`，确认 Claude 使用 `ClaudeColor` / `ClaudeMono`；读取本项目 `ButtonArea.tsx`，确认当前旧 path 不是 cc-gui glyph。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/components/chat/composer/ButtonArea.test.tsx`，断言 Claude provider button 使用 cc-gui Claude glyph 标记与 path，并且不包含旧 placeholder path。
- 功能点 3：实现最小展示层修复。验证方式：只替换 `ProviderBrandIcon` 的 Claude SVG path/fill，保留 `data-chat-provider-icon`、Codex 图标、provider 状态和模型刷新逻辑不变。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 Claude provider selector 不得使用 generic/starburst placeholder。
- 功能点 5：质量验证。验证方式：运行定向 `ButtonArea` 测试、相邻 composer 测试、全量前端测试、前端构建、Rust check、IDE 构建与空白检查；未做真实 Tauri 桌面视觉点测需明确标注。

## 迭代记录 2026-06-19 chat claude provider glyph parity

- 上轮实际进展：记录中声称 provider selector 已从通用 Terminal 改成 Claude Code / Codex 专属图标；代码复查确认 `ButtonArea.tsx` 确实已有 `ProviderBrandIcon`、compact provider trigger 和 option 图标，但 Claude 分支使用的是上一轮手写近似 path，不是 cc-gui 实际使用的 `@lobehub/icons` Claude glyph。`C:/guodevelop/ccg-switch` 与 `C:/guodevelop/demo/jetbrains-cc-gui` 可读，用户原始 `C:/guodevelop/jetbrains-cc-gui` 仍不存在。本轮无新阻塞；真实 Tauri 桌面视觉点测仍未完成。
- 本轮诊断（补齐 cc-gui）：cc-gui `ProviderModelIcon.tsx` 将 `claude` 映射到 `@lobehub/icons/es/Claude/components/Color` / `Mono`，`ProviderSelect.tsx` 在 compact trigger 与 dropdown option 中复用该图标。本项目虽然已区分 Claude/Codex，但 Claude 图标 path 是泛化 starburst placeholder，用户反馈“claude 图标不对”属实。
- 本轮诊断（超越 cc-gui）：本项目不新增 `@lobehub/icons` 依赖，而是读取 cc-gui lockfile 对应的 `@lobehub/icons@5.8.0` tarball 源码，仅内联 Claude glyph path。这样能达到视觉对齐，同时避免扩大前端 bundle 与依赖维护面。
- 本轮规划：只修 provider selector 的 Claude 图标形态，不改 provider 状态、模型动态刷新、发送链路、MCP 或历史加载。优先级高：用户价值高（provider 视觉锚点错误会影响每次发送前确认）、出现频率高（输入区常驻）、成本低（单组件 path 替换 + 测试）、风险低（纯展示）。
- 本轮完成：`src/components/chat/composer/ButtonArea.test.tsx` 扩展 provider icon 回归，断言 Claude provider button 必须包含 `data-chat-provider-icon-glyph="claude-lobehub"` 和 cc-gui/LobeHub Claude path 开头，并不得包含旧 `M11.1...` placeholder path。`src/components/chat/composer/ButtonArea.tsx` 将 Claude SVG 替换为 `@lobehub/icons@5.8.0` Claude glyph path，colored 状态使用 `#D97757`，保留原有 `data-chat-provider-icon="claude"` 与 Codex 图标不变。`.trellis/spec/frontend/component-guidelines.md` 补充 provider selector 规范：Claude icon 必须匹配 cc-gui/LobeHub glyph，不得用 generic starburst/placeholder。
- 本轮验证：RED：`npm test -- src/components/chat/composer/ButtonArea.test.tsx` 先失败 1 项，失败点为缺少 `data-chat-provider-icon-glyph="claude-lobehub"` 且仍输出旧 `M11.1...` path。GREEN：同命令通过（1 file / 6 tests）。相邻验证 `npm test -- src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ChatComposer.test.ts src/utils/chatModels.test.ts` 通过（4 files / 24 tests）；`npm test` 通过（35 files / 303 tests，仅 Browserslist/caniuse-lite 过期提示）；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run build` 通过；IDE `build_project` 通过；`git diff --check` 退出 0 但输出既有 LF/CRLF 提示，`git diff --cached --check` 退出 0。未做真实 Tauri 桌面视觉点测。
- 下一步候选：1) 真实 Tauri 桌面点测 provider selector：Claude/Codex trigger 图标、dropdown 图标+label、暗色主题、disabled/loading 状态；2) 若仍希望完全复用 cc-gui 图标体系，再单独评估引入本地 provider/model 图标组件或轻量图标资源文件，但需先评估依赖体积和许可；3) 继续真实桌面点测 MCP details/live check、小屏 MCP tab、模型刷新、Git chip、任务/子代理/编辑触发式状态条；4) 若用户继续反馈大会话慢，用 `lastSessionLoadMetrics` 分段数据决定后续优化点。

## 本轮 PLAN 2026-06-19 chat input layout density and status dedupe

- 目标：收口 Chat 输入区的信息架构和基础排版密度，优先解决用户反馈的任务列表重复、模型/Provider 图标不对齐、输入区工具栏拥挤等高频低成本问题。
- 功能点 1：确认真实差距。验证方式：基于 `ChatInputStatusTabs`、`SelectorDropdown`、`ModelIcon`、`ButtonArea` 和 cc-gui selector 代码，区分任务/子代理重复与纯展示错位。
- 功能点 2：补 RED 测试。验证方式：扩展 `ChatInputStatusTabs.test.tsx`，断言 tasks panel 不再重复展示 agent/subagent；扩展 `ButtonArea.test.tsx`，断言 selector trigger/option/checkmark 和 model icon 使用稳定 icon box 对齐契约。
- 功能点 3：实现最小交互与展示修复。验证方式：`ChatInputStatusTabs` 将非 agent 工具作为任务流，agent 专属进入子代理；`SelectorDropdown` 统一 trigger/option/check icon box；`ModelIcon` 固定外层尺寸和 line-height；输入区 toolbar 分成可换行选择器组与固定动作组。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` / `.trellis/spec/frontend/state-management.md`，记录 status strip 任务/子代理分工与 selector icon box 契约。
- 功能点 5：质量验证。验证方式：运行定向 ChatInputStatusTabs/ButtonArea 测试、相邻 composer/status 测试、全量前端测试、前端构建、Rust check/test、IDE 构建与空白检查；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat input layout density and status dedupe

- 上轮实际进展：记录中声称 Claude provider 图标已按 cc-gui/LobeHub glyph 修正；代码复查确认 `ButtonArea.tsx` 已有 `data-chat-provider-icon-glyph="claude-lobehub"` 和对应 path，`ButtonArea.test.tsx` 有回归覆盖。记录中也显示模型动态刷新、MCP details/live check、Git/任务/子代理/编辑/MCP 输入区状态条、运行上下文和历史加载性能指标已在代码中存在；本轮不回滚这些既有改动。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。
- 本轮诊断（补齐 cc-gui）：cc-gui selector 使用固定 compact 图标入口和图标+label 的 option 行。本项目 `SelectorDropdown` 此前把 trigger 图标直接插入按钮、option 图标用 `mt-0.5` 裸包裹、checkmark 单独偏移；`ModelIcon` 也只输出裸 lucide 图标，模型/Provider 图标在 compact toolbar 中容易出现基线和外框不一致。`ChatInputStatusTabs` 的 tasks 直接使用完整 `toolTimeline`，而 subagents 又从同一 timeline/`agentTools` 提取 agent，导致同一 agent run 同时出现在任务和子代理列表。
- 本轮诊断（超越 cc-gui）：任务和子代理应是两个不同队列：任务表示 Bash/Edit/Read/Search 等非 agent 工具流，子代理表示 agent/subagent 执行流；否则用户会把同一条 agent run 误解为两个待处理项。输入区 toolbar 也需要把 selectors 与主动作区分组，保证窄宽度下模型名/刷新/推理控制先换行，而增强/发送/停止不被挤出。
- 本轮规划：只做展示层和派生层收口，不改后端、store、发送链路、模型刷新协议或 MCP live check。优先级高：用户价值高（减少重复入口、修复图标错位、降低输入区拥挤）、出现频率高（每次 Chat 输入都可见）、实现成本低（3 个组件和 2 个测试文件）、风险低（纯前端派生与 class/布局调整）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.tsx` 新增 `taskTools = toolTimeline.filter(type !== 'agent')`，tasks tab/panel/progress/spinner 只统计非 agent 工具，subagents tab 继续使用 `agentTools`。`src/components/chat/ChatInputStatusTabs.test.tsx` 增加回归，断言 tasks panel 不再包含 `frontend-reviewer` / agent model detail。`src/components/chat/composer/SelectorDropdown.tsx` 为 trigger、option、checkmark 增加稳定 icon box class。`src/components/chat/composer/ModelIcon.tsx` 增加 `chat-model-icon-box`、固定 width/height 和 `leading-none`。`src/components/chat/composer/ButtonArea.tsx` 将底部 toolbar 改为左侧 flexible selector group + 右侧固定动作组。`src/components/chat/composer/ButtonArea.test.tsx` 覆盖 trigger icon box 与 model icon box。`.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/frontend/state-management.md` 已同步任务/子代理分工、selector icon box 与 composer toolbar 分组契约。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 先失败 3 项，失败点分别为 tasks panel 仍包含 `Review composer status strip`、缺少 `chat-model-icon-box`、provider trigger 缺少 `selector-dropdown-trigger-icon`。GREEN：同命令通过（2 files / 14 tests）。相邻验证 `npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ChatComposer.test.ts src/utils/chatStatusSummary.test.ts src/utils/chatModels.test.ts` 通过（6 files / 39 tests）。全量验证通过：`npm test`（35 files / 303 tests，只有 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 和 `git diff --cached --check` 均 exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。`npm run build` / IDE 构建生成的未跟踪 `out/` 已确认在工作区内并删除。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测输入区：窄宽度 toolbar 换行、Provider/Model/Mode/Reasoning 下拉图标对齐、发送/停止按钮是否保持可触达；2) 点测长历史会话下任务/子代理/编辑状态条：idle 补齐后是否出现、tasks 是否不再重复 agent、subagents 是否可展开；3) 继续排查页面元素重复：右侧 `StatusPanel` 与输入区 strip 的信息分工是否需要进一步压缩文案或只保留图标+count；4) 若大会话仍体感卡顿，基于 `lastSessionLoadMetrics` 决定是否把完整摘要构建移到 worker/增量索引，或继续优化后端 tail reader。

## 本轮 PLAN 2026-06-19 chat status strip compact quick entries

- 目标：进一步降低输入区状态条的信息重复感，把 tasks/subagents/edits/MCP 从“迷你详情按钮”收口为“快捷入口 chip”：图标 + 短 label + count pill + 完整 aria-label，详情仍由展开面板和右侧 `StatusPanel` 承担。
- 功能点 1：确认差距。验证方式：CodeGraph 读取 `ChatInputStatusTabs` 与 `StatusPanel`，确认输入区状态条和右侧面板当前都有任务/子代理/编辑/MCP 信息，状态条应只保留快速摘要。
- 功能点 2：补 RED 测试。验证方式：扩展 `ChatInputStatusTabs.test.tsx`，断言 tab 按钮渲染 `chat-input-status-count-pill`、`aria-label="label stat"`，并且 label 具备小屏隐藏/大屏显示 class。
- 功能点 3：实现最小展示层优化。验证方式：`renderTabButton()` 改为 compact quick-entry 结构，stat 进入 pill，label 用 `hidden sm:inline`，按钮加 `title` / `aria-label`；不改变 openTab、panel、summary 派生或点击逻辑。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 composer strip 是快速入口，完整诊断归 `StatusPanel`。
- 功能点 5：质量验证。验证方式：运行定向 `ChatInputStatusTabs` 测试、相邻 status/composer 测试、全量前端测试、前端构建、Rust check/test、IDE 构建和空白检查；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat status strip compact quick entries

- 上轮实际进展：上一轮已修任务/子代理重复、selector/model 图标对齐和 composer toolbar 左右分组；代码复查确认 `ChatInputStatusTabs` 已按非 agent tools / `agentTools` 拆分，`SelectorDropdown` / `ModelIcon` 已有固定 icon box，`ButtonArea` 已有 flexible selector group。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成；本轮继续在纯前端展示层收口，不回滚既有改动。
- 本轮诊断（补齐 cc-gui）：cc-gui 输入区附近更像 compact quick control，完整诊断不塞进 collapsed composer 区。本项目状态条按钮仍显示 `icon + label + stat`，label/stat 在小宽度下占用输入区横向空间；同时右侧 `StatusPanel` 已经展示 runtime、MCP、工具、编辑、历史加载等完整详情，collapsed strip 不应重复承担详情阅读职责。
- 本轮诊断（超越 cc-gui）：把状态条 collapsed tabs 改成 quick-entry chip 可以降低页面元素重复感：小屏优先保留 icon 和 count pill，完整 label 通过 `aria-label` / tooltip 保留，可访问性不丢；用户要看细节时再展开 inline panel 或看右侧 `StatusPanel`。
- 本轮规划：只改 `ChatInputStatusTabs.renderTabButton()` 的 collapsed button 结构，不改 open state、panel 内容、summary 派生、MCP live check、Git chip 或右侧状态面板。优先级高：用户价值中高（直接缓解输入区拥挤和重复感）、出现频率高（composer 常驻）、成本低（单组件+测试）、风险低（纯 markup/class/aria）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增回归断言，要求 status tab 渲染 `chat-input-status-count-pill`、`chat-input-status-tab-label hidden sm:inline`、完整 `aria-label` 与 `title`。`src/components/chat/ChatInputStatusTabs.tsx` 将 tab 按钮改为 compact quick-entry：按钮增加完整 `aria-label/title`，视觉 label 在小屏隐藏、`sm` 以上显示，stat 进入 rounded count pill，spinner 保持在 pending 时显示。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已记录 composer strip 是快速入口，完整诊断留给展开面板和右侧 `StatusPanel`。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 1 项，失败点为缺少 `chat-input-status-count-pill`。GREEN：同命令通过（1 file / 8 tests）。相邻验证 `npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（5 files / 37 tests）。全量验证通过：`npm test`（35 files / 303 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0，前者仅输出既有 LF/CRLF 转换提示。构建生成的未跟踪 `out/` 已确认位于工作区内并删除。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测输入区状态条：小宽度下 label 隐藏、count pill 可读、tooltip/aria 保留语义、展开 panel 位置不遮挡输入框；2) 继续梳理右侧 `StatusPanel` 信息密度，尤其 runtime context、MCP live、session load metrics 是否需要默认折叠或分组；3) 若用户继续反馈大会话卡顿，用 `lastSessionLoadMetrics` 选择下一轮性能点，避免继续盲改 UI；4) 对 cc-gui 真实运行画面做一次并排截图审计，补齐仍未验证的 provider/model selector、MCP details、Git chip、状态条和长历史消息排版。

## 本轮 PLAN 2026-06-19 chat status panel diagnostic density

- 目标：继续降低 Chat 右侧 `StatusPanel` 常态信息密度，把历史加载性能指标从默认展开详情收口为“诊断入口”；加载中或错误态仍自动展开，避免隐藏关键问题。
- 功能点 1：恢复上下文与差距确认。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务与规范，确认 `C:/guodevelop/ccg-switch` 可读，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际对标路径 `C:/guodevelop/demo/jetbrains-cc-gui` 可读。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言完成态 `sessionLoadMetrics` 默认渲染 `status-session-load-toggle` 且 `aria-expanded=false`，详细 window/full/map 耗时不进入默认 DOM；loading/error 自动展开。
- 功能点 3：实现最小展示层改动。验证方式：`StatusPanel` 新增本地 disclosure state，完成态默认折叠、加载/错误态自动展开，指标详情条件渲染；不改变 `useChatStore`、后端历史加载协议、MCP live check 或 composer 状态条。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/frontend/state-management.md`，记录历史加载诊断折叠契约和本地 UI state 边界。
- 功能点 5：质量验证。验证方式：运行定向 `StatusPanel` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` 与生成物清理。

## 迭代记录 2026-06-19 chat status panel diagnostic density

- 上轮实际进展：上一轮已把输入区 tasks/subagents/edits/MCP 状态条收口为 quick-entry chip，并修复任务/子代理重复、模型/Provider 图标对齐和 composer toolbar 分组；代码复查确认这些能力在 `ChatInputStatusTabs`、`SelectorDropdown`、`ModelIcon`、`ButtonArea` 中存在。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 Chat 辅助信息更偏 compact 控制面，完整诊断不会在常态右栏持续占多行。本项目 `StatusPanel` 的 `sessionLoadMetrics` 虽然对大会话性能排查有价值，但完成态仍默认展开 window/full/map/elapsed 多行，和 runtime/MCP/工具/编辑详情一起造成右侧面板扫描负担。
- 本轮诊断（超越 cc-gui）：保留性能诊断入口，但完成后默认折叠，可以让普通聊天状态先展示 provider、daemon、MCP、工具和编辑等高频信息；当历史加载中或失败时自动展开，确保排障信息不被隐藏。用户痛点是“页面元素功能重复、布局排版不合理”；本轮减少的是右侧面板常驻诊断噪声。
- 本轮规划：只改 `StatusPanel` 的展示层 disclosure 行为，不改历史加载协议、store ownership、MCP live check、输入区状态条或后端命令。优先级中高：用户价值中高（降低常态噪声）、出现频率高（右侧面板常驻）、实现成本低（单组件 + 测试）、风险低（本地 UI state）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 新增/调整历史加载指标回归，覆盖完成态默认折叠和 loading 自动展开。`src/components/chat/StatusPanel.tsx` 新增 `SessionLoadDisclosureState`，按 `providerId/sessionKey/startedAt` 重置本地展开状态；完成态默认折叠，只在 summary 行显示来源、消息数和总耗时，展开后才显示 window/full/map/error 详情；loading/error 自动展开。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步诊断折叠和 state 所有权约束。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 2 项，失败点为缺少 `status-session-load-toggle` 且完成态仍默认输出 `40ms`/`50ms` 详情。GREEN：同命令通过（1 file / 15 tests）。相邻验证 `npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（5 files / 38 tests）。全量验证通过：`npm test`（35 files / 304 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 和 `git diff --cached --check` exit 0，其中 `git diff --check` 仅输出既有 LF/CRLF 转换提示。`npm run build` / IDE build 生成的未跟踪 `out/` 已确认在工作区内并删除。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测右侧状态面板：历史加载诊断折叠/展开、loading/error 自动展开、MCP details/live check、runtime context 在窄右栏下是否可扫读；2) 继续压缩 `StatusPanel` runtime context，可考虑把 model/mode/reasoning/workspace/SDK 合成两行 compact grid，但需先截图审计避免过度隐藏；3) 对 cc-gui 真实运行画面做并排截图审计，覆盖 provider/model selector、MCP details、Git chip、输入区状态条和历史消息排版；4) 若用户继续反馈大会话卡顿，用 `lastSessionLoadMetrics` 的分段数据决定是否优化后端 tail reader、IPC payload 或完整摘要构建。

## 本轮 PLAN 2026-06-19 chat runtime context compact grid

- 目标：继续收口 Chat 右侧 `StatusPanel` 的常态信息密度，把 model / permission mode / reasoning / workspace / SDK 从纵向键值列表改为 compact tile grid，保留完整 tooltip，减少右栏滚动压力。
- 功能点 1：恢复上下文与确认边界。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务制品、前端规范与 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言 runtime context 渲染 `status-runtime-context-grid`、5 个 `status-runtime-context-item` 和 `status-runtime-context-value`。
- 功能点 3：实现最小展示层改动。验证方式：`StatusPanel` 将 runtime context 的 5 个 display-only 行改为两列 compact tile，值保持 truncate + title；不改 `ChatPage`、store、后端命令、MCP live check 或历史加载。
- 功能点 4：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/frontend/state-management.md`，记录 runtime context 应是右侧状态面板的 compact-grid 展示，不引入 Zustand 展开/密度状态。
- 功能点 5：质量验证。验证方式：运行定向 `StatusPanel` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check`，并清理构建生成物。

## 迭代记录 2026-06-19 chat runtime context compact grid

- 上轮实际进展：上一轮已将历史加载性能指标从默认展开详情改为完成态折叠、loading/error 自动展开；代码复查确认 `StatusPanel` 中已有 `status-session-load-toggle` 与 `status-session-load-details` 条件渲染，且 Trellis 规范已记录诊断折叠契约。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 Chat 状态辅助面板更偏扫描型 compact 控制面。本项目 `StatusPanel` runtime context 虽然补齐了模型、权限模式、推理强度、工作区和 SDK 状态，但仍是 5 个纵向 key/value 行；在右栏同时展示 MCP、工具、编辑树、历史诊断时，这块会占用过多高度。
- 本轮诊断（超越 cc-gui）：把 runtime context 改成两列 compact tile 后，用户仍能在发送前确认关键运行环境，同时通过 `title` 查看完整模型 id 和 Windows 工作区路径。用户痛点是“页面元素重复、布局排版不合理、模型图标/状态不对齐”；本轮减少的是右侧状态栏的基础信息铺排成本。
- 本轮规划：只改 `StatusPanel` runtime context 的 markup/class，不新增图标、不新增文案、不改变数据来源。优先级中高：用户价值中高（提高右栏可扫读性）、出现频率高（常驻面板）、实现成本低（单组件+测试）、风险低（纯展示层）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 增加 compact runtime context 回归，要求 `status-runtime-context-grid`、5 个 `status-runtime-context-item` 和 `status-runtime-context-value` 存在。`src/components/chat/StatusPanel.tsx` 将 model/mode/reasoning/workspace/SDK 的纵向列表改为两列 compact tile，保留 `title` 和状态颜色。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步 runtime context compact-grid 与本地展示边界。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为缺少 `status-runtime-context-grid`。GREEN：同命令通过（1 file / 15 tests）。相邻验证 `npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（5 files / 38 tests）。全量验证通过：`npm test`（35 files / 304 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 和 `git diff --cached --check` exit 0，其中 `git diff --check` 仅输出既有 LF/CRLF 转换提示。`npm run build` / IDE build 生成的未跟踪 `out/` 已确认位于工作区内并删除。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测右侧状态面板：runtime compact grid 在窄右栏下是否可读、title 是否能检查完整模型/路径、历史诊断折叠是否正常；2) 做一次 cc-gui 与本项目真实运行画面并排截图审计，重点看 provider/model selector、MCP details、Git chip、输入区状态条、右栏密度和历史消息排版；3) 若仍觉得右侧面板拥挤，下一轮再评估将 `currentActivity` 与 tool counts 合并为一个 compact activity card；4) 若大会话继续卡顿，用 `lastSessionLoadMetrics` 分段数据定位是后端 tail reader、IPC payload、React commit 还是完整摘要构建。

## 本轮 PLAN 2026-06-19 chat status panel activity counts consolidation

- 目标：继续降低 Chat 右侧 `StatusPanel` 的重复信息，把 standalone “进行中工具 / 失败工具”两行合并到 `currentActivity` 卡片标题右侧，只在有非零计数时显示 compact pills。
- 功能点 1：恢复上下文与确认边界。验证方式：读取 `TODO_LIST.md`、Trellis 规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `StatusPanel.tsx` 与 `StatusPanel.test.tsx`，确认 `pendingTools` / `errorTools` 独立渲染在顶部 grid，同时 `currentActivity` 另起卡片。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言工具计数进入 `status-activity-tool-counts`，并且顶部 grid 不再直接渲染 `Pending tools` / `Failed tools` 标签行。
- 功能点 4：实现最小展示层改动。验证方式：`StatusPanel` 从顶部 grid 删除两行 tool count，把 pending/error 派生为 current activity header pills；不改 `statusSummary` 来源、store、MCP、历史加载或输入区状态条。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，记录工具计数属于 current activity card 派生摘要，不新增 Zustand 状态。
- 功能点 6：质量验证。验证方式：运行定向 `StatusPanel` 测试、相邻 Chat UI 测试、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat status panel activity counts consolidation

- 上轮实际进展：上一轮已把 `StatusPanel` runtime context 从纵向列表改为 compact tile grid；代码复查确认 `src/components/chat/StatusPanel.tsx` 已有 `status-runtime-context-grid`，测试 `src/components/chat/StatusPanel.test.tsx` 覆盖 5 个 `status-runtime-context-item`。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的状态辅助区更偏 activity-centered，工具运行/失败状态贴近当前活动本身。本项目顶部 status grid 仍有独立 “进行中工具 / 失败工具” 两格，而下方 `currentActivity` 又显示 active tool，用户需要在两块区域之间拼读同一类信息。
- 本轮诊断（超越 cc-gui）：把 pending/failed 计数并入 `currentActivity` header 后，右侧面板的基础 grid 只保留 provider、消息数、锚点、daemon、MCP、历史诊断等基础/环境信息；工具动态状态贴在当前活动标题旁。用户痛点是“页面元素功能重复、布局排版不合理”，本轮直接减少两行常驻重复信息。
- 本轮规划：只做 `StatusPanel` 展示层收口，不改 `ChatStatusSummary` 派生、不改 `ChatPage`、store、MCP live check、历史加载和 composer strip。优先级中高：用户价值中高（减少右栏重复扫描）、出现频率高（右栏常驻）、实现成本低（单组件 + 测试 + 规范）、风险低（纯派生展示）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 新增回归 `consolidates tool counts into the current activity card header`，覆盖 activity header count pills 与顶部 grid 标签移除。`src/components/chat/StatusPanel.tsx` 新增 `pendingToolCount` / `errorToolCount` / `hasActivityToolCounts` 派生值，删除顶部 standalone `pendingTools` / `errorTools` 行，并在 `currentActivity` header 右侧仅对非零计数渲染 `status-activity-tool-count` pills，保留中英文 title。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步：pending/failed tool counts 属于 current activity card 派生摘要，不再进入顶部 status grid，也不需要新的 Zustand 状态。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为缺少 `status-activity-tool-counts` 且 HTML 中仍有顶部 “进行中工具 / 失败工具”。GREEN：同命令通过（1 file / 16 tests）。相邻验证 `npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（5 files / 39 tests）。全量验证通过：`npm test`（35 files / 305 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 构建生成的未跟踪 `out/production/...` 已确认位于工作区内并删除。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测右侧 `StatusPanel`：activity count pills 在 pending/error/idle 下是否可扫读，MCP details/live check、runtime grid、历史诊断折叠是否仍正常；2) 做一次 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、输入区状态条、provider/model selector、Git chip、MCP details 和长历史消息排版；3) 如果右侧仍拥挤，下一轮优先评估把 recent edits 卡片的“0 文件”空态隐藏或合并为轻量 footer，避免空态也占整块卡片；4) 如果大会话继续卡顿，用 `lastSessionLoadMetrics` 分段数据定位是后端 tail reader、IPC payload、React commit 还是完整摘要构建。

## 本轮 PLAN 2026-06-19 chat status panel edit empty-state trigger

- 目标：继续降低 Chat 右侧 `StatusPanel` 常态噪音，隐藏无编辑时的整块“最近改动 / 0 文件 / 暂时没有可展示的文件改动”空态卡片；有编辑或可重开中央 diff 面板时仍显示。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务 `prd.md` / `design.md` / `implement.md`、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 对标诊断。验证方式：读取本项目 `StatusPanel.tsx` / `StatusPanel.test.tsx` 与 cc-gui `webview/src/components/StatusPanel/StatusPanel.tsx`，确认 cc-gui 文件变更 tab 只在有变更时显示统计和 popover 详情，本项目则无条件渲染整块空态卡片。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言无编辑时不输出 “Recent edits / 最近改动” 和 “No file edits to show yet / 暂时没有可展示的文件改动”。
- 功能点 4：实现最小展示层改动。验证方式：`StatusPanel` 新增 `shouldShowRecentEditsCard`，仅在 touched file count、`allEdits` 或 diff-pane reopen action 存在时渲染最近改动卡；不改 `statusSummary` 派生、编辑树逻辑、中央 diff pane 或输入区 edits tab。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，记录 recent-edits card 是触发式展示，不新增 Zustand 状态。
- 功能点 6：质量验证。验证方式：运行定向 `StatusPanel` 测试、相邻 Chat UI 测试、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat status panel edit empty-state trigger

- 上轮实际进展：上一轮已把 pending/failed tool counts 从顶部 grid 合并到 `currentActivity` header；代码复查确认 `src/components/chat/StatusPanel.tsx` 已有 `status-activity-tool-counts`，`src/components/chat/StatusPanel.test.tsx` 已覆盖顶部标签移除。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/components/StatusPanel/StatusPanel.tsx` 使用 tab header + popover，文件变更 tab 常驻但只有 `hasFileChanges` 时显示统计，详情不是默认铺开。本项目右侧 `StatusPanel` 在无编辑时仍无条件渲染整块 “最近改动” 卡片和 “+0 / -0” 空态，和已压缩的 runtime/activity/diagnostic 面板方向不一致。
- 本轮诊断（超越 cc-gui）：本项目右栏已经有输入区 edits quick-entry 和中央 diff pane 作为真实编辑入口，右侧最近改动卡应只在有可检查内容或可重开 diff 面板时出现。用户痛点是“页面元素功能重复、布局排版不合理”；隐藏零编辑空卡可减少常态滚动和视觉噪音，而不影响真实编辑审查。
- 本轮规划：只改 `StatusPanel` 最近改动卡的触发条件，不改编辑树、diff preview、diff pane reopen handler、`ChatStatusSummary` 或输入区 edits tab。优先级中高：用户价值中（减少右栏空态噪音）、出现频率高（无编辑是常态）、实现成本低（单组件 + 测试 + 规范）、风险低（有编辑和 diff pane 折叠场景保留）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 新增回归 `omits the recent edits card when there are no edits to inspect`，覆盖无编辑时不输出最近改动空态。`src/components/chat/StatusPanel.tsx` 新增 `shouldShowRecentEditsCard = touchedFileCount > 0 || allEdits.length > 0 || canReopenDiffPane`，用它包裹最近改动卡；同时去掉空态卡内部的 `+0 / -0` fallback 和 `noRecentEdits` 文案路径，因为无编辑时整卡不再渲染。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步 recent-edits card 的触发式展示和 state 边界。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为 HTML 中仍输出 “最近改动” 和 “暂时没有可展示的文件改动”。GREEN：同命令通过（1 file / 17 tests）。相邻验证 `npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（5 files / 40 tests）。全量验证通过：`npm test`（35 files / 306 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 构建生成的未跟踪 `out/production/...` 已确认位于工作区内并删除。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测右侧 `StatusPanel`：无编辑时最近改动卡消失，有编辑时编辑树/hover diff/reopen diff pane 仍可用；2) 做一次 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、输入区状态条、provider/model selector、Git chip、MCP details 和长历史消息排版；3) 如果右侧仍拥挤，下一轮优先评估 idle `currentActivity` 卡是否可以和基础状态合并为更轻量状态行；4) 如果大会话继续卡顿，用 `lastSessionLoadMetrics` 分段数据定位是后端 tail reader、IPC payload、React commit 还是完整摘要构建。

## 本轮 PLAN 2026-06-19 chat status panel idle activity trigger

- 目标：继续降低 Chat 右侧 `StatusPanel` 常态噪音，纯空闲态不再渲染整块 “Current activity / 当前活动” 卡片；有 active tool、回复流式生成或 pending/failed tool 计数时仍显示。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `StatusPanel.tsx` / `StatusPanel.test.tsx`，确认 `currentActivity` 卡在旧实现中无条件渲染，纯空闲时仍输出 idle 文案。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言完全 idle 时不输出 “Current activity / 当前活动” 和 “Idle / 当前空闲”，同时流式回复时仍显示 activity 卡。
- 功能点 4：实现最小展示层改动。验证方式：`StatusPanel` 新增 `shouldShowCurrentActivityCard = activeTool || isStreaming || hasActivityToolCounts`，只包裹 current activity 卡；不改 `statusSummary`、store、MCP、历史加载或 composer strip。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，记录 activity 卡触发式展示和 state 边界。
- 功能点 6：质量验证。验证方式：运行定向 `StatusPanel` 测试、相邻 Chat UI 测试、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat status panel idle activity trigger

- 上轮实际进展：上一轮已隐藏无编辑时的 `recentEdits` 空态卡；代码复查确认 `src/components/chat/StatusPanel.tsx` 已有 `shouldShowRecentEditsCard`，`src/components/chat/StatusPanel.test.tsx` 已覆盖无编辑时不输出最近改动空态。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的状态辅助信息偏 activity-centered，只有真正有操作/运行状态时才需要用户扫读。本项目虽然已把 pending/failed 工具计数并入 `currentActivity` header，但 `currentActivity` 卡仍在完全 idle 时无条件渲染，并显示一整块 “当前空闲”，与前几轮 runtime、history metrics、recent edits 的触发式收口方向不一致。
- 本轮诊断（超越 cc-gui）：空闲状态本身已经可由没有 spinner、没有 tool count、没有 active tool 来表达，不需要占用右栏卡片高度；当回复 streaming、工具正在执行/失败或存在 active tool 时再显示 activity 卡，能把用户注意力集中到可行动状态。用户痛点是“页面元素重复、布局排版不合理”；本轮减少常态右栏噪音，同时保留动态状态的可见性。
- 本轮规划：只改 `StatusPanel` 展示层触发条件，不新增 i18n、不改 `ChatStatusSummary` 派生、不改后端命令、不改输入区状态条。优先级中高：用户价值中（减少常态卡片堆叠）、出现频率高（idle 是 Chat 常态）、实现成本低（单组件 + 测试 + 规范）、风险低（active/streaming/count 场景保留）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 新增 idle/streaming 回归：纯 idle 不输出 `Current activity / 当前活动` 与 idle 文案，streaming 仍显示 activity 卡和回复生成状态。`src/components/chat/StatusPanel.tsx` 新增 `shouldShowCurrentActivityCard` 派生条件，并用它包裹 current activity 卡；active tool 展示、streaming 展示、pending/error count pills 逻辑保持原样。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步：current-activity card 是触发式展示，完全 idle 不渲染大卡，也不引入 Zustand 状态。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为旧实现仍输出 “当前活动 / 当前空闲”。GREEN：同命令通过（1 file / 19 tests）。相邻验证 `npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（5 files / 42 tests）。全量验证通过：`npm test`（35 files / 308 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 构建生成的未跟踪 `out/production/...` 已确认位于工作区内并删除。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测右侧 `StatusPanel`：idle 时 activity/recent-edits 空卡消失，streaming/active tool/pending-error counts 时 activity 卡仍可见；2) 做一次 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、输入区状态条、provider/model selector、Git chip、MCP details 和长历史消息排版；3) 下一轮优先检查输入区布局是否仍存在重复入口或按钮对齐问题，尤其 provider/model icon、任务/子代理/编辑/MCP/Git chip 的窄宽度排布；4) 若大会话继续卡顿，用 `lastSessionLoadMetrics` 分段数据定位是后端 tail reader、IPC payload、React commit 还是完整摘要构建。

## 本轮 PLAN 2026-06-19 chat input git chip compact density

- 目标：继续优化 Chat 输入区状态条密度，把 Git 分支 chip 收口成与任务/子代理/编辑/MCP 一致的 compact quick-entry 形态：小屏隐藏“分支”视觉标签，分支名截断，并保留完整可访问上下文。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 对标诊断。验证方式：读取本项目 `ChatInputStatusTabs.tsx` / 测试与 cc-gui `StatusPanel` tab header，确认 cc-gui 状态入口是紧凑 header/popover，本项目 Git chip 仍常驻显示 label 且 title 没有分支名。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，断言 Git chip 渲染 `chat-input-status-git-label hidden sm:inline`、`chat-input-status-git-value`，并在 `aria-label` / `title` 中保留完整 branch/root 上下文。
- 功能点 4：实现最小展示层改动。验证方式：`ChatInputStatusTabs` 只调整 Git chip class、title、aria-label 和分支值宽度；不改 `chat_workspace_status` 后端命令、不改 `chatWorkspaceStatus.ts`、不改 Git 触发显示条件。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，记录 Git chip 密度规则属于展示层，不进入 Zustand。
- 功能点 6：质量验证。验证方式：运行定向 `ChatInputStatusTabs` 测试、相邻 Chat UI 测试、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat input git chip compact density

- 上轮实际进展：上一轮已把 `StatusPanel` idle current-activity 空态卡改为触发式展示；代码复查确认 `src/components/chat/StatusPanel.tsx` 已有 `shouldShowCurrentActivityCard`，测试已覆盖 idle 不输出 activity 卡、streaming 保留 activity 卡。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`，且该对标仓库也有 `.codegraph/`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/components/StatusPanel/StatusPanel.tsx` 用紧凑 tab header 承载 tasks/subagents/files，详情进 popover；本项目输入区状态条已经有任务/子代理/编辑/MCP compact tab，但 Git chip 仍在小屏常驻显示“分支”标签，且 `title` 只显示 gitRoot，不包含实际 branch。多个状态入口同时出现时，Git chip 比其他入口更容易抢横向空间。
- 本轮诊断（超越 cc-gui）：Git 分支是发送前上下文提示，不是可展开详情入口。它应该像 quick-entry chip 一样低噪：图标 + 截断分支名即可，完整 branch/root 放在 `aria-label` 和 `title`。用户痛点是“输入区布局排版不合理、状态按钮触发显示隐藏、Git 分支显示”；本轮让 Git 显示更可靠且不挤占任务/MCP 入口空间。
- 本轮规划：只做 `ChatInputStatusTabs` Git chip 展示层收口，不改后端 Git 检测、不改 `ChatPage` cwd 触发、不改任务/子代理/编辑/MCP 展开逻辑。优先级中高：用户价值中（减少窄宽状态条拥挤并提升可访问信息）、出现频率高（Git 项目中常驻）、实现成本低（单组件 + 测试 + 规范）、风险低（不改变数据来源）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增回归 `keeps the git branch chip compact while preserving accessible branch context`，覆盖小屏 label 隐藏、分支值 class、完整 branch aria/title。`src/components/chat/ChatInputStatusTabs.tsx` 新增 `gitBranchTitle`，Git chip 增加 `aria-label`，视觉 label 改为 `hidden sm:inline`，分支值增加 `chat-input-status-git-value` 与 `max-w` 截断；Git 仍仅在 `workspaceStatus.isGitRepository && gitBranch` 时显示。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步 Git chip compact density 和展示层 state 边界。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 1 项，失败点为旧 Git chip 缺少 `chat-input-status-git-label hidden sm:inline`、`chat-input-status-git-value` 和 branch aria/title。GREEN：同命令通过（1 file / 9 tests）。相邻验证 `npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（5 files / 43 tests）。全量验证通过：`npm test`（35 files / 309 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 构建生成的未跟踪 `out/production/...` 已确认位于工作区内并删除。未做真实 Tauri 桌面窄宽视觉点测。
- 下一步候选：1) 真实 Tauri 桌面点测输入区状态条：Git + tasks + subagents + edits + MCP 同时出现时是否换行合理、分支 title 是否可检查完整上下文、编辑/MCP 展开面板是否不遮挡 composer；2) 继续检查 bottom toolbar provider/model/mode/reasoning 图标对齐，尤其 Claude/Codex provider 图标和 model-family glyph 在不同模型名长度下是否漂移；3) 做 cc-gui 与本项目真实运行画面并排截图审计，覆盖输入区、右栏、长历史消息排版和大会话加载指标；4) 若大会话继续卡顿，用 `lastSessionLoadMetrics` 分段数据决定优化后端 tail reader、IPC payload、React commit 还是完整摘要构建。

## 本轮 PLAN 2026-06-19 chat composer selector icon alignment

- 目标：收口 Chat 输入区 bottom toolbar 的 provider / mode / model / reasoning 选择器图标对齐，所有触发器图标、菜单选项图标和选中 checkmark 都使用同一套固定 icon box，减少 Claude/Codex provider glyph、model-family glyph 与 lucide glyph 混排时的视觉漂移。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务 `prd.md` / `design.md` / `implement.md`、前端规范和 `package.json`；确认本轮只改前端展示层。
- 功能点 2：CodeGraph 对标诊断。验证方式：读取本项目 `ButtonArea.tsx` / `SelectorDropdown.tsx` / `ModelIcon.tsx` / `ButtonArea.test.tsx` 与 cc-gui `ChatInputBox` provider/model selector 实现，确认当前统一落点是 `SelectorDropdown`。
- 功能点 3：补 RED 测试。验证方式：新增或扩展 composer selector 测试，断言 trigger / option / selected checkmark 都渲染 `selector-dropdown-icon-box` 及对应变体 class。
- 功能点 4：实现最小展示层改动。验证方式：`SelectorDropdown` 统一固定 icon box class 和尺寸，去掉 option/checkmark 的一处一处 margin 微调；不改 provider/model/mode/reasoning 状态、模型来源、刷新逻辑或后端命令。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，记录 selector icon box 是展示层契约，不引入新的 Zustand state。
- 功能点 6：质量验证。验证方式：运行定向 composer 测试、相邻 Chat UI 测试、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat composer selector icon alignment

- 上轮实际进展：上一轮已把输入区 Git chip 收口成 compact quick-entry；代码复查确认 `src/components/chat/ChatInputStatusTabs.tsx` 已具备 `chat-input-status-git-label hidden sm:inline`、`chat-input-status-git-value`、完整 `aria-label` / `title`。已知阻塞仍是真实 Tauri 桌面窄宽视觉/点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/components/ChatInputBox/selectors/ProviderSelect.tsx` 和 `ModelSelect.tsx` 在 selector trigger / option 中复用 provider/model 图标，整体是紧凑 icon + label 的 toolbar 模式。本项目已经有 `ProviderBrandIcon` / `ModelIcon`，但 `SelectorDropdown` 的 trigger、option 和 checkmark 没有统一语义 wrapper；checkmark 仍是裸 `Check` 图标，option/check 还依赖局部 `mt-0.5` 微调，容易在 Claude/Codex provider glyph、model-family glyph 和 lucide glyph 混排时出现垂直漂移。
- 本轮诊断（超越 cc-gui）：把图标对齐收口到 `SelectorDropdown` 一个公共边界，比在 `ButtonArea` 为 provider/model/mode/reasoning 分别调尺寸更可维护。用户痛点是“模型图标不对齐、输入区布局排版不合理、功能入口重复”；统一 icon box 后，后续新增模型族图标或 provider 图标不会重新打破 toolbar 对齐。
- 本轮规划：只改 `SelectorDropdown` 展示层和测试，不改变 `ButtonArea` props、不改变 provider/model/mode/reasoning 状态、不触发模型动态刷新、不改后端命令。优先级中高：用户价值中（提升输入区精度和扫读稳定性）、出现频率高（每次输入都可见）、实现成本低（单组件 + 单测试 + 规范）、风险低（只调整 wrapper class 和 checkmark 包裹）。
- 本轮完成：新增 `src/components/chat/composer/SelectorDropdown.test.tsx`，通过 SSR 强制打开菜单并断言 trigger / option / selected checkmark 都使用 `selector-dropdown-icon-box` 及 `--trigger` / `--option` / `--check` 变体。`src/components/chat/composer/SelectorDropdown.tsx` 新增共享 icon-box class 常量，trigger、option 和 checkmark 均使用固定 `h-4 w-4` flex box，checkmark 改为 wrapper 内渲染 `Check`，并移除 option/checkmark 的局部 `mt-0.5` 对齐补丁。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步：selector icon box 是展示层契约，固定 class 为 `selector-dropdown-icon-box`，不进入 Zustand。
- 本轮验证：RED：`npm test -- src/components/chat/composer/SelectorDropdown.test.tsx` 先失败 1 项，失败点为旧实现缺少 `selector-dropdown-icon-box` 统一 wrapper 且 checkmark 是裸图标。GREEN：同命令通过（1 file / 1 test）。局部 composer 验证 `npm test -- src/components/chat/composer/SelectorDropdown.test.tsx src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx` 通过（3 files / 9 tests）。相邻 Chat UI 验证 `npm test -- src/components/chat/composer/SelectorDropdown.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx` 通过（6 files / 44 tests）。全量验证通过：`npm test`（36 files / 310 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 构建生成的未跟踪 `out/` 已确认位于工作区内并删除。新增测试文件已按仓库规则 `git add`。未做真实 Tauri 桌面视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测 bottom toolbar：Claude/Codex provider icon、model icon、mode icon、reasoning icon 在不同模型名长度和窄宽换行下是否保持基线稳定；2) 继续做输入区布局排版审计，评估 provider/mode/model/reasoning/refresh/enhance/send 在常见宽度下是否有重复入口或主按钮被挤压；3) 做 cc-gui 与本项目真实运行画面并排截图审计，覆盖输入区、右栏、长历史消息排版和大会话加载指标；4) 若大会话继续卡顿，用 `lastSessionLoadMetrics` 分段数据决定优化后端 tail reader、IPC payload、React commit 还是完整摘要构建。

## 本轮 PLAN 2026-06-19 chat composer toolbar action group hardening

- 目标：收口 Chat 输入区 bottom toolbar 的右侧主操作区，把 enhance/send/stop 统一为固定尺寸 icon action group，避免 provider/mode/model/reasoning 选择器换行时挤压发送/停止按钮，减少 DaisyUI `btn-xs` 自适应尺寸导致的视觉跳动。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认本轮只改前端展示层。
- 功能点 2：CodeGraph 对标诊断。验证方式：读取本项目 `ButtonArea.tsx` / `ButtonArea.test.tsx` 与 cc-gui `webview/src/components/ChatInputBox/ButtonArea.tsx`，确认 cc-gui 右侧是独立 `button-area-right`，send/stop 复用固定语义按钮。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/composer/ButtonArea.test.tsx`，断言 toolbar、selector group、action group 有稳定语义 class，enhance/send/stop 使用固定 `h-7 w-7 shrink-0` icon button，并有 `aria-label`。
- 功能点 4：实现最小展示层改动。验证方式：`ButtonArea` 只调整 wrapper class、按钮 class 与 aria-label；不改 provider/model/mode/reasoning 状态、不改动态模型刷新、不改发送/停止/增强回调。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md`，记录 composer toolbar 左侧可换行、右侧固定 action group 的展示层契约。
- 功能点 6：质量验证。验证方式：运行定向 `ButtonArea` 测试、相邻 Chat UI 测试、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理构建生成物。

## 迭代记录 2026-06-19 chat composer toolbar action group hardening

- 上轮实际进展：上一轮已把 `SelectorDropdown` trigger/option/checkmark 图标统一进固定 icon box；代码复查确认 `src/components/chat/composer/SelectorDropdown.tsx` 已有 `selector-dropdown-icon-box` 及 `--trigger` / `--option` / `--check`，新增 `SelectorDropdown.test.tsx` 已覆盖。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/components/ChatInputBox/ButtonArea.tsx` 使用独立 `button-area-left` / `button-area-right`，send/stop 复用固定语义按钮。本项目虽然已有右侧 `shrink-0` 容器，但 send/stop 仍使用 DaisyUI `btn btn-xs` 自适应尺寸，和 enhance 的固定 icon button 不一致；当模型名较长或状态条换行时，右侧主操作的视觉宽度和对齐更容易跳动。
- 本轮诊断（超越 cc-gui）：把 toolbar 外层、selector group、action group 暴露成稳定 class，并把 enhance/send/stop 固定为 28px icon buttons，可以让后续窄屏、长模型名、动态模型刷新状态都有可测试的布局边界。用户痛点是“输入区布局排版不合理、模型图标不对齐、页面元素重复”；本轮处理的是主操作按钮不应被选择器挤压和尺寸漂移。
- 本轮规划：只改 `ButtonArea` 展示层和测试，不改 provider/model/mode/reasoning 数据来源、不改动态模型刷新、不改发送/停止/增强回调、不新增依赖。优先级中高：用户价值中（输入区主操作更稳定）、出现频率高（每次聊天都可见）、实现成本低（单组件 + 测试 + 规范）、风险低（纯 class/aria 调整）。
- 本轮完成：`src/components/chat/composer/ButtonArea.test.tsx` 新增回归 `keeps composer primary actions in a fixed right-side action group`，覆盖 `chat-composer-toolbar`、`chat-composer-toolbar-selectors`、`chat-composer-toolbar-actions`，以及 enhance/send/stop 的固定 `h-7 w-7 shrink-0` 和 `aria-label`。`src/components/chat/composer/ButtonArea.tsx` 给 toolbar 三段加稳定 class，并将 send/stop 从 DaisyUI 自适应 `btn btn-xs` 改为固定方形 icon-only primary action；enhance 保持原行为但补齐语义 class、`shrink-0` 和 `aria-label`。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步 toolbar action group 展示层契约。
- 本轮验证：RED：`npm test -- src/components/chat/composer/ButtonArea.test.tsx` 先失败 1 项，失败点为旧实现缺少 `chat-composer-toolbar` 等稳定 class。GREEN：同命令通过（1 file / 7 tests）。相邻验证 `npm test -- src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/SelectorDropdown.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/utils/chatStatusSummary.test.ts src/components/chat/composer/ChatComposer.render.test.tsx` 通过（6 files / 45 tests）。全量验证通过：`npm test`（36 files / 311 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的未跟踪 `out/` 已确认位于工作区内并删除。未做真实 Tauri 桌面窄宽视觉/点击点测。
- 下一步候选：1) 真实 Tauri 桌面点测 bottom toolbar：长模型名、动态刷新 loading/error、reasoning 可见/不可见、Git/tasks/MCP 状态条同时出现时，右侧主操作是否始终固定在可点击位置；2) 做 cc-gui 与本项目真实运行画面并排截图审计，覆盖输入区、右栏、长历史消息排版和大会话加载指标；3) 下一轮优先从用户反馈继续排查长历史加载到聊天区域卡顿，用 `lastSessionLoadMetrics` 分段数据定位后端 tail reader、IPC payload、React commit 或完整摘要构建；4) 继续审计功能重复入口，尤其右侧 `StatusPanel` 与输入区状态条在 tasks/subagents/edits/MCP 上的信息层级是否还可进一步合并。

## 本轮 PLAN 2026-06-19 chat large history background map yielding

- 目标：继续优化点击大型历史会话后的卡顿。首屏窗口已经只加载 120 条、聊天区只渲染 15 条，但后台完整历史返回后仍一次性 `mapHistoryMessages(session, history)`，会把几千条映射压在一个 JS 任务里；本轮把完整历史映射改为分块让出事件循环，避免首屏显示后 UI 再次冻结。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认本轮修改 store 历史加载链路，不改 UI 样式和后端命令。
- 功能点 2：根因诊断。验证方式：用 CodeGraph 读取 `useChatStore.loadSession()`、`mapHistoryMessages()`、`MessageList` 和 `ChatPage` 历史窗口逻辑，确认首屏窗口没有写全量，但后台完整映射仍同步执行。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts`，模拟大历史窗口首屏后完整历史返回，断言 `loadSession()` 不会在同一个微任务内完成完整映射和 metrics complete。
- 功能点 4：实现最小性能改动。验证方式：新增分块完整历史映射 helper，只用于后台 `get_unified_session_messages` 结果；首屏 `get_unified_session_message_window` 仍同步映射以保证最快可见。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md`，记录后台完整历史映射必须分块让出主线程。
- 功能点 6：质量验证。验证方式：运行定向 `useChatStore` 测试、相邻 Chat UI/历史测试、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理构建生成物。

## 迭代记录 2026-06-19 chat large history background map yielding

- 上轮实际进展：上一轮已把 Chat composer bottom toolbar 的右侧主操作区固定为 `chat-composer-toolbar-actions`，send/stop/enhance 为固定 `h-7 w-7 shrink-0` icon button；代码复查确认 `src/components/chat/composer/ButtonArea.tsx` 和 `ButtonArea.test.tsx` 已具备该契约。已知阻塞仍是真实 Tauri 桌面视觉/点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的历史浏览体验不应在点击历史后长时间阻塞主聊天区。本项目已实现 `get_unified_session_message_window` 首屏窗口和缓存命中 recent window，测试也覆盖“缓存大历史不全量注入 messages”。但 `useChatStore.loadSession()` 在后台完整历史返回后仍同步执行 `mapHistoryMessages(session, history)`，这一步不写回聊天区却会在前端主线程一次性映射几千条历史，用户会感受到“聊天区域已经出现但仍卡顿”。
- 本轮诊断（超越 cc-gui）：完整历史缓存/诊断是后台能力，不应抢占用户对首屏窗口的滚动、搜索输入、继续发送等交互。把完整映射改为分块让出事件循环，可以保留后续缓存命中和 metrics，同时让已经渲染的 15 条可见消息保持响应。根因定位：不是首屏窗口缺失，而是后台 full-map 的单任务阻塞。
- 本轮规划：只改 store 内部完整历史映射边界，不改后端命令、不改首屏窗口大小、不改 `MessageList` 渲染窗口、不改 UI 样式。优先级高：用户价值高（直接对应大会话卡顿反馈）、出现频率中高（每次打开大历史）、实现成本低中（单 store helper + 测试 + 规范）、风险可控（首屏路径不变，后台完成后只更新 metrics/cache）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增回归 `yields between full history mapping chunks after the first-paint window`，模拟 1500 条历史，断言完整历史返回后 `loadSession()` 不会在同一微任务内完成 full metrics，必须等 chunk timers 推进后才完成。`src/stores/useChatStore.ts` 新增 `SESSION_HISTORY_FULL_MAP_CHUNK_SIZE`、`deferSessionHistoryMapChunk()`、`mapHistoryMessagesInChunks()`，仅用于后台 `get_unified_session_messages` 的 full-map；首屏 window 仍用同步 `mapHistoryMessages()`。因为分块引入额外 await，full-map 完成后、写 metrics/cache 前增加一次 `loadToken` 校验，避免用户发送新消息或切换会话后旧 full-map 再写入 stale metrics/cache。`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 已同步后台完整历史映射分块契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 1 项，失败点为完整历史返回后 metrics 已同步变成 `complete/fullMessageCount=1500`。GREEN：同命令通过（1 file / 53 tests）。相邻历史验证 `npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatStatusSummary.test.ts` 通过（4 files / 86 tests）。全量验证通过：`npm test`（36 files / 312 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的未跟踪 `out/` 已确认位于工作区内并删除。未做真实 Tauri 大历史点击性能点测；因此实际桌面体感改善仍标注为未验证。
- 下一步候选：1) 做真实 Tauri 桌面大历史点击点测，观察 `lastSessionLoadMetrics.windowLoadMs/windowMapMs/fullLoadMs/fullMapMs/elapsedMs`，确认卡顿是否从 full-map 转移到 IPC payload 或后端 full reader；2) 如果仍卡，下一轮优先优化后台完整历史读取策略，例如延迟 full load 到 idle、更低优先级触发、或仅在显式搜索/展开早期历史时拉完整历史；3) 继续做 cc-gui 与本项目真实运行画面并排截图审计，覆盖输入区、右栏、长历史消息排版和大会话加载指标；4) 继续审计功能重复入口，尤其右侧 `StatusPanel` 与输入区状态条在 tasks/subagents/edits/MCP 上的信息层级是否还可进一步合并。

## 本轮 PLAN 2026-06-19 chat large history deferred full load

- 目标：继续优化大型历史会话点击后的体感卡顿。上一轮已经把后台 full-map 分块让出事件循环，但 `loadSession()` 在首屏 window 写入后仍立即发起 `get_unified_session_messages`，大文件读取与 IPC payload 仍可能在首屏刚出现时抢占交互；本轮把 full history request 本身延迟到首屏提交后的短定时边界。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：根因诊断。验证方式：用 CodeGraph 读取 `useChatStore.loadSession()`、`mapHistoryMessagesInChunks()` 和历史加载测试，确认 full request 在首屏 `set(...)` 后同一异步链路立即启动。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts`，断言首屏 window 已写入 `messages` 后，未推进 defer timer 前 `get_unified_session_messages` 不能被调用。
- 功能点 4：实现最小性能改动。验证方式：新增 `SESSION_HISTORY_FULL_LOAD_DEFER_MS` 和 `deferSessionHistoryFullLoad()`，只在 partial window 后、full request 前等待，并在等待后再次检查 session-load token；不改首屏 window size、不改后端命令、不改 `MessageList` 渲染窗口。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md`，记录 full request defer、token re-check 和 full-map yielding 的组合契约。
- 功能点 6：质量验证。验证方式：运行定向 `useChatStore` 测试、相邻历史/UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat large history deferred full load

- 上轮实际进展：上一轮记录声称后台完整历史映射已分块让出事件循环；代码复查确认 `src/stores/useChatStore.ts` 已存在 `SESSION_HISTORY_FULL_MAP_CHUNK_SIZE`、`deferSessionHistoryMapChunk()`、`mapHistoryMessagesInChunks()`，并且 full-map 完成后有 token 再校验。记录中仍标注真实 Tauri 大历史点击体感未验证，本轮没有做桌面点测。
- 本轮诊断（补齐 cc-gui）：cc-gui 对标目标是历史会话点击后尽快可读、可滚动。本项目虽然已经首屏只拉 120 条并只渲染可见尾部，但 CodeGraph 显示 `loadSession()` 在首屏 window `set(...)` 之后马上执行 `get_unified_session_messages`；对几千条历史来说，后端读取、IPC 传输和随后映射会在首屏刚出现时继续竞争资源。
- 本轮诊断（超越 cc-gui）：后台完整历史是缓存/诊断能力，不应和用户刚看到的首屏交互抢优先级。延迟 full request 后，用户能先滚动、继续输入或发送；如果用户在这段窗口内切换会话或发送新消息，token 再校验会直接取消旧 full request，避免无意义的大 payload。
- 本轮规划：只改 store 内部历史加载时序与测试，不改后端命令、不改 UI 样式、不改历史窗口大小、不改 full-map 分块逻辑。优先级高：用户价值高（直接对应“大历史加载到聊天区域依然卡顿”）、出现频率中高（每次打开大历史）、成本低（单 helper + 测试调整）、风险可控（首屏路径和最终 cache/metrics 语义保留）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增回归 `defers the background full history request after first-paint window`，RED 时失败点为当前实现已经调用 2 次 invoke；同步调整 4 个既有大历史时序测试，让它们显式等待 defer 边界，或在发送新消息后断言 stale full request 不再启动。`src/stores/useChatStore.ts` 新增 `SESSION_HISTORY_FULL_LOAD_DEFER_MS = 50` 与 `deferSessionHistoryFullLoad()`，在 partial window 后、full request 前等待，并在等待后检查 `loadToken`。`.trellis/spec/frontend/state-management.md` 和 `.trellis/spec/frontend/component-guidelines.md` 已同步该契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 1 项，失败点为 `get_unified_session_messages` 在首屏后已被立即调用。GREEN：同命令通过（1 file / 54 tests）。相邻历史验证 `npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatStatusSummary.test.ts` 通过（4 files / 87 tests）。全量验证通过：`npm test`（36 files / 313 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做大历史点击点测，因此实际体感改善仍需下一轮用 `lastSessionLoadMetrics` 和桌面交互观察确认。
- 下一步候选：1) 真实 Tauri 桌面大历史点测：点击大历史后记录 window/full/map 分段指标，并观察首屏后 50ms 内滚动、输入、发送是否可响应；2) 若仍卡，优先定位 fullLoadMs 是后端 reader 还是 IPC payload，再决定是否把 full load 改为显式搜索/展开早期历史时才触发；3) 做 cc-gui 与本项目真实运行画面并排截图审计，覆盖输入区、右栏、长历史消息排版和大会话加载指标；4) 继续审计功能重复入口，尤其右侧 `StatusPanel` 与输入区状态条在 tasks/subagents/edits/MCP 上的信息层级是否还可进一步合并。

## 本轮 PLAN 2026-06-19 chat large history idle full load

- 目标：继续降低大型历史会话首屏后的交互抢占风险。上一轮把 full history request 延迟到短 timer 后，但在 Chromium/Tauri 环境里更合适的边界是优先等待 `requestIdleCallback`，只在不支持 idle API 时才走 timer fallback。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范、package 命令和路径可读性；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：根因诊断。验证方式：用 CodeGraph 读取 `useChatStore.loadSession()`、`MessageList` 和 `ChatPage` 搜索路径，确认当前 full request 仍是自动后台缓存/诊断任务，搜索尚未显式接入完整历史。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts`，模拟 `globalThis.requestIdleCallback` 可用，断言首屏后推进普通 timers 不会启动 full request，只有触发 idle callback 后才调用 `get_unified_session_messages`。
- 功能点 4：实现最小性能改动。验证方式：`deferSessionHistoryFullLoad()` 优先使用 `requestIdleCallback({timeout})`，fallback 保持现有 timer；不改后端命令、不改首屏 window、不改 full-map 分块、不改 UI。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md`，记录 full request 应优先走 idle boundary。
- 功能点 6：质量验证。验证方式：运行定向 `useChatStore` 测试、相邻历史/UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理构建生成物。

## 迭代记录 2026-06-19 chat large history idle full load

- 上轮实际进展：上一轮已把 full history request 从首屏同一异步链路延后到短 timer，并在 timer 后再次检查 session-load token；代码复查确认 `src/stores/useChatStore.ts` 已有 `SESSION_HISTORY_FULL_LOAD_DEFER_MS` 和 `deferSessionHistoryFullLoad()`，`src/stores/useChatStore.test.ts` 已覆盖 timer fallback。仍未做真实 Tauri 大历史点击体感点测。
- 本轮诊断（补齐 cc-gui）：cc-gui 对标目标是历史会话点击后首屏尽快可读、交互不被后台历史处理抢占。本项目上一轮 timer defer 已避免同一微任务立即发 full request，但在 Tauri/Chromium 里还能更进一步：优先等浏览器 idle callback，让 full request 只在主线程空闲或 bounded timeout 后启动。
- 本轮诊断（超越 cc-gui）：full history 目前只是缓存/诊断后台任务，搜索尚未显式接入完整历史；因此它不应该和用户首屏后的滚动、输入、发送争抢调度。`requestIdleCallback` 能把这个后台任务放到更合适的浏览器调度点，fallback timer 保证非浏览器测试/旧环境仍可完成。
- 本轮规划：只改 `deferSessionHistoryFullLoad()` 调度边界与测试，不改后端命令、不改首屏窗口、不改 full-map 分块、不改 UI 或搜索行为。优先级中高：用户价值高（继续降低大历史体感卡顿）、出现频率中（大历史点击）、成本低（单 helper + 单测试）、风险低（fallback 保持现有 timer 行为）。
- 本轮完成：`src/stores/useChatStore.test.ts` 新增回归 `waits for browser idle before the background full history request when available`，RED 时失败点为 `requestIdleCallback` 未被调用。`src/stores/useChatStore.ts` 为 `deferSessionHistoryFullLoad()` 增加 `requestIdleCallback(() => resolve(), {timeout: SESSION_HISTORY_FULL_LOAD_DEFER_MS})` 优先路径，环境不支持时仍走 `setTimeout`。`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 已同步 idle boundary 契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 1 项，失败点为 `requestIdleCallback` 调用次数为 0。GREEN：同命令通过（1 file / 55 tests）。相邻历史验证 `npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatStatusSummary.test.ts` 通过（4 files / 88 tests）。全量验证通过：`npm test`（36 files / 314 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未做真实 Tauri 桌面大历史点击点测；因此实际桌面体感改善仍需用 `lastSessionLoadMetrics` 和手动滚动/输入观察确认。
- 下一步候选：1) 真实 Tauri 桌面大历史点测，观察首屏后 idle full-load 是否仍造成可感知卡顿；2) 如果仍卡，下一轮优先做“搜索/展开早期历史显式触发 full load”，避免默认后台拉完整 payload；3) 做 cc-gui 与本项目真实运行画面并排截图审计，覆盖输入区、右栏、长历史消息排版和大会话加载指标；4) 继续审计功能重复入口，尤其右侧 `StatusPanel` 与输入区状态条在 tasks/subagents/edits/MCP 上的信息层级是否还可进一步合并。

## 本轮 PLAN 2026-06-19 chat large history windowed default

- 目标：继续排查并降低大型历史会话加载到聊天区域后的卡顿。上一轮已把默认后台 full request 推迟到 idle，但用户仍反馈卡顿；本轮把普通历史点击收口为“首屏窗口即完成”，不再自动拉完整历史 payload，完整历史留给后续显式搜索/展开意图。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：根因诊断。验证方式：用 CodeGraph 读取 `useChatStore.loadSession()`、`ChatSessionLoadMetrics`、`MessageList`、`ChatPage` 搜索路径和 `StatusPanel` 指标展示，确认首屏窗口已隔离，但 full request 仍默认启动且搜索尚未消费完整历史。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts`，断言 incomplete 大历史在 timers/idle 后仍不调用 `get_unified_session_messages`，`loadSession()` 结束为 `windowed`；扩展 `src/components/chat/StatusPanel.test.tsx`，断言 `windowed` 展示为“窗口就绪”且默认折叠。
- 功能点 4：实现最小性能改动。验证方式：`useChatStore.loadSession()` 在 partial window 后写入 `windowed` metrics 并返回；删除普通路径的后台 full request / full-map 分块调度；`StatusPanel` 增加 `windowed` 标签；不改后端命令、不改首屏窗口大小、不改 `MessageList` 渲染窗口。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md`，记录普通浏览不自动完整读取、partial window 是 `windowed` 完成态，完整历史必须由显式意图触发。
- 功能点 6：质量验证。验证方式：运行定向 store / StatusPanel 测试、相邻历史/UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat large history windowed default

- 上轮实际进展：上一轮记录声称 full history request 已优先等 `requestIdleCallback` 后再启动；代码复查确认 `src/stores/useChatStore.ts` 的 `loadSession()` 在 partial window 后仍会继续进入 `get_unified_session_messages`，只是推迟到 idle/timer，搜索路径仍只消费当前 `messages` 窗口。也就是说，后台 full payload 对普通浏览没有直接用户价值，却仍可能造成大会话点击后的体感卡顿。已知阻塞仍是真实 Tauri 桌面大历史点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 对标目标是历史会话点击后最近内容优先可读、可滚动。本项目已实现 tail window 和可见窗口渲染，但普通历史点击仍默认拉完整历史，导致后端读文件、IPC 传输和前端映射在用户刚进入会话时继续发生。根因不是首屏窗口本身，而是“后台完整读取”仍绑定在普通浏览动作上。
- 本轮诊断（超越 cc-gui）：把 partial 大历史明确标记为 `windowed` 完成态后，用户可以立即浏览最近窗口，右栏显示“窗口就绪”而不是一直“加载中”；完整历史只应在未来搜索全历史或显式展开早期历史时触发。这个取舍解决的痛点是大会话点击后 UI 仍被无感后台任务抢占，而不是单纯延后后台任务。
- 本轮规划：只改 store 的普通历史加载边界和右栏指标展示，不改后端命令、不改 tail window 大小、不改 `MessageList` 渲染窗口、不新增依赖。优先级高：用户价值高（直接对应大会话卡顿反馈）、出现频率中高（所有大型历史点击）、成本中低（store + 指标展示 + 测试）、风险可控（首屏窗口和完整窗口缓存语义保留）。
- 本轮完成：`src/types/session.ts` 为 `ChatSessionLoadMetrics.status` 新增 `windowed`。`src/stores/useChatStore.ts` 删除普通路径的 idle/timer full request 和 full-map 分块逻辑；partial window 映射后直接写入 `windowed` metrics、`completedAt`、`elapsedMs` 并结束本次 `loadSession()`；complete window 仍写入缓存。`src/components/chat/StatusPanel.tsx` 将 `windowed` 显示为完成类状态但标签为“窗口就绪”。`src/locales/en.json` / `src/locales/zh.json` 增加 `sessionLoadWindowed`。`src/stores/useChatStore.test.ts` 改为验证 incomplete 大历史不调用 `get_unified_session_messages`、partial window 不进完整缓存、窗口指标无 full-stage 噪声。`src/components/chat/StatusPanel.test.tsx` 增加 `windowed` 指标默认折叠展示回归。`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 已同步普通浏览不自动完整读取、显式 full-history 意图边界和 `windowed` 指标契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败 1 项，失败点为 `loadSession()` 未结束且等待自动 full request；`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为 `windowed` 被展示为“完成”而非“窗口就绪”。GREEN：两条定向测试分别通过（store：1 file / 53 tests；StatusPanel：1 file / 20 tests）。相邻验证通过：`npm test -- src/stores/useChatStore.test.ts src/utils/chatNavigation.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatStatusSummary.test.ts`（4 files / 86 tests）；`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx`（4 files / 38 tests）。全量验证通过：`npm test`（36 files / 313 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做大历史点击体感点测；因此“实际桌面卡顿是否完全消失”仍需下一轮用真实历史会话操作确认。
- 下一步候选：1) 真实 Tauri 桌面大历史点测：点击大历史后确认最近窗口出现、右栏显示“窗口就绪”、无后台 full-load 指标、滚动/输入/发送可响应；2) 设计并实现显式 full-history intent，例如搜索框输入后再按需拉完整历史索引，避免普通浏览付出完整 payload 成本；3) 继续做 cc-gui 与本项目真实运行画面并排截图审计，覆盖输入区布局、任务/子代理/编辑状态层级、provider/model selector 图标对齐和右栏密度；4) 继续审计重复入口，重点看右侧 `StatusPanel` 与输入区状态条在 tasks/subagents/edits/MCP 上是否还存在信息重复。

## 本轮 PLAN 2026-06-19 chat input status popover panel

- 目标：继续优化 Chat 输入区布局排版。当前 `ChatInputStatusTabs` 的 active details panel 渲染在普通文档流里，展开 tasks/subagents/edits/MCP 时会挤占 composer 周边高度；本轮将详情面板改为贴近 cc-gui 状态面板交互的浮层 popover，不参与布局推挤。
- 功能点 1：恢复上下文与差距确认。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取本项目 `ChatInputStatusTabs` / `ButtonArea` / `SelectorDropdown` / `ModelIcon` / `MessageList`，以及 cc-gui `StatusPanel` / `ButtonArea` / `ProviderModelIcon`，确认本项目状态 strip 已 compact，但 active panel 仍是文档流详情块；cc-gui 状态详情为 popover。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，断言打开 tab 时外层容器提供 `relative` 锚点，详情面板带 `chat-input-status-popover-panel absolute bottom-full` 与高 z-index，且仍渲染当前 tab 内容。
- 功能点 4：实现最小展示层改动。验证方式：只调整 `ChatInputStatusTabs` active panel 的 class/布局锚点；不改 openTab 状态、不改 tasks/subagents/edits/MCP 数据派生、不改右侧 `StatusPanel`、不改历史加载。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 composer strip 的详情层应是浮层 quick detail，不参与 composer 文档流高度。
- 功能点 6：质量验证。验证方式：运行定向 `ChatInputStatusTabs` 测试、相邻 status/composer 测试、`npm test`、`npm run build`、Rust check/test、IDE build 和 diff 空白检查；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat input status popover panel

- 上轮实际进展：上一轮已把大会话普通历史点击收口为 `windowed` 完成态，不再自动拉完整历史 payload；代码复查确认 `src/stores/useChatStore.ts` partial window 后会写入 `windowed` metrics 并返回，`StatusPanel` 会显示“窗口就绪”。已知阻塞仍是真实 Tauri 桌面大会话体感点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：CodeGraph 对标显示 cc-gui `webview/src/components/StatusPanel/StatusPanel.tsx` 的 tasks/subagents/files 详情是 tab header 下的 popover 内容；本项目 `src/components/chat/ChatInputStatusTabs.tsx` 虽已将 collapsed entries 收口为 quick-entry chip，但 active panel 仍以 `mt-1` 普通块渲染，展开时会参与输入区周边布局高度。
- 本轮诊断（超越 cc-gui）：本项目保留右侧 `StatusPanel` 的完整诊断和输入区 strip 的小屏 fallback，比 cc-gui 信息层级更完整；将 composer strip 详情改为 anchored popover 后，用户打开 tasks/subagents/edits/MCP 只是在输入区上方临时查看，不会推挤 composer、消息列表或底部操作按钮，直接缓解“输入区域布局排版不合理”和“页面元素挤”的痛点。
- 本轮规划：只改 `ChatInputStatusTabs` 的布局 class 和测试，不改 openTab、状态 summary 派生、MCP 数据、右侧状态面板、历史加载或 provider/model 图标。优先级中高：用户价值中高（减少展开详情导致的布局跳动）、出现频率高（composer 常驻）、实现成本低（单组件 + 测试）、风险低（纯展示层）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增回归 `renders the open status details as an anchored popover so composer layout is not pushed`，覆盖 strip 容器 `relative` 锚点、详情面板 `chat-input-status-popover-panel absolute bottom-full z-[30]` 和内容保留。`src/components/chat/ChatInputStatusTabs.tsx` 将状态 strip 内容容器改为相对定位，并将 active panel 改为 `bottom-full` 绝对定位浮层，增加最大高度与内部滚动，避免详情过长时挤压输入区。`.trellis/spec/frontend/component-guidelines.md` 已同步 composer strip quick-detail popover 契约。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 1 项，失败点为缺少 `relative` 锚点和 `chat-input-status-popover-panel`。GREEN：同命令通过（1 file / 10 tests）。相邻验证通过：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx`（4 files / 39 tests）；`npm test -- src/components/chat/composer/SelectorDropdown.test.tsx src/components/chat/composer/ButtonArea.test.tsx`（2 files / 8 tests）。全量验证通过：`npm test`（36 files / 314 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做状态 strip 展开/收起视觉点测；因此浮层在真实窗口尺寸、窗口边缘和不同主题下的最终视觉表现仍需下一轮截图确认。
- 下一步候选：1) 真实 Tauri 桌面点测输入区状态 popover：打开 tasks/subagents/edits/MCP 时 composer 不跳动、浮层不遮挡关键按钮、长列表可滚动；2) 真实 Tauri 桌面大会话点测：确认 `windowed` 入口体感、右栏“窗口就绪”、滚动/输入/发送响应；3) 设计显式 full-history intent：搜索或展开早期历史时再拉完整历史，避免普通浏览付出全量 payload 成本；4) 继续做 cc-gui 与本项目运行画面并排截图审计，重点覆盖 provider/model selector 图标对齐、任务/子代理/编辑信息层级和输入区布局。

## 本轮 PLAN 2026-06-19 chat input status popover dismiss

- 目标：补齐输入区状态浮层的关闭交互。上一轮已把 `ChatInputStatusTabs` 详情改为 anchored popover，但当前只能再次点击同一 tab 关闭；本轮增加点击浮层外部和按 `Escape` 关闭，避免临时详情层持续遮挡输入区上方内容。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 对标诊断。验证方式：读取本项目 `ChatInputStatusTabs.tsx` / 测试与 cc-gui `webview/src/components/StatusPanel/StatusPanel.tsx`，确认 cc-gui popover 有 outside-click close，本项目状态浮层缺少外部点击/Escape 关闭。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，先断言本地 helper 对 inside/outside click 与 Escape/非 Escape key 的关闭判断；初始 RED 为 helper 尚未导出。
- 功能点 4：实现最小交互改动。验证方式：`ChatInputStatusTabs` 增加 root ref 和 `useEffect`，仅在 `activeOpenTab` 存在时监听 `mousedown` / `keydown`，用纯 helper 判断关闭；不改 tab 数据派生、不改浮层布局、不改右侧 `StatusPanel`。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 composer strip quick-detail popover 应支持 outside click 和 Escape dismissal。
- 功能点 6：质量验证。验证方式：运行定向 `ChatInputStatusTabs` 测试、相邻 status/composer 测试、全量 `npm test`、`npm run build`、Rust check/test、IDE build 和 diff 空白检查；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat input status popover dismiss

- 上轮实际进展：上一轮记录声称输入区状态详情已从文档流块改为 anchored popover；代码复查确认 `src/components/chat/ChatInputStatusTabs.tsx` 的详情面板已具备 `chat-input-status-popover-panel absolute bottom-full z-[30]`，测试也覆盖了不推挤 composer 布局。仍未做真实 Tauri 桌面状态浮层视觉/点击点测。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：CodeGraph 对标显示 cc-gui `webview/src/components/StatusPanel/StatusPanel.tsx` 的浮层打开时会监听外部点击并关闭；本项目 `ChatInputStatusTabs` 上一轮虽已改为浮层，但只能再次点击同一 tab 关闭。用户打开 tasks/subagents/edits/MCP 详情后，如果继续操作输入区或消息区，浮层会持续遮挡输入区上方内容。
- 本轮诊断（超越 cc-gui）：本项目输入区状态条承担小屏 fallback 和快速查看职责，比右侧 `StatusPanel` 更靠近用户的输入动作；因此 quick-detail popover 必须具备轻量关闭路径。outside click 解决“看完后继续点别处仍被遮挡”的痛点，`Escape` 解决键盘流用户不想离开输入区也能收起浮层的痛点。
- 本轮规划：只改 `ChatInputStatusTabs` 浮层关闭交互和测试，不改 tasks/subagents/edits/MCP 数据派生、不改浮层定位、不改右侧 `StatusPanel`、不改大会话加载策略。优先级中高：用户价值中高（减少遮挡和误停留）、出现频率高（composer 常驻）、实现成本低（单组件 + helper 测试）、风险低（监听仅在 open tab 存在时启用）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增回归 `treats outside pointer events and Escape as status popover dismiss actions`，覆盖 inside/outside pointer 与 Escape/非 Escape key 的关闭判断。`src/components/chat/ChatInputStatusTabs.tsx` 新增 `shouldDismissInputStatusPopoverForPointer()`、`shouldDismissInputStatusPopoverForKey()`、`popoverRootRef` 和 open 状态下的 `mousedown` / `keydown` 监听；外部点击或 Escape 时调用 `setOpenTab(null)`，组件卸载或关闭后自动移除监听。`.trellis/spec/frontend/component-guidelines.md` 已同步 composer strip quick-detail popover 应支持 outside click 和 Escape dismissal。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 1 项，失败点为 `shouldDismissInputStatusPopoverForPointer is not a function`。GREEN：同命令通过（1 file / 11 tests）。相邻验证通过：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/SelectorDropdown.test.tsx`（5 files / 41 tests）；`npm test -- src/utils/chatStatusSummary.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatNavigation.test.ts`（3 files / 33 tests）。全量验证通过：`npm test`（36 files / 315 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、`npm run build`、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做状态浮层 outside click / Escape 点测；因此真实窗口尺寸、焦点状态和主题下的最终交互仍需下一轮手动确认。
- 下一步候选：1) 真实 Tauri 桌面点测输入区状态 popover：打开 tasks/subagents/edits/MCP 后点击消息区、输入框、右栏并按 Escape，确认浮层关闭且 composer 不跳动；2) 真实 Tauri 桌面大会话点测：确认 `windowed` 最近窗口出现、右栏“窗口就绪”、滚动/输入/发送响应；3) 设计显式 full-history intent：搜索或展开早期历史时再拉完整历史，避免普通浏览付出全量 payload 成本；4) 做 cc-gui 与本项目运行画面并排截图审计，重点覆盖 provider/model selector 图标对齐、任务/子代理/编辑信息层级和输入区布局；5) 继续审计重复入口，重点看右侧 `StatusPanel` 与输入区状态条在 tasks/subagents/edits/MCP 上是否还存在信息重复。

## 本轮 PLAN 2026-06-19 chat input status desktop fallback density

- 目标：减少宽屏桌面下输入区状态条与右侧 `StatusPanel` 的功能重复。当前 `StatusPanel` 在 `xl` 断点可见时已经承载 tasks/subagents/edits/MCP 详情，但 `ChatInputStatusTabs` 仍在 composer 上方渲染同类 quick tabs；本轮将这些 expandable status tabs 收口为小屏 fallback，宽屏仅保留 Git 分支上下文。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 对标诊断。验证方式：读取本项目 `ChatInputStatusTabs.tsx` / 测试 / `ChatPage.tsx` 与 cc-gui `StatusPanel`，确认右侧状态面板是桌面主详情区，输入区 strip 应承担小屏 fallback 和 Git 近输入上下文。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，断言 `collapseStatusTabsOnDesktop` 开启时 tasks/subagents/edits/MCP tab 带 `xl:hidden`，Git chip 不带 `xl:hidden`，打开 tab 的 popover 也带 `xl:hidden`。
- 功能点 4：实现最小展示层改动。验证方式：`ChatInputStatusTabs` 新增展示层 prop 并在 tab/panel class 上响应；`ChatPage` 在右侧 `StatusPanel` 存在的桌面布局中传入该 prop；不改 status summary 派生、不改 Zustand、不改右侧 `StatusPanel` 数据。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/frontend/state-management.md`，记录 composer status tabs 是小屏 fallback，桌面右栏可见时不应重复同类 expandable tabs。
- 功能点 6：质量验证。验证方式：运行定向 `ChatInputStatusTabs` 测试、相邻 status/composer 测试、全量 `npm test`、`npm run build`、Rust check/test、IDE build 和 diff 空白检查；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat input status desktop fallback density

- 上轮实际进展：上一轮已补齐输入区状态 popover 的 outside click / `Escape` 关闭；代码复查确认 `src/components/chat/ChatInputStatusTabs.tsx` 已有 `popoverRootRef`、open 状态下的 `mousedown` / `keydown` 监听和纯 helper 测试。仍未做真实 Tauri 桌面 popover 点击点测。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：CodeGraph 显示本项目 `src/pages/ChatPage.tsx` 的右侧 `StatusPanel` 在 `xl` 断点通过 `hidden xl:block` 常驻，已承载 tasks/subagents/edits/MCP 详情；`ChatInputStatusTabs` 同时在 composer 上方渲染同类 expandable tabs。cc-gui 的状态详情更集中在状态面板/浮层里，本项目宽屏下出现了用户指出的“页面元素功能重复”。
- 本轮诊断（超越 cc-gui）：输入区状态条在本项目仍有价值，但应该聚焦小屏 fallback 和发送前上下文。把 tasks/subagents/edits/MCP tabs 设为 `xl:hidden` 后，桌面用户主要看右栏完整诊断，窄屏用户仍能在 composer 附近展开 quick detail；Git 分支 chip 保留在桌面，因为它不是重复详情面板，而是发送前的轻量工作区上下文。
- 本轮规划：只做展示层密度收口，不改 `buildChatStatusSummary()`、`mergeChatInputStatusSummary()`、Zustand、MCP/任务/编辑数据来源，也不改右侧 `StatusPanel`。优先级中高：用户价值中高（直接减少重复入口和输入区拥挤）、出现频率高（Chat 常驻）、成本低（单组件 prop + 页面传参 + 测试/规范）、风险低（CSS 响应式隐藏，数据仍可用）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增回归 `keeps expandable status tabs as a small-screen fallback when the desktop status panel is visible`，RED 时失败点为旧实现缺少 `xl:hidden`。`src/components/chat/ChatInputStatusTabs.tsx` 新增 `collapseStatusTabsOnDesktop` 展示 prop；开启时 tasks/subagents/edits/MCP tab 和 popover 带 `xl:hidden`，无 Git 且只有 status tabs 时整个 strip 在桌面隐藏，避免空边框占位；Git chip 不带 `xl:hidden`。`src/pages/ChatPage.tsx` 在渲染 `ChatInputStatusTabs` 时传入 `collapseStatusTabsOnDesktop`，与同布局下 `StatusPanel` 的 `hidden xl:block` 对齐。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步该展示层契约。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 1 项，失败点为旧实现没有桌面 fallback class。GREEN：同命令通过（1 file / 12 tests）。相邻验证通过：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/SelectorDropdown.test.tsx`（5 files / 42 tests）；`npm test -- src/utils/chatStatusSummary.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatNavigation.test.ts`（3 files / 33 tests）。全量验证通过：`npm test`（36 files / 316 tests，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE build 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做宽屏/窄屏视觉点测；因此 `xl` 断点下右栏与 composer 状态条的真实视觉密度仍需下一轮截图确认。
- 下一步候选：1) 真实 Tauri 桌面截图/点测：宽屏确认 tasks/subagents/edits/MCP 只在右栏出现、Git chip 保留，窄屏确认 quick tabs 仍可展开；2) 做 cc-gui 与本项目运行画面并排截图审计，覆盖输入区布局、右栏密度、provider/model selector 图标对齐和大会话加载指标；3) 继续设计显式 full-history intent：搜索或展开早期历史时再拉完整历史，避免普通浏览付出全量 payload 成本；4) 继续审计输入区功能入口，尤其 provider/model/mode/reasoning/refresh/enhance/send 在窄宽下是否还有可合并或可降噪的重复信息。

## 本轮 PLAN 2026-06-19 chat runtime layout smoke desktop mobile

- 目标：补齐上一轮缺失的真实运行态布局验证。基于 Vite Web 运行环境检查 Chat 页面在宽屏 `xl` 和窄屏下的状态面板、输入区状态 strip、composer toolbar 和状态浮层关闭交互，确认上一轮“桌面右栏主诊断、小屏 composer fallback”的展示层契约是否真的生效。
- 功能点 1：恢复上下文。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 仍不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 复核组件边界。验证方式：读取 `ChatInputStatusTabs` / `ChatPage` / `StatusPanel` 相关源码，确认本轮只验证上一轮展示层契约，不扩大到 store、后端命令或历史加载策略。
- 功能点 3：启动本地运行态并检查 Web 限制。验证方式：运行 `npm run dev -- --host 127.0.0.1 --port 5173`，打开 `http://127.0.0.1:5173/#/chat`，记录是否出现 Tauri bridge 限制；若出现，明确标注 Vite Web 不等同于真实 Tauri 桌面验证。
- 功能点 4：宽屏/窄屏布局烟测。验证方式：在 `1440x900` 检查 `chat-status-pane-shell hidden xl:block` 可见、`chat-input-status-tabs ... xl:hidden` 隐藏、composer action buttons 固定 28px；在 `900x800` 检查右栏隐藏、输入区 status strip 可见、输入框和主操作按钮未被挤压。
- 功能点 5：小屏 fallback 浮层交互烟测。验证方式：点击 `MCP 0 / 0` 入口，检查 `chat-input-status-popover-panel absolute bottom-full` 出现在 strip 上方、不推挤 textarea；点击 textarea 和按 `Escape` 后浮层关闭。
- 功能点 6：质量验证与清理。验证方式：运行相邻 Chat UI 测试、`npm run build`、`git diff --check`、`git diff --cached --check`；恢复浏览器视口，停止本轮 Vite 服务。

## 迭代记录 2026-06-19 chat runtime layout smoke desktop mobile

- 上轮实际进展：上一轮记录声称 `ChatInputStatusTabs` 已通过 `collapseStatusTabsOnDesktop` 把 tasks/subagents/edits/MCP tabs 收口为小屏 fallback；代码复查确认 `src/components/chat/ChatInputStatusTabs.tsx` 的 root strip、tab 和 popover 均具备 `xl:hidden` 条件，`src/pages/ChatPage.tsx` 已传入该 prop，`src/components/chat/ChatInputStatusTabs.test.tsx` 已覆盖桌面 fallback class。已知阻塞是未做真实运行态宽/窄屏点测。
- 本轮诊断（补齐 cc-gui）：cc-gui 在桌面下集中展示状态详情，本项目上一轮已按同类信息层级把桌面诊断交给右栏 `StatusPanel`，但此前只有单元测试与构建验证，缺少运行态 CSS 断点证据。用户指出“页面元素功能重复、输入区布局排版不合理”，因此需要确认 `xl` 断点下重复入口确实消失，而不是只在测试字符串层面存在。
- 本轮诊断（超越 cc-gui）：本项目比 cc-gui 多了小屏 composer fallback 和右侧完整诊断的双层信息架构；运行态验证的价值是确认这两层在不同宽度下互斥承接，避免桌面重复、窄屏丢信息，并确认浮层不推挤输入区，解决用户在真实窗口中感受到的“挤在一起”和“元素重复”。
- 本轮规划：本轮只做验证和记录，不改业务代码。优先级高：用户价值高（补上上一轮最大未验证项）、出现频率高（Chat 首屏常驻）、实现成本低（运行态检查 + 相邻测试）、风险低（不改源码）。
- 本轮完成：启动 Vite Web 并打开 Chat 页面；`1440x900` 下实测 `chat-status-pane-shell hidden xl:block` display 为 `block`、右栏宽 320px，`chat-input-status-tabs ... xl:hidden` display 为 `none`，MCP 状态 tab display 为 `none`，composer enhance/send 按钮均为 `28x28` 且 selector icon box 为 `16x16`。`900x800` 下实测右栏和拖拽条 display 为 `none`，输入区 status strip display 为 `block`，MCP fallback tab display 为 `flex`，textarea 与 toolbar/actions 仍有稳定尺寸。小屏点击 `MCP 0 / 0` 后，`chat-input-status-popover-panel absolute bottom-full ... xl:hidden` 可见，浮层位于 strip 上方且 textarea 位置未变化；点击 textarea 后浮层关闭，重新打开后在输入框按 `Escape` 也关闭。浏览器视口已 reset，端口 `5173` 的 Vite node 进程已停止。
- 本轮验证：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/SelectorDropdown.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx` 通过（5 files / 42 tests）。`npm run build` 通过（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。`git diff --check` exit 0，仅输出既有 LF/CRLF 转换提示；`git diff --cached --check` exit 0。Vite Web 运行受限项：页面可渲染 Chat 主体，但 MCP 区域出现 `TypeError: Cannot read properties of undefined (reading 'invoke')`，原因是 Web 环境没有 Tauri bridge；因此本轮只能证明 DOM/CSS 布局合同，不能等同于真实 Tauri 桌面端完整功能验证。
- 未验证项：未启动 `npm run tauri dev` 做真实桌面窗口截图/点击验证；未用真实历史大会话复测 `windowed` 加载体感；未做 cc-gui 与本项目并排截图审计。
- 下一步候选：1) 启动真实 Tauri 桌面做宽/窄窗口截图点测，重点验证 Tauri bridge 下 MCP 错误不出现、右栏/输入区层级与 Web 烟测一致；2) 用真实大历史会话点测 `windowed` 首屏、右栏“窗口就绪”、滚动和输入响应，定位剩余卡顿来自后端 tail reader、IPC payload、React commit 还是摘要构建；3) 做 cc-gui 与本项目并排截图审计，继续检查任务列表、会话列表、provider/model/mode/reasoning/refresh/enhance/send 的重复入口和对齐；4) 设计显式 full-history intent：搜索或跳到更早历史时才拉完整历史，避免普通浏览触发全量 payload。

## 本轮 PLAN 2026-06-19 chat windowed history summary gate

- 目标：继续处理用户反馈的“大历史会话加载到聊天区域仍卡顿”。上一轮已验证布局，本轮聚焦前端普通浏览路径：当后端返回 `windowed` 大会话时，`ChatPage` 不再在 idle 回调中对整个已加载窗口再次构建完整状态摘要，只保留可见尾部摘要，减少加载后额外 raw/tool 扫描。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `useChatStore.loadSession()`、`MessageList`、`ChatPage`、`chatStatusSummary` 与 cc-gui `MessageList`，确认本项目已 window-first 和最近消息渲染，但 `ChatPage` 仍会对 `messages` 窗口构建 idle 完整摘要。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/utils/chatUiBehavior.test.ts`，断言新的纯判断函数在 `sessionLoadStatus: 'windowed'` 且非搜索、消息非空时返回 false；非 windowed 完成态仍返回 true，搜索/空消息返回 false。
- 功能点 4：实现最小行为改动。验证方式：在 `src/utils/chatUiBehavior.ts` 增加 `shouldBuildCompleteChatStatusSummary()`，`ChatPage` 的 idle 完整摘要 effect 使用该 gate；不改 `loadSession()`、不改后端 `get_unified_session_message_window`、不改 `MessageList` 渲染窗口。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/state-management.md` 和 `.trellis/spec/frontend/component-guidelines.md`，记录 `windowed` 大会话普通浏览不应触发全窗口状态摘要，未来完整摘要只能来自显式 full-history intent。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `chatUiBehavior` 测试、相邻 Chat 状态/导航/store 测试、`npm run build`、必要 Rust check、diff 空白检查；真实 Tauri 大会话体感若未执行需明确标注。

## 迭代记录 2026-06-19 chat windowed history summary gate

- 上轮实际进展：上一轮已用 Vite Web 对宽屏/窄屏 Chat 布局做运行态 smoke，确认桌面 `xl` 下右侧 `StatusPanel` 可见、输入区 tasks/subagents/edits/MCP quick tabs 隐藏，窄屏下输入区 fallback tabs 与 popover 可用；同时确认 Vite Web 没有 Tauri bridge，MCP 区域会出现 `invoke` 相关错误，不能等同真实 Tauri 桌面验证。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：本项目已通过 `useChatStore.loadSession()` 的 `windowed` 首屏策略和 `MessageList` 的最近消息窗口降低首屏压力，但 `ChatPage` 仍在 idle callback 中对整个当前 `messages` 窗口执行 `buildChatStatusSummary(messages)`，即使该窗口来自大历史 `windowed` 普通浏览。对大历史来说，这会在加载后继续扫描 120 条左右 raw/tool payload，形成用户感知的“首屏出来后仍卡一下”。cc-gui 的目标体验是最近内容先可读、状态信息按需展开，本项目这里还存在普通浏览路径上的额外摘要工作。
- 本轮诊断（超越 cc-gui）：本项目右栏和输入区状态条提供比 cc-gui 更丰富的 tasks/subagents/edits/MCP 摘要，但这些摘要不能以牺牲大会话进入体验为代价。`windowed` 普通浏览时只保留可见尾部摘要，完整摘要留给未来显式搜索/展开历史意图，可以解决“我只是想看最近回复，却被隐藏的历史统计拖慢”的痛点。
- 本轮规划：只给完整状态摘要构建增加纯函数 gate，不改 `loadSession()`、不改后端窗口读取、不改 `MessageList` 可见窗口、不改搜索行为。优先级高：用户价值高（直接对应大会话卡顿反馈）、出现频率中高（所有大型历史点击）、成本低（一个 helper + 一个 effect guard + 规范同步）、风险低（`complete` / `null` 状态仍保留原完整摘要行为，搜索仍不构建该 idle 摘要）。
- 本轮完成：`src/utils/chatUiBehavior.ts` 新增 `shouldBuildCompleteChatStatusSummary()`，规则为有消息、非搜索且 `sessionLoadStatus !== 'windowed'` 才允许构建完整摘要。`src/pages/ChatPage.tsx` 在 idle 完整摘要 effect 入口调用该 gate；`windowed` 时立即清空 `completeStatusSummaryState` 并返回，不再排队 `requestIdleCallback` / `setTimeout` 扫描完整当前窗口。`src/utils/chatUiBehavior.test.ts` 新增回归 `skips complete status summary work for windowed large-history browsing`，覆盖 `windowed` 跳过、`complete` / `null` 保留、搜索/空消息跳过。`.trellis/spec/frontend/state-management.md` 和 `.trellis/spec/frontend/component-guidelines.md` 已同步约定：自动加载的 `windowed` history 普通浏览不应触发全窗口 complete status summary，未来完整历史摘要只能来自显式 full-history intent。
- 本轮验证：RED：`npm test -- src/utils/chatUiBehavior.test.ts` 先失败，失败点为 `shouldBuildCompleteChatStatusSummary is not a function`。GREEN：同命令通过（1 file / 14 tests）。相邻链路验证通过：`npm test -- src/utils/chatUiBehavior.test.ts src/utils/chatStatusSummary.test.ts src/utils/chatNavigation.test.ts src/stores/useChatStore.test.ts`（4 files / 87 tests）。构建验证通过：`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。全量前端验证通过：`npm test`（36 files / 317 tests，仅 Browserslist/caniuse-lite 过期提示）。空白检查通过：`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。
- 未验证项：本轮未跑 `cargo check --manifest-path src-tauri/Cargo.toml` / Rust 测试，因为改动仅限前端页面、前端纯 helper、前端测试和 Trellis 规范；未启动真实 Tauri 桌面，也未用真实大历史会话做体感点测，因此实际桌面卡顿改善仍需下一轮确认。
- 下一步候选：1) 真实 Tauri 桌面大历史点测：点击大历史后确认最近窗口出现、右栏显示“窗口就绪”、加载后不再因 complete status summary 出现额外停顿，并观察滚动/输入/发送响应；2) 若仍卡，继续拆分定位后端 tail reader、IPC payload、`mapHistoryMessages`、React commit、`getRecentRenderableMessages` / anchor/status 派生的耗时；3) 设计显式 full-history intent：搜索全历史或展开更早历史时再按需读取/索引完整历史，普通浏览保持 windowed；4) 做 cc-gui 与本项目真实运行画面并排截图审计，重点看任务列表、会话列表、输入区按钮、provider/model 图标对齐和右栏密度；5) 继续审计重复入口，尤其右侧 `StatusPanel` 与输入区状态条、任务列表与会话列表之间是否还存在同类信息重复。

## 本轮 PLAN 2026-06-19 chat explicit full-history search intent

- 目标：补齐上一轮留下的显式 full-history intent。普通历史点击已经保持 `windowed`，但搜索仍只过滤当前窗口；本轮让用户输入搜索时才显式读取完整历史作为搜索源，普通浏览继续不自动 full-load。
- 功能点 1：恢复上下文与规范。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务制品、`.trellis/spec/frontend/state-management.md`、`.trellis/spec/frontend/component-guidelines.md`、质量规范和共享思考指南；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `useChatStore.loadSession()`、`sessionHistoryCache`、`ChatPage` 搜索路径和 `MessageList`，确认 `MessageList` 搜索目前只消费传入的 `messages`，而 `windowed` 普通浏览不会拥有完整历史。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/stores/useChatStore.test.ts`，断言只有显式 action 会调用 `get_unified_session_messages`，返回完整历史但主 `messages` 保持最近窗口；扩展 `src/utils/chatUiBehavior.test.ts`，断言搜索触发条件仅在 active windowed session 且未加载/未加载中时成立。
- 功能点 4：实现最小行为改动。验证方式：`useChatStore` 新增 `loadActiveSessionFullHistory()`，复用完整历史缓存、token/active-session ownership 和分块映射；`ChatPage` 在搜索 windowed 会话时触发该 action，并把返回完整历史作为临时 `MessageList` / anchor / status 搜索源，不改普通浏览主 `messages`。
- 功能点 5：同步 Trellis 规范。验证方式：更新 state/component 规范，把“未来 full-history intent”改为当前搜索实现，并记录完整历史只作为搜索源和缓存，不得回灌普通 transcript。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向测试、相邻历史/导航/状态测试、全量 `npm test`、`npm run build`、IDE build、`git diff --check` / `git diff --cached --check`，清理 IDE 生成的 `out/`。

## 迭代记录 2026-06-19 chat explicit full-history search intent

- 上轮实际进展：上一轮把 `windowed` 大历史普通浏览下的 idle 完整状态摘要扫描关掉；代码复查确认 `ChatPage` 已通过 `shouldBuildCompleteChatStatusSummary()` 在 `windowed` 状态跳过 `buildChatStatusSummary(messages)`。已知阻塞仍是真实 Tauri 桌面大历史体感未验证。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：`loadSession()` 已按规范不再自动调用 `get_unified_session_messages()`，但 `ChatPage` 搜索仍只对当前 `messages` 过滤；`MessageList` 在搜索态会扫描它收到的 `messages`，因此大历史 `windowed` 会话只能搜最近窗口，无法覆盖早期历史。cc-gui 对标里的历史搜索应能作为明确用户意图进入更大范围，而不是让普通浏览承担全量成本。
- 本轮诊断（超越 cc-gui）：搜索是明确、高意图、高价值动作，适合承担完整历史读取成本；普通打开历史则只需要最近窗口快速可读。把 full-history 绑定到搜索输入解决两个痛点：普通浏览不卡，用户真正搜索时又不会误以为“没有结果”只是因为旧历史没加载。
- 本轮规划：本轮只实现搜索触发的 full-history intent，不做 reveal-all、不做新 UI 文案、不改后端命令、不改首屏窗口大小。优先级高：用户价值高（搜索历史正确性 + 大会话性能边界）、出现频率中（大历史搜索）、实现成本中低（store action + 页面接入 + 测试）、风险可控（主 `messages` 不全量回灌，普通 loadSession 测试继续保证不自动 full-load）。
- 本轮完成：`src/stores/useChatStore.ts` 新增 `loadActiveSessionFullHistory()`，只在显式调用时执行 `get_unified_session_messages()`；命中 `sessionHistoryCache` 时直接返回完整历史并更新 metrics，未命中时读取完整历史、分块映射、用 token 和 active session key 防止 stale 写入，缓存完整历史，但不替换当前可见 `messages`。`src/pages/ChatPage.tsx` 新增 page-local `fullHistorySearchState`；搜索 `windowed` 会话时触发 store action，完整历史返回后作为 `searchSourceMessages` 传给 `MessageList`，并用于搜索态 anchor/status 派生；搜索清空后释放 page-local full-history search state。`src/utils/chatUiBehavior.ts` 新增 `shouldRequestFullHistoryForSearch()`，集中判断搜索触发条件。测试文件 `src/stores/useChatStore.test.ts` 和 `src/utils/chatUiBehavior.test.ts` 覆盖显式 full-history 调用、缓存复用、主 `messages` 保持 windowed、触发条件去重。`.trellis/spec/frontend/state-management.md` 与 `.trellis/spec/frontend/component-guidelines.md` 已同步当前契约。
- 本轮验证：RED：`npm test -- src/stores/useChatStore.test.ts` 先失败，失败点为 `loadActiveSessionFullHistory is not a function`；`npm test -- src/utils/chatUiBehavior.test.ts` 先失败，失败点为 `shouldRequestFullHistoryForSearch is not a function`。GREEN：`npm test -- src/stores/useChatStore.test.ts` 通过（1 file / 54 tests），`npm test -- src/utils/chatUiBehavior.test.ts` 通过（1 file / 15 tests）。相邻链路验证通过：`npm test -- src/stores/useChatStore.test.ts src/utils/chatUiBehavior.test.ts src/utils/chatNavigation.test.ts src/utils/chatStatusSummary.test.ts`（4 files / 89 tests）。构建验证通过：`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。全量前端测试通过：`npm test`（36 files / 319 tests，仅 Browserslist/caniuse-lite 过期提示）。IDE `build_project` 通过，`problems: []`；IDE build 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。`git diff --check` 与 `git diff --cached --check` exit 0，仅输出既有 LF/CRLF 转换提示。
- 未验证项：未启动真实 Tauri 桌面做大历史搜索点测；未跑 Rust check/test，因为本轮没有改 Rust 后端命令或模型。实际桌面里完整历史搜索的读取耗时、IPC 体感、搜索结果跳转仍需下一轮验证。
- 下一步候选：1) 真实 Tauri 桌面大历史搜索点测：先确认普通打开仍是 `windowed`，输入早期历史关键字后触发完整读取并出现早期命中；2) 若搜索 full-load 仍卡，下一轮把 full-history search source 改成分页/索引式搜索，而不是一次性返回完整数组；3) 做 cc-gui 与本项目真实运行画面并排截图审计，覆盖任务列表、会话列表、输入区按钮、provider/model 图标对齐、右栏密度和搜索反馈；4) 给搜索加载态补更明确的 UI 反馈，例如搜索框附近的轻量“正在搜索完整历史”状态，但需要避免增加输入区噪音；5) 继续审计重复入口，尤其右侧 `StatusPanel` 与输入区状态条、任务列表与会话列表的信息层级。

## 本轮 PLAN 2026-06-19 chat full-history search feedback

- 目标：补齐上一轮显式 full-history search intent 的可见反馈。当前 `windowed` 大历史搜索会在后台读取完整历史，但消息区顶部仍只显示当前窗口的匹配数/无结果，用户会误以为“搜索没生效”或“没有更早结果”。本轮只做轻量展示层反馈，不改普通浏览 windowed 策略、不改 store 完整历史缓存、不新增后端命令。
- 功能点 1：恢复上下文与规范。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/state-management.md`、`package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断搜索边界。验证方式：读取 `ChatPage`、`MessageList`、`chatUiBehavior` 和现有搜索/i18n 入口，确认 `MessageList` 只做展示，完整历史读取仍由 `ChatPage` 和 `useChatStore.loadActiveSessionFullHistory()` 拥有。
- 功能点 3：补 RED 测试。验证方式：新增/扩展 `MessageList` SSR 测试，断言搜索状态为 `loading` 时顶部提示完整历史正在搜索，`error` 时显示错误提示和重试按钮，`complete` 时回到匹配结果文本。
- 功能点 4：实现最小展示改动。验证方式：`MessageList` 增加只读 `fullHistorySearchStatus` / `onRetryFullHistorySearch` props，`ChatPage` 从 page-local `fullHistorySearchState` 派生并传入；新增 en/zh i18n 文案；失败态重试只清理当前 page-local 状态，让现有 effect 重新走显式 full-history intent。
- 功能点 5：质量验证与记录。验证方式：运行 RED/GREEN 定向测试、相邻 Chat UI 测试、`npm run build`、`npm test`、`git diff --check`、`git diff --cached --check`；若未启动 Tauri 桌面或未真实大历史点测，明确标注。

## 迭代记录 2026-06-19 chat full-history search feedback

- 上轮实际进展：上一轮实现了显式 full-history search intent：普通历史点击保持 `windowed` 最近窗口，只有用户输入搜索时才调用 `loadActiveSessionFullHistory()` 并把完整历史作为临时搜索源；代码复查确认主 `messages` 没有被完整历史回灌。阻塞仍是未启动真实 Tauri 桌面做大历史搜索体感点测。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：`ChatPage` 已能在 `windowed` 搜索时后台拉取完整历史，但 `MessageList` 顶部仍只显示当前搜索结果数或“没有找到匹配消息”。在完整历史尚未返回时，这个提示会把“当前窗口暂无结果”误表达成最终搜索结果，容易让用户认为搜索没有覆盖更早历史。
- 本轮诊断（超越 cc-gui）：本项目为了大会话性能把普通浏览和完整历史搜索分开，这是正确的，但需要把这个异步边界告诉用户。轻量显示“正在搜索完整历史”和失败重试，可以解决两个痛点：用户知道旧历史仍在搜索，不会误判无结果；失败时仍可继续搜当前窗口并显式重试，而不是悄悄退化。
- 本轮规划：只做展示层和 page-local retry，不改 `useChatStore.loadSession()`、不改 `loadActiveSessionFullHistory()`、不改后端命令、不把重试状态放进 Zustand。优先级中高：用户价值高（补齐搜索正确性的可感知反馈）、出现频率中（大历史搜索）、成本低（展示 props + i18n + SSR 测试）、风险低（普通浏览与完整历史缓存策略不变）。
- 本轮完成：新增 `src/components/chat/MessageList.test.tsx`，覆盖 full-history 搜索 loading/error/complete 三种提示。`src/components/chat/MessageList.tsx` 增加只读 `fullHistorySearchStatus` 和 `onRetryFullHistorySearch` props；搜索条保留当前匹配数，同时在 loading 时显示 spinner + “正在搜索完整历史”，在 error 时显示警告 + 重试按钮。`src/pages/ChatPage.tsx` 从当前 `activeSessionKey`、`lastSessionLoadMetrics.status` 和 page-local `fullHistorySearchState` 派生 `fullHistorySearchStatus`；失败重试通过清空 page-local snapshot 并递增 retry counter 触发现有显式搜索 effect 重新执行。`src/locales/en.json` 与 `src/locales/zh.json` 新增三条搜索状态文案。`.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/frontend/state-management.md` 已同步记录该展示与状态边界。
- 本轮验证：RED：`npm test -- src/components/chat/MessageList.test.tsx` 先失败，失败点为 loading/error 文案不存在；测试夹具先补齐 `react-i18next` / `dompurify` SSR mock 后得到业务级 RED。GREEN：同命令通过（1 file / 3 tests）。相邻链路验证通过：`npm test -- src/components/chat/MessageList.test.tsx src/utils/chatUiBehavior.test.ts src/utils/chatNavigation.test.ts src/stores/useChatStore.test.ts`（4 files / 85 tests）。构建验证通过：`npm run build`（`tsc && vite build`）。全量前端测试通过：`npm test`（37 files / 322 tests）。IDE `build_project` 通过，`problems: []`；IDE 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。`git diff --check` 与 `git diff --cached --check` exit 0，仅输出既有 LF/CRLF 转换提示。新增测试文件 `src/components/chat/MessageList.test.tsx` 已 `git add`。
- 未验证项：本轮未启动真实 Tauri 桌面，也未用真实大历史会话点测搜索加载体感、早期命中跳转或失败重试；未跑 Rust check/test，因为本轮没有改 Rust 后端命令或模型。
- 下一步候选：1) 启动真实 Tauri 桌面做大历史搜索点测：普通打开保持 `windowed`，输入早期关键字时显示完整历史搜索状态，完整历史返回后早期命中可见；2) 若完整历史搜索仍造成明显卡顿，下一轮改为后端分页/索引式搜索，而不是一次性返回完整数组；3) 做 cc-gui 与本项目并排截图审计，继续检查任务列表、会话列表、输入区按钮、provider/model 图标对齐、右栏密度和搜索反馈；4) 继续审计重复入口，尤其右侧 `StatusPanel`、输入区状态条、搜索条和会话侧栏之间的信息层级。

## 本轮 PLAN 2026-06-19 chat search status scope and spacing

- 目标：继续排查用户反馈的“大历史加载/搜索仍卡”和“个别消息挤成一坨”。本轮只做前端小范围优化：完整历史搜索后，状态摘要只从命中附近的有限上下文构建，避免搜索后再同步扫描整份历史；assistant 内容块改用稳定的块间距类，让 text / thinking / tool 行在紧凑模式下仍可扫描。
- 功能点 1：恢复上下文与规范。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、frontend component/state/quality/type 规范和 shared guides；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：查看 `MessageList` / `MessageItem` / `ContentBlockRenderer` / `ChatPage` / `useChatStore.loadSession()` / 后端 `load_*_message_window`，区分前端渲染窗口、搜索完整历史、状态摘要和后端文件扫描各自成本。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/utils/chatNavigation.test.ts`，断言搜索状态摘要只保留命中消息后的有限上下文，避免纳入未命中的远端历史；扩展 `src/components/chat/ContentBlockRenderer.test.tsx`，断言 compact 渲染暴露稳定 spacing 类。
- 功能点 4：实现最小行为改动。验证方式：在 `chatNavigation` 增加搜索状态摘要上下文 helper，`ChatPage` 搜索态使用该 helper 作为 `buildChatStatusSummary()` 输入；`ContentBlockRenderer` 根节点改为稳定类名并在 `App.css` 定义 compact/default gap；微调 assistant 行间距，不改变工具块组件 API。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md` 和 `.trellis/spec/frontend/state-management.md`，记录完整历史搜索不能把整份历史再次交给状态摘要同步扫描，compact transcript 需要稳定块间距。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向测试、相邻 Chat 导航/状态/渲染测试、`npm run build`、`npm test`、`git diff --check` / `git diff --cached --check`；若未启动真实 Tauri 桌面或未跑 Rust，明确标注。

## 迭代记录 2026-06-19 chat search status scope and spacing

- 上轮实际进展：上一轮记录声称已实现 full-history 搜索反馈；代码复查确认 `ChatPage` 只在 `windowed` 会话搜索时触发 `loadActiveSessionFullHistory()`，完整历史作为 page-local `searchSourceMessages` 传给 `MessageList`，没有回灌主 store `messages`。阻塞仍是未启动真实 Tauri 桌面做大历史点测。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：普通浏览已经 windowed，但完整历史搜索返回后，搜索态 `statusSummary` 仍可能把 `searchSourceMessages` 整份完整历史交给 `buildChatStatusSummary()`，相当于用户搜索后又做一次全历史状态摘要扫描；同时 assistant 历史消息里 `ContentBlockRenderer`、`MessageItem` 和 `.assistant-message-content` 的紧凑间距叠加过小，连续 text / thinking / tool 内容容易读成一坨。cc-gui 的基础体验是长历史可快速定位且工具/思考/正文层次清晰，本项目这两点仍有可感知差距。
- 本轮诊断（超越 cc-gui）：状态摘要不需要在搜索后覆盖未命中的远端历史，只需要命中附近足够上下文来恢复工具状态；这样可以保留“搜索完整历史”的能力，同时避免把搜索成本再放大一轮。紧凑模式也不应等于压缩到不可扫描，稳定块间距能解决用户在长历史里快速分辨正文、思考块和工具块的痛点。
- 本轮规划：只改搜索态状态摘要输入和 assistant 内容块间距，不改后端历史读取、不改 `loadSession()` / `loadActiveSessionFullHistory()`、不新增依赖、不重构工具块 API。优先级高：用户价值高（直接对应“大历史卡顿”和“消息挤成一坨”）、出现频率高（长历史搜索与 assistant 多块输出）、实现成本低（一个纯 helper + 样式契约 + 两个回归测试）、风险低（普通浏览路径和完整历史搜索源保持原行为）。
- 本轮完成：`src/utils/chatNavigation.ts` 新增 `getSearchStatusContextMessages()`，默认最多 80 条、每个命中向后取 16 条上下文，用于搜索态状态摘要限界；`src/pages/ChatPage.tsx` 在搜索态把 `statusMessages` 改为 `getSearchStatusContextMessages(searchSourceMessages, filteredMessages)`，普通浏览仍按可见窗口起点切片。`src/components/chat/ContentBlockRenderer.tsx` 将根节点从 Tailwind `space-y-*` 改为稳定契约类 `chat-content-blocks chat-content-blocks-compact/default`；`src/App.css` 定义 compact/default gap；`src/components/chat/MessageItem.tsx` 移除 assistant content 内层 `space-y-1.5` 并把 assistant 行 padding 调整为 `py-3`；`src/styles/toolBlocks.css` 将 `.assistant-message-content > :not(:first-child)` 间距从 4px 调到 8px。`src/utils/chatNavigation.test.ts` 和 `src/components/chat/ContentBlockRenderer.test.tsx` 分别补充搜索上下文限界与稳定 spacing 类回归。`.trellis/spec/frontend/component-guidelines.md` 与 `.trellis/spec/frontend/state-management.md` 已同步搜索摘要限界和 compact transcript 间距契约。
- 本轮验证：RED：`npm test -- src/components/chat/ContentBlockRenderer.test.tsx` 先失败，失败点为 `chat-content-blocks` 类不存在；`npm test -- src/utils/chatNavigation.test.ts` 先失败，失败点为 `getSearchStatusContextMessages is not a function`。GREEN：两条定向测试通过（ContentBlockRenderer：1 file / 11 tests；chatNavigation：1 file / 14 tests）。相邻链路验证通过：`npm test -- src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatNavigation.test.ts src/utils/chatStatusSummary.test.ts src/utils/chatUiBehavior.test.ts src/stores/useChatStore.test.ts`（5 files / 101 tests）。构建验证通过：`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。全量前端测试通过：`npm test`（37 files / 324 tests，仅 Browserslist/caniuse-lite 过期提示）。IDE `build_project` 通过，`problems: []`；IDE 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。`git diff --check` 与 `git diff --cached --check` exit 0，仅输出既有 LF/CRLF 转换提示。
- 未验证项：本轮未启动真实 Tauri 桌面，也未用真实大历史会话点测搜索后卡顿、消息间距视觉效果、早期命中跳转或输入响应。未跑 `cargo check --manifest-path src-tauri/Cargo.toml` / Rust 测试，因为本轮没有改 Rust 后端命令、模型或 session provider。
- 下一步候选：1) 启动真实 Tauri 桌面做大历史点测：普通打开确认 `windowed` 最近窗口即就绪，搜索早期关键字后确认完整历史搜索状态、命中显示和状态摘要不卡顿；2) 若仍卡，优先优化后端 `load_claude_message_window()` / `load_codex_message_window()` 的从头读全文件策略，考虑 tail reader 或分页/索引式搜索，而不是一次性 parse/IPC 完整 JSONL；3) 做 cc-gui 与本项目真实运行画面并排截图审计，重点覆盖任务列表、会话列表、输入区布局、provider/model/Claude 图标对齐、右栏密度和搜索反馈；4) 继续审计重复入口，尤其右侧 `StatusPanel`、输入区状态条、搜索条和会话侧栏之间的信息层级，避免 tasks/subagents/edits/MCP 在宽屏重复出现。

## 本轮 PLAN 2026-06-19 chat model brand icon alignment

- 目标：回应用户点名的 “Claude 图标不对 / 模型图标不对齐”。本轮只处理 composer provider/model selector 的品牌图标与固定图标盒，不改模型列表来源、不改远程刷新、不改 provider 状态。
- 功能点 1：恢复上下文与规范。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端 component/state/quality 规范和 shared code-reuse guide；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：对标诊断。验证方式：CodeGraph 读取本项目 `ButtonArea` / `ModelIcon` / `SelectorDropdown` / tests；读取 cc-gui `modelIconMapping.ts` 和 `ChatInputBox` toolbar 相关代码，确认 cc-gui 以 vendor 图标为模型图标，本项目模型图标仍用 Gem/Sparkles/Feather/Terminal 等能力隐喻图标。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/composer/ButtonArea.test.tsx`，断言 Claude 模型 selector 使用 Claude LobeHub glyph，Codex/OpenAI 模型 selector 使用统一 Codex/OpenAI glyph，不出现旧 Lucide terminal/sparkles 类；若需要，新增/扩展 `ModelIcon` 纯渲染测试。
- 功能点 4：实现最小展示改动。验证方式：把 `ButtonArea` 内已有 provider SVG 提取到 `ModelIcon.tsx` 共享，`ProviderBrandIcon` 与 `ModelIcon` 共用同一套品牌 glyph；保留现有 `data-chat-model-icon` 语义 kind，新增 glyph data attribute 用于稳定测试；保持 `selector-dropdown-icon-box` 固定尺寸契约。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 provider/model selector 应共用品牌 glyph，不能用装饰性能力图标代替 Claude/OpenAI vendor 图标。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 composer 测试、相邻 selector/composer 测试、全量 `npm test`、`npm run build`、`git diff --check` / `git diff --cached --check`；真实 Tauri 桌面视觉点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat model brand icon alignment

- 上轮实际进展：上一轮已完成搜索态状态摘要限界和 assistant 内容块间距优化；代码复查确认 `src/utils/chatNavigation.ts` 已用 `getSearchStatusContextMessages()` 限制搜索态状态摘要输入，`ContentBlockRenderer` / `MessageItem` / `toolBlocks.css` 已有稳定块间距改动。已知阻塞仍是真实 Tauri 桌面大历史体感和视觉点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui `webview/src/utils/modelIconMapping.ts` 以 vendor/model 映射识别 Claude/Anthropic、OpenAI/GPT/Codex、Qwen、DeepSeek 等图标；本项目 `src/components/chat/composer/ModelIcon.tsx` 仍把 Claude Sonnet 渲染为 `Sparkles`、Opus 渲染为 `Gem`、Codex 渲染为 `Terminal`。这解释了用户反馈的 “Claude 图标不对” 和模型 selector 图标不齐：同一 provider 在 provider selector 与 model selector 使用了两套视觉语言。
- 本轮诊断（超越 cc-gui）：provider selector 和 model selector 都在输入区常驻，用户需要一眼确认当前执行引擎，而不是解读能力隐喻。统一品牌 glyph 后，Claude/Anthropic 模型始终显示 Claude LobeHub glyph，Codex/OpenAI/GPT 模型始终显示 Codex/OpenAI glyph；`data-chat-model-icon` 仍保留 `claude-sonnet` / `codex-codex` 等模型族语义，便于后续做更细模型状态或测试，不牺牲可扩展性。
- 本轮规划：只改 composer 的品牌图标呈现和稳定测试，不改模型列表来源、不改远程刷新、不改 provider 状态、不新增依赖。优先级高：用户价值高（直接修正用户点名问题并提升输入区识别效率）、出现频率高（composer 常驻）、实现成本低（共享 SVG + 测试）、风险低（纯展示层，selector 数据流不变）。
- 本轮完成：`src/components/chat/composer/ButtonArea.test.tsx` 扩展回归，断言 Claude 模型按钮包含 `data-chat-model-icon="claude-sonnet"`、`data-chat-model-icon-glyph="claude-lobehub"` 和 Claude LobeHub path，且不再包含 `lucide-sparkles` / `lucide-gem`；新增 Codex 回归，断言 Codex 模型按钮包含 `data-chat-model-icon="codex-codex"`、`data-chat-model-icon-glyph="codex-openai"`，且不再包含 `lucide-terminal`。`src/components/chat/composer/ModelIcon.tsx` 把模型图标从 Lucide 能力隐喻改为品牌 glyph 渲染，导出 `ProviderBrandIcon` 供 provider selector 与 model selector 复用，保留模型族 kind 并新增 glyph data attribute。`src/components/chat/composer/ButtonArea.tsx` 删除本地重复的 provider SVG / `ProviderBrandIcon` 实现，统一从 `ModelIcon.tsx` 引入共享实现。`.trellis/spec/frontend/component-guidelines.md` 已同步 provider/model selector 共用品牌 glyph 的契约。
- 本轮验证：RED：`npm test -- src/components/chat/composer/ButtonArea.test.tsx` 在实现前失败，失败点为 Claude 仍是 `lucide-sparkles`、Codex 仍是 `lucide-terminal`，缺少对应 `data-chat-model-icon-glyph`。GREEN：同命令通过（1 file / 8 tests）。相邻 composer 验证通过：`npm test -- src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/SelectorDropdown.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx`（3 files / 11 tests）。全量前端测试通过：`npm test`（37 files / 325 tests，仅 Browserslist/caniuse-lite 过期提示）。构建验证通过：`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。Rust 快速编译通过：`cargo check --manifest-path src-tauri/Cargo.toml`。IDE `build_project` 通过，`problems: []`；IDE 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。
- 未验证项：未启动真实 Tauri 桌面做 provider/model selector 视觉点测；未用真实窗口截图确认 Claude/Codex 图标在不同缩放、主题和窄屏换行下的最终像素对齐。未跑 Rust 全量测试，因为本轮没有改 Rust 后端命令或 session provider。
- 下一步候选：1) 启动真实 Tauri 桌面做输入区视觉点测：覆盖 Claude/Codex provider 切换、动态模型列表、自定义模型、深浅色主题和窄屏换行，确认品牌图标居中且不会压缩 label；2) 继续做 cc-gui 与本项目并排截图审计，优先看任务列表、会话列表、输入区布局、右栏密度和重复入口；3) 处理用户提到的任务列表体验：梳理任务/子代理/编辑状态在右侧 `StatusPanel`、输入区 status strip 和消息流工具块之间的职责边界，减少重复显示；4) 如果大历史仍卡，进入后端 tail reader / 分页搜索方向，避免前端继续围绕完整数组做补丁式优化。

## 本轮 PLAN 2026-06-19 chat status panel recent task list

- 目标：回应用户提到的“任务列表”体验问题。桌面 `xl` 下输入区 tasks/subagents/edits/MCP quick tabs 已作为小屏 fallback 隐藏，右侧 `StatusPanel` 是主诊断区；但当前活动卡只显示 active tool 和 pending/error 计数，缺少最近任务清单。本轮在右侧活动卡内增加最近非 agent 工具任务列表，让桌面用户能直接扫描最近任务而不是只看到数量。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、Trellis 当前任务制品、前端 component/state/quality 规范和 shared code-reuse guide；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `StatusPanel.tsx`、`ChatInputStatusTabs.tsx`、`chatStatusSummary.ts` 和相关测试，确认输入区桌面 fallback 已存在，右栏当前活动缺少 recent task list。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，构造 `toolTimeline` 中多个非 agent 工具和一个 agent，断言右栏渲染 `status-activity-task-list`，显示最近非 agent 工具，排除 agent 工具，并展示 hidden count；旧实现应因缺少任务列表 class 失败。
- 功能点 4：实现最小展示改动。验证方式：`StatusPanel` 从 `statusSummary.toolTimeline` 派生最近非 agent 工具列表，复用现有 chip/state 样式渲染 compact rows；不改 `buildChatStatusSummary()`、不改 `ChatInputStatusTabs`、不改 Zustand、不中断现有 active tool 展示。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录桌面右侧 `StatusPanel` 的 current activity 应展示最近任务清单，输入区 tasks tab 只是小屏 fallback。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `StatusPanel` 测试、相邻 status/composer 测试、全量 `npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat status panel recent task list

- 上轮实际进展：上一轮完成 provider/model selector 品牌图标对齐；代码复查确认 `src/components/chat/composer/ModelIcon.tsx` 已导出共享 `ProviderBrandIcon`，`ModelIcon` 使用 Claude LobeHub 与 Codex/OpenAI glyph，并在 `ButtonArea` 中复用。已知阻塞仍是真实 Tauri 桌面 provider/model 视觉点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：本项目已经把输入区 tasks/subagents/edits/MCP quick tabs 在桌面 `xl` 下收口为小屏 fallback；右侧 `StatusPanel` 是桌面主诊断区。但 `StatusPanel` 的 `currentActivity` 卡片只展示 active tool 或 pending/error 计数，没有列出最近任务历史。结果是桌面用户能看到“有几个工具”，却无法直接扫描最近执行了哪些任务；这比 cc-gui 集中展示任务/状态详情的路径少了一层可读性。
- 本轮诊断（超越 cc-gui）：任务列表不应重新挤回输入区。更合适的层级是：右侧 `StatusPanel` 在桌面展示 compact recent task list，输入区只在小屏提供 quick fallback。这样解决用户“任务列表”和“页面元素功能重复”两个痛点：桌面不重复入口，同时任务清单可扫；小屏仍保留近输入区的状态入口。
- 本轮规划：只改 `StatusPanel` 当前活动卡的展示层和测试，不改 `buildChatStatusSummary()`、不改 `ChatInputStatusTabs`、不改 Zustand、不中断 active tool 主展示。优先级中高：用户价值中高（任务列表直接可扫）、出现频率高（右侧状态面板常驻）、实现成本低（单组件 + SSR 测试）、风险低（只消费已有 `statusSummary.toolTimeline`）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 新增回归 `renders a recent desktop task list in the current activity card without mixing in subagents`，构造多个非 agent 工具和一个 agent，断言右栏渲染 `status-activity-task-list` / `status-activity-task-row`，显示最近任务，排除 agent，隐藏最早任务并展示 hidden count。`src/components/chat/StatusPanel.tsx` 新增 `MAX_ACTIVITY_TASKS`、`activityTasks` / `recentActivityTasks` 派生、`renderActivityTaskRow()` 和 compact task list；active tool 仍作为主行展示，recent list 排除当前 active tool 和 agent tools，超过 5 条时复用已有 `inputStatusMoreTools` 文案显示更早任务数量。`.trellis/spec/frontend/component-guidelines.md` 已同步：桌面 `currentActivity` 是主任务列表 surface，输入区 tasks tab 是小屏 fallback。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为缺少 `status-activity-task-list`。GREEN：同命令通过（1 file / 21 tests）。相邻验证通过：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/composer/ChatComposer.render.test.tsx src/components/chat/composer/ButtonArea.test.tsx src/components/chat/composer/SelectorDropdown.test.tsx`（5 files / 44 tests）。全量前端测试通过：`npm test`（37 files / 326 tests，仅 Browserslist/caniuse-lite 过期提示）。构建验证通过：`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。Rust 快速编译通过：`cargo check --manifest-path src-tauri/Cargo.toml`。IDE `build_project` 通过，`problems: []`；IDE 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。
- 未验证项：未启动真实 Tauri 桌面做右侧任务列表视觉点测；未与 cc-gui 做并排截图确认任务列表密度、滚动高度和右栏信息层级；未跑 Rust 全量测试，因为本轮没有改 Rust 后端命令或 session provider。
- 下一步候选：1) 真实 Tauri 桌面截图/点测：宽屏确认右栏 current activity 显示最近任务列表、输入区 tasks tab 隐藏，小屏确认输入区 fallback 仍可展开；2) 继续审计右栏任务列表与消息流工具块的边界：右栏只做最近任务扫描和跳转入口，消息流保留完整工具详情；3) 做 cc-gui 与本项目并排截图审计，覆盖任务列表、会话列表、输入区布局、provider/model 图标对齐和右栏密度；4) 如果大历史仍卡，进入后端 tail reader / 分页搜索方向，避免前端继续围绕完整数组做补丁式优化；5) 继续优化会话列表密度和空状态，尤其大项目多会话时的分组、搜索和当前会话定位。

## 本轮 PLAN 2026-06-19 chat status panel task jump anchors

- 目标：把上一轮右侧 `StatusPanel` 的最近任务清单从“只能扫描”补齐为“可定位”的桌面任务入口，点击任务行后滚动到消息流中的对应工具块。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `StatusPanel.tsx`、`ContentBlockRenderer.tsx`、`ChatPage.tsx` 与 `chatStatusSummary.ts`，确认 `toolTimeline` 有稳定 `toolId`，但消息流工具块缺少 DOM anchor，右侧任务行也没有 click/keyboard 定位入口。
- 功能点 3：补 RED 测试。验证方式：扩展 `StatusPanel.test.tsx`，断言任务行在提供回调时渲染为可操作按钮并携带 `data-target-tool-id`；扩展 `ContentBlockRenderer.test.tsx`，断言单工具和分组工具都暴露稳定 `data-chat-tool-id` / `data-chat-tool-ids` 锚点。
- 功能点 4：实现最小交互改动。验证方式：`ContentBlockRenderer` 给工具块包装层加可聚焦锚点；`StatusPanel` 任务行调用 `onSelectTool`；`ChatPage` 在滚动容器内按 toolId 找锚点并 `scrollIntoView`。不改工具块数据结构、不改后端、不改状态摘要生成。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录桌面右侧任务清单应作为定位入口，消息流工具块必须暴露稳定 tool anchor。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向测试、相邻 status/message 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat status panel task jump anchors

- 上轮实际进展：上一轮已把桌面右侧 `StatusPanel` 的 `currentActivity` 补为最近非 agent 工具任务清单；代码复查确认 `StatusPanel.tsx` 已有 `status-activity-task-list`、最近 5 条裁剪和 hidden count，且输入区 tasks/subagents/edits/MCP tabs 在桌面作为小屏 fallback。已知阻塞仍是真实 Tauri 桌面视觉点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：右侧任务列表已经可扫描，但仍只是静态列表；用户看到最近执行了哪些工具后，不能一键回到消息流中的工具块上下文。cc-gui 的状态/任务区域核心价值不是只展示计数，而是帮助用户定位过程细节。本项目 `toolTimeline` 已有稳定 `toolId`，但 `ContentBlockRenderer` 输出的单工具和分组工具缺少 DOM anchor。
- 本轮诊断（超越 cc-gui）：右栏不应该复制完整工具详情，否则会和消息流工具块重复；更好的交互是右栏作为任务索引，点击后滚动到消息流中已有的工具块。这样解决“任务列表可扫但不可用”的痛点，同时保留消息流作为唯一完整详情来源。
- 本轮规划：只加 DOM anchor、右栏任务行按钮和 `ChatPage` 局部滚动 handler；不改 `ChatStatusToolSummary` 数据结构、不改 `buildChatStatusSummary()`、不改工具块详情、不改后端。优先级中高：用户价值中高（任务行可直接定位）、出现频率高（桌面右栏常驻）、成本低（组件边界内小改动 + SSR 回归）、风险低（不影响数据流）。
- 本轮完成：`src/components/chat/ContentBlockRenderer.tsx` 新增 `getToolAnchorProps()`，单工具包装层暴露 `data-chat-tool-id`，分组工具包装层暴露 `data-chat-tool-ids`，并设置可聚焦 `chat-tool-anchor`；`src/components/chat/StatusPanel.tsx` 为最近任务行新增按钮语义、`data-target-tool-id`、aria-label 和 `onSelectTool` 回调；`src/pages/ChatPage.tsx` 新增 `findToolAnchorElement()` / `handleSelectStatusTool()`，在当前对话滚动容器内按 toolId 定位并 `scrollIntoView`；`src/locales/en.json` / `src/locales/zh.json` 新增任务定位文案；`src/components/chat/ContentBlockRenderer.test.tsx` 与 `src/components/chat/StatusPanel.test.tsx` 增加锚点和任务跳转回归；`.trellis/spec/frontend/component-guidelines.md` 已同步桌面任务行定位与工具 anchor 契约。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ContentBlockRenderer.test.tsx` 先失败 3 项，失败点分别为缺少 `<button>` / `data-target-tool-id`、缺少 `chat-tool-anchor` / `data-chat-tool-id`、缺少 `data-chat-tool-ids`。GREEN：同命令通过（2 files / 35 tests）。相邻验证通过：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageList.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx`（4 files / 50 tests）。全量前端验证通过：`npm test`（37 files / 329 tests，仅 Browserslist/caniuse-lite 过期提示）。构建验证通过：`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。Rust 快速编译通过：`cargo check --manifest-path src-tauri/Cargo.toml`。IDE `build_project` 通过，`problems: []`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做右侧任务行点击后的视觉滚动点测；未与 cc-gui 做并排截图确认任务列表密度、滚动位置和焦点环表现；未跑 `cargo test --manifest-path src-tauri/Cargo.toml`，因为本轮没有改 Rust 后端命令或 session provider。
- 下一步候选：1) 启动真实 Tauri 桌面做宽屏/窄屏点测：宽屏点击右栏最近任务行应跳到对应工具块，小屏输入区 fallback 仍可展开；2) 如果定位体验不够明显，给刚跳转到的 `chat-tool-anchor` 增加短暂高亮，但要先确认不会造成视觉噪音；3) 做 cc-gui 与本项目并排截图审计，覆盖任务列表、会话列表、输入区布局、provider/model 图标和右栏密度；4) 继续检查任务列表与消息流工具块边界，右栏只做索引和诊断，完整参数/结果继续留在消息流；5) 若用户继续反馈大历史卡顿，转向后端 tail reader / 分页搜索，而不是继续在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat status panel jump highlight

- 目标：增强上一轮右侧任务行跳转后的视觉确认。当前点击 `StatusPanel` 最近任务行会滚动并聚焦到 transcript 工具锚点，但用户在长历史里可能仍不确定目标是哪一个；本轮给被跳转工具块增加短暂、低噪音的高亮反馈。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `ChatPage.findToolAnchorElement()`、`handleSelectStatusTool()`、`ContentBlockRenderer` 锚点和 `StatusPanel` 任务行，确认现有实现只有 `scrollIntoView + focus`，没有可见确认态。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/utils/chatUiBehavior.test.ts`，断言 highlight helper 会先移除旧计时器、添加 highlight class，并在 timeout 后清理 class 与 data marker；旧实现应因 helper 不存在失败。
- 功能点 4：实现最小交互改动。验证方式：在 `src/utils/chatUiBehavior.ts` 增加 `highlightTranscriptToolAnchor()`，`ChatPage` 持有清理 ref 并在任务跳转后调用；`src/App.css` 增加 `chat-tool-anchor-jump-highlight` 的短暂 ring/背景动画。不要改变工具块内部组件、状态摘要或后端。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录从右侧任务列表跳转后应有短暂目标高亮，但不能持久占用视觉状态。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `chatUiBehavior` 测试、相邻 status/message 测试、全量 `npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、IDE build 和 diff 空白检查；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat status panel jump highlight

- 上轮实际进展：上一轮已把右侧 `StatusPanel` 最近任务行接成 transcript 跳转入口；代码复查确认 `src/components/chat/StatusPanel.tsx` 的任务行有 `onSelectTool` / `data-target-tool-id`，`src/components/chat/ContentBlockRenderer.tsx` 的单工具和分组工具已暴露 `data-chat-tool-id` / `data-chat-tool-ids`，`src/pages/ChatPage.tsx` 已在当前滚动容器内查找 tool anchor 并 `scrollIntoView`。已知阻塞仍是真实 Tauri 桌面点击点测未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：右栏任务行虽然能滚动到工具块，但长历史里滚动完成后缺少目标确认态；用户可能看到页面位置变化，却不知道具体落在哪个工具块。cc-gui 的任务/状态区域强调过程定位，本项目需要补上“跳转目标可感知”的细节。
- 本轮诊断（超越 cc-gui）：右栏仍不复制完整工具详情，只作为任务索引；短暂高亮把注意力引回消息流中的唯一详情来源。这样解决“能跳但不确定跳到哪里”的痛点，同时避免持久选中态污染 transcript 阅读。
- 本轮规划：只加 `chatUiBehavior` helper、`ChatPage` 调用和 CSS 动画，不改工具块内部组件、不改状态摘要、不改后端、不新增依赖。优先级中等偏高：用户价值中高（跳转反馈明确）、出现频率中高（每次从右栏任务列表定位）、成本低（helper + CSS + 测试）、风险低（短时 class，自动清理）。
- 本轮完成：`src/utils/chatUiBehavior.test.ts` 新增回归 `marks a transcript tool anchor briefly after jumping to it`，覆盖旧高亮清理、添加 class/data marker、cleanup 清理 class 和 timeout。`src/utils/chatUiBehavior.ts` 新增 `TOOL_ANCHOR_JUMP_HIGHLIGHT_CLASS`、`TOOL_ANCHOR_JUMP_HIGHLIGHT_DURATION_MS` 和 `highlightTranscriptToolAnchor()`；`src/pages/ChatPage.tsx` 新增 `toolAnchorHighlightCleanupRef`，跳转后调用 helper，并在页面卸载时清理。`src/App.css` 新增 `chatToolAnchorJumpHighlight` 动画和 reduced-motion fallback。`.trellis/spec/frontend/component-guidelines.md` 已同步右栏跳转后短暂目标高亮、不得变成持久选中态或重复详情的契约。
- 本轮验证：RED：`npm test -- src/utils/chatUiBehavior.test.ts` 先失败 1 项，失败点为 `highlightTranscriptToolAnchor is not a function`。GREEN：同命令通过（1 file / 16 tests）。相邻验证通过：`npm test -- src/utils/chatUiBehavior.test.ts src/components/chat/StatusPanel.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageList.test.tsx`（4 files / 54 tests）。全量前端验证通过：`npm test`（37 files / 330 tests，仅 Browserslist/caniuse-lite 过期提示）。`npm run build` 初次失败于测试文件 TypeScript 窄化：`timeoutHandler` 在 `tsc` 下被视为 `null/never`；按 `superpowers:systematic-debugging` 读取错误、确认根因为回调内赋值不参与控制流窄化后，仅调整测试断言为显式 `unknown` 函数断言。修复后 `npm test -- src/utils/chatUiBehavior.test.ts` 通过，`npm run build` 通过（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）。Rust 快速编译通过：`cargo check --manifest-path src-tauri/Cargo.toml`。IDE `build_project` 通过，`problems: []`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做右侧任务行点击后的高亮视觉点测；未与 cc-gui 做并排截图确认高亮强度、滚动位置和焦点环表现；未跑 `cargo test --manifest-path src-tauri/Cargo.toml`，因为本轮没有改 Rust 后端命令或 session provider。
- 下一步候选：1) 启动真实 Tauri 桌面做右栏任务跳转点测：确认滚动、焦点、高亮动画在深浅色主题和长历史中都清晰但不过度；2) 若高亮视觉过强或过弱，微调 `chatToolAnchorJumpHighlight` 的 opacity/ring，而不是增加持久选中状态；3) 做 cc-gui 与本项目并排截图审计，覆盖任务列表、会话列表、输入区布局、provider/model 图标和右栏密度；4) 继续检查任务列表与消息流工具块边界，右栏只做索引和诊断，完整参数/结果继续留在消息流；5) 若用户继续反馈大历史卡顿，转向后端 tail reader / 分页搜索，而不是继续在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat status panel subagent activity

- 目标：补齐桌面右侧 `StatusPanel` 对子代理 / Task 活动的可扫可定位展示。上一轮 recent task list 为避免混杂过滤了 `agent` 工具，但 cc-gui 的状态面板有独立 subagent 入口；本轮在不复制完整子代理详情的前提下，把 `agentTools` 渲染成紧凑活动列表，并复用现有 transcript jump/highlight 机制。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `StatusPanel.tsx`、`ChatInputStatusTabs.tsx`、`chatStatusSummary.ts` 与 cc-gui `StatusPanel`，确认本项目已有 `agentTools` 数据，输入区小屏 fallback 已展示 subagents，但桌面右栏未消费该列表。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，构造多个 `agentTools`，断言右栏渲染 `status-activity-subagent-list`、最近子代理行、hidden count，并且提供 `onSelectTool` 时每行携带 `data-target-tool-id`；旧实现应因缺少子代理列表失败。
- 功能点 4：实现最小展示/交互改动。验证方式：`StatusPanel` 从 `statusSummary.agentTools` 派生最近子代理列表，复用 `renderActivityTaskRow()` 输出可跳转行；普通工具列表仍排除 agent，active tool 主行不重复出现在子列表；不改 `buildChatStatusSummary()`、不改 `ChatInputStatusTabs`、不改后端。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录桌面 `StatusPanel` 需要把 subagent/Task 作为独立活动索引展示，输入区 subagents tab 仍是小屏 fallback。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `StatusPanel` 测试、相邻 status/message 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`；真实 Tauri 桌面点测若未执行需明确标注。

## 迭代记录 2026-06-19 chat status panel subagent activity

- 上轮实际进展：上一轮已给右侧 `StatusPanel` 最近任务跳转补上短暂 transcript 高亮；代码复查确认 `src/utils/chatUiBehavior.ts` 有 `highlightTranscriptToolAnchor()`，`src/pages/ChatPage.tsx` 在 `handleSelectStatusTool()` 中调用该 helper，`src/App.css` 有 `chat-tool-anchor-jump-highlight` 动画。已知阻塞仍是真实 Tauri 桌面点击点测和 cc-gui 并排截图未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的 `webview/src/components/StatusPanel/StatusPanel.tsx` 有独立 subagent tab；本项目 `src/utils/chatStatusSummary.ts` 已经产出 `agentTools`，`src/components/chat/ChatInputStatusTabs.tsx` 也在小屏 fallback 中展示 subagents，但桌面右侧 `StatusPanel` 只展示非 agent recent task list，导致子代理活动在宽屏主诊断区不可扫。
- 本轮诊断（超越 cc-gui）：子代理不应混入普通工具任务，也不应把完整子代理历史复制到右栏。更合适的层级是：右栏 `currentActivity` 内增加独立 compact subagent list，行本身仍是 transcript jump target；消息流保留完整 Agent/Task 块和后续历史承载。这样解决“桌面看不到子代理进展”和“右栏信息重复堆叠”两个痛点。
- 本轮规划：只改 `StatusPanel` 展示层与 SSR 测试，不改 `buildChatStatusSummary()`、不改 `ChatInputStatusTabs`、不改后端、不新增 i18n key，复用已有 `inputStatusSubagents` / `inputStatusMoreSubagents` / `scrollToToolTask` 文案。优先级中高：用户价值中高（子代理活动常是长任务关键线索）、出现频率中（启用 subagent/Task 时必看）、实现成本低（已有数据 + 既有跳转行）、风险低（单组件内分层）。
- 本轮完成：`src/components/chat/StatusPanel.tsx` 新增 `MAX_ACTIVITY_SUBAGENTS`、从 `statusSummary.agentTools` 派生 `activitySubagents` / `recentActivitySubagents`，并在 `currentActivity` 卡片中渲染 `status-activity-subagent-list`；子代理行复用 `renderActivityTaskRow()`，因此保留 `data-target-tool-id`、aria-label、disabled/onSelectTool 行为和 transcript jump/highlight 机制；active tool 会从子代理列表中排除，避免当前运行子代理在主行和列表中重复；仅有子代理历史时不再显示 idle 文案。`src/components/chat/StatusPanel.test.tsx` 新增子代理列表与子代理-only idle 边界回归，并同步旧任务列表测试为“任务列表与子代理列表分离”。`.trellis/spec/frontend/component-guidelines.md` 已同步桌面右栏 subagent 独立索引契约。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为缺少 `status-activity-subagent-list`。GREEN：同命令通过（1 file / 23 tests），随后补充子代理-only idle 边界后相邻验证通过：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageList.test.tsx src/utils/chatStatusSummary.test.ts`（5 files / 59 tests）。全量验证通过：`npm test`（37 files / 332 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests + 2 doctests ignored）、IDE `build_project`。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。IDE 生成的 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并删除。
- 未验证项：未启动真实 Tauri 桌面做右栏 subagent 行点击后的滚动/高亮视觉点测；未与 cc-gui 做并排截图确认右栏 subagent 密度、标题层级和长文本截断效果。
- 下一步候选：1) 真实 Tauri 桌面点测：宽屏确认普通 tasks 与 subagents 分区、点击子代理行跳到消息流 Agent/Task 块并短暂高亮；窄屏确认输入区 subagents fallback 仍正常；2) 做 cc-gui 与本项目并排截图审计，覆盖右栏 tabs/list 密度、会话列表、输入区布局、provider/model 图标和长历史消息排版；3) 如果右栏 currentActivity 因 tasks + subagents 同时很多而过高，下一轮考虑给 currentActivity 内部列表加局部高度上限，而不是隐藏子代理；4) 若用户继续反馈大历史卡顿，进入后端 tail reader / 分页搜索方向，避免继续在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat status panel subagent jump label

- 目标：修正桌面右侧 `StatusPanel` 子代理活动行的跳转可访问语义。上一轮子代理列表复用了普通任务行渲染，功能可跳转，但 aria-label 仍是“Jump to tool task / 定位工具任务”；本轮改为子代理专用“Jump to subagent activity / 定位子代理活动”。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `StatusPanel.tsx`、`StatusPanel.test.tsx` 和 i18n 资源，确认 `renderActivityTaskRow()` 对 task/subagent 共用 `scrollToToolTask`。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言子代理行 aria-label 使用专用子代理跳转文案，普通 task 行仍使用原工具任务文案。
- 功能点 4：实现最小可访问性改动。验证方式：新增 `chat.layout.scrollToSubagentActivity` 英/中文文案；`StatusPanel` 根据 `tool.type === 'agent'` 选择 aria-label key；不改视觉布局、不改跳转行为、不改状态摘要。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 task/subagent 跳转行必须有各自准确的 accessible label。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `StatusPanel` 测试、相邻 status/message/i18n 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 `out/`。

## 迭代记录 2026-06-19 chat status panel subagent jump label

- 上轮实际进展：上一轮已在桌面右侧 `StatusPanel` 的 `currentActivity` 卡片中增加独立 subagent / Task compact list，并复用 transcript jump/highlight 机制；代码复查确认 `src/components/chat/StatusPanel.tsx` 已从 `statusSummary.agentTools` 派生 `recentActivitySubagents`，并渲染 `status-activity-subagent-list`。已知阻塞仍是未启动真实 Tauri 桌面做子代理行点击后的滚动/高亮点测，以及未与 cc-gui 做并排截图审计。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：桌面状态面板已能展示子代理活动，但子代理行复用普通任务行后，辅助技术读到的仍是“Jump to tool task / 定位工具任务”。这会把 subagent / Task 活动误报成普通工具任务，削弱右栏作为过程索引的语义清晰度。
- 本轮诊断（超越 cc-gui）：本项目把右栏设计成“索引 + 跳转”，而不是复制完整工具详情；因此每一种索引行都应该用准确语义告诉用户跳到哪里。子代理专用 aria-label 解决屏幕阅读器、自动化测试和键盘用户在任务/子代理混排场景下无法区分目标类型的痛点。
- 本轮规划：只做可访问语义修正，不改视觉布局、不改数据派生、不改跳转和高亮逻辑、不新增依赖。优先级中等偏高：用户价值中等（主要提升可访问性和语义准确性）、出现频率中（有 subagent/Task 活动时触发）、成本低（单 helper + i18n + 测试）、风险低（普通 task 保持原文案）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 已有 RED 回归，断言子代理行使用 `Jump to subagent activity / 定位子代理活动`，并且不再使用 `Jump to tool task / 定位工具任务`。`src/components/chat/StatusPanel.tsx` 新增 `getActivityJumpLabelKey()`，按 `tool.type === 'agent'` 选择 `chat.layout.scrollToSubagentActivity`，普通任务继续使用 `chat.layout.scrollToToolTask`。`src/locales/en.json` / `src/locales/zh.json` 新增对应英中文文案。`.trellis/spec/frontend/component-guidelines.md` 已同步 task/subagent jump rows 必须使用准确 accessible labels 的契约。
- 本轮验证：RED：接手时测试断言已写入，上一执行段已运行 `npm test -- src/components/chat/StatusPanel.test.tsx` 并因子代理行仍为“定位工具任务：write regression coverage”失败；本轮复查确认该 RED 断言仍在代码中。GREEN：`npm test -- src/components/chat/StatusPanel.test.tsx` 通过（1 file / 24 tests）。相邻验证通过：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageList.test.tsx src/utils/chatStatusSummary.test.ts`（5 files / 59 tests）。全量验证通过：`npm test`（37 files / 332 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests passed，2 doctests ignored）、IDE `build_project`（`problems: []`）。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。构建/IDE 生成的 `C:/guodevelop/ccg-switch/dist` 与 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并清理。
- 未验证项：未启动真实 Tauri 桌面做右栏子代理行点击后的滚动/高亮视觉点测；未与 cc-gui 做并排截图确认右栏 subagent 密度、标题层级、截断和可访问名称。
- 下一步候选：1) 启动真实 Tauri 桌面做宽屏/窄屏点测：宽屏点击右栏普通 task 与 subagent 行都应跳到对应消息流工具块并短暂高亮，窄屏输入区 subagents fallback 仍正常；2) 做 cc-gui 与本项目并排截图审计，覆盖右栏任务/子代理分区、会话列表、输入区布局、provider/model 图标和长历史消息排版；3) 如果右栏 `currentActivity` 因 tasks + subagents 同时很多而过高，下一轮给该卡片内部列表加局部高度上限，而不是隐藏子代理；4) 若用户继续反馈大历史卡顿，转向后端 tail reader / 分页搜索方向，避免继续在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat status panel activity scroll region

- 目标：给桌面右侧 `StatusPanel` 的 `currentActivity` 中 tasks + subagents 列表增加局部高度上限和滚动区域。上一轮已补齐子代理活动和准确 aria-label，但当普通任务与子代理同时较多时，活动卡片会继续纵向增长，可能把 recent edits、MCP、runtime context 挤出右栏首屏。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph / cc-gui 诊断。验证方式：读取本项目 `StatusPanel.tsx` / `StatusPanel.test.tsx` 和 cc-gui `StatusPanel.tsx` / `StatusPanel.less` / `SubagentList.tsx`，确认 cc-gui 对 todo/subagent/file lists 有 `max-height` + `overflow-y:auto`，本项目当前 activity lists 没有局部滚动边界。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言同时存在 task/subagent 列表时渲染 `status-activity-scroll-region`，并带 `max-h-64` / `overflow-y-auto`。
- 功能点 4：实现最小展示层改动。验证方式：`StatusPanel` 只在有 tasks/subagents 列表时包一层 scroll region；active tool / streaming / idle 主行保留在滚动区外，任务和子代理仍独立分区，跳转和 aria-label 不变。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录桌面 currentActivity 内部列表需要局部高度上限，避免右栏其它诊断被任务历史挤掉。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `StatusPanel` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 `dist/` / `out/`。

## 迭代记录 2026-06-19 chat status panel activity scroll region

- 上轮实际进展：上一轮修正了右侧 `StatusPanel` 子代理活动行的可访问语义；代码复查确认 `src/components/chat/StatusPanel.tsx` 已通过 `getActivityJumpLabelKey()` 区分普通工具任务和子代理活动，`src/locales/en.json` / `src/locales/zh.json` 已有 `scrollToSubagentActivity` 文案，`src/components/chat/StatusPanel.test.tsx` 已覆盖子代理行不再读作普通工具任务。已知阻塞仍是真实 Tauri 桌面点击/高亮点测和 cc-gui 并排截图未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui `webview/src/components/StatusPanel/StatusPanel.less` 对 todo、subagent、file changes 列表均设置了约 200px 的 `max-height` 和 `overflow-y:auto`；本项目 `StatusPanel` 的 `currentActivity` 在上一轮后会同时展示 recent tasks 与 subagents，但两个列表直接堆在卡片内，没有内部滚动边界。工具密集会话中，这张活动卡片会把 recent edits、MCP 和 runtime context 推出右栏首屏。
- 本轮诊断（超越 cc-gui）：本项目没有照搬 cc-gui 的 tab/popover，而是把最近任务和子代理直接放进桌面右栏，降低点击成本；为了让这个“更快扫”的设计成立，列表区域必须自己吸收溢出，而不是让整个右栏跟着增长。这样解决“右栏任务历史很有用但抢占其它诊断”的痛点。
- 本轮规划：只做展示层密度控制，不改 `MAX_ACTIVITY_TASKS` / `MAX_ACTIVITY_SUBAGENTS`、不改 `ChatStatusSummary`、不改跳转/高亮/aria-label、不改后端。优先级中高：用户价值中高（保护右栏其它诊断可见）、出现频率中（工具密集会话常见）、实现成本低（单组件 Tailwind class + SSR 断言）、风险低（只影响列表容器）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 在现有“tasks 与 subagents 分区”回归中新增断言，要求渲染 `status-activity-scroll-region` 且带 `max-h-64` / `overflow-y-auto`。RED 失败点符合预期：旧实现缺少 `status-activity-scroll-region`。`src/components/chat/StatusPanel.tsx` 在有 task 或 subagent 列表时包裹 `status-activity-scroll-region mt-2 max-h-64 min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1`；active tool / streaming / idle 主行保留在滚动区外，普通 tasks 与 subagents 仍为独立分区。`.trellis/spec/frontend/component-guidelines.md` 已同步桌面 `currentActivity` 活动列表应使用内部滚动区域和局部高度上限的契约。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为缺少 `status-activity-scroll-region`。GREEN：同命令通过（1 file / 24 tests）。相邻验证通过：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageList.test.tsx src/utils/chatStatusSummary.test.ts`（5 files / 59 tests）。全量验证通过：`npm test`（37 files / 332 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests passed，2 doctests ignored）、IDE `build_project`（`problems: []`）。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。构建/IDE 生成的 `C:/guodevelop/ccg-switch/dist` 与 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并清理。
- 未验证项：未启动真实 Tauri 桌面做右栏 activity scroll region 的滚轮/触控板滚动点测；未与 cc-gui 并排截图确认 16rem 上限在真实 320px 右栏中的密度是否需要微调。
- 下一步候选：1) 启动真实 Tauri 桌面做右栏 activity scroll region 点测：构造 tasks + subagents 同时较多的会话，确认活动列表内部滚动、active tool 主行不被卷走、recent edits/MCP 仍可见；2) 做 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、会话列表、输入区按钮、provider/model 图标对齐和搜索反馈；3) 如果 `max-h-64` 在真实桌面中过高或过低，只微调局部上限，不改变 tasks/subagents 的数据截断策略；4) 若用户继续反馈大历史卡顿，继续转向后端 tail reader / 分页搜索，不再在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat status panel activity scroll accessibility

- 目标：补齐上一轮右侧 `StatusPanel` activity 内部滚动区的键盘可达性。上一轮已加 `max-h-64` / `overflow-y-auto`，但滚动容器本身没有语义和焦点入口；键盘用户只能 Tab 到内部按钮，不能可靠地把焦点放到滚动容器上使用 PageUp/PageDown/方向键浏览长任务历史。
- 功能点 1：恢复上下文与规范。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端 component/quality/type 规范、shared guides 和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `StatusPanel.tsx` 与 `StatusPanel.test.tsx`，确认当前 `status-activity-scroll-region` 只有样式类，没有 `role`、`tabIndex`、`aria-label` 或焦点样式。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/StatusPanel.test.tsx`，断言 activity scroll region 渲染为 `role="region"`、`tabindex="0"`，并带 i18n 后的 `Activity history / 活动历史` accessible label；旧实现应因缺少这些属性失败。
- 功能点 4：实现最小可访问性改动。验证方式：`StatusPanel` 只给滚动容器新增 `role="region"`、`tabIndex={0}`、`aria-label={t('chat.layout.activityHistoryRegion')}` 和低噪音 focus ring；新增英中文 i18n key；不改 active tool 主行、tasks/subagents 分区、跳转、hidden count 或数据上限。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录桌面 `currentActivity` 内部滚动区必须是可聚焦、有命名的 region。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `StatusPanel` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、必要时 `cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 `dist/` / `out/`。

## 迭代记录 2026-06-19 chat status panel activity scroll accessibility

- 上轮实际进展：上一轮已给右侧 `StatusPanel` 的 `currentActivity` tasks/subagents 列表加上内部滚动区；代码复查确认 `src/components/chat/StatusPanel.tsx` 已有 `status-activity-scroll-region mt-2 max-h-64 min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1`，并且 active tool / streaming / idle 主行在滚动区外。已知阻塞仍是真实 Tauri 桌面滚轮/触控板点测和 cc-gui 并排截图未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的状态面板列表有内部滚动边界；本项目上一轮已补齐视觉滚动区，但该容器没有 `role`、`aria-label` 或 `tabIndex`。在任务/子代理很多时，键盘用户无法直接聚焦滚动容器并使用 PageUp/PageDown/方向键浏览活动历史，只能进入内部按钮序列。
- 本轮诊断（超越 cc-gui）：本项目把右栏设计成可跳转的活动索引，列表滚动区本身也应成为一个命名导航区域。给滚动区增加“活动历史”语义和焦点入口，可以解决“有滚动但键盘无法可靠进入滚动上下文”的痛点，同时不增加视觉噪音。
- 本轮规划：只做可访问性与焦点状态，不改 `MAX_ACTIVITY_TASKS` / `MAX_ACTIVITY_SUBAGENTS`、不改 `ChatStatusSummary`、不改跳转/高亮/hidden count、不改后端。优先级中等偏高：用户价值中等（键盘与辅助技术可用性）、出现频率中（任务密集会话触发）、实现成本低（单容器属性 + i18n + SSR 断言）、风险低（不改变数据或布局结构）。
- 本轮完成：`src/components/chat/StatusPanel.test.tsx` 扩展 activity list 回归，断言 `status-activity-scroll-region` 同时带 `role="region"`、`tabindex="0"` 和 `Activity history / 活动历史` accessible label；RED 失败点符合预期：旧实现缺少 `role="region"`。`src/components/chat/StatusPanel.tsx` 给滚动容器新增 `role="region"`、`tabIndex={0}`、`aria-label={t('chat.layout.activityHistoryRegion')}` 和 `focus:ring`。`src/locales/en.json` / `src/locales/zh.json` 新增 `chat.layout.activityHistoryRegion`。`.trellis/spec/frontend/component-guidelines.md` 已同步：桌面 `currentActivity` 内部滚动区必须是可聚焦、有命名的 region。
- 本轮验证：RED：`npm test -- src/components/chat/StatusPanel.test.tsx` 先失败 1 项，失败点为缺少 `role="region"`。GREEN：同命令通过（1 file / 24 tests）。相邻验证通过：`npm test -- src/components/chat/StatusPanel.test.tsx src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/components/chat/MessageList.test.tsx src/utils/chatStatusSummary.test.ts`（5 files / 59 tests，仅 Browserslist/caniuse-lite 过期提示）。全量验证通过：`npm test`（37 files / 332 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests passed，2 doctests ignored）、IDE `build_project`（`problems: []`）。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。构建/IDE 生成的 `C:/guodevelop/ccg-switch/dist` 与 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并清理。
- 未验证项：未启动真实 Tauri 桌面做右栏 activity scroll region 的键盘滚动、滚轮/触控板滚动和焦点 ring 视觉点测；未与 cc-gui 并排截图确认 `max-h-64` 与 focus ring 在真实 320px 右栏中的视觉密度。
- 下一步候选：1) 启动真实 Tauri 桌面做右栏 activity scroll region 点测：构造 tasks + subagents 同时较多的会话，确认 Tab 可聚焦“活动历史”区域、PageUp/PageDown/方向键能滚动内部列表、active tool 主行不被卷走、recent edits/MCP 仍可见；2) 做 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、会话列表、输入区按钮、provider/model 图标对齐和搜索反馈；3) 如果 `max-h-64` 或 focus ring 在真实桌面中过强/过弱，只微调局部上限或 ring 强度，不改变 tasks/subagents 数据截断策略；4) 若用户继续反馈大历史卡顿，继续转向后端 tail reader / 分页搜索，不再在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat input status tool jump targets

- 目标：补齐输入区 `ChatInputStatusTabs` 小屏 fallback 中 tasks/subagents 行的 transcript 跳转能力。右侧 `StatusPanel` 已支持点击普通 task / subagent 行定位到消息流工具块并高亮；但小屏隐藏右栏时，输入区状态条目前只展示静态行，用户无法从 tasks/subagents 面板快速回到对应工具块。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端 component/state/quality/type 规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph / cc-gui 诊断。验证方式：读取本项目 `ChatInputStatusTabs.tsx`、`ChatPage.tsx`、`StatusPanel.tsx` 与 cc-gui `StatusPanel` / `TodoList` / `SubagentList`，确认本项目右栏已有 `onSelectTool` 跳转，输入区 fallback 缺少同等入口。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，断言 tasks/subagents 面板中的工具行渲染为带 `data-target-tool-id`、准确 `aria-label` 的按钮；未传 `onSelectTool` 时保留 disabled 只读语义。
- 功能点 4：实现最小交互改动。验证方式：`ChatInputStatusTabs` 新增 `onSelectTool?: (tool) => void` prop，普通 task 行使用 `chat.layout.scrollToToolTask`，subagent 行使用 `chat.layout.scrollToSubagentActivity`；点击时委托给 `ChatPage.handleSelectStatusTool`，不改状态摘要、不改右栏、不改工具块锚点机制。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 composer status strip 作为 small-screen fallback 时，tasks/subagents 行应复用 transcript jump target 语义。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `ChatInputStatusTabs` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、必要时 `cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 `dist/` / `out/`。

## 迭代记录 2026-06-19 chat input status tool jump targets

- 上轮实际进展：上一轮记录声称已给右侧 `StatusPanel` activity 内部滚动区补齐 `role="region"`、`tabIndex={0}`、`aria-label` 和 focus ring；代码复查确认 `src/components/chat/StatusPanel.tsx`、`StatusPanel.test.tsx`、`src/locales/en.json` / `zh.json` 与 `.trellis/spec/frontend/component-guidelines.md` 均存在该实现。已知阻塞仍是未启动真实 Tauri 桌面做滚动区键盘/滚轮/焦点视觉点测，以及未与 cc-gui 做并排截图。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui `webview/src/components/StatusPanel/StatusPanel.tsx` 将 todo、subagent、file changes 作为状态面板入口，并通过 `TodoList.tsx` / `SubagentList.tsx` 展示可操作活动列表。本项目右侧 `StatusPanel` 已超前做成 transcript 索引和跳转目标，但输入区 `ChatInputStatusTabs` 作为小屏 fallback 仍把 task/subagent 行渲染为静态 `div`；窄屏隐藏右栏时，用户无法从 tasks/subagents 面板定位到对应工具块。
- 本轮诊断（超越 cc-gui）：本项目的价值不只是展示状态，而是把状态行变成“索引 + 跳转 + 高亮”的导航入口。把同等能力补到输入区 fallback，解决小屏用户只能看到任务摘要、不能回到消息流上下文的痛点，同时保持桌面 `xl` 下不重复展示详细面板。
- 本轮规划：只做输入区状态条 tasks/subagents 行的交互语义，不改 `ChatStatusSummary`、不改右侧 `StatusPanel`、不改 `MessageList` 锚点机制、不新增 i18n 文案或依赖。优先级中高：用户价值高（窄屏任务定位可用）、出现频率中（工具/子代理会话常见）、实现成本低（一个 prop + 行元素改 button + 现有 handler 接线）、风险低（复用已有跳转逻辑）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增 3 个回归，覆盖普通 task 行 `data-target-tool-id`、子代理专用 `aria-label`、无 handler 时 disabled 只读语义。`src/components/chat/ChatInputStatusTabs.tsx` 新增 `onSelectTool?: (tool: ChatStatusToolSummary) => void`，把 `renderToolRow()` 从静态 `div` 改为按钮，增加 `data-target-tool-id`、准确 task/subagent aria-label、hover/focus 状态和 disabled 只读语义，点击时委托 `onSelectTool`。`src/pages/ChatPage.tsx` 将已有 `handleSelectStatusTool` 传给 `ChatInputStatusTabs`，复用现有 `findToolAnchorElement()`、`scrollIntoView()`、focus 和短暂高亮机制。`.trellis/spec/frontend/component-guidelines.md` 已同步 composer status strip 小屏 fallback 的 transcript jump target 契约。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 3 项，失败点为缺少 `data-target-tool-id="tool-build"` / `data-target-tool-id="tool-agent"`，符合预期。GREEN：同命令通过（1 file / 15 tests）。相邻验证通过：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/MessageList.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatStatusSummary.test.ts src/utils/chatNavigation.test.ts`（6 files / 76 tests，仅 Browserslist/caniuse-lite 过期提示）。全量验证通过：`npm test`（37 files / 335 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests passed，2 doctests ignored）、IDE `build_project`（`problems: []`）。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。构建/IDE 生成的 `C:/guodevelop/ccg-switch/dist` 与 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并清理。
- 未验证项：未启动真实 Tauri 桌面做窄屏输入区 tasks/subagents 面板点击后的滚动、focus、高亮视觉点测；未与 cc-gui 做真实运行并排截图确认小屏 fallback 与右栏密度的实际体验差异。
- 下一步候选：1) 启动真实 Tauri 桌面做窄屏/宽屏点测：窄屏打开输入区 tasks/subagents 面板，点击普通 task 与 subagent 行都应跳到对应工具块并短暂高亮；宽屏确认右栏仍是主状态索引，输入区 detail tabs `xl:hidden` 不重复占位；2) 做 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、输入区 fallback、会话列表、provider/model 图标和搜索反馈；3) 若窄屏 popover 点击后仍遮挡目标位置，下一轮只在 selection 后关闭 popover或微调滚动 block 策略，不改锚点数据结构；4) 若用户继续反馈大历史卡顿，优先转向后端 tail reader / 分页搜索，不再继续在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat input status popover dismiss on jump

- 目标：补齐上一轮输入区 tasks/subagents 跳转后的浮层关闭策略。上一轮已让小屏 fallback 的 task/subagent 行可跳到 transcript 工具块，但 `ChatInputStatusTabs` 的 popover 是绝对定位在 composer 上方；点击跳转后如果浮层保持打开，窄屏用户可能看不到刚跳转并高亮的目标上下文。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph 诊断。验证方式：读取 `ChatInputStatusTabs.tsx` 与测试，确认当前 `renderToolRow` 只调用 `onSelectTool?.(tool)`，不会改变 `openTab`。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，用纯 helper 断言可跳转工具行选择后应关闭当前 tab；无 selection handler 时保持当前 tab，避免 disabled 行产生状态变化。
- 功能点 4：实现最小交互改动。验证方式：`ChatInputStatusTabs` 新增/使用 helper，在工具行点击时先计算下一 open tab；有 `onSelectTool` 时 `setOpenTab(null)` 并委托 page-level jump handler，不改跳转、高亮、aria-label 或数据摘要。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 small-screen fallback 的 transcript jump 行在触发定位后应关闭临时 popover，避免遮挡目标。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `ChatInputStatusTabs` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 `dist` / `out`。

## 迭代记录 2026-06-19 chat input status popover dismiss on jump

- 上轮实际进展：上一轮已让输入区 `ChatInputStatusTabs` 的 tasks/subagents 行具备 transcript jump target 语义；代码复查确认 `src/components/chat/ChatInputStatusTabs.tsx` 已有 `onSelectTool` prop、`data-target-tool-id`、task/subagent 专用 aria-label，并且 `src/pages/ChatPage.tsx` 已把 `handleSelectStatusTool` 传入输入区状态条。已知阻塞仍是真实 Tauri 桌面窄屏点击/滚动/高亮视觉点测，以及 cc-gui 并排截图未完成。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui 的状态入口属于临时 popover / 面板式状态查看，本项目上一轮把小屏 fallback 的 task/subagent 行升级为 transcript 跳转入口后，`ChatInputStatusTabs` 仍只执行 `onSelectTool?.(tool)`，不会关闭 `openTab`。由于该 popover 绝对定位在 composer 上方，窄屏跳转后它可能继续遮挡刚滚到中间并高亮的 transcript 工具块。
- 本轮诊断（超越 cc-gui）：本项目的状态行承担“定位到消息流上下文”的职责；定位成功后临时详情面板应让位给目标内容。点击 task/subagent 行后关闭 popover，可以解决小屏用户“点了跳转但浮层挡住目标”的痛点，同时保留 edits/MCP 面板的现有查看行为。
- 本轮规划：只调整输入区 task/subagent selection 后的 open tab 状态，不改右栏 `StatusPanel`、不改 `handleSelectStatusTool`、不改消息锚点/高亮、不改 i18n 或后端。优先级中等偏高：用户价值中高（直接改善上一轮新增交互的完成感）、出现频率中（小屏工具/子代理定位时触发）、实现成本低（纯 helper + 一行状态更新）、风险低（disabled/no-handler 路径保持当前 tab）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 新增 `dismisses the transient status popover after a transcript tool jump` 回归，覆盖有 selection handler 时 `tasks` / `subagents` 变为 `null`，无 handler 时保留当前 tab。`src/components/chat/ChatInputStatusTabs.tsx` 新增 `getInputStatusTabAfterToolSelection()` 并在工具行点击时调用 `setOpenTab(...)` 后继续委托 `onSelectTool`，实现跳转后关闭临时 popover。`.trellis/spec/frontend/component-guidelines.md` 已同步 small-screen fallback 的 task/subagent jump 行触发定位后应关闭 popover 的契约。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 1 项，失败点为 `getInputStatusTabAfterToolSelection is not a function`。GREEN：同命令通过（1 file / 16 tests）。相邻验证通过：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/MessageList.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatStatusSummary.test.ts src/utils/chatNavigation.test.ts`（6 files / 77 tests，仅 Browserslist/caniuse-lite 过期提示）。全量验证通过：`npm test`（37 files / 336 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests passed，2 doctests ignored）、IDE `build_project`（`problems: []`）。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。构建/IDE 生成的 `C:/guodevelop/ccg-switch/dist` 与 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并清理。
- 未验证项：未启动真实 Tauri 桌面做窄屏输入区 task/subagent 行点击后 popover 关闭、目标滚动、focus 和高亮的视觉点测；未与 cc-gui 做真实运行并排截图。
- 下一步候选：1) 启动真实 Tauri 桌面做窄屏/宽屏点测，确认小屏点击 tasks/subagents 行后 popover 关闭且目标工具块高亮可见，宽屏右栏仍为主状态索引；2) 做 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、输入区 fallback、会话列表、provider/model 图标和搜索反馈；3) 如果真实点测发现关闭 popover 后滚动目标仍被 composer 遮挡，下一轮只微调 `scrollIntoView` block 策略或额外 scroll offset，不改锚点数据结构；4) 若用户继续反馈大历史卡顿，优先转向后端 tail reader / 分页搜索，不再继续在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat input status popover accessibility

- 目标：补齐输入区 `ChatInputStatusTabs` 小屏 quick-detail popover 的可访问性闭环。上一轮已让 task/subagent 行可跳转并在跳转后关闭 popover，但打开的详情面板本身仍只是一个可滚动 `div`，缺少可聚焦和命名区域语义；键盘用户无法直接进入这个滚动上下文浏览任务、子代理、编辑或 MCP 详情。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端 component/state/quality/type 规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph / cc-gui 诊断。验证方式：读取本项目 `ChatInputStatusTabs.tsx`、`ChatInputStatusTabs.test.tsx` 和 cc-gui `StatusPanel` / `TodoList` / `SubagentList`，确认本项目已超越 cc-gui 做 transcript jump，但 quick-detail popover 还缺少命名可聚焦滚动区。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，断言打开的 `chat-input-status-popover-panel` 渲染为 `role="region"`、`tabIndex={0}`，并使用 i18n key `chat.layout.inputStatusDetailsRegion` 作为 accessible label；旧实现应因缺少这些属性失败。
- 功能点 4：实现最小展示/交互改动。验证方式：`ChatInputStatusTabs` 只给 popover panel 增加 `role`、`tabIndex`、`aria-label` 和低噪音 focus ring；新增英中文 i18n key；不改 task/subagent 跳转、popover 关闭策略、状态摘要或后端。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 composer status strip 的 quick-detail popover 必须是命名且可聚焦的滚动 region。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `ChatInputStatusTabs` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、必要时 `cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 `dist` / `out`。

## 迭代记录 2026-06-19 chat input status popover accessibility

- 上轮实际进展：上一轮记录声称已让小屏输入区 `ChatInputStatusTabs` 的 task/subagent 行在 transcript jump 后关闭 transient popover；代码复查确认 `src/components/chat/ChatInputStatusTabs.tsx` 已存在 `getInputStatusTabAfterToolSelection()`，点击工具行会先更新 `openTab`，并继续委托 `onSelectTool`；`src/pages/ChatPage.tsx` 已把 `handleSelectStatusTool` 接入输入区状态条。已知阻塞仍是未启动真实 Tauri 桌面做窄屏点击、滚动、focus 和高亮视觉点测，以及未与 cc-gui 做真实运行并排截图。本轮复查确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`；用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径仍为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 本轮诊断（补齐 cc-gui）：cc-gui `webview/src/components/StatusPanel/StatusPanel.tsx` 把 todo/subagent/file changes 放在临时 popover 中，基础体验是可快速查看状态详情；本项目的小屏 composer status strip 已做到比 cc-gui 更进一步的 transcript jump，但打开的 `chat-input-status-popover-panel` 仍只是一个滚动 `div`，没有 `role`、命名或 `tabIndex`。键盘用户打开任务/子代理/编辑/MCP 详情后，无法直接聚焦这个滚动上下文。
- 本轮诊断（超越 cc-gui）：本项目把 composer status strip 设计成右栏 `StatusPanel` 的小屏 fallback。右栏活动历史滚动区上一轮已补齐 named region；输入区 quick-detail popover 也应该有同样的可访问性边界。给临时详情面板增加命名可聚焦 region 可以解决“详情已展开但键盘无法可靠进入滚动区域”的痛点，同时不改变布局、跳转、状态摘要或后端行为。
- 本轮规划：只做 popover panel 的可访问性属性和 i18n 文案，不改 task/subagent 行按钮、不改 `onSelectTool`、不改 Escape/outside-click 关闭、不改 `ChatPage` 和任何 store。优先级中等偏高：用户价值中等（键盘/辅助技术可用性）、出现频率中（小屏或窄窗口使用状态详情时触发）、实现成本低（一个容器属性 + 两条 locale + SSR 断言）、风险低（纯展示语义）。
- 本轮完成：`src/components/chat/ChatInputStatusTabs.test.tsx` 扩展 anchored popover 回归，断言打开的 quick-detail panel 带 `role="region"`、`tabIndex={0}` 和 `chat.layout.inputStatusDetailsRegion` accessible label。`src/components/chat/ChatInputStatusTabs.tsx` 给 `chat-input-status-popover-panel` 增加 `role="region"`、`tabIndex={0}`、`aria-label={t('chat.layout.inputStatusDetailsRegion')}` 和低噪音 focus ring。`src/locales/en.json` / `src/locales/zh.json` 新增 `Status details` / `状态详情`。`.trellis/spec/frontend/component-guidelines.md` 已同步：composer status strip 的 quick-detail popover 滚动容器必须是可聚焦、有命名的 region。
- 本轮验证：RED：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx` 先失败 1 项，失败点为旧 HTML 缺少 `role="region"`，符合预期。GREEN：同命令通过（1 file / 16 tests）。相邻验证通过：`npm test -- src/components/chat/ChatInputStatusTabs.test.tsx src/components/chat/StatusPanel.test.tsx src/components/chat/MessageList.test.tsx src/components/chat/ContentBlockRenderer.test.tsx src/utils/chatStatusSummary.test.ts src/utils/chatNavigation.test.ts`（6 files / 77 tests，仅 Browserslist/caniuse-lite 过期提示）。全量验证通过：`npm test`（37 files / 336 tests，仅 Browserslist/caniuse-lite 过期提示）、`npm run build`（`tsc && vite build`，仅 Browserslist/caniuse-lite 过期提示）、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml`（114 tests passed，2 doctests ignored）、IDE `build_project`（`problems: []`）。`git diff --check` 与 `git diff --cached --check` exit 0；`git diff --check` 仅输出既有 LF/CRLF 转换提示。构建/IDE 生成的 `C:/guodevelop/ccg-switch/dist` 与 `C:/guodevelop/ccg-switch/out` 已确认位于工作区内并清理，复查均不存在。
- 未验证项：本轮未启动真实 Tauri 桌面做窄屏 quick-detail popover 的 Tab 聚焦、方向键/PageUp/PageDown 滚动、focus ring 视觉强度、task/subagent 跳转后高亮可见性点测；未与 cc-gui 做真实运行并排截图。
- 下一步候选：1) 启动真实 Tauri 桌面做窄屏/宽屏点测，确认输入区 quick-detail popover 可聚焦可滚动、task/subagent 行跳转后 popover 关闭且目标高亮可见，宽屏右栏仍为主状态索引；2) 做 cc-gui 与本项目真实运行画面并排截图审计，重点看右栏密度、输入区 fallback、会话列表、provider/model 图标和搜索反馈；3) 如果真实点测发现关闭 popover 后滚动目标仍被 composer 遮挡，下一轮只微调 `scrollIntoView` block 策略或额外 scroll offset，不改锚点数据结构；4) 若用户继续反馈大历史卡顿，优先转向后端 tail reader / 分页搜索，不再继续在前端完整数组上补丁。

## 本轮 PLAN 2026-06-19 chat input status edit selection popover behavior

- 目标：补齐输入区 `ChatInputStatusTabs` edits 面板的选择语义。当前 task/subagent 行已经在无 handler 时 disabled，并在触发 transcript jump 后关闭临时 popover；edit 行仍然在无 `onSelectedEditChange` 时可聚焦/可点击但实际 no-op，且选择文件后不关闭浮层，容易遮挡随后打开的页面级 diff/context。
- 功能点 1：恢复上下文与路径确认。验证方式：读取 `TODO_LIST.md`、当前 Trellis 任务制品、前端规范和 `package.json`；确认 `C:/guodevelop/ccg-switch` 可读且有 `.codegraph/`，用户原始 `C:/guodevelop/jetbrains-cc-gui` 不存在，实际可读对标路径为 `C:/guodevelop/demo/jetbrains-cc-gui`。
- 功能点 2：CodeGraph / cc-gui 诊断。验证方式：读取本项目 `ChatInputStatusTabs.tsx` / 测试与 cc-gui `StatusPanel` / `FileChangesList` 状态入口，确认本项目 edits 行复用 page-level selection handler，但缺少 disabled/no-handler 与选择后关闭 popover 的契约。
- 功能点 3：补 RED 测试。验证方式：扩展 `src/components/chat/ChatInputStatusTabs.test.tsx`，断言 edit selection helper 在可选择时返回 `null`、无 handler 时保留当前 tab；断言有 handler 的 edit 行不是 disabled，无 handler 的 edit 行是 disabled。
- 功能点 4：实现最小交互改动。验证方式：`ChatInputStatusTabs` 新增 edit selection helper 和本地 handler；edit 行在无 handler 时 disabled，只读但保持现有展示；有 handler 时点击先关闭 transient popover，再委托 `onSelectedEditChange`。
- 功能点 5：同步 Trellis 规范。验证方式：更新 `.trellis/spec/frontend/component-guidelines.md`，记录 composer status strip 的 edit 行无 handler 时必须只读，选择后应关闭临时 popover，避免遮挡页面级 diff/context。
- 功能点 6：质量验证。验证方式：运行 RED/GREEN 定向 `ChatInputStatusTabs` 测试、相邻 Chat UI 测试、`npm test`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、必要时 `cargo test --manifest-path src-tauri/Cargo.toml`、IDE build、`git diff --check` / `git diff --cached --check`，并清理 `dist` / `out`。
