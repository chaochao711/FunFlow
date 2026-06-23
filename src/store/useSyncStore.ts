// src/store/useSyncStore.ts — 同步脏标记（不持久化，仅运行时跟踪哪些数据需要同步）

import { create } from 'zustand';

interface SyncStore {
  dirtyTaskIds: string[];
  dirtyTagIds: string[];
  dirtyEventIds: string[];
  markTaskDirty: (id: string) => void;
  markTagDirty: (id: string) => void;
  markEventDirty: (id: string) => void;
  clearDirtyTasks: () => void;
  clearDirtyTags: () => void;
  clearDirtyEvents: () => void;
  markTasksDirty: (ids: string[]) => void;
  markTagsDirty: (ids: string[]) => void;
  markEventsDirty: (ids: string[]) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  dirtyTaskIds: [],
  dirtyTagIds: [],
  dirtyEventIds: [],

  markTaskDirty: (id) =>
    set((s) => s.dirtyTaskIds.includes(id) ? s : { dirtyTaskIds: [...s.dirtyTaskIds, id] }),

  markTagDirty: (id) =>
    set((s) => s.dirtyTagIds.includes(id) ? s : { dirtyTagIds: [...s.dirtyTagIds, id] }),

  markEventDirty: (id) =>
    set((s) => s.dirtyEventIds.includes(id) ? s : { dirtyEventIds: [...s.dirtyEventIds, id] }),

  markTasksDirty: (ids) =>
    set((s) => {
      const newSet = new Set(s.dirtyTaskIds);
      ids.forEach((id) => newSet.add(id));
      const arr = Array.from(newSet);
      return arr.length === s.dirtyTaskIds.length ? s : { dirtyTaskIds: arr };
    }),

  markEventsDirty: (ids) =>
    set((s) => {
      const newSet = new Set(s.dirtyEventIds);
      ids.forEach((id) => newSet.add(id));
      const arr = Array.from(newSet);
      return arr.length === s.dirtyEventIds.length ? s : { dirtyEventIds: arr };
    }),

  markTagsDirty: (ids) =>
    set((s) => {
      const newSet = new Set(s.dirtyTagIds);
      ids.forEach((id) => newSet.add(id));
      const arr = Array.from(newSet);
      return arr.length === s.dirtyTagIds.length ? s : { dirtyTagIds: arr };
    }),

  clearDirtyTasks: () => set({ dirtyTaskIds: [] }),
  clearDirtyTags: () => set({ dirtyTagIds: [] }),
  clearDirtyEvents: () => set({ dirtyEventIds: [] }),
}));
