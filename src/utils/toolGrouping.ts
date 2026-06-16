import type { ContentBlock, ToolUseBlock } from '../types/chat';
import { getToolType } from '../types/tools';
import type { ToolType } from '../types/tools';

/** 分组后的块类型 */
export type GroupedBlock =
  | { type: 'single'; block: ContentBlock; originalIndex: number }
  | { type: 'group'; toolType: ToolType; blocks: ToolUseBlock[]; startIndex: number };

/**
 * 将消息内容块按连续同类型工具分组
 * 规则：3+ 个连续同类型工具合并为 GroupBlock
 *
 * @param blocks 原始内容块数组
 * @returns 分组后的块数组
 */
export function groupToolBlocks(blocks: ContentBlock[]): GroupedBlock[] {
  const result: GroupedBlock[] = [];
  let currentGroup: ToolUseBlock[] = [];
  let currentStartIndex = -1;
  let currentToolType: ToolType | null = null;

  const submitCurrentGroup = () => {
    if (currentGroup.length >= 3 && currentToolType) {
      // 分组：3+ 个同类型工具
      result.push({
        type: 'group',
        toolType: currentToolType,
        blocks: currentGroup,
        startIndex: currentStartIndex,
      });
    } else {
      // 单独渲染
      currentGroup.forEach((block, idx) => {
        result.push({
          type: 'single',
          block,
          originalIndex: currentStartIndex + idx,
        });
      });
    }
    currentGroup = [];
    currentStartIndex = -1;
    currentToolType = null;
  };

  blocks.forEach((block, index) => {
    if (block.type !== 'tool_use') {
      // 非工具调用：提交当前组，添加当前块
      submitCurrentGroup();
      result.push({
        type: 'single',
        block,
        originalIndex: index,
      });
      return;
    }

    const toolType = getToolType(block.name);

    if (currentToolType === toolType && toolType !== 'generic') {
      // 同类型工具，加入当前组
      currentGroup.push(block);
    } else {
      // 不同类型：提交当前组，开始新组
      submitCurrentGroup();
      currentGroup = [block];
      currentStartIndex = index;
      currentToolType = toolType;
    }
  });

  // 提交最后一组
  submitCurrentGroup();

  return result;
}

/**
 * 计算分组的状态（用于 GroupBlock header）
 * @param blocks 工具块数组
 * @param findToolResult 查找工具结果的函数
 * @returns 总状态：'pending' | 'completed' | 'error'
 */
export function getGroupStatus(
  blocks: ToolUseBlock[],
  findToolResult: (toolId: string) => { is_error?: boolean } | null | undefined,
): 'pending' | 'completed' | 'error' {
  let hasError = false;
  let hasPending = false;

  blocks.forEach((block) => {
    const result = findToolResult(block.id);
    if (!result) {
      hasPending = true;
    } else if (result.is_error) {
      hasError = true;
    }
  });

  if (hasError) return 'error';
  if (hasPending) return 'pending';
  return 'completed';
}
