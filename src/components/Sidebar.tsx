// src/components/Sidebar.tsx

import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  ChevronRight as ChevronRightIcon,
  Plus,
  X,
  Palette,
  Sparkles,
  GripVertical,
  FolderPlus,
  FilePlus,
  Edit2,
  AlertTriangle
} from 'lucide-react';
import { useTaskStore, Tag } from '../store/useTaskStore';
import { motion, AnimatePresence } from 'framer-motion';

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

interface SidebarProps {
  selectedTags: string[];
  onTagToggle: (tagId: string) => void;
  onClearTags: () => void;
}

interface TagWithChildren extends Tag {
  children: TagWithChildren[];
  isExpanded?: boolean;
}

export default function Sidebar({ selectedTags, onTagToggle, onClearTags }: SidebarProps) {
  const { tasks, tags, sidebarOpen, toggleSidebar, addTag, updateTag, deleteTag, moveTag } = useTaskStore();
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [showAddTag, setShowAddTag] = useState(false);
  const [showEditTag, setShowEditTag] = useState<{ id: string; name: string; type: 'emoji' | 'color'; emoji?: string; color?: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string; taskCount: number; subTagCount: number } | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState<'emoji' | 'color'>('emoji');
  const [newTagEmoji, setNewTagEmoji] = useState('📁');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [newTagParentId, setNewTagParentId] = useState<string | null>(null);
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  // 构建标签树
  const buildTagTree = (parentId: string | null = null): TagWithChildren[] => {
    return tags
      .filter(tag => tag.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(tag => ({
        ...tag,
        children: buildTagTree(tag.id),
        isExpanded: expandedTags.has(tag.id)
      }));
  };

  const tagTree = buildTagTree();

  const toggleExpand = (tagId: string) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(tagId)) {
      newExpanded.delete(tagId);
    } else {
      newExpanded.add(tagId);
    }
    setExpandedTags(newExpanded);
  };

  // 获取标签关联的任务数量
  const getTagTaskCount = (tagId: string): number => {
    return tasks.filter(task => task.tags?.includes(tagId)).length;
  };

  // 获取标签的子标签数量
  const getSubTagCount = (tagId: string): number => {
    return tags.filter(t => t.parentId === tagId).length;
  };

  // 删除标签（包含确认对话框）
  const handleDeleteTag = (tagId: string, tagName: string) => {
    const taskCount = getTagTaskCount(tagId);
    const subTagCount = getSubTagCount(tagId);
    setShowDeleteConfirm({ id: tagId, name: tagName, taskCount, subTagCount });
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteTag(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
    }
  };

  // 重命名标签
  const handleEditTag = (tag: Tag) => {
    setShowEditTag({
      id: tag.id,
      name: tag.name,
      type: tag.colorType,
      emoji: tag.emoji,
      color: tag.color,
    });
    setNewTagName(tag.name);
    setNewTagType(tag.colorType);
    setNewTagEmoji(tag.emoji || '📁');
    setNewTagColor(tag.color || 'blue');
  };

  const confirmEdit = () => {
    if (showEditTag && newTagName.trim()) {
      updateTag(showEditTag.id, {
        name: newTagName.trim(),
        colorType: newTagType,
        emoji: newTagType === 'emoji' ? newTagEmoji : undefined,
        color: newTagType === 'color' ? newTagColor : undefined,
      });
      setShowEditTag(null);
      setNewTagName('');
    }
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    
    const parentTag = tags.find(t => t.id === newTagParentId);
    const level = parentTag ? parentTag.level + 1 : 0;
    const siblings = tags.filter(t => t.parentId === newTagParentId);
    
    const newTag: Tag = {
      id: Date.now().toString(),
      name: newTagName.trim(),
      parentId: newTagParentId,
      colorType: newTagType,
      emoji: newTagType === 'emoji' ? newTagEmoji : undefined,
      color: newTagType === 'color' ? newTagColor : undefined,
      level,
      order: siblings.length,
    };
    
    addTag(newTag);
    
    if (newTagParentId) {
      const newExpanded = new Set(expandedTags);
      newExpanded.add(newTagParentId);
      setExpandedTags(newExpanded);
    }
    
    setNewTagName('');
    setNewTagParentId(null);
    setShowAddTag(false);
  };

  const handleAddSibling = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      setNewTagParentId(tag.parentId);
      setShowAddTag(true);
    }
  };

  const handleAddChild = (tagId: string) => {
    setNewTagParentId(tagId);
    setShowAddTag(true);
    const newExpanded = new Set(expandedTags);
    newExpanded.add(tagId);
    setExpandedTags(newExpanded);
  };

  // ========== 拖拽排序函数（已修复拖到自己消失的问题） ==========
  const handleDragStart = (e: React.DragEvent, tagId: string) => {
    e.dataTransfer.setData('text/plain', tagId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, tagId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const dragId = e.dataTransfer.getData('text/plain');
    // 阻止拖拽到自己
    if (dragId === tagId) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseY = e.clientY;
    const relativeY = mouseY - rect.top;
    const height = rect.height;
    
    if (relativeY < height * 0.25) {
      setDropPosition('before');
      setDragOverTagId(tagId);
    } else if (relativeY > height * 0.75) {
      setDropPosition('after');
      setDragOverTagId(tagId);
    } else {
      setDropPosition('inside');
      setDragOverTagId(tagId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTagId(null);
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain');
    // 阻止拖拽到自己
    if (dragId === targetId) {
      setDragOverTagId(null);
      setDropPosition(null);
      return;
    }
    if (dragId && dropPosition) {
      moveTag(dragId, targetId, dropPosition);
    }
    setDragOverTagId(null);
    setDropPosition(null);
  };

  const getDropIndicatorClass = (tagId: string, position: 'before' | 'after' | 'inside') => {
    if (dragOverTagId !== tagId || dropPosition !== position) return '';
    if (position === 'before') return 'border-t-2 border-violet-500';
    if (position === 'after') return 'border-b-2 border-violet-500';
    return 'bg-violet-100/50 dark:bg-violet-900/30 ring-2 ring-violet-500';
  };

  const renderTagItem = (tag: TagWithChildren, level: number = 0) => {
    const isSelected = selectedTags.includes(tag.id);
    const hasChildren = tag.children.length > 0;
    const isExpanded = tag.isExpanded;
    const taskCount = getTagTaskCount(tag.id);
    
    return (
      <div key={tag.id}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, tag.id)}
          onDragOver={(e) => handleDragOver(e, tag.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tag.id)}
          className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-move transition-all ${
            getDropIndicatorClass(tag.id, 'before')
          } ${getDropIndicatorClass(tag.id, 'after')} ${getDropIndicatorClass(tag.id, 'inside')} ${
            isSelected
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
          style={{ marginLeft: level * 16 }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={12} className="text-zinc-400" />
            </div>
            
            {hasChildren && (
              <button
                onClick={() => toggleExpand(tag.id)}
                className="flex-shrink-0 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRightIcon size={12} />}
              </button>
            )}
            {!hasChildren && <div className="w-4" />}
            
            <button
              onClick={() => onTagToggle(tag.id)}
              className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
            >
              {tag.colorType === 'emoji' ? (
                <span className="text-base">{tag.emoji}</span>
              ) : (
                <div className={`w-2.5 h-2.5 rounded-full ${colorOptions.find(c => c.name === tag.color)?.class}`} />
              )}
              <span className="text-sm truncate">{tag.name}</span>
              {taskCount > 0 && (
                <span className="text-xs text-zinc-400 ml-1">({taskCount})</span>
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleEditTag(tag)}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
              title="重命名"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => handleAddSibling(tag.id)}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
              title="添加同级标签"
            >
              <FilePlus size={12} />
            </button>
            <button
              onClick={() => handleAddChild(tag.id)}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
              title="添加子标签"
            >
              <FolderPlus size={12} />
            </button>
            <button
              onClick={() => handleDeleteTag(tag.id, tag.name)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 rounded transition-colors"
              title="删除标签"
            >
              <X size={12} />
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {tag.children.map(child => renderTagItem(child, level + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ========== 桌面端侧边栏 ==========
  if (!sidebarOpen) {
    return (
      <div className="fixed left-0 top-14 bottom-0 w-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 z-20">
        <button onClick={toggleSidebar} className="w-full p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <ChevronRight size={20} className="text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-0 top-14 bottom-0 w-72 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 z-20 overflow-y-auto">
      <div className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐟</span>
          <span className="font-bold text-lg text-zinc-900 dark:text-white">FunFlow</span>
        </div>
        <button onClick={toggleSidebar} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
          <ChevronLeft size={18} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">标签筛选</h3>
          <div className="flex gap-1">
            {selectedTags.length > 0 && (
              <button
                onClick={onClearTags}
                className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20"
              >
                清除
              </button>
            )}
            <button
              onClick={() => {
                setNewTagParentId(null);
                setShowAddTag(true);
              }}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              title="新建顶级标签"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-0.5">
          {tagTree.map(tag => renderTagItem(tag, 0))}
        </div>

        {tags.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-8">暂无标签，点击 + 创建</p>
        )}
      </div>

      {/* 新建标签弹窗 */}
      {showAddTag && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddTag(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 text-zinc-900 dark:text-white">
              {newTagParentId ? '新建子标签' : '新建标签'}
            </h3>
            
            <input
              type="text"
              placeholder="标签名称"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
            />

            {!newTagParentId && tags.length > 0 && (
              <select
                value={newTagParentId || ''}
                onChange={(e) => setNewTagParentId(e.target.value || null)}
                className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="">顶级标签</option>
                {tags.filter(t => t.level < 2).map(tag => (
                  <option key={tag.id} value={tag.id}>
                    {'  '.repeat(tag.level)}{tag.colorType === 'emoji' ? tag.emoji : '📌'} {tag.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setNewTagType('emoji')}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  newTagType === 'emoji' 
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' 
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                }`}
              >
                <Sparkles size={16} /> Emoji
              </button>
              <button
                type="button"
                onClick={() => setNewTagType('color')}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  newTagType === 'color' 
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' 
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                }`}
              >
                <Palette size={16} /> 颜色
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
                      className={`text-xl p-2 rounded-lg transition-all flex items-center justify-center ${
                        newTagEmoji === emoji 
                          ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-500' 
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                      style={{ width: '40px', height: '40px' }}
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
              <button onClick={() => setShowAddTag(false)} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                取消
              </button>
              <button
                onClick={handleAddTag}
                className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium"
              >
                创建标签
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重命名标签弹窗 */}
      {showEditTag && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowEditTag(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 text-zinc-900 dark:text-white">重命名标签</h3>
            
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
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  newTagType === 'emoji' 
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' 
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                }`}
              >
                <Sparkles size={16} /> Emoji
              </button>
              <button
                type="button"
                onClick={() => setNewTagType('color')}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  newTagType === 'color' 
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' 
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                }`}
              >
                <Palette size={16} /> 颜色
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
                      className={`text-xl p-2 rounded-lg transition-all flex items-center justify-center ${
                        newTagEmoji === emoji 
                          ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-500' 
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                      style={{ width: '40px', height: '40px' }}
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
              <button onClick={() => setShowEditTag(null)} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                取消
              </button>
              <button
                onClick={confirmEdit}
                className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">删除标签</h3>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              确定要删除标签 <span className="font-medium text-zinc-900 dark:text-white">"{showDeleteConfirm.name}"</span> 吗？
            </p>
            
            {showDeleteConfirm.taskCount > 0 && (
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  ⚠️ 当前有 <strong>{showDeleteConfirm.taskCount}</strong> 个任务使用了此标签，
                  删除后这些任务的标签也会被移除。
                </p>
              </div>
            )}
            
            {showDeleteConfirm.subTagCount > 0 && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  📁 此标签下还有 <strong>{showDeleteConfirm.subTagCount}</strong> 个子标签，将会一并删除。
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}