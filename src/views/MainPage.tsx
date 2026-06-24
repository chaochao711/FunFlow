// src/views/MainPage.tsx — 主视图（列表 + 日历）

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Sun, Moon, Sparkles, Filter, X,
  Archive, Trash2, Menu, Settings
} from 'lucide-react';
import { useTaskStore, Tag } from '../store/useTaskStore';
import { useEventStore, type TaskEvent } from '../store/useEventStore';
import { getTagDisplay, getTagColorClass, getTagDisplayName } from '../utils/tagUtils';
import Sidebar from '../components/Sidebar';
import TaskCard from '../components/TaskCard';
import TaskFormModal from '../components/TaskFormModal';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import QuickStats from '../components/QuickStats';
import CalendarView from '../components/CalendarView';
import TimelineView from '../components/TimelineView';
import UserMenu from '../components/UserMenu';
import CreateEventModal from '../components/CreateEventModal';

interface MainPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function MainPage({ isDark, onToggleTheme }: MainPageProps) {
  const {
    tasks,
    tags,
    sidebarOpen,
    toggleSidebar,
    selectedTaskId,
    setSelectedTask,
    setShowArchived,
    setShowTrash,
    archiveTask,
    deleteTask,
  } = useTaskStore();
  const { addEvent, events: allEvents, toggleEventComplete, updateEvent } = useEventStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | null>(null);
  const [sortBy, setSortBy] = useState<'status' | 'dueDate' | 'priority' | 'created'>('status');
  const [regexError, setRegexError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline'>('list');
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [eventTaskId, setEventTaskId] = useState<string | null>(null);
  const [recentChanges, setRecentChanges] = useState<Record<string, 'modified' | 'status-changed'>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [editEvent, setEditEvent] = useState<TaskEvent | null>(null);

  const eventHoverDelay = useTaskStore(s => s.eventHoverDelay);
  const setEventHoverDelay = useTaskStore(s => s.setEventHoverDelay);

  // 标记任务变更
  const markTaskChanged = (taskId: string, type: 'modified' | 'status-changed') => {
    setRecentChanges(prev => ({ ...prev, [taskId]: type }));
  };

  const activeTasks = tasks.filter(t => !t.archived && !t.deleted);

  // ========== 辅助函数 ==========

  const clearAllFilters = () => {
    setFilterStatus(null);
    setFilterPriority(null);
    setSelectedTags([]);
    setDateFilter(null);
    setSearchQuery('');
    setRegexError(false);
  };

  const getDescendantTagIds = (tagId: string, allTags: Tag[]): string[] => {
    const children = allTags.filter(t => t.parentId === tagId);
    const descendantIds: string[] = [];
    for (const child of children) {
      descendantIds.push(child.id);
      descendantIds.push(...getDescendantTagIds(child.id, allTags));
    }
    return descendantIds;
  };

  const getExpandedTagIds = (selectedTagIds: string[], allTags: Tag[]): string[] => {
    const expandedIds = new Set<string>();
    for (const tagId of selectedTagIds) {
      expandedIds.add(tagId);
      const descendants = getDescendantTagIds(tagId, allTags);
      descendants.forEach(id => expandedIds.add(id));
    }
    return Array.from(expandedIds);
  };

  const matchesSearch = (text: string, query: string, useRegexMode: boolean): boolean => {
    if (!query) return true;
    if (useRegexMode) {
      try {
        const regex = new RegExp(query, 'i');
        return regex.test(text);
      } catch (e) {
        return text.toLowerCase().includes(query.toLowerCase());
      }
    }
    return text.toLowerCase().includes(query.toLowerCase());
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (useRegex) {
      try {
        new RegExp(value, 'i');
        setRegexError(false);
      } catch {
        setRegexError(true);
      }
    } else {
      setRegexError(false);
    }
  };

  const toggleRegexMode = () => {
    setUseRegex(!useRegex);
    setRegexError(false);
    if (!useRegex && searchQuery) {
      try {
        new RegExp(searchQuery, 'i');
      } catch {
        setRegexError(true);
      }
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  // ========== 筛选排序 ==========

  const filteredTasks = useMemo(() => {
    const expandedTagIds = selectedTags.length > 0
      ? getExpandedTagIds(selectedTags, tags)
      : [];

    return tasks.filter(t => !t.deleted).filter(task => {
      // 搜索匹配（标题 + 发起人 + 执行者）
      if (!matchesSearch(task.title, searchQuery, useRegex) &&
          !matchesSearch(task.createdBy || '', searchQuery, useRegex) &&
          !matchesSearch(task.assignedTo || '', searchQuery, useRegex)) return false;
      // 状态筛选
      if (filterStatus && task.status !== filterStatus) return false;
      // 优先级筛选
      if (filterPriority && task.priority !== filterPriority) return false;
      // 标签筛选（含子标签展开）
      if (expandedTagIds.length > 0) {
        const taskTags = task.tags || [];
        const hasMatchingTag = taskTags.some(tagId => expandedTagIds.includes(tagId));
        if (!hasMatchingTag) return false;
      }
      // 日期筛选
      const today = new Date().toISOString().split('T')[0];
      if (dateFilter === 'today') {
        if (task.dueDate !== today) return false;
      } else if (dateFilter === 'upcoming') {
        if (!task.dueDate || task.dueDate < today) return false;
      } else if (dateFilter === 'overdue') {
        if (!task.dueDate || task.dueDate >= today || task.status === 'completed') return false;
      }
      return true;
    });
  }, [tasks, searchQuery, useRegex, filterStatus, filterPriority, selectedTags, tags, dateFilter]);

  const filteredAndSortedTasks = useMemo(() => {
    const activeFiltered = filteredTasks.filter(t => !t.archived);
    const getStatusOrder = (task: any, today: string) => {
      if (task.status === 'completed') return 4;
      if (task.status === 'pending') return 3;
      if (task.status === 'in-progress') return 2;
      if (task.dueDate && task.dueDate < today && task.status !== 'completed') return 1;
      return 3;
    };

    const priorityOrderValue = { high: 1, medium: 2, low: 3 };
    const todayStr = new Date().toISOString().split('T')[0];

    activeFiltered.sort((a, b) => {
      if (sortBy === 'status') {
        const aOrder = getStatusOrder(a, todayStr);
        const bOrder = getStatusOrder(b, todayStr);
        if (aOrder !== bOrder) return aOrder - bOrder;

        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;

        return priorityOrderValue[a.priority] - priorityOrderValue[b.priority];
      } else if (sortBy === 'dueDate') {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return getStatusOrder(a, todayStr) - getStatusOrder(b, todayStr);
      } else if (sortBy === 'priority') {
        if (priorityOrderValue[a.priority] !== priorityOrderValue[b.priority]) {
          return priorityOrderValue[a.priority] - priorityOrderValue[b.priority];
        }
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return getStatusOrder(a, todayStr) - getStatusOrder(b, todayStr);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return activeFiltered;
  }, [filteredTasks, sortBy]);

  const sortOptions = [
    { value: 'status', label: '📊 按状态' },
    { value: 'dueDate', label: '📅 按截止日期' },
    { value: 'priority', label: '⚡ 按优先级' },
    { value: 'created', label: '🕐 按创建时间' },
  ];

  const hasActiveFilters = filterStatus !== null || filterPriority !== null || dateFilter !== null || selectedTags.length > 0 || searchQuery !== '';

  const handleArchiveClick = () => {
    clearAllFilters();
    setShowArchived(true);
  };

  const handleTrashClick = () => {
    clearAllFilters();
    setShowTrash(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 transition-colors duration-300">
      {/* 主视图头部 */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* 左侧：菜单按钮 + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <Menu size={20} className="text-zinc-600 dark:text-zinc-400" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐟</span>
              <span className="font-bold text-xl text-zinc-900 dark:text-white hidden sm:block">FunFlow</span>
            </div>
          </div>

          {/* 中间：搜索框 */}
          <div className="flex-1 max-w-md relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder={useRegex ? "搜索任务/发起人/执行者 (正则)..." : "搜索任务、发起人、执行者..."}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={`w-full pl-10 pr-24 py-2 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-zinc-900 dark:text-white placeholder:text-zinc-400 ${
                regexError ? 'ring-2 ring-red-500' : ''
              }`}
            />
            <button
              onClick={toggleRegexMode}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all flex items-center gap-1 text-xs ${
                useRegex
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
              title="正则表达式模式"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">.*</span>
            </button>
          </div>

          {/* 右侧：主题切换 + 新建任务 + 用户菜单 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {isDark ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-zinc-700" />}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition-all active:scale-95"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">新建任务</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              title="设置"
            >
              <Settings size={18} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
            </button>
            <UserMenu />
          </div>
        </div>
        {regexError && (
          <div className="px-4 py-1 text-xs text-red-500 bg-red-50 dark:bg-red-900/20">
            正则表达式无效
          </div>
        )}
      </header>

      <div className="flex">
        <Sidebar
          selectedTags={selectedTags}
          onTagToggle={toggleTag}
          onClearTags={() => setSelectedTags([])}
        />

        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {/* 工具栏：视图切换 + 归档/回收站入口 */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  📋 列表视图
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  📅 日历视图
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'timeline'
                      ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  📊 时间线
                </button>
              </div>

              {/* 筛选指示 — 视图切换按钮右侧 */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-zinc-400 dark:text-zinc-500">当前筛选:</span>
                  {dateFilter === 'overdue' && (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center gap-1">
                      ⚠️ 已逾期
                      <button onClick={() => setDateFilter(null)} className="hover:text-red-800"><X size={12} /></button>
                    </span>
                  )}
                  {dateFilter === 'today' && (
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center gap-1">
                      今日截止
                      <button onClick={() => setDateFilter(null)} className="hover:text-orange-800"><X size={12} /></button>
                    </span>
                  )}
                  {dateFilter === 'upcoming' && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center gap-1">
                      今日及以后
                      <button onClick={() => setDateFilter(null)} className="hover:text-blue-800"><X size={12} /></button>
                    </span>
                  )}
                  {filterPriority && (
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center gap-1">
                      {filterPriority === 'high' ? '🔥 高' : filterPriority === 'medium' ? '⭐ 中' : '🌱 低'}优先级
                      <button onClick={() => setFilterPriority(null)} className="hover:text-zinc-600"><X size={12} /></button>
                    </span>
                  )}
                  {filterStatus && (
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center gap-1">
                      {filterStatus === 'pending' ? '📋 未开始' : filterStatus === 'in-progress' ? '🔄 进行中' : '✅ 已完成'}
                      <button onClick={() => setFilterStatus(null)} className="hover:text-zinc-600"><X size={12} /></button>
                    </span>
                  )}
                  {selectedTags.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag && (
                      <span key={tagId} className="px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full flex items-center gap-1">
                        {tag.colorType === 'emoji' ? tag.emoji : '🏷️'} {getTagDisplayName(tagId, tags)}
                        <button onClick={() => toggleTag(tagId)} className="hover:text-violet-800"><X size={12} /></button>
                      </span>
                    );
                  })}
                  {searchQuery && (
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center gap-1">
                      搜索: {searchQuery}
                      <button onClick={() => setSearchQuery('')} className="hover:text-zinc-600"><X size={12} /></button>
                    </span>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {tasks.filter(t => t.archived && !t.deleted).length > 0 && (
                  <button
                    onClick={handleArchiveClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    <Archive size={14} />
                    归档 ({tasks.filter(t => t.archived && !t.deleted).length})
                  </button>
                )}
                {tasks.filter(t => t.deleted).length > 0 && (
                  <button
                    onClick={handleTrashClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                  >
                    <Trash2 size={14} />
                    回收站 ({tasks.filter(t => t.deleted).length})
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'timeline' ? (
              <TimelineView
                tasks={filteredTasks}
                onTaskClick={(taskId) => setSelectedTask(taskId)}
              />
            ) : viewMode === 'calendar' ? (
              <CalendarView
                tasks={filteredTasks}
                tags={tags}
                onTaskClick={(taskId) => setSelectedTask(taskId)}
              />
            ) : (
              <>
                <QuickStats
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterPriority={filterPriority}
                  setFilterPriority={setFilterPriority}
                  dateFilter={dateFilter}
                  setDateFilter={setDateFilter}
                  tasks={activeTasks}
                  clearAllFilters={clearAllFilters}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-zinc-400" />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">优先级筛选:</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setFilterPriority(null)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1 ${
                          filterPriority === null
                            ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        全部
                      </button>
                      <button
                        onClick={() => setFilterPriority('high')}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1 ${
                          filterPriority === 'high'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                        }`}
                      >
                        🔥 高
                      </button>
                      <button
                        onClick={() => setFilterPriority('medium')}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1 ${
                          filterPriority === 'medium'
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                        }`}
                      >
                        ⭐ 中
                      </button>
                      <button
                        onClick={() => setFilterPriority('low')}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1 ${
                          filterPriority === 'low'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                        }`}
                      >
                        🌱 低
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="appearance-none px-4 py-2 pr-8 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all font-medium"
                      >
                        {sortOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 px-3 py-1.5 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all"
                      >
                        <X size={14} />
                        清除筛选
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredAndSortedTasks.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="text-6xl mb-4 opacity-30">🐟</div>
                      <p className="text-zinc-400 dark:text-zinc-500">
                        {searchQuery ? '没有找到匹配的任务' : '暂无任务'}
                      </p>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 text-violet-600 dark:text-violet-400 hover:text-violet-700 text-sm"
                      >
                        创建第一个任务
                      </button>
                    </div>
                  ) : (
                    filteredAndSortedTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        tags={tags}
                        onEdit={() => setSelectedTask(task.id)}
                        onStatusChange={(status) => {
                          if (status === 'completed') {
                            const incompleteSubs = allEvents.filter(
                              e => e.taskId === task.id && e.type === 'completion' && !e.completed
                            );
                            if (incompleteSubs.length > 0) {
                              if (!confirm(`还有 ${incompleteSubs.length} 个完成节点未完成：\n${incompleteSubs.map(e => `· ${e.content}`).join('\n')}\n\n确定要标记为完成吗？`)) {
                                return;
                              }
                            }
                          }
                          useTaskStore.getState().updateTask(task.id, { status });
                          markTaskChanged(task.id, 'status-changed');
                        }}
                        onPriorityChange={(priority) => {
                          useTaskStore.getState().updateTask(task.id, { priority });
                          markTaskChanged(task.id, 'modified');
                        }}
                        onArchive={() => archiveTask(task.id)}
                        onDelete={() => deleteTask(task.id)}
                        onCreateEvent={() => {
                          setEventTaskId(task.id);
                          setShowCreateEventModal(true);
                        }}
                        onDeleteEvent={(eventId) => {
                          useEventStore.getState().deleteEvent(eventId);
                        }}
                        onToggleEventComplete={(eventId) => {
                          toggleEventComplete(eventId);
                        }}
                        onEditEvent={(evt) => {
                          // 直接打开事件编辑弹窗
                          setEditEvent(evt);
                        }}
                        changeIndicator={recentChanges[task.id]}
                        allTasks={tasks}
                        taskEvents={allEvents.filter(e => e.taskId === task.id)}
                        keepTimelineOpen={(editEvent?.taskId ?? (showCreateEventModal ? eventTaskId : null)) === task.id}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <TaskFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        tags={tags}
      />

      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTask(null)}
        tags={tags}
      />

      <CreateEventModal
        isOpen={showCreateEventModal}
        onClose={() => {
          setShowCreateEventModal(false);
          setEventTaskId(null);
        }}
        onCreate={(eventData) => {
          const now = new Date().toISOString();
          addEvent({
            id: crypto.randomUUID(),
            ...eventData,
            createdAt: now,
            timestamp: now,
            userId: 'local',
          });
          setShowCreateEventModal(false);
          setEventTaskId(null);
        }}
        defaultType="completion"
        initialTaskId={eventTaskId || undefined}
      />

      {/* 编辑事件弹窗（从 TaskCard 内联时间线直接触发） */}
      <CreateEventModal
        isOpen={editEvent !== null}
        onClose={() => setEditEvent(null)}
        onCreate={() => {}}
        onUpdate={(id, updates) => {
          updateEvent(id, updates);
          setEditEvent(null);
        }}
        mode="edit"
        editEvent={editEvent}
      />

      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowSettings(false)} />
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl pointer-events-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                    <Settings size={18} /> 设置
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="text-sm text-zinc-600 dark:text-zinc-400 block mb-2">
                    ⏱️ 事件悬停延迟: {(eventHoverDelay / 1000).toFixed(1)} 秒
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="5000"
                    step="100"
                    value={eventHoverDelay}
                    onChange={(e) => setEventHoverDelay(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>0.5s</span>
                    <span>5s</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-2 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors"
                >
                  关闭
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
