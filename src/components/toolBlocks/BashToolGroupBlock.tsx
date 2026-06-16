// BashToolGroupBlock - Bash 工具分组块

import { useState, memo } from 'react';
import type { ToolUseBlock, ToolResultBlock } from '../../types/chat';
import { getGroupStatus } from '../../utils/toolGrouping';
import BashToolBlock from './BashToolBlock';

export interface BashToolGroupBlockProps {
  blocks: ToolUseBlock[];
  findToolResult: (toolId: string) => ToolResultBlock | null | undefined;
}

const BashToolGroupBlock = memo(function BashToolGroupBlock({
  blocks,
  findToolResult,
}: BashToolGroupBlockProps) {
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

  return (
    <div className="task-container task-group-container">
      {/* 分组标题 */}
      <div className="task-header task-group-header">
        <div className="task-title-section">
          <span className="bash-icon">$</span>
          <span className="tool-title-text">Bash</span>
          <span className="tool-title-summary">
            {blocks.length} {blocks.length === 1 ? 'command' : 'commands'}
          </span>
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {/* 分组列表 */}
      <div className="task-group-list">
        {blocks.map((block, index) => {
          const result = findToolResult(block.id);
          const command = (block.input.command as string) || '';
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
                  <span className="task-group-item-command" title={command}>
                    {command}
                  </span>
                </div>
                <div className="task-group-item-status">
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
                  <BashToolBlock
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

export default BashToolGroupBlock;
