//! High-level chat orchestration: owns the DaemonClient, lazily starts it,
//! forwards streamed lines and lifecycle events to the frontend via Tauri
//! events, and runs the heartbeat loop.
//!
//! Frontend event channels (listen on these):
//!   "chat://stream"    — { requestId, kind: "line"|"stderr", text }
//!   "chat://done"      — { requestId, success, error? }
//!   "chat://daemon"    — { event, pid?, message?, provider? }

use std::sync::Arc;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::OnceCell;

use super::daemon_client::DaemonClient;
use super::resources;
use super::permission_watcher::PermissionWatcher;

pub struct ChatManager {
    app: AppHandle,
    client: OnceCell<Arc<DaemonClient>>,
    permission_watcher: OnceCell<PermissionWatcher<tauri::Wry>>,
}

impl ChatManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            client: OnceCell::new(),
            permission_watcher: OnceCell::new(),
        }
    }

    /// Access the app handle (for commands needing it).
    pub fn app(&self) -> &AppHandle {
        &self.app
    }

    /// Get the daemon client, starting the daemon on first use.
    async fn client(&self) -> Result<Arc<DaemonClient>, String> {
        self.client
            .get_or_try_init(|| async {
                let node = resources::detect_node()?;
                let bridge = resources::resolve_bridge_dir(&self.app)?;
                let deps = resources::deps_dir(&self.app)?;
                let perm_dir = resources::permission_dir(&self.app)?;

                // Read active Provider for Claude
                let (api_key, base_url) = self.get_active_provider_config().await?;

                let client = Arc::new(DaemonClient::new(
                    node,
                    bridge,
                    deps,
                    perm_dir,
                    api_key,
                    base_url,
                ));

                // Forward lifecycle events to the frontend.
                let app = self.app.clone();
                client
                    .set_event_sink(Arc::new(move |ev| {
                        let _ = app.emit(
                            "chat://daemon",
                            json!({
                                "event": ev.event,
                                "pid": ev.pid,
                                "message": ev.message,
                                "provider": ev.provider,
                            }),
                        );
                    }))
                    .await;

                client.start().await?;
                Self::spawn_heartbeat(client.clone());

                // Start permission watcher (only once, on first daemon start).
                if self.permission_watcher.get().is_none() {
                    let perm_dir = resources::permission_dir(&self.app)?;
                    let watcher = PermissionWatcher::new(
                        perm_dir,
                        "default".to_string(), // TODO: use random session ID
                        self.app.clone(),
                    );
                    watcher.start();
                    let _ = self.permission_watcher.set(watcher);
                }

                Ok::<Arc<DaemonClient>, String>(client)
            })
            .await
            .map(|c| c.clone())
    }

    /// Get active Provider config (API Key and base URL)
    async fn get_active_provider_config(&self) -> Result<(Option<String>, Option<String>), String> {
        let state = self.app.state::<crate::store::AppState>();
        let db = &state.db;

        // Get active provider for "claude" app type
        if let Some(provider_id) = db.get_current_provider_id("claude")? {
            if let Some(provider) = db.get_provider(&provider_id)? {
                return Ok((Some(provider.api_key), provider.url));
            }
        }

        Ok((None, None))
    }

    /// Periodic heartbeat so the daemon can detect a dead parent and we can
    /// detect a dead daemon. Mirrors DaemonBridge's 15s interval.
    fn spawn_heartbeat(client: Arc<DaemonClient>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
            loop {
                interval.tick().await;
                if !client.is_running() {
                    break;
                }
                if client.heartbeat().await.is_err() {
                    break;
                }
            }
        });
    }

    /// Send a message to a provider and stream the response to the frontend.
    ///
    /// `method` is e.g. "claude.send"; `params` is the JSON payload the
    /// ai-bridge command expects. Returns the request id immediately; lines
    /// arrive via the "chat://stream" / "chat://done" events.
    pub async fn send(&self, method: String, params: Value) -> Result<String, String> {
        let client = self.client().await?;
        let (id, mut rx) = client.send_streaming(method, params).await?;

        let app = self.app.clone();
        let request_id = id.clone();
        tokio::spawn(async move {
            use super::protocol::StreamLine;
            while let Some(item) = rx.recv().await {
                match item {
                    StreamLine::Line { text } => {
                        let _ = app.emit(
                            "chat://stream",
                            json!({ "requestId": request_id, "kind": "line", "text": text }),
                        );
                    }
                    StreamLine::Stderr { text } => {
                        let _ = app.emit(
                            "chat://stream",
                            json!({ "requestId": request_id, "kind": "stderr", "text": text }),
                        );
                    }
                    StreamLine::Done { success, error } => {
                        let _ = app.emit(
                            "chat://done",
                            json!({ "requestId": request_id, "success": success, "error": error }),
                        );
                        break;
                    }
                }
            }
        });

        Ok(id)
    }

    /// Abort the current in-flight turn.
    pub async fn abort(&self) -> Result<(), String> {
        let client = self.client().await?;
        client.abort().await
    }

    /// Force daemon startup without sending a command (lazy init trigger).
    pub async fn warm_up(&self) -> Result<(), String> {
        self.client().await.map(|_| ())
    }

    /// Whether the daemon is currently running.
    pub async fn is_running(&self) -> bool {
        match self.client.get() {
            Some(c) => c.is_running(),
            None => false,
        }
    }

    /// Stop the daemon (called on app shutdown).
    pub async fn shutdown(&self) {
        if let Some(c) = self.client.get() {
            c.stop().await;
        }
    }

    // ===== SDK 依赖管理 =====

    /// 列出所有 SDK 的安装状态。
    pub fn sdk_status(&self) -> Result<Vec<super::sdk_installer::SdkStatus>, String> {
        let deps = resources::deps_dir(&self.app)?;
        Ok(super::sdk_installer::all_status(&deps))
    }

    /// 安装指定 SDK，npm 日志通过 "chat://sdk-install-log" 事件推送。
    /// 安装成功后重启 daemon 以加载新装的 SDK。
    pub async fn install_sdk(&self, sdk_id: String) -> Result<(), String> {
        let sdk = super::sdk_installer::sdk_by_id(&sdk_id)
            .ok_or_else(|| format!("未知 SDK: {sdk_id}"))?;
        let node = resources::detect_node()?;
        let deps = resources::deps_dir(&self.app)?;

        let app = self.app.clone();
        let sdk_id_for_log = sdk_id.clone();
        let result = super::sdk_installer::install_sdk(sdk, &node, &deps, move |line| {
            let _ = app.emit(
                "chat://sdk-install-log",
                json!({ "sdkId": sdk_id_for_log, "line": line }),
            );
        })
        .await;

        // 通知安装结束（成功或失败）。
        let _ = self.app.emit(
            "chat://sdk-install-done",
            json!({ "sdkId": sdk_id, "success": result.is_ok(),
                    "error": result.as_ref().err() }),
        );

        result?;

        // 安装成功：重启 daemon 以预加载新装的 SDK。
        self.restart_daemon().await
    }

    /// 卸载指定 SDK。
    pub fn uninstall_sdk(&self, sdk_id: String) -> Result<(), String> {
        let sdk = super::sdk_installer::sdk_by_id(&sdk_id)
            .ok_or_else(|| format!("未知 SDK: {sdk_id}"))?;
        let deps = resources::deps_dir(&self.app)?;
        super::sdk_installer::uninstall_sdk(sdk, &deps)
    }

    /// 重启 daemon：停止当前实例并以新进程重新启动（用于安装 SDK 后刷新）。
    pub async fn restart_daemon(&self) -> Result<(), String> {
        if let Some(c) = self.client.get() {
            c.restart().await?;
            // restart 会重建 stdout reader（事件 sink 仍有效），但旧的心跳循环
            // 已随 is_running()=false 退出，需重新拉起。
            Self::spawn_heartbeat(c.clone());
            Ok(())
        } else {
            // 尚未初始化，直接懒启动（client() 内部会启动心跳）。
            self.warm_up().await
        }
    }
}

