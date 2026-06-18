// ReadToolGroupBlock - Read 工具分组块

import {memo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ChevronDown, ChevronRight, FileSearch} from 'lucide-react';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';
import {getGroupStatus} from '../../utils/toolGrouping';
import {getToolLineInfo, resolveToolTarget, summarizeReadGroupHeader} from '../../utils/toolPresentation';
import {getFileIcon, getFolderIcon} from '../../utils/fileIcons';
import {openFile} from '../../utils/bridge';
import {useChatStore} from '../../stores/useChatStore';
import ReadToolBlock from './ReadToolBlock';

export interface ReadToolGroupBlockProps {
  blocks: ToolUseBlock[];
  findToolResult: (toolId: string) => ToolResultBlock | null | undefined;
  compact?: boolean;
}

const ReadToolGroupBlock = memo(function ReadToolGroupBlock({
  blocks,
  findToolResult,
  compact = false,
}: ReadToolGroupBlockProps) {
  const { t } = useTranslation();
  const [groupExpanded, setGroupExpanded] = useState(!compact);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const currentCwd = useChatStore((state) => state.currentCwd);

  // 计算整体状态
  const status = getGroupStatus(blocks, findToolResult);
  const header = summarizeReadGroupHeader(blocks);

  // 全部展开/折叠
  const toggleAll = (expand: boolean) => {
    if (expand) {
      setExpandedIndices(new Set(blocks.map((_, i) => i)));
    } else {
      setExpandedIndices(new Set());
    }
  };

  // 切换单个
  const toggleItem = (index: number) => {
    const newSet = new Set(expandedIndices);
    if (expandedIndices.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedIndices(newSet);
  };

  return (
    <div className={`task-container task-group-container ${compact ? 'task-container-compact task-group-container-compact' : ''}`}>
      {/* 分组标题 */}
      <div
        className={`task-header task-group-header ${compact ? 'task-group-header-compact' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={groupExpanded}
        onClick={() => setGroupExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setGroupExpanded((prev) => !prev);
          }
        }}
      >
        <div className="task-title-section">
          <FileSearch className="tool-title-lucide" aria-hidden="true" />
          <span className="tool-title-text">{t('tools.read')}</span>
          {header.primarySummary && (
            <span className="tool-title-summary" title={header.primarySummary}>
              {header.primarySummary}
            </span>
          )}
          <span className="tool-title-secondary-summary" title={header.secondarySummary}>
            {header.secondarySummary}
          </span>
        </div>
        <div className="task-group-header-status">
          <div className={`tool-status-indicator ${status}`} />
          {groupExpanded
            ? <ChevronDown className="task-group-header-chevron" aria-hidden="true" />
            : <ChevronRight className="task-group-header-chevron" aria-hidden="true" />}
        </div>
      </div>

      {/* 分组列表 */}
      {groupExpanded && (
        <>
          <div className="task-group-list">
            {blocks.map((block, index) => {
              const result = findToolResult(block.id);
              const target = resolveToolTarget(block.input);
              const lineInfo = getToolLineInfo(block.input, target);
              const filePath = target?.displayPath || '';
              const lineSummary = lineInfo.start
                ? lineInfo.end && lineInfo.end !== lineInfo.start
                  ? `L${lineInfo.start}-${lineInfo.end}`
                  : `L${lineInfo.start}`
                : '';
              const isExpanded = expandedIndices.has(index);

              // 文件图标
              const isDirectory = target?.isDirectory ?? false;
              const fileIconSvg = target
                ? isDirectory
                  ? getFolderIcon(target.cleanFileName)
                  : getFileIcon(target.cleanFileName.split('.').pop() || '', target.cleanFileName)
                : '';

              // 单个工具状态
              const isCompleted = result !== undefined && result !== null;
              const isError = isCompleted && result?.is_error === true;
              const itemStatus = isError ? 'error' : isCompleted ? 'completed' : 'pending';

              return (
                <div key={block.id} className="task-group-item">
                  {/* 单项标题 */}
                  <div
                    className="task-group-item-header"
                    onClick={() => toggleItem(index)}
                  >
                    <div className="task-group-item-title">
                      <span className="task-group-item-number">{index + 1}.</span>
                      {fileIconSvg && (
                        <span
                          className="file-icon"
                          dangerouslySetInnerHTML={{ __html: fileIconSvg }}
                        />
                      )}
                      <span
                        className={`task-group-item-file ${target?.isFile ? 'clickable-file' : ''}`}
                        title={target?.rawPath ?? filePath}
                        onClick={target?.isFile ? (event) => {
                          event.stopPropagation();
                          void openFile(target.openPath, lineInfo.start, lineInfo.end, currentCwd);
                        } : undefined}
                      >
                        {filePath}
                      </span>
                      {lineSummary && (
                        <span className="task-group-item-secondary" title={lineSummary}>
                          {lineSummary}
                        </span>
                      )}
                    </div>
                    <div className="task-group-item-status">
                      <span className={`tool-state-pill ${itemStatus}`}>
                        {itemStatus === 'error' ? t('tools.failed') : itemStatus === 'completed' ? t('tools.success') : t('tools.pending')}
                      </span>
                      {isExpanded
                        ? <ChevronDown className="task-group-item-chevron-icon" aria-hidden="true" />
                        : <ChevronRight className="task-group-item-chevron-icon" aria-hidden="true" />}
                    </div>
                  </div>

                  {/* 展开的内容 */}
                  {isExpanded && (
                    <div className="task-group-item-content">
                      <ReadToolBlock
                        name={block.name}
                        input={block.input}
                        result={result}
                        toolId={block.id}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 分组操作 */}
          <div className="task-group-actions">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => toggleAll(true)}
            >
              {t('tools.expandAll')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => toggleAll(false)}
            >
              {t('tools.collapseAll')}
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default ReadToolGroupBlock;
