// src/services/syncService.ts — 云同步

import { supabase } from './supabase';
import { Task, Tag, Person } from '../store/useTaskStore';
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

/** 同步脏任务到云端（增量 + 逐个确认） */
export async function syncTasksToCloud(userId: string, tasks: Task[]) {
  try {
    const { dirtyTaskIds } = useSyncStore.getState();
    if (dirtyTaskIds.length === 0) return;

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const syncedIds: string[] = [];

    for (const task of tasks) {
      if (!dirtyTaskIds.includes(task.id)) continue;

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
        created_by: task.createdBy,
        assigned_to: task.assignedTo,
      };

      const { error } = await supabase
        .from('tasks')
        .upsert(taskData, { onConflict: 'user_id, task_id' });

      if (error) {
        console.error('同步任务失败，保留脏标记:', task.id, error);
      } else {
        syncedIds.push(task.id);
      }
    }

    // 逐个确认：只移除成功同步的脏标记
    if (syncedIds.length > 0) {
      const remaining = useSyncStore.getState().dirtyTaskIds.filter(
        id => !syncedIds.includes(id)
      );
      useSyncStore.setState({ dirtyTaskIds: remaining });
    }

    // 清理云端已删除超过 7 天的任务
    await purgeExpiredTrash(userId);

    if (syncedIds.length > 0) {
      console.log(`✅ 任务同步完成: 更新 ${syncedIds.length} 个任务`);
    }
  } catch (error) {
    console.error('同步任务到云端失败:', error);
    // 异常时保留所有脏标记
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
    const { dirtyTagIds } = useSyncStore.getState();
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

    const localTagIds = new Set(tags.map(t => t.id));
    const cloudTagIds = new Set(cloudTags?.map(t => t.tag_id) || []);
    const toDelete = dirtyTagIds.filter(id => !localTagIds.has(id) && cloudTagIds.has(id));
    const syncedIds: string[] = [];

    // 2. 删除云端已不存在的脏标签（逐个确认）
    for (const tagId of toDelete) {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('user_id', userId)
        .eq('tag_id', tagId);
      if (error) {
        console.error('删除云端标签失败:', tagId, error);
      } else {
        syncedIds.push(tagId);
      }
    }

    // 3. upsert 脏标签中本地依然存在的（逐个确认）
    for (const tag of tags) {
      if (!dirtyTagIds.includes(tag.id)) continue;

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
      } else {
        syncedIds.push(tag.id);
      }
    }

    // 逐个确认：只移除成功同步的脏标记
    if (syncedIds.length > 0) {
      const remaining = useSyncStore.getState().dirtyTagIds.filter(
        id => !syncedIds.includes(id)
      );
      useSyncStore.setState({ dirtyTagIds: remaining });
    }

    if (syncedIds.length > 0) {
      console.log(`✅ 标签同步完成: 更新/删除 ${syncedIds.length} 个`);
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

// ========== 人员同步 ==========

function dbPersonToApp(item: any): Person {
  return {
    id: item.id,
    name: item.name,
    nickname: item.nickname,
    email: item.email,
    parentId: item.parent_id,
    level: item.level,
    order: item.order,
    autoCreated: item.auto_created,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export async function syncPeopleToCloud(userId: string, people: Person[]) {
  try {
    const { dirtyPersonIds } = useSyncStore.getState();
    if (dirtyPersonIds.length === 0) return;

    const { data: cloudPeople, error: fetchError } = await supabase
      .from('people')
      .select('id')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('获取云端人员失败:', fetchError);
      return;
    }

    const localPersonIds = new Set(people.map(p => p.id));
    const cloudPersonIds = new Set(cloudPeople?.map(p => p.id) || []);
    const toDelete = dirtyPersonIds.filter(id => !localPersonIds.has(id) && cloudPersonIds.has(id));
    const syncedIds: string[] = [];

    for (const personId of toDelete) {
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('user_id', userId)
        .eq('id', personId);
      if (error) {
        console.error('删除云端人员失败:', personId, error);
      } else {
        syncedIds.push(personId);
      }
    }

    for (const person of people) {
      if (!dirtyPersonIds.includes(person.id)) continue;

      const personData = {
        user_id: userId,
        id: person.id,
        name: person.name,
        nickname: person.nickname,
        email: person.email,
        parent_id: person.parentId,
        level: person.level,
        order: person.order,
        auto_created: person.autoCreated,
        created_at: person.createdAt,
        updated_at: person.updatedAt,
      };

      const { error } = await supabase
        .from('people')
        .upsert(personData, { onConflict: 'user_id, id' });

      if (error) {
        console.error('同步人员失败:', person.id, error);
      } else {
        syncedIds.push(person.id);
      }
    }

    if (syncedIds.length > 0) {
      const remaining = useSyncStore.getState().dirtyPersonIds.filter(
        id => !syncedIds.includes(id)
      );
      useSyncStore.setState({ dirtyPersonIds: remaining });
    }

    if (syncedIds.length > 0) {
      console.log(`✅ 人员同步完成: 更新/删除 ${syncedIds.length} 个`);
    }
  } catch (error) {
    console.error('同步人员到云端失败:', error);
  }
}

/** 从云端加载人员 */
export async function loadPeopleFromCloud(userId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map(dbPersonToApp);
}

