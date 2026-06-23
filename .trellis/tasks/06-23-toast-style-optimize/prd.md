# 优化任务完成后右下角弹出提示框样式

## Goal

优化 Toast 通知组件的视觉样式和位置，使其更符合现代 UI 设计标准。

## 当前实现

- **文件**: `src/components/common/Toast.tsx` + `ToastContainer.tsx`
- **位置**: 右上角 (`top-24 right-8`)
- **样式**: 圆角、阴影、边框，支持 4 种类型 (success/error/info/warning)
- **动画**: opacity + translate 过渡

## Requirements

1. 将 Toast 位置从右上角改为右下角
2. 采用玻璃拟态 (Glassmorphism) 风格：
   - 半透明背景 + 背景模糊 (backdrop-blur)
   - 柔和的边框和阴影
   - 圆润的边角
3. 保持深色/浅色主题适配
4. 保持现有功能（点击、关闭、自动消失）

## Acceptance Criteria

- [ ] Toast 显示在屏幕右下角
- [ ] 样式符合项目 UI 规范（DaisyUI 风格、圆角、阴影）
- [ ] 进入/退出动画流畅
- [ ] 深色主题和浅色主题均正常显示
- [ ] 不影响现有 Toast 调用方式

## Notes

- 轻量级 UI 优化任务，PRD-only 即可
- 参考项目 UI 规范：卡片 `rounded-xl shadow-sm`，按钮渐变色 `from-orange-500 to-pink-500`
