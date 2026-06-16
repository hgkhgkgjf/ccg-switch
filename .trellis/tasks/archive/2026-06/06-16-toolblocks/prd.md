# 工具调用可视化 (ToolBlocks)

## Goal

解析 daemon 返回的 tool_use/tool_result，实现可视化工具块组件，让用户清晰看到 AI 调用了哪些工具、传递了什么参数、得到了什么结果。

## Background

**当前状态**:
- ChatPage 的 MessageBubble 只渲染纯文本 content
- daemon 返回的 tool_use/tool_result 被当作普通文本显示
- 用户无法直观看到工具调用情况

**参考实现**: jetbrains-cc-gui
- GenericToolBlock.tsx (378 行) - 通用工具块
- 7 种专用组件：Bash / Edit / Read / Search / Agent / Task
- 折叠式卡片设计，支持展开查看详细参数

**数据来源**:
- daemon 通过 `chat://stream` 事件发送 `[MESSAGE]` 标签
- 消息结构：`{ type: "assistant", message: { content: [...] } }`
- content 数组包含多种块类型：text / tool_use / tool_result

## Requirements

### 数据模型扩展

当前 `ChatMessage` 只有简单的 `content: string`，需要扩展为：

```typescript
interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;        // 简化的纯文本（兼容旧代码，流式累积）
    raw?: MessageRaw;       // 新增：完整的结构化数据（来自 [MESSAGE] 标签）
    streaming?: boolean;
    error?: string;
    createdAt: number;
}

// 模仿 jcc-gui 的 ClaudeMessage.raw 结构
interface MessageRaw {
    type: 'user' | 'assistant';
    message: {
        content: ContentBlock[];  // 核心：结构化内容块数组
    };
    uuid?: string;
    timestamp?: string;
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface TextBlock {
    type: 'text';
    text: string;
}

interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content?: string | ContentBlock[];  // 可能是字符串或嵌套块数组
    is_error?: boolean;
}
```

**关键设计决策**：
- `content` 保留为字符串（流式累积，向后兼容）
- `raw` 新增字段，存储完整的 MESSAGE JSON
- `raw.message.content` 是 ContentBlock 数组（工具块的数据源）

### 组件架构

**Phase 1: 基础架构**（必需）
1. GenericToolBlock - 通用工具块组件
   - 工具名称显示（带图标）
   - 参数摘要（文件路径、命令等）
   - 折叠/展开交互
   - 状态指示器（pending / completed / error）

2. ContentBlockRenderer - 块渲染器
   - 根据块类型路由到对应组件
   - text → 纯文本（或 Markdown，后续任务）
   - tool_use → GenericToolBlock
   - tool_result → 结果显示（成功/失败）

**Phase 2: 专用组件**（可选，按需实现）
3. BashToolBlock - Bash 命令执行
4. EditToolBlock - 文件编辑（带 diff 预览）
5. ReadToolBlock - 文件读取
6. SearchToolGroupBlock - 搜索结果聚合
7. AgentGroupBlock - 子代理调用
8. TaskExecutionBlock - 任务执行状态

### 交互功能

1. **折叠/展开**
   - 默认折叠，只显示工具名称和摘要
   - 点击展开查看完整参数
   - 参数格式化（JSON 缩进，长字符串截断）

2. **文件路径点击**（后续任务，依赖 Tauri 文件打开能力）
   - file_path / path 参数渲染为可点击链接
   - 点击打开文件（或在浏览器中不可用时复制路径）

3. **状态指示**
   - pending: 工具调用中（黄色点）
   - completed: 调用完成（绿色点）
   - error: 调用失败（红色点）

4. **复制功能**（可选，后续优化）
   - 复制参数按钮
   - 复制结果按钮

### 数据流处理（参考 jcc-gui 架构）

**jcc-gui 的架构**:
1. Java 后端解析 `[MESSAGE]` 标签，提取 JSON
2. 调用前端 `window.updateMessages(json)` 传递完整消息数组
3. 前端接收 `ClaudeMessage[]`，每条消息包含 `raw` 字段（含 content 数组）

**我们的架构**（Tauri + React）:
1. **Rust 层**（最小化处理）
   - daemon_client 监听 daemon stdout
   - 检测 `[MESSAGE]` 标签，提取 JSON 字符串
   - 通过 Tauri 事件 `chat://message` 发送完整 JSON 到前端
   - **不解析 content 数组**（保持简单）

2. **前端层**（useChatStore）
   - 监听 `chat://message` 事件
   - 解析 JSON，提取 `message.content` 数组
   - 将 content 数组存储到 `ChatMessage.raw.content`
   - 生成简化的 `content` 字符串（向后兼容）

3. **渲染层**（MessageBubble + ContentBlockRenderer）
   - 读取 `message.raw.content` 数组
   - 遍历数组，根据块类型渲染对应组件
   - text → 纯文本（或 Markdown）
   - tool_use → GenericToolBlock
   - tool_result → （合并到 tool_use 显示状态）

**流式更新**:
- `[CONTENT_DELTA]` 继续追加到 `message.content`（纯文本）
- `[MESSAGE]` 完整更新 `message.raw`（结构化数据）
- 流式期间可能收到多次 `[MESSAGE]`（工具调用完成时）

**状态匹配**:
- tool_result 的 tool_use_id 关联到 tool_use 的 id
- 根据是否收到 tool_result 判断 pending/completed
- is_error 标志判断成功/失败

## Acceptance Criteria

### 基础功能（Phase 1）
- [ ] ChatMessage 类型扩展为支持 blocks 数组
- [ ] useChatStore 正确解析 daemon 的 MESSAGE 事件为 blocks
- [ ] GenericToolBlock 组件渲染工具名称、摘要、状态
- [ ] 折叠/展开交互正常
- [ ] 状态指示器正确显示 pending/completed/error
- [ ] 端到端测试：发送 "Read src/main.rs"，工具块正确显示

### 数据完整性
- [ ] 所有工具类型都能正确解析（Read, Edit, Bash, Grep, Glob...）
- [ ] 工具参数正确提取和格式化
- [ ] 流式更新不丢失数据

### UI/UX
- [ ] 工具块视觉风格与 DaisyUI 主题一致
- [ ] 折叠/展开动画流畅
- [ ] 长参数自动截断（hover 显示完整内容）
- [ ] 错误状态明确显示错误信息

## Out of Scope

- Markdown 渲染（独立任务：06-16-markdown）
- 文件路径点击打开文件（需 Tauri 文件打开命令）
- 复制按钮（可选优化，不阻塞 MVP）
- 专用组件 Phase 2（BashToolBlock 等，可选增强）
- 工具块分组逻辑（如多次 Read 同一文件合并显示，后续优化）

## Notes

这是一个**复杂任务**，需要 design.md 和 implement.md。

**参考文件**（jcc-gui）:
- `webview/src/components/toolBlocks/GenericToolBlock.tsx` (378 行)
- `webview/src/components/MessageItem/ContentBlockRenderer.tsx`
- `webview/src/types/index.ts` (ToolInput, ToolResultBlock 类型定义)
