# 错误处理规范

## 概述

本项目使用 **thiserror** 定义统一错误类型 `AppError`，并约定错误在三层间的传播与转换规则。核心契约：**命令层向前端返回 `Result<T, String>`，内部层使用结构化的 `AppError`**。

---

## 统一错误类型 AppError

### 完整定义

**实际代码** (`src-tauri/src/error.rs:6-61`):
```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("配置错误: {0}")]
    Config(String),
    #[error("无效输入: {0}")]
    InvalidInput(String),
    #[error("IO 错误: {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("{context}: {source}")]
    IoContext {
        context: String,
        #[source]
        source: std::io::Error,
    },
    #[error("JSON 解析错误: {path}: {source}")]
    Json {
        path: String,
        #[source]
        source: serde_json::Error,
    },
    #[error("TOML 解析错误: {path}: {source}")]
    Toml { path: String, #[source] source: toml::de::Error },
    #[error("锁获取失败: {0}")]
    Lock(String),
    #[error("MCP 校验失败: {0}")]
    McpValidation(String),
    #[error("{0}")]
    Message(String),
    #[error("{zh} ({en})")]
    Localized { key: &'static str, zh: String, en: String },
    #[error("数据库错误: {0}")]
    Database(String),
    #[error("OMO 配置文件不存在")]
    OmoConfigNotFound,
    #[error("所有供应商已熔断，无可用渠道")]
    AllProvidersCircuitOpen,
    #[error("未配置供应商")]
    NoProvidersConfigured,
}
```

> **Convention**: 错误信息用中文（面向中文用户），`#[error("...")]` 内嵌字段插值。`Localized` 变体支持中英双语。

---

## 错误构造辅助函数

### 带上下文的构造器

**实际代码** (`src-tauri/src/error.rs:63-92`):
```rust
impl AppError {
    pub fn io(path: impl AsRef<Path>, source: std::io::Error) -> Self {
        Self::Io {
            path: path.as_ref().display().to_string(),
            source,
        }
    }

    pub fn json(path: impl AsRef<Path>, source: serde_json::Error) -> Self {
        Self::Json { path: path.as_ref().display().to_string(), source }
    }

    pub fn localized(key: &'static str, zh: impl Into<String>, en: impl Into<String>) -> Self {
        Self::Localized { key, zh: zh.into(), en: en.into() }
    }
}
```

**使用**:
```rust
let content = std::fs::read_to_string(&path)
    .map_err(|e| AppError::io(&path, e))?;  // 附带路径上下文
```

---

## 错误转换链

### From 实现（自动转换）

**实际代码** (`src-tauri/src/error.rs:94-110`):
```rust
// PoisonError（锁中毒）→ AppError::Lock
impl<T> From<PoisonError<T>> for AppError {
    fn from(err: PoisonError<T>) -> Self {
        Self::Lock(err.to_string())
    }
}

// rusqlite::Error → AppError::Database
impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        Self::Database(err.to_string())
    }
}

// AppError → String（命令层返回前端）
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
```

### serde 序列化

**实际代码** (`src-tauri/src/error.rs:112-119`):
```rust
// AppError 可直接序列化为字符串（Tauri 命令返回）
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
```

---

## 分层错误约定

### 各层返回类型

| 层 | 返回类型 | 原因 |
|----|---------|------|
| 命令层 `commands/` | `Result<T, String>` | 前端 invoke 接收字符串错误 |
| 服务层 `services/` | `Result<T, AppError>` 或 `Result<T, String>` | 结构化错误便于处理；直接给命令用时可用 String |
| 数据库层 `dao/` | `Result<T, String>` | 错误信息字符串化 |
| 文件 IO 辅助 | `Result<T, io::Error>` | 保留原始 IO 错误 |

### 转换流向

```
io::Error / rusqlite::Error / serde_json::Error
        │ (From / map_err)
        ▼
    AppError  ←── 服务层结构化错误
        │ (.to_string() / From<AppError> for String)
        ▼
     String   ←── 命令层返回前端
        │ (invoke Promise reject)
        ▼
   前端 catch(error) { String(error) }
```

---

## 错误传播模式

### service 层：构造带上下文的错误

```rust
pub fn read_config(path: &Path) -> Result<Config, AppError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| AppError::io(path, e))?;          // io::Error → AppError::Io
    let config: Config = serde_json::from_str(&content)
        .map_err(|e| AppError::json(path, e))?;        // serde_json::Error → AppError::Json
    Ok(config)
}
```

### 命令层：转换为 String

```rust
#[tauri::command]
pub fn get_config(state: State<AppState>) -> Result<Config, String> {
    config_service::read_config(&path)
        .map_err(|e| e.to_string())  // AppError → String
}
```

### 命令层简洁写法（service 已返回 String）

```rust
#[tauri::command]
pub fn get_all_providers(state: State<AppState>) -> Result<Vec<Provider>, String> {
    provider_service::list_all_providers_from_db(&state.db)  // 已是 Result<_, String>
}
```

---

## 前端结构化错误

### format_skill_error（JSON 错误）

需要前端解析结构化错误时，返回 JSON 字符串：

**实际代码** (`src-tauri/src/error.rs:121-145`):
```rust
/// 格式化为 JSON 错误字符串，前端可解析为结构化错误
pub fn format_skill_error(
    code: &str,
    context: &[(&str, &str)],
    suggestion: Option<&str>,
) -> String {
    use serde_json::json;

    let mut ctx_map = serde_json::Map::new();
    for (key, value) in context {
        ctx_map.insert(key.to_string(), json!(value));
    }

    let error_obj = json!({
        "code": code,
        "context": ctx_map,
        "suggestion": suggestion,
    });

    serde_json::to_string(&error_obj).unwrap_or_else(|_| format!("ERROR:{code}"))
}
```

前端可 `JSON.parse` 该错误获取 `code` / `context` / `suggestion`。

---

## 错误处理原则

### 1. 不要 unwrap/expect（生产代码）

```rust
// ❌ 禁止：panic 会让整个命令崩溃
let conn = self.conn.lock().unwrap();

// ✅ 正确：用 lock_conn! 宏转换为 Result
let conn = lock_conn!(self.conn);
```

> **例外**: 测试代码、`Default` 不可能失败的场景、`from_timestamp(0,0)` 等已知安全调用可用 `unwrap_or_default`。

---

### 2. 附带上下文

```rust
// ❌ 信息不足
std::fs::read_to_string(&path)?;  // 错误：No such file

// ✅ 附带路径
std::fs::read_to_string(&path).map_err(|e| AppError::io(&path, e))?;
// 错误：IO 错误: /home/user/.claude/settings.json: No such file
```

---

### 3. 非关键路径降级

DAO 层对非关键字段降级（见 [database-guidelines.md](./database-guidelines.md)）：
```rust
custom_params: custom_params_str.and_then(|s| serde_json::from_str(&s).ok()),  // 失败→None
```

---

## 常见错误

### ❌ 错误：命令层返回 AppError
```rust
#[tauri::command]
pub fn get_config() -> Result<Config, AppError> {  // ❌ 前端不便处理
    config_service::read_config(&path)
}
```

### ✅ 正确：命令层返回 String
```rust
#[tauri::command]
pub fn get_config() -> Result<Config, String> {  // ✅
    config_service::read_config(&path).map_err(|e| e.to_string())
}
```

---

### ❌ 错误：用 unwrap 处理锁
```rust
let conn = self.conn.lock().unwrap();  // ❌ 锁中毒会 panic
```

### ✅ 正确：用 lock_conn! 宏
```rust
let conn = lock_conn!(self.conn);  // ✅ 返回 Err
```

---

### ❌ 错误：丢失错误上下文
```rust
let content = std::fs::read_to_string(&path)
    .map_err(|_| "读取失败".to_string())?;  // ❌ 不知道哪个文件、什么原因
```

### ✅ 正确：保留来源和路径
```rust
let content = std::fs::read_to_string(&path)
    .map_err(|e| AppError::io(&path, e))?;  // ✅ 含路径 + 原始错误
```

---

## 参考

- 错误类型: `src-tauri/src/error.rs`
- 连接锁宏: `src-tauri/src/database/mod.rs:13-20`
- 命令层规范: [command-guidelines.md](./command-guidelines.md)
- 服务层规范: [service-guidelines.md](./service-guidelines.md)
- thiserror 文档: https://docs.rs/thiserror
