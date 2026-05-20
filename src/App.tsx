// src/App.tsx

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Menu, Sun, Moon, Sparkles, Filter, X, Archive, Trash2, ArrowLeft, Settings, RotateCcw, AlertTriangle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TaskCard from './components/TaskCard';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import TaskFormModal from './components/TaskFormModal';
import QuickStats from './components/QuickStats';
import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import { supabase } from './services/supabase';
import Auth from './components/Auth';
import { loadTasksFromCloud, loadTagsFromCloud, syncTasksToCloud, syncTagsToCloud } from './services/syncService';
import UserMenu from './components/UserMenu';
import { useTaskStore, Tag } from './store/useTaskStore';

function App() {
  const { 
    tasks, 
    tags, 
    sidebarOpen, 
    toggleSidebar, 
    selectedTaskId, 
    setSelectedTask,
    showArchived,
    setShowArchived,
    showTrash,
    setShowTrash,
    archiveTask,
    unarchiveTask,
    deleteTask,
    restoreTask,
    permanentDeleteTask,
    emptyTrash,
    archiveSettings,
    updateArchiveSettings,
    setTasks,
    setTags
  } = useTaskStore();
  
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | null>(null);
  const [sortBy, setSortBy] = useState<'status' | 'dueDate' | 'priority' | 'created'>('status');
  const [isDark, setIsDark] = useState(false);
  const [regexError, setRegexError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // 获取各种任务列表
  const activeTasks = tasks.filter(t => !t.archived && !t.deleted);
  const archivedTasks = tasks.filter(t => t.archived && !t.deleted);
  const trashedTasks = tasks.filter(t => t.deleted);

  // 检查登录状态并加载数据
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        loadUserData(session.user.id);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  // 在 loadUserData 或类似函数中
  const loadUserData = async (userId: string) => {
    try {
      const [cloudTasks, cloudTags] = await Promise.all([
        loadTasksFromCloud(userId),
        loadTagsFromCloud(userId)
      ]);
      
      setTasks(cloudTasks);
      setTags(cloudTags);
      
      // 关键修复：清除可能失效的选中标签
      setSelectedTags([]);   

    } catch (err) {
      console.error('加载云端数据失败:', err);
    }
  };

  // 同步到云端（建议加上防抖）
  useEffect(() => {
    if (!session?.user?.id) return;

    const syncData = async () => {
      try {
        await Promise.all([
          syncTasksToCloud(session.user.id, tasks),
          syncTagsToCloud(session.user.id, tags)
        ]);
      } catch (err) {
        console.error('同步失败:', err);
      }
    };

    const timer = setTimeout(syncData, 800); // 轻微防抖
    return () => clearTimeout(timer);
  }, [tasks, tags, session]);

  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const clearAllFilters = () => {
    setFilterStatus(null);
    setFilterPriority(null);
    setSelectedTags([]);
    setDateFilter(null);
    setSearchQuery('');
    setRegexError(false);
  };

  const getDescendantTagIds = (tagId: string, allTags: typeof tags): string[] => {
    const children = allTags.filter(t => t.parentId === tagId);
    const descendantIds: string[] = [];
    for (const child of children) {
      descendantIds.push(child.id);
      descendantIds.push(...getDescendantTagIds(child.id, allTags));
    }
    return descendantIds;
  };

  const getExpandedTagIds = (selectedTagIds: string[], allTags: typeof tags): string[] => {
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

  // 筛选和排序任务（列表视图）
  const filteredAndSortedTasks = useMemo(() => {
    const sourceTasks = activeTasks;
    
    const expandedTagIds = selectedTags.length > 0 
      ? getExpandedTagIds(selectedTags, tags)
      : [];
    
    let filtered = sourceTasks.filter(task => {
      if (!matchesSearch(task.title, searchQuery, useRegex)) {
        return false;
      }
      if (filterStatus && task.status !== filterStatus) return false;
      if (filterPriority && task.priority !== filterPriority) return false;
      
      if (expandedTagIds.length > 0) {
        const taskTags = task.tags || [];
        const hasMatchingTag = taskTags.some(tagId => expandedTagIds.includes(tagId));
        if (!hasMatchingTag) return false;
      }
      
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

    const getStatusOrder = (task: any, today: string) => {
      if (task.status === 'completed') return 4;
      if (task.status === 'pending') return 3;
      if (task.status === 'in-progress') return 2;
      if (task.dueDate && task.dueDate < today && task.status !== 'completed') return 1;
      return 3;
    };
    
    const priorityOrderValue = { high: 1, medium: 2, low: 3 };
    const todayStr = new Date().toISOString().split('T')[0];
    
    filtered.sort((a, b) => {
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
    
    return filtered;
  }, [activeTasks, searchQuery, useRegex, filterStatus, filterPriority, selectedTags, tags, dateFilter, sortBy]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

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

  const handleBackToMain = () => {
    clearAllFilters();
    setShowArchived(false);
    setShowTrash(false);
  };

  // 归档中的恢复操作（恢复到主视图）
  const handleRestoreFromArchive = (taskId: string) => {
    unarchiveTask(taskId);
  };

  // 归档中的删除操作（移到回收站）
  const handleDeleteFromArchive = (taskId: string) => {
    deleteTask(taskId);
  };

  // 回收站中的恢复操作
  const handleRestoreFromTrash = (taskId: string) => {
    restoreTask(taskId);
  };

  // 回收站中的彻底删除
  const handlePermanentDelete = (taskId: string) => {
    permanentDeleteTask(taskId);
    setShowDeleteConfirm(null);
  };

  // 清空回收站
  const handleEmptyTrash = () => {
    emptyTrash();
    setShowEmptyConfirm(false);
  };

  const getTagDisplayName = (tagId: string): string => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return tagId;
    
    const getPath = (t: typeof tag): string[] => {
      if (!t.parentId) return [t.name];
      const parent = tags.find(p => p.id === t.parentId);
      return parent ? [...getPath(parent), t.name] : [t.name];
    };
    
    return getPath(tag).join(' / ');
  };

  const getTagDisplay = (tag: any): string => {
    if (tag.colorType === 'emoji') {
      return tag.emoji || '📌';
    }
    return '●';
  };

  const getTagColorClass = (tag: any): string => {
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
  };

  const handleAutoArchiveToggle = () => {
    updateArchiveSettings({ enabled: !archiveSettings.enabled });
  };

  // 如果正在加载，显示加载中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐟</div>
          <p className="text-zinc-500 dark:text-zinc-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录显示登录页
  if (!session) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  // ========== 回收站视图 ==========
  if (showTrash) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 transition-colors duration-300">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
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

            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {isDark ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-zinc-700" />}
            </button>
          </div>
        </header>

        <div className="flex">
          <Sidebar 
            selectedTags={selectedTags} 
            onTagToggle={toggleTag} 
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
          </main>
        </div>

        <TaskDetailDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTask(null)}
          tags={tags}
        />

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
                <button onClick={() => setShowEmptyConfirm(false)} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">取消</button>
                <button onClick={handleEmptyTrash} className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600">确认清空</button>
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
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">取消</button>
                <button onClick={() => handlePermanentDelete(showDeleteConfirm)} className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600">确认删除</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== 归档视图 ==========
  if (showArchived) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 transition-colors duration-300">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
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

            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {isDark ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-zinc-700" />}
            </button>
          </div>
        </header>

        <div className="flex">
          <Sidebar 
            selectedTags={selectedTags} 
            onTagToggle={toggleTag} 
            onClearTags={() => setSelectedTags([])}
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
                          onChange={handleAutoArchiveToggle}
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
              
              {/* 归档任务列表 */}
              {archivedTasks.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4 opacity-30">📦</div>
                  <p className="text-zinc-400 dark:text-zinc-500">暂无归档任务</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedTasks.map(task => (
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

  // ========== 主视图 ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 transition-colors duration-300">
      {/* App.tsx 主视图部分 */}
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
              placeholder={useRegex ? "搜索任务 (支持正则)... /pattern/flags" : "搜索任务..."}
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
              onClick={toggleTheme}
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
              </div>

              <div className="flex gap-2">
                {archivedTasks.length > 0 && (
                  <button
                    onClick={handleArchiveClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    <Archive size={14} />
                    归档 ({archivedTasks.length})
                  </button>
                )}
                {trashedTasks.length > 0 && (
                  <button
                    onClick={handleTrashClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                  >
                    <Trash2 size={14} />
                    回收站 ({trashedTasks.length})
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <CalendarView
                tasks={activeTasks}
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

                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">当前筛选:</span>
                    {dateFilter === 'overdue' && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center gap-1">
                        ⚠️ 已逾期
                        <button onClick={() => setDateFilter(null)} className="hover:text-red-800">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {dateFilter === 'today' && (
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center gap-1">
                        今日截止
                        <button onClick={() => setDateFilter(null)} className="hover:text-orange-800">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {dateFilter === 'upcoming' && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center gap-1">
                        今日及以后
                        <button onClick={() => setDateFilter(null)} className="hover:text-blue-800">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {filterPriority && (
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center gap-1">
                        {filterPriority === 'high' ? '🔥 高' : filterPriority === 'medium' ? '⭐ 中' : '🌱 低'}优先级
                        <button onClick={() => setFilterPriority(null)} className="hover:text-zinc-600">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {filterStatus && (
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center gap-1">
                        {filterStatus === 'pending' ? '📋 未开始' : filterStatus === 'in-progress' ? '🔄 进行中' : '✅ 已完成'}
                        <button onClick={() => setFilterStatus(null)} className="hover:text-zinc-600">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {selectedTags.map(tagId => {
                      const tag = tags.find(t => t.id === tagId);
                      return tag && (
                        <span key={tagId} className="px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full flex items-center gap-1">
                          {tag.colorType === 'emoji' ? tag.emoji : '🏷️'} {getTagDisplayName(tagId)}
                          <button onClick={() => toggleTag(tagId)} className="hover:text-violet-800">
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    {searchQuery && (
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center gap-1">
                        搜索: {searchQuery}
                        <button onClick={() => setSearchQuery('')} className="hover:text-zinc-600">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                )}

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
                          useTaskStore.getState().updateTask(task.id, { status });
                        }}
                        onPriorityChange={(priority) => {
                          useTaskStore.getState().updateTask(task.id, { priority });
                        }}
                        onArchive={() => archiveTask(task.id)}
                        onDelete={() => deleteTask(task.id)}
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
    </div>
  );
}

export default App;