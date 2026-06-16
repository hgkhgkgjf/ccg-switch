import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { PlanApprovalRequest } from '../../types/permission';

interface PlanApprovalDialogProps {
    request: PlanApprovalRequest;
    onApprove: (approved: boolean, targetMode: string) => void;
    onCancel: () => void;
}

export default function PlanApprovalDialog({
    request,
    onApprove,
    onCancel,
}: PlanApprovalDialogProps) {
    const [planExpanded, setPlanExpanded] = useState(true);

    const handleDeny = () => {
        onApprove(false, 'default');
    };

    const handleApprove = () => {
        onApprove(true, 'default');
    };

    const handleApproveAuto = () => {
        onApprove(true, 'auto');
    };

    return createPortal(
        <>
            {/* 拖拽条 */}
            <div
                className="fixed top-0 left-0 right-0 h-8 z-[9998]"
                data-tauri-drag-region
            />

            {/* 背景蒙层 */}
            <div
                className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-6"
                onClick={onCancel}
            >
                <div
                    className="bg-white dark:bg-base-100 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-base-200">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-base-content">
                            Plan Approval Required
                        </h3>
                        <button
                            onClick={onCancel}
                            className="btn btn-ghost btn-sm btn-circle"
                            title="取消"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Plan 预览 */}
                        <div className="space-y-2">
                            <button
                                onClick={() => setPlanExpanded(!planExpanded)}
                                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-base-content hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                {planExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                ) : (
                                    <ChevronDown className="w-4 h-4" />
                                )}
                                Plan ({request.plan.split('\n').length} lines)
                            </button>
                            {planExpanded && (
                                <pre className="bg-gray-50 dark:bg-base-200 p-4 rounded-lg text-xs overflow-auto max-h-96 whitespace-pre-wrap font-mono text-gray-800 dark:text-base-content">
                                    {request.plan}
                                </pre>
                            )}
                        </div>

                        {/* Allowed Prompts */}
                        {request.allowedPrompts.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-gray-700 dark:text-base-content">
                                    Allowed Actions ({request.allowedPrompts.length})
                                </div>
                                <div className="space-y-2">
                                    {request.allowedPrompts.map((p, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-base-200 rounded-lg"
                                        >
                                            <span className="badge badge-sm badge-primary shrink-0">
                                                {p.tool}
                                            </span>
                                            <span className="text-sm text-gray-600 dark:text-base-content/80">
                                                {p.prompt}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 工作目录 */}
                        <div className="text-xs text-gray-500 dark:text-base-content/60">
                            <span className="font-medium">Working directory:</span> {request.cwd}
                        </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-base-200">
                        <button onClick={handleDeny} className="btn btn-ghost btn-sm">
                            Deny
                        </button>
                        <button
                            onClick={handleApprove}
                            className="btn btn-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white border-none hover:from-green-600 hover:to-emerald-600"
                        >
                            Approve
                        </button>
                        <button
                            onClick={handleApproveAuto}
                            className="btn btn-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none hover:from-blue-600 hover:to-purple-600"
                            title="批准并切换到 auto 模式（后续操作自动放行）"
                        >
                            Approve & Auto
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
}
