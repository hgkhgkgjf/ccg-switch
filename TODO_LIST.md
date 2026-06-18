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
