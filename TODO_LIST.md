# 当前任务计划

## Chat UI cc-gui parity 持续迭代

- [ ] 会话管理第一版：在 Chat 页面接入项目/会话侧栏，支持选择已有会话加载历史并继续发送，支持新建会话保留项目 cwd。
  - 验证方式：`npm run build`；手动选择项目、选择 session、发送新消息检查 `sessionId/cwd/provider`。
  - 当前状态：代码已实现；新增活跃请求切换会话前 abort 保护；`npm test` 与 `npm run build` 通过；浏览器可见性检查通过；真实桌面 session 选择/继续发送仍需 Tauri 桌面数据验证。
- [ ] 文案与可访问性：新增用户可见文案同步 `zh.json` / `en.json`，按钮提供 title/aria 语义。
  - 验证方式：`npm run build`；检查浅色/深色基础布局不遮挡输入区。
  - 当前状态：中英文 key 已补齐；`npm run build` 通过；浏览器默认主题未发现遮挡；深色主题和真实桌面视觉待验证。
- [ ] Trellis 质量门：执行 `trellis-check`，必要时更新 spec，再提交当前阶段。
  - 验证方式：`npm run build` 通过；如仅改前端则记录无需 `cargo check`。
  - 当前状态：`npm test`、`npm run build`、`git diff --check` 已通过；前端 state-management spec 已更新；待提交当前阶段。
