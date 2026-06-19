import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown, ChevronUp, Loader2, X} from 'lucide-react';
import {PlanApprovalRequest} from '../../types/permission';
import {
    type DialogSubmissionRef,
    isEditableShortcutTarget,
    isEnterShortcutControl,
    markDialogSubmitted,
} from '../../utils/dialogShortcuts';

type PlanApprovalShortcutAction = 'approve' | 'cancel' | null;

interface PlanApprovalDialogProps {
    request: PlanApprovalRequest;
    onApprove: (approved: boolean, targetMode: string) => void;
    onCancel: () => void;
}

export function resolvePlanApprovalShortcutAction(
    key: string,
    target: EventTarget | null,
): PlanApprovalShortcutAction {
    if (key === 'Escape') {
        return isEditableShortcutTarget(target) ? null : 'cancel';
    }
    if (key === 'Enter') {
        return isEnterShortcutControl(target) ? null : 'approve';
    }
    return null;
}

export function submitPlanApprovalDecision(
    submittedRef: DialogSubmissionRef,
    onFirstSubmit: () => void,
    onDecision: (approved: boolean, targetMode: string) => void,
    approved: boolean,
    targetMode: string,
): boolean {
    if (!markDialogSubmitted(submittedRef, onFirstSubmit)) return false;
    onDecision(approved, targetMode);
    return true;
}

export default function PlanApprovalDialog({
    request,
    onApprove,
    onCancel,
}: PlanApprovalDialogProps) {
    const [planExpanded, setPlanExpanded] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const submittedRef = useRef(false);

    useEffect(() => {
        submittedRef.current = false;
        setSubmitted(false);
        setPlanExpanded(true);
    }, [request]);

    const markSubmitted = useCallback(
        () => markDialogSubmitted(submittedRef, () => setSubmitted(true)),
        [],
    );

    const markSubmittedBusy = useCallback(() => {
        setSubmitted(true);
    }, []);

    const handleDeny = useCallback(() => {
        submitPlanApprovalDecision(submittedRef, markSubmittedBusy, onApprove, false, 'default');
    }, [markSubmittedBusy, onApprove]);

    const handleApprove = useCallback(() => {
        submitPlanApprovalDecision(submittedRef, markSubmittedBusy, onApprove, true, 'default');
    }, [markSubmittedBusy, onApprove]);

    const handleApproveAuto = useCallback(() => {
        submitPlanApprovalDecision(submittedRef, markSubmittedBusy, onApprove, true, 'auto');
    }, [markSubmittedBusy, onApprove]);

    const handleCancel = useCallback(() => {
        if (!markSubmitted()) return;
        onCancel();
    }, [markSubmitted, onCancel]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const action = resolvePlanApprovalShortcutAction(event.key, event.target);
            if (!action) return;
            event.preventDefault();
            if (action === 'approve') {
                handleApprove();
            } else {
                handleDeny();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleApprove, handleDeny]);

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
                onClick={handleCancel}
            >
                <div
                    className="bg-white dark:bg-base-100 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                    aria-busy={submitted}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-base-200">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-base-content">
                            Plan Approval Required
                        </h3>
                        <button
                            onClick={handleCancel}
                            className="btn btn-ghost btn-sm btn-circle"
                            title="取消"
                            disabled={submitted}
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
                        <button
                            onClick={handleDeny}
                            className="btn btn-ghost btn-sm"
                            disabled={submitted}
                        >
                            Deny
                        </button>
                        <button
                            onClick={handleApprove}
                            className="btn btn-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white border-none hover:from-green-600 hover:to-emerald-600"
                            disabled={submitted}
                        >
                            {submitted && <Loader2 className="h-4 w-4 animate-spin" />}
                            Approve
                        </button>
                        <button
                            onClick={handleApproveAuto}
                            className="btn btn-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none hover:from-blue-600 hover:to-purple-600"
                            title="批准并切换到 auto 模式（后续操作自动放行）"
                            disabled={submitted}
                        >
                            {submitted && <Loader2 className="h-4 w-4 animate-spin" />}
                            Approve & Auto
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
}
