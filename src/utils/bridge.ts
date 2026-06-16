// Tauri 桥接函数

import { invoke } from '@tauri-apps/api/core';

/**
 * 在编辑器中打开文件
 * @param filePath 文件路径
 * @param lineStart 起始行号（可选）
 * @param lineEnd 结束行号（可选）
 */
export async function openFile(
  filePath: string,
  lineStart?: number,
  lineEnd?: number
): Promise<void> {
  try {
    await invoke('open_file_in_editor', {
      filePath,
      lineStart,
      lineEnd,
    });
  } catch (error) {
    console.error('Failed to open file:', error);
    alert(`无法打开文件: ${error}`);
  }
}

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // 降级方案：使用传统方式
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Failed to copy', err);
    }
    document.body.removeChild(textArea);
  }
}
