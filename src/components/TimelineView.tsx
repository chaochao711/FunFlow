// src/components/TimelineView.tsx — 任务时间线视图（按时间排列任务）

import { useState } from 'react';
import { Plus, Calendar, Flag } from 'lucide-react';
import { useTaskStore, Task } from '../store/useTaskStore';
import { useEventStore } from '../store/useEventStore';
import { getTagDisplay, getTagColorClass } from '../utils/tagUtils';
import { formatRelativeTime, groupTasksByDate, getDateGroupLabel } from '../utils/dateUtils';
import CreateEventModal from './CreateEventModal';

interface TimelineViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

const priorityConfig: Record<string, { icon: string; dotClass: string }> = {
  high: { icon: '🔥', dotClass: 'bg-red-500' },
  medium: { icon: '⭐', dotClass: 'bg-amber-500' },
  low: { icon: '🌱', dotClass: 'bg-emerald-500' },
};

export default function TimelineView({ tasks = [], onTaskClick }: TimelineViewProps) {
  const { tags } = useTaskStore();
  const { addEvent } = useEventStore();

  if (!Array.isArray(tasks)) return null;
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const taskOptions = tasks
    .filter(t => !t.archived && !t.deleted)
    .map(t => ({ id: t.id, title: t.title }));

  // 按 dueDate || createdAt 分组
  const dateGroups = groupTasksByDate(
    tasks.filter(t => !t.deleted),
    (t) => t.dueDate || t.createdAt
  );

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* 头部 */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <h3 className="font-bold text-zinc-900 dark:text-white">时间线</h3>
          <span className="text-sm text-zinc-400">({tasks.filter(t => !t.deleted).length})</span>
        </div>
        <button
          onClick={() => setShowCreateEvent(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all"
        >
          <Plus size={14} />
          新建事件
        </button>
      </div>

      {/* 时间线内容 */}
      <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {Array.from(dateGroups.entries()).length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm">暂无任务</div>
        ) : (
          <div className="space-y-6">
            {Array.from(dateGroups.entries()).map(([dateKey, groupTasks]) => (
              <div key={dateKey}>
                {/* 日期分组标题 */}
                <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm py-2 mb-3 z-10">
                  <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {dateKey === 'nodate' ? '未设置日期' : getDateGroupLabel(dateKey)}
                  </span>
                  <span className="text-xs text-zinc-400 ml-2">
                    {dateKey !== 'nodate' && dateKey}
                  </span>
                </div>

                {/* 时间线条目 */}
                <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-4">
                  {groupTasks.map(task => {
                    const pConfig = priorityConfig[task.priority] || priorityConfig.medium;
                    const taskTags = (task.tags || [])
                      .map(tagId => tags.find(t => t.id === tagId))
                      .filter(Boolean);
                    const isHovered = hoveredId === task.id;
                    const sortDate = task.dueDate || task.createdAt;
                    const timeInfo = formatRelativeTime(sortDate);

                    return (
                      <div
                        key={task.id}
                        className="relative"
                        onMouseEnter={() => setHoveredId(task.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {/* 时间线圆点（优先级着色） */}
                        <div
                          className={`absolute -left-[25px] top-2 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${pConfig.dotClass}`}
                        />

                        <div
                          className={`bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 cursor-pointer transition-colors ${
                            isHovered ? 'bg-zinc-100 dark:bg-zinc-700/50' : ''
                          } ${task.status === 'completed' ? 'opacity-80' : ''}`}
                          onClick={() => onTaskClick(task.id)}
                        >
                          {/* 标题行 */}
                          <div className="flex items-center gap-2 mb-1">
                            {task.archived && <span className="text-xs">📦</span>}
                            <span className="text-xs">{pConfig.icon}</span>
                            <h4
                              className={`text-sm font-medium flex-1 ${
                                task.status === 'completed'
                                  ? 'line-through text-zinc-400'
                                  : 'text-zinc-900 dark:text-white'
                              }`}
                            >
                              {task.title}
                            </h4>
                            {/* 截止时间 */}
                            <span
                              className="text-xs text-zinc-400 cursor-help flex-shrink-0"
                              title={timeInfo.full}
                            >
                              {isHovered ? timeInfo.full : timeInfo.display}
                            </span>
                          </div>

                          {/* 标签 + 状态 */}
                          <div className="flex items-center gap-2 ml-5 flex-wrap">
                            {/* 状态标签 */}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              task.status === 'completed'
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                : task.status === 'in-progress'
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                            }`}>
                              {task.status === 'pending' ? '未开始' : task.status === 'in-progress' ? '进行中' : '已完成'}
                            </span>

                            {/* 标签 */}
                            {taskTags.map(tag => tag && (
                              <span
                                key={tag.id}
                                className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${getTagColorClass(tag)}`}
                              >
                                {getTagDisplay(tag)} {tag.name}
                              </span>
                            ))}

                            {/* 截止日期图标 */}
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-xs text-zinc-400">
                                <Calendar size={10} />
                                {task.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建事件弹窗 */}
      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        onCreate={(eventData) => {
          const now = new Date().toISOString();
          addEvent({
            id: Date.now().toString(),
            ...eventData,
            createdAt: now,
            timestamp: now,
            userId: 'local',
          });
          setShowCreateEvent(false);
        }}
        taskOptions={taskOptions}
      />
    </div>
  );
}
