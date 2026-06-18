// AgentGroupBlock - 子代理调用工具块

import {memo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Bot} from 'lucide-react';
import type {ToolResultBlock} from '../../types/chat';
import type {ToolInput} from '../../types/tools';
import {useIsToolDenied} from '../../hooks/useIsToolDenied';
import {extractAgentToolMeta, getToolDisplayStatus, summarizeAgentToolHeader,} from '../../utils/toolPresentation';
import SubagentHistoryPanel from './SubagentHistoryPanel';

export interface AgentGroupBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
  toolId?: string;
  compact?: boolean;
}

const AgentGroupBlock = memo(function AgentGroupBlock({
  name,
  input,
  result,
  toolId,
  compact = false,
}: AgentGroupBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isDenied = useIsToolDenied(toolId);

  if (!input) {
    return null;
  }

  const meta = extractAgentToolMeta(input, result);
  const header = summarizeAgentToolHeader(meta, result, 'agent');
  const status = getToolDisplayStatus(result, isDenied);
  const hasVisibleMeta = header.hasVisibleMeta;

  return (
    <div className={`task-container ${compact ? 'task-container-compact' : ''}`}>
      <div
        className={compact ? 'task-header task-header-compact' : 'task-header'}
        onClick={() => setExpanded((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        <div className="task-title-section">
          <Bot className="tool-title-lucide" aria-hidden="true" />
          <span className="tool-title-text">{name || t('tools.agent')}</span>
          <span className="tool-command-chip tool-command-plan">
            {t('tools.agent')}
          </span>
          {header.primarySummary && !expanded && (
            <span className="tool-title-summary task-summary-text" title={header.primarySummary}>
              {header.primarySummary}
            </span>
          )}
          {header.secondarySummary && (
            <span className="tool-title-secondary-summary" title={header.secondarySummary}>
              {header.secondarySummary}
            </span>
          )}
          {header.runtimeSummary && (
            <span className="tool-title-summary tool-title-runtime-summary" title={header.runtimeSummary}>
              {header.runtimeSummary}
            </span>
          )}
          {isDenied && <span className="tool-title-summary text-error">• {t('tools.denied')}</span>}
        </div>
        <div className={`tool-status-indicator ${status}`} />
      </div>

      {expanded && (
        <div className={`task-details ${compact ? 'task-details-compact' : ''}`}>
          <div className="task-content-wrapper">
            {meta.description && (
              <div className="tool-section">
                <div className="tool-section-label">{t('tools.description')}:</div>
                <div className="agent-description">{meta.description}</div>
              </div>
            )}

            {meta.agentId && (
              <div className="tool-section">
                <div className="tool-section-label">{t('tools.agentId')}:</div>
                <div className="agent-id-full">
                  <code>{meta.agentId}</code>
                </div>
              </div>
            )}

            {meta.model && (
              <div className="tool-section">
                <div className="tool-section-label">{t('tools.model')}:</div>
                <div className="agent-model">{meta.model}</div>
              </div>
            )}

            {meta.reasoningEffort && (
              <div className="tool-section">
                <div className="tool-section-label">{t('tools.reasoningEffort')}:</div>
                <div className="agent-reasoning">{meta.reasoningEffort}</div>
              </div>
            )}

            {meta.prompt && meta.prompt !== meta.description && (
              <div className="tool-section">
                <div className="tool-section-label">{t('tools.prompt')}:</div>
                <div className="task-field-content task-prompt">{meta.prompt}</div>
              </div>
            )}

            <SubagentHistoryPanel
              agentId={meta.agentId}
              description={meta.description}
              enabled={expanded}
              hasVisibleMeta={hasVisibleMeta}
              result={result}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default AgentGroupBlock;
