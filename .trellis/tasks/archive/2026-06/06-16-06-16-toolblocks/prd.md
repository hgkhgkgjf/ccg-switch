# 工具调用可视化 (ToolBlocks)

## Goal

实现 7 种专用工具块组件，解析 daemon 返回的 `tool_use` / `tool_result` 消息，提供折叠/展开、复制、重试等交互功能，对标 jetbrains-cc-gui 的工具可视化体验。

## Background

**当前状态**:
- ✅ 基础对话能力：用户输入 → daemon 调用 → 流式响应
- ✅ 简单文本渲染：纯文本消息显示
- ❌ 工具调用可视化：tool_use 和 tool_result 未解析，仅显示原始 JSON

**问题**:
- 用户看不到 Claude 正在调用什么工具（Read、Edit、Bash 等）
- 文件路径、命令参数、执行结果混在一起，难以阅读
- 无法快速定位工具执行失败的原因
- 缺少文件路径点击跳转、参数复制等交互

**参考实现**: `C:\guodevelop\demo\jetbrains-cc-gui`
- 7 种专用工具块组件（总代码量 ~2500 行）
- 智能分组：连续的同类工具调用自动合并（如 3 次 Read → ReadToolGroupBlock）
- 状态指示：pending（黄色呼吸）、completed（绿色）、error（红色）
- 丰富交互：文件路径点击跳转、参数复制、工具重试

## Requirements

### 1. 数据结构定义

#### 1.1 TypeScript 类型
参考 `jetbrains-cc-gui/webview/src/types/index.ts`，定义：

```typescript
// 消息块基础类型
interface ClaudeContentBlock {
  type: 'text' | 'image' | 'thinking' | 'tool_use' | 'tool_result' | 'attachment';
  // ... 其他字段
}

// 工具调用块
interface ToolUseBlock extends ClaudeContentBlock {
  type: 'tool_use';
  id: string;              // 工具调用唯一 ID（用于匹配 tool_result）
  name: string;            // 工具名称（如 "Read", "Edit", "Bash"）
  input: ToolInput;        // 工具参数（JSON 对象）
}

// 工具结果块
interface ToolResultBlock extends ClaudeContentBlock {
  type: 'tool_result';
  tool_use_id: string;     // 对应的 tool_use ID
  content: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;      // 是否执行失败
}

// 工具输入参数（通用）
interface ToolInput {
  [key: string]: unknown;
  // 常见字段：
  file_path?: string;
  path?: string;
  command?: string;
  old_string?: string;
  new_string?: string;
  // ...
}
```

#### 1.2 工具分类常量
参考 `jetbrains-cc-gui/webview/src/utils/toolConstants.ts`：

```typescript
// src/types/tools.ts
export const READ_TOOL_NAMES = new Set(['Read', 'read', 'ReadFile', 'read_file']);
export const EDIT_TOOL_NAMES = new Set(['Edit', 'edit', 'WriteFile', 'write_file', 'Write', 'write']);
export const BASH_TOOL_NAMES = new Set(['Bash', 'bash', 'ExecuteCommand', 'execute_command']);
export const SEARCH_TOOL_NAMES = new Set(['Grep', 'grep', 'Search', 'search', 'Glob', 'glob']);
export const AGENT_TOOL_NAMES = new Set(['Agent', 'agent', 'spawn_agent', 'task', 'Task']);
```

### 2. 核心组件实现

#### 2.1 GenericToolBlock（通用工具块）
**功能**: 处理所有未特殊化的工具调用（如 WebSearch、ToolSearch、AskUserQuestion 等）

**UI 结构**:
```
┌─────────────────────────────────────────────────┐
│ 🔧 ToolName   summary text          [●] status  │ ← header（可点击折叠/展开）
├─────────────────────────────────────────────────┤
│ Input Parameters:                               │
│   file_path: "/path/to/file.ts"                 │
│   limit: 100                                    │
│                                                  │
│ Result:                                         │
│   Successfully read 100 lines                   │
│   [Copy] [Retry]                                │
└─────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface GenericToolBlockProps {
  name?: string;           // 工具名称
  input?: ToolInput;       // 输入参数
  result?: ToolResultBlock | null;  // 执行结果
  toolId?: string;         // 工具调用 ID
}
```

**状态指示器**:
- `pending`: result 为 undefined 且工具未被拒绝
- `completed`: result 存在且 is_error !== true
- `error`: result.is_error === true 或工具被拒绝

**参考实现**: `jetbrains-cc-gui/webview/src/components/toolBlocks/GenericToolBlock.tsx` (671 行)

---

#### 2.2 BashToolBlock + BashToolGroupBlock
**功能**: 专门处理 Bash 命令执行

**单个 BashToolBlock**:
```
┌─────────────────────────────────────────────────┐
│ $ Bash   npm install                 [●] status │
│          git status                             │
├─────────────────────────────────────────────────┤
│ Exit Code: 0                                    │
│ Output:                                         │
│ ┌───────────────────────────────────────────┐  │
│ │ Already up to date.                       │  │
│ │ On branch main                            │  │
│ └───────────────────────────────────────────┘  │
│ [Copy Output] [Copy Command]                   │
└─────────────────────────────────────────────────┘
```

**分组 BashToolGroupBlock**:
连续 3+ 个 Bash 调用自动合并为 Group，显示：
```
┌─────────────────────────────────────────────────┐
│ $ Bash   3 commands                  [●] status │
├─────────────────────────────────────────────────┤
│ 1. npm install          ✓ Success               │
│ 2. npm run build        ✓ Success               │
│ 3. npm test             ✗ Failed                │
│                                                  │
│ [Expand All] [Collapse All]                     │
└─────────────────────────────────────────────────┘
```

**参考实现**:
- `jetbrains-cc-gui/webview/src/components/toolBlocks/BashToolBlock.tsx`
- `jetbrains-cc-gui/webview/src/components/toolBlocks/BashToolGroupBlock.tsx`

---

#### 2.3 EditToolBlock + EditToolGroupBlock
**功能**: 文件编辑操作可视化，支持 Diff 预览

**单个 EditToolBlock**:
```
┌─────────────────────────────────────────────────┐
│ ✏️ Edit   src/App.tsx              [●] status   │
├─────────────────────────────────────────────────┤
│ Changes:                                        │
│ - const foo = 'old';                            │
│ + const foo = 'new';                            │
│                                                  │
│ [View Full Diff] [Copy Path]                    │
└─────────────────────────────────────────────────┘
```

**分组 EditToolGroupBlock**:
```
┌─────────────────────────────────────────────────┐
│ ✏️ Edit   5 files modified          [●] status  │
├─────────────────────────────────────────────────┤
│ 📄 src/App.tsx           ✓ 3 changes            │
│ 📄 src/utils/helper.ts   ✓ 1 change             │
│ 📄 package.json          ✗ Failed               │
│                                                  │
│ [Expand All]                                     │
└─────────────────────────────────────────────────┘
```

**参考实现**:
- `jetbrains-cc-gui/webview/src/components/toolBlocks/EditToolBlock.tsx` (236 行)
- `jetbrains-cc-gui/webview/src/components/toolBlocks/EditToolGroupBlock.tsx`

---

#### 2.4 ReadToolBlock + ReadToolGroupBlock
**功能**: 文件读取操作可视化，支持行号范围显示

**单个 ReadToolBlock**:
```
┌─────────────────────────────────────────────────┐
│ 📄 Read   src/App.tsx  L50-L100     [●] status  │
├─────────────────────────────────────────────────┤
│ Read 50 lines from src/App.tsx                  │
│ [Open File] [Copy Path]                         │
└─────────────────────────────────────────────────┘
```

**文件路径点击**: 点击文件名 → 调用 `openFile(path, lineStart, lineEnd)` 在编辑器中打开

**参考实现**:
- `jetbrains-cc-gui/webview/src/components/toolBlocks/ReadToolBlock.tsx` (67 行)
- `jetbrains-cc-gui/webview/src/components/toolBlocks/ReadToolGroupBlock.tsx`

---

#### 2.5 SearchToolGroupBlock
**功能**: 搜索结果聚合显示（Grep、Glob）

```
┌─────────────────────────────────────────────────┐
│ 🔍 Search   "useState"              [●] status  │
├─────────────────────────────────────────────────┤
│ Found 15 matches in 3 files:                    │
│ 📄 src/App.tsx            8 matches             │
│ 📄 src/hooks/useData.ts   5 matches             │
│ 📄 src/utils/helper.ts    2 matches             │
│                                                  │
│ [Expand Results]                                 │
└─────────────────────────────────────────────────┘
```

**参考实现**: `jetbrains-cc-gui/webview/src/components/toolBlocks/SearchToolGroupBlock.tsx`

---

#### 2.6 AgentGroupBlock
**功能**: 子代理调用可视化，支持嵌套会话历史

```
┌─────────────────────────────────────────────────┐
│ 🤖 Agent   trellis-implement        [●] status  │
│            Opus 4.8 · 3f2a1b9c                   │
├─────────────────────────────────────────────────┤
│ Description: Implement user authentication       │
│                                                  │
│ Subagent History: (click to load)               │
│ [Load Subagent Session]                         │
└─────────────────────────────────────────────────┘
```

**高级功能**:
- 展开后显示子代理的完整消息历史（递归渲染 ContentBlockRenderer）
- 支持流式加载子代理历史（polling）

**参考实现**: `jetbrains-cc-gui/webview/src/components/toolBlocks/AgentGroupBlock.tsx` (72 行)

---

#### 2.7 TaskExecutionBlock
**功能**: Task 工具（spawn_agent、task）专用块

```
┌─────────────────────────────────────────────────┐
│ 🛠️ Task   trellis-implement         [●] status  │
│           Description: Implement feature X       │
├─────────────────────────────────────────────────┤
│ Agent ID: 3f2a1b9c-1234-5678-abcd-ef0123456789  │
│ Model: claude-opus-4-8                          │
│ Reasoning Effort: high                          │
│                                                  │
│ Total Duration: 2:34                            │
│ Total Tokens: 12,345                            │
│ Tool Use Count: 8                               │
└─────────────────────────────────────────────────┘
```

**参考实现**: `jetbrains-cc-gui/webview/src/components/toolBlocks/TaskExecutionBlock.tsx` (124 行)

---

### 3. 消息解析与分组逻辑

#### 3.1 MessageItem 组件职责
参考 `jetbrains-cc-gui/webview/src/components/MessageItem/MessageItem.tsx`：

1. **解析消息块**: 遍历 `message.content[]`，识别 `tool_use` 和 `tool_result`
2. **工具结果匹配**: 根据 `tool_use.id` 在后续消息中查找对应的 `tool_result`
3. **智能分组**: 连续的同类工具调用合并为 GroupBlock
4. **渲染分发**: 根据工具类型选择对应的组件

**分组规则**:
```typescript
// 伪代码
function groupToolBlocks(blocks: ClaudeContentBlock[]): GroupedBlock[] {
  const groups: GroupedBlock[] = [];
  let currentGroup: ToolUseBlock[] = [];
  
  for (const block of blocks) {
    if (block.type === 'tool_use') {
      const toolName = normalizeToolName(block.name);
      
      // 判断是否与当前组同类型
      if (currentGroup.length > 0 && isSameToolType(currentGroup[0], block)) {
        currentGroup.push(block);
      } else {
        // 提交当前组
        if (currentGroup.length >= 3) {
          groups.push({ type: 'group', tools: currentGroup });
        } else {
          currentGroup.forEach(t => groups.push({ type: 'single', tool: t }));
        }
        currentGroup = [block];
      }
    }
  }
  
  // 提交最后一组
  if (currentGroup.length >= 3) {
    groups.push({ type: 'group', tools: currentGroup });
  } else {
    currentGroup.forEach(t => groups.push({ type: 'single', tool: t }));
  }
  
  return groups;
}
```

#### 3.2 ContentBlockRenderer 组件
参考 `jetbrains-cc-gui/webview/src/components/MessageItem/ContentBlockRenderer.tsx`：

**职责**: 单个内容块的渲染分发器

```typescript
export function ContentBlockRenderer({ block, ... }: ContentBlockRendererProps) {
  if (block.type === 'text') {
    return <MarkdownBlock content={block.text} />;
  }
  
  if (block.type === 'tool_use') {
    const toolName = normalizeToolName(block.name);
    
    // Agent/Task 工具
    if (AGENT_TOOL_NAMES.has(toolName)) {
      return <TaskExecutionBlock ... />;
    }
    
    // Edit 工具
    if (EDIT_TOOL_NAMES.has(toolName)) {
      return <EditToolBlock ... />;
    }
    
    // Bash 工具
    if (BASH_TOOL_NAMES.has(toolName)) {
      return <BashToolBlock ... />;
    }
    
    // 默认：通用工具块
    return <GenericToolBlock ... />;
  }
  
  // ... 其他类型
}
```

---

### 4. 工具实用函数

#### 4.1 工具名称规范化
参考 `jetbrains-cc-gui/webview/src/utils/toolConstants.ts`：

```typescript
export function normalizeToolName(name?: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[-_]/g, '');
}

export function isToolName(name: string | undefined, toolNames: Set<string>): boolean {
  if (!name) return false;
  const normalized = normalizeToolName(name);
  return toolNames.has(normalized);
}
```

#### 4.2 文件路径解析
参考 `jetbrains-cc-gui/webview/src/utils/toolPresentation.ts`：

```typescript
export interface ToolTargetInfo {
  rawPath: string;           // 原始路径（input 中的值）
  cleanFileName: string;     // 文件名（不含路径）
  displayPath: string;       // 显示路径（相对路径优先）
  openPath: string;          // 打开路径（绝对路径）
  isFile: boolean;           // 是否是文件
  isDirectory: boolean;      // 是否是目录
}

export function resolveToolTarget(
  input: ToolInput,
  toolType: 'read' | 'edit' | 'bash'
): ToolTargetInfo | null {
  // 从 input 中提取文件路径（优先级：file_path > path > target_file）
  const rawPath = input.file_path || input.path || input.target_file;
  if (!rawPath || typeof rawPath !== 'string') return null;
  
  // ... 解析逻辑
}
```

#### 4.3 行号信息提取
```typescript
export function getToolLineInfo(
  input: ToolInput,
  target: ToolTargetInfo | null
): { start?: number; end?: number } {
  const start = input.offset || input.line || input.start_line;
  const end = input.limit || input.end_line;
  
  return {
    start: typeof start === 'number' ? start : undefined,
    end: typeof end === 'number' ? end : undefined,
  };
}
```

---

### 5. 状态管理与交互

#### 5.1 工具权限拒绝检测
参考 `jetbrains-cc-gui/webview/src/hooks/useIsToolDenied.ts`：

```typescript
export function useIsToolDenied(toolId?: string): boolean {
  // 从全局状态中查询该工具是否被用户拒绝
  // 数据来源：daemon 返回的 permission_denied 事件
  const deniedTools = useStore(state => state.deniedToolIds);
  return toolId ? deniedTools.has(toolId) : false;
}
```

#### 5.2 文件路径点击跳转
参考 `jetbrains-cc-gui/webview/src/utils/bridge.ts`：

```typescript
export function openFile(filePath: string, lineStart?: number, lineEnd?: number) {
  // Tauri 调用：通知后端在编辑器中打开文件
  invoke('open_file_in_editor', {
    filePath,
    lineStart,
    lineEnd,
  });
}
```

**Rust 后端命令**:
```rust
// src-tauri/src/commands/editor.rs
#[tauri::command]
pub async fn open_file_in_editor(
    file_path: String,
    line_start: Option<u32>,
    line_end: Option<u32>,
) -> Result<(), String> {
    // Windows: 打开默认编辑器或 VS Code
    // 格式: code --goto <path>:<line>:<column>
    let line_arg = line_start.map(|l| format!(":{}:1", l)).unwrap_or_default();
    let cmd = format!("code --goto \"{}{}\"", file_path, line_arg);
    
    Command::new("cmd")
        .args(&["/C", &cmd])
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

#### 5.3 参数复制功能
```typescript
function copyToolInput(input: ToolInput) {
  const text = JSON.stringify(input, null, 2);
  copyToClipboard(text);
}

function copyToolResult(result: ToolResultBlock) {
  const text = typeof result.content === 'string'
    ? result.content
    : JSON.stringify(result.content, null, 2);
  copyToClipboard(text);
}
```

---

### 6. 样式与主题

#### 6.1 DaisyUI 组件复用
- **卡片容器**: `card bg-base-100 shadow-sm`
- **折叠组件**: `collapse collapse-arrow`
- **状态徽章**: `badge badge-success` / `badge-warning` / `badge-error`
- **代码块**: `mockup-code bg-base-200`

#### 6.2 自定义样式
参考 `jetbrains-cc-gui/webview/src/styles/toolBlocks.css`：

```css
/* 工具块容器 */
.task-container {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  margin: 8px 0;
  background: var(--bg-secondary);
}

/* 工具块标题 */
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.task-header:hover {
  background: var(--bg-hover);
}

/* 状态指示器 */
.tool-status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tool-status-indicator.pending {
  background: #fbbf24; /* yellow-400 */
  animation: breathe 2s ease-in-out infinite;
}

.tool-status-indicator.completed {
  background: #10b981; /* green-500 */
}

.tool-status-indicator.error {
  background: #ef4444; /* red-500 */
}

@keyframes breathe {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* 文件路径链接 */
.clickable-file {
  color: var(--link-color);
  text-decoration: underline;
  cursor: pointer;
}

.clickable-file:hover {
  color: var(--link-hover-color);
}
```

---

## Acceptance Criteria

### 功能完整性
- [ ] 7 种工具块组件全部实现（Generic、Bash、Edit、Read、Search、Agent、Task）
- [ ] 智能分组：3+ 个连续同类工具自动合并为 GroupBlock
- [ ] 状态指示：pending（黄色呼吸）、completed（绿色）、error（红色）
- [ ] 工具结果匹配：根据 `tool_use_id` 正确关联 result

### 交互功能
- [ ] 折叠/展开：所有工具块默认展开，点击 header 折叠
- [ ] 文件路径点击：ReadToolBlock / EditToolBlock 的文件名可点击跳转
- [ ] 参数复制：每个工具块有"Copy Input"按钮
- [ ] 结果复制：每个工具块有"Copy Output"按钮（如果有结果）

### 样式一致性
- [ ] 使用 DaisyUI 主题变量（支持深色/浅色切换）
- [ ] 状态指示器动画流畅（pending 呼吸动画）
- [ ] 文件图标显示正确（根据扩展名）
- [ ] 响应式布局：移动端友好

### 性能要求
- [ ] 100 个工具调用渲染时间 < 500ms
- [ ] 折叠/展开动画流畅（60 FPS）
- [ ] 大工具结果（10000+ 字符）自动截断，点击"Show More"展开

### 兼容性
- [ ] 解析现有会话文件（~/.claude/projects/*/conversations/*.jsonl）无错误
- [ ] 兼容 jetbrains-cc-gui 的消息格式（ClaudeMessage 结构一致）
- [ ] 支持流式渲染：工具调用中途显示 pending 状态

---

## Technical Constraints

### 前端
- **框架**: React 19 + TypeScript 5.8
- **UI 库**: DaisyUI 4（不引入 Antd、Material-UI）
- **图标**: lucide-react（已安装）
- **文件图标**: 使用 `vscode-icons` 或自定义 SVG 映射

### 后端
- **框架**: Rust (Tauri 2)
- **新增命令**: `open_file_in_editor`（文件路径跳转）
- **权限**: 需要 `shell:allow-open` 权限

### 数据流
- **输入**: daemon 返回的 `ClaudeMessage[]`（包含 tool_use 和 tool_result 块）
- **输出**: 渲染后的 React 组件树
- **状态存储**: Zustand store 维护 `deniedToolIds` 集合

---

## Out of Scope

以下功能**不在本任务范围内**，留待后续任务：

1. **工具重试功能** → 独立任务（需 daemon API 支持）
2. **Diff 编辑器集成** → 06-16-web-diff-panel 任务
3. **子代理历史递归加载** → AgentGroupBlock 当前只显示占位符，完整实现需会话历史管理任务
4. **Mermaid 图表渲染** → 06-16-markdown 任务
5. **Thinking 内容显示** → 06-16-thinking 任务

---

## Notes

- 本任务是 **06-16-chat** 父任务的第一个子任务（最高优先级 ⭐⭐⭐⭐）
- 复用 jetbrains-cc-gui 的组件架构和样式，但简化实现（如暂不支持工具重试）
- 文件图标使用简化版本（20 种常见扩展名 → SVG 映射），不集成完整 vscode-icons 库
- CodeGraph 数据库路径：`C:\guodevelop\demo\jetbrains-cc-gui\.codegraph\db.sqlite`
- 详细实现步骤见 `design.md` 和 `implement.md`（待填充）
