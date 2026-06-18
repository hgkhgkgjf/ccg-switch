// EditToolGroupBlock - Edit 工具分组块

import {memo, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ChevronDown, ChevronRight, PencilLine} from 'lucide-react';
import type {ToolResultBlock, ToolUseBlock} from '../../types/chat';
import {getGroupStatus} from '../../utils/toolGrouping';
import {collectEditToolItems, mergeEditToolItemsByFile} from '../../utils/toolPresentation';
import {getFileIcon} from '../../utils/fileIcons';
import {openFile} from '../../utils/bridge';
import {useChatStore} from '../../stores/useChatStore';
import EditToolBlock from './EditToolBlock';
import EditDiffPreview from './EditDiffPreview';

export interface EditToolGroupBlockProps {
  blocks: ToolUseBlock[];
  findToolResult: (toolId: string) => ToolResultBlock | null | undefined;
  compact?: boolean;
}

const EditToolGroupBlock = memo(function EditToolGroupBlock({
  blocks,
  findToolResult,
  compact = false,
}: EditToolGroupBlockProps) {
  const { t } = useTranslation();
  const [groupExpanded, setGroupExpanded] = useState(!compact);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const currentCwd = useChatStore((state) => state.currentCwd);

  // 计算整体状态
  const status = getGroupStatus(blocks, findToolResult);
  const editItems = useMemo(
    () => mergeEditToolItemsByFile(collectEditToolItems(blocks, findToolResult)),
    [blocks, findToolResult],
  );
  const totalAdditions = editItems.reduce((sum, item) => sum + item.additions, 0);
  const totalDeletions = editItems.reduce((sum, item) => sum + item.deletions, 0);

  if (editItems.length === 0) {
    return null;
  }

  // 全部展开/折叠
  const toggleAll = (expand: boolean) => {
    if (expand) {
      setExpandedIndices(new Set(editItems.map((_, i) => i)));
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
          <PencilLine className="tool-title-lucide" aria-hidden="true" />
          <span className="tool-title-text">{t('tools.editBatchFiles')}</span>
          <span className="tool-title-summary">
            ({editItems.length})
          </span>
          {(totalAdditions > 0 || totalDeletions > 0) && (
            <span className="edit-total-stats">
              <span className="edit-stat-added">+{totalAdditions}</span>
              <span className="edit-stat-deleted">-{totalDeletions}</span>
            </span>
          )}
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
            {editItems.map((item, index) => {
              const isExpanded = expandedIndices.has(index);

              // 文件图标
              const fileIconSvg = getFileIcon(item.cleanFileName.split('.').pop() || '', item.cleanFileName);

              // 单个工具状态
              const itemStatus = item.isError ? 'error' : item.isCompleted ? 'completed' : 'pending';

              return (
                <div key={item.id} className="task-group-item">
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
                        className="task-group-item-file clickable-file edit-diff-hover-trigger"
                        title={item.filePath}
                        onClick={(event) => {
                          event.stopPropagation();
                          void openFile(item.openPath, item.lineStart, item.lineEnd, currentCwd);
                        }}
                      >
                        <span className="edit-diff-hover-label">{item.displayPath}</span>
                        <EditDiffPreview
                          filePath={item.displayPath}
                          additions={item.additions}
                          deletions={item.deletions}
                          lines={item.diffPreviewLines}
                        />
                      </span>
                    </div>
                    <div className="task-group-item-status">
                      {(item.additions > 0 || item.deletions > 0) && (
                        <span className="task-group-item-badge edit-item-stats">
                          <span className="edit-stat-added">+{item.additions}</span>
                          <span className="edit-stat-deleted">-{item.deletions}</span>
                        </span>
                      )}
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
                      <EditToolBlock
                        name={item.name}
                        input={item.input}
                        result={item.result}
                        toolId={item.toolId}
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

export default EditToolGroupBlock;
