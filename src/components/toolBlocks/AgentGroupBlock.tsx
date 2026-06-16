// AgentGroupBlock - 子代理调用工具块（占位符版本）

import { useState, memo } from 'react';
import type { ToolResultBlock } from '../../types/chat';
import { useIsToolDenied } from '../../hooks/useIsToolDenied';
import { extractResultText } from '../../utils/toolPresentation';

export interface AgentGroupBlockProps {
  name?: string;
  input?: Record<string, unknown>;
  result?: ToolResultBlock | null;
  toolId?: string;
}

/**
 * 解析 Agent 元数据
 */
function parseAgentMeta(input: Record<string, unknown>, result?: ToolResultBlock | null) {
  const description = (input.description as string) || (input.prompt as string) || '';
  const subagentType = (input.subagent_type as string) || (input.name as string) || '';
  const model = (input.model as string) || '';
  const reasoningEffort = (input.reasoning_effort as string) || (input.reasoningEffort as string) || '';

  // 尝试从结果中提取 agent_id
  let agentId = (input.agent_id as string) || (input.agentId as string) || '';
  if (!agentId && result) {
    const text = extractResultText(result);
    const match = text.match(/\b([0-9a-f]{8}-[0-9a-f-]{27})\b/i);
    if (match) {
      agentId = match[1];
    }
  }

  return {
    description,
    subagentType,
    model,
    reasoningEffort,
    agentId,
  };
}

const AgentGroupBlock = memo(function AgentGroupBlock({
  name,
  input,
  result,
  toolId,
}: AgentGroupBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isDenied = useIsToolDenied(toolId);

  if (!input) {
    return null;
  }

  const meta = parseAgentMeta(input, result);

  // 状态计算
  const isCompleted = (result !== undefined && result !== null) || isDenied;
  const isError = isDenied || (isCompleted && result?.is_error === true);
  const status = isError ? 'error' : isCompleted ? 'completed' : 'pending';

  // 缩短 agent_id 显示
  const shortAgentId = meta.agentId
    ? meta.agentId.length > 8
      ? `${meta.agentId.slice(0, 8)}…`
      : meta.agentId
    : '';

  return (
    <div className="task-container">
      <div
        className="task-header"
        onClick={() => setExpanded((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        <div className="task-title-section">
          <span className="agent-icon">🤖</span>
          <span className="tool-title-text">{name || 'Agent'}</span>
          {meta.subagentType && (
            <span className="tool-title-summary">{meta.subagentType}</span>
          )}
          {meta.model && (
            <span className="tool-title-summary">· {meta.model}</span>
          )}
          {shortAgentId && (
            <span className="tool-title-summary agent-id-badge">{shortAgentId}</span>
          )}
          {isDenied && <span className="tool-title-summary text-error">• Denied</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className="task-details">
          <div className="task-content-wrapper">
            {/* 描述 */}
            {meta.description && (
              <div className="tool-section">
                <div className="tool-section-label">Description:</div>
                <div className="agent-description">{meta.description}</div>
              </div>
            )}

            {/* Agent ID */}
            {meta.agentId && (
              <div className="tool-section">
                <div className="tool-section-label">Agent ID:</div>
                <div className="agent-id-full">
                  <code>{meta.agentId}</code>
                </div>
              </div>
            )}

            {/* Model */}
            {meta.model && (
              <div className="tool-section">
                <div className="tool-section-label">Model:</div>
                <div className="agent-model">{meta.model}</div>
              </div>
            )}

            {/* Reasoning Effort */}
            {meta.reasoningEffort && (
              <div className="tool-section">
                <div className="tool-section-label">Reasoning Effort:</div>
                <div className="agent-reasoning">{meta.reasoningEffort}</div>
              </div>
            )}

            {/* 子代理历史占位符 */}
            <div className="tool-section">
              <div className="agent-history-placeholder">
                <div className="agent-history-placeholder-text">
                  📋 Subagent History (click to load)
                </div>
                <div className="agent-history-placeholder-note">
                  完整实现需要会话历史管理任务 (06-16-session-history-management)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AgentGroupBlock;
