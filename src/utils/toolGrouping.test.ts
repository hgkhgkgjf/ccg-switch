import {describe, expect, it} from 'vitest';
import type {ContentBlock} from '../types/chat';
import {
    formatToolExecutionStatusSummary,
    getToolGroupBulkActionState,
    getToolGroupExpandedIndices,
    groupToolBlocks,
    isToolBlockToggleActivationKey,
    isToolGroupToggleActivationKey,
    summarizeToolExecutionStatuses,
    summarizeToolResultStatuses,
    toggleToolGroupExpandedIndex,
} from './toolGrouping';

describe('tool grouping', () => {
    it('groups two edit tools so the edited file list is visible', () => {
        const blocks: ContentBlock[] = [
            {
                type: 'tool_use',
                id: 'edit-1',
                name: 'Edit',
                input: {file_path: 'src/AreaInfosDAO.java', old_string: 'one', new_string: ''},
            },
            {
                type: 'tool_use',
                id: 'edit-2',
                name: 'Edit',
                input: {file_path: 'src/OtherDAO.java', old_string: 'two', new_string: ''},
            },
        ];

        expect(groupToolBlocks(blocks)).toMatchObject([
            {
                type: 'group',
                toolType: 'edit',
                blocks,
            },
        ]);
    });

    it('summarizes mixed tool result status counts', () => {
        const blocks = [
            {type: 'tool_use', id: 'tool-1', name: 'Read', input: {}},
            {type: 'tool_use', id: 'tool-2', name: 'Read', input: {}},
            {type: 'tool_use', id: 'tool-3', name: 'Read', input: {}},
        ] as const;
        const results = {
            'tool-1': {is_error: false},
            'tool-3': {is_error: true},
        };

        const summary = summarizeToolResultStatuses(
            blocks,
            (toolId) => results[toolId as keyof typeof results],
        );

        expect(summary).toEqual({
            completedCount: 1,
            errorCount: 1,
            pendingCount: 1,
        });
    });

    it('formats visible execution status summaries with localized labels', () => {
        const summary = summarizeToolExecutionStatuses([
            {isCompleted: true, isError: false},
            {isCompleted: false, isError: false},
            {isCompleted: true, isError: true},
        ]);

        expect(formatToolExecutionStatusSummary(summary, {
            success: 'Success',
            failed: 'Failed',
            pending: 'Pending',
        })).toBe('Success · 1 Failed · 1 Pending');
    });

    it('includes the completed count when more than one tool completed successfully', () => {
        const summary = summarizeToolExecutionStatuses([
            {isCompleted: true, isError: false},
            {isCompleted: true, isError: false},
            {isCompleted: false, isError: false},
            {isCompleted: true, isError: true},
        ]);

        expect(formatToolExecutionStatusSummary(summary, {
            success: 'Success',
            failed: 'Failed',
            pending: 'Pending',
        })).toBe('2 Success · 1 Failed · 1 Pending');
    });

    it('summarizes grouped bulk action availability from expanded rows', () => {
        expect(getToolGroupBulkActionState(3, new Set())).toEqual({
            allItemsExpanded: false,
            noItemsExpanded: true,
        });
        expect(getToolGroupBulkActionState(3, new Set([1]))).toEqual({
            allItemsExpanded: false,
            noItemsExpanded: false,
        });
        expect(getToolGroupBulkActionState(3, new Set([0, 1, 2]))).toEqual({
            allItemsExpanded: true,
            noItemsExpanded: false,
        });
        expect(getToolGroupBulkActionState(3, new Set([0, 1, 2, 99]))).toEqual({
            allItemsExpanded: true,
            noItemsExpanded: false,
        });
    });

    it('creates all valid expanded row indices for grouped tools', () => {
        expect(Array.from(getToolGroupExpandedIndices(3))).toEqual([0, 1, 2]);
        expect(Array.from(getToolGroupExpandedIndices(0))).toEqual([]);
        expect(Array.from(getToolGroupExpandedIndices(-2))).toEqual([]);
    });

    it('toggles one valid grouped row index without mutating the current set', () => {
        const current = new Set([0, 2]);
        const collapsed = toggleToolGroupExpandedIndex(4, current, 2);
        const expanded = toggleToolGroupExpandedIndex(4, collapsed, 1);

        expect(Array.from(current)).toEqual([0, 2]);
        expect(Array.from(collapsed)).toEqual([0]);
        expect(Array.from(expanded)).toEqual([0, 1]);
    });

    it('ignores invalid grouped row toggle indices', () => {
        const current = new Set([1]);

        expect(Array.from(toggleToolGroupExpandedIndex(3, current, -1))).toEqual([1]);
        expect(Array.from(toggleToolGroupExpandedIndex(3, current, 3))).toEqual([1]);
        expect(Array.from(toggleToolGroupExpandedIndex(3, current, 1.5))).toEqual([1]);
    });

    it('recognizes only keyboard activation keys for grouped toggles', () => {
        expect(isToolGroupToggleActivationKey('Enter')).toBe(true);
        expect(isToolGroupToggleActivationKey(' ')).toBe(true);
        expect(isToolGroupToggleActivationKey('Escape')).toBe(false);
        expect(isToolGroupToggleActivationKey('ArrowDown')).toBe(false);
        expect(isToolGroupToggleActivationKey('a')).toBe(false);
    });

    it('recognizes only keyboard activation keys for tool block toggles', () => {
        expect(isToolBlockToggleActivationKey('Enter')).toBe(true);
        expect(isToolBlockToggleActivationKey(' ')).toBe(true);
        expect(isToolBlockToggleActivationKey('Escape')).toBe(false);
        expect(isToolBlockToggleActivationKey('ArrowDown')).toBe(false);
        expect(isToolBlockToggleActivationKey('a')).toBe(false);
    });
});
