// src/services/eventSyncService.ts — 事件云同步（增量）

import { supabase } from './supabase';
import { TaskEvent } from '../store/useEventStore';
import { useSyncStore } from '../store/useSyncStore';

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
    updatedAt: item.updated_at ?? undefined,
    order: item.order ?? 0,
  };
}

// ========== 同步 ==========

export async function syncEventsToCloud(userId: string, events: TaskEvent[]) {
  try {
    const { dirtyEventIds, clearDirtyEvents } = useSyncStore.getState();
    if (dirtyEventIds.length === 0) return;

    const eventMap = new Map(events.map(e => [e.id, e]));

    // 1. 找出需要从云端删除的事件（被标记 dirty 但本地已不存在的）
    const toDelete = dirtyEventIds.filter(id => !eventMap.has(id));

    for (const eventId of toDelete) {
      const { error } = await supabase
        .from('task_events')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', eventId);
      if (error) console.warn('删除云端事件失败:', eventId, error);
    }

    // 2. 只 upsert 脏事件中本地依然存在的
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
        updated_at: event.updatedAt ?? null,
      };

      const { error } = await supabase
        .from('task_events')
        .upsert(eventData, { onConflict: 'user_id, event_id' });

      if (error) console.warn('同步事件失败:', event.id, error);
    }

    clearDirtyEvents();

    if (dirtyEventIds.length > 0) {
      console.log(`✅ 事件同步完成: 更新 ${events.filter(e => dirtyEventIds.includes(e.id)).length} 个, 删除 ${toDelete.length} 个`);
    }
  } catch (error) {
    console.warn('事件同步跳过:', error);
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
