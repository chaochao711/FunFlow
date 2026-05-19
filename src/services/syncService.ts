// src/services/syncService.ts
import { supabase } from './supabase';
import { useTaskStore, Task, Tag } from '../store/useTaskStore';

// 同步任务到云端
export async function syncTasksToCloud(userId: string, tasks: Task[]) {
  const tasksData = tasks.map(task => ({
    user_id: userId,
    task_id: task.id,
    title: task.title,
    description: task.description,
    due_date: task.dueDate,
    priority: task.priority,
    status: task.status,
    tags: task.tags,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt,
    archived: task.archived,
    archived_at: task.archivedAt,
    deleted: task.deleted,
    deleted_at: task.deletedAt,
    history: task.history,
  }));

  // 使用 upsert 避免重复
  for (const taskData of tasksData) {
    await supabase
      .from('tasks')
      .upsert(taskData, { onConflict: 'user_id, task_id' });
  }
}

// 从云端加载任务
export async function loadTasksFromCloud(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return data.map(item => ({
    id: item.task_id,
    title: item.title,
    description: item.description,
    dueDate: item.due_date,
    priority: item.priority,
    status: item.status,
    tags: item.tags || [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    completedAt: item.completed_at,
    archived: item.archived,
    archivedAt: item.archived_at,
    deleted: item.deleted,
    deletedAt: item.deleted_at,
    history: item.history || [],
  }));
}

// 同步标签到云端
export async function syncTagsToCloud(userId: string, tags: Tag[]) {
  const tagsData = tags.map(tag => ({
    user_id: userId,
    tag_id: tag.id,
    name: tag.name,
    parent_id: tag.parentId,
    color_type: tag.colorType,
    emoji: tag.emoji,
    color: tag.color,
    level: tag.level,
    order: tag.order,
  }));

  for (const tagData of tagsData) {
    await supabase
      .from('tags')
      .upsert(tagData, { onConflict: 'user_id, tag_id' });
  }
}

// 从云端加载标签
export async function loadTagsFromCloud(userId: string) {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return data.map(item => ({
    id: item.tag_id,
    name: item.name,
    parentId: item.parent_id,
    colorType: item.color_type,
    emoji: item.emoji,
    color: item.color,
    level: item.level,
    order: item.order,
  }));
}