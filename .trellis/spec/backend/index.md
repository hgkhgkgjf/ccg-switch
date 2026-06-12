# 后端开发规范

> CC Switch 项目 Rust + Tauri 2 后端开发规范。

---

## 概述

本目录包含后端开发的所有规范文档，涵盖目录结构、Tauri 命令、服务层、数据模型、数据库 DAO 和错误处理。

**技术栈**: Rust (edition 2021) + Tauri 2 + rusqlite (SQLite) + serde/serde_json + reqwest 0.12 + chrono 0.4 + thiserror

---

## 规范索引

| 规范文档 | 描述 | 状态 |
|---------|------|------|
| [目录结构规范](./directory-structure.md) | 模块组织、分层职责 | ✅ 已完成 |
| [Tauri 命令规范](./command-guidelines.md) | 命令签名、注册、参数约定 | ✅ 已完成 |
| [服务层规范](./service-guidelines.md) | 业务逻辑层、命名、依赖注入 | ✅ 已完成 |
| [数据模型规范](./model-guidelines.md) | serde 序列化、camelCase 映射 | ✅ 已完成 |
| [数据库 DAO 规范](./database-guidelines.md) | SQLite、连接锁、行映射 | ✅ 已完成 |
| [错误处理规范](./error-handling.md) | AppError、Result、错误传播 | ✅ 已完成 |

---

## 三层架构

本项目后端采用清晰的三层架构：

```
┌─────────────────────────────────────────────┐
│  commands/   Tauri 命令层（薄）               │
│  - #[tauri::command] 标注                     │
│  - 参数解析、调用 service、错误转 String       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  services/   业务逻辑层（厚）                  │
│  - 核心业务逻辑                                │
│  - 调用 database / 外部 API / 文件系统         │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  database/dao/  数据访问层                     │
│  - SQLite 读写（rusqlite）                     │
│  - 行 ↔ 模型映射                               │
└───────────────────────────────────────────────┘

models/   贯穿三层的数据结构（serde 序列化）
error.rs  统一错误类型 AppError
store.rs  Tauri 全局状态 AppState
```

**核心原则**: 命令层保持薄，业务逻辑放在 `services/`（见 `AGENTS.md` 第 29 行）。

---

## 快速参考

### 命名约定

| 类型 | 命名模式 | 示例 |
|------|---------|------|
| 命令文件 | `*_commands.rs` | `provider_commands.rs` |
| 服务文件 | `*_service.rs` | `provider_service.rs` |
| 模型文件 | `<domain>.rs` | `provider.rs` |
| DAO 文件 | `<domain>.rs` (在 `dao/`) | `dao/providers.rs` |
| Rust 标识符 | `snake_case` | `default_sonnet_model` |
| JSON 字段 | `camelCase` (via serde rename) | `defaultSonnetModel` |
| 类型/枚举 | `PascalCase` | `Provider`, `AppType` |

---

### Tauri 命令模板

```rust
#[tauri::command]
pub fn get_providers(app: String, state: State<AppState>) -> Result<Vec<Provider>, String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::list_providers_from_db(&state.db, app_type)
}
```

要点：
- 返回 `Result<T, String>`（错误转字符串供前端）
- 通过 `state: State<AppState>` 访问数据库
- 命令保持薄，逻辑委托给 service
- 必须在 `lib.rs` 的 `generate_handler!` 中注册

---

### 数据模型模板

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    #[serde(rename = "appType")]
    pub app_type: AppType,        // Rust snake_case ↔ JSON camelCase
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub url: Option<String>,      // 可选字段用 Option
    #[serde(rename = "isActive")]
    pub is_active: bool,
}
```

---

### 错误处理模板

```rust
// service 内部使用 AppError
pub fn do_work() -> Result<(), AppError> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::io(&path, e))?;
    Ok(())
}

// 命令层转 String
#[tauri::command]
pub fn cmd() -> Result<(), String> {
    do_work().map_err(|e| e.to_string())
}
```

---

## 开发流程

### 构建与验证

```bash
# 快速编译检查
cargo check --manifest-path src-tauri/Cargo.toml

# 运行测试
cargo test --manifest-path src-tauri/Cargo.toml

# 完整应用
npm run tauri dev
```

---

### 提交前检查清单

- [ ] `cargo check` 通过
- [ ] 新命令已在 `lib.rs` 的 `generate_handler!` 注册
- [ ] 新模型字段有正确的 `#[serde(rename)]` camelCase 映射
- [ ] 前端 `src/types/*.ts` 同步更新
- [ ] 错误返回类型符合层级约定（service 用 `AppError`，命令用 `String`）
- [ ] 修改 Rust 代码后重启 `tauri dev`（前端 HMR 不重载 Rust）

---

## 重要提示

> **修改 Rust 代码后需重启 `tauri dev`**，前端 HMR 不会重新加载 Rust 后端（见 `CLAUDE.md` 第 143 行）。

> **新增 Tauri 命令必须在 `lib.rs` 的 `generate_handler!` 宏中注册**，否则前端 `invoke` 会报 "command not found"。

---

## 代码示例索引

| 模式 | 参考文件 |
|------|---------|
| Tauri 命令 | `src-tauri/src/commands/provider_commands.rs` |
| 服务层 | `src-tauri/src/services/provider_service.rs` |
| 数据模型 | `src-tauri/src/models/provider.rs` |
| 枚举模型 | `src-tauri/src/models/app_type.rs` |
| DAO 读写 | `src-tauri/src/database/dao/providers.rs` |
| 数据库初始化 | `src-tauri/src/database/mod.rs` |
| 错误类型 | `src-tauri/src/error.rs` |
| 全局状态 | `src-tauri/src/store.rs` |
| 原子文件写 | `src-tauri/src/services/storage/atomic_io.rs` |

---

## 参考文档

- **完整技术栈**: `CLAUDE.md` 第 4-18 行
- **项目约定**: `AGENTS.md`
- **数据模型**: `CLAUDE.md` 第 97-121 行
- **数据路径**: `CLAUDE.md` 第 86-95 行

---

**语言**: 本项目规范使用中文编写，与团队沟通语言保持一致。
