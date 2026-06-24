# SDK 依赖版本管理与 cc-gui 风格优化 Design

## Architecture

本任务沿用现有 Chat SDK 依赖管理边界：
- 前端弹窗仍由 `ChatPage` 通过 `ModalDialog` 打开。
- SDK 状态和操作仍集中在 `useSdkStore`。
- Tauri command 仍保持薄层，业务逻辑放在 `src-tauri/src/chat/manager.rs` 和 `src-tauri/src/chat/sdk_installer.rs`。
- SDK 安装仍走现有 `npm install --include=optional --prefix <sdkDir> <package@version>` 机制，安装成功后重启 daemon。

## Backend Contract

扩展 Rust `SdkStatus`：

```rust
pub struct SdkStatus {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub installed: bool,
    pub path: String,
    #[serde(rename = "currentVersion")]
    pub current_version: Option<String>,
    #[serde(rename = "defaultVersion")]
    pub default_version: String,
    #[serde(rename = "latestVersion")]
    pub latest_version: Option<String>,
    #[serde(rename = "availableVersions")]
    pub available_versions: Vec<String>,
}
```

状态来源：
- `currentVersion` 从 `<deps>/<sdkId>/node_modules/<npm_package>/package.json` 读取 `version`。
- `defaultVersion` 来自 `SdkDefinition.version`，用于 registry 失败或版本列表为空时的 fallback。
- `latestVersion` 和 `availableVersions` 从 npm registry package metadata 解析。
- `availableVersions` 只保留稳定版本，最多返回最近 20 个，优先最新版本在前。

命令变更：

```rust
#[tauri::command]
pub async fn chat_install_sdk(
    sdk_id: String,
    version: Option<String>,
    state: State<'_, ChatState>,
) -> Result<(), String>
```

调用链同步：
- `ChatManager::install_sdk(sdk_id, version)`
- `sdk_installer::install_sdk(sdk, node_path, deps_dir, version, on_log)`
- `build_npm_command(npm, sdk_dir, sdk, version)`
- `package_spec(sdk, version)` 使用显式版本或后端默认版本。

## Version Safety

UI 只能传 `availableVersions` 中选出的版本；后端仍必须做第二道校验。

校验规则：
- 仅允许精确 semver-ish 版本：`major.minor.patch`，可按 npm registry 稳定版本保留数字和点。
- 拒绝 `latest`、`^1.2.3`、`~1.2.3`、`>=1.2.3`、`file:`、`git+`、URL、路径分隔符、空白和 shell 相关字符。
- 默认版本不走 UI payload；未传 `version` 时使用 `SdkDefinition.version`。

说明：当前不引入 `semver` crate，避免扩大依赖面。版本列表来自 npm registry keys，UI 只展示后端过滤后的稳定版本；后端 install 参数再按精确版本校验。

## Registry Query

请求地址：
- `https://registry.npmjs.org/<encoded-package-name>`
- scoped package 需要 percent encode，例如 `@openai/codex-sdk` -> `%40openai%2Fcodex-sdk`。

解析字段：
- `dist-tags.latest`
- `versions` object keys

容错：
- 网络错误、JSON 结构不完整或 registry 超时时，不让 `chat_sdk_status` 失败。
- 回退版本列表包含 `currentVersion` 和可安全表达的后端默认版本；若默认版本是 range 或 `latest`，不作为可安装的 UI 精确版本展示。

## Frontend Contract

TypeScript `SdkStatus` 同步新增 camelCase 字段：

```ts
export interface SdkStatus {
  id: string;
  displayName: string;
  installed: boolean;
  path: string;
  currentVersion?: string;
  defaultVersion: string;
  latestVersion?: string;
  availableVersions: string[];
}
```

Store 变更：

```ts
install: (sdkId: string, version?: string) => Promise<void>;
await invoke('chat_install_sdk', { sdkId, version });
```

UI 本地状态：
- `selectedVersions: Record<string, string>`
- 状态刷新后，如果 SDK 没有已选择版本，默认选择 `latestVersion ?? currentVersion ?? availableVersions[0]`。
- 版本列表为空时禁用主安装/更新动作，但仍允许刷新和卸载。

## UI Behavior

`SdkDependencyPanel` 改成 cc-gui 风格的紧凑管理面板：
- 顶部标题区：标题、刷新按钮、简短依赖说明。
- 每个 SDK 一行/轻量卡：
  - 左侧状态图标：已安装使用 check，未安装使用 package/dot。
  - 中部：名称、状态、副说明、版本 chip。
  - 版本选择：`目标版本` select。
  - 右侧动作：
    - 未安装：`安装 vX`
    - 已安装且目标版本 > 当前版本：`更新到 vX`
    - 已安装且目标版本 = 当前版本：`当前版本` disabled
    - 已安装且目标版本 != 当前版本：`切换到 vX`
    - 已安装：保留 `卸载`
  - 底部元信息：当前版本、最新稳定版、安装路径。
- 日志和错误保留在列表下方。
- `ChatPage` 的 SDK modal 使用现有 `ModalDialog` 的 `onCancel` / `cancelText` 增加底部“取消 / 关闭”双按钮，不改通用 Modal API。

图标使用 `lucide-react` 现有依赖；不使用 emoji。

## Compatibility

- `chat_install_sdk` 新增 optional `version`，旧前端不传时仍按后端默认版本安装。
- `chat_sdk_status` 返回字段只增不删，旧 UI 若未使用新增字段不受影响。
- SDK 安装目录结构不变。
- daemon 重启行为不变。

## Risk And Rollback

主要风险：
- npm registry 查询增加打开弹窗时的等待时间。
- 版本排序如果只用字符串排序可能不符合 semver。
- 默认版本为 `latest` 或 range 时不能作为 UI 精确版本直接安装。

缓解：
- registry 查询失败不阻断本地状态。
- 测试覆盖 registry JSON 解析、fallback、版本 payload 拒绝。
- UI 禁用空版本安装，避免把不可信 spec 传到后端。

回滚方式：
- 回退 `SdkStatus` 新字段使用和 `chat_install_sdk` 可选参数即可恢复旧行为；因为 command 参数是 optional，后端可保持兼容。
