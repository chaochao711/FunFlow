// src/services/syncService.ts

import { supabase } from './supabase';
import { Task, Tag } from '../store/useTaskStore';

// 同步任务到云端（支持删除）
export async function syncTasksToCloud(userId: string, tasks: Task[]) {
  try {
    // 1. 获取云端该用户的所有任务ID
    const { data: cloudTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('task_id')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('获取云端任务失败:', fetchError);
      return;
    }

    const cloudTaskIds = cloudTasks?.map(t => t.task_id) || [];
    const localTaskIds = tasks.map(t => t.id);

    // 2. 找出需要删除的任务（云端存在但本地不存在）
    const toDelete = cloudTaskIds.filter(id => !localTaskIds.includes(id));

    // 3. 删除云端多余的任务
    for (const taskId of toDelete) {
      await supabase
        .from('tasks')
        .delete()
        .eq('user_id', userId)
        .eq('task_id', taskId);
      console.log(`🗑️ 删除云端任务: ${taskId}`);
    }

    // 4. 插入或更新当前任务
    for (const task of tasks) {
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

      const { error: upsertError } = await supabase
        .from('tasks')
        .upsert(taskData, { onConflict: 'user_id, task_id' });

      if (upsertError) {
        console.error('同步任务失败:', task.id, upsertError);
      }
    }

    console.log(`✅ 同步完成: 更新 ${tasks.length} 个任务, 删除 ${toDelete.length} 个任务`);
  } catch (error) {
    console.error('同步任务到云端失败:', error);
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
    createdBy: item.created_by,
    assignedTo: item.assigned_to,
  }));
}

// 同步标签到云端（支持删除）
export async function syncTagsToCloud(userId: string, tags: Tag[]) {
  try {
    // 1. 获取云端该用户的所有标签ID
    const { data: cloudTags, error: fetchError } = await supabase
      .from('tags')
      .select('tag_id')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('获取云端标签失败:', fetchError);
      return;
    }

    const cloudTagIds = cloudTags?.map(t => t.tag_id) || [];
    const localTagIds = tags.map(t => t.id);

    // 2. 找出需要删除的标签（云端存在但本地不存在）
    const toDelete = cloudTagIds.filter(id => !localTagIds.includes(id));

    // 3. 删除云端多余的标签
    for (const tagId of toDelete) {
      await supabase
        .from('tags')
        .delete()
        .eq('user_id', userId)
        .eq('tag_id', tagId);
      console.log(`🗑️ 删除云端标签: ${tagId}`);
    }

    // 4. 插入或更新当前标签
    for (const tag of tags) {
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

      const { error: upsertError } = await supabase
        .from('tags')
        .upsert(tagData, { onConflict: 'user_id, tag_id' });

      if (upsertError) {
        console.error('同步标签失败:', tag.id, upsertError);
      }
    }

    console.log(`✅ 标签同步完成: 更新 ${tags.length} 个标签, 删除 ${toDelete.length} 个标签`);
  } catch (error) {
    console.error('同步标签到云端失败:', error);
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