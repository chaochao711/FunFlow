// src/components/TaskDetailDrawer.tsx — 任务详情弹窗（直接编辑、双栏布局、退出自动保存）

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag as TagIcon, Calendar, Plus } from 'lucide-react';
import { useTaskStore, Task, Tag } from '../store/useTaskStore';
import { useEventStore } from '../store/useEventStore';
import { getTagDisplay } from '../utils/tagUtils';
import type { TaskEvent } from '../store/useEventStore';
import CreateTagModal from './CreateTagModal';
import CreateEventModal from './CreateEventModal';
import EventTimeline from './EventTimeline';

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
  tags: Tag[];
}

export default function TaskDetailDrawer({ taskId, onClose, tags }: TaskDetailDrawerProps) {
  const { tasks, updateTask, addTag } = useTaskStore();
  const { events, addEvent, updateEvent, deleteEvent, toggleEventComplete, getEventsByTask, reorderEvents } = useEventStore();
  const task = tasks.find(t => t.id === taskId);
  const [editData, setEditData] = useState<Partial<Task>>({});
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<TaskEvent | null>(null);

  // 切换任务时重置编辑状态 + 锁住背景滚动穿透
  useEffect(() => {
    setEditData({});
    if (taskId) {
      const html = document.documentElement;
      const body = document.body;
      const prevOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      return () => {
        body.style.overflow = prevOverflow;
        html.style.overflow = '';
      };
    }
  }, [taskId]);

  if (!task) return null;

  const currentTags = editData.tags !== undefined ? editData.tags : task.tags;

  // 自动保存：将所有 editData 中的变更写入 store
  const autoSave = () => {
    const changes: Partial<Task> = {};
    Object.entries(editData).forEach(([key, value]) => {
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(task[key as keyof Task])) {
        changes[key as keyof Task] = value as any;
      }
    });
    if (Object.keys(changes).length > 0) {
      updateTask(task.id, changes);
    }
    setEditData({});
  };

  // 关闭时自动保存
  const handleClose = () => {
    autoSave();
    onClose();
  };

  const setField = (field: keyof Task, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const buildTagTree = (parentId: string | null = null, level: number = 0): Tag[] => {
    return tags
      .filter(tag => tag.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(tag => ({ ...tag, level }));
  };

  const renderTagOption = (tag: Tag & { level: number }) => {
    const children = buildTagTree(tag.id, tag.level + 1);
    const isSelected = (currentTags || []).includes(tag.id);

    return (
      <div key={tag.id}>
        <button
          type="button"
          onClick={() => {
            const newTags = isSelected
              ? (currentTags || []).filter(t => t !== tag.id)
              : [...(currentTags || []), tag.id];
            setField('tags', newTags);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
            isSelected
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          style={{ marginLeft: tag.level * 16 }}
        >
          <span className="text-base">{getTagDisplay(tag)}</span>
          <span>{tag.name}</span>
          {isSelected && <span className="ml-auto text-xs">✓</span>}
        </button>
        {children.map(child => renderTagOption({ ...child, level: child.level }))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {taskId && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={handleClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-6 md:inset-8 z-50 m-auto w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-48px)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">任务详情</h2>
              </div>
              <button onClick={handleClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* 双栏内容 */}
            <div className="flex-1 overflow-hidden p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                {/* ===== 左栏：编辑字段 ===== */}
                <div className="flex-1 space-y-4 overflow-y-auto [overscroll-behavior:contain] min-h-0 pr-1">
                  {/* 标题 */}
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">标题</label>
                    <input
                      type="text"
                      defaultValue={task.title}
                      onChange={(e) => setField('title', e.target.value)}
                      className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  {/* 描述 */}
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">描述</label>
                    <textarea
                      defaultValue={task.description}
                      rows={4}
                      onChange={(e) => setField('description', e.target.value)}
                      placeholder="添加描述..."
                      className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  {/* 发起人 / 作用对象 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">发起人</label>
                      <input
                        type="text"
                        defaultValue={task.createdBy || ''}
                        onChange={(e) => setField('createdBy', e.target.value || undefined)}
                        placeholder="发起人"
                        className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">作用对象</label>
                      <input
                        type="text"
                        defaultValue={task.assignedTo || ''}
                        onChange={(e) => setField('assignedTo', e.target.value || undefined)}
                        placeholder="执行者"
                        className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  {/* 截止日期 */}
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <Calendar size={12} /> 截止日期
                    </label>
                    <input
                      type="date"
                      defaultValue={task.dueDate}
                      onChange={(e) => setField('dueDate', e.target.value)}
                      className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  {/* 状态 */}
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">状态</label>
                    <div className="flex gap-2 mt-1">
                      {(['pending', 'in-progress', 'completed'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setField('status', s)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            (editData.status ?? task.status) === s
                              ? s === 'completed'
                                ? 'bg-green-500 text-white'
                                : s === 'in-progress'
                                ? 'bg-blue-500 text-white'
                                : 'bg-zinc-500 text-white'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {s === 'pending' ? '未开始' : s === 'in-progress' ? '进行中' : '已完成'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 优先级 */}
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">优先级</label>
                    <div className="flex gap-2 mt-1">
                      {(['high', 'medium', 'low'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setField('priority', p)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            (editData.priority ?? task.priority) === p
                              ? p === 'high'
                                ? 'bg-red-500 text-white'
                                : p === 'medium'
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-500 text-white'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {p === 'high' ? '🔥 高' : p === 'medium' ? '⭐ 中' : '🌱 低'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 标签 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <TagIcon size={12} /> 标签
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewTagForm(true)}
                        className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 flex items-center gap-1"
                      >
                        <Plus size={12} /> 新建标签
                      </button>
                    </div>
                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl max-h-48 overflow-y-auto p-2">
                      {buildTagTree().length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-4">暂无标签，点击"新建标签"创建</p>
                      ) : (
                        buildTagTree().map(tag => renderTagOption({ ...tag, level: 0 }))
                      )}
                    </div>
                  </div>

                </div>

                {/* 分隔线 */}
                <div className="hidden md:block w-px bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
                {/* ===== 右栏：事件时间线 ===== */}
                <div className="flex-1 flex flex-col min-h-0">
                  {(() => {
                    const taskEvents = getEventsByTask(task.id);
                    return (
                      <>
                        {/* 固定头部：不参与滚动 */}
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-1">
                            📅 事件
                            <span className="text-xs text-zinc-400 font-normal">({taskEvents.length})</span>
                            {taskEvents.filter(e => e.type === 'completion').length > 0 && (
                              <span className="text-xs text-zinc-400 font-normal">
                                · 完成 {taskEvents.filter(e => e.completed).length}/{taskEvents.filter(e => e.type === 'completion').length}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCreateEvent(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-all"
                          >
                            <Plus size={12} /> 添加事件
                          </button>
                        </div>
                        {/* 滚动区域：事件列表，日期标题可置顶 */}
                        <div className="flex-1 overflow-y-auto [overscroll-behavior:contain] min-h-0">
                          {taskEvents.length > 0 ? (
                            <EventTimeline
                              events={taskEvents}
                              tasks={tasks}
                              onToggleComplete={(id) => toggleEventComplete(id)}
                              onEditEvent={(evt) => setEditEvent(evt)}
                            onDeleteEvent={(id) => { if (confirm('删除此事件？')) deleteEvent(id); }}
                            onReorder={(orderedIds) => reorderEvents(task.id, orderedIds)}
                          />
                        ) : (
                          <div className="text-center py-12 text-zinc-400 text-sm">
                            暂无事件
                          </div>
                        )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      <CreateTagModal
        isOpen={showNewTagForm}
        onClose={() => setShowNewTagForm(false)}
        onCreate={(newTag) => {
          addTag(newTag);
          setField('tags', [...currentTags, newTag.id]);
        }}
        animated={false}
      />

      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        onCreate={(eventData) => {
          const now = new Date().toISOString();
          addEvent({
            id: crypto.randomUUID(),
            ...eventData,
            createdAt: now,
            timestamp: now,
            userId: 'local',
          });
          setShowCreateEvent(false);
        }}
        defaultType="note"
        initialTaskId={task.id}
      />

      {/* 编辑事件弹窗 */}
      <CreateEventModal
        isOpen={editEvent !== null}
        onClose={() => setEditEvent(null)}
        onCreate={() => {}}
        onUpdate={(id, updates) => {
          updateEvent(id, updates);
          setEditEvent(null);
        }}
        mode="edit"
        editEvent={editEvent}
      />
    </AnimatePresence>
  );
}
