# 技术设计：补全下拉框 UI 对标与上下文窗口修正

## 范围与边界

两条独立改动线，可分别实现、分别验证：

- **A. 补全下拉框 UI**（纯前端）：`CompletionMenu.tsx` + `useCompletions.ts` 的 item 数据结构。
- **B. 上下文窗口**（前后端）：sidecar `usage-utils.js` 发出 `max_tokens` → 前端 store 接收 → `TokenIndicator` 消费。

## A. 补全下拉框 UI

### 数据结构调整（`useCompletions.ts`）

扩展 `CompletionItem`（定义在 `CompletionMenu.tsx`）：

```ts
export type CompletionItemKind = 'file' | 'directory' | 'command' | 'agent' | 'prompt';

export interface CompletionItem {
    id: string;
    label: string;          // 主文本（文件名 / 命令名 / 代理名）
    description?: string;    // 副文本（路径 / 命令说明 / 预设摘要）
    insertText?: string;
    kind?: CompletionItemKind; // 决定图标
}
```

`@` 分支改为拆分文件名与路径：
- `label` = 文件名（目录追加 `/`），来自 `f.name`（已由 `normalizeWorkspaceFile` 提供）。
- `description` = 所在目录路径（`relPath` 去掉文件名部分），无目录时省略。
- `kind` = `f.isDir ? 'directory' : 'file'`。
- `insertText` 仍为 `f.relPath`（保持选中插入行为不变）。

`/`→`kind:'command'`，`#`→`kind:'agent'`，`!`→`kind:'prompt'`。

> 注意：`applySelection` 中 `isDir: item.label.endsWith('/')` 的判断在 label 改为纯文件名后仍成立（目录 label 仍以 `/` 结尾）。需复核此处不回归。

### 渲染调整（`CompletionMenu.tsx`）

- 引入 lucide 图标：`File`、`Folder`、`Terminal`、`Bot`、`Sparkles`（按 kind 映射，默认 `File`）。
- 每项布局改为 flex 行：`[图标] [主文本(flex-1, truncate)] [副文本(弱化, 右对齐, truncate, 限宽)]`。
- 命令/预设类描述较长时仍可换到副文本行下方或右侧；以文件场景的双列为主。保留 `aria-label`、`role="option"`、高亮、hover、scrollIntoView。

### 兼容性
- `kind` 可选，缺省回退 `File` 图标，旧测试（仅断言 label/description）不受影响。

## B. 上下文窗口（优先后端推送）

### 后端 sidecar（`ai-bridge/utils/usage-utils.js` + 调用方）

- `emitAccumulatedUsage(accumulated, maxTokens)` 增加可选 `maxTokens` 参数，写入负载：
  ```js
  { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, max_tokens }
  ```
- 上下文窗口由当前模型 1M 状态决定：`modelId` 含 `[1m]` → `1_000_000`，否则 `200_000`（gpt-* 走 codex 路径，本期沿用前端表，不在此分支处理或按需透传）。
- 调用 `emitAccumulatedUsage` 的位置（`message-sender.js` / `persistent-query-service.js` / `stream-event-processor.js`）需把已知的 modelId/1M 状态传入。优先在已持有 modelId 的层计算 `maxTokens`。

> 取舍：把窗口计算放在 sidecar，因为只有它确切知道 `[1m]` 是否生效（前端当前无 1M 开关概念）。

### 前端接收（`useChatStore.ts`）

- 新增 state 字段 `contextMaxTokens: number | null`（默认 null）。
- `[USAGE]` 解析分支：若 `usage.max_tokens` 为正数，写入 `contextMaxTokens`；否则保持/置 null。
- 新会话、清空时重置 `contextMaxTokens = null`（与 `contextTokens: 0` 同处复位）。
- `TokenUsage` 类型（`types/chat.ts`）增加可选 `max_tokens?: number`。

### 前端消费（`ChatComposer.tsx`）

```ts
const fallbackMax = contextWindowFor(model);
const maxTokens = contextMaxTokens && contextMaxTokens > 0 ? contextMaxTokens : fallbackMax;
const percentage = maxTokens > 0 ? (contextTokens / maxTokens) * 100 : 0;
```

`contextWindowFor` 保留为回退；可选地让其在 modelId 含 `[1m]` 时返回 1M（防御性），但主路径靠后端推送。

## 数据流

```
sidecar query → 累计 usage + 解析 1M 状态
   → emitAccumulatedUsage(usage, maxTokens)
   → stdout "[USAGE] {...max_tokens}"
Rust 转发 → 前端 useChatStore [USAGE] 分支
   → set contextTokens + contextMaxTokens
ChatComposer → maxTokens = contextMaxTokens ?? contextWindowFor(model)
   → TokenIndicator percentage / tooltip
```

## 兼容与回滚

- 后端旧负载（无 max_tokens）→ 前端 contextMaxTokens 保持 null → 回退静态表，行为同现状。
- A、B 两线解耦，任一可单独回滚（git revert 对应文件）。

## 测试影响

- `useCompletions.test.ts`：`@` 分支断言需更新为 label=文件名、description=路径、kind 存在。
- `useChatStore.test.ts`：`[USAGE]` 解析新增 max_tokens 用例 + 旧负载回退用例。
- `ChatComposer.render.test.tsx`：补充 maxTokens 优先级断言（如已覆盖）。
- sidecar：`stream-event-processor.test.js` / 相关测试若断言 USAGE 负载需更新。
