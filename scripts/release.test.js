import fs from 'fs';

import {describe, expect, it} from 'vitest';

import {
    buildTagMessage,
    createVersionCommit,
    parseReleaseArgs,
    RELEASE_FILES,
    resolveSpawnCommand,
} from './release.js';

describe('release automation script', () => {
  it('parses dry-run release arguments without swallowing description words', () => {
    const options = parseReleaseArgs([
      '--dry-run',
      '--skip-verify',
      '1.6.4',
      'patch',
      '修复',
      '发布',
      '流程',
    ]);

    expect(options).toMatchObject({
      dryRun: true,
      skipVerify: true,
      version: '1.6.4',
      releaseType: 'patch',
      description: '修复 发布 流程',
    });
  });

  it('builds a verbatim markdown tag message for annotated releases', () => {
    const message = buildTagMessage({
      version: '1.6.4',
      releaseType: 'minor',
      description: '新增一键发布脚本',
      date: '2026-06-26',
    });

    expect(message).toContain('v1.6.4');
    expect(message).toContain('发布日期: 2026-06-26');
    expect(message).toContain('### 新增功能');
    expect(message).toContain('新增一键发布脚本');
    expect(message).toContain('### 下载说明');
  });

  it('stages every version metadata file touched by the release flow', () => {
    expect(RELEASE_FILES).toEqual([
      'package.json',
      'package-lock.json',
      'src-tauri/tauri.conf.json',
      'website/package.json',
      'website/package-lock.json',
      'website/src/pages/Changelog.tsx',
    ]);
  });

  it('creates version commits from a message file so spaces are not split by Windows shell quoting', () => {
    const calls = [];
    let messageFilePath = '';
    let messageFileContent = '';

    createVersionCommit('1.6.5', (command, args) => {
      calls.push({ command, args });
      messageFilePath = args.at(-1);
      messageFileContent = fs.readFileSync(messageFilePath, 'utf-8');
    });

    expect(calls).toEqual([
      {
        command: 'git',
        args: ['commit', '-F', messageFilePath],
      },
    ]);
    expect(messageFileContent).toBe('chore: bump version to 1.6.5\n');
    expect(fs.existsSync(messageFilePath)).toBe(false);
  });

  it('resolves npm through cmd.exe on Windows without putting every command behind a shell', () => {
    const resolved = resolveSpawnCommand('npm', ['test']);

    if (process.platform === 'win32') {
      expect(resolved).toEqual({
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', 'npm', 'test'],
      });
      return;
    }

    expect(resolved).toEqual({
      command: 'npm',
      args: ['test'],
    });
  });
});
