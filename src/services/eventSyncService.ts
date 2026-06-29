// src/services/eventSyncService.ts — 事件云同步（硬删除）

import { supabase } from './supabase';
import { TaskEvent } from '../store/useEventStore';
import { useSyncStore } from '../store/useSyncStore';

// ========== 共享 DB→APP 映射器 ==========

export function dbEventToApp(item: any): TaskEvent {
  const ev: TaskEvent = {
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
    metadata: item.metadata ?? undefined,
  };
  return ev;
}

// ========== 同步（增量 + 逐个确认） ==========

export async function syncEventsToCloud(userId: string, events: TaskEvent[]) {
  try {
    const { dirtyEventIds } = useSyncStore.getState();
    if (dirtyEventIds.length === 0) return;

    const localEventIds = new Set(events.map(e => e.id));
    const syncedIds: string[] = [];

    // 1. 本地硬删除的事件 → 从云端 DELETE
    const toDelete = dirtyEventIds.filter(id => !localEventIds.has(id));
    for (const eventId of toDelete) {
      const { error } = await supabase
        .from('task_events')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', eventId);

      if (error) {
        console.warn('同步删除事件失败，保留脏标记:', eventId, error);
      } else {
        syncedIds.push(eventId);
      }
    }

    // 2. 本地存在的事件 → upsert
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

    if (syncedIds.length > 0) {
      console.log(`✅ 事件同步完成: 删除 ${toDelete.filter(id => syncedIds.includes(id)).length} 个，更新 ${events.filter(e => syncedIds.includes(e.id)).length} 个`);
    }
  } catch (error) {
    console.warn('事件同步跳过:', error);
    // 异常时保留所有脏标记
  }
}

// ========== 加载（过滤掉云端残留的已删除事件） ==========

export async function loadEventsFromCloud(userId: string): Promise<TaskEvent[]> {
  const { data, error } = await supabase
    .from('task_events')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || [])
    .filter((item: any) => !item.deleted) // 兼容旧版软删除残留数据
    .map(dbEventToApp);
}
