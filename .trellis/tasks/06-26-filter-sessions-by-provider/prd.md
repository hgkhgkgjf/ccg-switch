# 会话列表 codex/claude 提供方过滤按钮

## Goal

在 `ChatSessionSidebar` 会话搜索框旁边增加 codex / claude 两个提供方图标按钮，用于按提供方过滤当前会话列表，让用户能快速只看某一类会话。

## Requirements

- 在 `ChatSessionSidebar.tsx` 的会话搜索框（`searchSessionsLabel` 输入框）同一行右侧，放置两个图标按钮：codex、claude，使用 `ProviderBrandIcon`（与会话行徽标一致）。
- 过滤行为（二选一互斥 + 可取消）：
  - 默认 `all`，两个按钮都未激活，列表显示全部受支持会话。
  - 点 codex → 仅显示 `providerId === 'codex'` 的会话，codex 按钮高亮。
  - 点 claude → 仅显示 `providerId === 'claude'` 的会话，claude 按钮高亮。
  - 再次点击当前已激活的按钮 → 取消过滤，回到 `all`。
  - 两者互斥：选中一个会取消另一个。
- 过滤与现有 `sessionQuery` 文本搜索叠加（先按提供方过滤，再按文本过滤）。
- 过滤状态属于会话面板的瞬时 UI 状态；切换项目/刷新会话时无需强制持久化（默认不持久化即可，回到 `all` 也可接受）。
- 按钮需有 `aria-pressed`、`title`/`aria-label`，并提供测试可定位的 `data-*` 属性（如 `data-chat-session-provider-filter="codex|claude"`）。
- i18n：新增按钮文案需同时更新 `zh.json` 与 `en.json`（如「仅 Codex 会话 / Codex only」）。

## Acceptance Criteria

- [ ] 搜索框右侧出现 codex、claude 两个图标按钮，视觉与会话徽标图标一致。
- [ ] 点 codex 仅剩 codex 会话；点 claude 仅剩 claude 会话；再次点同一按钮恢复全部。
- [ ] 两按钮互斥，激活态有明显高亮（`aria-pressed=true`）。
- [ ] 过滤与文本搜索可同时生效。
- [ ] 过滤逻辑有单元测试覆盖（纯函数，放在 `chatSessionSidebarUtils.ts` 并在其 test 中验证 RED→GREEN）。
- [ ] `npm test`、`npm run build` 通过；i18n zh/en 均已补齐。

## Notes

- 现有提供方常量见 `isSupportedChatProvider`（claude/codex）。
- 当前仅在 `panelMode === 'project'` 的会话区有搜索框；本次过滤按钮跟随该搜索框，Recent chats 模式不在本次范围。
