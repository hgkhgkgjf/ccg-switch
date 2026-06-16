// ReadToolBlock - 文件读取工具块

import { useState, memo } from 'react';
import type { ToolResultBlock } from '../../types/chat';
import type { ToolInput } from '../../types/tools';
import { useIsToolDenied } from '../../hooks/useIsToolDenied';
import { resolveToolTarget, getToolLineInfo, formatLineRange } from '../../utils/toolPresentation';
import { getFileIcon, getFolderIcon } from '../../utils/fileIcons';
import { openFile, copyToClipboard } from '../../utils/bridge';

export interface ReadToolBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
}

const ReadToolBlock = memo(function ReadToolBlock({
  name: _name,
  input,
  result,
  toolId,
}: ReadToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDenied = useIsToolDenied(toolId);

  if (!input) {
    return null;
  }

  // 解析文件路径
  const target = resolveToolTarget(input);
  const lineInfo = getToolLineInfo(input);
  const filePath = target?.rawPath || '';

  // 状态计算
  const isCompleted = (result !== undefined && result !== null) || isDenied;
  const isError = isDenied || (isCompleted && result?.is_error === true);
  const status = isError ? 'error' : isCompleted ? 'completed' : 'pending';

  // 文件图标
  const isDirectory = target?.isDirectory ?? false;
  const fileIconSvg = target
    ? isDirectory
      ? getFolderIcon(target.cleanFileName)
      : getFileIcon(target.cleanFileName.split('.').pop() || '', target.cleanFileName)
    : '';

  // 文件路径点击
  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (target?.isFile) {
      openFile(target.openPath, lineInfo.start, lineInfo.end);
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
          <span className="codicon codicon-file-code tool-title-icon" />
          <span className="tool-title-text">Read</span>
          <span
            className={`tool-title-summary file-path-link ${!isDirectory ? 'clickable-file' : ''}`}
            onClick={!isDirectory ? handleFileClick : undefined}
            title={filePath}
          >
            {fileIconSvg && (
              <span
                className="file-icon"
                dangerouslySetInnerHTML={{ __html: fileIconSvg }}
              />
            )}
            {target?.displayPath || filePath}
          </span>
          {lineInfo.start && (
            <span className="tool-title-summary line-info">
              {formatLineRange(lineInfo)}
            </span>
          )}
          {isDenied && <span className="tool-title-summary text-error">• Denied</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className="task-details">
          <div className="task-content-wrapper">
            {/* 文件信息 */}
            <div className="tool-section">
              <div className="tool-section-label">File Path:</div>
              <div className="file-path-display">
                <code>{filePath}</code>
              </div>
            </div>

            {/* 行号范围 */}
            {lineInfo.start && (
              <div className="tool-section">
                <div className="tool-section-label">Lines:</div>
                <div className="line-range-display">
                  {lineInfo.end && lineInfo.end !== lineInfo.start
                    ? `${lineInfo.start} - ${lineInfo.end}`
                    : lineInfo.start}
                </div>
              </div>
            )}

            {/* 其他参数 */}
            {Object.entries(input)
              .filter(([key]) => !['file_path', 'path', 'target_file', 'offset', 'limit', 'line', 'start_line', 'end_line', 'command', 'workdir', 'description'].includes(key))
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
              {target?.isFile && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => openFile(target.openPath, lineInfo.start, lineInfo.end)}
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

export default ReadToolBlock;
