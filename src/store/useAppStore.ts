// src/store/useAppStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 直接在 store 文件中定义类型
export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: string;
  projectId?: string;
  listId?: string;
  tagIds?: string[];
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  isExpanded: boolean;
}

export interface List {
  id: string;
  projectId: string;
  name: string;
  order: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

interface AppState {
  // 数据
  tasks: Task[];
  projects: Project[];
  lists: List[];
  tags: Tag[];
  
  // UI 状态
  selectedProjectId: string | null;
  selectedListId: string | null;
  selectedTagId: string | null;
  currentView: 'list' | 'calendar';
  sidebarCollapsed: boolean;
  
  // Actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleComplete: (id: string) => void;
  
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  toggleProjectExpand: (id: string) => void;
  
  addList: (list: List) => void;
  updateList: (id: string, updates: Partial<List>) => void;
  deleteList: (id: string) => void;
  
  addTag: (tag: Tag) => void;
  deleteTag: (id: string) => void;
  
  setSelectedProject: (projectId: string | null) => void;
  setSelectedList: (listId: string | null) => void;
  setSelectedTag: (tagId: string | null) => void;
  setCurrentView: (view: 'list' | 'calendar') => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 初始数据
      tasks: [],
      projects: [
        {
          id: 'default-project',
          name: '默认项目',
          icon: '📋',
          color: 'blue',
          order: 0,
          isExpanded: true,
        },
      ],
      lists: [
        {
          id: 'default-list',
          projectId: 'default-project',
          name: '任务清单',
          order: 0,
        },
      ],
      tags: [],
      
      selectedProjectId: 'default-project',
      selectedListId: 'default-list',
      selectedTagId: null,
      currentView: 'list',
      sidebarCollapsed: false,
      
      // Task actions
      addTask: (task) =>
        set((state) => ({ tasks: [task, ...state.tasks] })),
      
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        })),
      
      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),
      
      toggleComplete: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, completed: !task.completed } : task
          ),
        })),
      
      // Project actions
      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),
      
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id ? { ...project, ...updates } : project
          ),
        })),
      
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          lists: state.lists.filter((list) => list.projectId !== id),
          tasks: state.tasks.filter((task) => task.projectId !== id),
        })),
      
      toggleProjectExpand: (id) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, isExpanded: !project.isExpanded }
              : project
          ),
        })),
      
      // List actions
      addList: (list) =>
        set((state) => ({
          lists: [...state.lists, list],
        })),
      
      updateList: (id, updates) =>
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === id ? { ...list, ...updates } : list
          ),
        })),
      
      deleteList: (id) =>
        set((state) => ({
          lists: state.lists.filter((list) => list.id !== id),
          tasks: state.tasks.filter((task) => task.listId !== id),
        })),
      
      // Tag actions
      addTag: (tag) =>
        set((state) => ({
          tags: [...state.tags, tag],
        })),
      
      deleteTag: (id) =>
        set((state) => ({
          tags: state.tags.filter((tag) => tag.id !== id),
          tasks: state.tasks.map((task) => ({
            ...task,
            tagIds: task.tagIds?.filter((tagId) => tagId !== id),
          })),
        })),
      
      // UI actions
      setSelectedProject: (projectId) =>
        set({ selectedProjectId: projectId, selectedListId: null }),
      
      setSelectedList: (listId) =>
        set({ selectedListId: listId }),
      
      setSelectedTag: (tagId) =>
        set({ selectedTagId: tagId }),
      
      setCurrentView: (view) =>
        set({ currentView: view }),
      
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'funflow-storage',
    }
  )
);