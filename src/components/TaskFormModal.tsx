// src/components/TaskFormModal.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Flag, Tag as TagIcon, Plus } from 'lucide-react';
import { useTaskStore, Tag } from '../store/useTaskStore';
import { getTagDisplay } from '../utils/tagUtils';
import CreateTagModal from './CreateTagModal';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
}

export default function TaskFormModal({ isOpen, onClose, tags }: TaskFormModalProps) {
  const { addTask, addTag } = useTaskStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [createdBy, setCreatedBy] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // 新建标签状态
  const [showNewTagForm, setShowNewTagForm] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('请输入任务标题');
      return;
    }
    
    addTask({
      id: Date.now().toString(),
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
      priority,
      status: 'pending',
      tags: selectedTags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      deleted: false,
      history: [],
      createdBy: createdBy.trim() || undefined,
      assignedTo: assignedTo.trim() || undefined,
    });

    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('medium');
    setSelectedTags([]);
    setCreatedBy('');
    setAssignedTo('');
    onClose();
  };

  // 构建标签树
  const buildTagTree = (parentId: string | null = null, level: number = 0): Tag[] => {
    return tags
      .filter(tag => tag.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(tag => ({ ...tag, level }));
  };

  const renderTagOption = (tag: Tag & { level: number }) => {
    const children = buildTagTree(tag.id, tag.level + 1);
    const isSelected = selectedTags.includes(tag.id);
    
    return (
      <div key={tag.id}>
        <button
          type="button"
          onClick={() => {
            setSelectedTags(prev =>
              prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
            );
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
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" 
            onClick={onClose} 
          />
          {/* 弹窗容器 - 使用 flex 居中 */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">新建任务</h2>
                <button 
                  onClick={onClose} 
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <input
                  type="text"
                  placeholder="任务标题 *"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />

                <textarea
                  placeholder="描述（可选）"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      <Calendar size={14} /> 截止日期
                    </div>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      <Flag size={14} /> 优先级
                    </div>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    >
                      <option value="low">🌱 低</option>
                      <option value="medium">⭐ 中</option>
                      <option value="high">🔥 高</option>
                    </select>
                  </div>
                </div>

                {/* 发起人 / 作用对象 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      👤 发起人
                    </div>
                    <input
                      type="text"
                      placeholder="发起人"
                      value={createdBy}
                      onChange={(e) => setCreatedBy(e.target.value)}
                      className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      🎯 作用对象
                    </div>
                    <input
                      type="text"
                      placeholder="执行者"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <TagIcon size={14} /> 标签
                    </div>
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

              <div className="flex gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-all"
                >
                  创建任务
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* 新建标签弹窗 */}
      <CreateTagModal
        isOpen={showNewTagForm}
        onClose={() => setShowNewTagForm(false)}
        onCreate={(newTag) => {
          addTag(newTag);
          setSelectedTags([...selectedTags, newTag.id]);
        }}
        animated={true}
      />
    </AnimatePresence>
  );
}