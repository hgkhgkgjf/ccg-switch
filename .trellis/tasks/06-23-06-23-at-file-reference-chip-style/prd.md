# Chat @文件引用样式化（chip标签）

## Goal

用户在聊天输入框中通过 `@` 选择文件后，选中的文件引用从纯文本变为带图标、文件名、删除按钮的 styled chip/tag，仿照 cc-gui 的视觉效果。

## User Value

用户选中多个文件引用后，能一眼区分哪些是文件引用、哪些是普通文本，且能通过点击删除按钮快速移除某个引用，而不是手动去文本里删除 `@src/foo.ts` 这样的纯文本。

## Current State

- 输入框使用 `<textarea>`（`ChatComposer.tsx` 第 670-689 行）
- `@` 触发的文件补全已实现（`useCompletions.ts`），能弹出下拉菜单、选择文件
- 选择后 `@src/foo.ts ` 作为纯文本插入 textarea，**没有任何视觉样式**
- textarea 不支持内嵌 styled HTML 元素，这是纯文本的根本原因

## cc-gui 参考实现（研究结论）

cc-gui 使用 `contenteditable` div 而非 textarea，核心机制：

### 架构
- **输入区域**: `contenteditable` div，允许内嵌 `contenteditable="false"` 的原子化 span
- **触发检测**: `useTriggerDetection` 从光标位置反向扫描 `@` 字符
- **补全下拉**: `useCompletionDropdown` 通用状态机（open/close/search/keyboard/select）
- **文件标签渲染**: `useFileTags` hook 将 `@filepath` 文本转换为 styled `<span class="file-tag">`
- **文本提取**: `useTextContent` 将 file-tag 元素逆向转回 `@filepath` 纯文本（用于发送）

### File Tag HTML 结构
```html
<span class="file-tag" contenteditable="false"
      data-file-path="src/foo.ts"
      data-tooltip="/full/path/to/src/foo.ts">
  <span class="file-tag-icon">{SVG_ICON}</span>
  <span class="file-tag-text">foo.ts</span>
  <span class="file-tag-close">&times;</span>
</span>
```

### CSS 样式
```css
.file-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  margin: 0 2px;
  background: var(--dropdown-bg);
  border: 1px solid var(--input-border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: default;
  user-select: none;
  vertical-align: middle;
}
.file-tag-text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-tag-close {
  display: inline-flex;
  width: 14px; height: 14px;
  margin-left: 2px;
  border-radius: 2px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s;
}
.file-tag-close:hover { opacity: 1; background: rgba(255,255,255,0.1); }
```

## Requirements

### R1: textarea → contenteditable 替换
- 将 `ChatComposer.tsx` 中的 `<textarea>` 替换为 `<div contenteditable="true">`
- 保持现有的自动高度调整、IME 输入、拖拽调整大小等功能
- 保持 `draft` / `setDraft` 状态管理兼容（contenteditable 的 `innerText` 对应 draft）

### R2: File Tag 渲染
- 当用户从 CompletionMenu 选择文件后，将 `@filepath` 文本渲染为 styled chip
- Chip 结构参考 cc-gui：文件图标 + 文件名（截断）+ 删除按钮
- Chip 设为 `contenteditable="false"`，作为原子单元存在于可编辑区域中
- 使用 DaisyUI 变量适配亮/暗主题

### R3: File Tag 删除
- 点击 chip 上的删除按钮（×），移除该 chip 元素
- 删除后自动聚焦回 contenteditable，光标定位到合理位置

### R4: 文本提取与发送
- 从 contenteditable 提取纯文本时，将 file-tag 元素转回 `@filepath` 格式
- 确保发送给后端的消息文本格式与当前 textarea 方案一致

### R5: 下拉菜单兼容
- CompletionMenu 下拉菜单继续正常工作（位置、键盘导航、选择）
- 触发检测逻辑适配 contenteditable（光标位置获取方式不同）

### R6: 样式适配
- Chip 样式适配 DaisyUI 主题变量（`bg-base-200`, `border-base-300` 等）
- 亮色/暗色主题下均正常显示
- 文件图标使用 lucide-react 的 `File` / `Folder` 图标

## Acceptance Criteria

- [ ] 输入框中通过@选择文件后，文件引用显示为带图标的 chip 标签
- [ ] Chip 标签有文件图标、文件名、删除按钮三部分
- [ ] 文件名过长时截断显示省略号
- [ ] 点击删除按钮可移除 chip，输入框自动聚焦
- [ ] 删除 chip 后，剩余文本和 chip 保持正确顺序
- [ ] 发送消息时，chip 被正确转回 `@filepath` 纯文本
- [ ] 亮色/暗色主题下 chip 样式正确
- [ ] CompletionMenu 下拉菜单在 contenteditable 下正常工作
- [ ] IME 输入（中文等）不受影响
- [ ] 自动高度调整、拖拽调整大小功能正常
- [ ] `npm run build` 通过

## Out of Scope

- 其他触发字符（`#`, `!`, `/`）的样式化（本次只处理 `@` 文件引用）
- 文件内容预览
- 多行 chip 布局优化（本次保持 inline 布局）
- 虚拟列表优化（文件列表较短时不需要）

## Implementation Notes

### 关键技术决策
1. **contenteditable 而非 textarea**：textarea 无法内嵌 styled HTML，这是唯一正确的方案
2. **保持 CompletionMenu 适配**：需要将下拉菜单的定位逻辑从 textarea 适配到 contenteditable（光标位置 API 不同）
3. **IME 兼容**：contenteditable 的 `compositionstart`/`compositionend` 事件处理方式与 textarea 类似但需验证
4. **光标位置管理**：需要使用 `Selection` / `Range` API 替代 `textarea.selectionStart`

### 参考文件
- cc-gui 核心: `C:\guodevelop\demo\jetbrains-cc-gui\webview\src\components\ChatInputBox\`
- 当前 composer: `src/components/chat/composer/ChatComposer.tsx`
- 补全逻辑: `src/components/chat/composer/useCompletions.ts`
- 补全菜单: `src/components/chat/composer/CompletionMenu.tsx`
