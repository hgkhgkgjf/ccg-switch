import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AskUserQuestionRequest } from '../../types/permission';

interface AskUserQuestionDialogProps {
    request: AskUserQuestionRequest;
    onAnswer: (answers: Record<string, string>) => void;
    onCancel: () => void;
}

export default function AskUserQuestionDialog({
    request,
    onAnswer,
    onCancel,
}: AskUserQuestionDialogProps) {
    const [answers, setAnswers] = useState<Record<string, string>>({});

    const handleSubmit = () => {
        onAnswer(answers);
    };

    const handleCancel = () => {
        // 取消 = 提交空答案（daemon 会视为拒绝）
        onAnswer({});
        onCancel();
    };

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
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-base-200">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-base-content">
                            {request.questions[0]?.header || 'Permission Request'}
                        </h3>
                        <button
                            onClick={handleCancel}
                            className="btn btn-ghost btn-sm btn-circle"
                            title="取消"
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
                        <button onClick={handleCancel} className="btn btn-ghost btn-sm">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="btn btn-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none hover:from-blue-600 hover:to-purple-600"
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
}
