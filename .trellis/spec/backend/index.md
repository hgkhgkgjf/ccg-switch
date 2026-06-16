# 后端开发规范（Rust + Tauri 2）

> CC Switch 的 Rust 后端编码标准和架构模式

---

## 概述

CC Switch 后端基于 **Tauri 2** + **Rust 2021**，负责：
- 系统配置读写（JSON 文件）
- 数据库管理（rusqlite）
- 跨平台路径处理
- 外部进程管理（Node.js daemon）
- 文件 IPC（权限审批）
- Tauri 命令暴露给前端

---

## 规范文档

| 文档 | 内容 |
|------|------|
| [模块组织](./module-organization.md) | 模块拆分、可见性、导出规范 |
| [Tauri 命令规范](./tauri-commands.md) | 命令签名、错误处理、状态管理 |
| [异步模式](./async-patterns.md) | tokio 使用、进程管理、文件 I/O |
| [错误处理](./error-handling.md) | Result 传播、错误字符串化、日志 |
| [跨层协议](./cross-layer-protocol.md) | Tauri 事件、文件 IPC、命令参数 serde |

---

## 核心原则

1. **命令层薄、业务层厚** — Tauri 命令只做参数解析和错误映射，业务逻辑在 manager/service 层
2. **错误统一字符串化** — 所有 `Result<T, String>` 返回给前端，用 `map_err(|e| format!("..."))`
3. **进程生命周期显式管理** — daemon/子进程通过 `OnceCell` 懒启动，`shutdown` 时显式终止
4. **文件路径跨平台** — 用 Tauri `PathResolver` 获取标准目录，`join` 拼接，避免硬编码分隔符
5. **serde rename 对齐前端** — 字段用 `#[serde(rename = "camelCase")]` 保持前端 camelCase 命名

---

## 快速参考

### 新增 Tauri 命令模板

```rust
// src/commands/xxx_commands.rs
use tauri::State;

#[tauri::command]
pub async fn do_something(
    param: String,
    state: State<'_, MyState>,
) -> Result<ReturnType, String> {
    state.manager.do_something(param)
        .await
        .map_err(|e| format!("操作失败: {e}"))
}
```

注册到 `lib.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    // ...
    xxx_commands::do_something,
])
```

### 新增模块模板

```rust
// src/my_module/mod.rs
mod sub_module;

pub use sub_module::PublicType;

// 内部辅助函数私有
fn internal_helper() -> Result<(), String> {
    // ...
}
```

---

## 参考

- [Tauri 2 官方文档](https://v2.tauri.app/)
- [tokio 文档](https://tokio.rs/)
- [serde 文档](https://serde.rs/)
