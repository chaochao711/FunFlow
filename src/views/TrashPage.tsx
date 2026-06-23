// src/views/TrashPage.tsx — 回收站视图（支持云端 7 天兜底）

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Calendar, Archive, ArrowLeft, Cloud, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { loadTrashFromCloud } from '../services/syncService';
import { useTaskStore } from '../store/useTaskStore';
import { getTagDisplay, getTagColorClass } from '../utils/tagUtils';
import AppHeader from '../components/AppHeader';
import Sidebar from '../components/Sidebar';
import TaskDetailDrawer from '../components/TaskDetailDrawer';

const TRASH_RETENTION_DAYS = 7;

interface TrashPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

/** 计算剩余保留天数 */
function getRemainingDays(deletedAt: string): number {
  const deleted = new Date(deletedAt);
  const expireAt = new Date(deleted);
  expireAt.setDate(expireAt.getDate() + TRASH_RETENTION_DAYS);
  const remaining = Math.ceil((expireAt.getTime() - Date.now()) / 86400000);
  return Math.max(0, remaining);
}

export default function TrashPage({ isDark, onToggleTheme }: TrashPageProps) {
  const {
    tasks,
    tags,
    sidebarOpen,
    toggleSidebar,
    selectedTaskId,
    setSelectedTask,
    setShowArchived,
    restoreTask,
    mergeTrashTasks,
  } = useTaskStore();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const trashedTasks = tasks.filter(t => t.deleted);

  // 挂载时从云端拉取回收站任务（7 天内删除的兜底）
  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoadingCloud(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const cloudTrash = await loadTrashFromCloud(user.id);
        if (!cancelled && cloudTrash.length > 0) {
          mergeTrashTasks(cloudTrash);
        }
      } catch (err) {
        console.warn('拉取云端回收站失败:', err);
      } finally {
        if (!cancelled) setLoadingCloud(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  const handleRestoreFromTrash = (taskId: string) => {
    restoreTask(taskId);
  };

  const handleArchiveClick = () => {
    setShowArchived(true);
  };

  const handleBackToMain = () => {
    useTaskStore.getState().setShowTrash(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 transition-colors duration-300">
      <AppHeader isDark={isDark} onToggleTheme={onToggleTheme} onToggleSidebar={toggleSidebar} />

      <div className="flex">
        <Sidebar
          selectedTags={selectedTags}
          onTagToggle={(tagId) => setSelectedTags(prev =>
            prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
          )}
          onClearTags={() => setSelectedTags([])}
        />

        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {/* 回收站头部 */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToMain}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400" />
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🗑️</span>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">回收站</h2>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleArchiveClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                  >
                    <Archive size={16} />
                    返回归档
                  </button>

                  <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {loadingCloud ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Cloud size={14} />
                    )}
                    回收站: {trashedTasks.length}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  🗑️ 删除的任务在云端保留 {TRASH_RETENTION_DAYS} 天，到期后自动彻底删除。
                  打开回收站时会自动从云端拉回近期删除的任务。
                </p>
              </div>
            </div>

            {/* 回收站任务列表 */}
            {trashedTasks.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4 opacity-30">🗑️</div>
                <p className="text-zinc-400 dark:text-zinc-500">回收站为空</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {trashedTasks.map(task => {
                    const taskTags = (task.tags || []).map(tagId => tags.find(t => t.id === tagId)).filter(Boolean);
                    const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0];
                    const remaining = task.deletedAt ? getRemainingDays(task.deletedAt) : TRASH_RETENTION_DAYS;
                    const isExpiringSoon = remaining <= 2;

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-all opacity-80"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-zinc-900 dark:text-white line-through decoration-zinc-400">
                                {task.title}
                              </h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                已删除
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                isExpiringSoon
                                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}>
                                {remaining === 0 ? '即将清理' : `剩余 ${remaining} 天`}
                              </span>
                            </div>

                            {task.description && (
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center gap-3 mt-3 flex-wrap">
                              {taskTags.map(tag => tag && (
                                <span
                                  key={tag.id}
                                  className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getTagColorClass(tag)}`}
                                >
                                  {getTagDisplay(tag)} {tag.name}
                                </span>
                              ))}

                              {task.dueDate && (
                                <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                  <Calendar size={12} />
                                  <span>{task.dueDate}</span>
                                </div>
                              )}

                              {task.deletedAt && (
                                <div className="flex items-center gap-1 text-xs text-zinc-400">
                                  删除时间: {new Date(task.deletedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 仅保留恢复按钮 */}
                          <button
                            onClick={() => handleRestoreFromTrash(task.id)}
                            className="p-2 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            title="恢复到归档"
                          >
                            <RotateCcw size={18} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </main>
      </div>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTask(null)}
        tags={tags}
      />
    </div>
  );
}
