#!/usr/bin/env node

/**
 * 统一更新项目版本号
 *
 * 用法: node scripts/bump-version.js <版本号> [更新类型] [更新描述...] [--yes]
 * 示例:
 *   node scripts/bump-version.js 1.2.15 minor "新增 macOS 自动更新功能"
 *   node scripts/bump-version.js 1.2.15 patch "修复权限问题" --yes
 *
 * 更新文件:
 * - package.json (根目录)
 * - package-lock.json (根目录)
 * - website/package.json
 * - website/package-lock.json
 * - src-tauri/tauri.conf.json
 * - website/src/pages/Changelog.tsx (新增版本条目)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, '..');

export const validReleaseTypes = ['major', 'minor', 'patch'];

export const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

export const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

export function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

export function readJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function readTauriConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/"version":\s*"([^"]+)"/);
  if (!match) {
    throw new Error(`无法从 ${filePath} 读取 version 字段`);
  }
  return match[1];
}

export function writeTauriConfig(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const nextContent = content.replace(/("version":\s*)"[^"]+"/, `$1"${newVersion}"`);
  fs.writeFileSync(filePath, nextContent, 'utf-8');
}

export function getTodayString(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTypeChangeType(releaseType) {
  switch (releaseType) {
    case 'major':
    case 'minor':
      return 'feature';
    case 'patch':
      return 'fix';
    default:
      return 'improvement';
  }
}

function escapeSingleQuotedTsString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function buildChangelogEntry({ version, releaseType, description, date = getTodayString() }) {
  const changeType = getTypeChangeType(releaseType);
  const changes = description
    ? `[
      { type: '${changeType}', text: '${escapeSingleQuotedTsString(description)}' }
    ]`
    : '[]';

  return `  {
    version: '${version}',
    date: '${date}',
    type: '${releaseType}',
    changes: ${changes}
  },`;
}

export function updateChangelog({
  version,
  releaseType,
  description,
  projectRoot = rootDir,
  date = getTodayString(),
}) {
  const changelogPath = path.join(projectRoot, 'website', 'src', 'pages', 'Changelog.tsx');

  if (!fs.existsSync(changelogPath)) {
    log(colors.yellow, '  ⚠️  Changelog.tsx 不存在，跳过更新');
    return null;
  }

  const content = fs.readFileSync(changelogPath, 'utf-8');
  const versionsArrayPattern = /const versions:\s*Version\[\]\s*=\s*\[\s*/;
  const match = versionsArrayPattern.exec(content);
  if (!match || match.index === undefined) {
    log(colors.yellow, '  ⚠️  无法找到 versions 数组，跳过 Changelog 更新');
    return null;
  }

  const insertAt = match.index + match[0].length;
  const entry = buildChangelogEntry({ version, releaseType, description, date });
  const newContent = `${content.slice(0, insertAt)}${entry}\n${content.slice(insertAt)}`;

  fs.writeFileSync(changelogPath, newContent, 'utf-8');

  return {
    version,
    date,
    type: releaseType,
    changes: description ? [{ type: getTypeChangeType(releaseType), text: description }] : [],
  };
}

export function generateTagMessage(version, releaseType, description, date = getTodayString()) {
  let message = `v${version}\n\n`;
  message += `发布日期: ${date}\n\n`;

  if (description) {
    const typeLabel = {
      major: '重大更新',
      minor: '新增功能',
      patch: '问题修复',
    }[releaseType] || '更新';

    message += `### ${typeLabel}\n\n${description}\n\n`;
  }

  message += '### 下载说明\n';
  message += '- **Windows**: 下载 `.exe` (NSIS安装包) 或 `.msi`\n';
  message += '- **macOS**: 下载 `.dmg`\n';
  message += '- **Linux**: 下载 `.deb` 或 `.AppImage`\n';

  return message;
}

export function parseCliArgs(args) {
  const passthrough = [];
  const options = {
    yes: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      passthrough.push(arg);
    }
  }

  const newVersion = passthrough[0] || '';
  const maybeReleaseType = passthrough[1];
  const hasExplicitType = validReleaseTypes.includes(maybeReleaseType);
  const releaseType = hasExplicitType ? maybeReleaseType : 'minor';
  const descriptionParts = hasExplicitType ? passthrough.slice(2) : passthrough.slice(1);

  return {
    ...options,
    newVersion,
    releaseType,
    description: descriptionParts.join(' ').trim(),
  };
}

export function validateVersionOptions({ newVersion, releaseType }) {
  if (!newVersion) {
    throw new Error('请提供版本号');
  }

  if (!versionRegex.test(newVersion)) {
    throw new Error(`版本号格式无效 "${newVersion}"，格式应为 x.y.z 或 x.y.z-<prerelease>`);
  }

  if (!validReleaseTypes.includes(releaseType)) {
    throw new Error(`更新类型无效 "${releaseType}"，有效类型: ${validReleaseTypes.join(', ')}`);
  }
}

export function getVersionFiles(projectRoot = rootDir) {
  return [
    {
      path: path.join(projectRoot, 'package.json'),
      name: 'package.json (根目录)',
      read: () => readJSON(path.join(projectRoot, 'package.json')).version,
      write: (version) => {
        const data = readJSON(path.join(projectRoot, 'package.json'));
        data.version = version;
        writeJSON(path.join(projectRoot, 'package.json'), data);
      },
    },
    {
      path: path.join(projectRoot, 'package-lock.json'),
      name: 'package-lock.json (根目录)',
      read: () => readJSON(path.join(projectRoot, 'package-lock.json')).version,
      write: (version) => updatePackageLockVersion(path.join(projectRoot, 'package-lock.json'), version),
      optional: true,
    },
    {
      path: path.join(projectRoot, 'website', 'package.json'),
      name: 'website/package.json',
      read: () => readJSON(path.join(projectRoot, 'website', 'package.json')).version,
      write: (version) => {
        const data = readJSON(path.join(projectRoot, 'website', 'package.json'));
        data.version = version;
        writeJSON(path.join(projectRoot, 'website', 'package.json'), data);
      },
    },
    {
      path: path.join(projectRoot, 'website', 'package-lock.json'),
      name: 'website/package-lock.json',
      read: () => readJSON(path.join(projectRoot, 'website', 'package-lock.json')).version,
      write: (version) => updatePackageLockVersion(path.join(projectRoot, 'website', 'package-lock.json'), version),
      optional: true,
    },
    {
      path: path.join(projectRoot, 'src-tauri', 'tauri.conf.json'),
      name: 'src-tauri/tauri.conf.json',
      read: () => readTauriConfig(path.join(projectRoot, 'src-tauri', 'tauri.conf.json')),
      write: (version) => writeTauriConfig(path.join(projectRoot, 'src-tauri', 'tauri.conf.json'), version),
    },
  ];
}

export function updatePackageLockVersion(filePath, version) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const data = readJSON(filePath);
  data.version = version;
  if (data.packages && data.packages['']) {
    data.packages[''].version = version;
  }
  writeJSON(filePath, data);
  return true;
}

export function updateProjectVersions({
  version,
  releaseType,
  description,
  projectRoot = rootDir,
  date = getTodayString(),
}) {
  validateVersionOptions({ newVersion: version, releaseType });

  const files = getVersionFiles(projectRoot);
  const updatedFiles = [];

  for (const file of files) {
    if (file.optional && !fs.existsSync(file.path)) {
      log(colors.yellow, `  ⚠️  ${file.name} 不存在，跳过更新`);
      continue;
    }

    file.write(version);
    updatedFiles.push(file.name);
    log(colors.green, `  ✅ ${file.name} → ${version}`);
  }

  const changelog = updateChangelog({
    version,
    releaseType,
    description,
    projectRoot,
    date,
  });

  return {
    updatedFiles,
    changelog,
    tagMessage: generateTagMessage(version, releaseType, description, date),
  };
}

export async function confirm(message) {
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
  log(colors.yellow, '\n用法: node scripts/bump-version.js <版本号> [类型] [描述] [--yes]');
  log(colors.yellow, '\n示例:');
  log(colors.reset, '  node scripts/bump-version.js 1.2.15 minor "新增 macOS 自动更新功能"');
  log(colors.reset, '  node scripts/bump-version.js 1.2.15 patch "修复权限问题" --yes');
  log(colors.reset, '  node scripts/bump-version.js 1.2.16 major "重大更新"');
  log(colors.yellow, '\n更新类型:');
  log(colors.reset, '  major  - 重大更新 (不兼容的 API 变更)');
  log(colors.reset, '  minor  - 新增功能 (向后兼容的新功能)');
  log(colors.reset, '  patch  - 补丁修复 (向后兼容的问题修复)');
}

export async function runCli(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);

  if (options.help) {
    printUsage();
    return 0;
  }

  try {
    validateVersionOptions(options);
  } catch (error) {
    log(colors.red, `错误: ${error.message}`);
    printUsage();
    return 1;
  }

  const { newVersion, releaseType, description } = options;
  const date = getTodayString();

  log(colors.bold, '\n========================================');
  log(colors.bold, '  CCG Switch 版本号统一更新');
  log(colors.bold, '========================================\n');

  log(colors.cyan, '📋 当前版本状态:\n');

  for (const file of getVersionFiles(rootDir)) {
    try {
      if (file.optional && !fs.existsSync(file.path)) {
        log(colors.yellow, `  ⚠️  ${file.name}: 文件不存在，跳过`);
        continue;
      }

      const currentVersion = file.read();
      log(colors.blue, `  ${file.name}`);
      log(colors.reset, `    当前版本: ${colors.yellow}${currentVersion}${colors.reset}`);
      log(colors.reset, `    更新到:   ${colors.green}${newVersion}${colors.reset}`);
      console.log();
    } catch (error) {
      log(colors.red, `  ❌ ${file.name}: ${error.message}\n`);
    }
  }

  log(colors.cyan, '📝 Changelog 更新:\n');
  log(colors.reset, `  版本: ${colors.green}${newVersion}${colors.reset}`);
  log(colors.reset, `  类型: ${colors.yellow}${releaseType}${colors.reset}`);
  if (description) {
    log(colors.reset, `  描述: ${description}`);
  } else {
    log(colors.yellow, '  描述: (空 - 将在 Changelog 中创建空 changes)');
  }
  console.log();

  const tagMessage = generateTagMessage(newVersion, releaseType, description, date);

  log(colors.cyan, '📦 Git Tag 消息模板 (用于 GitHub Release):\n');
  log(colors.bold, '────────────────────────────────────────────────');
  log(colors.reset, tagMessage);
  log(colors.bold, '────────────────────────────────────────────────');
  console.log();

  log(colors.cyan, '📝 更新后的后续步骤:\n');
  log(colors.reset, '  1. 检查修改的文件');
  log(colors.reset, '  2. 补充 Changelog.tsx 中的更新内容（如需要）');
  log(colors.reset, `  3. 提交更改: git add . && git commit -m "chore: bump version to ${newVersion}"`);
  log(colors.reset, `  4. 创建 tag: git tag -a v${newVersion} --cleanup=verbatim -F <tag-message-file>`);
  log(colors.reset, `  5. 推送: git push origin main && git push origin v${newVersion}`);
  log(colors.reset, '');

  if (!options.yes) {
    const confirmed = await confirm('\n⚠️  确认要更新以上版本号吗？');
    if (!confirmed) {
      log(colors.yellow, '\n❌ 操作已取消\n');
      return 0;
    }
  }

  log(colors.cyan, '\n🔄 正在更新版本号...\n');

  try {
    updateProjectVersions({
      version: newVersion,
      releaseType,
      description,
      date,
    });
  } catch (error) {
    log(colors.red, `\n❌ 版本号更新失败: ${error.message}\n`);
    return 1;
  }

  log(colors.green, '\n✨ 版本号更新完成！\n');
  log(colors.cyan, '📌 下一步:\n');
  log(colors.reset, '  查看修改: git diff');
  log(colors.reset, `  补充 Changelog 后提交: git add . && git commit -m "chore: bump version to ${newVersion}"\n`);
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runCli().then((exitCode) => {
    process.exit(exitCode);
  }).catch((error) => {
    log(colors.red, `\n❌ 错误: ${error.message}\n`);
    process.exit(1);
  });
}
