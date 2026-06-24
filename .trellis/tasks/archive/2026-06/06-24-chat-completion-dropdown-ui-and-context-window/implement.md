# 执行计划：补全下拉框 UI 对标与上下文窗口修正

## 实施顺序

两条线解耦。建议先做 A（纯前端、可独立验证），再做 B（前后端联调）。

### A. 补全下拉框 UI

- [ ] A1. `CompletionMenu.tsx`：扩展 `CompletionItem`（加 `kind?: CompletionItemKind`），新增 kind→lucide 图标映射。
- [ ] A2. `CompletionMenu.tsx`：渲染改为「图标 + 主文本(flex-1 truncate) + 副文本(右对齐弱化 truncate)」行布局，保留键盘导航/loading/empty/hover/scrollIntoView/aria。
- [ ] A3. `useCompletions.ts`：`@` 分支拆分 label(文件名+目录加/) 与 description(所在路径)，设置 `kind`；`/`/`#`/`!` 分支补 `kind`。
- [ ] A4. 复核 `applySelection` 的 `isDir: item.label.endsWith('/')` 仍正确（目录 label 以 / 结尾）。
- [ ] A5. 更新 `useCompletions.test.ts` 的 `@` 分支断言（label/description/kind）。

### B. 上下文窗口

- [ ] B1. `types/chat.ts`：`TokenUsage` 增加 `max_tokens?: number`。
- [ ] B2. `usage-utils.js`：`emitAccumulatedUsage(accumulated, maxTokens?)` 写入 `max_tokens`。
- [ ] B3. 调用方（`message-sender.js` / `persistent-query-service.js` / `stream-event-processor.js`）传入由 modelId `[1m]` 状态算出的窗口（1M / 200K）。
- [ ] B4. `useChatStore.ts`：新增 `contextMaxTokens: number | null`，`[USAGE]` 分支解析 max_tokens，新会话/清空复位。
- [ ] B5. `ChatComposer.tsx`：`maxTokens = contextMaxTokens ?? contextWindowFor(model)`。
- [ ] B6. 更新 `useChatStore.test.ts`（max_tokens 用例 + 旧负载回退）及受影响 sidecar 测试。

## 验证命令

```bash
# 前端类型 + 构建
npm run build

# 单测（按改动范围）
npx vitest run src/components/chat/composer/useCompletions.test.ts
npx vitest run src/stores/useChatStore.test.ts
npx vitest run src/components/chat/composer/ChatComposer.render.test.tsx

# sidecar 测试（若 node 测试可独立跑）
node --test src-tauri/resources/ai-bridge/services/claude/stream-event-processor.test.js
```

## 评审门（review gates）

- A 完成后：在 tauri dev 中输入 @ / # / ! / /，确认图标 + 双列布局 + 键盘导航正常。
- B 完成后：用 1M 模型会话发一轮消息，确认小圆圈 maxTokens=1,000,000、百分比正确；用普通模型确认仍 200K。需重启 tauri dev 使 sidecar 生效。

## 回滚点

- A 与 B 分别独立提交，便于单独 revert。
- B 后端改动若联调异常，前端因 null 回退静态表，可临时只回滚 sidecar 改动。

## 风险

- sidecar 改动需重启 dev，HMR 不生效——验证时务必重启。
- codex(gpt-*) 路径本期不深入，沿用前端 400K 静态表，B 分支仅保证 Claude 1M/200K 正确。
