// src/components/CalendarView.tsx — 日历视图（甘特条 + 可交互悬停面板）

import { useRef, useState, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import { Task, Tag } from '../store/useTaskStore';
import { useTaskStore } from '../store/useTaskStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, List, Grid3x3, Plus } from 'lucide-react';
import { formatDateOnly } from '../utils/dateUtils';
import EventTimeline from './EventTimeline';
import CreateEventModal from './CreateEventModal';
import { useEventStore } from '../store/useEventStore';
import type { TaskEvent } from '../store/useEventStore';

interface CalendarViewProps {
  tasks: Task[];
  tags: Tag[];
  onTaskClick: (taskId: string) => void;
}

type ViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

const statusColors: Record<string, string> = {
  pending: '#f97316',      // orange-500（与任务卡片一致）
  'in-progress': '#3b82f6', // blue-500
  completed: '#22c55e',     // green-500
};

const priorityConfig: Record<string, { icon: string; label: string }> = {
  high: { icon: '🔥', label: '高' },
  medium: { icon: '⭐', label: '中' },
  low: { icon: '🌱', label: '低' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '未开始', color: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800' },
  'in-progress': { label: '进行中', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  completed: { label: '已完成', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
};

export default function CalendarView({ tasks, tags, onTaskClick }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('dayGridMonth');
  const { updateTask } = useTaskStore();
  const { events: allEvents, getEventsByTask, addEvent, updateEvent, deleteEvent, toggleEventComplete, reorderEvents } = useEventStore();

  // ========== 悬浮面板 ==========
  const [panelTask, setPanelTask] = useState<Task | null>(null);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [showPanel, setShowPanel] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelTaskIdRef = useRef<string | null>(null);
  const catchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSwitchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseInPanelRef = useRef(false);
  const isMouseOnEventRef = useRef(false); // 鼠标是否仍在 FullCalendar 事件条上

  const clearTimers = () => {
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (catchTimerRef.current) { clearTimeout(catchTimerRef.current); catchTimerRef.current = null; }
    if (pendingSwitchRef.current) { clearTimeout(pendingSwitchRef.current); pendingSwitchRef.current = null; }
  };

  // ── 事件鼠标进出：悬停 150ms 弹出面板；面板仅在鼠标离开事件条 AND 面板时隐藏 ──
  const handleEventMouseEnter = useCallback((info: any) => {
    const task = info.event.extendedProps.task as Task;
    if (!task) return;

    isMouseOnEventRef.current = true;

    // 同一任务面板已在展示 → 仅取消待处理的隐藏定时器，不做其他操作
    if (panelTaskIdRef.current === task.id) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      // 取消捕获定时器（鼠标回到了事件条上）
      if (catchTimerRef.current) {
        clearTimeout(catchTimerRef.current);
        catchTimerRef.current = null;
      }
      return;
    }

    const rect = info.el.getBoundingClientRect();

    // 当前面板正在显示另一个任务 → 不立即切换，停留 800ms 后才切换
    // 避免鼠标移向面板途中经过其他任务导致面板误切
    if (panelTaskIdRef.current !== null) {
      if (pendingSwitchRef.current) {
        clearTimeout(pendingSwitchRef.current);
      }
      pendingSwitchRef.current = setTimeout(() => {
        pendingSwitchRef.current = null;
        setShowPanel(false);
        setPanelTask(null);
        panelTaskIdRef.current = null;
        isMouseInPanelRef.current = false;
        showTimerRef.current = setTimeout(() => {
          setPanelPos({ x: rect.left + rect.width / 2, y: rect.bottom });
          setPanelTask(task);
          setShowPanel(true);
          showTimerRef.current = null;
          panelTaskIdRef.current = task.id;
        }, 150);
      }, 300);
      return;
    }

    // 面板正在自动隐藏倒计时中 → 不打断
    if (hideTimerRef.current) return;

    // ── 正常流程：无面板 → 悬停 150ms 后弹出 ──
    clearTimers();
    panelTaskIdRef.current = task.id;
    showTimerRef.current = setTimeout(() => {
      setPanelPos({ x: rect.left + rect.width / 2, y: rect.bottom });
      setPanelTask(task);
      setShowPanel(true);
	        showTimerRef.current = null;
      isMouseInPanelRef.current = false;
    }, 150);
  }, []);

  const handleEventMouseLeave = useCallback(() => {
    isMouseOnEventRef.current = false;

    // 鼠标离开事件 → 取消 pending 切换
    if (pendingSwitchRef.current) {
      clearTimeout(pendingSwitchRef.current);
      pendingSwitchRef.current = null;
    }

    if (showTimerRef.current) {
      // 面板还没弹出 → 取消
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
      clearTimers();
      panelTaskIdRef.current = null;
      return;
    }

    // 面板已弹出 → 启动 300ms 关闭倒计时
    if (panelTaskIdRef.current) {
      if (catchTimerRef.current) clearTimeout(catchTimerRef.current);
      catchTimerRef.current = setTimeout(() => {
        catchTimerRef.current = null;
        if (!isMouseInPanelRef.current && !isMouseOnEventRef.current) {
          setShowPanel(false);
          setPanelTask(null);
          panelTaskIdRef.current = null;
        }
      }, 300);
    }
  }, []);

  // ── 面板鼠标进出 ──
  const handlePanelMouseEnter = useCallback(() => {
    isMouseInPanelRef.current = true;
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (catchTimerRef.current) { clearTimeout(catchTimerRef.current); catchTimerRef.current = null; }
    if (pendingSwitchRef.current) { clearTimeout(pendingSwitchRef.current); pendingSwitchRef.current = null; }
  }, []);

  const handlePanelMouseLeave = useCallback(() => {
    isMouseInPanelRef.current = false;
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setShowPanel(false);
      setPanelTask(null);
      panelTaskIdRef.current = null;
    }, 300);
  }, []);

  // ========== 事件编辑 ==========
  const [editEventData, setEditEventData] = useState<TaskEvent | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // ========== 日历事件转换（导出供测试） ==========

  const calendarEvents = useMemo(() => buildCalendarEvents(tasks), [tasks]);

  // ========== 日历交互 ==========

  const handleEventClick = useCallback((info: EventClickArg) => {
    const taskId = info.event.id;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setShowPanel(false);
      setPanelTask(null);
      onTaskClick(taskId);
    }
  }, [tasks, onTaskClick]);

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    console.log('选择日期:', info.startStr.split('T')[0]);
  }, []);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const taskId = info.event.id;
    const task = tasks.find(t => t.id === taskId);
    if (task?.archived) { info.revert(); return; }
    const originalStart = task?.createdAt?.split('T')[0];
    if (originalStart && info.event.startStr.split('T')[0] !== originalStart) {
      info.revert();
    }
  }, [tasks]);

  const handleEventResize = useCallback((info: any) => {
    const taskId = info.event.id;
    const task = tasks.find(t => t.id === taskId);
    if (task?.archived) { info.revert(); return; }
    const endDate = new Date(info.event.endStr.split('T')[0]);
    endDate.setDate(endDate.getDate() - 1);
    const newDueDate = endDate.toISOString().split('T')[0];
    if (task && task.dueDate !== newDueDate) {
      updateTask(taskId, { dueDate: newDueDate });
    }
  }, [tasks, updateTask]);

  const handleAddEvent = useCallback(() => {
    setShowCreateEvent(true);
  }, []);

  const changeView = (view: ViewMode) => {
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(view);
      setCurrentView(view);
    }
  };

  const goToToday = () => calendarRef.current?.getApi().today();
  const goPrev = () => calendarRef.current?.getApi().prev();
  const goNext = () => calendarRef.current?.getApi().next();

  const [currentTitle, setCurrentTitle] = useState('');
  const handleDatesSet = useCallback(() => {
    if (calendarRef.current) setCurrentTitle(calendarRef.current.getApi().view.title);
  }, []);

  const getTagDisplay = useCallback((tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    return tag ? (tag.colorType === 'emoji' ? tag.emoji : tag.name.slice(0, 2)) : '';
  }, [tags]);

  // 日历组件（memoized：仅当 view/events/callbacks/tags 变化时重建，避免事件变更等无关渲染引发 FullCalendar 重初始化）
  const calendarComponent = useMemo(() => (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      headerToolbar={false}
      initialView={currentView}
      editable={true}
      eventStartEditable={false}
      eventDurationEditable={true}
      selectable={true}
      selectMirror={true}
      dayMaxEvents={6}
      weekends={true}
      events={calendarEvents}
      eventClick={handleEventClick}
      select={handleDateSelect}
      eventDrop={handleEventDrop}
      eventResize={handleEventResize}
      eventMouseEnter={handleEventMouseEnter}
      eventMouseLeave={handleEventMouseLeave}
      datesSet={handleDatesSet}
      dayCellDidMount={(info: any) => {
        const cellDate = info.date.toISOString().split('T')[0];
        const eventCount = calendarEvents.filter(e => {
          const start = e.start as string;
          if (!e.end) return cellDate === start;
          return cellDate >= start && cellDate < (e.end as string);
        }).length;
        const BAR_H = 22;
        const minBars = eventCount === 0 ? 2 : Math.min(eventCount, 6);
        info.el.style.minHeight = `${10 + minBars * BAR_H}px`;
      }}
      locale="zh-cn"
      buttonText={{ today: '今天', month: '月', week: '周', day: '日' }}
      eventContent={(eventInfo: any) => {
        const task = eventInfo.event.extendedProps.task as Task;
        const isArchived = eventInfo.event.extendedProps.archived;
        return (
          <div className="flex items-center gap-1 overflow-hidden px-1 py-0.5 rounded text-xs w-full">
            {isArchived ? <span className="flex-shrink-0">📦</span> : <span className="flex-shrink-0">{priorityConfig[task.priority]?.icon || '📋'}</span>}
            <span className="truncate min-w-0 flex-1">{eventInfo.event.title}</span>
            {task.tags?.length > 0 && (
              <span className="flex-shrink-0 text-[10px] opacity-70 hidden sm:inline">{task.tags.slice(0, 2).map((t: string) => getTagDisplay(t)).filter(Boolean).join('')}</span>
            )}
          </div>
        );
      }}
      height="auto"
    />
  ), [currentView, calendarEvents, handleEventClick, handleDateSelect, handleEventDrop, handleEventResize, handleEventMouseEnter, handleEventMouseLeave, handleDatesSet, getTagDisplay]);

  // 面板定位：根据实际事件数估算高度，优先下方 → 溢出则上翻 → 两侧都溢出则 clamp
  const panelEventCount = panelTask ? allEvents.filter(e => e.taskId === panelTask.id).length : 0;
  const estimatedPanelH = Math.min(140 + panelEventCount * 36, 400);
  const { left: panelX, top: panelY } = clampPanelPosition(panelPos.x, panelPos.y, 360, estimatedPanelH);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
      {/* 日历工具栏 */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><ChevronLeft size={18} /></button>
          <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">今天</button>
          <button onClick={goNext} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><ChevronRight size={18} /></button>
          <span className="text-lg font-semibold text-zinc-900 dark:text-white ml-2">{currentTitle}</span>
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {(['dayGridMonth', 'timeGridWeek', 'timeGridDay'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => changeView(v)}
              className={`p-1.5 rounded-md transition-all ${currentView === v ? 'bg-white dark:bg-zinc-700 shadow text-violet-600 dark:text-violet-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
              {v === 'dayGridMonth' ? <Grid3x3 size={16} /> : v === 'timeGridWeek' ? <CalendarIcon size={16} /> : <List size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* FullCalendar（memoized，面板显隐不重绘） */}
      <div className="calendar-container">
        {calendarComponent}
      </div>

      {/* ========== 悬停面板（可交互） ========== */}
      <AnimatePresence>
        {showPanel && panelTask && (
          <motion.div
            initial={{ opacity: 0, y: -12, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -12, scaleY: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed z-[100] w-[360px] bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden max-h-[calc(100vh-16px)]"
            style={{ left: panelX, top: panelY, transformOrigin: 'top center' }}
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
          >
            {/* 头部信息 */}
            <div className="p-3 pb-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-zinc-900 dark:text-white text-sm leading-tight break-words flex-1">{panelTask.title}</h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowPanel(false);
                      setPanelTask(null);
                      onTaskClick(panelTask.id);
                    }}
                    className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    title="编辑任务"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusConfig[panelTask.status]?.color || ''}`}>
                    {statusConfig[panelTask.status]?.label || '未知'}
                  </span>
                </div>
              </div>

              {/* 信息行 */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                <span className="text-xs text-zinc-400">{priorityConfig[panelTask.priority]?.icon} {priorityConfig[panelTask.priority]?.label}</span>
                <span className="text-xs text-zinc-400">🕐 {formatDateOnly(panelTask.createdAt)} 创建</span>
                {panelTask.dueDate && <span className="text-xs text-zinc-400">📅 {panelTask.dueDate}</span>}
                {panelTask.createdBy && <span className="text-xs text-zinc-400">👤 {panelTask.createdBy}</span>}
              </div>

              {/* 标签 */}
              {panelTask.tags && panelTask.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {panelTask.tags.slice(0, 5).map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag && (
                      <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                        {tag.colorType === 'emoji' ? tag.emoji : '📌'} {tag.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 分隔 + 添加事件按钮 */}
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">事件时间线</span>
              <button
                onClick={handleAddEvent}
                className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 flex items-center gap-0.5"
              >
                <Plus size={10} /> 添加
              </button>
            </div>

            {/* 事件时间线 */}
            <div className="px-3 pb-3 max-h-[240px] overflow-y-auto">
              <EventTimeline
                events={getEventsByTask(panelTask.id)}
                tasks={tasks}
                compact
                onToggleComplete={(id) => toggleEventComplete(id)}
                onEditEvent={(evt) => setEditEventData(evt)}
                onDeleteEvent={(id) => { if (confirm('删除此事件？')) deleteEvent(id); }}
                onReorder={(orderedIds) => reorderEvents(panelTask.id, orderedIds)}
              />
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== 新建/编辑事件弹窗 ========== */}
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
        defaultType="note"
        initialTaskId={panelTask?.id || ''}
        taskOptions={tasks.filter(t => !t.archived && !t.deleted).map(t => ({ id: t.id, title: t.title }))}
      />

      <CreateEventModal
        isOpen={editEventData !== null}
        onClose={() => setEditEventData(null)}
        onCreate={() => {}}
        onUpdate={(id, updates) => {
          updateEvent(id, updates);
          setEditEventData(null);
        }}
        mode="edit"
        editEvent={editEventData}
      />
    </div>
  );
}

// ========== 导出辅助函数（供测试） ==========

/**
 * 将任务列表转换为 FullCalendar 事件数据。
 * - 已删除任务：跳过
 * - 已归档任务：从 createdAt 跨到 dueDate+1 的灰条（与活跃任务同跨日逻辑，颜色区分）
 * - 活跃任务：从 createdAt 跨到 dueDate+1 的色条（按状态着色）
 */
export function buildCalendarEvents(tasks: Task[]): import('@fullcalendar/core').EventInput[] {
  const result: import('@fullcalendar/core').EventInput[] = [];
  for (const task of tasks.filter(t => !t.deleted)) {
    const startDate = task.createdAt?.split('T')[0];
    if (!startDate) continue;

    const endDate = task.dueDate || startDate;
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    if (task.archived) {
      result.push({
        id: task.id,
        title: task.title,
        start: startDate,
        end: end.toISOString().split('T')[0],
        allDay: true,
        backgroundColor: '#d1d5db',
        borderColor: '#9ca3af',
        textColor: '#6b7280',
        classNames: ['opacity-70'],
        extendedProps: { task, archived: true },
      });
      continue;
    }

    const color = statusColors[task.status] || '#6b7280';

    result.push({
      id: task.id,
      title: task.title,
      start: startDate,
      end: end.toISOString().split('T')[0],
      allDay: true,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      classNames: task.status === 'completed' ? ['opacity-70'] : [],
      extendedProps: { task, archived: false },
    });
  }
  return result;
}

/**
 * 计算悬停面板的 fixed 定位坐标，优先下方 → 下方溢出则上翻 → 两侧都溢出则 clamp 到视口内。
 * @param anchorX 锚点 X（事件条中心）
 * @param anchorY 锚点 Y（事件条底边）
 * @param panelW 面板宽度（默认 360）
 * @param estimatedPanelH 面板预估高度（默认 200，用于判断是否溢出）
 * @param viewportW 视口宽度（默认取 window.innerWidth）
 * @param viewportH 视口高度（默认取 window.innerHeight）
 */
export function clampPanelPosition(
  anchorX: number,
  anchorY: number,
  panelW: number = 360,
  estimatedPanelH: number = 200,
  viewportW?: number,
  viewportH?: number,
): { left: number; top: number } {
  const vw = viewportW ?? (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const vh = viewportH ?? (typeof window !== 'undefined' ? window.innerHeight : 1080);
  const GAP = 4;
  const MARGIN = 8;

  const clampLeft = Math.max(MARGIN, Math.min(anchorX - panelW / 2, vw - panelW - MARGIN * 2));

  // 所有路径最终保证 panel 底部不超出视口
  const clampBottom = (t: number) => Math.min(t, vh - estimatedPanelH - MARGIN);

  // 1) 优先放在事件条下方
  const belowTop = anchorY + GAP;
  if (belowTop + estimatedPanelH <= vh - MARGIN) {
    return { left: clampLeft, top: belowTop };
  }

  // 2) 下方溢出 → 尝试上翻到事件条上方
  const aboveTop = anchorY - estimatedPanelH - GAP;
  if (aboveTop >= MARGIN) {
    return { left: clampLeft, top: aboveTop };
  }

  // 3) 两侧都溢出 → 下方显示 + 强制 clamp 到视口内
  return { left: clampLeft, top: Math.max(MARGIN, clampBottom(belowTop)) };
}
