// src/store/useTaskStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from './useTaskStore';

describe('useTaskStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useTaskStore.setState({
      tasks: [],
      tags: [],
      sidebarOpen: true,
      selectedTaskId: null,
      showArchived: false,
      showTrash: false,
      archiveSettings: { autoArchiveDays: 7, enabled: true },
    });
  });

  // ========== Task CRUD ==========

  describe('addTask', () => {
    it('添加任务并设置默认值', () => {
      useTaskStore.getState().addTask({
        id: '1',
        title: '测试任务',
        priority: 'medium',
        status: 'pending',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archived: false,
        deleted: false,
      });

      const tasks = useTaskStore.getState().tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('测试任务');
      expect(tasks[0].archived).toBe(false);
      expect(tasks[0].deleted).toBe(false);
    });
  });

  describe('updateTask', () => {
    it('更新任务字段', () => {
      useTaskStore.getState().addTask({
        id: '1', title: '旧标题', priority: 'low', status: 'pending',
        tags: [], createdAt: '', updatedAt: '', archived: false, deleted: false,
      });

      useTaskStore.getState().updateTask('1', { title: '新标题', priority: 'high' });
      const task = useTaskStore.getState().tasks[0];
      expect(task.title).toBe('新标题');
      expect(task.priority).toBe('high');
    });

    it('完成时自动设置 completedAt', () => {
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'pending',
        tags: [], createdAt: '', updatedAt: '', archived: false, deleted: false,
      });

      useTaskStore.getState().updateTask('1', { status: 'completed' });
      const task = useTaskStore.getState().tasks[0];
      expect(task.status).toBe('completed');
      expect(task.completedAt).toBeDefined();
    });
  });

  describe('deleteTask', () => {
    it('软删除（标记 deleted=true）', () => {
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'pending',
        tags: [], createdAt: '', updatedAt: '', archived: false, deleted: false,
      });

      useTaskStore.getState().deleteTask('1');
      const task = useTaskStore.getState().tasks[0];
      expect(task.deleted).toBe(true);
      expect(task.deletedAt).toBeDefined();
    });
  });

  describe('permanentDeleteTask', () => {
    it('永久删除', () => {
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'pending',
        tags: [], createdAt: '', updatedAt: '', archived: false, deleted: false,
      });

      useTaskStore.getState().permanentDeleteTask('1');
      expect(useTaskStore.getState().tasks).toHaveLength(0);
    });
  });

  // ========== 归档 / 恢复 ==========

  describe('archiveTask / unarchiveTask', () => {
    it('归档任务', () => {
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'completed',
        tags: [], createdAt: '', updatedAt: '', archived: false, deleted: false,
      });

      useTaskStore.getState().archiveTask('1');
      const task = useTaskStore.getState().tasks[0];
      expect(task.archived).toBe(true);
      expect(task.archivedAt).toBeDefined();
    });

    it('取消归档', () => {
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'completed',
        tags: [], createdAt: '', updatedAt: '', archived: true, deleted: false,
      });

      useTaskStore.getState().unarchiveTask('1');
      const task = useTaskStore.getState().tasks[0];
      expect(task.archived).toBe(false);
      expect(task.archivedAt).toBeUndefined();
    });
  });

  // ========== 回收站 ==========

  describe('restoreTask', () => {
    it('从回收站恢复到归档', () => {
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'pending',
        tags: [], createdAt: '', updatedAt: '', archived: false, deleted: true,
      });

      useTaskStore.getState().restoreTask('1');
      const task = useTaskStore.getState().tasks[0];
      expect(task.deleted).toBe(false);
      expect(task.archived).toBe(true);  // 关键规则：恢复到归档
      expect(task.deletedAt).toBeUndefined();
    });
  });

  describe('emptyTrash', () => {
    it('清空所有已删除任务', () => {
      // 直接用 setState 设置初始状态，绕过 persist middleware
      useTaskStore.setState({
        tasks: [
          { id: '1', title: '正常', priority: 'low' as const, status: 'pending' as const,
            tags: [], createdAt: '', updatedAt: '', archived: false, deleted: false },
          { id: '2', title: '已删除', priority: 'low' as const, status: 'pending' as const,
            tags: [], createdAt: '', updatedAt: '', archived: false, deleted: true },
        ],
      });

      useTaskStore.getState().emptyTrash();
      const tasks = useTaskStore.getState().tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('1');
    });
  });

  // ========== Tag CRUD ==========

  describe('addTag / updateTag / deleteTag', () => {
    it('添加标签', () => {
      useTaskStore.getState().addTag({
        id: 't1', name: '工作', parentId: null,
        colorType: 'emoji', emoji: '💼', level: 0, order: 0,
      });
      expect(useTaskStore.getState().tags).toHaveLength(1);
    });

    it('删除标签同时清理任务的引用', () => {
      useTaskStore.getState().addTag({
        id: 't1', name: '工作', parentId: null,
        colorType: 'emoji', emoji: '💼', level: 0, order: 0,
      });
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'pending',
        tags: ['t1'], createdAt: '', updatedAt: '', archived: false, deleted: false,
      });

      useTaskStore.getState().deleteTag('t1');
      expect(useTaskStore.getState().tags).toHaveLength(0);
      expect(useTaskStore.getState().tasks[0].tags).toHaveLength(0);
    });
  });

  // ========== autoArchiveTasks ==========

  describe('autoArchiveTasks', () => {
    it('自动归档超时的已完成任务', () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 30);
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'completed',
        tags: [], createdAt: '', updatedAt: '',
        completedAt: longAgo.toISOString(),
        archived: false, deleted: false,
      });

      useTaskStore.getState().autoArchiveTasks();
      const task = useTaskStore.getState().tasks[0];
      expect(task.archived).toBe(true);
    });

    it('不归档未完成的任务', () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 30);
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'in-progress',
        tags: [], createdAt: '', updatedAt: '',
        completedAt: longAgo.toISOString(),
        archived: false, deleted: false,
      });

      useTaskStore.getState().autoArchiveTasks();
      const task = useTaskStore.getState().tasks[0];
      expect(task.archived).toBe(false);
    });

    it('disabled 时不自动归档', () => {
      useTaskStore.getState().updateArchiveSettings({ enabled: false });
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 30);
      useTaskStore.getState().addTask({
        id: '1', title: 'T', priority: 'low', status: 'completed',
        tags: [], createdAt: '', updatedAt: '',
        completedAt: longAgo.toISOString(),
        archived: false, deleted: false,
      });

      useTaskStore.getState().autoArchiveTasks();
      const task = useTaskStore.getState().tasks[0];
      expect(task.archived).toBe(false);
    });
  });
});
