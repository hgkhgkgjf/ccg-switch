// EditToolGroupBlock - Edit 工具分组块

import { useMemo, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolUseBlock, ToolResultBlock } from '../../types/chat';
import { getGroupStatus } from '../../utils/toolGrouping';
import { collectEditToolItems } from '../../utils/toolPresentation';
import { getFileIcon } from '../../utils/fileIcons';
import EditToolBlock from './EditToolBlock';

export interface EditToolGroupBlockProps {
  blocks: ToolUseBlock[];
  findToolResult: (toolId: string) => ToolResultBlock | null | undefined;
}

const EditToolGroupBlock = memo(function EditToolGroupBlock({
  blocks,
  findToolResult,
}: EditToolGroupBlockProps) {
  const { t } = useTranslation();
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  // 计算整体状态
  const status = getGroupStatus(blocks, findToolResult);
  const editItems = useMemo(
    () => collectEditToolItems(blocks, findToolResult),
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
    <div className="task-container task-group-container">
      {/* 分组标题 */}
      <div className="task-header task-group-header">
        <div className="task-title-section">
          <span className="edit-icon">✏️</span>
          <span className="tool-title-text">{t('tools.editBatchFiles')}</span>
          <span className="tool-title-summary">
            ({editItems.length})
          </span>
          {(totalAdditions > 0 || totalDeletions > 0) && (
            <span className="edit-total-stats">
              {totalAdditions > 0 && <span className="edit-stat-added">+{totalAdditions}</span>}
              {totalDeletions > 0 && <span className="edit-stat-deleted">-{totalDeletions}</span>}
            </span>
          )}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {/* 分组列表 */}
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
                  <span className="task-group-item-file" title={item.filePath}>
                    {item.displayPath}
                  </span>
                </div>
                <div className="task-group-item-status">
                  {(item.additions > 0 || item.deletions > 0) && (
                    <span className="task-group-item-badge edit-item-stats">
                      {item.additions > 0 && <span className="edit-stat-added">+{item.additions}</span>}
                      {item.deletions > 0 && <span className="edit-stat-deleted">-{item.deletions}</span>}
                    </span>
                  )}
                  <span className={`badge badge-sm ${itemStatus === 'error' ? 'badge-error' : itemStatus === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                    {itemStatus === 'error' ? 'Failed' : itemStatus === 'completed' ? 'Success' : 'Pending'}
                  </span>
                  <span className="task-group-item-chevron">
                    {isExpanded ? '▼' : '▶'}
                  </span>
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
          className="btn btn-sm btn-ghost"
          onClick={() => toggleAll(true)}
        >
          Expand All
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => toggleAll(false)}
        >
          Collapse All
        </button>
      </div>
    </div>
  );
});

export default EditToolGroupBlock;
