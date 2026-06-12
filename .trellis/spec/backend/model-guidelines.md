# 数据模型规范

## 概述

数据模型（`models/`）定义贯穿三层的数据结构，负责 serde 序列化。核心契约是 **Rust 内部用 `snake_case`，JSON 序列化用 `camelCase`**，与前端 TypeScript 类型保持一致。

---

## 标准模型定义

### derive 约定

所有模型 struct 标准 derive：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    // 字段...
}
```

| derive | 用途 |
|--------|------|
| `Debug` | 日志/调试输出 |
| `Clone` | 跨层传递时复制 |
| `Serialize` | Rust → JSON（返回前端） |
| `Deserialize` | JSON → Rust（接收前端参数、读数据库 JSON 列） |
| `Default` | 可选，有合理默认值时（如配置类） |

---

## camelCase 映射（核心契约）

### serde rename 规则

Rust 字段用 `snake_case`，通过 `#[serde(rename = "camelCase")]` 映射到前端 camelCase。

**实际代码** (`src-tauri/src/models/provider.rs:30-67`):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,                          // 无需 rename（已是 camelCase）
    pub name: String,
    #[serde(rename = "appType")]
    pub app_type: AppType,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub url: Option<String>,
    #[serde(rename = "defaultSonnetModel")]
    pub default_sonnet_model: Option<String>,
    #[serde(rename = "defaultOpusModel")]
    pub default_opus_model: Option<String>,
    #[serde(rename = "customParams")]
    pub custom_params: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "inFailoverQueue", default)]
    pub in_failover_queue: bool,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "lastUsed")]
    pub last_used: Option<DateTime<Utc>>,
}
```

**对应前端类型** (`src/types/provider.ts`):
```typescript
export interface Provider {
    id: string;
    appType: AppType;          // ← app_type
    apiKey: string;            // ← api_key
    defaultSonnetModel?: string; // ← default_sonnet_model
    inFailoverQueue: boolean;  // ← in_failover_queue
    isActive: boolean;         // ← is_active
    createdAt: string;         // ← created_at
}
```

> **核心契约**: 每个 snake_case 多词字段都必须有 `#[serde(rename)]`，否则前端收到的字段名是 snake_case，TypeScript 类型对不上。

---

## 枚举模型

### rename_all + 字符串转换

枚举用 `#[serde(rename_all = "lowercase")]`，并实现 `FromStr` / `Display` 供命令层解析。

**实际代码** (`src-tauri/src/models/app_type.rs:6-14, 66-84`):
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppType {
    Claude,
    Codex,
    Gemini,
    OpenCode,
    OpenClaw,
}

impl fmt::Display for AppType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for AppType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "claude" => Ok(AppType::Claude),
            "codex" => Ok(AppType::Codex),
            "gemini" => Ok(AppType::Gemini),
            "opencode" => Ok(AppType::OpenCode),
            "openclaw" => Ok(AppType::OpenClaw),
            _ => Err(format!("Unknown app type: {}", s)),
        }
    }
}
```

> **Convention**: 枚举的辅助方法（`as_str`, `all`, 领域逻辑如 `is_additive_mode`）定义在 `impl` 块中集中维护。

---

## 可选字段约定

### Option + skip_serializing_if

可选字段用 `Option<T>`；序列化时若想省略 `None`，加 `skip_serializing_if`：

**实际代码** (`src-tauri/src/models/provider.rs:8-28`):
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderProxyConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(rename = "proxyType", skip_serializing_if = "Option::is_none")]
    pub proxy_type: Option<String>,
    #[serde(rename = "proxyHost", skip_serializing_if = "Option::is_none")]
    pub proxy_host: Option<String>,
    #[serde(rename = "proxyPort", skip_serializing_if = "Option::is_none")]
    pub proxy_port: Option<u16>,
}
```

| 属性 | 效果 |
|------|------|
| `#[serde(default)]` | 反序列化时字段缺失用默认值（不报错） |
| `#[serde(skip_serializing_if = "Option::is_none")]` | 序列化时 `None` 字段不输出到 JSON |

---

## 动态/灵活字段

### HashMap 和 serde_json::Value

不定结构的数据用 `HashMap<String, Value>` 或 `serde_json::Value`：

```rust
#[serde(rename = "customParams")]
pub custom_params: Option<HashMap<String, serde_json::Value>>,  // 动态参数
#[serde(rename = "settingsConfig")]
pub settings_config: Option<serde_json::Value>,                 // 任意 JSON
pub meta: Option<HashMap<String, String>>,                      // 字符串键值对
```

> 优先定义具体类型；仅在结构确实不固定时用 `Value`。

---

## 时间字段

### chrono DateTime<Utc>

时间字段统一用 `chrono::DateTime<Utc>`：

```rust
#[serde(rename = "createdAt")]
pub created_at: DateTime<Utc>,
#[serde(rename = "lastUsed")]
pub last_used: Option<DateTime<Utc>>,
```

- 序列化为 ISO 8601 字符串（前端 `string` 类型）
- 数据库存储为 Unix timestamp（i64），DAO 层负责转换（见 [database-guidelines.md](./database-guidelines.md)）

---

## 配置容器模型

包裹列表的容器结构：

**实际代码** (`src-tauri/src/models/provider.rs:69-72`):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvidersConfig {
    pub providers: Vec<Provider>,
}
```

---

## 新增/修改模型检查清单

修改模型时必须同步：

- [ ] Rust 字段加 `#[serde(rename = "camelCase")]`（如果多词）
- [ ] 前端 `src/types/<domain>.ts` 同步字段
- [ ] 若字段持久化到数据库，更新 `database/schema.rs` 和 `database/dao/<domain>.rs` 的读写映射
- [ ] 可选字段考虑加 `#[serde(default)]` 保证向后兼容旧数据
- [ ] `cargo check` 通过

---

## 常见错误

### ❌ 错误：多词字段忘记 rename
```rust
pub struct Provider {
    pub api_key: String,  // ❌ 前端会收到 "api_key" 而非 "apiKey"
    pub is_active: bool,  // ❌ 前端会收到 "is_active"
}
```

### ✅ 正确：添加 camelCase 映射
```rust
pub struct Provider {
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}
```

---

### ❌ 错误：新增必填字段破坏旧数据反序列化
```rust
pub struct Provider {
    pub new_field: String,  // ❌ 旧数据没有此字段，反序列化失败
}
```

### ✅ 正确：用 Option 或 default 保证兼容
```rust
pub struct Provider {
    #[serde(default)]
    pub new_field: String,  // ✅ 旧数据缺失时用默认值
    // 或
    pub new_field: Option<String>,  // ✅ 可选
}
```

---

### ❌ 错误：Rust 端用 camelCase 字段名
```rust
pub struct Provider {
    pub apiKey: String,  // ❌ 不符合 Rust 命名规范（clippy 会警告）
}
```

### ✅ 正确：Rust snake_case + serde rename
```rust
pub struct Provider {
    #[serde(rename = "apiKey")]
    pub api_key: String,  // ✅ Rust snake_case
}
```

---

## 参考

- 模型实现: `src-tauri/src/models/provider.rs`
- 枚举模型: `src-tauri/src/models/app_type.rs`
- 前端类型同步: `src/types/provider.ts`
- ApiToken 模型: `CLAUDE.md` 第 99-115 行
- 序列化约定: `CLAUDE.md` 第 144 行
