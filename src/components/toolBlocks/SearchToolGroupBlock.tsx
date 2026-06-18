// SearchToolGroupBlock - 搜索工具分组块（Grep/Glob）

import {memo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ChevronDown, ChevronRight, Search} from 'lucide-react';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';
import {getGroupStatus} from '../../utils/toolGrouping';
import {
    extractResultText,
    summarizeSearchGroupHeader,
    summarizeSearchInput,
    summarizeSearchResultText,
} from '../../utils/toolPresentation';
import {openFile} from '../../utils/bridge';
import {useChatStore} from '../../stores/useChatStore';
import GenericToolBlock from './GenericToolBlock';

export interface SearchToolGroupBlockProps {
  blocks: ToolUseBlock[];
  findToolResult: (toolId: string) => ToolResultBlock | null | undefined;
}

const SearchToolGroupBlock = memo(function SearchToolGroupBlock({
  blocks,
  findToolResult,
}: SearchToolGroupBlockProps) {
  const { t } = useTranslation();
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const currentCwd = useChatStore((state) => state.currentCwd);

  // 计算整体状态
  const status = getGroupStatus(blocks, findToolResult);
  const firstPattern = summarizeSearchInput(blocks[0]?.input ?? {});
  const summaryHint = firstPattern || t('tools.searchQuery', {count: blocks.length});

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
    <div className="task-container task-group-container">
      {/* 分组标题 */}
      <div className="task-header task-group-header">
        <div className="task-title-section">
          <Search className="tool-title-lucide" aria-hidden="true" />
          <span className="tool-title-text">{t('tools.search')}</span>
          <span className="tool-command-chip tool-command-search">
            {t('tools.searchFind')}
          </span>
          {summaryHint && <span className="tool-title-summary" title={summaryHint}>{summaryHint}</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {/* 分组列表 */}
      <div className="task-group-list">
        {blocks.map((block, index) => {
          const result = findToolResult(block.id);
          const pattern = summarizeSearchInput(block.input);
          const summary = result ? summarizeSearchResultText(extractResultText(result)) : {
            matchCount: 0,
            fileCount: 0,
            files: [],
          };
          const header = summarizeSearchGroupHeader(block.name, pattern, summary);
          const isExpanded = expandedIndices.has(index);
          const firstFile = summary.files[0];

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
                  <span className="tool-command-chip tool-command-search">
                    {block.name.toLowerCase().includes('glob') ? t('tools.searchGlob') : t('tools.searchFind')}
                  </span>
                  <span className="task-group-item-pattern" title={header.primarySummary}>
                    {header.primarySummary || block.name}
                  </span>
                  {firstFile && (
                    <button
                      type="button"
                      className="task-group-item-file-muted search-file-link"
                      title={summary.files.map((file) => file.path).join('\n')}
                      onClick={(event) => {
                        event.stopPropagation();
                        void openFile(firstFile.path, firstFile.lineStart, undefined, currentCwd);
                      }}
                    >
                      {firstFile.path}
                    </button>
                  )}
                  {header.secondarySummary && (
                    <span className="task-group-item-secondary" title={header.secondarySummary}>
                      {header.secondarySummary}
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
                  {summary.files.length > 0 && (
                    <div className="search-result-files">
                      {summary.files.map((file) => (
                        <button
                          key={`${file.path}:${file.lineStart ?? ''}`}
                          type="button"
                          className="search-result-file-row"
                          title={file.path}
                          onClick={(event) => {
                            event.stopPropagation();
                            void openFile(file.path, file.lineStart, undefined, currentCwd);
                          }}
                        >
                          <span className="search-result-file-path">{file.path}</span>
                          {file.lineStart && (
                            <span className="search-result-file-line">L{file.lineStart}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <GenericToolBlock
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
    </div>
  );
});

export default SearchToolGroupBlock;
