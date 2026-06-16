# 模块组织

> Rust 模块拆分、可见性、导出规范

---

## 概述

CC Switch 后端按**功能域**组织模块，每个域是 `src/` 下的一个目录（如 `chat/`、`models/`、`services/`、`commands/`）。模块内部进一步按职责拆分子模块，通过 `mod.rs` 统一导出公开接口。

---

## 顶层结构

```
src/
├── lib.rs                # 应用入口，注册 Tauri 命令、setup 钩子
├── commands/             # Tauri 命令层（薄层，参数解析 + 错误映射）
│   ├── mod.rs            # 导出所有命令模块
│   ├── chat_commands.rs
│   ├── config_commands.rs
│   └── ...
├── models/               # 数据模型（serde Serialize/Deserialize）
│   ├── mod.rs
│   ├── config.rs
│   ├── token.rs
│   └── ...
├── services/             # 业务逻辑层（文件 I/O、数据库、配置管理）
│   ├── mod.rs
│   ├── config_service.rs
│   ├── token_service.rs
│   └── ...
├── chat/                 # Chat 功能域（daemon 管理、协议、SDK 安装）
│   ├── mod.rs            # 导出 ChatManager、SdkStatus 等公开类型
│   ├── manager.rs        # 高层编排：拥有 DaemonClient，转发事件给前端
│   ├── daemon_client.rs  # 与 Node.js daemon 的 IPC 封装
│   ├── protocol.rs       # daemon 标签行协议解析
│   ├── resources.rs      # 路径解析（node、bridge、deps、permission_dir）
│   ├── sdk_installer.rs  # npm install 封装
│   └── permission_watcher.rs  # 文件 IPC 轮询监听器
├── database.rs           # SQLite 连接池 + schema
├── migration_service.rs  # 数据目录迁移
└── utils/                # 工具函数（路径、字符串处理）
    └── ...
```

---

## 模块可见性原则

### 1. 默认私有，显式公开

- 模块内的函数、结构体、子模块默认 `pub(crate)`（crate 内可见）或私有
- 只有需要暴露给其他模块或 Tauri 命令的类型/函数才加 `pub`

```rust
// chat/mod.rs
mod daemon_client;   // 私有模块，外部不能直接访问
mod manager;
mod protocol;
mod resources;
mod sdk_installer;
mod permission_watcher;

pub use manager::ChatManager;  // 公开：外部可用
pub use sdk_installer::SdkStatus;
pub use permission_watcher::{
    write_ask_user_question_response,
    write_plan_approval_response,
};
pub use resources::permission_dir;

// daemon_client、protocol 的内部实现细节不导出
```

### 2. 辅助函数保持私有

文件内的辅助函数不需要 `pub`，除非其他模块确实需要复用。

```rust
// chat/resources.rs
pub fn permission_dir<R: Runtime>(app: &impl Manager<R>) -> Result<PathBuf, String> {
    // 公开函数，commands 层会调用
}

fn detect_node() -> Result<PathBuf, String> {
    // 私有辅助函数，仅本模块内使用
}
```

---

## 导出模式

### 模式 A：平铺导出（简单模块）

当模块没有子模块时，直接在 `mod.rs` 平铺定义：

```rust
// models/mod.rs
pub mod config;
pub mod token;
pub mod provider;
```

外部导入：
```rust
use crate::models::config::Config;
use crate::models::token::ApiToken;
```

### 模式 B：Re-export 导出（复杂模块）

当模块有多个子模块且希望隐藏内部结构时，用 `pub use`：

```rust
// chat/mod.rs
mod daemon_client;
mod manager;

pub use manager::ChatManager;  // 外部可直接 use crate::chat::ChatManager
```

外部导入：
```rust
use crate::chat::ChatManager;  // 无需知道 manager 子模块
```

---

## 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 模块文件 | snake_case | `permission_watcher.rs`, `daemon_client.rs` |
| 结构体/枚举 | PascalCase | `ChatManager`, `SdkStatus` |
| 函数/方法 | snake_case | `write_ask_user_question_response`, `permission_dir` |
| 常量 | SCREAMING_SNAKE_CASE | `SESSION_ID`, `DEFAULT_TIMEOUT` |
| Tauri 命令 | snake_case（前缀 `{domain}_`） | `chat_send`, `permission_respond_ask_user_question` |

---

## 模块拆分时机

### 何时拆成子模块？

- 单文件超过 **500 行** → 按职责拆分（如 `manager.rs` + `protocol.rs`）
- 功能域有多个独立组件 → 每个组件一个文件（如 `daemon_client`、`sdk_installer`、`permission_watcher` 都是 `chat/` 的子模块）
- 类型和实现需要分离 → 类型定义在 `mod.rs` 或独立 `types.rs`，实现在子模块

### 何时保持单文件？

- 少于 200 行且职责单一 → 不拆分
- 工具函数集合 → 放在 `utils.rs` 或对应域的 `resources.rs`

---

## 实例：chat 模块

`chat/` 模块展示了完整的拆分和导出模式：

```rust
// chat/mod.rs
mod daemon_client;        // 内部：Node daemon IPC 封装
mod manager;              // 公开：高层编排器
mod protocol;             // 内部：协议解析
mod resources;            // 部分公开：路径解析辅助函数
mod sdk_installer;        // 部分公开：SdkStatus 枚举
mod permission_watcher;   // 部分公开：写响应文件的函数

pub use manager::ChatManager;
pub use sdk_installer::SdkStatus;
pub use permission_watcher::{
    write_ask_user_question_response,
    write_plan_approval_response,
};
pub use resources::permission_dir;
```

- **ChatManager** 对外暴露，命令层通过它调用所有 chat 功能
- **daemon_client / protocol** 完全私有，实现细节
- **permission_watcher** 的类型定义不导出，只导出写文件的辅助函数（命令层需要）

---

## 常见错误

### 错误 1：过度导出

```rust
// ❌ 导出了不必要的内部类型
pub use daemon_client::DaemonClient;  // 外部不需要直接访问
pub use protocol::OutboundMessage;    // 协议细节不应暴露
```

应该：
```rust
// ✅ 只导出面向外部的接口
pub use manager::ChatManager;  // 外部通过 ChatManager 间接使用 daemon
```

### 错误 2：硬编码路径而非用模块系统

```rust
// ❌ 在 commands 里直接调用子模块的私有函数
use crate::chat::daemon_client::DaemonClient;  // 编译错误：私有模块
```

应该：
```rust
// ✅ 通过公开的 ChatManager 调用
use crate::chat::ChatManager;
let manager = state.manager;  // ChatManager 已在 ChatState 中
```

### 错误 3：循环依赖

如果 `manager` 需要 `protocol`，`protocol` 又需要 `manager` 的类型，拆成独立的 `types.rs`：

```rust
// chat/types.rs
pub struct Request { /* ... */ }

// chat/protocol.rs
use super::types::Request;

// chat/manager.rs
use super::types::Request;
```

---

## 参考

- Rust 官方模块系统指南: https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html
