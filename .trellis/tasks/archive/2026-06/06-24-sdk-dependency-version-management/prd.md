# SDK 依赖版本管理与 cc-gui 风格优化

## Goal

让 Chat 的 SDK 依赖管理弹窗具备 cc-gui 同类设置区的信息密度和操作完整性：用户可以看到 Claude / Codex SDK 的安装状态、当前版本、最新稳定版，并选择可信版本进行安装、升级或切换，同时保留卸载、刷新、日志和错误反馈。

用户价值：
- 首次使用时能明确知道缺哪个 SDK、将安装哪个版本。
- 已安装 SDK 时能发现可升级版本，并一键更新到目标版本。
- 排查兼容性问题时能从后端提供的版本列表中选择指定稳定版本重新安装。
- SDK 面板视觉上更接近 cc-gui：紧凑、可扫、状态和主操作清晰。

## Confirmed Facts

- 当前前端 `SdkDependencyPanel` 只展示安装/未安装、安装/卸载、刷新、日志和错误，未展示版本选择或升级动作。
- 当前 `useSdkStore.install(sdkId)` 和 Tauri 命令 `chat_install_sdk(sdk_id)` 不支持指定版本。
- 当前 Rust `SdkStatus` 只返回 `id / displayName / installed / path`，无法驱动版本 UI。
- Rust `SdkDefinition` 已有默认 npm package 和默认 version：Claude SDK 使用 `^0.2.58`，Codex SDK 使用 `latest`。
- 后端已有 `reqwest` 和 `regex` 依赖，可用于 npm registry 查询和版本字符串安全校验；暂不需要引入新的 semver 依赖。
- cc-gui 参考实现提供 SDK 状态、版本列表、目标版本选择、安装/更新/卸载、日志和版本元信息。

## Requirements

- SDK 管理弹窗必须展示每个 SDK 的安装状态、安装路径、当前版本、默认版本、最新稳定版和可选目标版本。
- 目标版本选择必须来自后端可信来源：npm registry 返回的稳定版本列表、本地已安装版本、或后端定义的默认版本；不允许 UI 输入任意 npm spec。
- 未安装 SDK 时，用户可选择目标版本并安装。
- 已安装 SDK 时：
  - 选择当前版本时主按钮显示“当前版本”并禁用。
  - 选择较新版本时主按钮显示“更新到 vX”。
  - 选择其他稳定版本时主按钮显示“切换到 vX”，用于重装到指定版本。
- 卸载能力必须保留。
- 刷新能力、安装日志、错误提示必须保留。
- npm registry 查询失败时，弹窗仍应可打开并展示本地安装状态；版本选择回退到当前版本和后端默认版本。
- 安装成功后仍应刷新状态并重启 daemon，保持现有 SDK 加载行为。
- 新增用户可见文案必须提供中英文 i18n，并保留 key-only fallback 防护。
- UI 风格应对标 cc-gui 的设置区：轻量行/卡、状态图标、版本 chip、紧凑说明、主要动作在同一视线内；避免营销式大卡和冗余说明。
- Chat 输入、消息发送、Provider 配置、daemon 协议和 SDK 缺失横幅行为不在本任务中改变。

## Acceptance Criteria

- [ ] 未安装 SDK 显示“未安装”、目标版本下拉和“安装 vX”按钮，点击后调用带版本参数的安装命令。
- [ ] 已安装 SDK 显示当前版本和安装路径；当存在较新稳定版时显示升级提示和“更新到 vX”按钮。
- [ ] 已安装 SDK 选择当前版本时，主动作禁用并显示“当前版本”。
- [ ] 已安装 SDK 选择非当前稳定版本时，主动作显示“切换到 vX”，并通过同一安装流程重装到该版本。
- [ ] 后端拒绝 `latest`、range、file/git/url、含空白、路径或 shell-like 字符的 UI 版本 payload。
- [ ] `chat_sdk_status` 在 registry 网络失败时仍成功返回本地状态。
- [ ] key-only i18n 下 SDK 面板不暴露 `chat.sdk.*` raw key。
- [ ] 定向前端测试、前端构建、Rust SDK 单元测试、`cargo check` 通过。

## Notes

- 版本比较只用于 UI action label 和禁用判断，后端安全边界以“精确版本字符串 + 来源可信列表”为主，不执行任意 npm spec。
- 真实 npm install 不作为自动化测试步骤，避免测试环境触发远程安装；安装流程通过命令构造和参数校验测试覆盖。
