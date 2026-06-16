# 工具调用可视化 - 技术设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      ChatPage (容器)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MessageList (消息列表)                    │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │        MessageItem (单条消息)                    │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │  ContentBlockRenderer (内容块渲染器)      │  │  │  │
│  │  │  │    ↓                                       │  │  │  │
│  │  │  │  • TextBlock → MarkdownBlock             │  │  │  │
│  │  │  │  • tool_use → ToolBlock 组件分发          │  │  │  │
│  │  │  │    - GenericToolBlock                     │  │  │  │
│  │  │  │    - BashToolBlock / BashToolGroupBlock   │  │  │  │
│  │  │  │    - EditToolBlock / EditToolGroupBlock   │  │  │  │
│  │  │  │    - ReadToolBlock / ReadToolGroupBlock   │  │  │  │
│  │  │  │    - SearchToolGroupBlock                 │  │  │  │
│  │  │  │    - AgentGroupBlock                      │  │  │  │
│  │  │  │    - TaskExecutionBlock                   │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构设计

```
src/
├── types/
│   ├── message.ts              # ClaudeMessage, ClaudeContentBlock 类型
│   └── tools.ts                # ToolInput, 工具分类常量
│
├── components/
│   ├── chat/
│   │   ├── MessageList.tsx     # 消息列表容器
│   │   └── MessageItem.tsx     # 单条消息 + 工具分组逻辑
│   │
│   └── toolBlocks/             # 🆕 新增目录
│       ├── index.ts            # 统一导出
│       ├── GenericToolBlock.tsx
│       ├── BashToolBlock.tsx
│       ├── BashToolGroupBlock.tsx
│       ├── EditToolBlock.tsx
│       ├── EditToolGroupBlock.tsx
│       ├── ReadToolBlock.tsx
│       ├── ReadToolGroupBlock.tsx
│       ├── SearchToolGroupBlock.tsx
│       ├── AgentGroupBlock.tsx
│       └── TaskExecutionBlock.tsx
│
├── utils/
│   ├── toolConstants.ts        # 🆕 工具分类、名称规范化
│   ├── toolPresentation.ts     # 🆕 文件路径解析、行号提取
│   ├── fileIcons.ts            # 🆕 文件图标映射
│   └── bridge.ts               # 🆕 Tauri 桥接（openFile）
│
├── hooks/
│   └── useIsToolDenied.ts      # 🆕 工具权限拒绝检测
│
└── styles/
    └── toolBlocks.css          # 🆕 工具块样式
```

---

## 数据流设计

### 1. 消息解析流程

```typescript
// 1. daemon 返回原始消息
const rawMessages: ClaudeMessage[] = [
  {
    role: 'assistant',
    content: [
      { type: 'text', text: 'I will read the file.' },
      { type: 'tool_use', id: 'toolu_123', name: 'Read', input: { file_path: 'src/App.tsx' } },
    ],
  },
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'toolu_123', content: 'file content...', is_error: false },
    ],
  },
];

// 2. MessageItem 处理消息
function MessageItem({ message, messages, messageIndex }) {
  // 查找工具结果
  const findToolResult = (toolId: string) => {
    // 在当前消息和后续消息中查找 tool_result
    for (let i = messageIndex; i < messages.length; i++) {
      const result = messages[i].content.find(
        block => block.type === 'tool_result' && block.tool_use_id === toolId
      );
      if (result) return result;
    }
    return null;
  };

  // 智能分组
  const groupedBlocks = groupToolBlocks(message.content);

  return (
    <div>
      {groupedBlocks.map(group => (
        group.type === 'single' ? (
          <ContentBlockRenderer block={group.block} findToolResult={findToolResult} />
        ) : (
          <ToolGroupBlock tools={group.tools} findToolResult={findToolResult} />
        )
      ))}
    </div>
  );
}
```

### 2. 工具分组算法

```typescript
type GroupedBlock =
  | { type: 'single'; block: ClaudeContentBlock }
  | { type: 'group'; toolType: string; blocks: ToolUseBlock[] };

function groupToolBlocks(blocks: ClaudeContentBlock[]): GroupedBlock[] {
  const result: GroupedBlock[] = [];
  let currentGroup: ToolUseBlock[] = [];
  let currentToolType: string | null = null;

  for (const block of blocks) {
    if (block.type !== 'tool_use') {
      // 提交当前组
      if (currentGroup.length >= 3) {
        result.push({ type: 'group', toolType: currentToolType!, blocks: currentGroup });
      } else {
        currentGroup.forEach(b => result.push({ type: 'single', block: b }));
      }
      currentGroup = [];
      currentToolType = null;

      // 添加非工具块
      result.push({ type: 'single', block });
      continue;
    }

    const toolName = normalizeToolName(block.name);
    const toolType = getToolType(toolName); // 'bash' | 'read' | 'edit' | 'search' | 'agent' | 'generic'

    if (currentToolType === toolType) {
      // 同类型工具，加入当前组
      currentGroup.push(block);
    } else {
      // 不同类型，提交当前组
      if (currentGroup.length >= 3) {
        result.push({ type: 'group', toolType: currentToolType!, blocks: currentGroup });
      } else {
        currentGroup.forEach(b => result.push({ type: 'single', block: b }));
      }
      // 开始新组
      currentGroup = [block];
      currentToolType = toolType;
    }
  }

  // 提交最后一组
  if (currentGroup.length >= 3) {
    result.push({ type: 'group', toolType: currentToolType!, blocks: currentGroup });
  } else {
    currentGroup.forEach(b => result.push({ type: 'single', block: b }));
  }

  return result;
}

function getToolType(normalizedName: string): string {
  if (BASH_TOOL_NAMES.has(normalizedName)) return 'bash';
  if (READ_TOOL_NAMES.has(normalizedName)) return 'read';
  if (EDIT_TOOL_NAMES.has(normalizedName)) return 'edit';
  if (SEARCH_TOOL_NAMES.has(normalizedName)) return 'search';
  if (AGENT_TOOL_NAMES.has(normalizedName)) return 'agent';
  return 'generic';
}
```

---

## 组件设计细节

### 1. GenericToolBlock

**状态管理**:
```typescript
const [expanded, setExpanded] = useState(false);
const isDenied = useIsToolDenied(toolId);

const isCompleted = (result !== undefined && result !== null) || isDenied;
const isError = isDenied || (isCompleted && result?.is_error === true);
const status = isError ? 'error' : isCompleted ? 'completed' : 'pending';
```

**渲染逻辑**:
```tsx
<div className="task-container">
  <div className="task-header" onClick={() => setExpanded(prev => !prev)}>
    <div className="task-title-section">
      <span className="codicon codicon-tools" />
      <span>{name || 'Tool'}</span>
    </div>
    <div className={`tool-status-indicator ${status}`} />
  </div>

  {expanded && (
    <div className="task-details">
      {/* 输入参数 */}
      <div className="tool-params">
        {Object.entries(input).map(([key, value]) => (
          <div key={key}>
            <span>{key}:</span> <span>{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>

      {/* 结果 */}
      {result && (
        <div className="tool-result">
          <pre>{extractResultText(result)}</pre>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="tool-actions">
        <button onClick={() => copyToolInput(input)}>Copy Input</button>
        {result && <button onClick={() => copyToolResult(result)}>Copy Output</button>}
      </div>
    </div>
  )}
</div>
```

---

### 2. BashToolBlock

**特殊逻辑**:
- 提取 `command` 字段显示在标题
- 解析 `result.content` 为 stdout/stderr
- 支持 exit code 显示

```typescript
function parseBashResult(result: ToolResultBlock) {
  const text = extractResultText(result);
  
  // 尝试解析 JSON 格式（如果 daemon 返回结构化数据）
  try {
    const parsed = JSON.parse(text);
    return {
      exitCode: parsed.exit_code ?? 0,
      stdout: parsed.stdout ?? '',
      stderr: parsed.stderr ?? '',
    };
  } catch {
    // 纯文本输出
    return {
      exitCode: result.is_error ? 1 : 0,
      stdout: text,
      stderr: '',
    };
  }
}
```

---

### 3. ReadToolBlock / EditToolBlock

**文件路径解析**:
```typescript
function resolveToolTarget(
  input: ToolInput,
  toolType: 'read' | 'edit'
): ToolTargetInfo | null {
  // 优先级：file_path > path > target_file
  const rawPath = input.file_path || input.path || input.target_file;
  if (!rawPath || typeof rawPath !== 'string') return null;

  // 判断是否是绝对路径
  const isAbsolute = /^[a-zA-Z]:\\/.test(rawPath) || rawPath.startsWith('/');

  // 提取文件名
  const cleanFileName = rawPath.split(/[/\\]/).pop() || rawPath;

  // 显示路径（如果是绝对路径，转为相对路径）
  const displayPath = isAbsolute
    ? rawPath.replace(/^.*[/\\](src|pages|components|utils)[/\\]/, '$1/')
    : rawPath;

  return {
    rawPath,
    cleanFileName,
    displayPath,
    openPath: isAbsolute ? rawPath : path.resolve(process.cwd(), rawPath),
    isFile: !cleanFileName.endsWith('/'),
    isDirectory: cleanFileName.endsWith('/'),
  };
}
```

**文件图标映射**:
```typescript
// src/utils/fileIcons.ts
const ICON_MAP: Record<string, string> = {
  // 编程语言
  ts: '<svg>...</svg>',   // TypeScript 图标
  tsx: '<svg>...</svg>',
  js: '<svg>...</svg>',
  jsx: '<svg>...</svg>',
  rs: '<svg>...</svg>',   // Rust
  py: '<svg>...</svg>',   // Python
  java: '<svg>...</svg>',
  
  // 配置文件
  json: '<svg>...</svg>',
  yaml: '<svg>...</svg>',
  toml: '<svg>...</svg>',
  
  // 文档
  md: '<svg>...</svg>',
  txt: '<svg>...</svg>',
  
  // 默认
  default: '<svg>...</svg>',
};

export function getFileIcon(extension: string, fileName: string): string {
  // 特殊文件名优先（如 package.json）
  if (fileName === 'package.json') return ICON_MAP.packageJson;
  if (fileName === 'Cargo.toml') return ICON_MAP.rust;
  
  return ICON_MAP[extension] || ICON_MAP.default;
}
```

---

### 4. GroupBlock 组件

**BashToolGroupBlock 设计**:
```tsx
function BashToolGroupBlock({ tools, findToolResult }) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const toggleAll = (expand: boolean) => {
    if (expand) {
      setExpandedIndices(new Set(tools.map((_, i) => i)));
    } else {
      setExpandedIndices(new Set());
    }
  };

  return (
    <div className="task-container">
      <div className="task-header">
        <span>$ Bash</span>
        <span>{tools.length} commands</span>
      </div>

      <div className="task-group-list">
        {tools.map((tool, index) => {
          const result = findToolResult(tool.id);
          const status = getToolStatus(result);
          const isExpanded = expandedIndices.has(index);

          return (
            <div key={tool.id} className="task-group-item">
              <div
                className="task-group-item-header"
                onClick={() => {
                  const newSet = new Set(expandedIndices);
                  if (isExpanded) {
                    newSet.delete(index);
                  } else {
                    newSet.add(index);
                  }
                  setExpandedIndices(newSet);
                }}
              >
                <span>{index + 1}. {tool.input.command}</span>
                <span className={`badge badge-${status}`}>{status}</span>
              </div>

              {isExpanded && (
                <div className="task-group-item-content">
                  <BashToolBlock {...tool} result={result} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="task-group-actions">
        <button onClick={() => toggleAll(true)}>Expand All</button>
        <button onClick={() => toggleAll(false)}>Collapse All</button>
      </div>
    </div>
  );
}
```

---

## 状态管理设计

### Zustand Store 扩展

```typescript
// src/stores/chatStore.ts
interface ChatState {
  // ... 现有状态
  
  // 🆕 工具权限状态
  deniedToolIds: Set<string>;
  addDeniedTool: (toolId: string) => void;
  clearDeniedTools: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // ... 现有实现
  
  deniedToolIds: new Set(),
  
  addDeniedTool: (toolId) =>
    set((state) => ({
      deniedToolIds: new Set(state.deniedToolIds).add(toolId),
    })),
  
  clearDeniedTools: () =>
    set({ deniedToolIds: new Set() }),
}));
```

### Hook 封装

```typescript
// src/hooks/useIsToolDenied.ts
export function useIsToolDenied(toolId?: string): boolean {
  const deniedToolIds = useChatStore((state) => state.deniedToolIds);
  return toolId ? deniedToolIds.has(toolId) : false;
}
```

---

## Tauri 命令设计

### 文件打开命令

```rust
// src-tauri/src/commands/editor.rs
use std::process::Command;

#[tauri::command]
pub async fn open_file_in_editor(
    file_path: String,
    line_start: Option<u32>,
    line_end: Option<u32>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // 优先使用 VS Code
        let line_arg = line_start
            .map(|l| format!(":{}:1", l))
            .unwrap_or_default();
        
        let cmd = format!("code --goto \"{}{}\"", file_path, line_arg);
        
        Command::new("cmd")
            .args(&["/C", &cmd])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        let line_arg = line_start
            .map(|l| format!(":{}", l))
            .unwrap_or_default();
        
        Command::new("open")
            .args(&["-a", "Visual Studio Code", &format!("{}{}", file_path, line_arg)])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        let line_arg = line_start
            .map(|l| format!(":{}:1", l))
            .unwrap_or_default();
        
        Command::new("code")
            .args(&["--goto", &format!("{}{}", file_path, line_arg)])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    Ok(())
}
```

**权限配置**:
```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "shell:allow-open",
    "core:default"
  ]
}
```

---

## 样式设计规范

### CSS 变量（DaisyUI 主题适配）

```css
/* src/styles/toolBlocks.css */
:root {
  /* 工具块颜色 */
  --tool-border: oklch(var(--b2));
  --tool-bg: oklch(var(--b1));
  --tool-hover: oklch(var(--b2));
  
  /* 状态颜色 */
  --status-pending: #fbbf24;  /* yellow-400 */
  --status-completed: #10b981; /* green-500 */
  --status-error: #ef4444;    /* red-500 */
  
  /* 链接颜色 */
  --link-color: oklch(var(--p));
  --link-hover: oklch(var(--pf));
}

[data-theme="dark"] {
  --tool-border: #374151;  /* gray-700 */
  --tool-bg: #1f2937;      /* gray-800 */
  --tool-hover: #374151;
}
```

### 响应式设计

```css
/* 移动端适配 */
@media (max-width: 768px) {
  .task-container {
    margin: 4px 0;
  }
  
  .task-header {
    padding: 8px 12px;
    font-size: 14px;
  }
  
  .task-details {
    padding: 8px;
  }
  
  .tool-title-summary {
    display: none; /* 隐藏次要信息 */
  }
}
```

---

## 性能优化策略

### 1. 虚拟化渲染（未来优化）
当工具调用超过 100 个时，使用 `react-window` 进行虚拟滚动（本任务暂不实现）。

### 2. 组件记忆化
```typescript
export const BashToolBlock = memo(function BashToolBlock(props: BashToolBlockProps) {
  // ...
}, (prevProps, nextProps) => {
  // 自定义比较逻辑
  return (
    prevProps.toolId === nextProps.toolId &&
    prevProps.result === nextProps.result
  );
});
```

### 3. 大结果截断
```typescript
function truncateToolResult(content: string, maxLength = 10000): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '\n\n... (truncated)';
}
```

---

## 测试策略

### 单元测试
```typescript
// src/components/toolBlocks/__tests__/GenericToolBlock.test.tsx
describe('GenericToolBlock', () => {
  it('renders tool name and input', () => {
    render(<GenericToolBlock name="Read" input={{ file_path: 'test.ts' }} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('shows pending status when result is undefined', () => {
    const { container } = render(<GenericToolBlock name="Read" input={{}} />);
    expect(container.querySelector('.pending')).toBeInTheDocument();
  });

  it('shows completed status when result exists', () => {
    const result = { type: 'tool_result', content: 'success', is_error: false };
    const { container } = render(<GenericToolBlock name="Read" input={} result={result} />);
    expect(container.querySelector('.completed')).toBeInTheDocument();
  });
});
```

### 集成测试
```typescript
// 测试工具分组逻辑
describe('groupToolBlocks', () => {
  it('groups 3+ consecutive same-type tools', () => {
    const blocks = [
      { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'pwd' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'cd' } },
    ];
    const grouped = groupToolBlocks(blocks);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].type).toBe('group');
  });
});
```

---

## 风险与缓解

### 风险 1: 消息格式不兼容
**缓解**: 
- 使用类型守卫验证消息结构
- 添加降级渲染：无法解析时显示原始 JSON

### 风险 2: 文件路径跨平台问题
**缓解**:
- 使用 Tauri 的 `path` API 规范化路径
- 前端不硬编码路径分隔符

### 风险 3: 大量工具调用卡顿
**缓解**:
- 默认折叠 GroupBlock
- 大结果自动截断
- 后续引入虚拟滚动

---

## 兼容性矩阵

| 特性 | Windows | macOS | Linux | 备注 |
|------|---------|-------|-------|------|
| 文件打开 | ✅ VS Code | ✅ VS Code | ✅ VS Code | 需安装 `code` CLI |
| 路径解析 | ✅ 反斜杠 | ✅ 斜杠 | ✅ 斜杠 | 使用 Tauri path API |
| 主题切换 | ✅ DaisyUI | ✅ DaisyUI | ✅ DaisyUI | CSS 变量 |

---

## 实施顺序建议

1. **Phase 1**: 基础组件（GenericToolBlock、状态指示器）
2. **Phase 2**: 专用组件（Bash、Read、Edit）
3. **Phase 3**: 分组逻辑（GroupBlock）
4. **Phase 4**: 高级组件（Search、Agent、Task）
5. **Phase 5**: 交互功能（文件打开、复制）
6. **Phase 6**: 样式优化、测试

详细实施清单见 `implement.md`。
