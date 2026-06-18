// Tauri 桥接函数

import {invoke} from '@tauri-apps/api/core';
import i18n from '../i18n';
import {showToast} from '../components/common/ToastContainer';

/**
 * 在编辑器中打开文件
 * @param filePath 文件路径
 * @param lineStart 起始行号（可选）
 * @param lineEnd 结束行号（可选）
 */
export async function openFile(
  filePath: string,
  lineStart?: number,
  lineEnd?: number,
  cwd?: string | null
): Promise<boolean> {
  try {
    await invoke('open_file_in_editor', {
      filePath,
      lineStart,
      lineEnd,
      cwd: cwd || undefined,
    });
    return true;
  } catch (error) {
    console.error('Failed to open file:', error);
    showToast(`${i18n.t('tools.openFileFailed')}: ${String(error)}`, 'error', 5000);
    return false;
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
