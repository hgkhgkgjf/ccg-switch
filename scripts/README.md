# 版本发布脚本使用说明

## 快速开始

### 推荐：一键发布

```bash
# 预演发布流程：不修改文件、不提交、不打 tag、不推送
npm run release:dry -- 1.6.4 minor "新增一键发布脚本"

# 正式发布：自动更新版本、验证、提交、打 tag、推送 main 和 tag
npm run release -- 1.6.4 minor "新增一键发布脚本"

# 非交互发布：适合你已经确认参数无误时使用
npm run release -- 1.6.4 minor "新增一键发布脚本" --yes
```

一键发布脚本默认会执行：

1. 检查当前分支是 `main`。
2. 检查工作区干净。
3. 检查目标 tag 不存在。
4. 更新版本号和官网 Changelog。
5. 同步 `package-lock.json` / `website/package-lock.json` 的根版本号。
6. 清理 `dist`、`website/dist`、`out`、`website/out`。
7. 运行验证命令：
   - `git diff --check`
   - `npm test`
   - `npm run build`
   - `cargo check --manifest-path src-tauri/Cargo.toml`
   - `cd website && npm run build`
8. 提交 `chore: bump version to <version>`。
9. 创建注释 tag `v<version>`，并保留 Markdown 标题格式。
10. 推送 `main` 和 `v<version>`，触发 GitHub Actions 自动构建 Release。

### 仅更新版本号

```bash
# 使用 npm 命令 (推荐)
npm run bump 1.2.15 minor "新增 macOS 自动更新功能"

# 或直接运行脚本
node scripts/bump-version.js 1.2.15 minor "新增 macOS 自动更新功能"
```

## 脚本功能

### 自动更新的文件

| 文件 | 说明 |
|------|------|
| `package.json` | 主应用版本号 |
| `package-lock.json` | 主应用 lockfile 根版本号 |
| `website/package.json` | 网站版本号 |
| `website/package-lock.json` | 网站 lockfile 根版本号 |
| `src-tauri/tauri.conf.json` | Tauri 配置 (决定安装包版本) |
| `website/src/pages/Changelog.tsx` | 新增版本条目 |

### 自动生成的内容

- **Git Tag 消息模板** - 用于 GitHub Release 描述
- **后续步骤提示** - 包含完整的 git 命令

## 使用示例

### 1. 小版本更新 (新增功能)

```bash
npm run bump 1.2.15 minor "新增 macOS 自动更新功能"
```

### 2. 补丁更新 (修复问题)

```bash
npm run bump 1.2.15 patch "修复权限问题"
```

### 3. 大版本更新 (重大变更)

```bash
npm run bump 2.0.0 major "全新架构重构"
```

### 4. 仅更新版本号 (无描述)

```bash
npm run bump 1.2.15 minor
```

## 手动发布流程

```bash
# 步骤 1: 运行版本更新脚本
npm run bump 1.2.15 minor "新增 macOS 自动更新功能"

# 步骤 2: 检查修改
git diff

# 步骤 3: 提交更改
git add .
git commit -m "chore: bump version to 1.2.15"

# 步骤 4: 创建 tag (使用脚本输出的消息模板，保留 Markdown 标题)
git tag -a v1.2.15 --cleanup=verbatim -F tag-message.txt

# 步骤 5: 推送 (触发 GitHub Actions 自动构建)
git push origin main
git push origin v1.2.15
```

## 重要说明

⚠️ **版本号必须先于 tag 更新**

```bash
# ❌ 错误顺序 - 会导致安装包版本号错误
git tag v1.2.15
# 然后修改 package.json 版本...

# ✅ 正确顺序
# 1. 先更新所有配置文件中的版本号
# 2. 提交版本更改
# 3. 创建 tag (指向版本更新提交)
# 4. 推送触发构建
```

**原因：** GitHub Actions 构建时使用 `tauri.conf.json` 中的版本号，而非 tag 名称。

## 失败恢复

### main 已推送，但 tag 推送失败

不要重新 bump 版本，直接推送同一个 tag：

```bash
git push origin v1.6.4
```

### 本地已经提交并打 tag，但完全没有推送成功

```bash
git push origin main
git push origin v1.6.4
```

### 验证失败

一键发布脚本会在提交和打 tag 之前停止。修复问题后重新运行同一条 `npm run release -- ...` 命令即可。

### 只想本地提交和打 tag，暂不推送

```bash
npm run release -- 1.6.4 minor "新增一键发布脚本" --no-push
```

之后手动推送：

```bash
git push origin main
git push origin v1.6.4
```

## 脚本输出示例

```
========================================
  CCG Switch 版本号统一更新
========================================

📋 当前版本状态:

  package.json (根目录)
    当前版本: 1.2.14
    更新到:   1.2.15

  website/package.json
    当前版本: 1.0.2
    更新到:   1.2.15

  src-tauri/tauri.conf.json
    当前版本: 1.2.14
    更新到:   1.2.15

📝 Changelog 更新:

  版本: 1.2.15
  类型: minor
  描述: 新增 macOS 自动更新功能

📦 Git Tag 消息模板 (用于 GitHub Release):

────────────────────────────────────────────────
v1.2.15

发布日期: 2025-03-12

### 新增功能
- 新增 macOS 自动更新功能

### 下载说明
- **Windows**: 下载 `.exe` (NSIS安装包) 或 `.msi`
- **macOS**: 下载 `.dmg`
- **Linux**: 下载 `.deb` 或 `.AppImage`
────────────────────────────────────────────────

📝 更新后的后续步骤:

  1. 检查修改的文件
  2. 补充 Changelog.tsx 中的更新内容（如需要）
  3. 提交更改: git add . && git commit -m "chore: bump version to 1.2.15"
  4. 创建 tag: git tag -a v1.2.15 -m "$(cat <<'EOF'
...
EOF
)"
  5. 推送: git push origin main && git push origin v1.2.15

⚠️  确认要更新以上版本号吗？ (y/N):
```

## 版本类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `major` | 重大更新 (不兼容的 API 变更) | 1.2.15 → 2.0.0 |
| `minor` | 新增功能 (向后兼容的新功能) | 1.2.14 → 1.2.15 |
| `patch` | 补丁修复 (向后兼容的问题修复) | 1.2.14 → 1.2.14.1 |
