# 跨层协议

> Rust 后端与前端的通信契约

---

## 概述

CC Switch 的 Rust 后端与前端（TypeScript）通过三种机制通信：
1. **Tauri 命令** — 前端 `invoke()` 调用后端函数，同步返回结果
2. **Tauri 事件** — 后端 `app.emit()` 推送数据给前端，前端 `listen()` 监听
3. **文件 IPC** — daemon (Node.js) 与 Rust 通过约定路径的 JSON 文件交换数据

---

## 1. Tauri 命令协议

### 字段命名：camelCase ↔ snake_case

**前端（TypeScript）**：camelCase
```ts
await invoke('permission_respond_ask_user_question', {
    requestId: 'ask-123',
    answers: { 'Which option?': 'Option A' }
});
```

**后端（Rust）**：snake_case + serde rename
```rust
#[tauri::command]
pub async fn permission_respond_ask_user_question(
    request_id: String,  // 前端传 requestId，serde 自动映射
    answers: HashMap<String, String>,
) -> Result<(), String> { ... }
```

### 数据模型同步

前后端类型定义必须对齐。

**TypeScript** (`src/types/permission.ts`):
```ts
export interface AskUserQuestionRequest {
    requestId: string;
    toolName: string;
    questions: Question[];
    timestamp: string;
    cwd: string;
}
```

**Rust** (`src/chat/permission_watcher.rs`):
```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AskUserQuestionRequest {
    pub request_id: String,
    pub tool_name: String,
    pub questions: Vec<Question>,
    pub timestamp: String,
    pub cwd: String,
}
```

**要点**：
- `#[serde(rename_all = "camelCase")]` 自动将 `request_id` 映射为 `requestId`
- 字段顺序无关紧要，但类型必须匹配（`string` ↔ `String`，`number` ↔ `u32/i64`）
- 可选字段：`Option<T>` ↔ `T | null | undefined`

---

## 2. Tauri 事件协议

### 事件命名规范

模式：`{domain}://{event}`

| 事件名 | 方向 | Payload 类型 | 说明 |
|--------|------|-------------|------|
| `chat://stream` | 后端 → 前端 | `ChatStreamEvent` | 流式响应行 |
| `chat://done` | 后端 → 前端 | `ChatDoneEvent` | 请求完成/失败 |
| `chat://daemon` | 后端 → 前端 | `ChatDaemonEvent` | daemon 生命周期事件 |
| `permission://ask-user-question` | 后端 → 前端 | `AskUserQuestionRequest` | 权限请求（工具调用审批） |
| `permission://plan-approval` | 后端 → 前端 | `PlanApprovalRequest` | 计划审批请求 |

### 事件发送（Rust）

```rust
use tauri::Emitter;

app.emit("permission://ask-user-question", request)?;
```

**要点**：
- Payload 必须实现 `Serialize`
- 事件名用双冒号 `://` 分隔域和事件
- 不要在事件名里编码数据（如 `permission://ask-123`），数据放 payload

### 事件监听（TypeScript）

```ts
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<AskUserQuestionRequest>(
    'permission://ask-user-question',
    (event) => {
        console.log('收到权限请求:', event.payload);
        setRequest(event.payload);
    }
);

// 组件卸载时取消监听
return () => unlisten();
```

---

## 3. 文件 IPC 协议（Permission Bridge）

### 背景

daemon (Node.js) 与 Rust 后端通过**文件系统**交换权限请求/响应，避免 stdout/stdin 污染。这是从 jetbrains-cc-gui 继承的协议。

### 目录和 Session ID

- **目录**：`<app-data-dir>/permissions/`（Rust 创建并通过环境变量 `CLAUDE_PERMISSION_DIR` 告知 daemon）
- **Session ID**：当前硬编码为 `"default"`，用于区分并发会话

### 文件命名规范

#### 请求文件（daemon 写入）

- `ask-user-question-<sessionId>-<requestId>.json`
- `plan-approval-<sessionId>-<requestId>.json`

示例：`ask-user-question-default-ask-a1b2c3.json`

#### 响应文件（Rust 写入）

- `ask-user-question-response-<sessionId>-<requestId>.json`
- `plan-approval-response-<sessionId>-<requestId>.json`

示例：`ask-user-question-response-default-ask-a1b2c3.json`

### 协议流程

```
1. daemon 检测到需要权限的操作
   ↓
2. daemon 写请求文件（如 ask-user-question-default-ask-123.json）
   ↓
3. Rust PermissionWatcher 轮询发现请求文件（100ms 间隔）
   ↓
4. Rust 读取 JSON、删除请求文件、通过 Tauri 事件推送给前端
   ↓
5. 前端弹窗让用户决策
   ↓
6. 用户点击按钮 → 前端调 Tauri 命令（如 permission_respond_ask_user_question）
   ↓
7. Rust 写响应文件（如 ask-user-question-response-default-ask-123.json）
   ↓
8. daemon 轮询发现响应文件（100ms 间隔）
   ↓
9. daemon 读取响应、删除响应文件、继续执行
```

### AskUserQuestion 协议

#### 请求（daemon → Rust）

文件内容：
```json
{
  "requestId": "ask-a1b2c3d4",
  "toolName": "AskUserQuestion",
  "questions": [
    {
      "question": "Which library should we use?",
      "header": "Library",
      "options": [
        { "label": "React", "description": "Popular UI library" },
        { "label": "Vue", "description": "Progressive framework" }
      ],
      "multiSelect": false
    }
  ],
  "timestamp": "2026-06-13T10:30:00Z",
  "cwd": "/path/to/project"
}
```

#### 响应（Rust → daemon）

文件内容：
```json
{
  "requestId": "ask-a1b2c3d4",
  "answers": {
    "Which library should we use?": "React"
  }
}
```

**空答案表示拒绝**：
```json
{
  "requestId": "ask-a1b2c3d4",
  "answers": {}
}
```

### PlanApproval 协议

#### 请求（daemon → Rust）

```json
{
  "requestId": "plan-e5f6g7h8",
  "toolName": "ExitPlanMode",
  "plan": "# Step 1\nRead package.json\n# Step 2\nUpdate version\n...",
  "allowedPrompts": [
    { "tool": "Read", "prompt": "Allow reading package.json" },
    { "tool": "Edit", "prompt": "Allow editing package.json" }
  ],
  "timestamp": "2026-06-13T10:35:00Z",
  "cwd": "/path/to/project"
}
```

#### 响应（Rust → daemon）

```json
{
  "requestId": "plan-e5f6g7h8",
  "approved": true,
  "targetMode": "default"
}
```

**targetMode 可选值**：
- `"default"` — 批准本次计划，后续操作仍需审批
- `"auto"` — 批准并切换到 auto 模式（后续操作自动放行）
- `"bypassPermissions"` — 批准并切换到完全绕过模式

**拒绝**：
```json
{
  "requestId": "plan-e5f6g7h8",
  "approved": false,
  "targetMode": "default",
  "message": "User denied the plan"
}
```

---

## 4. 错误处理契约

### Rust 错误统一为字符串

```rust
Result<T, String>
```

**前端接收**：
```ts
try {
    await invoke('some_command', { ... });
} catch (error) {
    console.error('错误:', error);  // error 是字符串
    showToast(String(error), 'error');
}
```

### 错误消息格式

```
操作描述: 具体错误原因
```

示例：
- `"保存配置失败: No such file or directory (os error 2)"`
- `"启动 daemon 失败: node 未找到"`
- `"写入响应文件失败: Permission denied"`

**不要**：
- 返回纯技术栈追踪（`at line 42 in module xyz`）
- 暴露完整文件路径（可能包含用户名）
- 英文错误混中文描述（统一用中文描述 + 英文原始错误）

---

## 5. 数据类型映射表

| TypeScript | Rust | 说明 |
|------------|------|------|
| `string` | `String` | 字符串 |
| `number` | `i32`, `i64`, `u32`, `f64` | 整数/浮点（前端无区分） |
| `boolean` | `bool` | |
| `null` / `undefined` | `Option<T>` | Rust 用 `Option::None` |
| `T[]` | `Vec<T>` | 数组 |
| `{ [key: string]: V }` | `HashMap<String, V>` | 对象/Map |
| `{ key: T }` | `struct` with `#[serde(rename = "key")]` | 对象 |
| `any` | `serde_json::Value` | 任意 JSON |

---

## 6. 实例：完整的权限审批链路

### 前端发起审批响应

```ts
// useChatStore.ts
answerAskUserQuestion: async (requestId, answers) => {
    await invoke('permission_respond_ask_user_question', { requestId, answers });
    set({ pendingAskUserQuestion: null });
}
```

### Rust 命令处理

```rust
// commands/chat_commands.rs
#[tauri::command]
pub async fn permission_respond_ask_user_question(
    request_id: String,
    answers: HashMap<String, String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    let perm_dir = crate::chat::permission_dir(state.manager.app())?;
    crate::chat::write_ask_user_question_response(
        &perm_dir,
        "default",
        &request_id,
        answers,
    )
}
```

### Rust 写文件

```rust
// chat/permission_watcher.rs
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
    let resp = AskUserQuestionResponse { request_id: request_id.to_string(), answers };
    let json = serde_json::to_string_pretty(&resp)
        .map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("写入响应文件失败: {e}"))?;
    Ok(())
}
```

### daemon 读取响应

daemon 的 `permission-ipc.js` 轮询响应文件，读取后删除，继续执行。

---

## 常见错误

### 错误 1：字段名不一致

```ts
// ❌ 前端传 request_id（snake_case），Rust 期望 requestId
await invoke('xxx', { request_id: '123' });
```

应该：
```ts
// ✅ 前端用 camelCase
await invoke('xxx', { requestId: '123' });
```

Rust 用 `#[serde(rename_all = "camelCase")]` 自动映射。

### 错误 2：事件 payload 类型不匹配

```ts
// ❌ 前端期望 { id: string }，Rust 发送 { requestId: string }
const unlisten = await listen<{ id: string }>('some-event', ...);
```

应该：
```ts
// ✅ 类型定义与 Rust 对齐
interface Payload {
    requestId: string;
}
const unlisten = await listen<Payload>('some-event', ...);
```

### 错误 3：文件 IPC 路径硬编码

```rust
// ❌ 硬编码临时目录路径
let path = PathBuf::from("/tmp/claude-permission");
```

应该：
```rust
// ✅ 用 Tauri 路径解析器获取 app data 目录
let perm_dir = app.path().app_data_dir()?.join("permissions");
```

---

## 参考

- Tauri 事件文档: https://v2.tauri.app/develop/inter-process-communication/
- serde 文档: https://serde.rs/
- permission-ipc.js: `src-tauri/resources/ai-bridge/permission-ipc.js`
