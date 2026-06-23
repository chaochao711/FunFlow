// src/store/useEventStore.ts — 事件/节点状态管理

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSyncStore } from './useSyncStore';

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
  updatedAt?: string;       // 最后编辑时间
}

interface EventStore {
  events: TaskEvent[];

  addEvent: (event: TaskEvent) => void;
  updateEvent: (id: string, updates: Partial<TaskEvent>) => void;
  deleteEvent: (id: string) => void;
  toggleEventComplete: (id: string) => void;
  getEventsByTask: (taskId: string) => TaskEvent[];
  getAllEvents: () => TaskEvent[];

  // 云同步
  setEvents: (events: TaskEvent[]) => void;
}

export const useEventStore = create<EventStore>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (event) => {
        useSyncStore.getState().markEventDirty(event.id);
        set((state) => ({ events: [event, ...state.events] }));
      },

      updateEvent: (id, updates) => {
        useSyncStore.getState().markEventDirty(id);
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }));
      },

      deleteEvent: (id) => {
        useSyncStore.getState().markEventDirty(id);
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        }));
      },

      toggleEventComplete: (id) => {
        useSyncStore.getState().markEventDirty(id);
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  completed: !e.completed,
                  completedAt: !e.completed ? new Date().toISOString() : undefined,
                  updatedAt: new Date().toISOString(),
                }
              : e
          ),
        }));
      },

      getEventsByTask: (taskId) => {
        const evts = get().events;
        if (!Array.isArray(evts)) return [];
        return evts.filter((e) => e.taskId === taskId);
      },

      getAllEvents: () => {
        return [...get().events].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      setEvents: (events) => set({ events }),
    }),
    {
      name: 'funflow-events-storage',
    }
  )
);
