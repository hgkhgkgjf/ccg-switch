# Fix chat history scroll-load window calculation

## Goal

根本修复 `getRecentRenderableMessages` 的早期终止遍历缺陷，使多轮连续 reveal 能够正确报告 `hiddenRenderableCount` 直到所有历史消息加载完毕。

## User Value

用户可以通过滚轮向上连续加载完整的聊天历史记录，而不会在中途遇到"明明上面还有消息，但无法继续加载"的截断问题。

## Confirmed Facts

- **三次归档任务的循环复现**：`06-22-chat-top-scroll-reveal`、`06-22-chat-reveal-pagination-regression`、`06-22-06-22-chat-guarded-scroll-reveal` 都修复了触发逻辑或状态传播，但没有触及根本原因。
- **根本原因**：`getRecentRenderableMessages` 在收集到 `maxVisible` 个消息后继续遍历统计 `hiddenRenderableCount`，但由于早期终止逻辑，当 `requestedVisibleCount` 接近 `totalRenderableCount` 时，`hiddenRenderableCount` 会过早归零。
- **失败模式**：100 条消息的会话，用户滚动加载 2 次后（显示 45 条），第 3 次滚动时 `hiddenRenderableCount` 已变为 0，`shouldAutoRevealEarlierMessages` 返回 false，滚动加载停止。
- 用户截图显示明显的历史消息截断：顶部有"加载更多"的视觉暗示，但滚轮无法触发加载。

## Requirements

- 重构 `getRecentRenderableMessages` 为**先完整遍历统计，再切片窗口**的模式，确保 `hiddenRenderableCount` 基于完整的可渲染消息列表计算。
- 保持函数签名和返回结构不变：`{ renderableMessages, hiddenRenderableCount, totalRenderableCount }`。
- 确保 `hiddenRenderableCount` 始终等于 `totalRenderableCount - renderableMessages.length`，即使 `visibleCount` 超过实际可渲染消息总数。
- 保留 `MessageList` 现有的 reveal 逻辑、滚动监听器、`getManualRevealWindow` 和 `shouldAutoRevealEarlierMessages` 不变。
- 保持搜索模式行为不变：搜索时仍使用 `getRenderableMessages()` 返回完整列表。
- 添加测试覆盖：100 条消息，连续 4 次 reveal（15 -> 45 -> 75 -> 100+），验证 `hiddenRenderableCount` 序列为 `85 -> 55 -> 25 -> 0`。

## Acceptance Criteria

- [ ] `getRecentRenderableMessages` 先完整遍历收集所有可渲染消息，再基于 `visibleCount` 切片窗口
- [ ] 单元测试：100 条消息，`visibleCount = 15/45/75/105` 产生 `hiddenRenderableCount = 85/55/25/0`
- [ ] 单元测试：混合可渲染 + 不可渲染消息，验证隐藏计数仅反映可渲染部分
- [ ] 集成测试：`MessageList` 四轮连续 reveal，验证每轮 `collapsedCount` 正确递减
- [ ] `npm test -- src/utils/chatNavigation.test.ts` 通过
- [ ] `npm test -- src/components/chat/MessageList.test.tsx` 通过
- [ ] `npm run build` 通过
- [ ] 手动验证：100+ 条历史消息的会话，滚轮连续向上加载直到真正的顶部，不会提前停止

## Out of Scope

- 修改 reveal 页大小 (`REVEAL_PAGE_SIZE`)
- 修改滚动触发阈值 (`AUTO_REVEAL_SCROLL_THRESHOLD`)
- 改变搜索模式的窗口行为
- 修改后端历史加载逻辑

## Root Cause Analysis Summary

**Category**: C - Change Propagation Failure

**为什么之前的修复失败**：
1. 第一次修复：禁用自动滚动加载 → 用户体验倒退
2. 第二次修复：修复 UI 状态计算 → 没触及窗口遍历根因
3. 第三次修复：恢复自动加载 + 守卫 → 守卫防止重入，但窗口截断依然存在

**Mental Model 错误**：所有修复都聚焦在"触发逻辑"和"reveal 状态"层面，没有意识到 `getRecentRenderableMessages` 的**边遍历边截断**才是真正瓶颈。

**预防机制**：
- P0: 架构 - 将窗口计算改为"完整枚举 + 切片"模式
- P0: 测试覆盖 - 多轮连续 reveal 场景
- P1: 文档 - `.trellis/spec/frontend/state-management.md` 已添加窗口计算契约
- P1: Code Review - PR checklist 加"是否验证了多页连续加载？"

## Notes

- 这是一个**架构级根因修复**，不是补丁。
- 之前三次修复的失败经验已记录在 `.trellis/spec/frontend/state-management.md` 的 "Scenario: Chat Transcript Window Calculation Contract" 章节。
- 修复后需要更新相关测试，确保覆盖"长会话多轮 reveal"场景。
