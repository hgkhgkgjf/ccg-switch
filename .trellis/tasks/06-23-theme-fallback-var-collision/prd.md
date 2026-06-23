# Fix DaisyUI fallback var namespace collision breaking button hover

## Goal

修复亮/暗主题下所有"无色"按钮(btn / btn-ghost 等)鼠标悬停时变成深灰/黑色的问题。

## User Value

用户在任意主题下悬停聊天区及全应用的普通按钮时,得到正确的主题化浅色/微弱色调反馈,而不是突兀的黑底。

## Confirmed Facts (root cause)

- `src/styles/toolBlocks.css` 第 4-22 行在 `:root` 与 `[data-theme="dark"]` 上定义了
  `--fallback-b1/b2/b3/bc/n/er/su` 为**实色、全不透明**,本意是给本项目 diff-hover 样式做回退。
- 但 `--fallback-bc` 等是 **DaisyUI 保留变量名**。DaisyUI 输出形如
  `.btn-ghost:hover { background-color: var(--fallback-bc, oklch(var(--bc)/0.2)) }`,
  即"`--fallback-bc` 已定义则用它,否则用 20% 透明色调"。DaisyUI 插件**故意不定义**该变量,
  让透明色调生效。
- 项目全局定义了 `--fallback-bc: #1f2937`,导致所有 DaisyUI `var(--fallback-*, …)` 解析为
  实色深灰(全不透明),于是所有无色按钮悬停变黑;两个主题都受影响。
- 设了颜色的按钮通过 `--btn-color` 走另一条路径,故"加了样式颜色的按钮没影响"。
- 项目自身用到这些变量的地方(diff-hover 系列、若干 `--diff-hover-*`)都写成
  `var(--fallback-X, oklch(var(--X)/N))`,移除实色定义后会回退到主题化的 `oklch(var(--X)/N)`,
  即更正确的主题色,不会丢样式。

## Requirements

- 移除 `toolBlocks.css` 中 `:root` 与 `[data-theme="dark"]` 的 `--fallback-*` 变量定义块
  (第 4-22 行),不再占用 DaisyUI 保留命名空间。
- 移除后,项目内所有 `var(--fallback-X, oklch(var(--X)/N))` 必须回退到 `oklch` 主题值;
  确认 diff-hover 预览、bash/diff 面板等仍按主题正确着色(浅色主题浅底、深色主题深底)。
- 不改 DaisyUI 配置、不改按钮组件类名;这是纯 CSS 变量命名空间修复。
- 不在本任务顺带改 `.markdown-block pre` 代码块深色底(单独决定)。

## Acceptance Criteria

- [ ] 亮色主题下,普通 `btn` / `btn-ghost` 悬停为微弱主题色调(非黑/深灰)。
- [ ] 暗色主题下,普通按钮悬停同样为合适的浅色调,不发生回归。
- [ ] 设了颜色的按钮(primary/warning/error 等)悬停行为不变。
- [ ] diff-hover 预览与工具/diff 面板在两主题下着色正确(浅底/深底符合主题)。
- [ ] 聊天代码块(```围栏```)在亮色主题用浅底 + github(light)语法高亮,暗色主题保持
      github-dark 深底;切换主题即时跟随。
- [ ] `npm run build` 通过;相关现有测试通过。
- [ ] 手动验证:复现截图场景(聊天区按钮悬停)不再变黑。

## Out of Scope

- 重构 diff-hover 配色体系。
- 任何 DaisyUI 主题色值调整。

## Notes

- 轻量任务,PRD-only。
- 根因是 CSS 变量命名空间冲突,根治方式是移除冲突定义而非到处覆盖。
