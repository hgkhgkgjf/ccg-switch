# 后端目录结构规范

## 概述

本项目后端使用 Rust (edition 2021) + Tauri 2，代码位于 `src-tauri/src/`，采用三层架构（命令 → 服务 → 数据库）组织。

---

## 顶层目录结构

```
src-tauri/src/
├── main.rs                   # 二进制入口（调用 lib.rs 的 run()）
├── lib.rs                    # Tauri 应用配置 + 命令注册入口
├── store.rs                  # 全局状态 AppState
├── error.rs                  # 统一错误类型 AppError
├── tray.rs                   # 系统托盘
├── commands/                 # Tauri 命令层（薄）
├── services/                 # 业务逻辑层（厚）
├── models/                   # 数据模型（serde 序列化）
├── database/                 # 数据库层（SQLite）
│   ├── mod.rs               # Database 结构 + 初始化
│   ├── schema.rs            # 建表 SQL
│   ├── backup.rs            # 数据库备份
│   └── dao/                 # 数据访问对象（按领域分文件）
├── proxy/                    # 代理服务器模块
├── mcp/                      # MCP 服务器配置
├── deeplink/                 # Deep Link 处理
├── session_manager/          # 会话管理
└── utils/                    # 工具函数
```

---

## 分层职责

### 1. `commands/` — Tauri 命令层

**职责**: 暴露给前端调用的接口，保持薄。

**命名规范**: `<domain>_commands.rs`

**职责边界**:
- 解析前端传入的参数（如 `String` → `AppType`）
- 调用对应的 `service` 函数
- 将 `AppError` 转换为 `String` 返回前端

**实际文件**:
```
src-tauri/src/commands/
├── mod.rs                    # 模块声明
├── provider_commands.rs      # Provider CRUD + 切换
├── mcp_commands.rs          # MCP 服务器
├── prompt_commands.rs       # Prompt 预设
├── skill_commands.rs        # 技能管理
├── proxy_commands.rs        # 代理配置
├── backup_commands.rs       # 备份
├── deeplink_commands.rs     # Deep Link
├── session_commands.rs      # 会话
├── advanced_commands.rs     # 高级功能
└── utility_commands.rs      # 通用工具
```

**实际示例** (`src-tauri/src/commands/provider_commands.rs:8-12`):
```rust
#[tauri::command]
pub fn get_providers(app: String, state: State<AppState>) -> Result<Vec<Provider>, String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::list_providers_from_db(&state.db, app_type)
}
```

---

### 2. `services/` — 业务逻辑层

**职责**: 核心业务逻辑，可被多个命令复用。

**命名规范**: `<domain>_service.rs`

**职责边界**:
- 实现具体业务逻辑
- 调用 `database/dao` 读写数据
- 调用外部 API（reqwest）、文件系统
- 返回 `Result<T, AppError>` 或 `Result<T, String>`

**实际文件**（部分）:
```
src-tauri/src/services/
├── mod.rs
├── provider_service.rs       # Provider 业务逻辑
├── config_service.rs         # 应用配置
├── token_service.rs          # Token 管理
├── proxy_service.rs          # 代理逻辑
├── dashboard_service.rs      # 仪表盘统计
├── stats_service.rs          # 统计计算
├── webdav_service.rs         # WebDAV 备份
├── updater_service.rs        # 自动更新
├── migration_service.rs      # 数据迁移
├── model_api_service.rs      # 模型 API 调用
└── storage/                  # 存储工具
    ├── atomic_io.rs         # 原子文件写入
    ├── json_store.rs        # JSON 存储
    ├── jsonl_store.rs       # JSONL 存储
    └── lock_registry.rs     # 文件锁注册表
```

---

### 3. `models/` — 数据模型

**职责**: 贯穿三层的数据结构，负责序列化。

**命名规范**: `<domain>.rs`

**实际文件**:
```
src-tauri/src/models/
├── mod.rs
├── provider.rs               # Provider, ProviderProxyConfig
├── token.rs                  # ApiToken
├── app_type.rs               # AppType 枚举
├── config.rs                 # 应用配置
├── mcp.rs                    # MCP 服务器
├── prompt.rs                 # Prompt 预设
├── skill.rs                  # 技能
├── subagent.rs               # 子代理
├── proxy.rs                  # 代理配置
└── usage.rs                  # 用量统计
```

---

### 4. `database/` — 数据库层

**职责**: SQLite 数据持久化。

**结构**:
```
src-tauri/src/database/
├── mod.rs                    # Database 结构 + lock_conn! 宏 + 初始化
├── schema.rs                 # CREATE TABLE 语句
├── backup.rs                 # 备份/恢复
└── dao/                      # 数据访问对象
    ├── mod.rs
    ├── providers.rs         # Provider 表读写
    ├── mcp.rs               # MCP 表
    ├── prompts.rs           # Prompt 表
    ├── skills.rs            # Skill 表
    ├── app_configs.rs       # 配置表
    ├── proxy_config.rs      # 代理配置表
    ├── global_proxies.rs    # 全局代理表
    ├── provider_health.rs   # 健康检查表
    └── failover_queue.rs    # 故障转移队列表
```

**DAO 实现模式**: 在 `dao/<domain>.rs` 中通过 `impl Database` 扩展方法。

**实际示例** (`src-tauri/src/database/dao/providers.rs:10-12`):
```rust
impl Database {
    /// 获取所有 Provider
    pub fn list_providers(&self) -> Result<Vec<Provider>, String> {
        // ...
    }
}
```

---

## 入口文件职责

### main.rs

**职责**: 二进制入口，调用 `lib.rs` 的 `run()`。

---

### lib.rs

**职责**:
1. 配置 Tauri Builder
2. 初始化数据库并注册到 `AppState`
3. 在 `generate_handler!` 中注册所有命令

**实际示例** (`src-tauri/src/lib.rs:761, 902-903`):
```rust
tauri::Builder::default()
    // ...
    .invoke_handler(tauri::generate_handler![
        get_providers,
        add_provider,
        // ... 所有命令
    ])
    .setup(|app| {
        let state = store::AppState::new(db_arc);
        app.manage(state);
        Ok(())
    })
```

---

### store.rs

**职责**: 定义全局状态。

**完整代码** (`src-tauri/src/store.rs`):
```rust
use crate::database::Database;
use std::sync::Arc;

pub struct AppState {
    pub db: Arc<Database>,
}

impl AppState {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}
```

---

## 模块声明约定

### mod.rs 模式

每个目录通过 `mod.rs` 声明子模块：

```rust
// commands/mod.rs
pub mod provider_commands;
pub mod mcp_commands;
// ...
```

---

## 何时新建模块

| 场景 | 操作 |
|------|------|
| 新增功能领域（如 "webhook"） | 创建 `models/webhook.rs` + `services/webhook_service.rs` + `commands/webhook_commands.rs` |
| 新增数据表 | 在 `database/schema.rs` 加建表语句 + 创建 `database/dao/webhook.rs` |
| 通用工具函数 | 放入 `utils/` |
| 跨领域复杂模块（如代理） | 创建独立目录 `proxy/` 并细分子模块 |

---

## 常见错误

### ❌ 错误：业务逻辑写在命令层
```rust
#[tauri::command]
pub fn get_providers(app: String, state: State<AppState>) -> Result<Vec<Provider>, String> {
    // ❌ 直接在命令里写 SQL 和过滤逻辑
    let conn = state.db.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT ...").unwrap();
    // ... 大量逻辑
}
```

### ✅ 正确：命令薄，逻辑在 service
```rust
#[tauri::command]
pub fn get_providers(app: String, state: State<AppState>) -> Result<Vec<Provider>, String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::list_providers_from_db(&state.db, app_type)  // ✅ 委托
}
```

---

### ❌ 错误：DAO 逻辑散落在 service
```rust
// service 里直接写 SQL
pub fn list_providers_from_db(db: &Arc<Database>) -> Result<Vec<Provider>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT ...");  // ❌ SQL 应在 dao
}
```

### ✅ 正确：SQL 在 dao，service 调用
```rust
pub fn list_providers_from_db(db: &Arc<Database>, app: AppType) -> Result<Vec<Provider>, String> {
    let all = db.list_providers()?;  // ✅ 调用 dao 方法
    Ok(all.into_iter().filter(|p| p.app_type == app).collect())
}
```

---

## 参考

- 三层架构: 见 `index.md`
- 命令注册: `src-tauri/src/lib.rs`
- 完整技术栈: `CLAUDE.md` 第 4-18 行
- 项目约定: `AGENTS.md` 第 24-30 行
