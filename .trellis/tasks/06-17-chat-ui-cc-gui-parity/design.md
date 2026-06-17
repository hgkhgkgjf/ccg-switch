# Chat UI cc-gui parity - Design

## 1. Objective

将 ccg-switch 的 Chat 页面从当前“气泡聊天”界面升级为接近 jetbrains-cc-gui 的 IDE 风格对话面板。设计目标是复用当前项目的 Tauri/Zustand/ChatMessage 协议，同时引入 cc-gui 的消息列表结构、消息项渲染策略、流式反馈、复制操作、Thinking 展开行为、长会话折叠和后续搜索/锚点/状态面板扩展点。

## 2. Current State

### 2.1 Current ccg-switch flow

```text
Tauri events / commands
  -> useChatStore
  -> ChatPage
  -> local MessageBubble
  -> ContentBlockRenderer / MarkdownBlock / ThinkingBlock / ToolBlock
```

Key traits:

- `ChatPage.tsx` 同时负责页面布局、SDK 状态、滚动和消息项渲染。
- 消息项由局部 `MessageBubble` 函数实现，布局依赖 DaisyUI `chat chat-start/chat-end` 和 `chat-bubble`。
- 结构化内容由 `ContentBlockRenderer` 处理，工具结果通过 `findToolResult(messages, toolId, messageIndex)` 扫描后续消息。
- `MarkdownBlock` 已具备 marked、DOMPurify、highlight.js 和代码块复制能力，但链接安全、Mermaid、文件路径等细节弱于 cc-gui。
- `ThinkingBlock` 是独立组件，默认折叠，尚无“流式时自动展开最新 thinking”的上下文能力。

### 2.2 Target cc-gui patterns

cc-gui 的核心不是单个组件，而是一套消息面板架构：

```text
ChatScreen
  -> messages-shell
     -> MessageAnchorRail
     -> ConversationSearch
     -> messages-container
        -> WelcomeScreen
        -> MessageList
           -> collapsed earlier messages
           -> MessageItem
           -> WaitingIndicator
     -> StatusPanel
     -> ChatInputBox
```

High-value patterns to adapt:

- `MessageList` 管理可见窗口、折叠早期消息、search reveal API、等待指示器。
- `MessageItem` 管理单条消息复制、错误卡片、流式空占位、Thinking 自动展开、工具调用内容组织。
- `MarkdownBlock` 强化安全链接、代码高亮、Mermaid、文件链接/普通链接处理。
- `ChatInputBox` 使用更完整的输入模型：历史、IME、粘贴/拖拽、文件标签、快捷入口、可调整高度。

## 3. Proposed Architecture

### 3.1 Component decomposition

新增或重构组件建议：

```text
src/components/chat/
  ChatShell.tsx              # Chat 页面消息区/输入区组合壳，可逐步引入
  MessageList.tsx            # 消息窗口、折叠、等待指示、滚动锚点
  MessageItem.tsx            # 单条消息 IDE 风格渲染
  MessageActions.tsx         # 复制等操作，可选拆分
  WaitingIndicator.tsx       # loading/streaming 等待提示
  StreamingPlaceholder.tsx   # 空助手消息的延迟提示
  ConversationSearch.tsx     # 后续阶段，可先留设计接口
  MessageAnchorRail.tsx      # 后续阶段，可先留设计接口
  ScrollControl.tsx          # 后续阶段，可先留设计接口
```

第一阶段可以不一次性创建全部文件，但 `ChatPage.tsx` 中的局部 `MessageBubble` 应迁出到 `MessageList`/`MessageItem`，降低页面组件复杂度。

### 3.2 Data contracts

继续使用当前类型，不引入 cc-gui 的 `ClaudeMessage` 模型：

```ts
interface MessageListProps {
  messages: ChatMessage[];
  loading?: boolean;
  className?: string;
}
```

建议在实现中保持更明确的 props：

```ts
interface MessageItemProps {
  message: ChatMessage;
  messages: ChatMessage[];
  messageIndex: number;
  isLast: boolean;
}
```

`MessageItem` 内部仍通过：

- `shouldRenderChatMessage(message)` 判断是否展示。
- `getRenderableContentBlocks(message.raw)` 提取结构化 blocks。
- `findToolResult(messages, toolId, messageIndex)` 获取工具结果。
- `MessageMeta` 展示 duration/usage。

这样可以最大限度避免破坏现有 store 和工具渲染逻辑。

### 3.3 Rendering rules

#### User message

- 使用右侧/高亮但非气泡化的文档流卡片，展示用户输入文本或 raw text blocks。
- 顶部包含角色标签、时间和复制按钮。
- 空用户消息仅作为异常 fallback，不应常规出现。

#### Assistant message

- 使用全宽内容块布局，强调 Markdown、Thinking、ToolBlock 的阅读体验。
- 非 streaming 完成后展示 `MessageMeta`。
- error 状态展示为醒目的错误块，不复用聊天气泡 error 样式。

#### Streaming placeholder

- 当最后一条 assistant 消息处于 streaming 且无 blocks/文本时：
  - 立即显示轻量 loading indicator。
  - 约 300-400ms 后显示“已连接，正在等待响应”类提示，避免闪烁。
- timer 必须在 unmount 或条件变化时清理。

#### Thinking

- `ThinkingBlock` 需要支持受控或半受控展开状态，或者由 `MessageItem` 包装实现展开控制。
- 流式时自动展开最新 thinking block；旧 thinking 默认折叠。
- 用户手动展开/折叠后不应被下一次自动逻辑强行覆盖。

#### Tool results

- 第一阶段沿用 `ContentBlockRenderer` 的 Bash/Read/Edit/Agent/Generic 路由。
- 为未来 cc-gui 风格分组预留：`toolResultSignature` 或基于 block/result 的 memo key，确保后续 tool_result 到达后可刷新。

### 3.4 MessageList behavior

建议常量：

```ts
const VISIBLE_MESSAGE_WINDOW = 15;
const REVEAL_PAGE_SIZE = 30;
```

Behavior:

- 消息总数超过窗口时，仅展示最近 `VISIBLE_MESSAGE_WINDOW` 条可渲染消息附近内容。
- 顶部显示“显示更早 N 条消息”按钮，点击后每次展开 `REVEAL_PAGE_SIZE` 条或剩余数量。
- 折叠逻辑必须以 `shouldRenderChatMessage` 后的可显示消息为准，避免 internal tool_result 影响数量。
- 当新消息到达且用户处于底部时保持自动滚动；如果后续实现用户离底部检测，则不强制打断用户阅读历史。

### 3.5 Markdown design

Short-term:

- 保留当前 `MarkdownBlock` API：`content`、`isStreaming`。
- 补强 DOMPurify href hook，禁止控制字符和危险协议。
- 保持代码块复制按钮和流式代码围栏补全。

Mid-term:

- 增加 Mermaid lazy import，`securityLevel: 'strict'`。
- 将 Windows path、`file:` URL、http(s)、mailto 区分处理。
- 如需打开链接，走 Tauri 安全能力，不依赖浏览器全局行为。

### 3.6 Input design

第一阶段可以保留现有输入区，但需要将布局预留为 cc-gui 风格：

```text
ChatPage
  -> message area
  -> status panel slot
  -> composer container
```

后续 `ChatInputBox` 目标能力：

- IME composition safe enter handling。
- 输入历史上下导航。
- `@` 文件引用、`/` 命令、`#` agent、`!` prompt、`$` command 的候选入口。
- 粘贴/拖拽附件。
- prompt enhancer。
- 可调整高度。
- 发送/中断一体化状态。

## 4. Styling Strategy

- 使用 TailwindCSS/DaisyUI token，不引入 CSS Modules。
- 新组件默认使用 `bg-white dark:bg-base-100`、`border-gray-100 dark:border-base-200` 等项目现有卡片规范。
- 消息列表应减少强色气泡，改为边框、背景层级、左侧角色/状态标识和内容块间距。
- 操作按钮默认低可见度，hover/focus 时显示；但键盘 focus 必须可见。
- 图标使用 `lucide-react`。

## 5. i18n and Accessibility

新增文案必须加入：

- `src/locales/zh.json`
- `src/locales/en.json`

Likely keys:

```text
chat.message.copy
chat.message.copied
chat.message.showEarlier
chat.message.streamingConnected
chat.message.waiting
chat.message.user
chat.message.assistant
chat.thinking.title
```

Accessibility:

- Icon-only buttons must have `title` or `aria-label`。
- Collapsed message control must be a `<button>`，not clickable div。
- Streaming/waiting indicators can use `aria-live="polite"` where appropriate。

## 6. Risk and Compatibility

| Risk | Mitigation |
| --- | --- |
| Tool result internal messages accidentally displayed | Centralize filtering with `shouldRenderChatMessage` before collapse/render |
| Streaming scroll becomes annoying | Keep current auto-scroll first; later add bottom detection and ScrollControl |
| MessageItem becomes too large | Split actions, placeholders, thinking wrapper when complexity grows |
| Markdown link handling blocks valid local paths | Port cc-gui allowlist rules carefully and test Windows paths |
| i18n omissions break UX consistency | Add locale keys in same implementation step as components |

## 7. Rollback Strategy

- Keep current `ContentBlockRenderer`, `MarkdownBlock`, `MessageMeta` APIs stable during Phase 1.
- Replace only the message list presentation layer first; if regression occurs, `ChatPage` can temporarily switch back to the old local bubble renderer.
- Avoid changing `useChatStore` unless required by UI behavior; store changes have broader blast radius.

## 8. Review Gates

- Planning review before implementation.
- After Phase 1: visual/manual review with existing chat stream, tool call stream, error stream and empty conversation.
- After Markdown changes: security review for href sanitizer and DOMPurify hooks.
- Before completion: `npm run build` and targeted manual Tauri check.
