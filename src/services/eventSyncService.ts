// src/services/eventSyncService.ts — 事件云同步（增量 + 软删除）

import { supabase } from './supabase';
import { TaskEvent } from '../store/useEventStore';
import { useSyncStore } from '../store/useSyncStore';

const TRASH_RETENTION_DAYS = 7;

// ========== 共享 DB→APP 映射器 ==========

export function dbEventToApp(item: any): TaskEvent {
  return {
    id: item.event_id,
    taskId: item.task_id,
    type: item.type,
    content: item.content,
    timestamp: item.timestamp,
    createdAt: item.created_at,
    userId: item.user_id,
    completed: item.completed ?? false,
    completedAt: item.completed_at ?? undefined,
    estimatedTime: item.estimated_time ?? undefined,
    updatedAt: item.updated_at ?? item.created_at,
    order: item.event_order ?? 0,
    deleted: item.deleted ?? false,
    deletedAt: item.deleted_at ?? undefined,
    metadata: item.metadata ?? undefined,
  };
}

// ========== 7 天过期清理 ==========

export async function purgeExpiredTrashEvents(userId: string): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);

  try {
    const { error, count } = await supabase
      .from('task_events')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('deleted', true)
      .lt('deleted_at', cutoff.toISOString());

    if (error) {
      console.error('清理过期回收站事件失败:', error);
      return;
    }

    if (count && count > 0) {
      console.log(`🗑️ 清理 ${count} 个超过 ${TRASH_RETENTION_DAYS} 天的已删除事件`);
    }
  } catch (err) {
    console.warn('清理过期事件跳过:', err);
  }
}

// ========== 同步（增量 + 逐个确认） ==========

export async function syncEventsToCloud(userId: string, events: TaskEvent[]) {
  try {
    const { dirtyEventIds } = useSyncStore.getState();
    if (dirtyEventIds.length === 0) return;

    const syncedIds: string[] = [];

    for (const event of events) {
      if (!dirtyEventIds.includes(event.id)) continue;

      const eventData = {
        user_id: userId,
        event_id: event.id,
        task_id: event.taskId,
        type: event.type,
        content: event.content,
        timestamp: event.timestamp,
        created_at: event.createdAt,
        event_order: event.order ?? 0,
        completed: event.completed ?? false,
        completed_at: event.completedAt ?? null,
        estimated_time: event.estimatedTime ?? null,
        updated_at: event.updatedAt,
        deleted: event.deleted ?? false,
        deleted_at: event.deletedAt ?? null,
        metadata: event.metadata ?? null,
      };

      const { error } = await supabase
        .from('task_events')
        .upsert(eventData, { onConflict: 'user_id, event_id' });

      if (error) {
        console.warn('同步事件失败，保留脏标记:', event.id, error);
      } else {
        syncedIds.push(event.id);
      }
    }

    // 逐个确认：只移除成功同步的脏标记
    if (syncedIds.length > 0) {
      const remaining = useSyncStore.getState().dirtyEventIds.filter(
        id => !syncedIds.includes(id)
      );
      useSyncStore.setState({ dirtyEventIds: remaining });
    }

    // 清理云端已删除超过 7 天的事件
    await purgeExpiredTrashEvents(userId);

    if (syncedIds.length > 0) {
      console.log(`✅ 事件同步完成: 更新 ${syncedIds.length} 个`);
    }
  } catch (error) {
    console.warn('事件同步跳过:', error);
    // 异常时保留所有脏标记
  }
}

// ========== 加载 ==========

export async function loadEventsFromCloud(userId: string): Promise<TaskEvent[]> {
  const { data, error } = await supabase
    .from('task_events')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map(dbEventToApp);
}
