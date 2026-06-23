// src/services/syncService.ts — 云同步

import { supabase } from './supabase';
import { Task, Tag } from '../store/useTaskStore';
import { useSyncStore } from '../store/useSyncStore';

export const TRASH_RETENTION_DAYS = 7;

// ========== 共享 DB→APP 映射器 ==========

export function dbTaskToApp(item: any): Task {
  return {
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
    createdBy: item.created_by,
    assignedTo: item.assigned_to,
  };
}

export function dbTagToApp(item: any): Tag {
  return {
    id: item.tag_id,
    name: item.name,
    parentId: item.parent_id,
    colorType: item.color_type,
    emoji: item.emoji,
    color: item.color,
    level: item.level,
    order: item.order,
  };
}

// ========== 7 天清理（仅在 loadUserData 时执行一次） ==========

export async function purgeExpiredTrash(userId: string): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);

  try {
    const { error, count } = await supabase
      .from('tasks')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('deleted', true)
      .lt('deleted_at', cutoff.toISOString());

    if (error) {
      console.error('清理过期回收站任务失败:', error);
      return;
    }

    if (count && count > 0) {
      console.log(`🗑️ 清理 ${count} 个超过 ${TRASH_RETENTION_DAYS} 天的已删除任务`);
    }
  } catch (err) {
    console.warn('清理过期任务跳过:', err);
  }
}

// ========== 任务同步（增量） ==========

/** 同步脏任务到云端（只同步有变更的任务） */
export async function syncTasksToCloud(userId: string, tasks: Task[]) {
  try {
    const { dirtyTaskIds, clearDirtyTasks } = useSyncStore.getState();

    // 没有脏任务 + 无 7 天到期任务需清理 → 跳过
    if (dirtyTaskIds.length === 0) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    // 提取实际需要 upsert 的脏任务（过滤掉被永久删除的 ID）
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const toUpsert = dirtyTaskIds
      .map(id => taskMap.get(id))
      .filter((t): t is Task =>
        !!t && !(t.deleted && t.deletedAt && t.deletedAt < cutoffISO)
      );

    for (const task of toUpsert) {
      const taskData = {
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
        created_by: task.createdBy,
        assigned_to: task.assignedTo,
      };

      const { error } = await supabase
        .from('tasks')
        .upsert(taskData, { onConflict: 'user_id, task_id' });

      if (error) {
        console.error('同步任务失败:', task.id, error);
      }
    }

    // 清理云端已删除超过 7 天的任务
    await purgeExpiredTrash(userId);

    // 清除脏标记
    clearDirtyTasks();

    if (toUpsert.length > 0) {
      console.log(`✅ 任务同步完成: 更新 ${toUpsert.length} 个任务`);
    }
  } catch (error) {
    console.error('同步任务到云端失败:', error);
  }
}

// ========== 任务加载 ==========

/** 从云端加载当前活跃任务（不含已删除） */
export async function loadActiveTasksFromCloud(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('deleted', false);

  if (error) throw error;

  return (data || []).map(dbTaskToApp);
}

/** 从云端加载回收站任务（7 天内删除的） */
export async function loadTrashFromCloud(userId: string): Promise<Task[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('deleted', true)
    .gte('deleted_at', cutoff.toISOString())
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('加载回收站任务失败:', error);
    return [];
  }

  return (data || []).map(dbTaskToApp);
}

// 保留旧函数名兼容
export const loadTasksFromCloud = loadActiveTasksFromCloud;

// ========== 标签同步 ==========

export async function syncTagsToCloud(userId: string, tags: Tag[]) {
  try {
    const { dirtyTagIds, clearDirtyTags } = useSyncStore.getState();
    if (dirtyTagIds.length === 0) return;

    // 1. 获取云端该用户的所有标签（仅用于判断需删除的）
    const { data: cloudTags, error: fetchError } = await supabase
      .from('tags')
      .select('tag_id')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('获取云端标签失败:', fetchError);
      return;
    }

    // 2. 找出需要删除的标签：被标记 dirty 但本地已不存在的标签
    const localTagIds = new Set(tags.map(t => t.id));
    const cloudTagIds = new Set(cloudTags?.map(t => t.tag_id) || []);
    const toDelete = dirtyTagIds.filter(id => !localTagIds.has(id) && cloudTagIds.has(id));

    for (const tagId of toDelete) {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('user_id', userId)
        .eq('tag_id', tagId);
      if (error) {
        console.error('删除云端标签失败:', tagId, error);
      } else {
        console.log(`🗑️ 删除云端标签: ${tagId}`);
      }
    }

    // 3. 只 upsert 脏标签中本地依然存在的
    const toUpsert = tags.filter(t => dirtyTagIds.includes(t.id));

    for (const tag of toUpsert) {
      const tagData = {
        user_id: userId,
        tag_id: tag.id,
        name: tag.name,
        parent_id: tag.parentId,
        color_type: tag.colorType,
        emoji: tag.emoji,
        color: tag.color,
        level: tag.level,
        order: tag.order,
      };

      const { error } = await supabase
        .from('tags')
        .upsert(tagData, { onConflict: 'user_id, tag_id' });

      if (error) {
        console.error('同步标签失败:', tag.id, error);
      }
    }

    clearDirtyTags();

    if (toUpsert.length > 0 || toDelete.length > 0) {
      console.log(`✅ 标签同步完成: 更新 ${toUpsert.length} 个, 删除 ${toDelete.length} 个`);
    }
  } catch (error) {
    console.error('同步标签到云端失败:', error);
  }
}

/** 从云端加载标签 */
export async function loadTagsFromCloud(userId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map(dbTagToApp);
}
