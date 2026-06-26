// src/store/useTaskStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useSyncStore } from './useSyncStore';
import { useEventStore } from './useEventStore';
import { scopedStorage } from './persistStorage';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archived: boolean;
  archivedAt?: string;
  deleted: boolean;
  deletedAt?: string;
  createdBy?: string;       // 发起人
  assignedTo?: string;       // 作用对象
}

export interface Tag {
  id: string;
  name: string;
  parentId: string | null;
  colorType: 'emoji' | 'color';
  emoji?: string;
  color?: string;
  level: number;
  order: number;
}

export interface Person {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  parentId: string | null;
  level: number;
  order: number;
  autoCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveSettings {
  autoArchiveDays: number;
  enabled: boolean;
}

interface TaskStore {
  tasks: Task[];
  tags: Tag[];
  people: Person[];
  sidebarOpen: boolean;
  selectedTaskId: string | null;
  showArchived: boolean;
  showTrash: boolean;
  archiveSettings: ArchiveSettings;
  eventHoverDelay: number;
  
  // Task Actions
  restoreToArchive: (id: string) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  autoArchiveTasks: () => void;
  emptyTrash: () => void;
  
  // Tag Actions
  addTag: (tag: Tag) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  moveTag: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;

  // Person Actions
  addPerson: (person: Person) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  movePerson: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  ensurePersonExists: (name: string, nickname?: string) => string;  // 自动同步：返回 person.id
  syncPeopleFromTasks: () => void;  // 全量迁移：扫描所有任务，补录人员到树中

  // UI Actions
  toggleSidebar: () => void;
  setSelectedTask: (id: string | null) => void;
  setShowArchived: (show: boolean) => void;
  setShowTrash: (show: boolean) => void;
  updateArchiveSettings: (settings: Partial<ArchiveSettings>) => void;
  setEventHoverDelay: (delay: number) => void;
  
  // 云同步
  setTasks: (tasks: Task[]) => void;
  setTags: (tags: Tag[]) => void;
  setPeople: (people: Person[]) => void;
  mergeTrashTasks: (cloudTrash: Task[]) => void;
}

const defaultTags: Tag[] = [
  { id: 'work', name: '工作', parentId: null, colorType: 'emoji', emoji: '💼', level: 0, order: 0 },
  { id: 'work-dev', name: '开发', parentId: 'work', colorType: 'emoji', emoji: '💻', level: 1, order: 0 },
  { id: 'work-meeting', name: '会议', parentId: 'work', colorType: 'emoji', emoji: '📅', level: 1, order: 1 },
  { id: 'personal', name: '个人', parentId: null, colorType: 'emoji', emoji: '🏠', level: 0, order: 1 },
  { id: 'study', name: '学习', parentId: null, colorType: 'emoji', emoji: '📚', level: 0, order: 2 },
  { id: 'health', name: '健康', parentId: null, colorType: 'emoji', emoji: '💪', level: 0, order: 3 },
];

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      tags:  [],
      people: [],
      sidebarOpen: true,
      selectedTaskId: null,
      showArchived: false,
      showTrash: false,
      archiveSettings: {
        autoArchiveDays: 7,
        enabled: true,
      },
      eventHoverDelay: 2000,
      
      // ========== Task Actions ==========

      addTask: (task) => {
        useSyncStore.getState().markTaskDirty(task.id);
        // 自动同步：新任务的 createdBy/assignedTo 确保 Person 树中存在
        if (task.createdBy) get().ensurePersonExists(task.createdBy);
        if (task.assignedTo) get().ensurePersonExists(task.assignedTo);
        return set((state) => ({
          tasks: [{ ...task, archived: false, deleted: false }, ...state.tasks]
        }));
      },

      updateTask: (id, updates) => {
        useSyncStore.getState().markTaskDirty(id);
        // 自动同步：createdBy/assignedTo 变更时确保 Person 树中存在
        if (updates.createdBy) {
          get().ensurePersonExists(updates.createdBy);
        }
        if (updates.assignedTo) {
          get().ensurePersonExists(updates.assignedTo);
        }
        return set((state) => {
          const task = state.tasks.find(t => t.id === id);
          const newUpdates = { ...updates };

          if (updates.status === 'completed' && task?.status !== 'completed') {
            newUpdates.completedAt = new Date().toISOString();
          }

          return {
            tasks: state.tasks.map((task) =>
              task.id === id
                ? { ...task, ...newUpdates, updatedAt: new Date().toISOString() }
                : task
            ),
          };
        });
      },

      deleteTask: (id) => {
        useSyncStore.getState().markTaskDirty(id);

        // 级联：该任务的所有事件软删除
        const now = new Date().toISOString();
        const { events, setEvents } = useEventStore.getState();
        const taskEvents = events.filter(e => e.taskId === id && !e.deleted);
        if (taskEvents.length > 0) {
          const eventIds = taskEvents.map(e => e.id);
          useSyncStore.getState().markEventsDirty(eventIds);
          const eventMap = new Map(events.map(e => [e.id, e]));
          for (const eId of eventIds) {
            eventMap.set(eId, { ...eventMap.get(eId)!, deleted: true, deletedAt: now, updatedAt: now });
          }
          setEvents(Array.from(eventMap.values()));
        }

        return set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, deleted: true, deletedAt: now }
              : task
          ),
        }));
      },

      permanentDeleteTask: (id) => {
        console.warn('⚠️ permanentDeleteTask 已弃用，使用 deleteTask（软删除，7天自动清理）');
        return get().deleteTask(id);
      },

      restoreTask: (id) => {
        useSyncStore.getState().markTaskDirty(id);

        // 级联：该任务的所有事件恢复
        const now = new Date().toISOString();
        const { events, setEvents } = useEventStore.getState();
        const taskEvents = events.filter(e => e.taskId === id && e.deleted);
        if (taskEvents.length > 0) {
          const eventIds = taskEvents.map(e => e.id);
          useSyncStore.getState().markEventsDirty(eventIds);
          const eventMap = new Map(events.map(e => [e.id, e]));
          for (const eId of eventIds) {
            eventMap.set(eId, { ...eventMap.get(eId)!, deleted: false, deletedAt: undefined, updatedAt: now });
          }
          setEvents(Array.from(eventMap.values()));
        }

        return set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, deleted: false, archived: true, deletedAt: undefined }
              : task
          ),
        }));
      },

      archiveTask: (id) => {
        useSyncStore.getState().markTaskDirty(id);
        return set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, archived: true, archivedAt: new Date().toISOString() }
              : task
          ),
        }));
      },

      unarchiveTask: (id) => {
        useSyncStore.getState().markTaskDirty(id);
        return set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, archived: false, archivedAt: undefined }
              : task
          ),
        }));
      },

      autoArchiveTasks: () => {
        const { archiveSettings, tasks } = get();
        if (!archiveSettings.enabled) return;

        const archiveThreshold = new Date();
        archiveThreshold.setDate(archiveThreshold.getDate() - archiveSettings.autoArchiveDays);

        const toArchive: string[] = [];
        const updatedTasks = tasks.map((task) => {
          if (task.archived || task.deleted) return task;
          if (task.status === 'completed' && task.completedAt) {
            const completedDate = new Date(task.completedAt);
            if (completedDate < archiveThreshold) {
              toArchive.push(task.id);
              return { ...task, archived: true, archivedAt: new Date().toISOString() };
            }
          }
          return task;
        });

        if (toArchive.length > 0) {
          useSyncStore.getState().markTasksDirty(toArchive);
        }
        set({ tasks: updatedTasks });
      },

      // 清空回收站（已弃用：软删除体系下 7 天自动清理，无需手动清空）
      emptyTrash: () => {
        console.warn('⚠️ emptyTrash 已弃用：回收站 7 天自动清理，无需手动清空');
      },

      // ========== Tag Actions ==========

      addTag: (tag) => {
        useSyncStore.getState().markTagDirty(tag.id);
        return set((state) => ({ tags: [...state.tags, tag] }));
      },

      updateTag: (id, updates) => {
        useSyncStore.getState().markTagDirty(id);
        return set((state) => ({
          tags: state.tags.map((tag) =>
            tag.id === id ? { ...tag, ...updates } : tag
          ),
        }));
      },

      deleteTag: (id) => {
        useSyncStore.getState().markTagDirty(id);
        return set((state) => ({
          tags: state.tags.filter((tag) => tag.id !== id),
          tasks: state.tasks.map((task) => ({
            ...task,
            tags: task.tags.filter((tagId) => tagId !== id),
          })),
        }));
      },

      restoreToArchive: (id) => {
        useSyncStore.getState().markTaskDirty(id);

        // 级联：该任务的所有事件恢复
        const now = new Date().toISOString();
        const { events, setEvents } = useEventStore.getState();
        const taskEvents = events.filter(e => e.taskId === id && e.deleted);
        if (taskEvents.length > 0) {
          const eventIds = taskEvents.map(e => e.id);
          useSyncStore.getState().markEventsDirty(eventIds);
          const eventMap = new Map(events.map(e => [e.id, e]));
          for (const eId of eventIds) {
            eventMap.set(eId, { ...eventMap.get(eId)!, deleted: false, deletedAt: undefined, updatedAt: now });
          }
          setEvents(Array.from(eventMap.values()));
        }

        return set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  deleted: false,
                  deletedAt: undefined,
                  archived: true,
                  archivedAt: new Date().toISOString()
                }
              : task
          ),
        }));
      },

      moveTag: (dragId, targetId, position) =>
        set((state) => {
          const dragIndex = state.tags.findIndex(t => t.id === dragId);
          const targetIndex = state.tags.findIndex(t => t.id === targetId);

          if (dragIndex === -1 || targetIndex === -1) return state;

          const dragTag = { ...state.tags[dragIndex] };
          const targetTag = state.tags[targetIndex];
          let newTags = [...state.tags];

          newTags.splice(dragIndex, 1);
          let newTargetIndex = newTags.findIndex(t => t.id === targetId);

          if (position === 'inside') {
            dragTag.parentId = targetTag.id;
            dragTag.level = targetTag.level + 1;
            const childrenCount = newTags.filter(t => t.parentId === targetTag.id).length;
            dragTag.order = childrenCount;
            newTags.splice(newTargetIndex + 1 + childrenCount, 0, dragTag);
          } else {
            dragTag.parentId = targetTag.parentId;
            dragTag.level = targetTag.level;
            const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1;
            newTags.splice(insertIndex, 0, dragTag);
          }

          const regroup = (parentId: string | null) => {
            const siblings = newTags.filter(t => t.parentId === parentId);
            siblings.forEach((t, idx) => {
              t.order = idx;
            });
          };

          const toMark: string[] = [dragId, targetId];
          regroup(dragTag.parentId);
          const dragParent = dragTag.parentId;
          // 找所有排序可能变化的同级标签
          const reordered = newTags.filter(t => t.parentId === dragParent);
          reordered.forEach(t => { if (!toMark.includes(t.id)) toMark.push(t.id); });
          if (position === 'inside') {
            regroup(targetTag.id);
            const targetChildren = newTags.filter(t => t.parentId === targetTag.id);
            targetChildren.forEach(t => { if (!toMark.includes(t.id)) toMark.push(t.id); });
          }

          // 异步标记 dirty（避免 set 内部副作用）
          setTimeout(() => useSyncStore.getState().markTagsDirty(toMark), 0);

          return { tags: newTags };
        }),
      
      // ========== Person Actions ==========

      addPerson: (person) => {
        useSyncStore.getState().markPersonDirty(person.id);
        return set((state) => ({ people: [...state.people, person] }));
      },

      updatePerson: (id, updates) => {
        const state = get();
        const oldPerson = state.people.find(p => p.id === id);
        if (!oldPerson) {
          useSyncStore.getState().markPersonDirty(id);
          return set((s) => ({ people: s.people.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p) }));
        }

        const newName = updates.name ?? oldPerson.name;
        const newNick = updates.nickname ?? oldPerson.nickname;
        const nameChanged = newName !== oldPerson.name;
        const nickChanged = newNick !== oldPerson.nickname;

        // 检查新名称是否命中已有其他人员（合并去重）
        const matchByName = state.people.find(p => p.id !== id && p.name === newName);
        const matchByNick = newNick ? state.people.find(p => p.id !== id && p.nickname === newNick) : null;
        const mergeTarget = matchByName || matchByNick;

        if (mergeTarget) {
          // 合并：将旧人员的引用迁移到目标人员，删除旧人员记录
          const mergeName = mergeTarget.name;
          const mergeNick = mergeTarget.nickname;
          const updatedTasks = state.tasks.map(t => {
            let cb = t.createdBy;
            let ab = t.assignedTo;
            let changed = false;
            if (nameChanged) {
              if (cb === oldPerson.name) { cb = mergeName; changed = true; }
              if (ab === oldPerson.name) { ab = mergeName; changed = true; }
            }
            if (nickChanged && oldPerson.nickname) {
              if (cb === oldPerson.nickname) { cb = mergeNick || mergeName; changed = true; }
              if (ab === oldPerson.nickname) { ab = mergeNick || mergeName; changed = true; }
            }
            return changed ? { ...t, createdBy: cb, assignedTo: ab, updatedAt: new Date().toISOString() } : t;
          });
          const dirtyIds: string[] = [];
          updatedTasks.forEach((t, i) => {
            if (t !== state.tasks[i]) dirtyIds.push(t.id);
          });
          if (dirtyIds.length > 0) setTimeout(() => useSyncStore.getState().markTasksDirty(dirtyIds), 0);
          useSyncStore.getState().markPersonDirty(id);
          useSyncStore.getState().markPersonDirty(mergeTarget.id);
          return set({ tasks: updatedTasks, people: state.people.filter(p => p.id !== id) });
        }

        // 无冲突：普通改名 + 同步更新任务引用
        if (nameChanged || nickChanged) {
          const oldName = oldPerson.name;
          const oldNick = oldPerson.nickname;
          const updatedTasks = state.tasks.map(t => {
            let cb = t.createdBy;
            let ab = t.assignedTo;
            let changed = false;
            if (nameChanged) {
              if (cb === oldName) { cb = newName; changed = true; }
              if (ab === oldName) { ab = newName; changed = true; }
            }
            if (nickChanged && oldNick) {
              if (cb === oldNick) { cb = newNick; changed = true; }
              if (ab === oldNick) { ab = newNick; changed = true; }
            }
            return changed ? { ...t, createdBy: cb, assignedTo: ab, updatedAt: new Date().toISOString() } : t;
          });
          const dirtyIds: string[] = [];
          updatedTasks.forEach((t, i) => { if (t !== state.tasks[i]) dirtyIds.push(t.id); });
          if (dirtyIds.length > 0) setTimeout(() => useSyncStore.getState().markTasksDirty(dirtyIds), 0);
          useSyncStore.getState().markPersonDirty(id);
          return set({ tasks: updatedTasks, people: state.people.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          )});
        }

        // 仅邮箱等非名称字段变更
        useSyncStore.getState().markPersonDirty(id);
        return set((s) => ({ people: s.people.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p) }));
      },

      deletePerson: (id) => {
        useSyncStore.getState().markPersonDirty(id);
        return set((state) => ({
          people: state.people.filter((p) => p.id !== id),
          // 不同步清理任务中的 createdBy/assignedTo 文本引用
        }));
      },

      movePerson: (dragId, targetId, position) =>
        set((state) => {
          const dragIndex = state.people.findIndex(p => p.id === dragId);
          const targetIndex = state.people.findIndex(p => p.id === targetId);
          if (dragIndex === -1 || targetIndex === -1) return state;

          const dragPerson = { ...state.people[dragIndex] };
          let newPeople = [...state.people];

          newPeople.splice(dragIndex, 1);
          let newTargetIndex = newPeople.findIndex(p => p.id === targetId);

          // 人员扁平无层级，inside 等同于 after
          dragPerson.parentId = null;
          dragPerson.level = 0;
          const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1;
          newPeople.splice(insertIndex, 0, dragPerson);

          // 重算所有 order
          newPeople.forEach((p, idx) => { p.order = idx; });

          const allIds = newPeople.map(p => p.id);
          setTimeout(() => useSyncStore.getState().markPeopleDirty(allIds), 0);
          return { people: newPeople };
        }),

      // 自动同步：任务中写入 createdBy/assignedTo 时，确保 Person 树中存在
      ensurePersonExists: (name, nickname) => {
        const state = get();
        const finalName = name || nickname || '';
        const finalNick = nickname || undefined;
        // 检索是否已存在（本名精确匹配，或花名匹配）
        const existing = state.people.find(
          p => p.name === finalName || (finalNick && p.nickname === finalNick)
        );
        if (existing) {
          if (!existing.autoCreated) return existing.id;
          state.updatePerson(existing.id, { name: finalName, nickname: finalNick, updatedAt: new Date().toISOString() });
          return existing.id;
        }

        // 不存在则自动创建，直接放在顶层（不创建"自动同步"根节点）
        const newPerson: Person = {
          id: crypto.randomUUID(),
          name: finalName,
          nickname: finalNick,
          parentId: null,
          level: 0,
          order: state.people.filter(p => p.parentId === null).length,
          autoCreated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.addPerson(newPerson);
        return newPerson.id;
      },

      // 全量迁移：扫描所有任务，补录人员到树中
      syncPeopleFromTasks: () => {
        const state = get();
        const seen = new Set(state.people.map(p => p.name));
        state.tasks.forEach(task => {
          if (task.createdBy && !seen.has(task.createdBy)) {
            seen.add(task.createdBy);
            state.ensurePersonExists(task.createdBy);
          }
          if (task.assignedTo && !seen.has(task.assignedTo)) {
            seen.add(task.assignedTo);
            state.ensurePersonExists(task.assignedTo);
          }
        });
      },

      // ========== UI Actions ==========
      
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setSelectedTask: (id) =>
        set({ selectedTaskId: id }),
      
      setShowArchived: (show) =>
        set({ showArchived: show, showTrash: false }),
      
      setShowTrash: (show) =>
        set({ showTrash: show, showArchived: false }),
      
      updateArchiveSettings: (settings) =>
        set((state) => ({
          archiveSettings: { ...state.archiveSettings, ...settings }
        })),

      setEventHoverDelay: (delay) => set({ eventHoverDelay: delay }),
      
      // ========== 云同步 Actions ==========
      
      setTasks: (tasks) => set({ tasks }),
      setTags: (tags) => set({ tags }),
      setPeople: (people) => set({ people }),

      // 合并云端回收站任务到本地（以 updatedAt 为仲裁依据）
      mergeTrashTasks: (cloudTrash) =>
        set((state) => {
          const merged = new Map(state.tasks.map(t => [t.id, t]));
          for (const ct of cloudTrash) {
            const local = merged.get(ct.id);
            if (!local || ct.updatedAt >= local.updatedAt) {
              merged.set(ct.id, ct);
            }
          }
          const tasks = Array.from(merged.values());
          return { tasks };
        }),
    }),
    {
      name: 'funflow-storage',
      storage: createJSONStorage(() => scopedStorage),
    }
  )
);