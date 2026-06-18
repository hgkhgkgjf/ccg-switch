import {useTranslation} from 'react-i18next';
import type {DiffPreviewLine} from '../../utils/toolPresentation';

interface EditDiffPreviewProps {
  filePath: string;
  additions: number;
  deletions: number;
  lines: DiffPreviewLine[];
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

export default function EditDiffPreview({
  filePath,
  additions,
  deletions,
  lines,
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

  return (
    <span className="edit-diff-hover-preview" role="tooltip">
      <span className="edit-diff-hover-header">
        <span className="edit-diff-hover-path" title={filePath}>{filePath}</span>
        <span className="edit-diff-hover-stats">
          <span className="edit-diff-hover-summary" title={previewLabel}>{previewLabel}</span>
          <span className="edit-stat-added">+{additions}</span>
          <span className="edit-stat-deleted">-{deletions}</span>
        </span>
      </span>
      <span className="edit-diff-hover-body">
        {lines.slice(0, 16).map((line, index) => (
          <span key={`${line.kind}-${index}-${line.oldLineNumber ?? ''}-${line.newLineNumber ?? ''}`} className={`edit-diff-hover-line ${line.kind}`}>
            <span className="edit-diff-hover-number">{renderLineNumber(line)}</span>
            <span className="edit-diff-hover-marker">{renderMarker(line)}</span>
            <span className="edit-diff-hover-content">{line.text || ' '}</span>
          </span>
        ))}
        {lines.length > 16 && (
          <span className="edit-diff-hover-more">
            {t('tools.moreDiffLines', { count: lines.length - 16 })}
          </span>
        )}
      </span>
    </span>
  );
}
