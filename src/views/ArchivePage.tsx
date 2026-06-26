// src/views/ArchivePage.tsx — 归档视图（按时间桶分组）

import { useState } from 'react';
import { Archive, ArrowLeft, Settings, Trash2 } from 'lucide-react';
import { useTaskStore } from '../store/useTaskStore';
import { groupByTimeBucket, TIME_BUCKET_LABELS, TIME_BUCKET_ORDER } from '../utils/dateUtils';
import AppHeader from '../components/AppHeader';
import Sidebar from '../components/Sidebar';
import TaskCard from '../components/TaskCard';
import TaskDetailDrawer from '../components/TaskDetailDrawer';

interface ArchivePageProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function ArchivePage({ isDark, onToggleTheme }: ArchivePageProps) {
  const {
    tasks,
    tags,
    sidebarOpen,
    toggleSidebar,
    selectedTaskId,
    setSelectedTask,
    setShowTrash,
    archiveSettings,
    updateArchiveSettings,
    unarchiveTask,
    deleteTask,
  } = useTaskStore();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);

  const archivedTasks = tasks.filter(t => t.archived && !t.deleted);
  const trashedTasks = tasks.filter(t => t.deleted);

  const handleRestoreFromArchive = (taskId: string) => {
    unarchiveTask(taskId);
  };

  const handleDeleteFromArchive = (taskId: string) => {
    deleteTask(taskId);
  };

  const handleBackToMain = () => {
    useTaskStore.getState().setShowArchived(false);
  };

  const handleTrashClick = () => {
    setShowTrash(true);
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
          selectedPersons={selectedPersons}
          onPersonToggle={(pid) => setSelectedPersons(prev =>
            prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
          )}
          onClearPersons={() => setSelectedPersons([])}
        />

        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {/* 归档头部 */}
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
                    <Archive size={24} className="text-violet-500" />
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">归档</h2>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleTrashClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 size={16} />
                    回收站 ({trashedTasks.length})
                  </button>

                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    已归档: {archivedTasks.length}
                  </div>

                  <div className="flex items-center gap-2">
                    <Settings size={14} className="text-zinc-400" />
                    <label className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={archiveSettings.enabled}
                        onChange={() => updateArchiveSettings({ enabled: !archiveSettings.enabled })}
                        className="rounded"
                      />
                      自动归档（{archiveSettings.autoArchiveDays}天前完成的任务）
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  📌 归档说明：已完成且超过 {archiveSettings.autoArchiveDays} 天的任务会自动归档。
                  归档的任务不计入总任务统计，可在归档中查看、恢复或删除（移至回收站）。
                </p>
              </div>
            </div>

            {/* 归档任务列表（按时间分组） */}
            {archivedTasks.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4 opacity-30">📦</div>
                <p className="text-zinc-400 dark:text-zinc-500">暂无归档任务</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const groups = groupByTimeBucket(archivedTasks, t => t.archivedAt || t.updatedAt);
                  return TIME_BUCKET_ORDER.map(bucket => {
                    const items = groups.get(bucket);
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={bucket}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                            {TIME_BUCKET_LABELS[bucket]}
                          </span>
                          <span className="text-xs text-zinc-400">({items.length})</span>
                          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                        <div className="space-y-3">
                          {items.map(task => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              tags={tags}
                              onEdit={() => setSelectedTask(task.id)}
                              onStatusChange={(status) => {
                                useTaskStore.getState().updateTask(task.id, { status });
                              }}
                              onPriorityChange={(priority) => {
                                useTaskStore.getState().updateTask(task.id, { priority });
                              }}
                              onArchive={() => handleDeleteFromArchive(task.id)}
                              onDelete={() => handleDeleteFromArchive(task.id)}
                              onRestore={() => handleRestoreFromArchive(task.id)}
                              isArchivedView={true}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
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
