// ReadToolBlock - 文件读取工具块

import {memo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {FileSearch} from 'lucide-react';
import type {ToolResultBlock} from '../../types/chat';
import type {ToolInput} from '../../types/tools';
import {useIsToolDenied} from '../../hooks/useIsToolDenied';
import {useChatStore} from '../../stores/useChatStore';
import {formatLineRange, getToolDisplayStatus, getToolLineInfo, resolveToolTarget} from '../../utils/toolPresentation';
import {getFileIcon, getFolderIcon} from '../../utils/fileIcons';
import {copyToClipboard, openFile} from '../../utils/bridge';

export interface ReadToolBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
  compact?: boolean;
}

const ReadToolBlock = memo(function ReadToolBlock({
  name: _name,
  input,
  result,
  toolId,
  compact = false,
}: ReadToolBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDenied = useIsToolDenied(toolId);
  const currentCwd = useChatStore((state) => state.currentCwd);

  if (!input) {
    return null;
  }

  // 解析文件路径
  const target = resolveToolTarget(input);
  const lineInfo = getToolLineInfo(input, target);
  const filePath = target?.rawPath || '';

  // 状态计算
  const status = getToolDisplayStatus(result, isDenied);

  // 文件图标
  const fileIconSvg = target
    ? target.isDirectory
      ? getFolderIcon(target.cleanFileName)
      : getFileIcon(target.cleanFileName.split('.').pop() || '', target.cleanFileName)
    : '';

  // 文件路径点击
  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (target?.isFile) {
      void openFile(target.openPath, lineInfo.start, lineInfo.end, currentCwd);
    }
  };

  // 复制路径
  const handleCopyPath = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    await copyToClipboard(filePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detailContent = (
    <div className="task-content-wrapper">
      <div className="tool-section">
        <div className="tool-section-label">{t('tools.filePath')}:</div>
        <div className="file-path-display">
          <code>{filePath}</code>
        </div>
      </div>

      {lineInfo.start && (
        <div className="tool-section">
          <div className="tool-section-label">{t('tools.lines')}:</div>
          <div className="line-range-display">
            {lineInfo.end && lineInfo.end !== lineInfo.start
              ? `${lineInfo.start} - ${lineInfo.end}`
              : lineInfo.start}
          </div>
        </div>
      )}

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

      <div className="tool-actions">
        {target?.isFile && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title={t('tools.openFile')}
            aria-label={t('tools.openFile')}
            onClick={(event) => {
              event.stopPropagation();
              void openFile(target.openPath, lineInfo.start, lineInfo.end, currentCwd);
            }}
          >
            {t('tools.openFile')}
          </button>
        )}
        <button
          type="button"
          className={`btn btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
          onClick={handleCopyPath}
        >
          {copied ? t('tools.copied') : t('tools.copyPath')}
        </button>
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
        onClick={() => setExpanded((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        <div className="task-title-section">
          <FileSearch className="tool-title-lucide" aria-hidden="true" />
          <span className="tool-title-text">{t('tools.read')}</span>
          <span
            className={`tool-title-summary file-path-link ${target?.isFile ? 'clickable-file' : ''}`}
            onClick={target?.isFile ? handleFileClick : undefined}
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
          {isDenied && <span className="tool-title-summary text-error">• {t('tools.denied')}</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className="task-details">
          {detailContent}
        </div>
      )}
    </div>
  );
});

export default ReadToolBlock;
