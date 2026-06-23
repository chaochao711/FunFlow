// src/components/CalendarView.tsx

import { useRef, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import { Task, Tag } from '../store/useTaskStore';
import { useTaskStore } from '../store/useTaskStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, List, Grid3x3 } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  tags: Tag[];
  onTaskClick: (taskId: string) => void;
}

type ViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

const priorityColors = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
};

const statusColors = {
  pending: '#6b7280',
  'in-progress': '#3b82f6',
  completed: '#22c55e',
};

export default function CalendarView({ tasks, tags, onTaskClick }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('dayGridMonth');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const { updateTask, addHistory } = useTaskStore();

  // 转换任务为 FullCalendar 事件
  const getEvents = () => {
    return tasks
      .filter(task => !task.deleted && task.dueDate)
      .map(task => ({
        id: task.id,
        title: task.title,
        start: task.dueDate,
        end: task.dueDate,
        allDay: true,
        backgroundColor: task.archived ? '#d1d5db' : priorityColors[task.priority],
        borderColor: task.archived ? '#9ca3af' : priorityColors[task.priority],
        textColor: task.archived ? '#6b7280' : '#ffffff',
        extendedProps: {
          task,
          priority: task.priority,
          status: task.status,
          tags: task.tags,
          archived: task.archived,
        },
      }));
  };

  // 处理事件点击
  const handleEventClick = (info: EventClickArg) => {
    const taskId = info.event.id;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setShowTaskDetail(true);
    }
  };

  // 处理日期选择（快速创建任务）
  const handleDateSelect = (info: DateSelectArg) => {
    const selectedDate = info.startStr.split('T')[0];
    // 可以打开快速创建任务弹窗
    console.log('选择日期:', selectedDate);
    // TODO: 打开快速创建任务弹窗，预填截止日期
  };

  // 处理拖拽调整日期
  const handleEventDrop = (info: EventDropArg) => {
    const taskId = info.event.id;
    const newDueDate = info.event.startStr.split('T')[0];
    const task = tasks.find(t => t.id === taskId);

    if (task?.archived) {
      info.revert();
      return;
    }

    if (task && task.dueDate !== newDueDate) {
      updateTask(taskId, { dueDate: newDueDate });
      addHistory(taskId, 'dueDate', task.dueDate, newDueDate);
    }
  };

  // 切换视图
  const changeView = (view: ViewMode) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(view);
      setCurrentView(view);
    }
  };

  // 导航到今天
  const goToToday = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
    }
  };

  // 上一页/下一页
  const goPrev = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.prev();
    }
  };

  const goNext = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.next();
    }
  };

  // 获取当前显示的标题
  const [currentTitle, setCurrentTitle] = useState('');
  
  const handleDatesSet = (info: any) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      setCurrentTitle(calendarApi.view.title);
    }
  };

  // 获取标签显示
  const getTagDisplay = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return '';
    return tag.colorType === 'emoji' ? tag.emoji : tag.name.slice(0, 2);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* 日历工具栏 */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            今天
          </button>
          <button
            onClick={goNext}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <span className="text-lg font-semibold text-zinc-900 dark:text-white ml-2">
            {currentTitle}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => changeView('dayGridMonth')}
            className={`p-1.5 rounded-md transition-all ${
              currentView === 'dayGridMonth'
                ? 'bg-white dark:bg-zinc-700 shadow text-violet-600 dark:text-violet-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title="月视图"
          >
            <Grid3x3 size={16} />
          </button>
          <button
            onClick={() => changeView('timeGridWeek')}
            className={`p-1.5 rounded-md transition-all ${
              currentView === 'timeGridWeek'
                ? 'bg-white dark:bg-zinc-700 shadow text-violet-600 dark:text-violet-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title="周视图"
          >
            <CalendarIcon size={16} />
          </button>
          <button
            onClick={() => changeView('timeGridDay')}
            className={`p-1.5 rounded-md transition-all ${
              currentView === 'timeGridDay'
                ? 'bg-white dark:bg-zinc-700 shadow text-violet-600 dark:text-violet-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title="日视图"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* FullCalendar 组件 */}
      <div className="calendar-container">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          headerToolbar={false}
          initialView={currentView}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={3}
          weekends={true}
          events={getEvents()}
          eventClick={handleEventClick}
          select={handleDateSelect}
          eventDrop={handleEventDrop}
          datesSet={handleDatesSet}
          locale="zh-cn"
          buttonText={{
            today: '今天',
            month: '月',
            week: '周',
            day: '日',
          }}
          eventContent={(eventInfo) => {
            const task = eventInfo.event.extendedProps.task as Task;
            const priority = eventInfo.event.extendedProps.priority;
            const isArchived = eventInfo.event.extendedProps.archived;

            return (
              <div className={`flex items-center gap-1 overflow-hidden px-1 py-0.5 rounded text-xs ${isArchived ? 'opacity-80' : ''}`}>
                {isArchived ? (
                  <span className="flex-shrink-0">📦</span>
                ) : (
                  <span className="flex-shrink-0">
                    {priority === 'high' ? '🔥' : priority === 'medium' ? '⭐' : '🌱'}
                  </span>
                )}
                <span className={`truncate flex-1 ${isArchived ? 'line-through' : ''}`}>{eventInfo.event.title}</span>
                {task.tags && task.tags.length > 0 && (
                  <span className="flex-shrink-0 text-[10px] opacity-70">
                    {task.tags.slice(0, 2).map(tagId => getTagDisplay(tagId)).join('')}
                  </span>
                )}
              </div>
            );
          }}
          height="calc(100vh - 250px)"
        />
      </div>

      {/* 任务详情弹窗 */}
      <AnimatePresence>
        {showTaskDetail && selectedTask && (
          <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowTaskDetail(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">任务详情</h3>
                <button
                  onClick={() => setShowTaskDetail(false)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">
                <h4 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">
                  {selectedTask.title}
                </h4>
                {selectedTask.description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    {selectedTask.description}
                  </p>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 w-20">优先级:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      selectedTask.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      selectedTask.priority === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }`}>
                      {selectedTask.priority === 'high' ? '🔥 高' : selectedTask.priority === 'medium' ? '⭐ 中' : '🌱 低'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 w-20">状态:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      selectedTask.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                      selectedTask.status === 'in-progress' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {selectedTask.status === 'pending' ? '待处理' : selectedTask.status === 'in-progress' ? '进行中' : '已完成'}
                    </span>
                  </div>
                  {selectedTask.dueDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 dark:text-zinc-400 w-20">截止日期:</span>
                      <span>{selectedTask.dueDate}</span>
                    </div>
                  )}
                  {selectedTask.tags && selectedTask.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-zinc-500 dark:text-zinc-400 w-20">标签:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedTask.tags.map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag && (
                            <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                              {tag.colorType === 'emoji' ? tag.emoji : '📌'} {tag.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => {
                    onTaskClick(selectedTask.id);
                    setShowTaskDetail(false);
                  }}
                  className="flex-1 py-2 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors"
                >
                  编辑任务
                </button>
                <button
                  onClick={() => setShowTaskDetail(false)}
                  className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}