import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Loader2, X} from 'lucide-react';
import {AskUserQuestionRequest} from '../../types/permission';
import {isEditableShortcutTarget, markDialogSubmitted} from '../../utils/dialogShortcuts';

type AskUserQuestionShortcutAction = 'cancel' | null;

interface AskUserQuestionDialogProps {
    request: AskUserQuestionRequest;
    onAnswer: (answers: Record<string, string>) => void;
    onCancel: () => void;
}

export function resolveAskUserQuestionShortcutAction(
    key: string,
    target: EventTarget | null,
): AskUserQuestionShortcutAction {
    if (key === 'Escape') {
        return isEditableShortcutTarget(target) ? null : 'cancel';
    }
    return null;
}

export default function AskUserQuestionDialog({
    request,
    onAnswer,
    onCancel,
}: AskUserQuestionDialogProps) {
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);
    const submittedRef = useRef(false);

    useEffect(() => {
        submittedRef.current = false;
        setSubmitted(false);
        setAnswers({});
    }, [request]);

    const markSubmitted = useCallback(
        () => markDialogSubmitted(submittedRef, () => setSubmitted(true)),
        [],
    );

    const handleSubmit = useCallback(() => {
        if (!markSubmitted()) return;
        onAnswer(answers);
    }, [answers, markSubmitted, onAnswer]);

    const handleCancel = useCallback(() => {
        if (!markSubmitted()) return;
        onCancel();
    }, [markSubmitted, onCancel]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const action = resolveAskUserQuestionShortcutAction(event.key, event.target);
            if (!action) return;
            event.preventDefault();
            handleCancel();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCancel]);

    return createPortal(
        <>
            {/* 拖拽条（防止模态层遮挡窗口标题栏） */}
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
                    className="bg-white dark:bg-base-100 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                    aria-busy={submitted}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-base-200">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-base-content">
                            {request.questions[0]?.header || 'Permission Request'}
                        </h3>
                        <button
                            type="button"
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
                        {request.questions.map((q, idx) => (
                            <div key={idx} className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-base-content">
                                    {q.question}
                                </label>

                                {q.multiSelect ? (
                                    // 多选（checkbox）
                                    <div className="space-y-2">
                                        {q.options.map((opt) => (
                                            <label
                                                key={opt.label}
                                                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-base-200 hover:bg-gray-50 dark:hover:bg-base-200 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm mt-0.5"
                                                    disabled={submitted}
                                                    checked={
                                                        answers[q.question]
                                                            ?.split(',')
                                                            .includes(opt.label) || false
                                                    }
                                                    onChange={(e) => {
                                                        const current = answers[q.question]
                                                            ?.split(',')
                                                            .filter(Boolean) || [];
                                                        const next = e.target.checked
                                                            ? [...current, opt.label]
                                                            : current.filter((v) => v !== opt.label);
                                                        setAnswers({
                                                            ...answers,
                                                            [q.question]: next.join(','),
                                                        });
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900 dark:text-base-content">
                                                        {opt.label}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-base-content/70 mt-1">
                                                        {opt.description}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    // 单选（radio）
                                    <div className="space-y-2">
                                        {q.options.map((opt) => (
                                            <label
                                                key={opt.label}
                                                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-base-200 hover:bg-gray-50 dark:hover:bg-base-200 cursor-pointer"
                                            >
                                                <input
                                                    type="radio"
                                                    name={`question-${idx}`}
                                                    className="radio radio-sm mt-0.5"
                                                    disabled={submitted}
                                                    checked={answers[q.question] === opt.label}
                                                    onChange={() =>
                                                        setAnswers({
                                                            ...answers,
                                                            [q.question]: opt.label,
                                                        })
                                                    }
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900 dark:text-base-content">
                                                        {opt.label}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-base-content/70 mt-1">
                                                        {opt.description}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 底部按钮 */}
                    <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-base-200">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="btn btn-ghost btn-sm"
                            disabled={submitted}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="btn btn-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none hover:from-blue-600 hover:to-purple-600 disabled:opacity-70"
                            disabled={submitted}
                        >
                            {submitted && <Loader2 className="h-4 w-4 animate-spin" />}
                            {submitted ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
}
