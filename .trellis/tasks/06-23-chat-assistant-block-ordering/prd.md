# Fix chat assistant content block ordering

## Goal

修复聊天转录中助手回合的内容块顺序错乱:工具块与文本块被聚类(所有文本在前、所有工具在后),而不是按真实发生顺序交错(text → tool → text → tool)排列。

## User Value

用户查看聊天(无论实时流式还是重开历史会话)时,助手的文本输出与工具调用按真实时间顺序交错呈现,能正确理解"先说什么、再做什么、又说什么"的推理过程,而不是看到割裂的"文本堆"和"工具堆"。

## Confirmed Facts (root cause)

经 Explore 代理跨层追踪确认,根因在前端,分两处:

1. **实时合并把顺序压平为聚类** —— `src/utils/chatMessageFlow.ts`:
   - `getAssistantRawMergeSeedBlocks` (308-323) 在已有文本缺失时把流式文本作为种子强制放到 `content` 数组最前面:`[{type:'text',...}, ...existingBlocks]`。
   - `mergeAssistantRaw` (332-356) 用 `content: [...existingBlocks, ...nextBlocks]` 持续把后到的块追加到尾部,并用 `isTextAlreadyRepresentedInContent` 丢弃已在 `content` 中的文本。
   - `syncAssistantRawWithStreamingContent` (`useChatStore.ts`:347-371) 同样把流式文本种子到最前。
   - 结果:一个 text→tool→text→tool 的回合被折叠成 "文本簇 + 工具簇"。
2. **重开会话不从磁盘重载** —— `useChatStore.ts`:1148-1157 的 `loadSession` early-return:当重新点击"刚刚实时跑过的当前会话"时直接 return,屏幕上留着已聚类的实时消息,而非磁盘上顺序正确的历史。

3. **store 丢弃了 daemon 的块边界信号(更深根因)** —— daemon (`stream-event-processor.js`) 在每个 `message_start`(每次 tool_use 循环迭代)发出 `[BLOCK_RESET]`,并把文本走 `[CONTENT_DELTA]`、工具走 `chat://message`(仅当快照含 tool_use 时)。但前端 `useChatStore.ts:803-805` 显式忽略 `[BLOCK_RESET]`,`appendToStreamingAssistant` (377-) 把整轮所有 `[CONTENT_DELTA]` 压成**单条扁平 `content` 字符串**。因此实时交错(text1→tool1→text2→tool2)被压成"一段文本 + 工具簇"。真实交错顺序在 daemon 端通过 `[BLOCK_RESET]` 有信号,但被前端丢弃。
   - 注意:现有 store 测试 `useChatStore.test.ts:1854-1868` 当前**断言聚类为正确**(stream text → tool → stream text 得到 `['text','tool_use']` 且文本拼成一条),修复时需同步更新该测试为交错预期。

后端(Rust)与历史映射层是**干净的**,保持源顺序:
- `parse_claude_history_line` 原样存整行 JSONL 为 `raw`,测试 `load_claude_messages_preserves_structured_blocks` 已断言 thinking→tool_use→tool_result 顺序保留。
- `parse_codex_history_line` / `load_codex_messages` 按文件顺序逐条发出。
- `mapHistoryMessages` 是 1:1 `.map()`,`groupToolBlocks` 只合并连续同类型工具(遇非工具块即 flush),均保序。

## Requirements

- 实时合并 assistant `raw` 时必须保留内容块的**源顺序**:当 provider 发来包含完整 `content` 数组的快照时,按快照顺序重建,而不是 text-first 种子 + 尾部追加。
- 流式文本与结构化 `raw` 的同步必须把文本放回它在源顺序中的位置(通常是其对应的 text block 原位),不得把文本强制提到数组最前。
- 保持现有"流式文本不被工具块吞掉/隐藏"的可见性契约(参见 state-management.md "Chat Message Raw Event Merging")。
- 保持文本去重:同一段文本不得在流式 `content` 与 assistant text raw 间重复渲染。
- 重开"刚实时跑过的当前会话"时,`loadSession` 必须能从磁盘(或顺序正确的缓存)重建顺序正确的转录,不再 early-return 留下聚类后的实时消息。
- 改动范围限定前端;不改 Rust 后端与历史映射(它们已保序)。
- 更新 state-management.md "Chat Message Raw Event Merging" 契约,明确"源顺序保留"为强制要求。

## Acceptance Criteria

- [ ] 单元测试:一个 text→tool_use→text→tool_use 的多快照实时回合,合并后 `raw.message.content` 顺序与源一致(非聚类)。
- [ ] 单元测试:流式文本增量与后续 tool raw 交替到达时,文本块停留在源顺序位置,不被提到最前。
- [ ] 单元测试:重复文本(流式 content 已含)不产生重复可见文本块。
- [ ] 单元/store 测试:重开刚跑过的当前会话后,转录按磁盘顺序交错渲染,而非实时聚类顺序。
- [ ] 现有 "Chat Message Raw Event Merging" 相关测试全部通过(约 10 项)。
- [ ] `npm test` 相关套件通过,`npm run build` 通过。
- [ ] 手动验证:复现截图场景(实时跑一个含多次"说话+工具"的回合),文本与工具交错显示;重开该会话仍交错。

## Out of Scope

- 修改 Rust 后端 session 解析或 `UnifiedSessionMessage` 结构。
- 修改 `groupToolBlocks` 连续同类型工具的合并展示规则。
- 改变历史首屏窗口化 / 滚动加载行为(已由 06-22-06-22-chat-history-scroll-window-fix 处理)。
- 改变工具结果跨消息查找(later-first / earlier-fallback)规则。

## Notes

- 这是复杂任务:涉及有文档契约 + 约 10 个测试的核心合并路径,需 design.md + implement.md。
- 关联:[[06-22-06-22-chat-history-scroll-window-fix]] 同样动了 `loadSession`,注意两处改动一致性(token 所有权、windowed/complete 状态)。
