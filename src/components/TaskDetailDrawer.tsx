// src/components/TaskDetailDrawer.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, RotateCcw, Edit2, Save, Tag as TagIcon, Calendar, Plus } from 'lucide-react';
import { useTaskStore, Task, Tag } from '../store/useTaskStore';

const colorOptions = [
  { name: 'red', class: 'bg-red-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'amber', class: 'bg-amber-500' },
  { name: 'yellow', class: 'bg-yellow-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'emerald', class: 'bg-emerald-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'indigo', class: 'bg-indigo-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'pink', class: 'bg-pink-500' },
];

const emojiOptions = ['📁', '💼', '🏠', '📚', '💪', '🎨', '💻', '📅', '⚡', '🎯', '🌟', '❤️'];

function getTagDisplay(tag: Tag): string {
  if (tag.colorType === 'emoji') {
    return tag.emoji || '📌';
  }
  return '●';
}

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
  tags: Tag[];
}

export default function TaskDetailDrawer({ taskId, onClose, tags }: TaskDetailDrawerProps) {
  const { tasks, updateTask, addHistory, restoreVersion, addTag } = useTaskStore();
  const task = tasks.find(t => t.id === taskId);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Task>>({});
  
  // 新建标签状态
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState<'emoji' | 'color'>('emoji');
  const [newTagEmoji, setNewTagEmoji] = useState('📁');
  const [newTagColor, setNewTagColor] = useState('blue');

  if (!task) return null;

  const handleSave = () => {
    Object.entries(editData).forEach(([key, value]) => {
      if (value !== undefined && value !== task[key as keyof Task]) {
        updateTask(task.id, { [key]: value });
        addHistory(task.id, key, task[key as keyof Task], value);
      }
    });
    setIsEditing(false);
    setEditData({});
  };

  const handleRestore = (historyId: string) => {
    if (confirm('恢复到此版本？')) {
      restoreVersion(task.id, historyId);
    }
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag: Tag = {
      id: Date.now().toString(),
      name: newTagName.trim(),
      parentId: null,
      colorType: newTagType,
      emoji: newTagType === 'emoji' ? newTagEmoji : undefined,
      color: newTagType === 'color' ? newTagColor : undefined,
      level: 0,
      order: tags.length,
    };
    
    addTag(newTag);
    if (isEditing) {
      setEditData({
        ...editData,
        tags: [...(editData.tags || task.tags || []), newTag.id]
      });
    } else {
      updateTask(task.id, { tags: [...(task.tags || []), newTag.id] });
    }
    setShowNewTagForm(false);
    setNewTagName('');
    setNewTagType('emoji');
    setNewTagEmoji('📁');
    setNewTagColor('blue');
  };

  const buildTagTree = (parentId: string | null = null, level: number = 0): Tag[] => {
    return tags
      .filter(tag => tag.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(tag => ({ ...tag, level }));
  };

  const renderTagOption = (tag: Tag & { level: number }) => {
    const children = buildTagTree(tag.id, tag.level + 1);
    const currentTags = isEditing ? (editData.tags !== undefined ? editData.tags : task.tags) : task.tags;
    const isSelected = (currentTags || []).includes(tag.id);
    
    return (
      <div key={tag.id}>
        <button
          type="button"
          onClick={() => {
            if (isEditing) {
              const newTags = isSelected
                ? (currentTags || []).filter(t => t !== tag.id)
                : [...(currentTags || []), tag.id];
              setEditData({ ...editData, tags: newTags });
            } else {
              const newTags = isSelected
                ? (task.tags || []).filter(t => t !== tag.id)
                : [...(task.tags || []), tag.id];
              updateTask(task.id, { tags: newTags });
              addHistory(task.id, 'tags', task.tags || [], newTags);
            }
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
          <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
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
                  onClick={() => {
                    if (isEditing) {
                      handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {isEditing ? <Save size={16} /> : <Edit2 size={16} />}
                </button>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 标题 */}
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">标题</label>
                {isEditing ? (
                  <input
                    type="text"
                    defaultValue={task.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                ) : (
                  <p className="text-lg font-medium text-zinc-900 dark:text-white mt-1">{task.title}</p>
                )}
              </div>

              {/* 描述 */}
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">描述</label>
                {isEditing ? (
                  <textarea
                    defaultValue={task.description}
                    rows={4}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
                  />
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                    {task.description || '无描述'}
                  </p>
                )}
              </div>

              {/* 截止日期 */}
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Calendar size={12} /> 截止日期
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    defaultValue={task.dueDate}
                    onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                    className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{task.dueDate || '未设置'}</p>
                )}
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

              {/* 历史记录 */}
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-2">
                  <Clock size={12} /> 编辑历史
                </label>
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
                            onClick={() => handleRestore(record.id)}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
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
            </div>
          </motion.div>
        </>
      )}

      {/* 新建标签弹窗 */}
      {showNewTagForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setShowNewTagForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 text-zinc-900 dark:text-white">新建标签</h3>
            
            <input
              type="text"
              placeholder="标签名称"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
            />

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setNewTagType('emoji')}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 ${
                  newTagType === 'emoji' 
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' 
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                }`}
              >
                😊 Emoji
              </button>
              <button
                type="button"
                onClick={() => setNewTagType('color')}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 ${
                  newTagType === 'color' 
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' 
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                }`}
              >
                🎨 颜色
              </button>
            </div>

            {newTagType === 'emoji' ? (
              <div className="mb-4">
                <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">选择图标</label>
                <div className="grid grid-cols-6 gap-2">
                  {emojiOptions.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewTagEmoji(emoji)}
                      className={`text-2xl p-2 rounded-lg transition-all ${
                        newTagEmoji === emoji ? 'bg-violet-100 dark:bg-violet-900/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">选择颜色</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(color => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setNewTagColor(color.name)}
                      className={`w-8 h-8 rounded-full ${color.class} ${
                        newTagColor === color.name ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-900' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowNewTagForm(false)} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                取消
              </button>
              <button
                onClick={handleCreateTag}
                className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium"
              >
                创建标签
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}