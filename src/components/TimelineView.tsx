// src/components/TimelineView.tsx — 任务时间线视图（按时间排列任务）

import { useState } from 'react';
import { Plus, Calendar, CheckCircle, Circle, Lightbulb, StickyNote, Flag, Clock } from 'lucide-react';
import { useTaskStore, Task } from '../store/useTaskStore';
import { useEventStore } from '../store/useEventStore';
import { getTagDisplay, getTagColorClass } from '../utils/tagUtils';
import { groupTasksByDate, getDateGroupLabel, formatRelativeTime } from '../utils/dateUtils';
import CreateEventModal from './CreateEventModal';

interface TimelineViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

const priorityConfig: Record<string, { icon: string }> = {
  high: { icon: '🔥' },
  medium: { icon: '⭐' },
  low: { icon: '🌱' },
};

export default function TimelineView({ tasks = [], onTaskClick }: TimelineViewProps) {
  const { tags } = useTaskStore();
  const { events, addEvent } = useEventStore();

  if (!Array.isArray(tasks)) return null;
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventTaskId, setEventTaskId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const taskOptions = tasks
    .filter(t => !t.archived && !t.deleted)
    .map(t => ({ id: t.id, title: t.title }));

  // 按 createdAt 日期分组，截止日期在标签行显示
  const dateGroups = groupTasksByDate(
    tasks.filter(t => !t.deleted),
    (t) => t.createdAt
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

                    return (
                        <div
                          key={task.id}
                          className="relative"
                          onMouseEnter={() => setHoveredId(task.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <div
                            className={`rounded-xl p-3 cursor-pointer transition-colors relative overflow-hidden ${
                              task.archived
                                ? 'bg-zinc-100 dark:bg-zinc-700'
                                : 'bg-zinc-50 dark:bg-zinc-800/50'
                            } ${
                              isHovered ? (task.archived ? 'bg-zinc-200 dark:bg-zinc-600' : 'bg-zinc-100 dark:bg-zinc-700/50') : ''
                            } ${task.status === 'completed' ? 'opacity-80' : ''}`}
                            onClick={() => onTaskClick(task.id)}
                          >
                            {/* 归档水印底纹 */}
                            {task.archived && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                                <span className="text-6xl opacity-[0.06] dark:opacity-[0.08]">📦</span>
                              </div>
                            )}
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
                              {/* 事件数量徽章 */}
                              {(() => {
                                const ec = events.filter(e => e.taskId === task.id).length;
                                if (ec === 0) return null;
                                return (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-medium flex items-center gap-0.5">
                                    <Clock size={9} />
                                    {ec}
                                  </span>
                                );
                              })()}
                              {/* 添加事件按钮（悬浮显示） */}
                              {!task.archived && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEventTaskId(task.id);
                                    setShowCreateEvent(true);
                                  }}
                                  className={`p-1 rounded-lg transition-all flex items-center gap-0.5 text-xs ${
                                    isHovered
                                      ? 'opacity-100 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                                      : 'opacity-0'
                                  } hover:bg-violet-200 dark:hover:bg-violet-900/50`}
                                  title="添加事件"
                                >
                                  <Plus size={12} />
                                  <span>事件</span>
                                </button>
                              )}
                            </div>

                            {/* 标签 + 状态 */}
                            <div className="flex items-center gap-2 flex-wrap">
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
                                <span className="flex items-center gap-1 text-xs text-zinc-400 cursor-help" title={`截止日期: ${task.dueDate}`}>
                                  <Calendar size={10} />
                                  {task.dueDate}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 事件子时间线 */}
                          {(() => {
                            const taskEvents = events
                              .filter(e => e.taskId === task.id)
                              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                            if (taskEvents.length === 0) {
                              if (!task.archived && isHovered) {
                                return (
                                  <div className="mt-2 ml-4 text-xs text-zinc-400 dark:text-zinc-500 italic">
                                    暂无事件，点击「+ 事件」添加
                                  </div>
                                );
                              }
                              return null;
                            }
                            return (
                              <div className="relative pl-4 ml-1 mt-2 border-l-[2px] border-zinc-200 dark:border-zinc-700 space-y-1.5">
                                {taskEvents.map(event => {
                                  const { display } = formatRelativeTime(event.createdAt);
                                  return (
                                    <div key={event.id} className="relative pl-2 py-0.5">
                                      {/* 事件类型标记 */}
                                      <div className="absolute -left-[9px] top-1.5">
                                        {event.type === 'completion' ? (
                                          event.completed
                                            ? <CheckCircle size={12} className="text-green-500" />
                                            : <Circle size={12} className="text-zinc-300 dark:text-zinc-500" />
                                        ) : event.type === 'idea' ? (
                                          <Lightbulb size={11} className="text-amber-500" />
                                        ) : event.type === 'note' ? (
                                          <StickyNote size={11} className="text-blue-500" />
                                        ) : (
                                          <Flag size={11} className="text-purple-500" />
                                        )}
                                      </div>
                                      {/* 事件内容 */}
                                      <div className="flex items-start gap-2 min-w-0">
                                        <p className={`text-xs flex-1 min-w-0 whitespace-pre-wrap leading-relaxed ${
                                          event.type === 'completion' && event.completed
                                            ? 'line-through text-zinc-400 dark:text-zinc-500'
                                            : 'text-zinc-600 dark:text-zinc-400'
                                        }`}>
                                          {event.content}
                                        </p>
                                        <span className="text-xs text-zinc-400 tabular-nums flex-shrink-0 whitespace-nowrap">
                                          {display}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
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
        onClose={() => {
          setShowCreateEvent(false);
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
          setShowCreateEvent(false);
          setEventTaskId(null);
        }}
        taskOptions={taskOptions}
        initialTaskId={eventTaskId || undefined}
      />
    </div>
  );
}
