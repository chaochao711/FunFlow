// src/views/TrashPage.tsx — 回收站视图

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RotateCcw, Calendar, Archive, ArrowLeft } from 'lucide-react';
import { useTaskStore } from '../store/useTaskStore';
import { getTagDisplay, getTagColorClass } from '../utils/tagUtils';
import AppHeader from '../components/AppHeader';
import Sidebar from '../components/Sidebar';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import ConfirmDialog from '../components/ConfirmDialog';

interface TrashPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
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
    permanentDeleteTask,
    emptyTrash,
  } = useTaskStore();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const trashedTasks = tasks.filter(t => t.deleted);
  const archivedTasks = tasks.filter(t => t.archived && !t.deleted);

  const handleRestoreFromTrash = (taskId: string) => {
    restoreTask(taskId);
  };

  const handlePermanentDelete = (taskId: string) => {
    permanentDeleteTask(taskId);
    setShowDeleteConfirm(null);
  };

  const handleEmptyTrash = () => {
    emptyTrash();
    setShowEmptyConfirm(false);
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
                    <Trash2 size={24} className="text-red-500" />
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

                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    回收站: {trashedTasks.length}
                  </div>

                  {trashedTasks.length > 0 && (
                    <button
                      onClick={() => setShowEmptyConfirm(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                      清空回收站
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  🗑️ 回收站说明：删除的任务会移到这里，您可以选择恢复或彻底删除。
                  彻底删除后无法恢复。回收站中的任务不计入任何统计。
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

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRestoreFromTrash(task.id)}
                              className="p-2 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                              title="恢复到归档"
                            >
                              <RotateCcw size={18} />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(task.id)}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                              title="彻底删除"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
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

      <ConfirmDialog
        isOpen={showEmptyConfirm}
        onClose={() => setShowEmptyConfirm(false)}
        onConfirm={handleEmptyTrash}
        title="清空回收站"
        message="确定要清空回收站吗？此操作将永久删除所有任务，无法恢复。"
        confirmText="确认清空"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => handlePermanentDelete(showDeleteConfirm!)}
        title="彻底删除"
        message="确定要彻底删除这个任务吗？此操作无法撤销。"
        confirmText="确认删除"
      />
    </div>
  );
}
