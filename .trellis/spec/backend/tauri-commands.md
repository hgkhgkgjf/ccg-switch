# Tauri 命令规范

> 命令签名、错误处理、状态管理

---

## 概述

Tauri 命令是前端通过 `invoke()` 调用的 Rust 函数。命令层是**薄层**：只做参数解析、调用业务层（manager/service）、映射错误为字符串。业务逻辑不应直接写在命令函数里。

---

## 命令签名模板

### 基础命令（无状态）

```rust
#[tauri::command]
pub fn get_config_path() -> Result<String, String> {
    config_service::get_path()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("获取配置路径失败: {e}"))
}
```

### 带参数命令

```rust
#[tauri::command]
pub async fn save_provider(
    data: Provider,  // 自动 serde 反序列化
) -> Result<(), String> {
    provider_service::save(data)
        .await
        .map_err(|e| format!("保存失败: {e}"))
}
```

### 使用 Tauri 状态

```rust
pub struct ChatState {
    pub manager: ChatManager,
}

#[tauri::command]
pub async fn chat_send(
    provider: String,
    command: String,
    params: Value,
    state: State<'_, ChatState>,  // 注入状态
) -> Result<String, String> {
    let method = format!("{provider}.{command}");
    state.manager.send(method, params).await
}
```

---

## 命令命名规范

### 模式：`{domain}_{verb}[_{object}]`

| 命令名 | 含义 | 对应前端调用 |
|--------|------|-------------|
| `chat_send` | Chat 域：发送消息 | `invoke('chat_send', {...})` |
| `chat_abort` | Chat 域：中止当前请求 | `invoke('chat_abort')` |
| `permission_respond_ask_user_question` | Permission 域：响应问答请求 | `invoke('permission_respond_ask_user_question', {...})` |
| `get_all_providers` | 获取所有 Provider | `invoke('get_all_providers')` |
| `save_config` | 保存配置 | `invoke('save_config', {...})` |

**原则**：
- 域前缀（`chat_`、`permission_`）用于命名空间隔离
- 动词优先（`send`、`abort`、`respond`）
- 对象后置（`_ask_user_question`）
- 避免缩写（用 `provider` 不用 `pvd`）

---

## 参数类型

### 简单类型

```rust
#[tauri::command]
pub fn delete_provider(id: String) -> Result<(), String> {
    // ...
}
```

前端调用：
```ts
await invoke('delete_provider', { id: 'provider-123' });
```

### 结构体（自动反序列化）

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProviderDto {
    pub name: String,
    pub api_key: String,  // 前端传 apiKey，serde 映射到 api_key
    pub url: Option<String>,
}

#[tauri::command]
pub async fn add_provider(data: CreateProviderDto) -> Result<(), String> {
    // ...
}
```

前端调用：
```ts
await invoke('add_provider', {
    data: { name: 'My Provider', apiKey: 'sk-...', url: null }
});
```

### JSON 任意结构（`serde_json::Value`）

```rust
use serde_json::Value;

#[tauri::command]
pub async fn chat_send(
    provider: String,
    command: String,
    params: Value,  // 任意 JSON
) -> Result<String, String> {
    // params 可能是 { message: "...", model: "...", ... }
}
```

### HashMap

```rust
use std::collections::HashMap;

#[tauri::command]
pub async fn permission_respond_ask_user_question(
    request_id: String,
    answers: HashMap<String, String>,  // { "问题1": "答案1", ... }
) -> Result<(), String> {
    // ...
}
```

---

## 返回类型

### 成功无返回值

```rust
#[tauri::command]
pub async fn delete_provider(id: String) -> Result<(), String> {
    provider_service::delete(&id).await?;
    Ok(())
}
```

### 返回数据

```rust
#[tauri::command]
pub fn get_all_providers() -> Result<Vec<Provider>, String> {
    provider_service::list()
        .map_err(|e| format!("加载失败: {e}"))
}
```

返回的类型必须实现 `Serialize`。

### 返回 ID（立即返回，异步处理）

```rust
#[tauri::command]
pub async fn chat_send(...) -> Result<String, String> {
    let request_id = manager.send(...).await?;
    Ok(request_id)  // 立即返回 ID，结果通过 Tauri 事件流式推送
}
```

---

## 错误处理

### 标准模式：`Result<T, String>`

所有命令返回 `Result<T, String>`，错误信息字符串化后传给前端：

```rust
#[tauri::command]
pub async fn save_config(config: Config) -> Result<(), String> {
    config_service::save(config)
        .await
        .map_err(|e| format!("保存配置失败: {e}"))
}
```

**不要**：
```rust
// ❌ 返回自定义错误类型（前端无法反序列化）
pub async fn save_config(...) -> Result<(), MyError> { ... }

// ❌ panic!（会导致整个应用崩溃）
pub async fn save_config(...) -> Result<(), String> {
    panic!("配置无效");  // 错误！
}
```

### 错误字符串化规范

```rust
.map_err(|e| format!("操作描述: {e}"))
```

- 中文描述 + 原始错误
- 描述应该是用户能理解的动作（"保存配置失败"、"启动 daemon 失败"）
- 不要暴露敏感路径或内部实现细节

### 多层错误传播

```rust
async fn inner_operation() -> Result<Data, String> {
    let data = fetch_data().map_err(|e| format!("获取数据失败: {e}"))?;
    let processed = process(data).map_err(|e| format!("处理数据失败: {e}"))?;
    Ok(processed)
}

#[tauri::command]
pub async fn do_operation() -> Result<Data, String> {
    inner_operation().await  // 错误已经格式化，直接传播
}
```

---

## 状态管理

### 注册全局状态

在 `lib.rs` 的 `setup` 钩子里注册：

```rust
.setup(|app| {
    let chat_manager = ChatManager::new(app.handle().clone());
    app.manage(ChatState { manager: chat_manager });
    Ok(())
})
```

### 命令中使用状态

```rust
#[tauri::command]
pub async fn chat_send(
    provider: String,
    command: String,
    params: Value,
    state: State<'_, ChatState>,  // 自动注入
) -> Result<String, String> {
    state.manager.send(format!("{provider}.{command}"), params).await
}
```

**注意**：
- `State<'_, T>` 是不可变借用，如果需要内部可变性，用 `Arc<Mutex<T>>` 或 `OnceCell`
- 状态生命周期与应用绑定，应用退出时自动清理

---

## 异步命令

### 何时用 `async`？

- 调用 tokio 异步函数（文件 I/O、网络请求、子进程）
- 调用其他异步 Tauri 命令
- 需要等待 Tauri 事件监听器

```rust
#[tauri::command]
pub async fn chat_send(...) -> Result<String, String> {
    let client = state.manager.client().await?;  // 异步懒初始化
    client.send(...).await  // 异步发送
}
```

### 何时用同步？

- 纯计算/数据转换
- 读取内存中的配置
- 快速文件读取（< 10ms）

```rust
#[tauri::command]
pub fn get_config() -> Result<Config, String> {
    config_service::load_sync()
        .map_err(|e| format!("加载配置失败: {e}"))
}
```

---

## 命令注册

在 `lib.rs` 的 `invoke_handler` 注册所有命令：

```rust
.invoke_handler(tauri::generate_handler![
    // Config
    config_commands::get_config,
    config_commands::save_config,
    // Chat
    chat_commands::chat_send,
    chat_commands::chat_abort,
    chat_commands::chat_start_daemon,
    // Permission
    chat_commands::permission_respond_ask_user_question,
    chat_commands::permission_respond_plan_approval,
    // ...
])
```

**顺序**：按功能域分组注释，字母序排列。

---

## 实例：权限响应命令

```rust
/// 响应 AskUserQuestion 权限请求。
///
/// `request_id` 来自 "permission://ask-user-question" 事件，`answers` 是
/// { "问题文本": "用户选择的答案" } 的 map。
#[tauri::command]
pub async fn permission_respond_ask_user_question(
    request_id: String,
    answers: HashMap<String, String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    let perm_dir = crate::chat::permission_dir(state.manager.app())?;
    crate::chat::write_ask_user_question_response(
        &perm_dir,
        "default",  // session ID（硬编码，未来可改）
        &request_id,
        answers,
    )
}
```

**要点**：
1. **文档注释**：说明参数来源和用途
2. **类型明确**：`HashMap<String, String>` 清晰表达键值都是字符串
3. **错误传播**：`permission_dir()?` 和 `write_...()?` 的错误直接传播
4. **业务逻辑下沉**：实际写文件的逻辑在 `chat::permission_watcher` 模块

---

## 常见错误

### 错误 1：在命令里写业务逻辑

```rust
// ❌ 命令层不应包含复杂逻辑
#[tauri::command]
pub async fn save_provider(data: Provider) -> Result<(), String> {
    let path = get_data_path()?;
    let json = serde_json::to_string(&data)?;
    std::fs::write(path, json)?;  // 文件 I/O 应该在 service 层
    Ok(())
}
```

应该：
```rust
// ✅ 命令层只做调用和错误映射
#[tauri::command]
pub async fn save_provider(data: Provider) -> Result<(), String> {
    provider_service::save(data)
        .await
        .map_err(|e| format!("保存失败: {e}"))
}
```

### 错误 2：返回非 String 错误

```rust
// ❌ anyhow::Error 不能直接返回给前端
pub async fn do_something() -> Result<(), anyhow::Error> { ... }
```

应该：
```rust
// ✅ 转换为 String
pub async fn do_something() -> Result<(), String> {
    inner().map_err(|e| e.to_string())
}
```

### 错误 3：忘记注册命令

命令写完后必须在 `lib.rs` 注册，否则前端调用会报 `command not found`。

---

## 参考

- Tauri 命令文档: https://v2.tauri.app/develop/calling-rust/
