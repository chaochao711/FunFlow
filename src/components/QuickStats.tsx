// src/components/QuickStats.tsx

import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Task } from '../store/useTaskStore';

interface QuickStatsProps {
  filterStatus: string | null;
  setFilterStatus: (status: string | null) => void;
  dateFilter: 'all' | 'today' | 'upcoming' | 'overdue' | null;
  setDateFilter: (filter: 'all' | 'today' | 'upcoming' | 'overdue' | null) => void;
  filterPriority: string | null;
  setFilterPriority: (priority: string | null) => void;
  tasks: Task[];
  clearAllFilters: () => void;
  onViewOverdue?: () => void;
}

export default function QuickStats({ 
  filterStatus, 
  setFilterStatus, 
  dateFilter, 
  setDateFilter,
  filterPriority,
  setFilterPriority,
  tasks, 
  clearAllFilters,
  onViewOverdue
}: QuickStatsProps) {
  const today = new Date().toISOString().split('T')[0];
  
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  
  const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'completed');
  const upcomingTasks = tasks.filter(t => t.dueDate && t.dueDate > today && t.status !== 'completed');
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'completed');
  
  const stats = {
    total: tasks.length,
    pending: pendingTasks.length,
    inProgress: inProgressTasks.length,
    completed: completedTasks.length,
    today: todayTasks.length,
    upcoming: upcomingTasks.length,
    overdue: overdueTasks.length,
  };

  const progress = tasks.length ? Math.round((stats.completed / tasks.length) * 100) : 0;

  const hasActiveFilters = filterStatus !== null || dateFilter !== null || filterPriority !== null;

  const handleCardClick = (cardType: string, subType?: string) => {
    if (cardType === 'all') {
      if (subType === 'pending') {
        setFilterStatus(filterStatus === 'pending' ? null : 'pending');
        setDateFilter(null);
      } else if (subType === 'in-progress') {
        setFilterStatus(filterStatus === 'in-progress' ? null : 'in-progress');
        setDateFilter(null);
      } else if (subType === 'completed') {
        setFilterStatus(filterStatus === 'completed' ? null : 'completed');
        setDateFilter(null);
      } else {
        setDateFilter(null);
        setFilterStatus(null);
        setFilterPriority(null);
      }
    } else if (cardType === 'today') {
      if (subType === 'today') {
        setDateFilter(dateFilter === 'today' ? null : 'today');
      } else if (subType === 'upcoming') {
        setDateFilter(dateFilter === 'upcoming' ? null : 'upcoming');
      } else {
        setDateFilter(dateFilter === 'today' ? null : 'today');
      }
      setFilterStatus(null);
    }
  };

  // 处理逾期点击
  const handleOverdueClick = () => {
    setDateFilter(dateFilter === 'overdue' ? null : 'overdue');
    setFilterStatus(null);
  };

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 总任务卡片 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <span className="font-semibold text-zinc-900 dark:text-white">总任务</span>
              </div>
              <button
                onClick={() => handleCardClick('all')}
                className={`text-2xl font-bold ${dateFilter === null && filterStatus === null ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-900 dark:text-white'}`}
              >
                {stats.total}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
            <button
              onClick={() => handleCardClick('all', 'pending')}
              className={`p-3 text-center transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                filterStatus === 'pending' ? 'bg-orange-50 dark:bg-orange-900/20' : ''
              }`}
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400">未开始</div>
              <div className={`text-lg font-semibold ${filterStatus === 'pending' ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {stats.pending}
              </div>
            </button>
            <button
              onClick={() => handleCardClick('all', 'in-progress')}
              className={`p-3 text-center transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                filterStatus === 'in-progress' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400">进行中</div>
              <div className={`text-lg font-semibold ${filterStatus === 'in-progress' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {stats.inProgress}
              </div>
            </button>
            <button
              onClick={() => handleCardClick('all', 'completed')}
              className={`p-3 text-center transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                filterStatus === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : ''
              }`}
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400">已完成</div>
              <div className={`text-lg font-semibold ${filterStatus === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {stats.completed}
              </div>
            </button>
          </div>
        </div>

        {/* 今日任务卡片 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌟</span>
                <span className="font-semibold text-zinc-900 dark:text-white">今日任务</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCardClick('today', 'today')}
                  className={`px-2 py-1 text-xs rounded-lg transition-all ${
                    dateFilter === 'today'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  仅今日
                </button>
                <button
                  onClick={() => handleCardClick('today', 'upcoming')}
                  className={`px-2 py-1 text-xs rounded-lg transition-all ${
                    dateFilter === 'upcoming'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  今日及以后
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-zinc-100 dark:divide-zinc-800">
            <button
              onClick={() => handleCardClick('today', 'today')}
              className={`p-3 text-center transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                dateFilter === 'today' ? 'bg-orange-50 dark:bg-orange-900/20' : ''
              }`}
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400">今日截止</div>
              <div className={`text-lg font-semibold ${dateFilter === 'today' ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {stats.today}
              </div>
            </button>
            <button
              onClick={() => handleCardClick('today', 'upcoming')}
              className={`p-3 text-center transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                dateFilter === 'upcoming' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400">今日以后</div>
              <div className={`text-lg font-semibold ${dateFilter === 'upcoming' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {stats.upcoming}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 进度条 + 逾期快捷入口 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-4 shadow-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-between mb-3">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">完成进度</span>
          <span className="font-mono text-xl font-bold text-violet-600 dark:text-violet-400">{progress}%</span>
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
          />
        </div>
        
        {/* 逾期任务快捷筛选按钮 */}
        {stats.overdue > 0 && (
          <button
            onClick={handleOverdueClick}
            className={`mt-3 text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all w-fit ${
              dateFilter === 'overdue'
                ? 'bg-red-500 text-white'
                : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            <AlertCircle size={12} />
            有 {stats.overdue} 个任务已逾期，点击查看 →
          </button>
        )}
      </div>
    </div>
  );
}