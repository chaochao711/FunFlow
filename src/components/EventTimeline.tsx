// src/components/EventTimeline.tsx — 事件时间线（支持拖拽排序）

import { useState, useCallback, useRef } from 'react';
import { CheckCircle, Circle, Lightbulb, StickyNote, Flag, Trash2, Edit3, GripVertical } from 'lucide-react';
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
  onReorder?: (orderedIds: string[]) => void;
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
  onReorder,
  compact = false,
}: EventTimelineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  // 分组：所有事件按 createdAt 分组，组内按 order 排序
  const dateGroups = groupByDate(events, (e) => e.createdAt);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // 拖拽时半透明
    (e.target as HTMLElement).closest('.event-card')?.classList.add('opacity-40');
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).closest('.event-card')?.classList.remove('opacity-40');
    dragIdRef.current = null;
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  }, [dragOverId]);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragIdRef.current;
    if (!sourceId || sourceId === targetId || !onReorder) return;

    // 构建新的排序：把 sourceId 移到 targetId 前面
    const allIds = events.map(ev => ev.id);
    const sourceIdx = allIds.indexOf(sourceId);
    const targetIdx = allIds.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const reordered = [...allIds];
    reordered.splice(sourceIdx, 1);
    const newTargetIdx = reordered.indexOf(targetId);
    reordered.splice(newTargetIdx, 0, sourceId);

    onReorder(reordered);
    dragIdRef.current = null;
    setDragOverId(null);
  }, [events, onReorder]);

  const enableDrag = !!onReorder;

  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-zinc-400">
        暂无事件
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      {Array.from(dateGroups.entries()).map(([dateKey, groupEvents]) => {
        // 组内按 order 排序
        const sorted = [...groupEvents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        return (
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
              {sorted.map((event, index) => {
                const task = tasks.find(t => t.id === event.taskId);
                const { display, full } = formatRelativeTime(event.createdAt);
                const isHovered = hoveredId === event.id;
                const isCompletion = event.type === 'completion';
                const isDone = event.completed;
                const isDragOver = enableDrag && dragOverId === event.id;
                const isFirst = enableDrag && index === 0;
                const isLast = enableDrag && index === sorted.length - 1;

                return (
                  <div
                    key={event.id}
                    className="relative"
                    onMouseEnter={() => setHoveredId(event.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* 拖拽插入指示线（顶部） */}
                    {enableDrag && isFirst && (
                      <div
                        className={`absolute -left-[13px] right-0 h-0.5 rounded-full z-10 transition-colors ${
                          isDragOver ? 'bg-violet-500 -top-1' : ''
                        }`}
                      />
                    )}

                    {/* 事件卡片（draggable） */}
                    <div
                      draggable={enableDrag}
                      onDragStart={(e) => handleDragStart(e, event.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, event.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, event.id)}
                      className={`event-card rounded-lg p-2 transition-all ${
                        compact
                          ? 'bg-transparent'
                          : 'bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3'
                      } ${enableDrag ? 'cursor-default' : ''} ${
                        isDragOver ? 'ring-2 ring-violet-500' : ''
                      }`}
                    >
                      {/* 事件卡片内容 */}
                      <div className={`flex items-start gap-1.5 ${!compact ? 'pl-0' : ''}`}>
                        {/* 拖拽手柄 — 最左侧 */}
                        {enableDrag && (
                          <span
                            className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors flex-shrink-0 leading-none"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <GripVertical size={14} className="align-middle" />
                          </span>
                        )}

                        {/* 类型图标 — 紧贴手柄右侧 */}
                        <span className="flex-shrink-0 leading-none">
                          {isCompletion ? (
                            <button
                              onClick={() => onToggleComplete?.(event.id)}
                              className="cursor-pointer align-middle"
                              title={isDone ? '已完成 — 点击取消' : '点击标记完成'}
                            >
                              {isDone ? (
                                <CheckCircle size={14} className="text-green-500" />
                              ) : (
                                <Circle size={14} className="text-zinc-300 dark:text-zinc-500 hover:text-green-400 transition-colors" />
                              )}
                            </button>
                          ) : event.type === 'idea' ? (
                            <Lightbulb size={14} className="text-amber-500 align-middle" />
                          ) : event.type === 'note' ? (
                            <StickyNote size={14} className="text-blue-500 align-middle" />
                          ) : (
                            <Flag size={14} className="text-purple-500 align-middle" />
                          )}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* 类型名称 + 时间 + 操作按钮 */}
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium leading-none ${
                              isCompletion && isDone
                                ? 'text-green-600 dark:text-green-400 line-through'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}>
                              {typeLabel[event.type]}
                            </span>

                            <span className="flex-1" />

                            <span
                              className="text-xs text-zinc-400 tabular-nums flex-shrink-0 whitespace-nowrap"
                              title={full}
                            >
                              {display}
                            </span>

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

                          {isCompletion && event.estimatedTime && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                              ⏱️ 预计 {formatEstimatedTime(event.estimatedTime)} 完成
                            </p>
                          )}

                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 格式化预计完成时间：从 "2026-06-29T14:30" 转为 "06-29 14:30" */
function formatEstimatedTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}
