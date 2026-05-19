// src/components/TrashView.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RotateCcw, AlertTriangle, X, Calendar, ArrowLeft, Archive } from 'lucide-react';
import { useTaskStore, Task, Tag } from '../store/useTaskStore';

interface TrashViewProps {
  onBack: () => void;
  tags: Tag[];
}

function getTagDisplay(tag: Tag): string {
  if (tag.colorType === 'emoji') {
    return tag.emoji || '📌';
  }
  return '●';
}

function getTagColorClass(tag: Tag): string {
  if (tag.colorType === 'color') {
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
      green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
      emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    };
    return colorMap[tag.color || 'blue'] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  }
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export default function TrashView({ onBack, tags }: TrashViewProps) {
  const { tasks, restoreTask, permanentDeleteTask, emptyTrash, archiveSettings } = useTaskStore();
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const trashedTasks = tasks.filter(t => t.deleted);
  
  const handleRestore = (taskId: string) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* 头部 - 与归档视图样式一致 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
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
                onClick={onBack}
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
        
        {/* 任务列表 */}
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
                          onClick={() => handleRestore(task.id)}
                          className="p-2 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                          title="恢复"
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
      
      {/* 清空回收站确认弹窗 */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowEmptyConfirm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">清空回收站</h3>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              确定要清空回收站吗？此操作将<strong className="text-red-500">永久删除</strong>所有任务，无法恢复。
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleEmptyTrash}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 彻底删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">彻底删除</h3>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              确定要彻底删除这个任务吗？此操作无法撤销。
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={() => handlePermanentDelete(showDeleteConfirm)}
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