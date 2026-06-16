import type { ToolStatus } from '../../types/toolblock';

interface StatusIndicatorProps {
    status: ToolStatus;
}

/**
 * 工具状态指示器 - 显示小圆点表示工具调用状态
 */
export default function StatusIndicator({ status }: StatusIndicatorProps) {
    return (
        <div
            className={`
                w-2 h-2 rounded-full
                ${status === 'pending' ? 'bg-warning animate-pulse' : ''}
                ${status === 'completed' ? 'bg-success' : ''}
                ${status === 'error' ? 'bg-error' : ''}
            `}
        />
    );
}
