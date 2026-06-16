# Bug Analysis: daemon 管道关闭（os error 232）

## 症状
前端发送消息后，Rust 后端报错 "管道正在被关闭。 (os error 232)"，表示与 Node.js daemon 的 stdin/stdout 管道已断开。

---

## 1. Root Cause Category
- **Category**: B - Cross-Layer Contract（跨层契约）
- **Specific Cause**: 
  1. **主因（已修复）**: daemon 启动时缺少 `CLAUDE_PERMISSION_DIR` 和 `CLAUDE_SESSION_ID` 环境变量，导致权限文件 IPC 路径不一致
  2. **次因（待验证）**: daemon 可能因其他原因（依赖缺失、未捕获异常）在启动或请求处理时崩溃

---

## 2. Why Fixes Failed (if applicable)
1. **首次尝试**: 只实现了 Rust 端的 PermissionWatcher，忘记传环境变量给 daemon
   - **Why it failed**: Rust 监听 `<app-data>/permissions/`，daemon 写入 `<tmpdir>/claude-permission/`，路径不一致
2. **二次修复**: 添加环境变量后未重新构建
   - **Status**: 构建正在后台运行

---

## 3. Prevention Mechanisms
| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | **环境变量传递** | `DaemonClient::new` 添加 `permission_dir` 参数，`start()` 传递 `CLAUDE_PERMISSION_DIR` / `CLAUDE_SESSION_ID` | ✅ DONE |
| P0 | **端到端测试** | 真机测试：启动应用 → 发送 "read package.json" → 验证是否触发权限弹窗 | TODO |
| P1 | **daemon 启动日志** | daemon stderr 输出写入临时日志文件（`<temp>/ccg-switch-daemon.log`），应用崩溃时可查看 | TODO |
| P1 | **规范更新** | 在 `async-patterns.md` 添加环境变量检查清单 | ✅ DONE |
| P2 | **健康检查增强** | ChatManager 启动后发送 heartbeat，验证 daemon 响应 | TODO |

---

## 4. Systematic Expansion

### Similar Issues
- **所有跨进程协议**都面临环境变量漏传的风险
  - `AI_BRIDGE_DEPS_DIR` 已正确传递（先例）
  - 未来新增环境变量时容易忘记同步

### Design Improvement
- **daemon 启动握手协议**: daemon 在 `ready` 事件里回传接收到的关键环境变量，Rust 端验证一致性
  ```json
  {
    "type": "daemon",
    "event": "ready",
    "extra": {
      "permissionDir": "/path/received",
      "sessionId": "default"
    }
  }
  ```
  Rust 收到后与本地值对比，不一致时报警

- **管道错误增强**: 当 `write_request` 失败时，读取 daemon stderr 缓冲区并附加到错误消息
  ```rust
  .map_err(|e| format!("写入 daemon 失败: {e}\n最近 stderr: {}", read_recent_stderr()))
  ```

### Process Improvement
- **新增跨进程协议 checklist**:
  1. [ ] Rust 和 Node 双方代码都更新
  2. [ ] 环境变量/文件路径在双方对齐
  3. [ ] 编写最小可复现测试用例
  4. [ ] 更新 `cross-layer-protocol.md` 规范
  5. [ ] 运行真机端到端测试

---

## 5. Knowledge Capture
- [x] 更新 `backend/async-patterns.md` — 环境变量检查清单
- [ ] 更新 `backend/cross-layer-protocol.md` — 环境变量验证建议
- [ ] 创建 Issue: "daemon 启动日志持久化"
- [ ] PRD 验收标准增加：端到端手动测试（非仅编译通过）

---

## 6. Immediate Debug Actions

### 验证修复是否生效
1. **等待后台构建完成**
   ```bash
   tail -f C:\Users\Administrator\AppData\Local\Temp\claude\C--guodevelop-ccg-switch\56559835-3140-46a6-a20d-6b340475af5a\tasks\bqy9jmpo3.output
   ```

2. **启动应用并检查 daemon 日志**
   - 打开应用开发者工具（F12）
   - 查看 Console 里的 `chat://daemon` 事件
   - 期望看到 `{ event: 'ready', pid: xxx }`

3. **发送测试消息**
   ```
   输入: "hello"
   期望: daemon 正常响应，前端显示回复
   ```

4. **触发权限请求**
   ```
   输入: "read package.json"
   期望: 前端弹出 AskUserQuestion 对话框
   ```

### 如果仍然失败
1. **检查 daemon 是否启动**
   ```bash
   ps aux | grep daemon.js
   ```

2. **手动启动 daemon 测试**
   ```bash
   cd src-tauri/resources/ai-bridge
   node daemon.js
   # 输入: {"id":"test-1","method":"heartbeat"}
   # 期望: 输出 {"id":"test-1","type":"heartbeat",...}
   ```

3. **检查环境变量是否生效**
   在 daemon.js 添加调试输出：
   ```js
   console.error('[daemon] CLAUDE_PERMISSION_DIR:', process.env.CLAUDE_PERMISSION_DIR);
   console.error('[daemon] CLAUDE_SESSION_ID:', process.env.CLAUDE_SESSION_ID);
   ```

---

## 7. Root Fix (if env vars aren't the only issue)

如果传了环境变量仍失败，可能是：

### 可能性 A: SDK 依赖缺失
```bash
cd src-tauri/resources/ai-bridge
npm install  # 确保 node_modules 完整
```

### 可能性 B: Windows 管道缓冲区问题
在 `daemon_client.rs` 的 `write_request` 后添加延迟：
```rust
stdin.flush().await.map_err(|e| e.to_string())?;
tokio::time::sleep(Duration::from_millis(10)).await;  // 给 Windows 管道缓冲时间
```

### 可能性 C: daemon 代码本身有 bug
查看 daemon stderr（需要实现日志持久化）或在 daemon.js 里添加 try-catch。

---

## Lessons Learned

1. **跨进程协议必须双向验证** — 不能假设环境变量"应该"传了
2. **编译通过 ≠ 功能可用** — 端到端测试不可省略
3. **Windows 管道比 Unix 更脆弱** — 需要更谨慎的错误处理和缓冲管理
4. **规范文档要有 checklist** — 不是只描述"是什么"，还要列"做什么"

---

**Next Action**: 等待构建完成 → 启动应用 → 检查 daemon ready 事件 → 测试消息发送
