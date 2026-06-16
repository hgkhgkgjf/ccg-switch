# 工具调用可视化 - 实施计划

## 实施顺序

按依赖关系分 4 个阶段，每个阶段完成后都可独立测试。

---

## 阶段 1: 类型定义和数据模型 (1-2 小时)

**目标**: 扩展类型定义，为后续开发提供类型安全

### 1.1 扩展 ChatMessage 类型

**文件**: `src/types/chat.ts`

**任务**:
- [ ] 在 ChatMessage 接口中新增 `raw?: MessageRaw` 字段
- [ ] 新增 MessageRaw 接口定义
- [ ] 新增 ContentBlock 联合类型
- [ ] 新增 TextBlock, ToolUseBlock, ToolResultBlock 接口

**验证命令**:
```bash
npm run type-check
```

**预期**: 无 TypeScript 错误

### 1.2 新增工具块类型定义

**文件**: `src/types/toolblock.ts` (新建)

**任务**:
- [ ] 定义 GenericToolBlockProps 接口
- [ ] 定义 ToolStatus 类型
- [ ] 导出所有类型

**验证命令**:
```bash
npm run type-check
```

### 1.3 Rust 事件类型定义

**文件**: `src-tauri/src/models/chat.rs`

**任务**:
- [ ] 新增 ChatMessageEvent 结构体
- [ ] 实现 Serialize, Deserialize
- [ ] 在 models/mod.rs 中导出

**验证命令**:
```bash
cd src-tauri && cargo check
```

---

## 阶段 2: Rust 层实现 (2-3 小时)

**目标**: 修改 daemon_client，新增 chat://message 事件

### 2.1 修改 daemon_client 的 stdout 解析

**文件**: `src-tauri/src/services/daemon_client.rs`

**任务**:
- [ ] 找到 handle_stdout 函数（或类似逻辑）
- [ ] 新增 `extract_tag()` 辅助函数（检测 `[MESSAGE]` 等标签）
- [ ] 在 stdout 解析中新增分支：
  ```rust
  if line.starts_with("[MESSAGE]") {
      let json = line.trim_start_matches("[MESSAGE]").trim();
      app.emit("chat://message", ChatMessageEvent {
          json: json.to_string(),
      })?;
  }
  ```
- [ ] 保持 `[CONTENT_DELTA]` 等其他标签的现有逻辑

**注意事项**:
- 如果 JSON 可能跨多行（不太可能），需累积逻辑
- 空 JSON 检查：`json.is_empty()` 时跳过

**验证命令**:
```bash
cd src-tauri && cargo build
npm run tauri dev
# 在浏览器控制台监听事件（临时测试代码）
```

**手动测试**:
1. 启动应用
2. 打开浏览器 DevTools Console
3. 运行：
   ```javascript
   window.__TAURI__.event.listen('chat://message', (event) => {
       console.log('[TEST] Received chat://message:', event.payload);
   });
   ```
4. 发送对话，观察是否收到 MESSAGE 事件

### 2.2 新增 Rust 日志

**文件**: `src-tauri/src/services/daemon_client.rs`

**任务**:
- [ ] 添加 debug 日志：`log::debug!("[daemon_client] Detected MESSAGE tag, json_len={}", json.len());`

---

## 阶段 3: 前端状态管理 (2-3 小时)

**目标**: useChatStore 监听 chat://message，更新 message.raw

### 3.1 新增 chat://message 监听器

**文件**: `src/stores/useChatStore.ts`

**任务**:
- [ ] 在 init() 函数中添加监听器：
  ```typescript
  const unlistenMessage = await listen<{ json: string }>('chat://message', (event) => {
      try {
          const raw = JSON.parse(event.payload.json) as MessageRaw;
          handleMessageUpdate(raw);
      } catch (e) {
          console.error('[useChatStore] Failed to parse MESSAGE:', e);
      }
  });
  ```
- [ ] 保存 unlistenMessage 用于清理（在 init 返回的 cleanup 函数中调用）

### 3.2 实现 handleMessageUpdate

**文件**: `src/stores/useChatStore.ts`

**任务**:
- [ ] 新增 handleMessageUpdate 方法（非导出，内部使用）
- [ ] 逻辑：
  ```typescript
  const handleMessageUpdate = (raw: MessageRaw) => {
      setMessages((prev) => {
          // 查找最后一条相同角色的消息
          const lastIndex = prev.findLastIndex(m => m.role === raw.type);
          if (lastIndex === -1) {
              console.warn('[useChatStore] MESSAGE without existing message');
              return prev;
          }
          
          const updated = [...prev];
          updated[lastIndex] = {
              ...updated[lastIndex],
              raw,
          };
          return updated;
      });
  };
  ```

**验证命令**:
```bash
npm run tauri dev
```

**手动测试**:
1. 发送对话 "Read src/main.rs"
2. 打开 React DevTools，查看 useChatStore 的 messages 数组
3. 验证最后一条 assistant 消息有 `raw` 字段
4. 验证 `raw.message.content` 是数组
5. 验证数组包含 tool_use 块

---

## 阶段 4: UI 组件实现 (4-5 小时)

**目标**: 渲染工具块，完成可视化

### 4.1 实现 StatusIndicator 组件

**文件**: `src/components/chat/StatusIndicator.tsx` (新建)

**任务**:
- [ ] 创建函数组件
- [ ] Props: `{ status: ToolStatus }`
- [ ] 渲染小圆点：
  ```tsx
  <div className={`
    w-2 h-2 rounded-full
    ${status === 'pending' ? 'bg-warning animate-pulse' : ''}
    ${status === 'completed' ? 'bg-success' : ''}
    ${status === 'error' ? 'bg-error' : ''}
  `} />
  ```

**验证**: Storybook 或独立测试页面

### 4.2 实现 GenericToolBlock 组件

**文件**: `src/components/chat/GenericToolBlock.tsx` (新建)

**任务**:
- [ ] 创建函数组件，Props: GenericToolBlockProps
- [ ] 状态：`const [expanded, setExpanded] = useState(false);`
- [ ] 工具名称映射函数：`getToolDisplayName(name)`
  - 参考 jcc-gui 的 toolKeyMap
  - Read → "读取文件", Edit → "编辑文件", Bash → "运行命令" ...
- [ ] 图标映射函数：`getToolIcon(name)` (lucide-react)
  - read → Eye, edit → Edit, bash → Terminal ...
- [ ] 参数摘要提取：`getToolSummary(name, input)`
  - 优先提取 file_path / path → 显示文件名
  - 其次提取 command / cmd → 截断显示
  - 最后提取 search_term / pattern
- [ ] 参数过滤：`getOtherParams(input)`
  - 排除：file_path, path, command, cmd, description, workdir
- [ ] 状态计算：`getToolStatus(result)`
- [ ] UI 结构（参考 design.md）

**关键代码片段**:
```tsx
const status = getToolStatus(result);
const summary = getToolSummary(name, input);
const otherParams = getOtherParams(input);
const hasExpandableContent = Object.keys(otherParams).length > 0;

return (
  <div className="border border-base-300 rounded-lg p-3 my-2">
    <div 
      className="flex items-center justify-between cursor-pointer"
      onClick={() => hasExpandableContent && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {getToolIcon(name)}
        <span className="font-medium">{getToolDisplayName(name)}</span>
        {summary && <span className="text-sm text-base-content/60">{summary}</span>}
      </div>
      <div className="flex items-center gap-2">
        <StatusIndicator status={status} />
        {hasExpandableContent && <ChevronDown className={expanded ? 'rotate-180' : ''} />}
      </div>
    </div>
    {expanded && hasExpandableContent && (
      <div className="mt-2 pt-2 border-t border-base-300 space-y-1">
        {Object.entries(otherParams).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-sm">
            <span className="text-base-content/60">{key}:</span>
            <span className="font-mono">{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
```

**验证**: 创建测试页面，传入 mock 数据

### 4.3 实现 ContentBlockRenderer 组件

**文件**: `src/components/chat/ContentBlockRenderer.tsx` (新建)

**任务**:
- [ ] 创建函数组件，Props: `{ blocks: ContentBlock[], messageId: string }`
- [ ] 遍历 blocks，根据 type 渲染：
  ```tsx
  export default function ContentBlockRenderer({ blocks, messageId }: Props) {
      // 构建 tool_use_id → tool_result 的映射
      const resultMap = useMemo(() => {
          const map = new Map<string, ToolResultBlock>();
          blocks.forEach(block => {
              if (block.type === 'tool_result') {
                  map.set(block.tool_use_id, block);
              }
          });
          return map;
      }, [blocks]);
      
      return (
          <>
              {blocks.map((block, index) => {
                  switch (block.type) {
                      case 'text':
                          return <div key={index} className="whitespace-pre-wrap">{block.text}</div>;
                      case 'tool_use':
                          const result = resultMap.get(block.id);
                          return (
                              <GenericToolBlock
                                  key={block.id}
                                  name={block.name}
                                  input={block.input}
                                  result={result}
                                  toolId={block.id}
                              />
                          );
                      case 'tool_result':
                          // 已在 tool_use 中显示，跳过
                          return null;
                      default:
                          console.warn('[ContentBlockRenderer] Unknown block type:', (block as any).type);
                          return <div key={index} className="text-warning">Unknown block</div>;
                  }
              })}
          </>
      );
  }
  ```

**验证**: 单元测试或集成测试

### 4.4 修改 MessageBubble 组件

**文件**: `src/pages/ChatPage.tsx`

**任务**:
- [ ] 导入 ContentBlockRenderer
- [ ] 修改渲染逻辑：
  ```tsx
  function MessageBubble({ message }: { message: ChatMessage }) {
      const isUser = message.role === 'user';
      const hasBlocks = message.raw?.message?.content && message.raw.message.content.length > 0;
      
      return (
          <div className={`chat ${isUser ? 'chat-end' : 'chat-start'}`}>
              <div className={`chat-bubble whitespace-pre-wrap break-words ...`}>
                  {hasBlocks ? (
                      <ContentBlockRenderer 
                          blocks={message.raw.message.content} 
                          messageId={message.id}
                      />
                  ) : (
                      message.content || (message.streaming ? (
                          <Loader2 size={16} className="animate-spin" />
                      ) : null)
                  )}
                  {message.error && (
                      <div className="text-xs opacity-70 mt-1">{message.error}</div>
                  )}
              </div>
          </div>
      );
  }
  ```

**验证命令**:
```bash
npm run tauri dev
```

---

## 阶段 5: 集成测试和优化 (2-3 小时)

### 5.1 端到端测试

**测试场景 1: 单个工具调用**
1. 启动应用
2. 发送 "Read src/main.rs"
3. **预期**:
   - 显示 GenericToolBlock
   - 工具名称: "读取文件"
   - 摘要: "main.rs"
   - 状态: pending → completed
   - 展开后显示其他参数（如有）

**测试场景 2: 多个工具调用**
1. 发送 "Read src/main.rs and explain"
2. **预期**:
   - 显示多个 GenericToolBlock（Read + 可能的其他工具）
   - 每个工具状态独立

**测试场景 3: 工具调用失败**
1. 发送 "Read non-existent-file.txt"
2. **预期**:
   - 工具块显示 error 状态（红色圆点）
   - is_error: true 的结果正确处理

**测试场景 4: 纯文本对话**
1. 发送 "Hello"
2. **预期**:
   - 显示纯文本回复
   - 无工具块
   - content 正常显示

### 5.2 边界情况测试

**测试 1: tool_result 不匹配**
- Mock 数据: tool_use.id = "A", tool_result.tool_use_id = "B"
- **预期**: tool_use 显示 pending 状态（找不到 result）

**测试 2: 空 content 数组**
- Mock 数据: `raw.message.content = []`
- **预期**: 不渲染任何块，fallback 到 content 纯文本

**测试 3: 未知 block 类型**
- Mock 数据: `{ type: 'image', ... }`
- **预期**: 显示 "Unknown block" 警告

### 5.3 性能测试

**测试 1: 10 个工具调用**
- 发送复杂任务，触发多个工具
- **预期**: 渲染流畅，无卡顿

**测试 2: 快速折叠/展开**
- 连续点击展开按钮
- **预期**: 动画流畅，无延迟

### 5.4 样式优化

**任务**:
- [ ] 调整 GenericToolBlock 的边框颜色（与 DaisyUI 主题一致）
- [ ] 调整参数显示的字体和间距
- [ ] 确保深色模式下可读
- [ ] 添加 hover 效果（工具块 header）

**验证**: 切换主题，检查视觉效果

### 5.5 国际化

**文件**: `src/locales/zh.json`, `src/locales/en.json`

**任务**:
- [ ] 添加工具名称翻译：
  ```json
  {
    "tools": {
      "readFile": "读取文件",
      "editFile": "编辑文件",
      "runCommand": "运行命令",
      "search": "搜索",
      "fileMatch": "文件匹配",
      "unknown": "未知工具"
    }
  }
  ```
- [ ] 在 getToolDisplayName 中使用 `t('tools.readFile')` 代替硬编码

---

## 回滚检查点

每个阶段完成后创建 git commit，便于回滚：

```bash
# 阶段 1 完成
git add src/types/
git commit -m "feat(toolblock): 新增类型定义"

# 阶段 2 完成
git add src-tauri/
git commit -m "feat(toolblock): Rust 层实现 chat://message 事件"

# 阶段 3 完成
git add src/stores/
git commit -m "feat(toolblock): useChatStore 监听并解析 MESSAGE"

# 阶段 4 完成
git add src/components/ src/pages/
git commit -m "feat(toolblock): UI 组件实现工具块可视化"

# 阶段 5 完成
git add .
git commit -m "feat(toolblock): 集成测试和样式优化"
```

---

## 验收清单

参考 prd.md 的 Acceptance Criteria：

### 基础功能
- [ ] ChatMessage 类型扩展为支持 raw 字段
- [ ] useChatStore 正确解析 daemon 的 MESSAGE 事件为 raw
- [ ] GenericToolBlock 组件渲染工具名称、摘要、状态
- [ ] 折叠/展开交互正常
- [ ] 状态指示器正确显示 pending/completed/error
- [ ] 端到端测试：发送 "Read src/main.rs"，工具块正确显示

### 数据完整性
- [ ] 所有工具类型都能正确解析（Read, Edit, Bash, Grep, Glob...）
- [ ] 工具参数正确提取和格式化
- [ ] 流式更新不丢失数据（content 和 raw 互不干扰）

### UI/UX
- [ ] 工具块视觉风格与 DaisyUI 主题一致
- [ ] 折叠/展开动画流畅
- [ ] 长参数自动截断（hover 显示完整内容，可选）
- [ ] 错误状态明确显示（红色圆点）

---

## 预估时间

| 阶段 | 任务 | 预估时间 |
|------|------|----------|
| 1 | 类型定义 | 1-2 小时 |
| 2 | Rust 层实现 | 2-3 小时 |
| 3 | 前端状态管理 | 2-3 小时 |
| 4 | UI 组件实现 | 4-5 小时 |
| 5 | 集成测试和优化 | 2-3 小时 |
| **总计** | | **11-16 小时** |

建议分 2-3 个工作日完成，每天完成 1-2 个阶段。

---

## 常见问题排查

### 问题 1: 收不到 chat://message 事件

**排查**:
1. 检查 Rust 是否正确发送事件（添加 debug 日志）
2. 检查前端是否正确注册监听器（在 init 中）
3. 检查 daemon 是否输出了 `[MESSAGE]` 标签（查看 Rust 日志）

**解决**: 在浏览器 Console 手动监听事件测试

### 问题 2: tool_use 显示但没有 result

**排查**:
1. 检查 raw.message.content 数组是否包含 tool_result 块
2. 检查 tool_result.tool_use_id 是否匹配 tool_use.id
3. 检查 ContentBlockRenderer 的 resultMap 是否正确构建

**解决**: 在 Console 打印 `message.raw.message.content`

### 问题 3: 工具名称显示为原始值（如 "Read" 而非 "读取文件"）

**排查**:
1. 检查 getToolDisplayName 函数是否正确映射
2. 检查工具名称是否为小写（需 toLowerCase）

**解决**: 添加更多映射规则

### 问题 4: 参数显示过长

**排查**:
1. 检查 getToolSummary 是否截断长字符串
2. 检查 CSS 是否应用了 truncate

**解决**: 使用 `truncate` 辅助函数，限制 50 字符

---

## 下一步

完成本任务后，可以并行开发：
- **06-16-markdown**: Markdown 渲染（替换 text 块的纯文本显示）
- **06-16-thinking**: Thinking 内容显示（新增 thinking 块支持）
- **06-16-permission-approval-enhancement**: 权限审批完整化

或按优先级顺序开发（Markdown → Thinking → 权限审批）。
