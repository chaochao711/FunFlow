// src/types/task.ts

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
  parentId: string | null;  // 支持多级标签
  colorType: 'emoji' | 'color';
  emoji?: string;
  color?: string;
  level: number;
  order: number;
}

export interface FilterState {
  status: string | null;
  priority: string | null;
  tags: string[];  // 支持多选
  dateRange: 'all' | 'today' | 'week' | 'overdue';
}