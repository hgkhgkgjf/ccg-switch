// BashToolGroupBlock - Bash 工具分组块

import {memo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ChevronDown, ChevronRight, Terminal} from 'lucide-react';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';
import {getGroupStatus} from '../../utils/toolGrouping';
import {summarizeBashGroupHeader, summarizeCommand, summarizeGroupBashItemResult} from '../../utils/toolPresentation';
import BashToolBlock from './BashToolBlock';

export interface BashToolGroupBlockProps {
  blocks: ToolUseBlock[];
  findToolResult: (toolId: string) => ToolResultBlock | null | undefined;
  compact?: boolean;
}

const BashToolGroupBlock = memo(function BashToolGroupBlock({
  blocks,
  findToolResult,
  compact = false,
}: BashToolGroupBlockProps) {
  const { t } = useTranslation();
  const [groupExpanded, setGroupExpanded] = useState(!compact);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  // 计算整体状态
  const status = getGroupStatus(blocks, findToolResult);
  const headerSummary = summarizeBashGroupHeader(blocks, findToolResult);

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
          <Terminal className="tool-title-lucide" aria-hidden="true" />
          <span className="tool-title-text">{t('tools.runCommand')}</span>
          <span className="tool-command-chip tool-command-run">{blocks.length}</span>
          {headerSummary.primarySummary && (
            <span className="tool-title-summary" title={headerSummary.primarySummary}>
              {headerSummary.primarySummary}
            </span>
          )}
          <span className="tool-title-secondary-summary" title={t('tools.commandCount', { count: headerSummary.totalCount })}>
            {headerSummary.completedCount > 0 ? t('tools.success') : t('tools.pending')}
            {headerSummary.errorCount > 0 ? ` · ${headerSummary.errorCount} ${t('tools.failed')}` : ''}
            {headerSummary.pendingCount > 0 ? ` · ${headerSummary.pendingCount} ${t('tools.pending')}` : ''}
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
              const command = (block.input.command as string) || '';
              const commandSummary = summarizeCommand(command);
              const resultSummary = summarizeGroupBashItemResult(result);
              const isExpanded = expandedIndices.has(index);

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
                      <span className={`tool-command-chip ${commandSummary.accentClass}`}>
                        {commandSummary.label}
                      </span>
                      <span className="task-group-item-command" title={command}>
                        {commandSummary.summary}
                      </span>
                      {resultSummary && (
                        <span className={`task-group-item-secondary ${isError ? 'error' : ''}`} title={resultSummary}>
                          {resultSummary}
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
                      <BashToolBlock
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

export default BashToolGroupBlock;
