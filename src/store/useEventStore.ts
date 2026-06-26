// src/store/useEventStore.ts — 事件/节点状态管理（支持自定义排序）

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useSyncStore } from './useSyncStore';
import { scopedStorage } from './persistStorage';

export interface TaskEvent {
  id: string;
  taskId: string;           // 关联任务
  type: 'completion' | 'idea' | 'note' | 'milestone';
  content: string;          // 事件内容
  timestamp: string;        // 事件时间（等于 createdAt，不再支持自选）
  createdAt: string;        // 创建时间（自动，也是事件的显示时间）
  userId: string;           // 所属用户
  // 完成节点（completion 类型专属）
  completed?: boolean;      // 是否完成
  completedAt?: string;     // 完成时间
  estimatedTime?: string;   // 预计完成时间（仅 completion 类型可选）
  // 编辑
  updatedAt: string;        // 最后编辑时间
  // 排序
  order: number;            // 全局排序，越小越靠前
  // 软删除
  deleted: boolean;         // 是否已删除
  deletedAt?: string;       // 删除时间
  // 扩展字段
  metadata?: Record<string, any>;
}

interface EventStore {
  events: TaskEvent[];

  addEvent: (event: TaskEvent) => void;
  updateEvent: (id: string, updates: Partial<TaskEvent>) => void;
  deleteEvent: (id: string) => void;
  toggleEventComplete: (id: string) => void;
  getEventsByTask: (taskId: string) => TaskEvent[];
  getAllEvents: () => TaskEvent[];
  reorderEvents: (taskId: string, orderedIds: string[]) => void;

  // 云同步
  setEvents: (events: TaskEvent[]) => void;
}

export const useEventStore = create<EventStore>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (event) => {
        // 新事件 order = 0（排最前），同 task 的事件 +1
        const siblings = get().events.filter(e => e.taskId === event.taskId);
        const updated = get().events.map(e =>
          e.taskId === event.taskId ? { ...e, order: (e.order ?? 0) + 1 } : e
        );
        useSyncStore.getState().markEventDirty(event.id);
        // 标记所有重新编号的同 task 事件
        const allDirty = [event.id, ...siblings.map(s => s.id)];
        useSyncStore.getState().markEventsDirty(allDirty);
        const now = new Date().toISOString();
        set({ events: [{
          ...event,
          order: event.order ?? 0,
          updatedAt: now,
          deleted: false,
        }, ...updated] });
      },

      updateEvent: (id, updates) => {
        useSyncStore.getState().markEventDirty(id);
        const now = new Date().toISOString();
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: now } : e
          ),
        }));
      },

      deleteEvent: (id) => {
        // 软删除：标记 deleted=true 而非移除
        useSyncStore.getState().markEventDirty(id);
        const now = new Date().toISOString();
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id
              ? { ...e, deleted: true, deletedAt: now, updatedAt: now }
              : e
          ),
        }));
      },

      toggleEventComplete: (id) => {
        useSyncStore.getState().markEventDirty(id);
        const now = new Date().toISOString();
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  completed: !e.completed,
                  completedAt: !e.completed ? now : undefined,
                  updatedAt: now,
                }
              : e
          ),
        }));
      },

      getEventsByTask: (taskId) => {
        const evts = get().events;
        if (!Array.isArray(evts)) return [];
        return evts
          .filter((e) => e.taskId === taskId && !e.deleted)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      },

      getAllEvents: () => {
        return [...get().events].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      reorderEvents: (taskId, orderedIds) => {
        const syncStore = useSyncStore.getState();
        set((state) => {
          const updated = state.events.map(e => {
            const idx = orderedIds.indexOf(e.id);
            if (e.taskId !== taskId) return e;
            return { ...e, order: idx >= 0 ? idx : (e.order ?? 0) };
          });
          return { events: updated };
        });
        // 标记脏
        syncStore.markEventsDirty(orderedIds);
      },

      setEvents: (events) => set({ events }),
    }),
    {
      name: 'funflow-events-storage',
      storage: createJSONStorage(() => scopedStorage),
    }
  )
);
