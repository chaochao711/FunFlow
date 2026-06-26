// src/components/TaskCard.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, Circle, PlayCircle, Archive, Trash2, Edit3, RotateCcw, CircleCheck } from 'lucide-react';
import { Task, Tag, useTaskStore } from '../store/useTaskStore';
import { getTagDisplay, getTagColorClass } from '../utils/tagUtils';
import { formatDateOnly } from '../utils/dateUtils';
import EventTimeline from './EventTimeline';
import type { TaskEvent } from '../store/useEventStore';
import { useEventStore } from '../store/useEventStore';

interface TaskCardProps {
  task: Task;
  tags: Tag[];
  onEdit: () => void;
  onStatusChange: (status: Task['status']) => void;
  onPriorityChange: (priority: Task['priority']) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  isArchivedView?: boolean;
  onCreateEvent?: () => void;
  onDeleteEvent?: (eventId: string) => void;
  onToggleEventComplete?: (eventId: string) => void;
  onEditEvent?: (event: TaskEvent) => void;
  allTasks?: Task[];
  taskEvents?: TaskEvent[];
  keepTimelineOpen?: boolean;
}

const priorityConfig = {
  high: { label: '高', icon: '🔥', color: 'red', selectedClass: 'bg-red-100/80 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
  medium: { label: '中', icon: '⭐', color: 'amber', selectedClass: 'bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  low: { label: '低', icon: '🌱', color: 'green', selectedClass: 'bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
};

const priorityOrder = ['high', 'medium', 'low'] as const;

const statusConfig = {
  pending: { 
    label: '未开始', 
    icon: Circle, 
    color: 'orange', 
    bgClass: 'bg-orange-50 dark:bg-orange-950/30 border-l-4 border-l-orange-500',
    textClass: 'text-orange-700 dark:text-orange-300'
  },
  'in-progress': { 
    label: '进行中', 
    icon: PlayCircle, 
    color: 'blue', 
    bgClass: 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500',
    textClass: 'text-blue-700 dark:text-blue-300'
  },
  completed: { 
    label: '已完成', 
    icon: CheckCircle, 
    color: 'green', 
    bgClass: 'bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-500 opacity-90',
    textClass: 'text-green-700 dark:text-green-300'
  },
};

export default function TaskCard({
  task,
  tags,
  onEdit,
  onStatusChange,
  onPriorityChange,
  onArchive,
  onDelete,
  onRestore,
  isArchivedView = false,
  onCreateEvent,
  onDeleteEvent,
  onToggleEventComplete,
  onEditEvent,
  allTasks = [],
  taskEvents = [],
  keepTimelineOpen = false,
}: TaskCardProps) {
  const [isPriorityExpanded, setIsPriorityExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonWidths, setButtonWidths] = useState<number[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eventHoverDelay = useTaskStore(s => s.eventHoverDelay);
  const { reorderEvents } = useEventStore();

  const handleReorder = useCallback((orderedIds: string[]) => {
    reorderEvents(task.id, orderedIds);
  }, [task.id, reorderEvents]);

  const handleMouseEnter = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (!showTimerRef.current && !showTimeline) {
      showTimerRef.current = setTimeout(() => {
        setShowTimeline(true);
        showTimerRef.current = null;
      }, eventHoverDelay);
    }
  };

  const handleMouseLeave = () => {
    // 编辑事件进行中，不收起时间线
    if (keepTimelineOpen) return;
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    if (!hideTimerRef.current) {
      hideTimerRef.current = setTimeout(() => {
        setShowTimeline(false);
        hideTimerRef.current = null;
      }, eventHoverDelay);
    }
  };
  
  const safeTags = task.tags || [];
  const taskTags = safeTags.map(tagId => tags.find(t => t.id === tagId)).filter(Boolean);
  const StatusIcon = statusConfig[task.status]?.icon || Circle;
  
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.dueDate && task.dueDate < today && task.status !== 'completed';
  const isToday = task.dueDate === today && task.status !== 'completed';
  
  const hasDueMask = isToday || isOverdue;
  const maskClass = isOverdue 
    ? 'bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent dark:from-red-500/20 dark:via-red-500/10' 
    : isToday 
    ? 'bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent dark:from-orange-500/20 dark:via-orange-500/10'
    : '';

  const handlePrioritySelect = (priority: keyof typeof priorityConfig) => {
    onPriorityChange(priority);
    setIsPriorityExpanded(false);
  };

  const handleCurrentPriorityClick = () => {
    setIsPriorityExpanded(!isPriorityExpanded);
  };

  useEffect(() => {
    if (containerRef.current) {
      const buttons = containerRef.current.querySelectorAll('.priority-btn');
      const widths: number[] = [];
      buttons.forEach(btn => {
        widths.push((btn as HTMLElement).offsetWidth);
      });
      setButtonWidths(widths);
    }
  }, [task.priority, isPriorityExpanded]);

  const totalButtonsWidth = buttonWidths.reduce((sum, w) => sum + w, 0);
  const currentIndex = priorityOrder.indexOf(task.priority);
  const currentButtonWidth = buttonWidths[currentIndex] || 0;
  const viewportWidth = isPriorityExpanded ? totalButtonsWidth : currentButtonWidth;
  
  const getButtonGroupOffset = (): number => {
    if (buttonWidths.length === 0) return 0;
    let offset = 0;
    for (let i = 0; i < currentIndex; i++) {
      offset += buttonWidths[i];
    }
    return isPriorityExpanded ? 0 : -offset;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPriorityExpanded(false);
      }
    };
    
    if (isPriorityExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPriorityExpanded]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-all overflow-hidden ${statusConfig[task.status]?.bgClass}`}
    >
      {hasDueMask && (
        <div className={`absolute inset-0 pointer-events-none ${maskClass}`} />
      )}

      <div className="relative p-4 z-10">
        <div className="flex items-start gap-3">
          <button
            onClick={() => {
              const nextStatus = task.status === 'pending' ? 'in-progress' :
                                task.status === 'in-progress' ? 'completed' : 'pending';
              onStatusChange(nextStatus);
            }}
            className="mt-0.5 flex-shrink-0"
            title={`当前: ${statusConfig[task.status]?.label}，点击切换`}
          >
            <StatusIcon 
              size={20} 
              className={`${statusConfig[task.status]?.textClass} hover:scale-110 transition-transform`} 
            />
          </button>

          <h3 className={`flex-1 font-medium break-words ${task.status === 'completed' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
            {task.title}
          </h3>

          {/* 操作按钮组 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isArchivedView ? (
              <>
                <button
                  onClick={onRestore}
                  className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all"
                  title="恢复任务"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                  title="移至回收站"
                >
                  <Trash2 size={16} />
                </button>
              </>
            ) : (
              <>
                {onCreateEvent && (
                  <button
                    onClick={onCreateEvent}
                    className="p-1.5 rounded-lg text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all"
                    title="生成完成节点"
                  >
                    <CircleCheck size={16} />
                  </button>
                )}
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  title="编辑任务"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={onArchive}
                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  title="归档"
                >
                  <Archive size={16} />
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定删除这个任务吗？删除后可到归档中恢复。')) {
                      onDelete?.();
                    }
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-all"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {task.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 ml-9 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center flex-wrap gap-2 mt-3 ml-9">
          {/* 优先级选择器 */}
          <div className="relative inline-block translate-y-[3px]">
            <motion.div
              ref={containerRef}
              className="relative inline-block rounded-full overflow-hidden"
              animate={{
                width: viewportWidth,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            >
              <motion.div
                className="flex items-center"
                animate={{
                  x: getButtonGroupOffset(),
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              >
                <div className="flex items-center bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 rounded-full">
                  {priorityOrder.map((key, idx) => {
                    const config = priorityConfig[key];
                    const isSelected = task.priority === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handlePrioritySelect(key)}
                        className={`priority-btn px-2 py-0.5 text-xs flex items-center gap-1 transition-all whitespace-nowrap ${
                          isSelected
                            ? config.selectedClass
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                        } ${idx === 0 ? 'rounded-l-full' : ''} ${idx === priorityOrder.length - 1 ? 'rounded-r-full' : ''}`}
                      >
                        <span>{config.icon}</span>
                        <span className="hidden sm:inline">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
            
            {!isPriorityExpanded && (
              <div
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={handleCurrentPriorityClick}
                style={{
                  width: currentButtonWidth,
                  left: 0,
                }}
              />
            )}
          </div>

          {/* 标签 */}
          {taskTags.map(tag => tag && (
            <span
              key={tag.id}
              className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-transparent ${getTagColorClass(tag)}`}
            >
              {getTagDisplay(tag)} {tag.name}
            </span>
          ))}
          
          {/* 截止日期 */}
          {task.dueDate && (
            <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : isToday ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
              <Calendar size={12} />
              <span>{task.dueDate}</span>
              {isOverdue && <span className="text-red-600 dark:text-red-400">(逾期)</span>}
              {isToday && !isOverdue && <span className="text-orange-600 dark:text-orange-400">(今日截止)</span>}
            </div>
          )}

          {/* 创建时间（精确到日） */}
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            🕐 {formatDateOnly(task.createdAt)} 创建
          </span>
        </div>

        {/* 内联事件时间线 */}
        <motion.div
          animate={{
            height: showTimeline ? 'auto' : 0,
            opacity: showTimeline ? 1 : 0,
          }}
          initial={false}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="border-t border-zinc-100 dark:border-zinc-800" />
          <div className="px-4 pb-3 pt-2 ml-9">
            {taskEvents.length === 0 ? (
              <p className="text-xs text-zinc-400 py-1">暂无事件</p>
            ) : (
              <EventTimeline
                events={taskEvents}
                tasks={allTasks}
                compact
                onToggleComplete={onToggleEventComplete}
                onEditEvent={onEditEvent}
                onDeleteEvent={onDeleteEvent}
                onReorder={handleReorder}
              />
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}