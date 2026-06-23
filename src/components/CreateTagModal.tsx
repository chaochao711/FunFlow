// src/components/CreateTagModal.tsx — 统一的标签创建/编辑弹窗

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Palette } from 'lucide-react';
import { useTaskStore, Tag } from '../store/useTaskStore';
import { COLOR_OPTIONS, EMOJI_OPTIONS } from '../constants/options';

export interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (tag: Tag) => void;
  /** 可选的父标签列表（用于父标签选择器） */
  parentTags?: Tag[];
  /** 预设的父标签 ID */
  initialParentId?: string | null;
  /** 弹窗标题，默认"新建标签" */
  title?: string;
  /** 模式：create 或 edit */
  mode?: 'create' | 'edit';
  /** 编辑模式下的初始数据 */
  initialData?: { name: string; type: 'emoji' | 'color'; emoji?: string; color?: string };
  /** 是否使用动画 */
  animated?: boolean;
  /** 创建按钮文本 */
  confirmText?: string;
}

export default function CreateTagModal({
  isOpen,
  onClose,
  onCreate,
  parentTags,
  initialParentId = null,
  title,
  mode = 'create',
  initialData,
  animated = true,
  confirmText,
}: CreateTagModalProps) {
  const { addTag } = useTaskStore();
  const [tagName, setTagName] = useState('');
  const [tagType, setTagType] = useState<'emoji' | 'color'>('emoji');
  const [tagEmoji, setTagEmoji] = useState('📁');
  const [tagColor, setTagColor] = useState('blue');
  const [parentId, setParentId] = useState<string | null>(null);

  // 初始化/重置表单数据
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setTagName(initialData.name);
        setTagType(initialData.type);
        setTagEmoji(initialData.emoji || '📁');
        setTagColor(initialData.color || 'blue');
      } else {
        setTagName('');
        setTagType('emoji');
        setTagEmoji('📁');
        setTagColor('blue');
      }
      setParentId(initialParentId);
    }
  }, [isOpen, mode, initialData, initialParentId]);

  const handleCreate = () => {
    if (!tagName.trim()) return;

    const newTag: Tag = {
      id: Date.now().toString(),
      name: tagName.trim(),
      parentId,
      colorType: tagType,
      emoji: tagType === 'emoji' ? tagEmoji : undefined,
      color: tagType === 'color' ? tagColor : undefined,
      level: 0, // level 由调用方或 store 计算
      order: parentTags ? parentTags.filter(t => t.parentId === parentId).length : 0,
    };

    onCreate(newTag);
    onClose();
  };

  const displayTitle = title || (mode === 'edit' ? '重命名标签' : '新建标签');
  const displayConfirm = confirmText || (mode === 'edit' ? '保存' : '创建标签');

  const modalContent = (
    <div
      className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <h3 className="font-bold text-lg mb-4 text-zinc-900 dark:text-white">{displayTitle}</h3>

      <input
        type="text"
        placeholder="标签名称"
        value={tagName}
        onChange={(e) => setTagName(e.target.value)}
        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        autoFocus
      />

      {/* 父标签选择器（条件渲染） */}
      {!initialParentId && parentTags && parentTags.length > 0 && (
        <select
          value={parentId || ''}
          onChange={(e) => setParentId(e.target.value || null)}
          className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        >
          <option value="">顶级标签</option>
          {parentTags.filter(t => t.level < 2).map(tag => (
            <option key={tag.id} value={tag.id}>
              {'  '.repeat(tag.level)}{tag.colorType === 'emoji' ? tag.emoji : '📌'} {tag.name}
            </option>
          ))}
        </select>
      )}

      {/* Emoji / Color 切换 */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTagType('emoji')}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
            tagType === 'emoji'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          <Sparkles size={16} /> Emoji
        </button>
        <button
          type="button"
          onClick={() => setTagType('color')}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
            tagType === 'color'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          <Palette size={16} /> 颜色
        </button>
      </div>

      {/* Emoji 选择网格 */}
      {tagType === 'emoji' ? (
        <div className="mb-4">
          <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">选择图标</label>
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setTagEmoji(emoji)}
                className={`text-xl p-2 rounded-lg transition-all flex items-center justify-center ${
                  tagEmoji === emoji
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
        /* 颜色选择 */
        <div className="mb-4">
          <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">选择颜色</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(color => (
              <button
                key={color.name}
                type="button"
                onClick={() => setTagColor(color.name)}
                className={`w-8 h-8 rounded-full ${color.class} ${
                  tagColor === color.name ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-900' : ''
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* 按钮 */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleCreate}
          className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-all"
        >
          {displayConfirm}
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          {animated ? (
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="pointer-events-auto"
              >
                {modalContent}
              </motion.div>
            </div>
          ) : (
            <div className="fixed inset-0 flex items-center justify-center z-50">
              {modalContent}
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
