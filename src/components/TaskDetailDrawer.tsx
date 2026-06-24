// src/components/TaskDetailDrawer.tsx — 任务详情抽屉（直接编辑、退出自动保存）

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, RotateCcw, Tag as TagIcon, Calendar, Plus } from 'lucide-react';
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
  const { tasks, updateTask, addHistory, restoreVersion, addTag } = useTaskStore();
  const { events, addEvent, updateEvent, deleteEvent, toggleEventComplete, getEventsByTask, reorderEvents } = useEventStore();
  const task = tasks.find(t => t.id === taskId);
  const [editData, setEditData] = useState<Partial<Task>>({});
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<TaskEvent | null>(null);

  // 切换任务时重置编辑状态
  useEffect(() => {
    setEditData({});
    setShowHistory(false);
  }, [taskId]);

  if (!task) return null;

  const currentTags = editData.tags !== undefined ? editData.tags : task.tags;

  // 自动保存：将所有 editData 中的变更写入 store
  const autoSave = () => {
    const changes: Partial<Task> = {};
    Object.entries(editData).forEach(([key, value]) => {
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(task[key as keyof Task])) {
        changes[key as keyof Task] = value as any;
        addHistory(task.id, key, task[key as keyof Task], value);
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
          <div className="fixed inset-0 bg-black/50 z-50" onClick={handleClose} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">任务详情</h2>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showHistory
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400'
                  }`}
                  title="编辑历史"
                >
                  <Clock size={16} />
                </button>
              </div>
              <button onClick={handleClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 标题 — 直接编辑 */}
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">标题</label>
                <input
                  type="text"
                  defaultValue={task.title}
                  onChange={(e) => setField('title', e.target.value)}
                  className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* 描述 — 直接编辑 */}
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

              {/* 截止日期 — 直接编辑 */}
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

              {/* 标签 — 直接编辑 */}
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

              {/* 事件时间线（混合排序，支持拖拽） */}
              {(() => {
                const taskEvents = getEventsByTask(task.id);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        📅 事件 ({taskEvents.length})
                        {taskEvents.filter(e => e.type === 'completion').length > 0 && (
                          <span className="text-zinc-400 font-normal">
                            · 完成 {taskEvents.filter(e => e.completed).length}/{taskEvents.filter(e => e.type === 'completion').length}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCreateEvent(true)}
                        className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 flex items-center gap-1"
                      >
                        <Plus size={12} /> 添加
                      </button>
                    </div>
                    {taskEvents.length > 0 && (
                      <EventTimeline
                        events={taskEvents}
                        tasks={tasks}
                        onToggleComplete={(id) => toggleEventComplete(id)}
                        onEditEvent={(evt) => setEditEvent(evt)}
                        onDeleteEvent={(id) => { if (confirm('删除此事件？')) deleteEvent(id); }}
                        onReorder={(orderedIds) => reorderEvents(task.id, orderedIds)}
                      />
                    )}
                  </div>
                );
              })()}

              {/* 编辑历史（可折叠） */}
              {showHistory && (
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <Clock size={12} className="text-zinc-400" />
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">编辑历史</label>
                  </div>
                  <div className="space-y-2">
                    {task.history.length === 0 ? (
                      <p className="text-sm text-zinc-400">暂无编辑记录</p>
                    ) : (
                      task.history.slice(0, 10).map(record => (
                        <div key={record.id} className="text-sm p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="text-zinc-600 dark:text-zinc-300">
                                修改了 {record.field}:
                              </span>
                              <span className="text-zinc-400 line-through ml-1">{String(record.oldValue) || '空'}</span>
                              <span className="text-zinc-600 mx-1">→</span>
                              <span className="text-zinc-700 dark:text-zinc-200">{String(record.newValue) || '空'}</span>
                            </div>
                            <button
                              onClick={() => {
                                if (confirm('恢复到此版本？')) {
                                  restoreVersion(task.id, record.id);
                                }
                              }}
                              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                              title="恢复到此版本"
                            >
                              <RotateCcw size={12} className="text-violet-500" />
                            </button>
                          </div>
                          <div className="text-xs text-zinc-400 mt-1">
                            {new Date(record.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
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
            id: Date.now().toString(),
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
