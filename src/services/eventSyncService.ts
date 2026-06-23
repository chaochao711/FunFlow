// src/services/eventSyncService.ts — 事件云同步

import { supabase } from './supabase';
import { TaskEvent } from '../store/useEventStore';

export async function syncEventsToCloud(userId: string, events: TaskEvent[]) {
  try {
    // 保护：本地事件为空且云端可能有数据时，跳过（避免误删）
    if (!events || events.length === 0) {
      const { data: cloudEvents, error: checkError } = await supabase
        .from('task_events')
        .select('event_id', { count: 'exact', head: true })
        .eq('user_id', userId);

      // 表不存在或云端也为空 → 跳过
      if (checkError || !cloudEvents) return;
      // 云端有数据但本地为空 → 跳过（可能是加载失败，不删除云端数据）
      return;
    }

    const { data: cloudEvents, error: fetchError } = await supabase
      .from('task_events')
      .select('event_id')
      .eq('user_id', userId);

    if (fetchError) {
      console.warn('事件同步跳过（云端获取失败）:', fetchError.message);
      return;
    }

    const cloudEventIds = cloudEvents?.map((e: any) => e.event_id) || [];
    const localEventIds = events.map(e => e.id);
    const toDelete = cloudEventIds.filter((id: string) => !localEventIds.includes(id));

    for (const eventId of toDelete) {
      await supabase
        .from('task_events')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', eventId);
    }

    for (const event of events) {
      const eventData = {
        user_id: userId,
        event_id: event.id,
        task_id: event.taskId,
        type: event.type,
        content: event.content,
        timestamp: event.timestamp,
        created_at: event.createdAt,
        completed: event.completed ?? false,
        completed_at: event.completedAt ?? null,
        estimated_time: event.estimatedTime ?? null,
        updated_at: event.updatedAt ?? null,
      };

      await supabase
        .from('task_events')
        .upsert(eventData, { onConflict: 'user_id, event_id' });
    }

    console.log(`✅ 事件同步完成: ${events.length} 个事件`);
  } catch (error) {
    console.warn('事件同步跳过:', error);
  }
}

export async function loadEventsFromCloud(userId: string): Promise<TaskEvent[]> {
  const { data, error } = await supabase
    .from('task_events')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map((item: any) => ({
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
  }));
}
