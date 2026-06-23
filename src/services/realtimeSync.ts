// src/services/realtimeSync.ts — Supabase Realtime 订阅
// 实现多标签页/多设备间的即时数据同步

import { supabase } from './supabase';
import { useTaskStore, Task, Tag } from '../store/useTaskStore';
import { useEventStore, TaskEvent } from '../store/useEventStore';
import { dbTaskToApp, dbTagToApp } from './syncService';
import { dbEventToApp } from './eventSyncService';

// ========== 订阅管理 ==========

/**
 * 订阅当前用户的 tasks / tags / task_events 表变更
 * 通过比较 updatedAt 避免本地改动导致的回环重复更新
 *
 * ⚠️ 前置条件：需要在 Supabase 控制台为三个表启用 Realtime
 *    https://supabase.com/dashboard → 你的项目 → Database → Replication → 开启三个表
 */
export function subscribeToRealtime(userId: string) {
  const channel = supabase.channel('funflow-realtime');

  // ── 任务表订阅 ──
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const { tasks, setTasks } = useTaskStore.getState();

      if (payload.eventType === 'DELETE') {
        const deletedId = (payload.old as any)?.task_id;
        if (deletedId) {
          setTasks(tasks.filter((t) => t.id !== deletedId));
        }
        return;
      }

      // INSERT / UPDATE
      const incoming = dbTaskToApp(payload.new);
      const existing = tasks.find((t) => t.id === incoming.id);

      // 如果本地数据更新或相同，跳过（避免本地同步引起的回环）
      if (existing && incoming.updatedAt <= existing.updatedAt) return;

      setTasks(
        existing
          ? tasks.map((t) => (t.id === incoming.id ? incoming : t))
          : [incoming, ...tasks],
      );
    },
  );

  // ── 标签表订阅 ──
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tags',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const { tags, setTags } = useTaskStore.getState();

      if (payload.eventType === 'DELETE') {
        const deletedId = (payload.old as any)?.tag_id;
        if (deletedId) {
          setTags(tags.filter((t) => t.id !== deletedId));
        }
        return;
      }

      const incoming = dbTagToApp(payload.new);
      const existing = tags.find((t) => t.id === incoming.id);

      // 标签无 updatedAt，用简单内容比较避免回环
      if (
        existing &&
        incoming.name === existing.name &&
        incoming.level === existing.level &&
        incoming.order === existing.order &&
        incoming.parentId === existing.parentId
      ) {
        return;
      }

      setTags(
        existing
          ? tags.map((t) => (t.id === incoming.id ? incoming : t))
          : [...tags, incoming],
      );
    },
  );

  // ── 事件表订阅 ──
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'task_events',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const { events, setEvents } = useEventStore.getState();

      if (payload.eventType === 'DELETE') {
        const deletedId = (payload.old as any)?.event_id;
        if (deletedId) {
          setEvents(events.filter((e) => e.id !== deletedId));
        }
        return;
      }

      const incoming = dbEventToApp(payload.new);
      const existing = events.find((e) => e.id === incoming.id);

      // 用 updatedAt 比较避免回环（编辑时 updatedAt 会变）
      if (existing) {
        const incomingTime = incoming.updatedAt || incoming.createdAt;
        const existingTime = existing.updatedAt || existing.createdAt;
        if (incomingTime <= existingTime) return;
      }

      setEvents(
        existing
          ? events.map((e) => (e.id === incoming.id ? incoming : e))
          : [incoming, ...events],
      );
    },
  );

  channel.subscribe();

  // 返回取消订阅函数
  return () => {
    supabase.removeChannel(channel);
  };
}
