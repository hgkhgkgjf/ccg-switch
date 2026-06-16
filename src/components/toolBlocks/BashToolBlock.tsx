// BashToolBlock - Bash 命令执行工具块

import { useState, memo } from 'react';
import type { ToolResultBlock } from '../../types/chat';
import type { ToolInput } from '../../types/tools';
import { useIsToolDenied } from '../../hooks/useIsToolDenied';
import { extractResultText, truncateContent } from '../../utils/toolPresentation';
import { copyToClipboard } from '../../utils/bridge';

export interface BashToolBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
}

interface BashResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * 解析 Bash 工具结果
 */
function parseBashResult(result: ToolResultBlock): BashResult {
  const text = extractResultText(result);

  // 尝试解析 JSON 格式
  try {
    const parsed = JSON.parse(text);
    return {
      exitCode: parsed.exit_code ?? parsed.exitCode ?? (result.is_error ? 1 : 0),
      stdout: parsed.stdout ?? '',
      stderr: parsed.stderr ?? '',
    };
  } catch {
    // 纯文本输出
    return {
      exitCode: result.is_error ? 1 : 0,
      stdout: text,
      stderr: '',
    };
  }
}

const BashToolBlock = memo(function BashToolBlock({
  name: _name,
  input,
  result,
  toolId,
}: BashToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDenied = useIsToolDenied(toolId);

  if (!input) {
    return null;
  }

  // 提取命令
  const command = (input.command as string) || '';

  // 状态计算
  const isCompleted = (result !== undefined && result !== null) || isDenied;
  const isError = isDenied || (isCompleted && result?.is_error === true);
  const status = isError ? 'error' : isCompleted ? 'completed' : 'pending';

  // 解析结果
  const bashResult = result ? parseBashResult(result) : null;

  // 复制功能
  const handleCopyCommand = async () => {
    await copyToClipboard(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyOutput = async () => {
    if (bashResult) {
      const output = bashResult.stdout + (bashResult.stderr ? `\n\nStderr:\n${bashResult.stderr}` : '');
      await copyToClipboard(output);
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
          <span className="bash-icon">$</span>
          <span className="tool-title-text">Bash</span>
          <span className="tool-title-summary bash-command" title={command}>
            {command}
          </span>
          {isDenied && <span className="tool-title-summary text-error">• Denied</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className="task-details">
          <div className="task-content-wrapper">
            {/* 命令 */}
            <div className="tool-section">
              <div className="tool-section-label">Command:</div>
              <div className="bash-command-block">
                <code>{command}</code>
              </div>
            </div>

            {/* Exit Code */}
            {bashResult && (
              <div className="tool-section">
                <div className="tool-section-label">Exit Code:</div>
                <div className={`bash-exit-code ${bashResult.exitCode === 0 ? 'success' : 'error'}`}>
                  {bashResult.exitCode}
                  {bashResult.exitCode === 0 ? ' (Success)' : ' (Failed)'}
                </div>
              </div>
            )}

            {/* Stdout */}
            {bashResult && bashResult.stdout && (
              <div className="tool-section">
                <div className="tool-section-label">Output:</div>
                <div className="bash-output">
                  <pre className="bash-output-text">{truncateContent(bashResult.stdout, 10000)}</pre>
                </div>
              </div>
            )}

            {/* Stderr */}
            {bashResult && bashResult.stderr && (
              <div className="tool-section">
                <div className="tool-section-label">Error Output:</div>
                <div className="bash-output bash-output-error">
                  <pre className="bash-output-text">{truncateContent(bashResult.stderr, 10000)}</pre>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="tool-actions">
              <button
                className={`btn btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
                onClick={handleCopyCommand}
              >
                {copied ? '✓ Copied' : 'Copy Command'}
              </button>
              {bashResult && (
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

export default BashToolBlock;
