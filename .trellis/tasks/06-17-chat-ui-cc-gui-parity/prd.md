# Chat UI cc-gui parity

## Goal

对标 jetbrains-cc-gui 的 Chat 交互方式与前端渲染效果，重构 ccg-switch 对话 UI/UX。

## Background

当前 ccg-switch 的对话页已经具备基础会话能力、结构化消息渲染、Thinking/ToolBlock/Markdown 组件和 Tauri 事件流接入，但整体交互仍接近“即时通信气泡”模型：消息区域以 DaisyUI `chat-bubble` 为核心，输入区较简单，缺少 cc-gui 中的 IDE 风格信息架构、消息折叠、搜索锚点、状态面板、可复制消息操作、等待反馈、流式占位提示、增强 Markdown 细节等。

jetbrains-cc-gui 的目标体验不是单纯换皮，而是更像 IDE 内嵌 AI 面板：消息以文档流块状排版，工具调用、思考过程、代码块、状态信息和输入上下文被清晰组织。该任务用于把 cc-gui 的交互方式和前端渲染效果迁移到 ccg-switch，但不改变当前项目的 Tauri 后端协议、Zustand 状态模型和既有 Chat 数据类型。

## Requirements

### Functional Requirements

- 消息列表应从聊天气泡布局升级为 cc-gui 风格的 IDE 文档流布局，区分用户消息、助手消息、系统/错误状态和工具调用内容。
- 新的消息渲染层必须继续兼容当前 `ChatMessage`、`ContentBlock`、`MessageRaw`、`findToolResult`、`getRenderableContentBlocks`、`shouldRenderChatMessage` 等现有契约。
- 内部协议消息（例如仅承载 `tool_result` 的用户 raw 消息）不得作为普通对话内容展示。
- 支持较长会话的可读性优化：默认展示最近消息、折叠更早消息，并允许按批次展开。
- 助手消息应提供清晰的流式反馈：空助手占位、等待中提示、正在连接/正在生成提示，避免用户误以为无响应。
- 每条消息应支持复制文本内容，并提供可访问的按钮标题或 aria label。
- Thinking 内容应具备更接近 cc-gui 的展开策略：默认可折叠，流式输出时优先自动展开最新 thinking，且尊重用户手动切换。
- ToolBlock 渲染应保留当前已实现的 Bash/Read/Edit/Agent/Generic 分类能力，后续再逐步优化为更接近 cc-gui 的分组视觉。
- Markdown 渲染应提升到 cc-gui 类似质量：安全链接处理、代码块复制、语法高亮、流式代码围栏容错，并预留 Mermaid/文件链接等增强能力。
- 输入区应规划为后续支持 cc-gui 式交互：内容上下文、历史输入、快捷命令、附件/文件引用、IME 友好键盘处理、可调整高度和发送/中断状态。
- 对话页应预留搜索、锚点/导航、滚动控制、状态面板等扩展位置，避免第一阶段实现后再次大规模拆改。

### Non-functional Requirements

- 不直接复制 jetbrains-cc-gui 源码；只迁移交互模型、信息架构和关键渲染策略，代码需符合 ccg-switch 的 React + TypeScript + TailwindCSS + DaisyUI + Zustand 约定。
- 不改变后端 Tauri 命令、事件名、消息协议和 Rust 数据结构。
- 新增用户可见文案必须同时更新 `src/locales/zh.json` 和 `src/locales/en.json`。
- TypeScript 必须通过 strict 构建；不得引入新的 `any`、未使用变量或未使用参数。
- 视觉实现必须同时兼容浅色和深色主题。
- 对话列表的滚动、计时器、复制状态、事件监听等副作用必须正确清理，避免内存泄漏。
- 组件应按功能拆分，避免继续扩大 `ChatPage.tsx` 的复杂度。

## Constraints

- 当前项目运行在 Tauri 2 桌面环境，不具备 jetbrains-cc-gui 的 JetBrains/JCEF bridge；文件打开、外链打开等能力需使用当前项目可用的 Tauri API 或已有 shell 权限。
- 当前项目使用 Zustand；不要为迁移 cc-gui 而引入 React Context 大范围重构，除非某个局部上下文有明确收益。
- 当前项目使用 TailwindCSS/DaisyUI；不要引入 CSS Modules、styled-components 或直接照搬 cc-gui 样式文件。
- 父任务 `06-16-chat` 下已经覆盖 ToolBlocks、Markdown、Thinking、Input enhancement 等子方向；本任务聚焦“统一聊天 UI/UX 壳层与渲染体验”，避免重复实现无关后端能力。
- 第一阶段优先保证现有会话能力不回退，再逐步增强搜索、锚点、输入区高级能力。

## Out of Scope

- 不重写 Rust 后端 daemon、session、permission 或 provider 逻辑。
- 不实现 JetBrains IDE 专属能力，如 openClass、IDE project model、JCEF bridge。
- 不在本任务中完成所有 cc-gui 输入增强能力；输入区高级功能可按设计预留并拆分阶段落地。
- 不把 cc-gui 的所有 CSS、图标体系、上下文 provider 原样复制到当前项目。
- 不引入新的大型运行时校验库或状态管理库。

## Acceptance Criteria

- [ ] Trellis 任务包含完整 `prd.md`、`design.md`、`implement.md`，并明确与父任务/相关子任务的边界。
- [ ] 对话页消息区不再以 DaisyUI `chat-bubble` 为主要转录展示方式，而是采用 IDE 文档流消息项布局。
- [ ] 新消息列表正确使用 `shouldRenderChatMessage`，内部 `tool_result` 消息不单独显示。
- [ ] 结构化 content blocks、纯文本 streaming content、错误消息、usage/duration 元信息均可正常展示。
- [ ] 长会话支持折叠较早消息，并可逐步展开，不破坏滚动到底部体验。
- [ ] 最新助手流式消息在空内容阶段有清晰等待/连接提示。
- [ ] 消息复制、Thinking 展开、ToolBlock 渲染和 Markdown 渲染在浅色/深色主题下可用。
- [ ] 新增文案均已完成中英文 i18n。
- [ ] `npm run build` 通过。
- [ ] 若修改 Rust/Tauri 命令或后端类型，`cargo check --manifest-path src-tauri/Cargo.toml` 通过；若不修改后端，需在实现记录中说明未运行或无需运行。

## Notes

- 参考项目：`C:\guodevelop\demo\jetbrains-cc-gui`。
- 重点参考模块：`ChatScreen.tsx`、`MessageList.tsx`、`MessageItem.tsx`、`ChatInputBox.tsx`、`MarkdownBlock.tsx`。
- 当前项目重点改造入口：`src/pages/ChatPage.tsx`、`src/components/chat/*`、`src/stores/useChatStore.ts`、`src/utils/chatMessageFlow.ts`。
- 实现前应先完成设计评审，避免只做表层 CSS 调整。
