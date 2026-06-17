import {describe, expect, it} from 'vitest';
import type {ContentBlock} from '../types/chat';
import {groupToolBlocks} from './toolGrouping';

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
});
