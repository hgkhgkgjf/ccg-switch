// TaskExecutionBlock - Task 工具（spawn_agent、task）专用块

import { useState, memo } from 'react';
import type { ToolResultBlock } from '../../types/chat';
import type { ToolInput } from '../../types/tools';
import { useIsToolDenied } from '../../hooks/useIsToolDenied';
import { extractResultText } from '../../utils/toolPresentation';

export interface TaskExecutionBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
}

interface SpawnAgentMeta {
  agentId?: string;
  nickname?: string;
  model?: string;
  reasoningEffort?: string;
  description?: string;
  prompt?: string;
}

/**
 * 解析 spawn_agent 元数据
 */
function parseSpawnAgentMeta(input: ToolInput, result?: ToolResultBlock | null): SpawnAgentMeta {
  const text = result ? extractResultText(result) : '';
  let parsed: Record<string, unknown> | null = null;

  // 尝试 JSON 解析结果
  if (text && (text.startsWith('{') || text.startsWith('['))) {
    try {
      const candidate = JSON.parse(text);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      // 忽略解析失败
    }
  }

  const getString = (...values: unknown[]): string | undefined => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  };

  const agentId =
    getString(parsed?.agent_id, parsed?.agentId, parsed?.agent_path, parsed?.agentPath) ??
    text?.match(/\b([0-9a-f]{8}-[0-9a-f-]{27})\b/i)?.[1];

  const nickname = getString(parsed?.nickname, parsed?.name, input.nickname, input.name);

  const model =
    getString(parsed?.model, input.model) ??
    text?.match(/\(([A-Za-z0-9._:-]+)(?:\s+(low|medium|high|xhigh))?\)/i)?.[1];

  const reasoningEffort =
    getString(parsed?.reasoning_effort, parsed?.reasoningEffort, input.reasoning_effort, input.reasoningEffort) ??
    text?.match(/\(([A-Za-z0-9._:-]+)(?:\s+(low|medium|high|xhigh))?\)/i)?.[2];

  return {
    agentId,
    nickname,
    model,
    reasoningEffort,
    description: getString(input.description),
    prompt: getString(input.prompt),
  };
}

const TaskExecutionBlock = memo(function TaskExecutionBlock({
  name,
  input,
  result,
  toolId,
}: TaskExecutionBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isDenied = useIsToolDenied(toolId);

  if (!input) {
    return null;
  }

  const meta = parseSpawnAgentMeta(input, result);

  // 状态计算
  const isCompleted = (result !== undefined && result !== null) || isDenied;
  const isError = isDenied || (isCompleted && result?.is_error === true);
  const status = isError ? 'error' : isCompleted ? 'completed' : 'pending';

  // 缩短 agent_id
  const shortAgentId = meta.agentId
    ? meta.agentId.length > 8
      ? `${meta.agentId.slice(0, 8)}…`
      : meta.agentId
    : '';

  // 模型摘要
  const modelSummary = [meta.model, meta.reasoningEffort].filter(Boolean).join(' ');

  return (
    <div className="task-container">
      <div
        className="task-header"
        onClick={() => setExpanded((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        <div className="task-title-section">
          <span className="task-icon">🛠️</span>
          <span className="tool-title-text">{name || 'Task'}</span>
          {meta.nickname && (
            <span className="tool-title-summary">{meta.nickname}</span>
          )}
          {modelSummary && (
            <span className="tool-title-summary">· {modelSummary}</span>
          )}
          {shortAgentId && (
            <span className="tool-title-summary agent-id-badge">{shortAgentId}</span>
          )}
          {meta.description && !expanded && (
            <span className="tool-title-summary task-summary-text" title={meta.description}>
              {meta.description}
            </span>
          )}
          {isDenied && <span className="tool-title-summary text-error">• Denied</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className="task-details">
          <div className="task-content-wrapper">
            {/* Nickname */}
            {meta.nickname && (
              <div className="tool-section">
                <div className="tool-section-label">Nickname:</div>
                <div className="task-field-content">{meta.nickname}</div>
              </div>
            )}

            {/* Model */}
            {meta.model && (
              <div className="tool-section">
                <div className="tool-section-label">Model:</div>
                <div className="task-field-content">{meta.model}</div>
              </div>
            )}

            {/* Reasoning Effort */}
            {meta.reasoningEffort && (
              <div className="tool-section">
                <div className="tool-section-label">Reasoning Effort:</div>
                <div className="task-field-content">{meta.reasoningEffort}</div>
              </div>
            )}

            {/* Agent ID */}
            {meta.agentId && (
              <div className="tool-section">
                <div className="tool-section-label">Agent ID:</div>
                <div className="task-field-content">
                  <code>{meta.agentId}</code>
                </div>
              </div>
            )}

            {/* Description */}
            {meta.description && (
              <div className="tool-section">
                <div className="tool-section-label">Description:</div>
                <div className="task-field-content">{meta.description}</div>
              </div>
            )}

            {/* Prompt */}
            {meta.prompt && (
              <div className="tool-section">
                <div className="tool-section-label">
                  <span className="codicon codicon-comment" style={{ marginRight: '4px' }} />
                  Prompt:
                </div>
                <div className="task-field-content task-prompt">{meta.prompt}</div>
              </div>
            )}

            {/* 其他参数 */}
            {Object.entries(input)
              .filter(
                ([key]) =>
                  ![
                    'description',
                    'prompt',
                    'model',
                    'reasoning_effort',
                    'reasoningEffort',
                    'nickname',
                    'name',
                    'agent_id',
                    'agentId',
                    'agent_path',
                    'agentPath',
                    'subagent_type',
                  ].includes(key)
              )
              .map(([key, value]) => (
                <div key={key} className="tool-section">
                  <div className="tool-section-label">{key}:</div>
                  <div className="task-field-content">
                    {typeof value === 'object' && value !== null
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default TaskExecutionBlock;
