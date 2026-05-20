// src/utils/recoverInvalidTags.ts
import { Task, Tag } from '../store/useTaskStore';

export function recoverInvalidTags(tasks: Task[], existingTags: Tag[]): Tag[] {
  const existingTagIds = new Set(existingTags.map(t => t.id));

  // 收集所有任务中出现的 tagId
  const allUsedTagIds = new Set<string>();
  tasks.forEach(task => {
    (task.tags || []).forEach(tagId => {
      if (typeof tagId === 'string' && tagId.trim() !== '') {
        allUsedTagIds.add(tagId);
      }
    });
  });

  // 找出需要恢复的脏标签
  const missingTagIds = Array.from(allUsedTagIds).filter(id => !existingTagIds.has(id));

  if (missingTagIds.length === 0) {
    return existingTags;
  }

  // 为每个缺失的标签创建一个基础 Tag 对象
  const recoveredTags: Tag[] = missingTagIds.map((id, index) => ({
    id,
    name: id,                    // 默认名称，用户可后续修改
    parentId: null,
    colorType: "emoji",          // ✅ 修复：必须是 "emoji" 或 "color"
    emoji: '📌',                 // 默认表情
    color: '#64748b',
    level: 0,
    order: 9999 + index,         // 排到列表最后
  }));

  console.log(`[Recover] 已从任务中恢复 ${recoveredTags.length} 个脏标签`, recoveredTags);

  return [...existingTags, ...recoveredTags];
}