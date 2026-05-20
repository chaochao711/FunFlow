// src/services/syncService.ts
import { supabase } from './supabase';
import { Task, Tag } from '../store/useTaskStore';

// ==================== TASKS ====================
export async function syncTasksToCloud(userId: string, tasks: Task[]) {
  if (!userId || !tasks?.length) return;

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

  const { error } = await supabase
    .from('tasks')
    .upsert(tasksData, { onConflict: 'user_id,task_id' });

  if (error) throw error;
}

export async function loadTasksFromCloud(userId: string): Promise<Task[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map(item => ({
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

// ==================== TAGS ====================
export async function syncTagsToCloud(userId: string, tags: Tag[]) {
  if (!userId) return;

  // 1. 获取云端已有标签
  const { data: dbTags } = await supabase
    .from('tags')
    .select('tag_id')
    .eq('user_id', userId);

  const dbIds = new Set(dbTags?.map(t => t.tag_id) || []);
  const currentIds = new Set(tags.map(t => t.id));

  // 2. 删除云端多余的标签（防止脏数据）
  const toDelete = Array.from(dbIds).filter(id => !currentIds.has(id));
  if (toDelete.length > 0) {
    await supabase
      .from('tags')
      .delete()
      .eq('user_id', userId)
      .in('tag_id', toDelete);
  }

  // 3. 批量 upsert 当前标签
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

  const { error } = await supabase
    .from('tags')
    .upsert(tagsData, { onConflict: 'user_id,tag_id' });

  if (error) throw error;
}

export async function loadTagsFromCloud(userId: string): Promise<Tag[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('level', { ascending: true })
    .order('order', { ascending: true });

  if (error) throw error;

  return (data || []).map(item => ({
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