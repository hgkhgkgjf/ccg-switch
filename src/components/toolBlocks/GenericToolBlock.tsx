// GenericToolBlock - 通用工具块组件

import { useState, memo } from 'react';
import type { ToolResultBlock } from '../../types/chat';
import type { ToolInput } from '../../types/tools';
import { useIsToolDenied } from '../../hooks/useIsToolDenied';
import { extractResultText, truncateContent } from '../../utils/toolPresentation';
import { copyToClipboard } from '../../utils/bridge';

export interface GenericToolBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
}

const GenericToolBlock = memo(function GenericToolBlock({
  name,
  input,
  result,
  toolId,
}: GenericToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDenied = useIsToolDenied(toolId);

  if (!input) {
    return null;
  }

  // 状态计算
  const isCompleted = (result !== undefined && result !== null) || isDenied;
  const isError = isDenied || (isCompleted && result?.is_error === true);
  const status = isError ? 'error' : isCompleted ? 'completed' : 'pending';

  // 工具名称
  const toolName = name || 'Tool';

  // 提取输入参数（排除内部字段）
  const inputParams = Object.entries(input).filter(
    ([key]) => !['description', 'command', 'workdir'].includes(key)
  );

  // 提取结果文本
  const resultText = result ? extractResultText(result) : null;
  const truncatedResult = resultText ? truncateContent(resultText, 10000) : null;

  // 复制功能
  const handleCopyInput = async () => {
    await copyToClipboard(JSON.stringify(input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyOutput = async () => {
    if (resultText) {
      await copyToClipboard(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="task-container">
      <div
        className="task-header"
        onClick={() => setExpanded((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        <div className="task-title-section">
          <span className="codicon codicon-tools tool-title-icon" />
          <span className="tool-title-text">{toolName}</span>
          {isDenied && <span className="tool-title-summary text-error">• Denied</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className="task-details">
          <div className="task-content-wrapper">
            {/* 输入参数 */}
            {inputParams.length > 0 && (
              <div className="tool-section">
                <div className="tool-section-label">Input Parameters:</div>
                <div className="tool-params">
                  {inputParams.map(([key, value]) => (
                    <div key={key} className="tool-param-row">
                      <span className="tool-param-key">{key}:</span>
                      <span className="tool-param-value">
                        {typeof value === 'object' && value !== null
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 结果 */}
            {truncatedResult && (
              <div className="tool-section">
                <div className="tool-section-label">
                  {isError ? 'Error:' : 'Result:'}
                </div>
                <div className={`tool-result ${isError ? 'tool-result-error' : ''}`}>
                  <pre className="tool-result-text">{truncatedResult}</pre>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="tool-actions">
              <button
                className={`btn btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
                onClick={handleCopyInput}
              >
                {copied ? '✓ Copied' : 'Copy Input'}
              </button>
              {resultText && (
                <button
                  className={`btn btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
                  onClick={handleCopyOutput}
                >
                  {copied ? '✓ Copied' : 'Copy Output'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GenericToolBlock;
