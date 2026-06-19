import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Check, Loader2, ShieldAlert, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {ToolPermissionRequest} from '../../types/permission';
import {
    type DialogSubmissionRef,
    isEditableShortcutTarget,
    isEnterShortcutControl,
    markDialogSubmitted,
} from '../../utils/dialogShortcuts';

interface ToolPermissionDialogProps {
    request: ToolPermissionRequest;
    onAnswer: (allow: boolean) => void;
}

type ToolPermissionShortcutAction = 'allow' | 'deny' | null;

const PRIORITY_INPUT_KEYS = [
    'command',
    'file_path',
    'path',
    'url',
    'pattern',
    'query',
    'description',
    'prompt',
];
const PREVIEW_VALUE_LIMIT = 600;
const RAW_INPUT_LIMIT = 12_000;

function truncateText(value: string, limit: number): string {
    if (value.length <= limit) return value;
    return `${value.slice(0, limit)}...`;
}

function stringifyValue(value: unknown): string {
    if (typeof value === 'string') return truncateText(value, PREVIEW_VALUE_LIMIT);
    if (value === null || value === undefined) return '';
    try {
        return truncateText(JSON.stringify(value), PREVIEW_VALUE_LIMIT);
    } catch {
        return truncateText(String(value), PREVIEW_VALUE_LIMIT);
    }
}

function getInputPreview(inputs: Record<string, unknown>): Array<[string, string]> {
    const entries = Object.entries(inputs);
    const priorityEntries = PRIORITY_INPUT_KEYS
        .filter((key) => key in inputs)
        .map((key) => [key, stringifyValue(inputs[key])] as [string, string]);
    const fallbackEntries = entries
        .filter(([key]) => !PRIORITY_INPUT_KEYS.includes(key))
        .slice(0, Math.max(0, 6 - priorityEntries.length))
        .map(([key, value]) => [key, stringifyValue(value)] as [string, string]);

    return [...priorityEntries, ...fallbackEntries]
        .filter(([, value]) => value.trim().length > 0)
        .slice(0, 6);
}

export function resolveToolPermissionShortcutAction(
    key: string,
    target: EventTarget | null,
): ToolPermissionShortcutAction {
    if (key === 'Escape') {
        return isEditableShortcutTarget(target) ? null : 'deny';
    }
    if (key === 'Enter') {
        return isEnterShortcutControl(target) ? null : 'allow';
    }
    return null;
}

export function submitToolPermissionDecision(
    submittedRef: DialogSubmissionRef,
    onFirstSubmit: () => void,
    onDecision: (allow: boolean) => void,
    allow: boolean,
): boolean {
    if (!markDialogSubmitted(submittedRef, onFirstSubmit)) return false;
    onDecision(allow);
    return true;
}

export default function ToolPermissionDialog({
    request,
    onAnswer,
}: ToolPermissionDialogProps) {
    const {t} = useTranslation();
    const [submitted, setSubmitted] = useState(false);
    const submittedRef = useRef(false);
    const inputPreview = useMemo(() => getInputPreview(request.inputs), [request.inputs]);
    const rawInput = useMemo(() => truncateText(JSON.stringify(request.inputs, null, 2), RAW_INPUT_LIMIT), [request.inputs]);

    useEffect(() => {
        submittedRef.current = false;
        setSubmitted(false);
    }, [request]);

    const markSubmittedBusy = useCallback(() => {
        setSubmitted(true);
    }, []);

    const handleDeny = useCallback(() => {
        submitToolPermissionDecision(submittedRef, markSubmittedBusy, onAnswer, false);
    }, [markSubmittedBusy, onAnswer]);
    const handleAllow = useCallback(() => {
        submitToolPermissionDecision(submittedRef, markSubmittedBusy, onAnswer, true);
    }, [markSubmittedBusy, onAnswer]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const action = resolveToolPermissionShortcutAction(event.key, event.target);
            if (!action) return;
            event.preventDefault();
            if (action === 'allow') {
                handleAllow();
            } else {
                handleDeny();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleAllow, handleDeny]);

    return createPortal(
        <>
            <div
                className="fixed top-0 left-0 right-0 h-8 z-[9998]"
                data-tauri-drag-region
            />

            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-6"
                onClick={handleDeny}
            >
                <div
                    className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-2xl"
                    aria-busy={submitted}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-base-content">
                                    {t('chat.permission.toolTitle')}
                                </h3>
                                <p className="truncate text-xs text-base-content/60">
                                    {request.toolName}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-circle"
                            title={t('chat.permission.deny')}
                            aria-label={t('chat.permission.deny')}
                            onClick={handleDeny}
                            disabled={submitted}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-base-content">
                                {t('chat.permission.toolDescription', {tool: request.toolName})}
                            </div>

                            {inputPreview.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-medium uppercase tracking-wide text-base-content/45">
                                        {t('chat.permission.parameters')}
                                    </div>
                                    <div className="space-y-1.5">
                                        {inputPreview.map(([key, value]) => (
                                            <div
                                                key={key}
                                                className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 rounded-md bg-base-200/70 px-3 py-2 text-xs"
                                            >
                                                <span className="truncate font-medium text-base-content/60">
                                                    {key}
                                                </span>
                                                <span className="min-w-0 break-words font-mono text-base-content/80">
                                                    {value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <details className="rounded-lg border border-base-300 bg-base-200/40">
                                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-base-content/70">
                                    {t('chat.permission.rawInput')}
                                </summary>
                                <pre className="max-h-64 overflow-auto border-t border-base-300 p-3 text-xs leading-relaxed text-base-content/75">
                                    {rawInput}
                                </pre>
                            </details>

                            <div className="truncate text-xs text-base-content/50" title={request.cwd}>
                                <span className="font-medium">{t('chat.permission.cwd')}</span>
                                {' '}
                                {request.cwd}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-base-300 px-4 py-3">
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={handleDeny}
                            disabled={submitted}
                        >
                            <X className="h-4 w-4" />
                            {t('chat.permission.deny')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={handleAllow}
                            disabled={submitted}
                        >
                            {submitted ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4" />
                            )}
                            {t('chat.permission.allowOnce')}
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
}
