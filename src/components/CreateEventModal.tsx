// src/components/CreateEventModal.tsx — 新建/编辑事件弹窗（时间 = 创建时间，仅完成节点可选完成时间）

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Lightbulb, StickyNote, Flag } from 'lucide-react';
import { TaskEvent } from '../store/useEventStore';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (event: Omit<TaskEvent, 'id' | 'createdAt' | 'userId'>) => void;
  onUpdate?: (id: string, updates: Partial<TaskEvent>) => void;
  defaultType?: TaskEvent['type'];
  initialTaskId?: string;
  taskOptions?: { id: string; title: string }[];
  /** 编辑模式 */
  mode?: 'create' | 'edit';
  editEvent?: TaskEvent | null;
}

const typeOptions: { type: TaskEvent['type']; icon: React.ReactNode; label: string }[] = [
  { type: 'completion', icon: <CheckCircle size={16} />, label: '完成节点' },
  { type: 'idea', icon: <Lightbulb size={16} />, label: '想法' },
  { type: 'note', icon: <StickyNote size={16} />, label: '备注' },
  { type: 'milestone', icon: <Flag size={16} />, label: '里程碑' },
];

export default function CreateEventModal({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  defaultType = 'note',
  initialTaskId,
  taskOptions,
  mode = 'create',
  editEvent,
}: CreateEventModalProps) {
  const [type, setType] = useState<TaskEvent['type']>(defaultType);
  const [content, setContent] = useState('');
  const [taskId, setTaskId] = useState(initialTaskId || '');
  const [estimatedTime, setEstimatedTime] = useState('');

  const isEdit = mode === 'edit' && editEvent;

  useEffect(() => {
    if (isOpen) {
      if (isEdit && editEvent) {
        setType(editEvent.type);
        setContent(editEvent.content);
        setTaskId(editEvent.taskId);
        setEstimatedTime(editEvent.estimatedTime || '');
      } else {
        setType(defaultType);
        setContent('');
        setTaskId(initialTaskId || '');
        setEstimatedTime('');
      }
    }
  }, [isOpen, isEdit, editEvent, defaultType, initialTaskId]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    if (!taskId) return;

    if (isEdit && editEvent && onUpdate) {
      onUpdate(editEvent.id, {
        type,
        content: content.trim(),
        estimatedTime: type === 'completion' ? (estimatedTime.trim() || undefined) : undefined,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onCreate({
        taskId,
        type,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        estimatedTime: type === 'completion' ? (estimatedTime.trim() || undefined) : undefined,
        updatedAt: new Date().toISOString(),
        order: 0,
      });
    }

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                  {isEdit ? '编辑事件' : defaultType === 'completion' ? '新建完成节点' : '新建事件'}
                </h3>
                <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              {/* 关联任务（仅创建模式 + 无预填 taskId 时） */}
              {!isEdit && !initialTaskId && taskOptions && taskOptions.length > 0 && (
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                >
                  <option value="">选择关联任务</option>
                  {taskOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              )}

              {/* 类型选择（带图标） */}
              <div className="flex gap-2 mb-4">
                {typeOptions.map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => setType(opt.type)}
                    className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 transition-all text-xs ${
                      type === opt.type
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 ring-2 ring-violet-500'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* 内容 */}
              <textarea
                placeholder={type === 'completion' ? '完成节点描述...' : '事件内容...'}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                autoFocus
              />

              {/* completion 类型：预计完成时间（仅完成节点可选） */}
              {type === 'completion' && (
                <div className="mb-4">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">⏱️ 预计完成时间（可选）</label>
                  <input
                    type="datetime-local"
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(e.target.value)}
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                  />
                </div>
              )}

              {/* 提示：非 completion 类型时间 = 创建时间 */}
              {type !== 'completion' && !isEdit && (
                <p className="text-xs text-zinc-400 mb-4">事件时间以创建时间为准</p>
              )}

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || !taskId}
                  className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isEdit ? '保存' : type === 'completion' ? '创建完成节点' : '创建事件'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
