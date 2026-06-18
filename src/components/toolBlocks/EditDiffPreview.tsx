import {useTranslation} from 'react-i18next';
import type {DiffPreviewLine} from '../../utils/toolPresentation';

export type EditDiffPreviewMode = 'unified' | 'split';

interface EditDiffPreviewProps {
  filePath: string;
  additions: number;
  deletions: number;
  lines: DiffPreviewLine[];
  mode?: EditDiffPreviewMode;
  wrapLines?: boolean;
  visible?: boolean;
  floatingTop?: number;
  variant?: 'hover' | 'panel';
  surface?: 'default' | 'status';
  lineLimit?: number;
}

function renderLineNumber(line: DiffPreviewLine): string {
  if (line.kind === 'added') return line.newLineNumber ? String(line.newLineNumber) : '';
  if (line.kind === 'removed') return line.oldLineNumber ? String(line.oldLineNumber) : '';

  if (line.oldLineNumber && line.newLineNumber && line.oldLineNumber !== line.newLineNumber) {
    return `${line.oldLineNumber}/${line.newLineNumber}`;
  }

  return line.newLineNumber || line.oldLineNumber ? String(line.newLineNumber ?? line.oldLineNumber) : '';
}

function renderMarker(line: DiffPreviewLine): string {
  if (line.kind === 'added') return '+';
  if (line.kind === 'removed') return '-';
  return ' ';
}

function renderOldLineNumber(line: DiffPreviewLine): string {
  return line.oldLineNumber ? String(line.oldLineNumber) : '';
}

function renderNewLineNumber(line: DiffPreviewLine): string {
  return line.newLineNumber ? String(line.newLineNumber) : '';
}

export default function EditDiffPreview({
  filePath,
  additions,
  deletions,
  lines,
  mode = 'unified',
  wrapLines,
  visible = false,
  floatingTop,
  variant = 'hover',
  surface = 'default',
  lineLimit,
}: EditDiffPreviewProps) {
  const { t } = useTranslation();
  const totalLineChange = additions + deletions;
  const fallbackPreviewLabel = totalLineChange > 0
    ? `${additions} added, ${deletions} removed`
    : 'No line delta';
  const translatedPreviewLabel = totalLineChange > 0
    ? t('tools.diffPreviewSummary', {
        defaultValue: fallbackPreviewLabel,
        additions,
        deletions,
      })
    : t('tools.diffPreviewSummaryNoChange', {
        defaultValue: fallbackPreviewLabel,
      });
  const previewLabel = translatedPreviewLabel.includes('{{additions}}') || translatedPreviewLabel.includes('{{deletions}}')
    ? fallbackPreviewLabel
    : translatedPreviewLabel;

  if (lines.length === 0) return null;

  const isPanel = variant === 'panel';
  const shouldWrapLines = isPanel ? (wrapLines ?? true) : false;
  const effectiveLineLimit = lineLimit ?? (isPanel ? undefined : 16);
  const previewLines = typeof effectiveLineLimit === 'number' ? lines.slice(0, effectiveLineLimit) : lines;
  const hiddenLineCount = Math.max(0, lines.length - previewLines.length);
  const rootClassName = isPanel
    ? `edit-diff-panel edit-diff-panel-${mode} ${shouldWrapLines ? 'edit-diff-panel-wrap' : 'edit-diff-panel-nowrap'}`
    : `edit-diff-hover-preview edit-diff-hover-preview-${mode}${surface === 'status' ? ' edit-diff-hover-preview-status' : ''}${visible ? ' is-visible' : ''}`;

  return (
    <span
      className={rootClassName}
      role="tooltip"
      style={!isPanel && typeof floatingTop === 'number' ? { top: floatingTop } : undefined}
    >
      <span className="edit-diff-hover-header">
        <span className="edit-diff-hover-path" title={filePath}>{filePath}</span>
        <span className="edit-diff-hover-stats">
          <span className="edit-diff-hover-summary" title={previewLabel}>{previewLabel}</span>
          <span className="edit-stat-added">+{additions}</span>
          <span className="edit-stat-deleted">-{deletions}</span>
        </span>
      </span>
      <span className="edit-diff-hover-body">
        {mode === 'split' ? (
          <span className="edit-diff-hover-split">
            {previewLines.map((line, index) => (
              <span key={`${line.kind}-${index}-${line.oldLineNumber ?? ''}-${line.newLineNumber ?? ''}`} className={`edit-diff-hover-split-row ${line.kind}`}>
                <span className={`edit-diff-hover-split-cell old ${line.kind === 'added' ? 'empty' : line.kind}`}>
                  <span className="edit-diff-hover-number">{line.kind === 'added' ? '' : renderOldLineNumber(line)}</span>
                  <span className="edit-diff-hover-marker">{line.kind === 'added' ? '' : renderMarker(line)}</span>
                  <span className="edit-diff-hover-content">{line.kind === 'added' ? ' ' : (line.text || ' ')}</span>
                </span>
                <span className={`edit-diff-hover-split-cell new ${line.kind === 'removed' ? 'empty' : line.kind}`}>
                  <span className="edit-diff-hover-number">{line.kind === 'removed' ? '' : renderNewLineNumber(line)}</span>
                  <span className="edit-diff-hover-marker">{line.kind === 'removed' ? '' : renderMarker(line)}</span>
                  <span className="edit-diff-hover-content">{line.kind === 'removed' ? ' ' : (line.text || ' ')}</span>
                </span>
              </span>
            ))}
          </span>
        ) : (
          previewLines.map((line, index) => (
            <span key={`${line.kind}-${index}-${line.oldLineNumber ?? ''}-${line.newLineNumber ?? ''}`} className={`edit-diff-hover-line ${line.kind}`}>
              <span className="edit-diff-hover-number">{renderLineNumber(line)}</span>
              <span className="edit-diff-hover-marker">{renderMarker(line)}</span>
              <span className="edit-diff-hover-content">{line.text || ' '}</span>
            </span>
          ))
        )}
        {hiddenLineCount > 0 && (
          <span className="edit-diff-hover-more">
            {t('tools.moreDiffLines', { count: hiddenLineCount })}
          </span>
        )}
      </span>
    </span>
  );
}
