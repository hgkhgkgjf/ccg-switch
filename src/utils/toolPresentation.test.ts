import {describe, expect, it} from 'vitest';
import type {ToolResultBlock, ToolUseBlock} from '../types/chat';
import {getToolType} from '../types/tools';
import {collectEditToolItems} from './toolPresentation';

const completedResult: ToolResultBlock = {
    type: 'tool_result',
    tool_use_id: 'tool-1',
    content: 'ok',
};

describe('tool presentation', () => {
    it('classifies Claude MultiEdit as an edit tool', () => {
        expect(getToolType('MultiEdit')).toBe('edit');
    });

    it('expands a multi-edit input into visible edit list rows', () => {
        const block: ToolUseBlock = {
            type: 'tool_use',
            id: 'tool-1',
            name: 'MultiEdit',
            input: {
                file_path: 'src/AreaInfosDAO.java',
                edits: [
                    {old_string: 'dead code', new_string: ''},
                    {oldString: 'line one\nline two\nline three', newString: ''},
                ],
            },
        };

        const items = collectEditToolItems([block], () => completedResult);

        expect(items).toHaveLength(2);
        expect(items.map((item) => item.displayPath)).toEqual([
            'src/AreaInfosDAO.java',
            'src/AreaInfosDAO.java',
        ]);
        expect(items.map((item) => item.deletions)).toEqual([1, 3]);
        expect(items.map((item) => item.toolId)).toEqual(['tool-1', 'tool-1']);
        expect(items.every((item) => item.isCompleted)).toBe(true);
    });

    it('extracts individual file rows from apply_patch input', () => {
        const block: ToolUseBlock = {
            type: 'tool_use',
            id: 'tool-1',
            name: 'apply_patch',
            input: {
                patch: [
                    '*** Begin Patch',
                    '*** Update File: src/AreaInfosDAO.java',
                    '@@ -1,2 +1,1 @@',
                    ' keep',
                    '-remove',
                    '*** Update File: src/OtherDAO.java',
                    '@@ -5,1 +5,2 @@',
                    ' keep',
                    '+add',
                    '*** End Patch',
                ].join('\n'),
            },
        };

        const items = collectEditToolItems([block], () => completedResult);

        expect(items).toHaveLength(2);
        expect(items.map((item) => item.displayPath)).toEqual([
            'src/AreaInfosDAO.java',
            'src/OtherDAO.java',
        ]);
        expect(items.map((item) => ({additions: item.additions, deletions: item.deletions}))).toEqual([
            {additions: 0, deletions: 1},
            {additions: 1, deletions: 0},
        ]);
    });
});
