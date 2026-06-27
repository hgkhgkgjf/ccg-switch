use serde::{Deserialize, Serialize};

fn default_sidebar_position() -> String {
    "left".to_string()
}

fn default_preferred_terminal() -> String {
    "powershell".to_string()
}

fn default_auto_check_update() -> bool {
    true
}

fn default_check_update_interval_hours() -> u32 {
    24
}

fn default_debug_mode() -> bool {
    false
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub theme: String,
    pub language: String,
    #[serde(default = "default_sidebar_position", rename = "sidebarPosition")]
    pub sidebar_position: String,
    #[serde(default = "default_preferred_terminal", rename = "preferredTerminal")]
    pub preferred_terminal: String,
    #[serde(default = "default_auto_check_update", rename = "autoCheckUpdate")]
    pub auto_check_update: bool,
    #[serde(
        default = "default_check_update_interval_hours",
        rename = "checkUpdateIntervalHours"
    )]
    pub check_update_interval_hours: u32,
    /// When enabled, the chat daemon runs with verbose diagnostics
    /// (`CLAUDE_DEBUG=1`) so SDK/Node failures surface their root cause in the
    /// debug log instead of failing silently.
    #[serde(default = "default_debug_mode", rename = "debugMode")]
    pub debug_mode: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            language: "zh".to_string(),
            sidebar_position: "left".to_string(),
            preferred_terminal: "powershell".to_string(),
            auto_check_update: default_auto_check_update(),
            check_update_interval_hours: default_check_update_interval_hours(),
            debug_mode: default_debug_mode(),
        }
    }
}
