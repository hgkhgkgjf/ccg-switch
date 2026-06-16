# 工具调用可视化 - 技术设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        ai-bridge daemon                      │
│  (Node.js, 输出 [MESSAGE] 标签到 stdout)                    │
└─────────────────┬───────────────────────────────────────────┘
                  │ stdout
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Rust daemon_client                        │
│  - 监听 stdout                                                │
│  - 检测 [MESSAGE] 标签，提取 JSON                            │
│  - 发送 Tauri 事件: chat://message                           │
└─────────────────┬───────────────────────────────────────────┘
                  │ Tauri Event
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      useChatStore                            │
│  - 监听 chat://message 事件                                   │
│  - 解析 JSON → MessageRaw                                     │
│  - 存储到 message.raw                                         │
│  - 维护 message.content (纯文本)                              │
└─────────────────┬───────────────────────────────────────────┘
                  │ React State
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      MessageBubble                           │
│  - 读取 message.raw?.message.content                         │
│  - 遍历 ContentBlock 数组                                     │
│  - 调用 ContentBlockRenderer                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │ Render
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  ContentBlockRenderer                        │
│  - 路由块类型到组件                                           │
│    • text → 纯文本 (后续任务: Markdown)                      │
│    • tool_use → GenericToolBlock                             │
│    • tool_result → (合并到 tool_use 显示)                    │
└─────────────────┬───────────────────────────────────────────┘
                  │ Component
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   GenericToolBlock                           │
│  - 工具名称 + 图标                                            │
│  - 参数摘要 (file_path / command)                            │
│  - 折叠/展开交互                                              │
│  - 状态指示器 (pending/completed/error)                      │
└─────────────────────────────────────────────────────────────┘
```

## 数据模型

### TypeScript 类型定义

**src/types/chat.ts** (扩展现有类型):

```typescript
/** 一条聊天消息 */
export interface ChatMessage {
    id: string;
    role: ChatRole;
    /** 已渲染的文本内容（流式累积，向后兼容） */
    content: string;
    /** 结构化数据（来自 [MESSAGE] 标签） */
    raw?: MessageRaw;
    streaming?: boolean;
    error?: string;
    createdAt: number;
}

/** MESSAGE 标签的完整结构 */
export interface MessageRaw {
    type: 'user' | 'assistant';
    message: {
        content: ContentBlock[];
    };
    uuid?: string;
    timestamp?: string;
}

/** 内容块联合类型 */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface TextBlock {
    type: 'text';
    text: string;
}

export interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content?: string | ContentBlock[];
    is_error?: boolean;
}
```

**src/types/toolblock.ts** (新增):

```typescript
/** GenericToolBlock 组件的 Props */
export interface GenericToolBlockProps {
    name: string;
    input: Record<string, unknown>;
    result?: ToolResultBlock | null;
    toolId: string;
}

/** 工具状态 */
export type ToolStatus = 'pending' | 'completed' | 'error';
```

### Rust 事件定义

**src-tauri/src/models/chat.rs** (新增):

```rust
use serde::{Deserialize, Serialize};

/// chat://message 事件载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageEvent {
    /// 原始 JSON 字符串（前端负责解析）
    pub json: String,
}
```

## 组件架构

### 1. ContentBlockRenderer (新增)

**职责**: 根据块类型路由到对应组件

**位置**: `src/components/chat/ContentBlockRenderer.tsx`

**接口**:
```typescript
interface ContentBlockRendererProps {
    blocks: ContentBlock[];
    /** 用于匹配 tool_result 到 tool_use */
    messageId: string;
}
```

**渲染逻辑**:
1. 遍历 blocks 数组
2. 对于每个块：
   - `type === 'text'` → 渲染 `<div className="whitespace-pre-wrap">{block.text}</div>`
   - `type === 'tool_use'` → 查找对应的 tool_result，渲染 `<GenericToolBlock>`
   - `type === 'tool_result'` → 跳过（已合并到 tool_use 显示）

### 2. GenericToolBlock (新增)

**职责**: 通用工具块组件，适用所有工具类型

**位置**: `src/components/chat/GenericToolBlock.tsx`

**参考**: `jetbrains-cc-gui/webview/src/components/toolBlocks/GenericToolBlock.tsx` (378 行)

**UI 结构**:
```tsx
<div className="tool-block border rounded-lg p-3 my-2">
  <div className="tool-header flex items-center justify-between cursor-pointer" onClick={toggle}>
    <div className="flex items-center gap-2">
      <ToolIcon name={name} />
      <span className="font-medium">{getToolDisplayName(name)}</span>
      <span className="text-sm text-base-content/60">{summary}</span>
    </div>
    <div className="flex items-center gap-2">
      <StatusIndicator status={status} />
      {hasExpandableContent && <ChevronIcon expanded={expanded} />}
    </div>
  </div>
  {expanded && hasExpandableContent && (
    <div className="tool-details mt-2 pt-2 border-t">
      {Object.entries(filteredParams).map(([key, value]) => (
        <div key={key} className="param-row">
          <span className="param-key">{key}:</span>
          <span className="param-value">{formatValue(value)}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

**核心功能**:
1. **工具名称映射**
   - Read → "读取文件"
   - Edit → "编辑文件"
   - Bash → "运行命令"
   - ... (参考 jcc-gui 的 toolKeyMap)

2. **参数摘要提取**
   - `file_path` / `path` → 显示文件名
   - `command` / `cmd` → 显示命令摘要（截断长命令）
   - `search_term` / `pattern` → 显示搜索词

3. **参数过滤**
   - 忽略字段：`file_path`, `path`, `command`, `cmd`, `description`, `workdir`
   - 这些字段已在摘要中显示，不重复展示

4. **状态计算**
   ```typescript
   function getToolStatus(result?: ToolResultBlock): ToolStatus {
       if (!result) return 'pending';
       if (result.is_error) return 'error';
       return 'completed';
   }
   ```

5. **图标映射**
   - 使用 lucide-react 图标
   - 映射表：
     - read → Eye
     - edit / write → Edit
     - bash → Terminal
     - grep / search → Search
     - glob → Folder
     - 默认 → Tool

### 3. StatusIndicator (新增)

**职责**: 显示工具调用状态的小圆点

**位置**: `src/components/chat/StatusIndicator.tsx`

**UI**:
```tsx
<div className={`
  w-2 h-2 rounded-full
  ${status === 'pending' ? 'bg-warning animate-pulse' : ''}
  ${status === 'completed' ? 'bg-success' : ''}
  ${status === 'error' ? 'bg-error' : ''}
`} />
```

### 4. MessageBubble (修改现有)

**位置**: `src/pages/ChatPage.tsx`

**修改点**:
```tsx
function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    const hasBlocks = message.raw?.message?.content && message.raw.message.content.length > 0;
    
    return (
        <div className={`chat ${isUser ? 'chat-end' : 'chat-start'}`}>
            <div className={`chat-bubble ...`}>
                {hasBlocks ? (
                    <ContentBlockRenderer 
                        blocks={message.raw.message.content} 
                        messageId={message.id}
                    />
                ) : (
                    message.content || <Loader2 className="animate-spin" />
                )}
            </div>
        </div>
    );
}
```

## Rust 层实现

### 1. daemon_client 修改

**位置**: `src-tauri/src/services/daemon_client.rs`

**修改点**: 在 stdout 解析逻辑中检测 `[MESSAGE]` 标签

**伪代码**:
```rust
fn handle_stdout_line(line: &str, app: &AppHandle) {
    if let Some(tag) = extract_tag(line) {
        match tag.as_str() {
            "MESSAGE" => {
                // 提取 JSON 部分（tag 后的内容）
                let json = line.trim_start_matches("[MESSAGE]").trim();
                app.emit("chat://message", ChatMessageEvent {
                    json: json.to_string(),
                })?;
            }
            "CONTENT_DELTA" => {
                // 保持现有逻辑
                app.emit("chat://stream", ...)?;
            }
            _ => {
                // 其他标签也通过 stream 发送
                app.emit("chat://stream", ...)?;
            }
        }
    }
}
```

**边界情况处理**:
- 多行 JSON：如果 JSON 换行（理论上 daemon 输出在一行），需要累积多行
- 空 JSON：检查 json.is_empty()，跳过
- 解析失败：记录日志，不中断流程

### 2. 新增 Tauri 命令

无需新增命令，只需新增事件监听。

## 状态管理

### useChatStore 修改

**位置**: `src/stores/useChatStore.ts`

**新增监听器**:
```typescript
// 在 init() 中添加
const unlistenMessage = await listen<{ json: string }>('chat://message', (event) => {
    try {
        const raw = JSON.parse(event.payload.json) as MessageRaw;
        handleMessageUpdate(raw);
    } catch (e) {
        console.error('[useChatStore] Failed to parse MESSAGE:', e);
    }
});

// 保存 unlisten 函数用于清理
```

**新增方法**:
```typescript
function handleMessageUpdate(raw: MessageRaw) {
    setMessages((prev) => {
        // 查找最后一条相同角色的消息
        const lastIndex = prev.findLastIndex(m => m.role === raw.type);
        if (lastIndex === -1) {
            // 不应该发生（MESSAGE 总是更新已有消息）
            console.warn('[useChatStore] Received MESSAGE without existing message');
            return prev;
        }
        
        const updated = [...prev];
        updated[lastIndex] = {
            ...updated[lastIndex],
            raw,  // 更新 raw 字段
        };
        return updated;
    });
}
```

**流式 vs MESSAGE 的协调**:
- `[CONTENT_DELTA]` 更新 `message.content` (纯文本)
- `[MESSAGE]` 更新 `message.raw` (结构化)
- 两者互不干扰（字段独立）

## 兼容性

### 向后兼容

**ChatMessage.content 保持不变**:
- 流式对话仍然只更新 `content` 字段
- 如果没有 tool_use，`raw` 为 undefined
- MessageBubble 优先渲染 `raw`，fallback 到 `content`

### 未来扩展

**Markdown 渲染（后续任务 06-16-markdown）**:
- TextBlock 渲染时调用 Markdown 组件
- 只需修改 ContentBlockRenderer，不影响其他部分

**Thinking 块（后续任务 06-16-thinking）**:
- 新增 ThinkingBlock 类型
- ContentBlockRenderer 添加新的分支

**专用组件（可选）**:
- BashToolBlock 继承 GenericToolBlock
- 覆盖部分渲染逻辑（如显示实时输出）

## 性能考量

### 1. 避免重复渲染

**问题**: MESSAGE 事件可能在流式期间多次到达（每次工具调用完成）

**解决**:
- React 的对象引用比较（只有 raw 变化才重新渲染）
- ContentBlockRenderer 使用 React.memo
- GenericToolBlock 使用 useMemo 缓存计算结果

### 2. 大量工具调用

**问题**: 一次对话可能有 10+ 个工具调用

**解决**:
- 默认折叠（只显示摘要）
- 懒加载展开内容（expanded 状态控制）
- 虚拟滚动（后续任务 06-16-performance-optimization）

### 3. JSON 解析

**问题**: 每次 MESSAGE 事件都解析 JSON

**解决**:
- 只在 useChatStore 解析一次
- 组件直接使用解析后的对象
- 不在渲染循环中解析

## 错误处理

### 1. JSON 解析失败

**场景**: daemon 输出损坏的 JSON

**处理**:
```typescript
try {
    const raw = JSON.parse(json);
} catch (e) {
    console.error('[useChatStore] Invalid MESSAGE JSON:', json, e);
    // 不更新 raw，保持上一次的状态
    return;
}
```

### 2. ContentBlock 类型未知

**场景**: daemon 返回新的块类型（如 image）

**处理**:
```typescript
// ContentBlockRenderer 中
default:
    console.warn('[ContentBlockRenderer] Unknown block type:', block.type);
    return <div className="text-warning">Unknown block: {block.type}</div>;
```

### 3. tool_result 找不到 tool_use

**场景**: 数据不一致

**处理**:
- GenericToolBlock 接收 result 为 optional
- 没有 result 时显示 pending 状态

## 测试策略

### 单元测试

1. **ContentBlockRenderer**
   - 输入空数组 → 不渲染
   - 输入 text 块 → 渲染纯文本
   - 输入 tool_use 块 → 渲染 GenericToolBlock
   - 输入混合块 → 正确分发

2. **GenericToolBlock**
   - 工具名称映射正确
   - 参数摘要提取正确
   - 状态计算正确
   - 折叠/展开交互

3. **useChatStore.handleMessageUpdate**
   - 更新现有消息的 raw 字段
   - 不影响其他消息

### 集成测试

1. **端到端流程**
   - 发送 "Read src/main.rs"
   - 验证 tool_use 块显示
   - 验证状态从 pending 变为 completed

2. **流式 + MESSAGE 协调**
   - 流式文本正确累积到 content
   - MESSAGE 正确更新 raw
   - 两者不冲突

## 回滚方案

如果本任务出现问题，可以快速回滚：

1. **前端回滚**
   - MessageBubble 恢复为纯文本渲染
   - 删除 ContentBlockRenderer 和 GenericToolBlock
   - useChatStore 移除 chat://message 监听器

2. **Rust 回滚**
   - daemon_client 移除 MESSAGE 标签检测
   - 所有 stdout 继续通过 chat://stream 发送

3. **数据兼容**
   - ChatMessage.raw 是可选字段，不影响现有数据
   - 回滚后 raw 字段简单被忽略

## 安全性

### XSS 防护

**风险**: tool_use 的 input 参数可能包含恶意脚本

**防护**:
- 使用 React 的自动转义（JSX 渲染）
- 参数值显示时不使用 dangerouslySetInnerHTML
- 文件路径不渲染为可点击链接（本任务中）

### 数据验证

**风险**: daemon 返回的 JSON 格式不符合预期

**防护**:
```typescript
function validateMessageRaw(raw: unknown): raw is MessageRaw {
    if (typeof raw !== 'object' || raw === null) return false;
    const obj = raw as Record<string, unknown>;
    if (obj.type !== 'user' && obj.type !== 'assistant') return false;
    if (!obj.message || typeof obj.message !== 'object') return false;
    const msg = obj.message as Record<string, unknown>;
    if (!Array.isArray(msg.content)) return false;
    return true;
}
```

## 部署注意事项

### 开发环境

- 使用 `npm run tauri dev` 启动
- 修改 Rust 代码需重启
- 修改前端代码自动 HMR

### 生产构建

- `npm run tauri build` 打包
- 测试场景：
  1. 纯文本对话（无工具调用）
  2. 单个工具调用
  3. 多个工具调用
  4. 工具调用失败（is_error: true）

### 日志

**Rust 层**:
```rust
debug!("[daemon_client] Detected MESSAGE tag, json_len={}", json.len());
```

**前端层**:
```typescript
console.debug('[useChatStore] Received MESSAGE, blocks:', raw.message.content.length);
console.debug('[GenericToolBlock] Rendering tool:', name, 'status:', status);
```

生产环境可通过环境变量控制日志级别。
