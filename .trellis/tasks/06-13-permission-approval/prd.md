# Permission Approval IPC + UI

## 目标

实现 daemon 权限审批的完整链路（文件 IPC + 前端弹窗），让涉及工具调用/文件写入的 AI 任务能正常运行（目前这些请求会在 daemon 侧挂起等审批，frontend 没实现接口就超时失败）。

---

## 背景

daemon (claude-agent-sdk) 在 `default` 模式下遇到需要权限的操作（文件写入、执行命令、调用工具）时，会通过**文件 IPC** 向前端请求审批。目前 ccg-switch 没实现这部分，导致：
- 涉及工具调用的任务挂起 5 分钟后超时
- `bypassPermissions` 能跳过审批但不安全（全盘放行）

jetbrains-cc-gui 的架构：daemon 写请求文件 → Java PermissionService 轮询 → 调 PermissionHandler → 注入 JS 弹窗 → 用户回答 → 写响应文件 → daemon 读取继续执行。

---

## 核心协议（已验证，基于 permission-ipc.js）

### 1. AskUserQuestion（工具调用审批 / 用户问答）

**daemon → frontend（请求文件）**
- 路径: `<PERMISSION_DIR>/ask-user-question-<sessionId>-<requestId>.json`
- 格式:
  ```json
  {
    "requestId": "ask-<uuid>",
    "toolName": "AskUserQuestion",
    "questions": [
      {
        "question": "Which option?",
        "header": "Choose",
        "options": [
          { "label": "Option A", "description": "..." },
          { "label": "Option B", "description": "..." }
        ],
        "multiSelect": false
      }
    ],
    "timestamp": "2026-06-13T...",
    "cwd": "/path/to/project"
  }
  ```

**frontend → daemon（响应文件）**
- 路径: `<PERMISSION_DIR>/ask-user-question-response-<sessionId>-<requestId>.json`
- 格式:
  ```json
  {
    "requestId": "ask-<uuid>",
    "answers": {
      "Which option?": "Option A"
    }
  }
  ```

### 2. PlanApproval（计划模式退出审批）

**daemon → frontend（请求文件）**
- 路径: `<PERMISSION_DIR>/plan-approval-<sessionId>-<requestId>.json`
- 格式:
  ```json
  {
    "requestId": "plan-<uuid>",
    "toolName": "ExitPlanMode",
    "plan": "# Step 1\n...\n# Step 2\n...",
    "allowedPrompts": [
      { "tool": "Read", "prompt": "Allow reading *.ts" },
      { "tool": "Edit", "prompt": "Allow editing src/**" }
    ],
    "timestamp": "2026-06-13T...",
    "cwd": "/path/to/project"
  }
  ```

**frontend → daemon（响应文件）**
- 路径: `<PERMISSION_DIR>/plan-approval-response-<sessionId>-<requestId>.json`
- 格式:
  ```json
  {
    "requestId": "plan-<uuid>",
    "approved": true,
    "targetMode": "default",
    "message": "User approved with modifications"
  }
  ```

### 环境变量（daemon 启动时传入）

- `CLAUDE_PERMISSION_DIR` — 权限文件目录（默认 `<tmpdir>/claude-permission`）
- `CLAUDE_SESSION_ID` — 会话 ID（与 daemon 通信的 sessionId 一致）

---

## 实现方案

### Phase 1 — Rust 文件 IPC 监听器

**新增模块**: `src-tauri/src/chat/permission_watcher.rs`

职责：轮询 `PERMISSION_DIR`，发现请求文件后解析 JSON 并通过 Tauri 事件推送给前端。

#### 数据结构

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AskUserQuestionRequest {
    pub request_id: String,
    pub tool_name: String,
    pub questions: Vec<Question>,
    pub timestamp: String,
    pub cwd: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub question: String,
    pub header: String,
    pub options: Vec<QuestionOption>,
    pub multi_select: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct QuestionOption {
    pub label: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanApprovalRequest {
    pub request_id: String,
    pub tool_name: String,
    pub plan: String,
    pub allowed_prompts: Vec<AllowedPrompt>,
    pub timestamp: String,
    pub cwd: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AllowedPrompt {
    pub tool: String,
    pub prompt: String,
}
```

#### 核心方法

```rust
pub struct PermissionWatcher {
    permission_dir: PathBuf,
    session_id: String,
    app: AppHandle<R>,
    stop: Arc<AtomicBool>,
}

impl PermissionWatcher {
    pub fn new(permission_dir: PathBuf, session_id: String, app: AppHandle) -> Self;
    
    /// 启动轮询线程（100ms interval）
    pub fn start(&self);
    
    /// 停止轮询
    pub fn stop(&self);
    
    /// 单次轮询：扫描请求文件，解析后推送 Tauri 事件，删除请求文件
    fn poll_once(&self);
    
    /// 列出 ask-user-question 请求文件
    fn list_ask_user_question_requests(&self) -> Vec<PathBuf>;
    
    /// 列出 plan-approval 请求文件
    fn list_plan_approval_requests(&self) -> Vec<PathBuf>;
    
    /// 解析并推送 AskUserQuestion 事件
    fn handle_ask_user_question(&self, file: PathBuf);
    
    /// 解析并推送 PlanApproval 事件
    fn handle_plan_approval(&self, file: PathBuf);
}
```

#### Tauri 事件

```rust
// 推送给前端的事件
app.emit("permission://ask-user-question", AskUserQuestionRequest);
app.emit("permission://plan-approval", PlanApprovalRequest);
```

#### Tauri 命令（前端回应）

```rust
#[tauri::command]
pub async fn permission_respond_ask_user_question(
    request_id: String,
    answers: HashMap<String, String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    // 写 ask-user-question-response-<sessionId>-<requestId>.json
}

#[tauri::command]
pub async fn permission_respond_plan_approval(
    request_id: String,
    approved: bool,
    target_mode: String,
    message: Option<String>,
    state: State<'_, ChatState>,
) -> Result<(), String> {
    // 写 plan-approval-response-<sessionId>-<requestId>.json
}
```

#### 集成到 ChatManager

```rust
// ChatManager 新增字段
pub struct ChatManager {
    // ...
    permission_watcher: OnceCell<PermissionWatcher>,
}

// 在 warm_up / ensure_client 时启动 watcher
async fn ensure_client(&self) -> Result<Arc<DaemonClient>, String> {
    // ...
    if self.permission_watcher.get().is_none() {
        let watcher = PermissionWatcher::new(
            resources::permission_dir(&self.app)?,
            SESSION_ID.to_string(),
            self.app.clone(),
        );
        watcher.start();
        let _ = self.permission_watcher.set(watcher);
    }
    // ...
}
```

---

### Phase 2 — 前端 UI

**新增组件**:
- `src/components/chat/AskUserQuestionDialog.tsx` — 工具审批弹窗
- `src/components/chat/PlanApprovalDialog.tsx` — 计划审批弹窗

**状态管理**:
- `useChatStore` 新增：
  - `pendingAskUserQuestion: AskUserQuestionRequest | null`
  - `pendingPlanApproval: PlanApprovalRequest | null`
  - 监听 `permission://ask-user-question` / `permission://plan-approval` 事件
  - 方法: `answerAskUserQuestion(answers)` / `approvePlan(approved, targetMode)`

#### AskUserQuestionDialog UI（DaisyUI）

- 标题: `request.questions[0].header`（或 "Tool Permission"）
- 问题列表: 每个 question 显示 question text + radio/checkbox 选项组
- 按钮: Cancel（全拒绝，answers={}） / Submit（提交选中答案）

#### PlanApprovalDialog UI（DaisyUI）

- 标题: "Review Plan"
- 内容:
  - Plan 预览（markdown 渲染或 `<pre>`，可折叠）
  - Allowed Prompts 列表（tool + prompt，badge 风格）
- 按钮:
  - Deny（approved=false, targetMode="default"）
  - Approve（approved=true, targetMode="default"）
  - Approve & Switch to Auto（approved=true, targetMode="auto"）

---

## 验收标准

- [x] Rust `permission_watcher` 能监听文件目录，解析请求并推送 Tauri 事件
- [x] 前端收到 `permission://ask-user-question` 事件时弹出对话框
- [x] 用户回答后写入响应文件，daemon 能继续执行（写入逻辑已实现）
- [x] 前端收到 `permission://plan-approval` 事件时弹出计划审批弹窗
- [ ] 端到端：在 ChatPage 发送一个需要工具调用的请求（如 "read package.json"），
      能看到审批弹窗，点 approve 后 daemon 继续并返回结果（需真机测试）
- [x] `cargo check` / `tsc --noEmit` / 单元测试通过（cargo check=0, tsc=0, vite build 通过）

---

## Notes

- `PERMISSION_DIR` 默认为 `<tmpdir>/claude-permission-<random>`（每次启动新目录），
  sessionId 目前硬编码为 `"default"`（后续可改成随机 UUID）
- daemon 轮询响应文件的超时是 5 分钟（permission-ipc.js: `PERMISSION_REQUEST_SAFETY_NET_MS`），
  前端 UI 需在 5 分钟内响应，否则 daemon 视为拒绝
- 计划模式的 `targetMode` 可选值: `"default"` / `"auto"` / `"bypassPermissions"`
- jetbrains-cc-gui 有「记住决策」功能（PermissionDecisionStore），暂不实现
