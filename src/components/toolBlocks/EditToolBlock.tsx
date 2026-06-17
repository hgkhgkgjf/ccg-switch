// EditToolBlock - 文件编辑工具块

import { useState, memo } from 'react';
import type { ToolResultBlock } from '../../types/chat';
import type { ToolInput } from '../../types/tools';
import { useIsToolDenied } from '../../hooks/useIsToolDenied';
import { collectEditToolItems, resolveToolTarget } from '../../utils/toolPresentation';
import { getFileIcon } from '../../utils/fileIcons';
import { openFile, copyToClipboard } from '../../utils/bridge';

export interface EditToolBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
}

const EditToolBlock = memo(function EditToolBlock({
  name,
  input,
  result,
  toolId,
}: EditToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDenied = useIsToolDenied(toolId);

  if (!input) {
    return null;
  }

  // 解析文件路径
  const primaryItem = collectEditToolItems(
    [{ type: 'tool_use', id: toolId ?? 'edit', name: name ?? 'Edit', input }],
    () => result,
  )[0];
  const target = resolveToolTarget(input);
  const filePath = primaryItem?.filePath ?? target?.rawPath ?? '';
  const displayPath = primaryItem?.displayPath ?? target?.displayPath ?? filePath;
  const openPath = primaryItem?.openPath ?? target?.openPath;
  const cleanFileName = primaryItem?.cleanFileName ?? target?.cleanFileName ?? filePath;

  // 提取编辑内容
  const oldString = primaryItem?.oldString ?? (input.old_string as string) ?? '';
  const newString = primaryItem?.newString ?? (input.new_string as string) ?? '';
  const hasChanges = oldString || newString;

  // 状态计算
  const isCompleted = (result !== undefined && result !== null) || isDenied;
  const isError = isDenied || (isCompleted && result?.is_error === true);
  const status = isError ? 'error' : isCompleted ? 'completed' : 'pending';

  // 文件图标
  const fileIconSvg = cleanFileName
    ? getFileIcon(cleanFileName.split('.').pop() || '', cleanFileName)
    : '';

  // 文件路径点击
  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (openPath) {
      openFile(openPath);
    }
  };

  // 复制路径
  const handleCopyPath = async () => {
    await copyToClipboard(filePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="task-container">
      <div
        className="task-header"
        onClick={() => setExpanded((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        <div className="task-title-section">
          <span className="edit-icon">✏️</span>
          <span className="tool-title-text">Edit</span>
          <span
            className="tool-title-summary file-path-link clickable-file"
            onClick={handleFileClick}
            title={filePath}
          >
            {fileIconSvg && (
              <span
                className="file-icon"
                dangerouslySetInnerHTML={{ __html: fileIconSvg }}
              />
            )}
            {displayPath}
          </span>
          {isDenied && <span className="tool-title-summary text-error">• Denied</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className="task-details">
          <div className="task-content-wrapper">
            {/* 文件路径 */}
            <div className="tool-section">
              <div className="tool-section-label">File Path:</div>
              <div className="file-path-display">
                <code>{filePath}</code>
              </div>
            </div>

            {/* Diff 预览 */}
            {hasChanges && (
              <div className="tool-section">
                <div className="tool-section-label">Changes:</div>
                <div className="diff-preview">
                  {oldString && (
                    <div className="diff-line removed">
                      <span className="diff-marker">-</span>
                      <span className="diff-content">{oldString}</span>
                    </div>
                  )}
                  {newString && (
                    <div className="diff-line added">
                      <span className="diff-marker">+</span>
                      <span className="diff-content">{newString}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 其他参数 */}
            {Object.entries(input)
              .filter(([key]) => !['file_path', 'path', 'target_file', 'old_string', 'new_string', 'command', 'workdir', 'description'].includes(key))
              .map(([key, value]) => (
                <div key={key} className="tool-section">
                  <div className="tool-section-label">{key}:</div>
                  <div className="tool-param-value">
                    {typeof value === 'object' && value !== null
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                  </div>
                </div>
              ))}

            {/* 操作按钮 */}
            <div className="tool-actions">
              {openPath && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => openFile(openPath)}
                >
                  Open File
                </button>
              )}
              <button
                className={`btn btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
                onClick={handleCopyPath}
              >
                {copied ? '✓ Copied' : 'Copy Path'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default EditToolBlock;
