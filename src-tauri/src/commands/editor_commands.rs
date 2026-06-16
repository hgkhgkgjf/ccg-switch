// 编辑器集成命令

use std::process::Command;

/// 在编辑器中打开文件
///
/// # Arguments
/// * `file_path` - 文件路径
/// * `line_start` - 起始行号（可选）
/// * `line_end` - 结束行号（可选，暂未使用）
#[tauri::command]
pub async fn open_file_in_editor(
    file_path: String,
    line_start: Option<u32>,
    _line_end: Option<u32>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // 优先使用 VS Code
        let line_arg = line_start
            .map(|l| format!(":{}:1", l))
            .unwrap_or_default();

        let full_path = format!("{}{}", file_path, line_arg);
        let cmd = format!("code --goto \"{}\"", full_path);

        Command::new("cmd")
            .args(&["/C", &cmd])
            .spawn()
            .map_err(|e| format!("Failed to open file in editor: {}", e))?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let line_arg = line_start
            .map(|l| format!(":{}:1", l))
            .unwrap_or_default();

        let full_path = format!("{}{}", file_path, line_arg);

        Command::new("code")
            .args(&["--goto", &full_path])
            .spawn()
            .map_err(|e| format!("Failed to open file in editor: {}", e))?;

        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        let line_arg = line_start
            .map(|l| format!(":{}:1", l))
            .unwrap_or_default();

        let full_path = format!("{}{}", file_path, line_arg);

        Command::new("code")
            .args(&["--goto", &full_path])
            .spawn()
            .map_err(|e| format!("Failed to open file in editor: {}", e))?;

        Ok(())
    }
}
