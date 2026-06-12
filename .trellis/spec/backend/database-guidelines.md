# 数据库 DAO 规范

## 概述

数据访问层（`database/dao/`）封装所有 SQLite 读写。本项目使用 **rusqlite**，数据库位于 `~/.ccg-switch/ccg-switch.db`。DAO 通过 `impl Database` 扩展方法，集中管理 SQL 和"行 ↔ 模型"映射。

**这是数据库 schema 契约层** —— 表结构变更需同步 schema、DAO 映射、模型定义。

---

## 1. Scope / Trigger

适用场景：
- 新增/修改数据表
- 修改 DAO 读写方法
- 行映射（row → 模型）变更
- 数据库 schema 迁移

---

## 2. Signatures（DAO 方法签名）

### Database 结构

**实际代码** (`src-tauri/src/database/mod.rs:9-20`):
```rust
use rusqlite::Connection;
use std::sync::Mutex;

pub struct Database {
    pub(crate) conn: Mutex<Connection>,
}

// 连接锁宏：统一锁获取 + 错误转换
macro_rules! lock_conn {
    ($mutex:expr) => {
        $mutex
            .lock()
            .map_err(|e| format!("Mutex lock failed: {}", e))?
    };
}
pub(crate) use lock_conn;
```

### DAO 方法签名模式

DAO 方法通过 `impl Database` 添加，位于 `dao/<domain>.rs`：

```rust
impl Database {
    pub fn list_providers(&self) -> Result<Vec<Provider>, String> { ... }
    pub fn get_provider(&self, id: &str) -> Result<Option<Provider>, String> { ... }
    pub fn upsert_provider(&self, provider: &Provider) -> Result<(), String> { ... }
    pub fn delete_provider(&self, id: &str) -> Result<(), String> { ... }
}
```

| 操作 | 返回类型 | 说明 |
|------|---------|------|
| 列表查询 | `Result<Vec<T>, String>` | 空表返回空 Vec |
| 单条查询 | `Result<Option<T>, String>` | 不存在返回 `Ok(None)` |
| 写入/更新 | `Result<(), String>` | upsert 模式 |
| 删除 | `Result<(), String>` | — |

---

## 3. Contracts（契约）

### 数据库初始化契约

**实际代码** (`src-tauri/src/database/mod.rs:22-50`):
```rust
impl Database {
    /// 生产环境初始化，数据库在 ~/.ccg-switch/ccg-switch.db
    pub fn init() -> Result<Self, String> {
        let db_path = Self::get_db_path()?;
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create db directory: {e}"))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {e}"))?;

        // 强制开启外键约束
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;

        let db = Self { conn: Mutex::new(conn) };
        db.create_tables()?;
        db.init_default_skill_repos()?;
        Ok(db)
    }

    fn get_db_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or_else(|| "Home directory not found".to_string())?;
        Ok(home.join(".ccg-switch").join("ccg-switch.db"))
    }
}
```

### 连接访问契约

| 规则 | 说明 |
|------|------|
| 连接锁 | 所有方法用 `lock_conn!(self.conn)` 获取连接 |
| 外键 | 初始化时 `PRAGMA foreign_keys = ON` |
| 数据库路径 | `~/.ccg-switch/ccg-switch.db` |
| 列顺序 | SELECT 列顺序必须与 `row.get(N)` 索引严格对应 |

---

## 4. Validation & Error Matrix

| 条件 | 处理 | 返回 |
|------|------|------|
| 连接锁中毒 | `lock_conn!` | `Err("Mutex lock failed: ...")` |
| prepare SQL 失败 | `.map_err(\|e\| format!("Failed to prepare query: {e}"))` | `Err(...)` |
| 单条查询无结果 | `.optional()` | `Ok(None)` |
| 行字段解析失败 | `row.get(N)?` 传播 rusqlite::Error | `Err("Failed to read row: ...")` |
| JSON 列解析失败 | `.and_then(\|s\| serde_json::from_str(&s).ok())` | 降级为 `None`（不中断） |
| 枚举列解析失败 | `.unwrap_or(AppType::Claude)` | 降级为默认值 |

---

## 5. Good / Base / Bad Cases

### Good：完整的列表查询 + 行映射

**实际代码** (`src-tauri/src/database/dao/providers.rs:11-62`):
```rust
impl Database {
    pub fn list_providers(&self) -> Result<Vec<Provider>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT id, name, app_type, api_key, url, default_sonnet_model, \
                      default_opus_model, default_haiku_model, default_reasoning_model, \
                      custom_params, settings_config, meta, icon, in_failover_queue, \
                      description, tags, is_active, created_at, last_used, proxy_config \
                      FROM providers ORDER BY name ASC")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let rows = stmt
            .query_map([], |row| {
                // JSON 列：字符串 → 反序列化（失败降级 None）
                let custom_params_str: Option<String> = row.get(9)?;
                let proxy_config_str: Option<String> = row.get(19)?;

                Ok(Provider {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    // 枚举列：字符串 → from_str（失败降级默认值）
                    app_type: AppType::from_str(&row.get::<_, String>(2)?)
                        .unwrap_or(AppType::Claude),
                    api_key: row.get(3)?,
                    url: row.get(4)?,
                    default_sonnet_model: row.get(5)?,
                    // ...
                    custom_params: custom_params_str.and_then(|s| serde_json::from_str(&s).ok()),
                    is_active: row.get(16)?,
                    // 时间列：i64 timestamp → DateTime
                    created_at: chrono::DateTime::<Utc>::from_timestamp(row.get::<_, i64>(17)?, 0)
                        .unwrap_or_default(),
                    proxy_config: proxy_config_str.and_then(|s| serde_json::from_str(&s).ok()),
                })
            })
            .map_err(|e| format!("Failed to query providers: {e}"))?;

        let mut providers = Vec::new();
        for row in rows {
            providers.push(row.map_err(|e| format!("Failed to read row: {e}"))?);
        }
        Ok(providers)
    }
}
```

### Base：单条查询返回 Option

```rust
pub fn get_provider(&self, id: &str) -> Result<Option<Provider>, String> {
    let conn = lock_conn!(self.conn);
    let provider = conn
        .query_row(
            "SELECT ... FROM providers WHERE id = ?1",
            rusqlite::params![id],
            |row| { Ok(Provider { /* 映射 */ }) },
        )
        .optional()  // 不存在 → Ok(None)
        .map_err(|e| format!("Failed to query provider: {e}"))?;
    Ok(provider)
}
```

### Bad：手动拼接 SQL（SQL 注入风险）
```rust
// ❌ 字符串拼接用户输入
let sql = format!("SELECT * FROM providers WHERE id = '{}'", id);
conn.query_row(&sql, [], |row| { ... })
```

---

## 6. Tests Required

| 测试类型 | 断言点 |
|---------|--------|
| 单元测试（内存库） | `Database::in_memory()` 建库成功，表已创建 |
| CRUD 往返 | upsert 后 `get` 能取回相同数据；字段值一致 |
| Option 查询 | 不存在的 id → `Ok(None)` |
| JSON 列往返 | `custom_params` 写入后读出反序列化一致 |
| 时间往返 | `created_at` timestamp 转换无精度丢失（秒级） |

测试基础设施 (`src-tauri/src/database/mod.rs:57-73`):
```rust
#[cfg(test)]
pub(crate) fn in_memory() -> Result<Self, String> {
    let conn = Connection::open_in_memory()
        .map_err(|e| format!("Failed to open in-memory database: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;
    let db = Self { conn: Mutex::new(conn) };
    db.create_tables()?;
    db.init_default_skill_repos()?;
    Ok(db)
}
```

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 7. Wrong vs Correct

### Wrong：参数化查询用字符串拼接
```rust
pub fn get_provider(&self, id: &str) -> Result<Option<Provider>, String> {
    let conn = lock_conn!(self.conn);
    let sql = format!("SELECT * FROM providers WHERE id = '{}'", id);  // ❌ 注入风险
    // ...
}
```

### Correct：用 rusqlite params!
```rust
pub fn get_provider(&self, id: &str) -> Result<Option<Provider>, String> {
    let conn = lock_conn!(self.conn);
    conn.query_row(
        "SELECT ... FROM providers WHERE id = ?1",
        rusqlite::params![id],  // ✅ 参数化绑定
        |row| { Ok(Provider { /* ... */ }) },
    )
    .optional()
    .map_err(|e| format!("Failed to query provider: {e}"))
}
```

---

## 类型映射约定

### Rust 模型 ↔ SQLite 列

| Rust 类型 | SQLite 存储 | 转换方式 |
|-----------|------------|---------|
| `String` | TEXT | `row.get(N)?` |
| `Option<String>` | TEXT (nullable) | `row.get(N)?` |
| `bool` | INTEGER (0/1) | `row.get(N)?` |
| `u16` / `i64` | INTEGER | `row.get(N)?` |
| `AppType` (枚举) | TEXT | `AppType::from_str(&s).unwrap_or(default)` |
| `DateTime<Utc>` | INTEGER (timestamp) | `DateTime::from_timestamp(ts, 0)` |
| `HashMap` / `Value` (JSON) | TEXT | `serde_json::from_str(&s).ok()` / `to_string()` |
| `Vec<String>` (tags) | TEXT (JSON) | `serde_json::from_str(&s).ok().unwrap_or_default()` |

---

## 降级容错约定

DAO 读取时对**非关键字段**采用降级策略，避免单字段损坏导致整行读取失败：

```rust
// 枚举解析失败 → 默认值
app_type: AppType::from_str(&row.get::<_, String>(2)?).unwrap_or(AppType::Claude),

// JSON 解析失败 → None
custom_params: custom_params_str.and_then(|s| serde_json::from_str(&s).ok()),

// 时间解析失败 → 默认时间
created_at: chrono::DateTime::<Utc>::from_timestamp(row.get::<_, i64>(17)?, 0)
    .unwrap_or_default(),
```

> **Convention**: 主键、name 等关键字段用 `?` 直接传播错误；可选/派生字段用降级避免整行失败。

---

## 新增数据表流程

1. **`database/schema.rs`** 加 `CREATE TABLE` 语句
2. **`database/dao/<domain>.rs`** 创建 DAO 方法（`impl Database`）
3. **`database/dao/mod.rs`** 声明模块
4. **`models/<domain>.rs`** 定义对应模型
5. 测试：用 `Database::in_memory()` 验证 CRUD 往返
6. `cargo check` + `cargo test`

---

## 常见错误

### Common Mistake: SELECT 列顺序与 row.get 索引不符

**Symptom**: 读取的字段值张冠李戴（如 name 显示成 url）。

**Cause**: SELECT 列顺序与 `row.get(N)` 的索引 N 不对应。

**Fix**: 保证 SQL 中列的出现顺序与 `row.get(0)`, `row.get(1)`... 严格一致。修改 SELECT 时同步检查所有 `row.get` 索引。

**Prevention**: 新增列追加到 SELECT 末尾，并用末尾索引读取。

---

### Common Mistake: 忘记开启外键就依赖级联删除

**Symptom**: 删除父记录后子记录未级联删除。

**Cause**: 连接未执行 `PRAGMA foreign_keys = ON`。

**Fix**: `init()` 和 `in_memory()` 都已执行该 PRAGMA；新建连接路径需同样开启。

---

## 参考

- DAO 实现: `src-tauri/src/database/dao/providers.rs`
- 数据库初始化: `src-tauri/src/database/mod.rs`
- 建表语句: `src-tauri/src/database/schema.rs`
- 模型定义: [model-guidelines.md](./model-guidelines.md)
- 数据路径: `CLAUDE.md` 第 86-95 行
