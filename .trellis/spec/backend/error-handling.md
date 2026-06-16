# 错误处理

> Result 传播、错误字符串化、日志

---

## 概述

CC Switch 后端采用 **Result-based 错误处理**，所有可能失败的操作返回 `Result<T, E>`。Tauri 命令层统一将错误转换为 `String` 传给前端。

---

## 错误类型规范

### Tauri 命令层：`Result<T, String>`

所有 Tauri 命令必须返回 `Result<T, String>`：

```rust
#[tauri::command]
pub async fn save_config(config: Config) -> Result<(), String> {
    config_service::save(config)
        .await
        .map_err(|e| format!("保存配置失败: {e}"))
}
```

**为什么用 String？**
- 前端无法反序列化 Rust 的自定义错误类型
- 字符串跨语言通用
- 可以包含上下文信息

### 内部层：自定义错误或 String

业务逻辑层（service/manager）可以用自定义错误类型，但最终必须转换为 String：

```rust
// 内部函数可以返回 anyhow::Error 或自定义错误
fn internal_operation() -> Result<Data, anyhow::Error> {
    let data = fetch_data().context("获取数据失败")?;
    Ok(data)
}

// 命令层转换为 String
#[tauri::command]
pub fn do_operation() -> Result<Data, String> {
    internal_operation().map_err(|e| e.to_string())
}
```

---

## 错误传播（? 操作符）

### 基础传播

```rust
fn read_config() -> Result<Config, String> {
    let path = get_config_path()?;  // 失败时提前返回
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取配置文件失败: {e}"))?;
    let config: Config = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置失败: {e}"))?;
    Ok(config)
}
```

### 跨错误类型转换

使用 `.map_err()` 转换错误类型：

```rust
use std::io;

fn operation() -> Result<(), String> {
    let file = std::fs::File::open("data.json")
        .map_err(|e: io::Error| format!("打开文件失败: {e}"))?;
    Ok(())
}
```

---

## 错误上下文化

### 模式：操作描述 + 原始错误

```rust
.map_err(|e| format!("操作描述: {e}"))
```

**示例**：
```rust
// ❌ 错误信息不清晰
.map_err(|e| e.to_string())

// ✅ 提供上下文
.map_err(|e| format!("启动 daemon 失败: {e}"))
.map_err(|e| format!("写入权限响应文件失败: {e}"))
.map_err(|e| format!("解析 JSON 失败: {e}"))
```

### 多层上下文

```rust
async fn complex_operation() -> Result<Data, String> {
    let raw = fetch_raw()
        .await
        .map_err(|e| format!("获取原始数据失败: {e}"))?;
    
    let processed = process(raw)
        .map_err(|e| format!("处理数据失败: {e}"))?;
    
    save(processed)
        .await
        .map_err(|e| format!("保存结果失败: {e}"))?;
    
    Ok(processed)
}
```

每一层添加有意义的上下文，最终错误可能是：
```
保存结果失败: 写入文件失败: No such file or directory (os error 2)
```

---

## 错误分类

### 1. 文件 I/O 错误

```rust
std::fs::read_to_string(path)
    .map_err(|e| format!("读取文件失败 {}: {e}", path.display()))
```

**注意**：路径可能包含敏感信息（用户名），考虑只显示文件名。

### 2. 序列化/反序列化错误

```rust
serde_json::from_str::<Config>(&content)
    .map_err(|e| format!("解析 JSON 失败: {e}"))
```

### 3. 子进程错误

```rust
Command::new(node).spawn()
    .map_err(|e| format!("启动 Node.js 进程失败: {e}"))
```

### 4. 网络请求错误

```rust
reqwest::get(url).await
    .map_err(|e| format!("HTTP 请求失败: {e}"))
```

### 5. 超时错误

```rust
tokio::time::timeout(duration, operation()).await
    .map_err(|_| "操作超时".to_string())?
    .map_err(|e| format!("操作失败: {e}"))
```

---

## 日志记录

### 使用 eprintln! 记录错误

Rust 标准错误输出（stderr）会被 Tauri 捕获，前端可通过开发者工具查看。

```rust
if let Err(e) = risky_operation().await {
    eprintln!("[ERROR] 操作失败: {e}");
}
```

### 分级日志（可选）

```rust
eprintln!("[INFO] 启动 daemon: {}", node.display());
eprintln!("[WARN] 配置文件缺失，使用默认值");
eprintln!("[ERROR] 无法连接到 daemon: {e}");
```

### 调试日志

```rust
#[cfg(debug_assertions)]
eprintln!("[DEBUG] 请求 ID: {}", request_id);
```

---

## 错误处理模式

### 模式 1：忽略错误（非关键操作）

```rust
// 删除临时文件失败不影响主流程
let _ = std::fs::remove_file(temp_file);
```

### 模式 2：提供默认值

```rust
fn load_config() -> Config {
    Config::load().unwrap_or_else(|e| {
        eprintln!("[WARN] 加载配置失败: {e}，使用默认配置");
        Config::default()
    })
}
```

### 模式 3：转换为 Option

```rust
fn try_detect_node() -> Option<PathBuf> {
    detect_node().ok()  // Result<T, E> -> Option<T>
}
```

### 模式 4：组合多个错误源

```rust
fn find_executable() -> Result<PathBuf, String> {
    which::which("node")
        .or_else(|_| which::which("node.exe"))
        .or_else(|_| detect_from_registry())
        .map_err(|e| format!("未找到 Node.js: {e}"))
}
```

---

## Tauri 命令错误处理实例

### 实例 1：简单查询

```rust
#[tauri::command]
pub fn get_all_providers() -> Result<Vec<Provider>, String> {
    provider_service::list()
        .map_err(|e| format!("加载 Provider 列表失败: {e}"))
}
```

前端处理：
```ts
try {
    const providers = await invoke<Provider[]>('get_all_providers');
    setProviders(providers);
} catch (error) {
    showToast(String(error), 'error');
}
```

### 实例 2：异步操作

```rust
#[tauri::command]
pub async fn chat_send(
    provider: String,
    command: String,
    params: Value,
    state: State<'_, ChatState>,
) -> Result<String, String> {
    let method = format!("{provider}.{command}");
    state.manager.send(method, params)
        .await
        .map_err(|e| format!("发送消息失败: {e}"))
}
```

### 实例 3：多步骤操作

```rust
#[tauri::command]
pub async fn install_sdk(sdk_id: String, state: State<'_, ChatState>) -> Result<(), String> {
    // 步骤 1
    let sdk_path = state.manager.resolve_sdk_path(&sdk_id)
        .map_err(|e| format!("解析 SDK 路径失败: {e}"))?;
    
    // 步骤 2
    std::fs::create_dir_all(&sdk_path)
        .map_err(|e| format!("创建 SDK 目录失败: {e}"))?;
    
    // 步骤 3
    state.manager.install_sdk(&sdk_id).await
        .map_err(|e| format!("安装 SDK 失败: {e}"))?;
    
    Ok(())
}
```

每一步失败都会提前返回，错误信息指明失败阶段。

---

## 权限审批错误处理实例

### 文件写入错误

```rust
pub fn write_ask_user_question_response(
    permission_dir: &Path,
    session_id: &str,
    request_id: &str,
    answers: HashMap<String, String>,
) -> Result<(), String> {
    let filename = format!(
        "ask-user-question-response-{}-{}.json",
        session_id, request_id
    );
    let path = permission_dir.join(filename);
    
    let resp = AskUserQuestionResponse {
        request_id: request_id.to_string(),
        answers,
    };
    
    let json = serde_json::to_string_pretty(&resp)
        .map_err(|e| format!("序列化响应失败: {e}"))?;
    
    std::fs::write(&path, json)
        .map_err(|e| format!("写入响应文件失败: {e}"))?;
    
    Ok(())
}
```

**可能的错误**：
- `"序列化响应失败: ..."`（JSON 序列化失败，罕见）
- `"写入响应文件失败: Permission denied"`（权限问题）
- `"写入响应文件失败: No such file or directory"`（目录不存在）

---

## 常见错误

### 错误 1：丢失上下文

```rust
// ❌ 错误信息不明确
.map_err(|e| e.to_string())
```

应该：
```rust
// ✅ 说明操作上下文
.map_err(|e| format!("读取配置文件失败: {e}"))
```

### 错误 2：过度包装

```rust
// ❌ 每层都加 "失败"，冗余
.map_err(|e| format!("操作失败: 步骤 1 失败: 读取失败: {e}"))
```

应该：
```rust
// ✅ 简洁描述，原始错误已包含细节
.map_err(|e| format!("步骤 1 - 读取配置: {e}"))
```

### 错误 3：暴露敏感信息

```rust
// ❌ 完整路径可能包含用户名
.map_err(|e| format!("文件 /Users/john/data.json 读取失败: {e}"))
```

应该：
```rust
// ✅ 只显示文件名或相对路径
.map_err(|e| format!("文件 data.json 读取失败: {e}"))
```

### 错误 4：panic! 而非 Result

```rust
// ❌ panic 会导致整个应用崩溃
#[tauri::command]
pub fn risky_operation() -> String {
    let data = dangerous_function().expect("失败了");  // panic!
    data
}
```

应该：
```rust
// ✅ 返回 Result，让前端处理错误
#[tauri::command]
pub fn risky_operation() -> Result<String, String> {
    let data = dangerous_function()
        .map_err(|e| format!("操作失败: {e}"))?;
    Ok(data)
}
```

---

## 错误恢复策略

### 自动重试

```rust
async fn fetch_with_retry(url: &str, max_retries: u32) -> Result<String, String> {
    let mut attempts = 0;
    loop {
        match reqwest::get(url).await {
            Ok(resp) => return resp.text().await.map_err(|e| e.to_string()),
            Err(e) if attempts < max_retries => {
                attempts += 1;
                eprintln!("[WARN] 请求失败 (尝试 {attempts}/{max_retries}): {e}");
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
            Err(e) => return Err(format!("请求失败（已重试 {max_retries} 次）: {e}")),
        }
    }
}
```

### 降级策略

```rust
async fn get_data() -> Result<Data, String> {
    // 尝试主数据源
    if let Ok(data) = fetch_from_primary().await {
        return Ok(data);
    }
    
    eprintln!("[WARN] 主数据源失败，尝试备用数据源");
    
    // 降级到备用数据源
    fetch_from_fallback().await
        .map_err(|e| format!("所有数据源均失败: {e}"))
}
```

---

## 参考

- Rust 错误处理: https://doc.rust-lang.org/book/ch09-00-error-handling.html
- anyhow crate: https://docs.rs/anyhow/
- Tauri 错误处理: https://v2.tauri.app/develop/calling-rust/
