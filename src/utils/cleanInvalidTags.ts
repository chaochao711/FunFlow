// src/utils/cleanInvalidTags.ts
import { Task } from '../store/useTaskStore';

export function cleanInvalidTaskTags(tasks: Task[], validTagIds: Set<string>): Task[] {
  return tasks.map(task => ({
    ...task,
    tags: (task.tags || []).filter(tagId => 
      typeof tagId === 'string' && validTagIds.has(tagId)
    )
  }));
}