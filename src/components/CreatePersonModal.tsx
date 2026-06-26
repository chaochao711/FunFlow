// src/components/CreatePersonModal.tsx — 人员创建/编辑弹窗

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore, Person } from '../store/useTaskStore';

interface CreatePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (person: Person) => void;
  parentPeople?: Person[];
  initialParentId?: string | null;
  mode?: 'create' | 'edit';
  initialData?: Person;
}

export default function CreatePersonModal({
  isOpen,
  onClose,
  onCreate,
  parentPeople,
  initialParentId = null,
  mode = 'create',
  initialData,
}: CreatePersonModalProps) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setName(initialData.name);
        setNickname(initialData.nickname || '');
        setEmail(initialData.email || '');
      } else {
        setName('');
        setNickname('');
        setEmail('');
      }
      setParentId(initialParentId);
    }
  }, [isOpen, mode, initialData, initialParentId]);

  const handleCreate = () => {
    if (!name.trim() && !nickname.trim()) return;

    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      email: email.trim() || undefined,
      parentId,
      level: 0,
      order: parentPeople ? parentPeople.filter(p => p.parentId === parentId).length : 0,
      autoCreated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreate(newPerson);
    onClose();
  };

  const title = mode === 'edit' ? '编辑人员' : '新建人员';
  const confirmText = mode === 'edit' ? '保存' : '创建人员';

  const modalContent = (
    <div
      className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <h3 className="font-bold text-lg mb-4 text-zinc-900 dark:text-white">{title}</h3>

      {/* 本名 */}
      <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">本名</label>
      <input
        type="text"
        placeholder="张三"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        autoFocus
      />

      {/* 互换按钮 */}
      <div className="flex justify-center my-1.5">
        <button
          type="button"
          onClick={() => {
            const tmp = name;
            setName(nickname);
            setNickname(tmp);
          }}
          className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-violet-500 transition-all active:scale-90"
          title="互换本名和花名"
        >
          <span className="text-lg leading-none">↑↓</span>
        </button>
      </div>

      {/* 花名 */}
      <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">花名 / 昵称</label>
      <input
        type="text"
        placeholder="小张"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      />

      {/* 邮箱 */}
      <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">邮箱</label>
      <input
        type="email"
        placeholder="zhangsan@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      />

      {/* 父节点选择 */}
      {!initialParentId && parentPeople && parentPeople.length > 0 && (
        <select
          value={parentId || ''}
          onChange={(e) => setParentId(e.target.value || null)}
          className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        >
          <option value="">顶级节点</option>
          {parentPeople.filter(p => p.level < 2).map(p => (
            <option key={p.id} value={p.id}>
              {'  '.repeat(p.level)}{p.nickname ? `${p.name}（${p.nickname}）` : p.name}
            </option>
          ))}
        </select>
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
          {confirmText}
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
        </>
      )}
    </AnimatePresence>
  );
}
