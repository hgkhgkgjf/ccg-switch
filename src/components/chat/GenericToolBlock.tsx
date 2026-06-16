import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Eye, Edit, Terminal, Search, Folder, Wrench,
    ChevronDown
} from 'lucide-react';
import type { GenericToolBlockProps, ToolStatus } from '../../types/toolblock';
import StatusIndicator from './StatusIndicator';

/**
 * 通用工具块组件 - 可视化工具调用（tool_use）
 * 支持所有工具类型的基础展示：名称、参数摘要、状态、详细参数
 */
export default function GenericToolBlock({ name, input, result }: GenericToolBlockProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    // 计算工具状态
    const status: ToolStatus = useMemo(() => {
        if (!result) return 'pending';
        if (result.is_error) return 'error';
        return 'completed';
    }, [result]);

    // 工具名称映射
    const displayName = useMemo(() => {
        const lowerName = name.toLowerCase();
        const nameMap: Record<string, string> = {
            'read': t('tools.readFile', 'Read File'),
            'read_file': t('tools.readFile', 'Read File'),
            'edit': t('tools.editFile', 'Edit File'),
            'edit_file': t('tools.editFile', 'Edit File'),
            'write': t('tools.writeFile', 'Write File'),
            'write_to_file': t('tools.writeFile', 'Write File'),
            'bash': t('tools.runCommand', 'Run Command'),
            'run_terminal_cmd': t('tools.runCommand', 'Run Command'),
            'grep': t('tools.search', 'Search'),
            'glob': t('tools.fileMatch', 'File Match'),
            'search': t('tools.search', 'Search'),
        };

        return nameMap[lowerName] || name;
    }, [name, t]);

    // 工具图标映射
    const Icon = useMemo(() => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('read')) return Eye;
        if (lowerName.includes('edit') || lowerName.includes('write')) return Edit;
        if (lowerName.includes('bash') || lowerName.includes('command')) return Terminal;
        if (lowerName.includes('grep') || lowerName.includes('search')) return Search;
        if (lowerName.includes('glob') || lowerName.includes('folder')) return Folder;
        return Wrench;
    }, [name]);

    // 提取参数摘要
    const summary = useMemo(() => {
        // 优先提取文件路径
        const filePath = input.file_path || input.path || input.target_file || input.notebook_path;
        if (typeof filePath === 'string') {
            const parts = filePath.split(/[/\\]/);
            return parts[parts.length - 1] || filePath;
        }

        // 其次提取命令
        const command = input.command || input.cmd;
        if (typeof command === 'string') {
            return command.length > 50 ? command.substring(0, 50) + '...' : command;
        }

        // 最后提取搜索词
        const searchTerm = input.search_term || input.pattern;
        if (typeof searchTerm === 'string') {
            return searchTerm.length > 50 ? searchTerm.substring(0, 50) + '...' : searchTerm;
        }

        return null;
    }, [input]);

    // 过滤已在摘要中显示的参数
    const otherParams = useMemo(() => {
        const omitKeys = new Set([
            'file_path', 'path', 'target_file', 'notebook_path',
            'command', 'cmd', 'search_term', 'pattern',
            'description', 'workdir', 'yield_time_ms', 'max_output_tokens'
        ]);

        return Object.entries(input).filter(([key]) => !omitKeys.has(key));
    }, [input]);

    const hasExpandableContent = otherParams.length > 0;

    return (
        <div className="border border-base-300 rounded-lg p-3 my-2 bg-base-100">
            <div
                className={`flex items-center justify-between ${hasExpandableContent ? 'cursor-pointer' : ''}`}
                onClick={() => hasExpandableContent && setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon size={16} className="text-base-content/60 flex-shrink-0" />
                    <span className="font-medium text-sm">{displayName}</span>
                    {summary && (
                        <span className="text-sm text-base-content/60 truncate">
                            {summary}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusIndicator status={status} />
                    {hasExpandableContent && (
                        <ChevronDown
                            size={16}
                            className={`text-base-content/60 transition-transform ${
                                expanded ? 'rotate-180' : ''
                            }`}
                        />
                    )}
                </div>
            </div>

            {expanded && hasExpandableContent && (
                <div className="mt-2 pt-2 border-t border-base-300 space-y-1">
                    {otherParams.map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm">
                            <span className="text-base-content/60 flex-shrink-0">{key}:</span>
                            <span className="font-mono text-xs break-all">
                                {typeof value === 'string'
                                    ? value
                                    : JSON.stringify(value)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
