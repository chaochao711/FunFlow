// src/utils/recoverInvalidTags.ts
import { Task, Tag } from '../store/useTaskStore';

export function recoverInvalidTags(tasks: Task[], existingTags: Tag[]): Tag[] {
  const existingTagIds = new Set(existingTags.map(t => t.id));

  // 收集任务中所有用到的标签ID
  const allUsedTagIds = new Set<string>();
  
  tasks.forEach(task => {
    (task.tags || []).forEach(tagItem => {
      const tagId = typeof tagItem === 'string' 
        ? tagItem 
        : (tagItem as any)?.id;
      
      if (typeof tagId === 'string' && tagId.trim() !== '') {
        allUsedTagIds.add(tagId);
      }
    });
  });

  const missingTagIds = Array.from(allUsedTagIds).filter(id => !existingTagIds.has(id));

  if (missingTagIds.length === 0) {
    return existingTags;
  }

  // 恢复脏标签（尽量保持和正常标签一致的结构）
  const recoveredTags: Tag[] = missingTagIds.map((id, index) => ({
    id,
    name: id,
    parentId: null,
    colorType: "emoji" as const,
    emoji: '❓',
    color: '#ef4444',
    level: 0,
    order: 9999 + index,
  } as Tag));

  console.log(`[Recover] 已恢复 ${recoveredTags.length} 个脏标签`, recoveredTags);

  return [...existingTags, ...recoveredTags];
}