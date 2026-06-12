# Tauri 命令规范

## 概述

Tauri 命令是前端 React 与 Rust 后端的桥梁。前端通过 `invoke('command_name', { args })` 调用，后端用 `#[tauri::command]` 标注函数。本规范定义命令的签名、注册、参数约定与跨层契约。

**这是跨层契约层** —— 命令签名变更会同时影响前端 `invoke` 调用，必须保持前后端同步。

---

## 1. Scope / Trigger

适用场景（任一即触发本规范的严格执行）：
- 新增/修改 Tauri 命令签名
- 修改命令的请求/响应字段
- 命令的错误返回行为变更

---

## 2. Signatures（命令签名）

### 标准命令签名

```rust
#[tauri::command]
pub fn <command_name>(
    <param>: <Type>,            // 前端传入参数（camelCase → 自动映射）
    state: State<AppState>,     // 可选：访问全局状态/数据库
) -> Result<<ReturnType>, String>  // 错误统一返回 String
```

### 同步命令示例

**实际代码** (`src-tauri/src/commands/provider_commands.rs:8-46`):
```rust
use crate::models::app_type::AppType;
use crate::models::provider::Provider;
use crate::services::provider_service;
use crate::store::AppState;
use tauri::State;

#[tauri::command]
pub fn get_providers(app: String, state: State<AppState>) -> Result<Vec<Provider>, String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::list_providers_from_db(&state.db, app_type)
}

#[tauri::command]
pub fn add_provider(provider: Provider, state: State<AppState>) -> Result<(), String> {
    provider_service::add_provider_to_db(&state.db, provider)
}

#[tauri::command]
pub fn update_provider(
    provider_id: String,
    provider: Provider,
    state: State<AppState>,
) -> Result<(), String> {
    provider_service::update_provider_in_db(&state.db, &provider_id, provider)
}

#[tauri::command]
pub fn delete_provider(provider_id: String, state: State<AppState>) -> Result<(), String> {
    provider_service::delete_provider_from_db(&state.db, &provider_id)
}

#[tauri::command]
pub fn switch_provider(
    app: String,
    provider_id: String,
    state: State<AppState>,
) -> Result<(), String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;
    provider_service::switch_provider_in_db(&state.db, app_type, &provider_id)
}
```

### 异步命令签名

涉及网络/IO 阻塞操作时使用 `async fn`，注意 `State` 生命周期标注变化：

**实际代码** (`src-tauri/src/commands/provider_commands.rs:73-81`):
```rust
#[tauri::command]
pub async fn check_provider_health(
    provider_id: String,
    state: State<'_, AppState>,  // 异步命令需显式生命周期 '_
) -> Result<stream_check_service::ProviderHealthResult, String> {
    stream_check_service::check_provider_health(provider_id, &state.db)
        .await
        .map_err(|e| e.to_string())
}
```

> **Gotcha**: 异步命令的 `State` 必须写成 `State<'_, AppState>`（带生命周期），同步命令写 `State<AppState>` 即可。

---

## 3. Contracts（契约）

### 请求参数契约

| 规则 | 说明 |
|------|------|
| 参数名 | Rust 用 `snake_case`，前端 `invoke` 传 `camelCase`，Tauri 自动转换 |
| 参数类型 | 基础类型（`String`, `bool`, `u32`）或实现 `Deserialize` 的模型 |
| 多参数 | 前端以对象传递：`invoke('cmd', { providerId, provider })` |

**前后端对应**:
```rust
// Rust 端
#[tauri::command]
pub fn update_provider(provider_id: String, provider: Provider, state: State<AppState>)
```
```typescript
// 前端调用（参数名 camelCase）
await invoke('update_provider', { providerId: id, provider });
```

> **Gotcha**: Rust 端 `provider_id`（snake_case）对应前端 `providerId`（camelCase）。Tauri 自动转换，但前端必须用 camelCase，否则参数为 `undefined`。

### 响应契约

| 返回类型 | 说明 |
|---------|------|
| `Result<T, String>` | **强制**：所有命令返回此类型，`T` 实现 `Serialize` |
| `Ok(T)` | 序列化为 JSON 返回前端 |
| `Err(String)` | 前端 `invoke` 的 Promise reject，错误信息为该字符串 |

### 环境/状态契约

| 依赖 | 获取方式 |
|------|---------|
| 数据库 | `state: State<AppState>` → `&state.db` |
| 全局状态 | `state.db` 是 `Arc<Database>` |

---

## 4. Validation & Error Matrix（校验与错误矩阵）

| 条件 | 处理 | 返回 |
|------|------|------|
| `app` 字符串无法解析为 `AppType` | `app.parse().map_err(...)` | `Err("Unknown app type: xxx")` |
| Provider id 不存在 | service 层检查 | `Err("Provider xxx not found")` |
| 数据库锁失败 | `lock_conn!` 宏 | `Err("Mutex lock failed: ...")` |
| 网络请求失败（异步） | `.map_err(|e| e.to_string())` | `Err(<reqwest 错误信息>)` |
| 业务成功 | — | `Ok(T)` |

### 参数解析校验模式

```rust
// 字符串枚举解析（标准模式）
let app_type: AppType = app.parse().map_err(|e: String| e)?;
```

`AppType::from_str` 的实现 (`src-tauri/src/models/app_type.rs:72-84`)：
```rust
impl FromStr for AppType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "claude" => Ok(AppType::Claude),
            "codex" => Ok(AppType::Codex),
            // ...
            _ => Err(format!("Unknown app type: {}", s)),
        }
    }
}
```

---

## 5. Good / Base / Bad Cases

### Good（理想：薄命令 + 完整委托）
```rust
#[tauri::command]
pub fn switch_provider(
    app: String,
    provider_id: String,
    state: State<AppState>,
) -> Result<(), String> {
    let app_type: AppType = app.parse().map_err(|e: String| e)?;  // 校验
    provider_service::switch_provider_in_db(&state.db, app_type, &provider_id)  // 委托
}
```

### Base（可接受：无参数命令）
```rust
#[tauri::command]
pub fn get_all_providers(state: State<AppState>) -> Result<Vec<Provider>, String> {
    provider_service::list_all_providers_from_db(&state.db)
}
```

### Bad（禁止：命令内堆业务逻辑）
```rust
#[tauri::command]
pub fn switch_provider(app: String, id: String, state: State<AppState>) -> Result<(), String> {
    // ❌ 命令层不应有这些逻辑
    let conn = state.db.conn.lock().unwrap();
    conn.execute("UPDATE providers SET is_active = 0", []).unwrap();
    conn.execute("UPDATE providers SET is_active = 1 WHERE id = ?", [&id]).unwrap();
    // ... 写文件、调 API
    Ok(())
}
```

---

## 6. Tests Required（必需测试）

| 测试类型 | 断言点 |
|---------|--------|
| 单元测试（service 层） | 切换 Provider 后 `is_active` 正确翻转；旧 active 被置 false |
| 单元测试（参数解析） | `"claude".parse::<AppType>()` == `Ok(AppType::Claude)`；非法字符串返回 `Err` |
| 错误路径 | 不存在的 provider_id 返回 `Err`，错误信息含 id |

测试运行：
```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

> 命令函数本身（`#[tauri::command]`）通常不直接单测，而是测试其委托的 service 函数。

---

## 7. Wrong vs Correct

### Wrong：忘记注册命令
```rust
// commands/provider_commands.rs 写了新命令
#[tauri::command]
pub fn clone_provider(provider_id: String, state: State<AppState>) -> Result<(), String> {
    provider_service::clone_provider(&state.db, &provider_id)
}
// ❌ 但 lib.rs 的 generate_handler! 没加 clone_provider
// 结果：前端 invoke('clone_provider') 报 "command clone_provider not found"
```

### Correct：命令注册到 generate_handler!
```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    get_providers,
    add_provider,
    update_provider,
    delete_provider,
    switch_provider,
    clone_provider,   // ✅ 新命令必须在此注册
])
```

---

## 命令注册流程（关键）

### 完整步骤

1. **在 `commands/<domain>_commands.rs` 写命令函数**
   ```rust
   #[tauri::command]
   pub fn my_command(state: State<AppState>) -> Result<T, String> { ... }
   ```

2. **确保命令在 `commands/mod.rs` 中可见**（模块已声明）

3. **在 `lib.rs` 的 `generate_handler!` 注册**
   ```rust
   .invoke_handler(tauri::generate_handler![
       my_command,  // 添加这一行
   ])
   ```

4. **重启 `tauri dev`**（Rust 改动不热重载）

5. **前端调用**
   ```typescript
   const result = await invoke<T>('my_command');
   ```

---

## 命令参数命名约定

### snake_case ↔ camelCase 映射表

| Rust 参数 | 前端 invoke 参数 |
|-----------|-----------------|
| `provider_id` | `providerId` |
| `target_index` | `targetIndex` |
| `base_url` | `baseUrl` |
| `app` | `app` |

---

## 命令分组约定

按领域将命令分到不同文件，文件名 `<domain>_commands.rs`：

| 文件 | 命令示例 |
|------|---------|
| `provider_commands.rs` | `get_providers`, `add_provider`, `switch_provider` |
| `mcp_commands.rs` | `list_mcp_servers`, `add_mcp_server` |
| `prompt_commands.rs` | `list_prompts`, `save_prompt` |
| `proxy_commands.rs` | 代理配置相关 |
| `utility_commands.rs` | `get_config`, `save_config` 等通用命令 |

---

## 常见错误

### Common Mistake: 前端参数用了 snake_case

**Symptom**: 命令调用后 Rust 端参数为 `None` 或默认值，业务逻辑异常。

**Cause**: 前端 `invoke` 传了 snake_case，但 Tauri 期望 camelCase。

**Fix**:
```typescript
// ❌ 错误
await invoke('update_provider', { provider_id: id });

// ✅ 正确
await invoke('update_provider', { providerId: id });
```

**Prevention**: Rust 参数 `provider_id` → 前端必须传 `providerId`。

---

### Common Mistake: 异步命令缺少生命周期标注

**Symptom**: 编译错误 `lifetime may not live long enough`。

**Cause**: 异步命令的 `State` 需要显式生命周期。

**Fix**:
```rust
// ❌ 错误
pub async fn cmd(state: State<AppState>) -> Result<T, String>

// ✅ 正确
pub async fn cmd(state: State<'_, AppState>) -> Result<T, String>
```

---

## 参考

- 命令实现: `src-tauri/src/commands/provider_commands.rs`
- 命令注册: `src-tauri/src/lib.rs:761`
- 全局状态: `src-tauri/src/store.rs`
- 服务层规范: [service-guidelines.md](./service-guidelines.md)
- 错误处理: [error-handling.md](./error-handling.md)
