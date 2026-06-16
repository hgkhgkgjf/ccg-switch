// EditToolGroupBlock - Edit 工具分组块

import { useState, memo } from 'react';
import type { ToolUseBlock, ToolResultBlock } from '../../types/chat';
import { getGroupStatus } from '../../utils/toolGrouping';
import { resolveToolTarget } from '../../utils/toolPresentation';
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
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  // 计算整体状态
  const status = getGroupStatus(blocks, findToolResult);

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

  // 计算变更数量（简化版）
  const getChangeCount = (block: ToolUseBlock): number => {
    const oldString = block.input.old_string as string | undefined;
    const newString = block.input.new_string as string | undefined;
    if (oldString && newString) return 2; // 删除 + 添加
    if (oldString || newString) return 1;
    return 0;
  };

  return (
    <div className="task-container task-group-container">
      {/* 分组标题 */}
      <div className="task-header task-group-header">
        <div className="task-title-section">
          <span className="edit-icon">✏️</span>
          <span className="tool-title-text">Edit</span>
          <span className="tool-title-summary">
            {blocks.length} {blocks.length === 1 ? 'file modified' : 'files modified'}
          </span>
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {/* 分组列表 */}
      <div className="task-group-list">
        {blocks.map((block, index) => {
          const result = findToolResult(block.id);
          const target = resolveToolTarget(block.input);
          const filePath = target?.displayPath || '';
          const changeCount = getChangeCount(block);
          const isExpanded = expandedIndices.has(index);

          // 文件图标
          const fileIconSvg = target
            ? getFileIcon(target.cleanFileName.split('.').pop() || '', target.cleanFileName)
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
                  <span className="task-group-item-file" title={filePath}>
                    {filePath}
                  </span>
                </div>
                <div className="task-group-item-status">
                  {changeCount > 0 && (
                    <span className="task-group-item-badge">
                      {changeCount} {changeCount === 1 ? 'change' : 'changes'}
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
                    name={block.name}
                    input={block.input}
                    result={result}
                    toolId={block.id}
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
