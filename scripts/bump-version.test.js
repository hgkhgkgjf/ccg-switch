import { describe, expect, it } from 'vitest';

import {
  buildChangelogEntry,
  parseCliArgs,
} from './bump-version.js';

describe('bump-version script helpers', () => {
  it('parses --yes separately from multi-word descriptions', () => {
    const options = parseCliArgs([
      '1.6.4',
      'patch',
      '修复',
      '发布',
      '流程',
      '--yes',
    ]);

    expect(options).toMatchObject({
      newVersion: '1.6.4',
      releaseType: 'patch',
      description: '修复 发布 流程',
      yes: true,
    });
  });

  it('builds changelog entries with stable single-quoted text', () => {
    const entry = buildChangelogEntry({
      version: '1.6.4',
      releaseType: 'minor',
      description: "新增发布脚本's dry-run",
      date: '2026-06-26',
    });

    expect(entry).toContain("version: '1.6.4'");
    expect(entry).toContain("type: 'minor'");
    expect(entry).toContain("{ type: 'feature', text: '新增发布脚本\\'s dry-run' }");
    expect(entry).not.toContain('text: "');
  });
});
