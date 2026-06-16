# 工具调用可视化 - 实施计划

## 总览

**预计工期**: 3-4 天  
**复杂度**: 高  
**依赖**: 无（可独立开发）

---

## 实施阶段

### Phase 1: 基础设施搭建 (0.5 天)

#### 1.1 创建类型定义
- [ ] `src/types/message.ts` - ClaudeMessage、ClaudeContentBlock
- [ ] `src/types/tools.ts` - ToolInput、工具分类常量
- [ ] 验证命令: `npm run typecheck`

**checklist**:
```typescript
// src/types/tools.ts
export const READ_TOOL_NAMES = new Set(['Read', 'read', 'ReadFile', 'read_file']);
export const EDIT_TOOL_NAMES = new Set(['Edit', 'edit', 'WriteFile', 'write_file', 'Write', 'write']);
export const BASH_TOOL_NAMES = new Set(['Bash', 'bash', 'ExecuteCommand', 'execute_command']);
export const SEARCH_TOOL_NAMES = new Set(['Grep', 'grep', 'Search', 'search', 'Glob', 'glob']);
export const AGENT_TOOL_NAMES = new Set(['Agent', 'agent', 'spawn_agent', 'task', 'Task']);

export function normalizeToolName(name?: string): string;
export function isToolName(name: string | undefined, toolNames: Set<string>): boolean;
```

#### 1.2 创建工具函数
- [ ] `src/utils/toolConstants.ts` - 工具名称规范化
- [ ] `src/utils/toolPresentation.ts` - 文件路径解析、行号提取
- [ ] `src/utils/fileIcons.ts` - 20 种文件图标 SVG
- [ ] 单元测试: `src/utils/__tests__/toolConstants.test.ts`

**验证**:
```bash
npm test -- toolConstants
```

#### 1.3 创建目录结构
- [ ] 创建 `src/components/toolBlocks/` 目录
- [ ] 创建 `src/hooks/` 目录（如不存在）
- [ ] 创建 `src/styles/toolBlocks.css`

---

### Phase 2: GenericToolBlock 实现 (0.5 天)

#### 2.1 组件骨架
- [ ] `src/components/toolBlocks/GenericToolBlock.tsx`
  - Props 接口定义
  - 状态管理（expanded, isDenied）
  - 状态计算（pending/completed/error）
  - 基础 UI 结构

**验证步骤**:
1. 创建测试页面 `src/pages/ToolBlockTest.tsx`
2. 渲染 GenericToolBlock 并传入 mock 数据
3. 验证折叠/展开交互
4. 验证状态指示器颜色

#### 2.2 样式实现
- [ ] `src/styles/toolBlocks.css` - 基础样式
  - `.task-container` 卡片容器
  - `.task-header` 标题栏
  - `.tool-status-indicator` 状态指示器
  - 呼吸动画 `@keyframes breathe`

**验证**:
```bash
npm run dev
# 访问 /tool-block-test，检查样式是否正确
```

#### 2.3 状态管理集成
- [ ] 扩展 `src/stores/chatStore.ts` 添加 `deniedToolIds`
- [ ] 创建 `src/hooks/useIsToolDenied.ts`
- [ ] 在 GenericToolBlock 中集成

---

### Phase 3: 专用组件实现 (1 天)

#### 3.1 BashToolBlock
- [ ] `src/components/toolBlocks/BashToolBlock.tsx`
  - 提取 `command` 字段
  - 解析 Bash 结果（exit code、stdout、stderr）
  - 代码块样式（mockup-code）
- [ ] 测试：创建 mock Bash 消息，验证渲染

#### 3.2 ReadToolBlock
- [ ] `src/components/toolBlocks/ReadToolBlock.tsx`
  - 文件路径解析（调用 `resolveToolTarget`）
  - 行号范围显示（L50-L100）
  - 文件图标集成（`getFileIcon`）
  - 文件路径点击（调用 `openFile`）
- [ ] 测试：验证文件路径点击跳转

**关键代码**:
```typescript
const target = resolveToolTarget(input, 'read');
const lineInfo = getToolLineInfo(input, target);

<span
  className="clickable-file"
  onClick={() => openFile(target.openPath, lineInfo.start, lineInfo.end)}
>
  {target.displayPath}
</span>
```

#### 3.3 EditToolBlock
- [ ] `src/components/toolBlocks/EditToolBlock.tsx`
  - 文件路径解析
  - Diff 预览（old_string vs new_string，简化版）
  - 文件路径点击
- [ ] 测试：验证 Diff 显示

**Diff 显示逻辑**:
```typescript
{input.old_string && input.new_string && (
  <div className="diff-preview">
    <div className="diff-line removed">- {input.old_string}</div>
    <div className="diff-line added">+ {input.new_string}</div>
  </div>
)}
```

---

### Phase 4: GroupBlock 实现 (1 天)

#### 4.1 分组算法
- [ ] `src/utils/toolGrouping.ts` - `groupToolBlocks` 函数
  - 遍历 content blocks
  - 识别连续同类型工具（≥3 个）
  - 返回 GroupedBlock[]

**测试**:
```typescript
// src/utils/__tests__/toolGrouping.test.ts
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
```

#### 4.2 BashToolGroupBlock
- [ ] `src/components/toolBlocks/BashToolGroupBlock.tsx`
  - 列表显示（命令 + 状态徽章）
  - 展开/折叠单个命令
  - Expand All / Collapse All 按钮
- [ ] 测试：渲染 3 个 Bash 工具，验证分组

#### 4.3 ReadToolGroupBlock
- [ ] `src/components/toolBlocks/ReadToolGroupBlock.tsx`
  - 文件列表显示
  - 合并相同文件的多次读取
- [ ] 测试：渲染 3 个 Read 工具

#### 4.4 EditToolGroupBlock
- [ ] `src/components/toolBlocks/EditToolGroupBlock.tsx`
  - 文件列表 + 变更数量
  - 展开/折叠
- [ ] 测试：渲染 3 个 Edit 工具

---

### Phase 5: 高级组件实现 (0.5 天)

#### 5.1 SearchToolGroupBlock
- [ ] `src/components/toolBlocks/SearchToolGroupBlock.tsx`
  - 聚合搜索结果
  - 显示匹配文件列表
- [ ] 测试：渲染 Grep 工具结果

#### 5.2 AgentGroupBlock
- [ ] `src/components/toolBlocks/AgentGroupBlock.tsx`
  - 显示 Agent 名称、模型、描述
  - 占位符："Subagent History (click to load)"
  - **注意**: 完整实现需会话历史任务，本任务仅占位
- [ ] 测试：渲染 Agent 工具

#### 5.3 TaskExecutionBlock
- [ ] `src/components/toolBlocks/TaskExecutionBlock.tsx`
  - 显示 Task 元数据（agent_id、model、reasoning_effort）
  - 显示性能指标（duration、tokens、tool count）
  - 解析 spawn_agent 结果
- [ ] 测试：渲染 Task 工具

---

### Phase 6: 集成与交互 (0.5 天)

#### 6.1 MessageItem 集成
- [ ] 修改 `src/components/chat/MessageItem.tsx`
  - 调用 `groupToolBlocks` 对消息块分组
  - 根据 group type 渲染对应组件
  - 实现 `findToolResult` 查找逻辑

**关键代码**:
```typescript
const findToolResult = useCallback((toolId: string) => {
  // 在当前消息和后续消息中查找
  for (let i = messageIndex; i < messages.length; i++) {
    const result = messages[i].content.find(
      block => block.type === 'tool_result' && block.tool_use_id === toolId
    );
    if (result) return result;
  }
  return null;
}, [messages, messageIndex]);

const groupedBlocks = useMemo(() => {
  return groupToolBlocks(message.content);
}, [message.content]);
```

#### 6.2 ContentBlockRenderer 更新
- [ ] 修改 `src/components/chat/ContentBlockRenderer.tsx`（如存在）
  - 添加 tool_use 分发逻辑
  - 根据工具名称选择组件

**分发逻辑**:
```typescript
if (block.type === 'tool_use') {
  const toolName = normalizeToolName(block.name);
  
  if (AGENT_TOOL_NAMES.has(toolName)) {
    return <TaskExecutionBlock ... />;
  }
  if (EDIT_TOOL_NAMES.has(toolName)) {
    return <EditToolBlock ... />;
  }
  if (BASH_TOOL_NAMES.has(toolName)) {
    return <BashToolBlock ... />;
  }
  if (READ_TOOL_NAMES.has(toolName)) {
    return <ReadToolBlock ... />;
  }
  if (SEARCH_TOOL_NAMES.has(toolName)) {
    return <SearchToolGroupBlock ... />;
  }
  
  return <GenericToolBlock ... />;
}
```

#### 6.3 Tauri 命令实现
- [ ] `src-tauri/src/commands/editor.rs` - `open_file_in_editor`
  - Windows: `code --goto <path>:<line>:1`
  - macOS: `open -a "Visual Studio Code" <path>:<line>`
  - Linux: `code --goto <path>:<line>:1`
- [ ] 更新 `src-tauri/capabilities/default.json` 添加 `shell:allow-open`
- [ ] 在 `src-tauri/src/lib.rs` 注册命令

**注册命令**:
```rust
// src-tauri/src/lib.rs
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::editor::open_file_in_editor,
            // ... 其他命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 6.4 前端桥接
- [ ] `src/utils/bridge.ts` - `openFile` 函数
  - 调用 Tauri invoke
  - 错误处理

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function openFile(
  filePath: string,
  lineStart?: number,
  lineEnd?: number
) {
  try {
    await invoke('open_file_in_editor', {
      filePath,
      lineStart,
      lineEnd,
    });
  } catch (error) {
    console.error('Failed to open file:', error);
    alert(`无法打开文件: ${error}`);
  }
}
```

#### 6.5 复制功能
- [ ] `src/utils/clipboard.ts` - `copyToClipboard` 函数（如不存在）
- [ ] 在工具块中添加复制按钮
  - Copy Input（复制工具参数）
  - Copy Output（复制工具结果）

```typescript
async function copyToolInput(input: ToolInput) {
  const text = JSON.stringify(input, null, 2);
  await copyToClipboard(text);
}

async function copyToolResult(result: ToolResultBlock) {
  const text = typeof result.content === 'string'
    ? result.content
    : JSON.stringify(result.content, null, 2);
  await copyToClipboard(text);
}
```

---

### Phase 7: 样式优化 (0.5 天)

#### 7.1 DaisyUI 主题适配
- [ ] 使用 DaisyUI 颜色变量（`oklch(var(--b1))`）
- [ ] 深色/浅色主题测试
- [ ] 响应式布局测试（移动端）

#### 7.2 动画优化
- [ ] pending 状态呼吸动画流畅度
- [ ] 折叠/展开过渡动画
- [ ] hover 效果

#### 7.3 文件图标美化
- [ ] 20 种常见扩展名的 SVG 图标
- [ ] 图标颜色与主题协调
- [ ] 特殊文件名识别（package.json、Cargo.toml）

---

### Phase 8: 测试与优化 (0.5 天)

#### 8.1 单元测试
- [ ] `GenericToolBlock.test.tsx` - 状态、折叠、复制
- [ ] `BashToolBlock.test.tsx` - 命令解析、结果显示
- [ ] `ReadToolBlock.test.tsx` - 文件路径解析
- [ ] `toolGrouping.test.ts` - 分组算法

**运行测试**:
```bash
npm test -- --coverage
```

#### 8.2 集成测试
- [ ] 渲染包含 10+ 个工具调用的消息
- [ ] 验证分组逻辑
- [ ] 验证文件打开功能
- [ ] 验证复制功能

#### 8.3 性能测试
- [ ] 渲染 100 个工具调用，测量时间 < 500ms
- [ ] 折叠/展开帧率 ≥ 60 FPS
- [ ] 大结果（10000+ 字符）截断测试

#### 8.4 兼容性测试
- [ ] 加载 jetbrains-cc-gui 的历史会话文件
- [ ] 验证消息格式兼容性
- [ ] 跨平台测试（Windows/macOS/Linux）

---

## 验证清单

### 功能验证
- [ ] **工具识别**: Bash、Read、Edit、Search、Agent、Task 正确识别
- [ ] **状态显示**: pending（黄色呼吸）、completed（绿色）、error（红色）
- [ ] **分组**: 3+ 个连续同类工具自动合并
- [ ] **折叠/展开**: 点击 header 切换状态
- [ ] **文件打开**: 点击文件路径在编辑器中打开
- [ ] **复制**: Copy Input / Copy Output 按钮功能正常

### 样式验证
- [ ] **主题切换**: 深色/浅色模式正常
- [ ] **响应式**: 移动端布局友好
- [ ] **动画**: pending 呼吸动画流畅
- [ ] **图标**: 文件图标显示正确

### 性能验证
- [ ] **渲染速度**: 100 个工具调用 < 500ms
- [ ] **内存**: 大量工具调用不泄漏
- [ ] **帧率**: 交互帧率 ≥ 60 FPS

---

## 回滚点

每个 Phase 完成后 commit 一次，便于回滚：

```bash
# Phase 1 完成
git add .
git commit -m "feat(toolblocks): add basic types and utils"

# Phase 2 完成
git add .
git commit -m "feat(toolblocks): implement GenericToolBlock"

# Phase 3 完成
git add .
git commit -m "feat(toolblocks): add Bash/Read/Edit blocks"

# ... 依此类推
```

---

## 常见问题处理

### 问题 1: 工具结果未找到
**症状**: tool_use 有 ID，但 findToolResult 返回 null  
**原因**: tool_result 在后续消息中，需要跨消息查找  
**解决**: 扩大查找范围到 `messages.slice(messageIndex)`

### 问题 2: 文件路径跨平台不兼容
**症状**: Windows 路径在 macOS 无法打开  
**解决**: 使用 Tauri `path` API 规范化路径

### 问题 3: 分组算法错误
**症状**: 2 个工具被分组，或 4 个工具未分组  
**解决**: 检查 `normalizeToolName` 是否正确，工具类型判断是否遗漏

### 问题 4: 样式冲突
**症状**: DaisyUI 样式覆盖自定义样式  
**解决**: 增加选择器权重，或使用 `!important`（慎用）

---

## 完成标准

所有 Acceptance Criteria 勾选完毕：

### 功能完整性 ✅
- [x] 7 种工具块组件全部实现
- [x] 智能分组：3+ 个连续同类工具自动合并
- [x] 状态指示：pending / completed / error
- [x] 工具结果匹配：根据 tool_use_id 关联

### 交互功能 ✅
- [x] 折叠/展开：点击 header 切换
- [x] 文件路径点击：跳转到编辑器
- [x] 参数复制：Copy Input
- [x] 结果复制：Copy Output

### 样式一致性 ✅
- [x] DaisyUI 主题变量
- [x] pending 呼吸动画
- [x] 文件图标显示
- [x] 响应式布局

### 性能要求 ✅
- [x] 100 个工具调用 < 500ms
- [x] 折叠/展开 60 FPS
- [x] 大结果自动截断

### 兼容性 ✅
- [x] 解析历史会话文件无错误
- [x] 兼容 jetbrains-cc-gui 格式
- [x] 支持流式渲染

---

## 后续任务

本任务完成后，可以继续：

1. **06-16-markdown** - Markdown 渲染（代码高亮、Mermaid）
2. **06-16-thinking** - Thinking 内容显示
3. **06-16-web-diff-panel** - 完整 Diff 编辑器集成
4. **06-16-session-history-management** - 会话历史管理（AgentGroupBlock 完整实现）

---

## 提交前检查

- [ ] 所有测试通过 (`npm test`)
- [ ] 类型检查通过 (`npm run typecheck`)
- [ ] Lint 检查通过 (`npm run lint`)
- [ ] 构建成功 (`npm run build`)
- [ ] 本地运行正常 (`npm run tauri dev`)
- [ ] Git commit message 符合规范
- [ ] 更新 CLAUDE.md（如有新约定）
- [ ] 运行 `task.py finish` 完成任务
