// 工具展示相关的实用函数

import type { ToolResultBlock, ToolUseBlock } from '../types/chat';
import type { ToolInput, ToolTargetInfo, LineInfo } from '../types/tools';

interface PatchOperation {
  filePath: string;
  oldString: string;
  newString: string;
  startLine?: number;
  endLine?: number;
}

export interface EditToolItem {
  id: string;
  toolId: string;
  name: string;
  input: ToolInput;
  result: ToolResultBlock | null | undefined;
  filePath: string;
  displayPath: string;
  openPath: string;
  cleanFileName: string;
  oldString: string;
  newString: string;
  additions: number;
  deletions: number;
  lineStart?: number;
  lineEnd?: number;
  isCompleted: boolean;
  isError: boolean;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function stripLineSuffix(filePath: string): string {
  return filePath.replace(/:\d+(?:-\d+)?$/, '');
}

function parseLineSuffix(filePath: string): LineInfo {
  const match = filePath.match(/:(\d+)(?:-(\d+))?$/);
  if (!match) return {};
  return {
    start: Number(match[1]),
    end: match[2] ? Number(match[2]) : undefined,
  };
}

function extractPatchContent(input: ToolInput): string | undefined {
  return stringValue(input.patch)
    ?? stringValue(input.input)
    ?? stringValue(input.content)
    ?? stringValue(input.command);
}

export function extractPathsFromPatch(patchContent: string): string[] {
  const paths: string[] = [];

  patchContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/);
    if (match?.[1]) {
      paths.push(match[1].trim());
      return;
    }

    const moveMatch = line.match(/^\*\*\* Move to:\s*(.+)$/);
    if (moveMatch?.[1] && paths.length > 0) {
      paths[paths.length - 1] = moveMatch[1].trim();
    }
  });

  return paths;
}

function parseHunkHeader(line: string): { start?: number; end?: number } {
  const match = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
  if (!match) return {};

  const oldStart = Number(match[1]);
  const oldCount = match[2] ? Number(match[2]) : 1;
  const newStart = Number(match[3]);
  const newCount = match[4] ? Number(match[4]) : 1;
  const start = oldCount > 0 ? oldStart : newStart;
  const effectiveCount = oldCount > 0 ? oldCount : newCount;

  return {
    start,
    end: effectiveCount > 1 ? start + effectiveCount - 1 : undefined,
  };
}

function parsePatchOperations(patchContent: string): PatchOperation[] {
  const operations: PatchOperation[] = [];
  let filePath: string | null = null;
  let oldLines: string[] = [];
  let newLines: string[] = [];
  let lineInfo: LineInfo = {};

  const flush = () => {
    if (!filePath) return;
    operations.push({
      filePath,
      oldString: oldLines.join('\n'),
      newString: newLines.join('\n'),
      startLine: lineInfo.start,
      endLine: lineInfo.end,
    });
    oldLines = [];
    newLines = [];
    lineInfo = {};
  };

  patchContent.split(/\r?\n/).forEach((line) => {
    const fileMatch = line.match(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/);
    if (fileMatch?.[1]) {
      flush();
      filePath = fileMatch[1].trim();
      return;
    }

    const moveMatch = line.match(/^\*\*\* Move to:\s*(.+)$/);
    if (moveMatch?.[1] && filePath) {
      filePath = moveMatch[1].trim();
      return;
    }

    if (line.startsWith('*** End Patch')) {
      flush();
      filePath = null;
      return;
    }

    if (!filePath) return;

    if (line.startsWith('@@')) {
      flush();
      lineInfo = parseHunkHeader(line);
      return;
    }

    if (line.startsWith('+')) {
      newLines.push(line.slice(1));
    } else if (line.startsWith('-')) {
      oldLines.push(line.slice(1));
    }
  });

  flush();

  return operations.filter((operation) => (
    operation.filePath.trim().length > 0
    && (operation.oldString.length > 0 || operation.newString.length > 0)
  ));
}

function computeDiffStats(oldString: string, newString: string): { additions: number; deletions: number } {
  const oldLines = oldString ? oldString.split('\n') : [];
  const newLines = newString ? newString.split('\n') : [];

  if (oldLines.length === 0) return { additions: newLines.length, deletions: 0 };
  if (newLines.length === 0) return { additions: 0, deletions: oldLines.length };

  const rows = oldLines.length + 1;
  const cols = newLines.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  let additions = 0;
  let deletions = 0;
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      additions += 1;
      j -= 1;
    } else {
      deletions += 1;
      i -= 1;
    }
  }

  return { additions, deletions };
}

/**
 * 解析工具的文件路径目标
 * @param input 工具输入参数
 * @returns 文件路径目标信息，如果无法解析则返回 null
 */
export function resolveToolTarget(
  input: ToolInput,
): ToolTargetInfo | null {
  // 优先级：file_path > path > target_file
  const standardPath = stringValue(input.file_path)
    ?? stringValue(input.filePath)
    ?? stringValue(input.path)
    ?? stringValue(input.target_file)
    ?? stringValue(input.targetFile);
  const patchContent = standardPath ? undefined : extractPatchContent(input);
  const rawPath = standardPath ?? (patchContent ? extractPathsFromPatch(patchContent)[0] : undefined);

  if (!rawPath || typeof rawPath !== 'string') {
    return null;
  }

  const openPath = stripLineSuffix(rawPath);

  // 判断是否是绝对路径
  const isAbsolute = /^[a-zA-Z]:[\\/]/.test(openPath) || openPath.startsWith('/') || openPath.startsWith('\\');

  // 提取文件名
  const cleanFileName = openPath.split(/[/\\]/).pop() || openPath;

  // 判断是否是目录（以 / 或 \ 结尾）
  const isDirectory = rawPath.endsWith('/') || rawPath.endsWith('\\');

  // 显示路径（如果是绝对路径，尝试转为相对路径）
  let displayPath = rawPath;
  if (isAbsolute) {
    // 尝试提取 src/ 之后的路径
    const match = openPath.match(/[/\\](src|pages|components|utils|styles|hooks|stores|types)[/\\].*/);
    if (match) {
      displayPath = match[0].substring(1); // 移除开头的 /
    }
  }

  const lineInfo = parseLineSuffix(rawPath);

  return {
    rawPath,
    cleanFileName,
    displayPath: stripLineSuffix(displayPath),
    openPath,
    isFile: !isDirectory,
    isDirectory,
    ...(lineInfo.start !== undefined ? { lineStart: lineInfo.start } : {}),
    ...(lineInfo.end !== undefined ? { lineEnd: lineInfo.end } : {}),
  };
}

/**
 * 提取工具调用的行号信息
 * @param input 工具输入参数
 * @returns 行号信息
 */
export function getToolLineInfo(
  input: ToolInput,
): LineInfo {
  // 优先级：offset > line > start_line
  const start = numberValue(input.offset) ?? numberValue(input.line) ?? numberValue(input.start_line);
  const end = numberValue(input.limit) ?? numberValue(input.end_line);

  return {
    start,
    end,
  };
}

function buildEditItem(
  block: ToolUseBlock,
  input: ToolInput,
  result: ToolResultBlock | null | undefined,
  index: number,
): EditToolItem | null {
  const target = resolveToolTarget(input);
  if (!target) return null;

  const oldString = stringValue(input.old_string)
    ?? stringValue(input.oldString)
    ?? stringValue(input.oldText)
    ?? '';
  const newString = stringValue(input.new_string)
    ?? stringValue(input.newString)
    ?? stringValue(input.newText)
    ?? stringValue(input.content)
    ?? '';
  const stats = computeDiffStats(oldString, newString);
  const lineInfo = getToolLineInfo(input);
  const isCompleted = result !== undefined && result !== null;
  const isError = isCompleted && result?.is_error === true;

  return {
    id: `${block.id}-${index}`,
    toolId: block.id,
    name: block.name,
    input,
    result,
    filePath: target.rawPath,
    displayPath: target.displayPath,
    openPath: target.openPath,
    cleanFileName: target.cleanFileName,
    oldString,
    newString,
    additions: stats.additions,
    deletions: stats.deletions,
    lineStart: lineInfo.start ?? target.lineStart,
    lineEnd: lineInfo.end ?? target.lineEnd,
    isCompleted,
    isError,
  };
}

function expandEditInputs(block: ToolUseBlock): ToolInput[] {
  const patchContent = extractPatchContent(block.input);
  if (patchContent?.includes('*** Begin Patch')) {
    return parsePatchOperations(patchContent).map((operation) => ({
      ...block.input,
      file_path: operation.filePath,
      old_string: operation.oldString,
      new_string: operation.newString,
      start_line: operation.startLine,
      end_line: operation.endLine,
    }));
  }

  if (Array.isArray(block.input.edits) && block.input.edits.length > 0) {
    return block.input.edits
      .map((edit): ToolInput | null => {
        if (!edit || typeof edit !== 'object') return null;
        const editInput = edit as ToolInput;
        return {
          ...block.input,
          ...editInput,
          file_path: stringValue(editInput.file_path)
            ?? stringValue(editInput.filePath)
            ?? stringValue(editInput.path)
            ?? stringValue(block.input.file_path)
            ?? stringValue(block.input.filePath)
            ?? stringValue(block.input.path),
          old_string: stringValue(editInput.old_string)
            ?? stringValue(editInput.oldString)
            ?? stringValue(editInput.oldText)
            ?? stringValue(block.input.old_string)
            ?? stringValue(block.input.oldString),
          new_string: stringValue(editInput.new_string)
            ?? stringValue(editInput.newString)
            ?? stringValue(editInput.newText)
            ?? stringValue(block.input.new_string)
            ?? stringValue(block.input.newString),
        };
      })
      .filter((item): item is ToolInput => item !== null);
  }

  return [block.input];
}

export function collectEditToolItems(
  blocks: ToolUseBlock[],
  findToolResult: (toolId: string) => ToolResultBlock | null | undefined,
): EditToolItem[] {
  return blocks.flatMap((block) => {
    const result = findToolResult(block.id);
    return expandEditInputs(block)
      .map((input, index) => buildEditItem(block, input, result, index))
      .filter((item): item is EditToolItem => item !== null);
  });
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
