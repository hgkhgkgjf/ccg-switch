import {createElement, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {AskUserQuestionRequest} from '../../types/permission';
import {
    buildAskUserQuestionAnswerPayload,
    canSubmitAskUserQuestionAnswers,
    countAnsweredAskUserQuestions,
    default as AskUserQuestionDialog,
    getAskUserQuestionDialogLabels,
    getAskUserQuestionSubmitBlockedHint,
    isAskUserQuestionAnswered,
    resolveAskUserQuestionShortcutAction,
} from './AskUserQuestionDialog';

vi.mock('react-dom', async () => {
    const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
    return {
        ...actual,
        createPortal: (node: ReactNode) => node,
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const askUserQuestionRequest: AskUserQuestionRequest = {
    requestId: 'ask-user-1',
    sessionId: 'session-1',
    toolName: 'AskUserQuestion',
    timestamp: '2026-06-20T04:20:00.000Z',
    cwd: 'C:/guodevelop/ccg-switch',
    questions: [
        {
            header: 'Choose files',
            question: 'Which files should be included?',
            multiSelect: false,
            options: [
                {label: 'All files', description: 'Include every touched file.'},
                {label: 'Only source', description: 'Skip generated files.'},
            ],
        },
    ],
};

function stubPortalDocument() {
    vi.stubGlobal('document', {body: {}});
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AskUserQuestionDialog labels', () => {
    it('keeps dialog chrome readable when i18n keys are unavailable', () => {
        const labels = getAskUserQuestionDialogLabels((key) => key, undefined);

        expect(labels.title).toBe('Permission request');
        expect(labels.close).toBe('Close');
        expect(labels.cancel).toBe('Cancel');
        expect(labels.submit).toBe('Submit');
        expect(labels.submitting).toBe('Submitting...');
        expect(labels.shortcutCancel).toBe('Cancel');
        expect(labels.customAnswerLabel).toBe('Other');
        expect(labels.customAnswerPlaceholder).toBe('Type a custom answer...');
        expect(labels.customAnswerHint).toBe('Use this when the available options do not fit.');
        expect(labels.customAnswerRequiredLabel).toBe('Answer');
        expect(labels.customAnswerRequiredHint).toBe('Type an answer to continue.');
        expect(labels.questionRequired).toBe('Required');
        expect(labels.questionAnswered).toBe('Answered');
        expect(labels.invalidQuestionFormat).toBe('Question data is not available. Cancel and try again.');
    });

    it('keeps the submit blocked hint readable when i18n keys are unavailable', () => {
        expect(getAskUserQuestionSubmitBlockedHint((key) => key, 1)).toBe(
            'Answer 1 required question before submitting.',
        );
        expect(getAskUserQuestionSubmitBlockedHint((key) => key, 3)).toBe(
            'Answer 3 required questions before submitting.',
        );
    });

    it('uses the request header as the title before falling back to translation text', () => {
        const labels = getAskUserQuestionDialogLabels((key) => key, 'Choose files');

        expect(labels.title).toBe('Choose files');
    });

    it('preserves translated dialog chrome when available', () => {
        const labels = getAskUserQuestionDialogLabels((key) => {
            if (key === 'chat.askUser.title') return '权限请求';
            if (key === 'common.close') return '关闭';
            if (key === 'common.cancel') return '取消';
            if (key === 'chat.askUser.submit') return '提交';
            if (key === 'chat.askUser.submitting') return '提交中...';
            if (key === 'chat.askUser.shortcutCancel') return '取消';
            if (key === 'chat.askUser.customAnswerLabel') return '其他';
            if (key === 'chat.askUser.customAnswerPlaceholder') return '输入自定义答案...';
            if (key === 'chat.askUser.customAnswerHint') return '当现有选项不合适时使用。';
            if (key === 'chat.askUser.customAnswerRequiredLabel') return '回答';
            if (key === 'chat.askUser.customAnswerRequiredHint') return '输入答案后继续。';
            if (key === 'chat.askUser.questionRequired') return '必答';
            if (key === 'chat.askUser.questionAnswered') return '已回答';
            if (key === 'chat.askUser.invalidQuestionFormat') return '问题数据不可用，请取消后重试。';
            return key;
        }, undefined);

        expect(labels.title).toBe('权限请求');
        expect(labels.close).toBe('关闭');
        expect(labels.cancel).toBe('取消');
        expect(labels.submit).toBe('提交');
        expect(labels.submitting).toBe('提交中...');
        expect(labels.shortcutCancel).toBe('取消');
        expect(labels.customAnswerLabel).toBe('其他');
        expect(labels.customAnswerPlaceholder).toBe('输入自定义答案...');
        expect(labels.customAnswerHint).toBe('当现有选项不合适时使用。');
        expect(labels.customAnswerRequiredLabel).toBe('回答');
        expect(labels.customAnswerRequiredHint).toBe('输入答案后继续。');
        expect(labels.questionRequired).toBe('必答');
        expect(labels.questionAnswered).toBe('已回答');
        expect(labels.invalidQuestionFormat).toBe('问题数据不可用，请取消后重试。');
        expect(getAskUserQuestionSubmitBlockedHint((key, options) => {
            if (key === 'chat.askUser.submitBlockedHint') {
                return `还需回答 ${options?.remaining} 个必答问题才能提交。`;
            }
            return key;
        }, 2)).toBe('还需回答 2 个必答问题才能提交。');
    });
});

describe('AskUserQuestionDialog shortcuts', () => {
    it('maps Escape to cancel and does not use Enter as a global submit', () => {
        expect(resolveAskUserQuestionShortcutAction('Escape', null)).toBe('cancel');
        expect(resolveAskUserQuestionShortcutAction('Enter', null)).toBeNull();
        expect(resolveAskUserQuestionShortcutAction('Tab', null)).toBeNull();
    });

    it('keeps Escape available on buttons but avoids stealing it from editable controls', () => {
        expect(
            resolveAskUserQuestionShortcutAction('Escape', {tagName: 'BUTTON'} as unknown as EventTarget),
        ).toBe('cancel');
        expect(
            resolveAskUserQuestionShortcutAction('Escape', {tagName: 'INPUT'} as unknown as EventTarget),
        ).toBeNull();
        expect(
            resolveAskUserQuestionShortcutAction('Escape', {
                tagName: 'DIV',
                isContentEditable: true,
            } as unknown as EventTarget),
        ).toBeNull();
    });
});

describe('canSubmitAskUserQuestionAnswers', () => {
    it('requires every question to have a non-empty answer', () => {
        const questions = [
            askUserQuestionRequest.questions[0],
            {
                header: 'Confirm scope',
                question: 'Should generated files be included?',
                multiSelect: false,
                options: [
                    {label: 'No', description: 'Skip generated files.'},
                    {label: 'Yes', description: 'Include generated files.'},
                ],
            },
        ];

        expect(canSubmitAskUserQuestionAnswers([], {})).toBe(false);
        expect(canSubmitAskUserQuestionAnswers(questions, {})).toBe(false);
        expect(canSubmitAskUserQuestionAnswers(questions, {
            'Which files should be included?': 'All files',
        })).toBe(false);
        expect(canSubmitAskUserQuestionAnswers(questions, {
            'Which files should be included?': 'All files',
            'Should generated files be included?': '   ',
        })).toBe(false);
        expect(canSubmitAskUserQuestionAnswers(questions, {
            'Which files should be included?': 'All files',
            'Should generated files be included?': 'No',
        })).toBe(true);
        expect(canSubmitAskUserQuestionAnswers(questions, {}, {
            'Which files should be included?': 'Only files touched in this task',
            'Should generated files be included?': 'No',
        })).toBe(true);
    });

    it('accepts multi-select answers when at least one selected value is present', () => {
        const questions = [{
            header: 'Choose checks',
            question: 'Which checks should run?',
            multiSelect: true,
            options: [
                {label: 'Tests', description: 'Run tests.'},
                {label: 'Build', description: 'Run build.'},
            ],
        }];

        expect(canSubmitAskUserQuestionAnswers(questions, {
            'Which checks should run?': ',',
        })).toBe(false);
        expect(canSubmitAskUserQuestionAnswers(questions, {
            'Which checks should run?': 'Tests,Build',
        })).toBe(true);
    });

    it('allows an optionless question to proceed with a custom answer', () => {
        const questions = [{
            header: 'Clarify',
            question: 'What should happen next?',
            multiSelect: false,
            options: [],
        }];

        expect(canSubmitAskUserQuestionAnswers(questions, {}, {
            'What should happen next?': 'Continue with the focused fix.',
        })).toBe(true);
        expect(canSubmitAskUserQuestionAnswers(questions, {}, {
            'What should happen next?': '   ',
        })).toBe(false);
    });
});

describe('countAnsweredAskUserQuestions', () => {
    it('detects whether a single question is answered using the same payload rules as submit', () => {
        const question = askUserQuestionRequest.questions[0];
        const multiSelectQuestion = {
            header: 'Choose checks',
            question: 'Which checks should run?',
            multiSelect: true,
            options: [
                {label: 'Tests', description: 'Run tests.'},
                {label: 'Build', description: 'Run build.'},
            ],
        };

        expect(isAskUserQuestionAnswered(question, {}, {})).toBe(false);
        expect(isAskUserQuestionAnswered(question, {
            'Which files should be included?': 'Only source',
        }, {})).toBe(true);
        expect(isAskUserQuestionAnswered(question, {}, {
            'Which files should be included?': 'Only files touched in this task',
        })).toBe(true);
        expect(isAskUserQuestionAnswered(multiSelectQuestion, {
            'Which checks should run?': ',',
        }, {})).toBe(false);
        expect(isAskUserQuestionAnswered(multiSelectQuestion, {
            'Which checks should run?': 'Tests,Build',
        }, {})).toBe(true);
    });

    it('counts regular, multi-select, and custom answers without counting blank answers', () => {
        const questions = [
            askUserQuestionRequest.questions[0],
            {
                header: 'Choose checks',
                question: 'Which checks should run?',
                multiSelect: true,
                options: [
                    {label: 'Tests', description: 'Run tests.'},
                    {label: 'Build', description: 'Run build.'},
                ],
            },
            {
                header: 'Clarify',
                question: 'What should happen next?',
                multiSelect: false,
                options: [],
            },
            {
                header: 'Notes',
                question: 'Any extra notes?',
                multiSelect: false,
                options: [],
            },
        ];

        expect(countAnsweredAskUserQuestions(questions, {
            'Which files should be included?': 'Only source',
            'Which checks should run?': 'Tests,Build',
            'Any extra notes?': '   ',
        }, {
            'What should happen next?': 'Continue with the focused fix.',
        })).toBe(3);
    });
});

describe('buildAskUserQuestionAnswerPayload', () => {
    it('keeps a string map payload while preferring custom text for single-select answers', () => {
        const payload = buildAskUserQuestionAnswerPayload(
            askUserQuestionRequest.questions,
            {'Which files should be included?': 'All files'},
            {'Which files should be included?': 'Only files touched in this task'},
        );

        expect(payload).toEqual({
            'Which files should be included?': 'Only files touched in this task',
        });
    });

    it('appends custom text to multi-select answers and supports optionless questions', () => {
        const questions = [
            {
                header: 'Choose checks',
                question: 'Which checks should run?',
                multiSelect: true,
                options: [
                    {label: 'Tests', description: 'Run tests.'},
                    {label: 'Build', description: 'Run build.'},
                ],
            },
            {
                header: 'Clarify',
                question: 'What should happen next?',
                multiSelect: false,
                options: [],
            },
        ];

        const payload = buildAskUserQuestionAnswerPayload(
            questions,
            {'Which checks should run?': 'Tests,Build'},
            {
                'Which checks should run?': 'Manual smoke test',
                'What should happen next?': 'Continue with the focused fix.',
            },
        );

        expect(payload).toEqual({
            'Which checks should run?': 'Tests,Build,Manual smoke test',
            'What should happen next?': 'Continue with the focused fix.',
        });
    });
});

describe('AskUserQuestionDialog modal semantics', () => {
    it('exposes dialog semantics tied to the request title and first question', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: askUserQuestionRequest,
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('role="dialog"');
        expect(html).toContain('aria-modal="true"');
        expect(html).toContain('aria-labelledby="ask-user-question-title"');
        expect(html).toContain('aria-describedby="ask-user-question-description"');
        expect(html).toContain('<h3 id="ask-user-question-title"');
        expect(html).toContain('id="ask-user-question-description"');
    });

    it('renders a visible Escape cancel shortcut hint', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: askUserQuestionRequest,
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('<kbd>Esc</kbd>');
        expect(html).toContain('<span class="hint-label">Cancel</span>');
    });

    it('exposes a shortcut-aware accessible label on the footer cancel action', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: askUserQuestionRequest,
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('title="Cancel (Esc)"');
        expect(html).toContain('aria-label="Cancel (Esc)"');
    });

    it('disables submit until the question has an answer', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: askUserQuestionRequest,
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('disabled="">Submit</button>');
        expect(html).toContain('Answer 1 required question before submitting.');
        expect(html).toContain('title="Submit: Answer 1 required question before submitting."');
        expect(html).toContain('aria-label="Submit: Answer 1 required question before submitting."');
    });

    it('shows a cancel-only invalid format state when no questions are available', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: {
                    ...askUserQuestionRequest,
                    questions: [],
                },
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('Question data is not available. Cancel and try again.');
        expect(html).toContain('title="Cancel (Esc)"');
        expect(html).toContain('aria-label="Cancel (Esc)"');
        expect(html).not.toContain('Answer 0 required questions before submitting.');
        expect(html).not.toContain('>Submit</button>');
    });

    it('renders a custom answer textarea for questions whose options do not fit', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: askUserQuestionRequest,
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('textarea');
        expect(html).toContain('maxLength="2000"');
        expect(html).toContain('Other');
        expect(html).toContain('Type a custom answer...');
        expect(html).toContain('Use this when the available options do not fit.');
    });

    it('labels an optionless prompt as a direct answer instead of an other option', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: {
                    ...askUserQuestionRequest,
                    questions: [{
                        header: 'Clarify',
                        question: 'What should happen next?',
                        multiSelect: false,
                        options: [],
                    }],
                },
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('Answer');
        expect(html).toContain('Type an answer to continue.');
        expect(html).not.toContain('Other');
        expect(html).not.toContain('Use this when the available options do not fit.');
    });

    it('shows question progress and answered count for multi-question requests', () => {
        stubPortalDocument();

        const html = renderToStaticMarkup(
            createElement(AskUserQuestionDialog, {
                request: {
                    ...askUserQuestionRequest,
                    questions: [
                        askUserQuestionRequest.questions[0],
                        {
                            header: 'Confirm scope',
                            question: 'Should generated files be included?',
                            multiSelect: false,
                            options: [
                                {label: 'No', description: 'Skip generated files.'},
                                {label: 'Yes', description: 'Include generated files.'},
                            ],
                        },
                    ],
                },
                onAnswer: () => undefined,
                onCancel: () => undefined,
            }),
        );

        expect(html).toContain('0 / 2 answered');
        expect(html).toContain('Question 1 of 2');
        expect(html).toContain('Question 2 of 2');
        expect(html).toContain('Confirm scope');
        expect(html).toContain('Required');
        expect(html).not.toContain('Answered');
    });
});
