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

### Chat 停止输出系统通知

聊天任务完成、失败或用户显式中断后，前端统一通过
`src/utils/desktopNotification.ts` 发起系统通知。Tauri 桌面运行时必须优先
调用薄命令 `chat_show_system_notification`，由 Rust 侧使用
`tauri-plugin-notification` 发送操作系统原生通知；WebView
`Notification` 只作为非 Tauri 环境或命令失败时的兜底。

前端调用：
```ts
await invoke('chat_show_system_notification', {
    title: 'CCG Switch',
    body: 'Codex 任务已完成：...',
});
```

Rust 命令：
```rust
#[tauri::command]
pub fn chat_show_system_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title.trim())
        .body(body.trim())
        .show()
        .map_err(|e| format!("发送系统通知失败: {e}"))
}
```

**要点**：
- `src-tauri/Cargo.toml` 必须包含 `tauri-plugin-notification`，`lib.rs` 必须
  `.plugin(tauri_plugin_notification::init())`。
- Window capability 需要包含 `notification:default`，保持文件型 capability
  与 `tauri.conf.json` 内联 capability 一致。
- 该命令只负责通知，不修改聊天状态；`chat://done`、发送失败和 `abort()`
  的状态更新仍归 `useChatStore` 处理。
- 通知内容由前端统一清洗和截断，Rust 不解析 provider/outcome，避免跨层文案漂移。

---

## 2. Tauri 事件协议

### 事件命名规范

模式：`{domain}://{event}`

| 事件名 | 方向 | Payload 类型 | 说明 |
|--------|------|-------------|------|
| `chat://stream` | 后端 → 前端 | `ChatStreamEvent` | 流式响应行 |
| `chat://done` | 后端 → 前端 | `ChatDoneEvent` | 请求完成/失败 |
| `chat://daemon` | 后端 → 前端 | `ChatDaemonEvent` | daemon 生命周期事件 |
| `permission://tool` | 后端 → 前端 | `ToolPermissionRequest` | 普通工具权限请求（Bash/Edit/MCP 等） |
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

- `request-<sessionId>-<requestId>.json`
- `ask-user-question-<sessionId>-<requestId>.json`
- `plan-approval-<sessionId>-<requestId>.json`

示例：`ask-user-question-default-ask-a1b2c3.json`

#### 响应文件（Rust 写入）

- `response-<sessionId>-<requestId>.json`
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

### Generic Tool Permission 协议

#### 请求（daemon → Rust）

普通工具权限走 cc-gui 兼容的 `request-<sessionId>-<requestId>.json`，覆盖
`Bash`、`Edit`、`Write`、MCP 工具（例如 `mcp__chrome-devtools__new_page`）等
非 ask/plan 的显式审批请求。Rust watcher 必须监听该文件族；否则 Node 会一直
等待 `response-*` 文件，前端没有弹窗，表现为工具 pending 或“假死”。

```json
{
  "requestId": "f1d2d2f9-...",
  "toolName": "mcp__chrome-devtools__new_page",
  "inputs": {
    "url": "https://www.baidu.com"
  },
  "timestamp": "2026-06-18T09:00:00.000Z",
  "cwd": "C:/guodevelop/ccg-switch"
}
```

**字段契约**：
- `requestId`: 必填，直接用于响应文件名。
- `toolName`: 必填，展示给用户并用于审计。
- `inputs`: 可缺省；Rust 侧归一化为 `{}`，非对象输入也归一化为 `{}`，避免解析失败导致请求文件反复滞留。
- `timestamp` / `cwd`: 必填；用于展示与诊断，不参与文件名。

#### 响应（Rust → daemon）

普通工具响应文件名是 `response-<sessionId>-<requestId>.json`，内容只包含
严格布尔字段 `allow`。`permission-ipc.js` 只把显式 `true` 视为允许；缺失、
字符串 `"true"`、数字 `1`、JSON 解析失败都视为拒绝。

```json
{
  "allow": true
}
```

拒绝：
```json
{
  "allow": false
}
```

#### 前端状态链路

- Rust emit：`permission://tool`
- Payload 类型：`ToolPermissionRequest`
- Zustand 字段：`pendingToolPermission`
- Tauri command：`permission_respond_tool`
- Command 参数：`{ requestId: string, allow: boolean }`

#### 验证要求

- Unit test: `permission_watcher` 写出的 `response-default-<id>.json` 必须严格等于 `{ allow: true|false }` 语义。
- Unit test: `ToolPermissionRequest` 缺失或异常 `inputs` 不应阻断解析，需归一为 `{}`。
- Frontend store test: 触发 `permission://tool` 后设置 `pendingToolPermission`，调用 `answerToolPermission()` 后 invoke `permission_respond_tool` 并清空 pending。
- Build check: `npm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 必须通过。

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

## Scenario: Unified Session History Raw Blocks

### 1. Scope / Trigger

- Trigger: `get_unified_session_messages` loads historical Claude/Codex/Gemini
  sessions for the Chat page.
- This is a cross-layer command contract. The frontend transcript renderer
  needs structured `thinking`, `tool_use`, and `tool_result` blocks; plain text
  `content` alone is not enough to reconstruct tool UI safely.
- Related list command: `list_sessions(projectPath)` must avoid reading full
  Codex histories for unrelated projects. Codex JSONL files should be filtered
  by `session_meta.payload.cwd` before extracting titles or summaries, because
  active Codex sessions can contain thousands of tool records and patch items.
  The Codex session provider may cache per-file metadata in process memory, but
  the cache key must include the JSONL path plus file length/modified timestamp.
  A project-mismatched scan may cache only `cwd` and timestamps without reading
  the title; if the user later selects that matching project, the provider must
  reopen that file once to fill the title and then refresh the cache entry.
  The provider may also cache the recursive `.codex/sessions` JSONL file list
  itself. That cache must be invalidated by a directory-tree stamp, not only by
  the project filter, so switching projects can reuse enumeration work while a
  newly created/deleted session under an existing date directory is detected by
  the changed directory modified timestamp. File content freshness remains the
  responsibility of the per-file metadata cache.

### 2. Signatures

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedSessionMessage {
    pub role: String,
    pub content: String,
    pub ts: Option<String>,
    pub raw: Option<serde_json::Value>,
}
```

```ts
interface UnifiedSessionMessage {
    role: string;
    content: string;
    ts?: string | null;
    raw?: MessageRaw | null;
}
```

### 3. Contracts

- `raw` is optional for providers that cannot supply structured blocks, but
  Claude and Codex history loaders must preserve or synthesize it whenever the
  source history includes structured content.
- Claude JSONL history preserves the original message JSON in `raw`.
- Codex native `response_item.payload` is adapted into the same frontend
  `MessageRaw.message.content[]` shape:
  - message text items -> `text`
  - reasoning summaries/content -> `thinking`
  - `function_call` -> `tool_use`
  - `function_call_output` -> `tool_result`
  - `custom_tool_call` -> `tool_use`
  - `custom_tool_call_output` -> `tool_result`
- Codex patch history must stay structured. `custom_tool_call` records named
  `apply_patch` and `function_call` records named `apply_patch` must become
  `tool_use` blocks named `apply_patch` with `input.patch`. `function_call`
  records named `exec_command` / `shell_command` / `shell` that contain a
  `*** Begin Patch` ... `*** End Patch` payload must also be normalized to the
  same `apply_patch` shape. This allows the frontend status panel and edit tool
  blocks to reuse the shared `collectEditToolItems()` path and show file
  additions/deletions in historical Codex sessions.
- Messages that contain only `thinking`, `tool_use`, or `tool_result` must not
  be dropped just because visible text is empty.
- User `tool_result` history messages use visible `content === "[tool_result]"`
  and keep the real result inside `raw` so the frontend can hide the internal
  protocol row while still resolving tool status.
- Codex control/user-context markers such as `<turn_aborted>`, `<user_action>`,
  `<subagent_notification>`, `<agents-instructions>`, and `<skill>` are not real
  human prompts. The Codex provider must treat them as system instruction text
  when extracting session titles, and the frontend shared protocol-context
  predicate must hide them from transcript rendering and anchor generation.
- Model handoff summaries such as `Another language model started to solve this
  problem...` and `## Handoff Summary` are also protocol context. They may be
  useful to the agent runtime, but they must not become visible transcript rows,
  search hits, anchor targets, or provider-switch handoff prompt content.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Claude line has `message.content[]` with only `tool_use` | Return a `UnifiedSessionMessage` with `raw`, even if visible text is empty. |
| Claude line has user `tool_result` | Return `content === "[tool_result]"` and preserve raw content. |
| Codex line has `reasoning` payload | Convert it to a `thinking` block in `raw`. |
| Codex line has `function_call` | Convert it to a `tool_use` block with `id`, `name`, and `input`. |
| Codex line has `function_call_output` | Convert it to a `tool_result` block with `tool_use_id`, `content`, and `is_error`. |
| Codex line has `custom_tool_call/apply_patch` with string `input` | Convert it to `tool_use` named `apply_patch` with `input.patch`; do not drop it as an unknown payload type. |
| Codex line has `custom_tool_call_output` | Convert it to `tool_result` and preserve `call_id` as `tool_use_id` so the patch status becomes completed/error. |
| Codex line has `exec_command` / `shell_command` arguments containing `*** Begin Patch` | Extract the patch body and convert the call to `tool_use` named `apply_patch`. |
| `list_sessions(projectPath)` scans Codex history | Read enough to compare `session_meta.payload.cwd` first; only matching project files should continue into title extraction. |
| Codex user message is a control marker such as `<turn_aborted>` or `<user_action>` | Do not use it as the primary session title, transcript row, search text, or anchor target. |
| Provider cannot supply raw structure | Return `raw: None` / `raw?: null`; frontend falls back to text. |
| Invalid history payload | Skip or normalize the bad record without panicking. |

### 5. Good/Base/Bad Cases

- Good: loading a Claude history shows thinking, read/search/run/edit tool
  blocks, and completed/error status from later `tool_result` rows.
- Base: plain text history still maps to visible text messages and can omit
  `raw`.
- Bad: flattening `message.content[]` into one long text string; the UI can no
  longer render tool blocks or hide internal tool results.

### 6. Tests Required

- Rust unit test: Claude provider preserves `thinking`, `tool_use`, and
  `tool_result` raw blocks.
- Rust unit test: Codex provider converts `reasoning`, `function_call`, and
  `function_call_output` into unified raw content blocks.
- Rust unit test: Codex provider converts `custom_tool_call/apply_patch` and
  its `custom_tool_call_output` into matching `tool_use/tool_result` blocks.
- Rust unit test: Codex provider converts embedded patch commands from
  `exec_command` / `shell_command` into `apply_patch` tool_use blocks.
- Rust unit test: Codex provider classifies protocol/control markers as system
  instruction text for title extraction.
- Frontend unit test: `loadSession()` maps `UnifiedSessionMessage.raw` back to
  `ChatMessage.raw` and `findToolResult()` resolves the later result block.
- Frontend unit test: `shouldRenderChatMessage()` and `isMessageAnchorCandidate()`
  exclude Codex control markers.
- Frontend unit test: `buildChatStatusSummary()` counts normalized Codex
  `apply_patch` history as recent edits with additions/deletions.
- Build check: `npm run build` and `cargo check --manifest-path
  src-tauri/Cargo.toml` must pass because this spans Rust serde and TypeScript
  store/rendering contracts.

### 7. Wrong vs Correct

#### Wrong

```rust
UnifiedSessionMessage {
    role,
    content: flatten_text_only(&message),
    ts,
}
```

#### Correct

```rust
UnifiedSessionMessage {
    role,
    content: visible_text_or_protocol_marker(&message),
    ts,
    raw: Some(original_or_adapted_message_raw),
}
```

---

## Scenario: Editor Open File Command

### 1. Scope / Trigger

- Trigger: tool blocks render clickable file paths and `Open File` actions for
  Read/Edit/Generic file tools in live and historical chats.
- This is a cross-layer command contract because frontend tool inputs often
  contain project-relative paths, while the Rust backend must launch an editor
  with an absolute Windows-compatible path.

### 2. Signatures

```ts
async function openFile(
    filePath: string,
    lineStart?: number,
    lineEnd?: number,
    cwd?: string | null,
): Promise<void>;
```

```rust
#[tauri::command]
pub async fn open_file_in_editor(
    file_path: String,
    line_start: Option<u32>,
    line_end: Option<u32>,
    cwd: Option<String>,
) -> Result<(), String>;
```

### 3. Contracts

- Frontend callers must pass the current project `cwd` when the tool path may
  be relative.
- Frontend callers must decode percent-encoded navigation targets before
  invoking the backend. A path such as `src/my%20file.ts` should reach Rust as
  `src/my file.ts`, not as a literal encoded string.
- Backend resolves relative `file_path` against `cwd` only when `cwd` is an
  absolute path; otherwise it falls back to the provided `file_path`.
- If `cwd + file_path` does not exist and `file_path` is relative, backend
  performs a bounded project search under `cwd` by filename and path suffix.
  This covers history/tool outputs that only carry `linkify.ts` or
  `utils/linkify.ts` while the real file is `src/utils/linkify.ts`. Generated
  dependency/build folders such as `.git`, `node_modules`, `target`, and `dist`
  must be skipped so the fallback stays responsive.
- Backend normalizes Windows slash-drive paths such as `/c/project/file.ts` to
  `C:\project\file.ts`.
- Backend normalizes WSL mount paths such as `/mnt/c/project/file.ts` to
  `C:\project\file.ts` on Windows.
- Frontend and backend both strip editor suffixes before launch:
  `file.ts:12` and `file.ts:12:3` open `file.ts` at line `12`; `file.ts:12-20`
  opens the file with start line `12` and may preserve `20` as an end-line hint
  for UI display.
- Backend accepts `file://` / `file:///C:/...` inputs as a defensive fallback
  for file links copied from browser-style contexts.
- Backend opens editors in this order:
  1. PATH launchers (`code`, `cursor`, `idea`, `webstorm`, and related `.cmd`
     / `.exe` names)
  2. common VS Code/Cursor install paths
  3. JetBrains Toolbox scripts and app executables
  4. `Program Files\JetBrains` app executables
  5. OS default file opener as a final fallback
- VS Code/Cursor-style editors receive `--goto <path>:<line>:1`; JetBrains
  editors receive `--line <line> <path>`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| `filePath` is relative and `cwd` is absolute | Join `cwd + filePath` before launch. |
| `filePath` is relative, `cwd + filePath` is missing, and a project file with the same filename/path suffix exists | Launch the best bounded fuzzy match under `cwd`. |
| The only filename match is in generated dependency/build folders | Ignore that match and keep the direct `cwd + filePath` fallback. |
| `filePath` is absolute | Use it directly; do not prepend `cwd`. |
| `filePath` is `/c/...` on Windows | Convert to `C:\...` before launch. |
| `filePath` is `/mnt/c/...` on Windows | Convert to `C:\...` before launch. |
| `filePath` has `:line`, `:line:column`, or `:line-endLine` suffix | Strip the suffix before editor launch and use the parsed start line when `lineStart` is absent. |
| `filePath` has a `file://` prefix | Strip the URL prefix before normalization. |
| `filePath` contains valid percent encoding | Decode it before backend invocation so editors receive the real filesystem path. |
| `filePath` contains malformed percent encoding or control characters | Do not invoke the backend; return a local failure from the bridge. |
| Editor is installed through JetBrains Toolbox but not on PATH | Discover the executable under Toolbox roots and launch it. |
| No known editor can be spawned | Try OS default opener. |
| OS default opener also fails | Return `Err("Failed to open file in editor: ...")`. |

### 5. Good/Base/Bad Cases

- Good: clicking `src/pages/ChatPage.tsx` in a loaded history session opens
  `C:\guodevelop\ccg-switch\src\pages\ChatPage.tsx` in the available editor.
- Base: clicking an absolute `C:\...` path works without `cwd`.
- Bad: sending a relative path to `code --goto` from the Tauri process working
  directory; the editor opens nothing or the wrong file.

### 6. Tests Required

- Rust unit test: relative paths resolve against `cwd`.
- Rust unit test: slash-drive Windows paths normalize to `C:\...`.
- Rust unit test: WSL `/mnt/c/...` paths normalize to `C:\...`.
- Rust unit test: editor `:line:column` suffixes are stripped before path
  resolution and the line is reused when no explicit `lineStart` is provided.
- Rust unit test: nested Toolbox executables are discoverable with bounded
  recursion.
- Frontend unit test: `openFile()` decodes percent-encoded navigation paths,
  strips `file://` wrappers, parses `:line` / `:line:column` / `:line-endLine`
  suffixes, and preserves `cwd` in the invoke payload.
- Frontend unit test: `resolveToolTarget()` strips `:line:column` from
  clickable paths while retaining the parsed start line.
- Frontend unit test: search output parsing extracts clickable files and line
  numbers from both relative and Windows result rows.
- Frontend build check: `npm run build` must pass so all `openFile(...)` call
  sites stay aligned with the bridge signature.

### 7. Wrong vs Correct

#### Wrong

```ts
openFile(target.openPath);
```

```rust
Command::new("code").args(["--goto", &file_path]).spawn()?;
```

#### Correct

```ts
openFile(target.openPath, lineInfo.start, lineInfo.end, currentCwd);
```

```rust
let resolved_path = resolve_file_path(&file_path, cwd.as_deref());
let args = editor_args(candidate.mode, &resolved_path, &goto, line_start);
Command::new(candidate.program).args(args).spawn()?;
```

---

## Scenario: Chat Image Attachment Payloads

### 1. Scope / Trigger

- Trigger: the Chat composer accepts pasted, dropped, or file-picker images and
  sends them to Claude/Codex through `chat_send`.
- This is a cross-layer command contract. The visible attachment chip is not the
  payload; the image bytes or local path must survive from React state to the
  Node bridge.

### 2. Signatures

```ts
interface ChatAttachment {
    fileName: string;
    mediaType: string;
    data?: string; // base64 without data: prefix
    path?: string; // Tauri/WebView local path when available
    size?: number;
}
```

```ts
await invoke<string>('chat_send', {
    provider,
    command: provider === 'claude' && hasAttachments ? 'sendWithAttachments' : 'send',
    params: {
        message,
        attachments,
        // session/thread/cwd/model fields omitted here
    },
});
```

### 3. Contracts

- The composer reads supported image files (`image/png`, `image/jpeg`,
  `image/webp`, `image/gif`) into base64 `ChatAttachment.data`; if the WebView
  exposes a local `path`, preserve it too.
- The composer may show `[Image: name]` / `[图片: name]` in the visible user
  message, but it must never prepend `@filename` as a substitute for the image
  payload.
- `useChatStore.send()` accepts attachment-only sends. When text is empty it
  sends the internal fallback prompt `Please analyze the attached image(s).`
  while keeping the visible user message as the attachment chip text.
- Claude image sends use command `sendWithAttachments`; the Claude bridge builds
  native vision blocks for vision-capable models and temp-file references for
  non-vision models.
- Codex sends keep local paths as `{ type: "local_image", path }`.
- If Codex receives base64 image data without a local path, the Node bridge must
  save the image to the shared temp image directory and convert it to
  `{ type: "local_image", path }` before calling the Codex SDK.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| User sends text + PNG | Visible message shows text plus image label; provider payload includes real attachment data/path. |
| User sends image only | `chat_send` is still invoked with fallback message and attachment payload. |
| Claude provider has image attachment | `command === "sendWithAttachments"` and `params.attachments[]` contains `fileName`, `mediaType`, `data`. |
| Codex provider has local image path | Store maps it to `{ type: "local_image", path }`. |
| Codex provider has only base64 | Node bridge persists it to temp and passes a `local_image` path to the SDK. |
| Unsupported file type is dropped by the composer | It must not create a misleading chip or `@filename` prompt prefix. |

### 5. Tests Required

- Frontend unit test: Claude attachments call `sendWithAttachments`.
- Frontend unit test: Codex local paths map to `local_image`.
- Frontend unit test: Codex base64 attachments remain in `params.attachments`
  and attachment-only sends still invoke `chat_send`.
- Bridge verification: `normalizeCodexImageAttachments()` persists base64 image
  data and returns a `local_image` path.

---

## Scenario: Chat Historical Image Block Rendering

### 1. Scope / Trigger

- Trigger: loading Claude/Codex historical sessions into the Chat transcript.
- This is a cross-layer display contract: session providers preserve raw
  content blocks, Zustand stores them on `ChatMessage.raw`, and React renders
  the same structured payload instead of relying on filename text.

### 2. Signatures

```ts
interface ImageBlock {
    type: 'image' | 'input_image';
    source?: {
        type?: string;
        media_type?: string;
        mediaType?: string;
        data?: string;
        url?: string;
        path?: string;
    };
    media_type?: string;
    mediaType?: string;
    data?: string;
    url?: string;
    path?: string;
    image_url?: string | { url?: string; path?: string; detail?: string };
    fileName?: string;
    name?: string;
}

type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;
```

### 3. Contracts

- Claude raw image history may arrive as
  `{ type: "image", source: { type: "base64", media_type, data } }`.
- Claude history providers must treat `image` and `input_image` as structured
  content. A message with only image blocks and no text must still return a
  `UnifiedSessionMessage` with `raw`.
- Codex-style image history may arrive as `input_image`, `image_url`, `url`, or
  local `path`; Codex history providers must preserve these blocks in
  `raw.message.content[]`, and the frontend must normalize them through shared
  helpers before rendering.
- If a Codex history `message.content[]` array contains a real `image` /
  `input_image` block plus pure wrapper text such as `<image name=...>` or
  `</image>`, the provider must drop only those placeholder text blocks from
  unified `raw.message.content[]` and top-level visible `content`. Keep the
  actual image block and any real user prompt text. Do not treat arbitrary
  XML-looking user text as a placeholder unless the same message has a real
  image block.
- `useChatStore.send()` must attach a raw user message for images sent in the
  current UI turn, so live messages and loaded history use the same renderer.
- `shouldRenderChatMessage()` must hide `role === "system"` messages. System
  prompts are protocol context and must not appear in transcript, anchors, or
  provider handoff context.
- Anchor/search projections should consume raw `image` blocks and produce a
  meaningful label such as `图片 screen.png`, instead of falling back to a blank
  generic anchor.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Raw user message contains base64 `image` | Transcript shows an image thumbnail and click-to-enlarge works. |
| Raw user message contains local image path | Renderer converts the path for Tauri asset loading when possible. |
| Raw image source is `file:///C:/...` | Renderer strips the file URL wrapper before calling Tauri asset conversion. |
| Image block has metadata but no loadable source | Show a low-contrast fallback label, not an unknown-block warning. |
| Claude history line contains only `image/input_image` blocks | Return the message with empty visible `content` and preserved `raw`; do not skip it. |
| Codex history message content contains `input_image` | Preserve the image block in unified `raw`; do not drop it while extracting text. |
| Codex history message contains `<image name=...>`, `input_image`, `</image>`, and prompt text | Drop the wrapper text, preserve the `input_image`, and expose only the real prompt in visible `content`. |
| History contains `role: "system"` | Message is filtered from transcript and handoff context. |
| Image-only user message has empty top-level content | Message remains renderable because raw image blocks are visible content. |

### 5. Good/Base/Bad Cases

- Good: a historical screenshot message renders as the original thumbnail and
  anchors say `图片 screen.png`.
- Base: text-only historical messages continue to render from text blocks or
  top-level content.
- Bad: rendering `[Image: screen.png]` as plain Markdown text; the user cannot
  inspect the image and the AI's visual answer appears disconnected from the UI.

### 6. Tests Required

- Frontend unit test: image content blocks render as thumbnail HTML.
- Frontend unit test: `file:///C:/...` image URLs are normalized before Tauri
  asset conversion.
- Frontend unit test: current image sends store raw `image` blocks on the user
  message.
- Frontend unit test: anchor/search projections include image labels.
- Frontend unit test: Codex image wrapper text is excluded from renderable
  blocks, merged visible content, search text, and anchor labels when a real
  image block exists in the same raw message.
- Frontend unit test: system messages are excluded from renderable messages.
- Rust unit test: Claude image-only history lines are preserved with `raw`.
- Rust unit test: Codex `input_image` message content is preserved with `raw`.
- Rust unit test: Codex `input_text` image wrappers around an `input_image`
  are dropped while preserving the image block and real prompt text.
- Build check: `npm run build` must pass after changing the `ContentBlock`
  union.

### 7. Wrong vs Correct

#### Wrong

```ts
const displayText = `[Image: ${fileName}]`;
const userMsg = { role: 'user', content: displayText };
```

#### Correct

```ts
const userMsg = {
    role: 'user',
    content: displayText,
    raw: {
        type: 'user',
        message: {
            content: [
                { type: 'text', text },
                { type: 'image', source: { type: 'base64', media_type, data } },
            ],
        },
    },
};
```

---

## Scenario: Chat Slash Command Registry

### 1. Scope / Trigger

- Trigger: the Chat composer opens `/` completions.
- This is a cross-layer command contract. The frontend menu should reflect
  provider-specific built-ins and project command files, so it must not depend on
  a tiny React-only list.

### 2. Signatures

```ts
await invoke<SlashCommandPayload[]>('chat_list_slash_commands', {
    cwd,
    provider,
});

interface SlashCommandPayload {
    id: string;
    name: string; // includes the leading slash
    description: string;
    source: string; // local | builtin | bundled | project | ...
}
```

```rust
#[tauri::command]
pub fn chat_list_slash_commands(
    cwd: Option<String>,
    provider: Option<String>,
) -> Result<Vec<SlashCommandItem>, String>
```

### 3. Contracts

- Claude built-ins should stay aligned with cc-gui's `SlashCommandRegistry`
  GUI-relevant commands: `/compact`, `/context`, `/init`, `/plan`, `/resume`,
  `/review`, `/batch`, `/claude-api`, `/debug`, `/loop`, `/simplify`, and
  `/update-config`, plus frontend-local `/clear` and `/help`.
- Codex built-ins should include GUI-relevant commands such as `/compact`,
  `/diff`, `/init`, `/plan`, and `/review`, plus frontend-local `/clear` and
  `/help`.
- The backend scans `.claude/commands/**/*.md` from the current `cwd` upward,
  with bounded recursion and result count. A file at
  `.claude/commands/review/deep.md` becomes `/review:deep`; YAML frontmatter
  `description` becomes the completion description.
- The frontend may keep an internal fallback list for backend failures, but it
  should call `chat_list_slash_commands` first and normalize backend `name` /
  `label` / `id` forms into `CompletionItem`s.

### 4. Validation Matrix

| Condition | Required behavior |
|-----------|-------------------|
| User types `/` in Claude mode | Completion list includes `/context`, `/plan`, `/resume`, and bundled commands such as `/batch`. |
| User types `/` in Codex mode | Completion list includes `/diff` and Codex-safe built-ins. |
| Project has `.claude/commands/review/deep.md` | Completion list includes `/review:deep` with `[project]` source suffix. |
| Backend command fails | Frontend falls back to its cc-gui-aligned built-in list, not an empty menu. |

### 5. Tests Required

- Frontend unit test: empty slash query includes cc-gui parity built-ins.
- Frontend unit test: slash query filters by label and description.
- Frontend unit test: backend-provided project command payload normalizes to a
  selectable `CompletionItem`.
- Rust unit test: Claude and Codex built-in registries return provider-specific
  commands.
- Rust unit test: project `.claude/commands/**/*.md` files are scanned into
  namespaced slash commands.

---

## 参考

- Tauri 事件文档: https://v2.tauri.app/develop/inter-process-communication/
- serde 文档: https://serde.rs/
- permission-ipc.js: `src-tauri/resources/ai-bridge/permission-ipc.js`
