// 工具展示相关的实用函数

import type { ToolInput, ToolTargetInfo, LineInfo } from '../types/tools';

/**
 * 解析工具的文件路径目标
 * @param input 工具输入参数
 * @param toolType 工具类型（用于确定优先级）
 * @returns 文件路径目标信息，如果无法解析则返回 null
 */
export function resolveToolTarget(
  input: ToolInput,
  toolType: 'read' | 'edit' | 'bash'
): ToolTargetInfo | null {
  // 优先级：file_path > path > target_file
  const rawPath = (input.file_path || input.path || input.target_file) as string | undefined;

  if (!rawPath || typeof rawPath !== 'string') {
    return null;
  }

  // 判断是否是绝对路径
  const isAbsolute = /^[a-zA-Z]:\\/.test(rawPath) || rawPath.startsWith('/');

  // 提取文件名
  const cleanFileName = rawPath.split(/[/\\]/).pop() || rawPath;

  // 判断是否是目录（以 / 或 \ 结尾）
  const isDirectory = rawPath.endsWith('/') || rawPath.endsWith('\\');

  // 显示路径（如果是绝对路径，尝试转为相对路径）
  let displayPath = rawPath;
  if (isAbsolute) {
    // 尝试提取 src/ 之后的路径
    const match = rawPath.match(/[/\\](src|pages|components|utils|styles|hooks|stores|types)[/\\].*/);
    if (match) {
      displayPath = match[0].substring(1); // 移除开头的 /
    }
  }

  // 打开路径（转为绝对路径）
  const openPath = isAbsolute ? rawPath : rawPath;

  return {
    rawPath,
    cleanFileName,
    displayPath,
    openPath,
    isFile: !isDirectory,
    isDirectory,
  };
}

/**
 * 提取工具调用的行号信息
 * @param input 工具输入参数
 * @param target 文件路径目标（可选，用于额外验证）
 * @returns 行号信息
 */
export function getToolLineInfo(
  input: ToolInput,
  target: ToolTargetInfo | null
): LineInfo {
  // 优先级：offset > line > start_line
  const start = input.offset || input.line || input.start_line;
  const end = input.limit || input.end_line;

  return {
    start: typeof start === 'number' ? start : undefined,
    end: typeof end === 'number' ? end : undefined,
  };
}

/**
 * 提取工具结果的文本内容
 * @param result 工具结果对象
 * @returns 文本内容
 */
export function extractResultText(result: { content?: string | Array<{ type: string; text?: string }> }): string {
  if (!result.content) return '';

  if (typeof result.content === 'string') {
    return result.content;
  }

  if (Array.isArray(result.content)) {
    return result.content
      .map((item) => (item && typeof item.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

/**
 * 截断过长的文本内容
 * @param content 原始内容
 * @param maxLength 最大长度（默认 10000）
 * @returns 截断后的内容
 */
export function truncateContent(content: string, maxLength = 10000): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + '\n\n... (内容过长，已截断)';
}

/**
 * 格式化行号范围显示
 * @param lineInfo 行号信息
 * @param t 国际化函数
 * @returns 格式化字符串（如 "L50-L100" 或 "L50"）
 */
export function formatLineRange(lineInfo: LineInfo, t?: (key: string, params?: Record<string, unknown>) => string): string {
  if (!lineInfo.start) return '';

  if (lineInfo.end && lineInfo.end !== lineInfo.start) {
    return t
      ? t('tools.lineRange', { start: lineInfo.start, end: lineInfo.end })
      : `L${lineInfo.start}-L${lineInfo.end}`;
  }

  return t
    ? t('tools.lineSingle', { line: lineInfo.start })
    : `L${lineInfo.start}`;
}
