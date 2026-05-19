// src/store/useTaskStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  history: TaskHistory[];
}

export interface TaskHistory {
  id: string;
  taskId: string;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
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

export interface ArchiveSettings {
  autoArchiveDays: number;
  enabled: boolean;
}

interface TaskStore {
  tasks: Task[];
  tags: Tag[];
  sidebarOpen: boolean;
  selectedTaskId: string | null;
  showArchived: boolean;
  showTrash: boolean;
  archiveSettings: ArchiveSettings;
  
  // Task Actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  autoArchiveTasks: () => void;
  addHistory: (taskId: string, field: string, oldValue: any, newValue: any) => void;
  restoreVersion: (taskId: string, historyId: string) => void;
  emptyTrash: () => void;  // 新增：清空回收站
  
  // Tag Actions
  addTag: (tag: Tag) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  moveTag: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  
  // UI Actions
  toggleSidebar: () => void;
  setSelectedTask: (id: string | null) => void;
  setShowArchived: (show: boolean) => void;
  setShowTrash: (show: boolean) => void;
  updateArchiveSettings: (settings: Partial<ArchiveSettings>) => void;
  
  // 云同步
  setTasks: (tasks: Task[]) => void;
  setTags: (tags: Tag[]) => void;
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
      tags: defaultTags,
      sidebarOpen: true,
      selectedTaskId: null,
      showArchived: false,
      showTrash: false,
      archiveSettings: {
        autoArchiveDays: 7,
        enabled: true,
      },
      
      // ========== Task Actions ==========
      
      addTask: (task) =>
        set((state) => ({ 
          tasks: [{ ...task, archived: false, deleted: false, history: task.history || [] }, ...state.tasks] 
        })),
      
      updateTask: (id, updates) =>
        set((state) => {
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
        }),
      
      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, deleted: true, deletedAt: new Date().toISOString() }
              : task
          ),
        })),
      
      permanentDeleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),
      
      restoreTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, deleted: false, deletedAt: undefined }
              : task
          ),
        })),
      
      archiveTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, archived: true, archivedAt: new Date().toISOString() }
              : task
          ),
        })),
      
      unarchiveTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, archived: false, archivedAt: undefined }
              : task
          ),
        })),
      
      autoArchiveTasks: () => {
        const { archiveSettings, tasks } = get();
        if (!archiveSettings.enabled) return;
        
        const archiveThreshold = new Date();
        archiveThreshold.setDate(archiveThreshold.getDate() - archiveSettings.autoArchiveDays);
        
        const updatedTasks = tasks.map((task) => {
          if (task.archived || task.deleted) return task;
          if (task.status === 'completed' && task.completedAt) {
            const completedDate = new Date(task.completedAt);
            if (completedDate < archiveThreshold) {
              return { ...task, archived: true, archivedAt: new Date().toISOString() };
            }
          }
          return task;
        });
        
        set({ tasks: updatedTasks });
      },
      
      addHistory: (taskId, field, oldValue, newValue) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  history: [
                    {
                      id: Date.now().toString(),
                      taskId,
                      field,
                      oldValue,
                      newValue,
                      timestamp: new Date().toISOString(),
                    },
                    ...(task.history || []),
                  ],
                }
              : task
          ),
        })),
      
      restoreVersion: (taskId, historyId) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId);
          const historyEntry = task?.history?.find((h) => h.id === historyId);
          if (!task || !historyEntry) return state;
          
          return {
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, [historyEntry.field]: historyEntry.oldValue, updatedAt: new Date().toISOString() }
                : t
            ),
          };
        }),
      
      // 清空回收站
      emptyTrash: () =>
        set((state) => ({
          tasks: state.tasks.filter((task) => !task.deleted),
        })),
      
      // ========== Tag Actions ==========
      
      addTag: (tag) =>
        set((state) => ({ tags: [...state.tags, tag] })),
      
      updateTag: (id, updates) =>
        set((state) => ({
          tags: state.tags.map((tag) =>
            tag.id === id ? { ...tag, ...updates } : tag
          ),
        })),
      
      deleteTag: (id) =>
        set((state) => ({
          tags: state.tags.filter((tag) => tag.id !== id),
          tasks: state.tasks.map((task) => ({
            ...task,
            tags: task.tags.filter((tagId) => tagId !== id),
          })),
        })),
      
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
          
          regroup(dragTag.parentId);
          if (position === 'inside') {
            regroup(targetTag.id);
          }
          
          return { tags: newTags };
        }),
      
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
      
      // ========== 云同步 Actions ==========
      
      setTasks: (tasks) => set({ tasks }),
      setTags: (tags) => set({ tags }),
    }),
    {
      name: 'funflow-storage',
    }
  )
);