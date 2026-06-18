// GenericToolBlock - 通用工具块组件

import {memo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Wrench} from 'lucide-react';
import type {ToolResultBlock} from '../../types/chat';
import type {ToolInput} from '../../types/tools';
import {useIsToolDenied} from '../../hooks/useIsToolDenied';
import {
    extractResultText,
    getToolDisplayStatus,
    resolveToolTarget,
    summarizeGenericTool,
    summarizeToolResultText,
    truncateContent,
} from '../../utils/toolPresentation';
import {copyToClipboard, openFile} from '../../utils/bridge';
import {useChatStore} from '../../stores/useChatStore';

export interface GenericToolBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
  compact?: boolean;
}

const GenericToolBlock = memo(function GenericToolBlock({
  name,
  input,
  result,
  toolId,
  compact = false,
}: GenericToolBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDenied = useIsToolDenied(toolId);
  const currentCwd = useChatStore((state) => state.currentCwd);

  if (!input) {
    return null;
  }

  // 工具名称
  const toolName = name || t('tools.unknown');
  const target = resolveToolTarget(input);
  const actionSummary = summarizeGenericTool(name, input);
  const command = typeof input.command === 'string'
    ? input.command
    : typeof input.cmd === 'string'
      ? input.cmd
      : '';
  const status = getToolDisplayStatus(result, isDenied);
  const isError = status === 'error';

  // 提取输入参数（排除内部字段）
  const inputParams = Object.entries(input).filter(
    ([key]) => ![
      'description',
      'command',
      'cmd',
      'workdir',
      'file_path',
      'filePath',
      'path',
      'target_file',
      'targetFile',
    ].includes(key)
  );

  // 提取结果文本
  const resultText = result ? extractResultText(result) : null;
  const truncatedResult = resultText ? truncateContent(resultText, 10000) : null;
  const resultSummary = resultText ? summarizeToolResultText(resultText) : '';
  const hasExpandableContent = inputParams.length > 0 || Boolean(truncatedResult);
  const detailResultLabel = isError ? t('tools.errorOutput') : t('tools.result');
  const primarySummary = target
    ? target.displayPath
    : command
      ? actionSummary.summary
      : actionSummary.summary;
  const showResultSummary = Boolean(resultSummary) && resultSummary !== primarySummary;

  // 复制功能
  const handleCopyInput = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    await copyToClipboard(JSON.stringify(input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyOutput = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (resultText) {
      await copyToClipboard(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (compact && !hasExpandableContent) {
    return null;
  }

  const detailContent = (
    <div className="task-content-wrapper">
      {inputParams.length > 0 && (
        <div className="tool-section">
          <div className="tool-section-label">{t('tools.inputParameters')}:</div>
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

      {truncatedResult && (
        <div className="tool-section">
          <div className="tool-section-label">{detailResultLabel}:</div>
          <div className={`tool-result ${isError ? 'tool-result-error' : ''}`}>
            <pre className="tool-result-text">{truncatedResult}</pre>
          </div>
        </div>
      )}

      <div className="tool-actions">
        <button
          type="button"
          className={`btn btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
          onClick={handleCopyInput}
        >
          {copied ? t('tools.copied') : t('tools.copyInput')}
        </button>
        {resultText && (
          <button
            type="button"
            className={`btn btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
            onClick={handleCopyOutput}
          >
            {copied ? t('tools.copied') : t('tools.copyOutput')}
          </button>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="task-container task-container-compact">
        <div className="task-details task-details-compact">
          {detailContent}
        </div>
      </div>
    );
  }

  return (
    <div className="task-container">
      <div
        className="task-header"
        onClick={hasExpandableContent ? () => setExpanded((prev) => !prev) : undefined}
        style={{ cursor: hasExpandableContent ? 'pointer' : 'default' }}
      >
        <div className="task-title-section">
          <Wrench className="tool-title-lucide" aria-hidden="true" />
          <span className="tool-title-text">{toolName}</span>
          <span className={`tool-command-chip ${actionSummary.accentClass}`}>
            {actionSummary.label}
          </span>
          {target ? (
            <span
              className={`tool-title-summary file-path-link ${target.isFile ? 'clickable-file' : ''}`}
              title={target.rawPath}
              onClick={target.isFile ? (event) => {
                event.stopPropagation();
                void openFile(target.openPath, target.lineStart, target.lineEnd, currentCwd);
              } : undefined}
            >
              {target.displayPath}
            </span>
          ) : command ? (
            <span className="tool-title-summary bash-command" title={command}>
              {actionSummary.summary}
            </span>
          ) : actionSummary.summary ? (
            <span className="tool-title-summary task-group-item-pattern" title={actionSummary.summary}>
              {actionSummary.summary}
            </span>
          ) : null}
          {showResultSummary && (
            <span
              className={`tool-title-secondary-summary ${isError ? 'tool-title-secondary-summary-error' : ''}`}
              title={resultText ?? resultSummary}
            >
              {resultSummary}
            </span>
          )}
          {isDenied && <span className="tool-title-summary text-error">• {t('tools.denied')}</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && hasExpandableContent && (
        <div className="task-details">
          {detailContent}
        </div>
      )}
    </div>
  );
});

export default GenericToolBlock;
