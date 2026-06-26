#!/usr/bin/env node

/**
 * 一键发布脚本。
 *
 * 默认执行：
 * 1. 检查 main 分支、工作区干净、目标 tag 不存在
 * 2. 更新版本元数据和 changelog
 * 3. 运行验证命令
 * 4. 清理生成物
 * 5. 提交版本更新、创建注释 tag
 * 6. 推送 main 和 tag 触发 GitHub Actions release
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import readline from 'readline';

import {
  colors,
  generateTagMessage,
  getTodayString,
  updateProjectVersions,
  validReleaseTypes,
  versionRegex,
} from './bump-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, '..');

export const RELEASE_FILES = [
  'package.json',
  'package-lock.json',
  'src-tauri/tauri.conf.json',
  'website/package.json',
  'website/package-lock.json',
  'website/src/pages/Changelog.tsx',
];

const GENERATED_OUTPUT_DIRS = [
  'dist',
  'website/dist',
  'out',
  'website/out',
];

const DEFAULT_VERIFY_COMMANDS = [
  { command: 'git', args: ['diff', '--check'], label: '检查工作区空白错误' },
  { command: 'npm', args: ['test'], label: '运行前端测试' },
  { command: 'npm', args: ['run', 'build'], label: '构建桌面前端' },
  { command: 'cargo', args: ['check', '--manifest-path', 'src-tauri/Cargo.toml'], label: '检查 Rust 后端编译' },
  { command: 'npm', args: ['run', 'build'], cwd: path.join(projectRoot, 'website'), label: '构建官网' },
];

export function buildTagMessage({ version, releaseType, description, date = getTodayString() }) {
  return generateTagMessage(version, releaseType, description, date);
}

export function parseReleaseArgs(args) {
  const passthrough = [];
  const options = {
    dryRun: false,
    skipVerify: false,
    yes: false,
    noPush: false,
    allowDirty: false,
    help: false,
    remote: 'origin',
    branch: 'main',
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-verify') {
      options.skipVerify = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--no-push') {
      options.noPush = true;
    } else if (arg === '--allow-dirty') {
      options.allowDirty = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--remote=')) {
      options.remote = arg.slice('--remote='.length);
    } else if (arg.startsWith('--branch=')) {
      options.branch = arg.slice('--branch='.length);
    } else {
      passthrough.push(arg);
    }
  }

  const version = passthrough[0] || '';
  const maybeReleaseType = passthrough[1];
  const hasExplicitType = validReleaseTypes.includes(maybeReleaseType);
  const releaseType = hasExplicitType ? maybeReleaseType : 'minor';
  const descriptionParts = hasExplicitType ? passthrough.slice(2) : passthrough.slice(1);

  return {
    ...options,
    version,
    releaseType,
    description: descriptionParts.join(' ').trim(),
  };
}

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

function commandToString(command, args) {
  return [command, ...args].join(' ');
}

function run(command, args, { cwd = projectRoot, stdio = 'inherit', allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio,
    encoding: stdio === 'pipe' ? 'utf-8' : undefined,
    shell: process.platform === 'win32',
  });

  if (result.error && !allowFailure) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`命令失败(${result.status}): ${commandToString(command, args)}`);
  }

  return result;
}

function gitOutput(args, { allowFailure = false } = {}) {
  const result = run('git', args, {
    stdio: 'pipe',
    allowFailure,
  });
  return result.stdout?.trim() || '';
}

function ensureValidOptions(options) {
  if (!options.version) {
    throw new Error('请提供版本号');
  }
  if (!versionRegex.test(options.version)) {
    throw new Error(`版本号格式无效 "${options.version}"，格式应为 x.y.z 或 x.y.z-<prerelease>`);
  }
  if (!validReleaseTypes.includes(options.releaseType)) {
    throw new Error(`更新类型无效 "${options.releaseType}"，有效类型: ${validReleaseTypes.join(', ')}`);
  }
}

function ensureCurrentBranch(expectedBranch) {
  const branch = gitOutput(['branch', '--show-current']);
  if (branch !== expectedBranch) {
    throw new Error(`当前分支是 "${branch}"，发布脚本要求在 "${expectedBranch}" 分支运行`);
  }
}

function ensureCleanWorktree() {
  const status = gitOutput(['status', '--porcelain']);
  if (status) {
    throw new Error(`工作区不干净，请先提交或暂存无关改动:\n${status}`);
  }
}

function ensureTagDoesNotExist(tagName) {
  const result = run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tagName}`], {
    stdio: 'pipe',
    allowFailure: true,
  });
  if (result.status === 0) {
    throw new Error(`本地 tag ${tagName} 已存在，禁止覆盖已有发布标签`);
  }
}

function removeGeneratedOutputs() {
  for (const relativePath of GENERATED_OUTPUT_DIRS) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
      log(colors.yellow, `  清理生成目录: ${relativePath}`);
    }
  }
}

function backupReleaseFiles() {
  const backup = new Map();

  for (const relativePath of RELEASE_FILES) {
    const absolutePath = path.join(projectRoot, relativePath);
    backup.set(relativePath, fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath) : null);
  }

  return backup;
}

function restoreReleaseFiles(backup) {
  for (const [relativePath, content] of backup.entries()) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (content === null) {
      fs.rmSync(absolutePath, { force: true });
      continue;
    }

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  run('git', ['reset', '--', ...RELEASE_FILES], {
    stdio: 'pipe',
    allowFailure: true,
  });
}

function runVerification() {
  for (const item of DEFAULT_VERIFY_COMMANDS) {
    log(colors.cyan, `\n▶ ${item.label}`);
    log(colors.reset, `  ${commandToString(item.command, item.args)}`);
    run(item.command, item.args, { cwd: item.cwd || projectRoot });
  }
}

function stageReleaseFiles() {
  run('git', ['add', ...RELEASE_FILES]);
  run('git', ['diff', '--cached', '--check']);
}

function createAnnotatedTag(tagName, tagMessage) {
  const tempPath = path.join(os.tmpdir(), `ccg-switch-${tagName}-tag-message-${process.pid}.md`);
  fs.writeFileSync(tempPath, tagMessage, 'utf-8');
  try {
    run('git', ['tag', '-a', tagName, '--cleanup=verbatim', '-F', tempPath]);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${message} (y/N): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function printUsage() {
  log(colors.yellow, '\n用法: npm run release -- <版本号> [类型] [描述] [选项]');
  log(colors.yellow, '\n示例:');
  log(colors.reset, '  npm run release -- 1.6.4 minor "新增一键发布脚本"');
  log(colors.reset, '  npm run release:dry -- 1.6.4 patch "修复发布流程"');
  log(colors.reset, '  npm run release -- 1.6.4 patch "修复发布流程" --yes');
  log(colors.yellow, '\n选项:');
  log(colors.reset, '  --dry-run       只打印计划，不修改文件、不提交、不打 tag、不推送');
  log(colors.reset, '  --skip-verify   跳过 npm test/build/cargo check 等验证');
  log(colors.reset, '  --yes, -y       跳过交互确认');
  log(colors.reset, '  --no-push       本地提交并打 tag，但不推送远端');
  log(colors.reset, '  --remote=<name> 指定远端，默认 origin');
  log(colors.reset, '  --branch=<name> 指定发布分支，默认 main');
}

function printReleasePlan(options, tagName, tagMessage) {
  log(colors.bold, '\n========================================');
  log(colors.bold, '  CCG Switch 一键发布');
  log(colors.bold, '========================================\n');
  log(colors.reset, `  版本: ${colors.green}${options.version}${colors.reset}`);
  log(colors.reset, `  类型: ${colors.yellow}${options.releaseType}${colors.reset}`);
  log(colors.reset, `  描述: ${options.description || '(空)'}`);
  log(colors.reset, `  分支: ${options.branch}`);
  log(colors.reset, `  远端: ${options.remote}`);
  log(colors.reset, `  Tag: ${tagName}`);
  log(colors.reset, `  Dry run: ${options.dryRun ? 'yes' : 'no'}`);
  log(colors.reset, `  验证: ${options.skipVerify ? 'skip' : 'run'}`);
  log(colors.reset, `  推送: ${options.noPush ? 'skip' : 'run'}`);
  log(colors.cyan, '\nTag 消息:\n');
  log(colors.reset, tagMessage);
}

export async function runRelease(rawArgs = process.argv.slice(2)) {
  const options = parseReleaseArgs(rawArgs);

  if (options.help) {
    printUsage();
    return 0;
  }

  try {
    ensureValidOptions(options);
  } catch (error) {
    log(colors.red, `错误: ${error.message}`);
    printUsage();
    return 1;
  }

  const tagName = `v${options.version}`;
  const date = getTodayString();
  const tagMessage = buildTagMessage({
    version: options.version,
    releaseType: options.releaseType,
    description: options.description,
    date,
  });

  printReleasePlan(options, tagName, tagMessage);

  if (options.dryRun) {
    log(colors.yellow, '\nDry run 模式：不会修改文件、提交、打 tag 或推送。');
    return 0;
  }

  try {
    ensureCurrentBranch(options.branch);
    if (!options.allowDirty) {
      ensureCleanWorktree();
    }
    ensureTagDoesNotExist(tagName);
  } catch (error) {
    log(colors.red, `\n❌ 发布前检查失败: ${error.message}\n`);
    return 1;
  }

  if (!options.yes) {
    const confirmed = await confirm('\n⚠️  确认执行发布流程？');
    if (!confirmed) {
      log(colors.yellow, '\n❌ 操作已取消\n');
      return 0;
    }
  }

  const releaseFileBackup = backupReleaseFiles();
  let versionCommitCreated = false;

  try {
    log(colors.cyan, '\n🔄 更新版本元数据...\n');
    updateProjectVersions({
      version: options.version,
      releaseType: options.releaseType,
      description: options.description,
      date,
    });

    removeGeneratedOutputs();

    if (!options.skipVerify) {
      runVerification();
    } else {
      log(colors.yellow, '\n⚠️  已跳过验证命令');
      run('git', ['diff', '--check']);
    }

    removeGeneratedOutputs();
    stageReleaseFiles();

    log(colors.cyan, '\n📝 创建版本提交...');
    run('git', ['commit', '-m', `chore: bump version to ${options.version}`]);
    versionCommitCreated = true;

    log(colors.cyan, `\n🏷️  创建注释标签 ${tagName}...`);
    createAnnotatedTag(tagName, tagMessage);

    if (!options.noPush) {
      log(colors.cyan, `\n⬆️  推送 ${options.branch}...`);
      run('git', ['push', options.remote, options.branch]);

      log(colors.cyan, `\n⬆️  推送 ${tagName}...`);
      run('git', ['push', options.remote, tagName]);
    } else {
      log(colors.yellow, `\n⚠️  已跳过推送。需要手动执行: git push ${options.remote} ${options.branch} && git push ${options.remote} ${tagName}`);
    }

    const commit = gitOutput(['rev-parse', 'HEAD']);
    log(colors.green, '\n✅ 发布流程已完成');
    log(colors.reset, `  commit: ${commit}`);
    log(colors.reset, `  tag: ${tagName}`);
    if (!options.noPush) {
      log(colors.reset, '  GitHub Actions release workflow should be triggered by the tag push.');
    }
    return 0;
  } catch (error) {
    if (!versionCommitCreated) {
      restoreReleaseFiles(releaseFileBackup);
      removeGeneratedOutputs();
      log(colors.yellow, '\n已恢复本次脚本写入的发布元数据文件，工作区不会残留半更新版本。');
    }

    log(colors.red, `\n❌ 发布流程失败: ${error.message}\n`);
    log(colors.yellow, '恢复提示:');
    log(colors.reset, `  1. 查看当前状态: git status --short --branch`);
    log(colors.reset, `  2. 如果提交已完成但 tag 未推送: git push ${options.remote} ${tagName}`);
    log(colors.reset, `  3. 如果 main 已推送但 tag 未推送: git push ${options.remote} ${tagName}`);
    log(colors.reset, `  4. 如果本地未提交，脚本已恢复版本文件；修复问题后重新运行发布命令`);
    return 1;
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runRelease().then((exitCode) => {
    process.exit(exitCode);
  }).catch((error) => {
    log(colors.red, `\n❌ 错误: ${error.message}\n`);
    process.exit(1);
  });
}
