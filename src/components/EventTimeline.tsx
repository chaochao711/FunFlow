// src/components/EventTimeline.tsx — 事件时间线（类型图标为节点，完成节点显示勾选状态）

import { useState } from 'react';
import { CheckCircle, Circle, Lightbulb, StickyNote, Flag, Trash2, Edit3 } from 'lucide-react';
import { Task } from '../store/useTaskStore';
import { TaskEvent } from '../store/useEventStore';
import { formatRelativeTime, groupByDate, getDateGroupLabel } from '../utils/dateUtils';

interface EventTimelineProps {
  events: TaskEvent[];
  tasks: Task[];
  onToggleComplete?: (eventId: string) => void;
  onEditEvent?: (event: TaskEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
  onTaskClick?: (taskId: string) => void;
  compact?: boolean;
}

const typeLabel: Record<TaskEvent['type'], string> = {
  completion: '完成节点',
  idea: '想法',
  note: '备注',
  milestone: '里程碑',
};

export default function EventTimeline({
  events,
  tasks,
  onToggleComplete,
  onEditEvent,
  onDeleteEvent,
  onTaskClick,
  compact = false,
}: EventTimelineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-zinc-400">
        暂无事件
      </div>
    );
  }

  const dateGroups = groupByDate(events, (e) => e.createdAt);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      {Array.from(dateGroups.entries()).map(([dateKey, groupEvents]) => (
        <div key={dateKey}>
          {/* 日期标题 */}
          <div className={`${compact ? 'py-0.5 mb-0.5' : 'sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm py-2 mb-3 z-10'}`}>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {getDateGroupLabel(dateKey)}
            </span>
            <span className="text-xs text-zinc-400 ml-1.5">
              {dateKey}
            </span>
          </div>

          {/* 时间线 */}
          <div className={`relative pl-5 border-l-[3px] border-zinc-300 dark:border-zinc-600 ${compact ? 'space-y-1.5' : 'space-y-3'}`}>
            {groupEvents.map(event => {
              const task = tasks.find(t => t.id === event.taskId);
              const { display, full } = formatRelativeTime(event.createdAt);
              const isHovered = hoveredId === event.id;
              const isCompletion = event.type === 'completion';
              const isDone = event.completed;

              return (
                <div
                  key={event.id}
                  className="relative"
                  onMouseEnter={() => setHoveredId(event.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* 类型标记（圆点位置）—— 完成节点可点击切换 */}
                  {isCompletion ? (
                    <button
                      onClick={() => onToggleComplete?.(event.id)}
                      className="absolute -left-[13px] top-2 cursor-pointer"
                      title={isDone ? '已完成 — 点击取消' : '点击标记完成'}
                    >
                      {isDone ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <Circle size={16} className="text-zinc-300 dark:text-zinc-500 hover:text-green-400 transition-colors" />
                      )}
                    </button>
                  ) : (
                    <div className="absolute -left-[13px] top-2">
                      {event.type === 'idea' ? (
                        <Lightbulb size={14} className="text-amber-500" />
                      ) : event.type === 'note' ? (
                        <StickyNote size={14} className="text-blue-500" />
                      ) : (
                        <Flag size={14} className="text-purple-500" />
                      )}
                    </div>
                  )}

                  {/* 事件卡片 */}
                  <div className={`rounded-lg p-2 ${
                    compact ? 'bg-transparent' : 'bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3'
                  } transition-colors`}>
                    {/* 类型标签 + 时间 + 操作按钮 */}
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${
                        isCompletion && isDone
                          ? 'text-green-600 dark:text-green-400 line-through'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {typeLabel[event.type]}
                      </span>

                      {/* 时间（右对齐） */}
                      <span
                        className="ml-auto text-xs text-zinc-400 tabular-nums flex-shrink-0 text-right whitespace-nowrap"
                        title={full}
                      >
                        {display}
                      </span>

                      {/* 按钮组（hover 显示） */}
                      <span className="flex items-center gap-0.5 flex-shrink-0">
                        {onEditEvent && isHovered && (
                          <button
                            onClick={() => onEditEvent(event)}
                            className="p-0.5 text-zinc-400 hover:text-violet-500 rounded"
                            title="编辑事件"
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                        {onDeleteEvent && isHovered && (
                          <button
                            onClick={() => onDeleteEvent(event.id)}
                            className="p-0.5 text-zinc-400 hover:text-red-500 rounded"
                            title="删除事件"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    </div>

                    {/* 内容 */}
                    <p className={`whitespace-pre-wrap mt-0.5 ${
                      compact
                        ? 'text-sm text-zinc-900 dark:text-white'
                        : 'text-sm text-zinc-700 dark:text-zinc-300'
                    } ${isDone ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}`}>
                      {event.content}
                    </p>

                    {/* 预计完成时间（仅 completion 类型） */}
                    {isCompletion && event.estimatedTime && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        ⏱️ 预计 {event.estimatedTime} 完成
                      </p>
                    )}

                    {/* 关联任务（非 compact 模式） */}
                    {!compact && task && (
                      <button
                        onClick={() => onTaskClick?.(task.id)}
                        className="mt-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        📋 {task.title}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
