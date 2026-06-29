// src/components/CalendarView.test.ts — 日历视图渲染逻辑测试

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCalendarEvents, clampPanelPosition } from './CalendarView';
import type { Task } from '../store/useTaskStore';

// ========== 辅助工厂函数 ==========

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  const now = '2026-06-24T10:00:00.000Z';
  return {
    title: 'Test Task',
    description: '',
    dueDate: undefined,
    priority: 'medium',
    status: 'pending',
    tags: [],
    createdAt: now,
    updatedAt: now,
    archived: false,
    deleted: false,
    history: [],
    ...overrides,
  } as Task;
}

// ========== buildCalendarEvents ==========

describe('buildCalendarEvents', () => {
  it('返回空数组当 tasks 为空', () => {
    expect(buildCalendarEvents([])).toEqual([]);
  });

  it('跳过已删除的任务', () => {
    const tasks = [
      makeTask({ id: '1', deleted: true, createdAt: '2026-06-20T00:00:00.000Z' }),
      makeTask({ id: '2', deleted: false, createdAt: '2026-06-21T00:00:00.000Z' }),
    ];
    const events = buildCalendarEvents(tasks);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('2');
  });

  it('跳过无 createdAt 的任务', () => {
    const tasks = [
      makeTask({ id: '1', createdAt: '' }),
      makeTask({ id: '2', createdAt: '2026-06-21T00:00:00.000Z' }),
    ];
    const events = buildCalendarEvents(tasks);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('2');
  });

  describe('活跃任务', () => {
    it('从 createdAt 跨到 dueDate+1 天', () => {
      const tasks = [
        makeTask({
          id: '1',
          createdAt: '2026-06-20T00:00:00.000Z',
          dueDate: '2026-06-22',
          status: 'in-progress',
        }),
      ];
      const events = buildCalendarEvents(tasks);
      expect(events).toHaveLength(1);
      expect(events[0].start).toBe('2026-06-20');
      expect(events[0].end).toBe('2026-06-23'); // dueDate + 1
      expect(events[0].allDay).toBe(true);
    });

    it('无 dueDate 时，end 为 startDate + 1', () => {
      const tasks = [
        makeTask({
          id: '1',
          createdAt: '2026-06-20T00:00:00.000Z',
          dueDate: undefined,
          status: 'pending',
        }),
      ];
      const events = buildCalendarEvents(tasks);
      expect(events).toHaveLength(1);
      expect(events[0].start).toBe('2026-06-20');
      expect(events[0].end).toBe('2026-06-21');
    });

    it('按状态着色', () => {
      const cases: Array<[string, string]> = [
        ['pending', '#f97316'],
        ['in-progress', '#3b82f6'],
        ['completed', '#22c55e'],
      ];
      for (const [status, color] of cases) {
        const tasks = [makeTask({ id: status, status: status as Task['status'], createdAt: '2026-06-20T00:00:00.000Z' })];
        const events = buildCalendarEvents(tasks);
        expect(events[0].backgroundColor).toBe(color);
        expect(events[0].borderColor).toBe(color);
      }
    });

    it('已完成任务为白色文字 + opacity-70', () => {
      const tasks = [makeTask({ id: '1', status: 'completed', createdAt: '2026-06-20T00:00:00.000Z' })];
      const events = buildCalendarEvents(tasks);
      expect(events[0].textColor).toBe('#ffffff');
      expect(events[0].classNames).toContain('opacity-70');
    });

    it('未完成活跃任务不含 opacity-70', () => {
      const tasks = [makeTask({ id: '1', status: 'pending', createdAt: '2026-06-20T00:00:00.000Z' })];
      const events = buildCalendarEvents(tasks);
      expect(events[0].classNames).toEqual([]);
    });

    it('extendedProps 标记 archived: false', () => {
      const tasks = [makeTask({ id: '1', createdAt: '2026-06-20T00:00:00.000Z' })];
      const events = buildCalendarEvents(tasks);
      expect(events[0].extendedProps).toEqual({ task: tasks[0], archived: false });
    });
  });

  describe('归档任务', () => {
    it('从 createdAt 跨到 dueDate+1 的灰条', () => {
      const tasks = [
        makeTask({
          id: '1',
          archived: true,
          createdAt: '2026-06-15T00:00:00.000Z',
          dueDate: '2026-06-18',
        }),
      ];
      const events = buildCalendarEvents(tasks);
      expect(events).toHaveLength(1);
      expect(events[0].start).toBe('2026-06-15'); // createdAt
      expect(events[0].end).toBe('2026-06-19');   // dueDate + 1
      expect(events[0].allDay).toBe(true);
      expect(events[0].backgroundColor).toBe('#d1d5db');
      expect(events[0].classNames).toContain('opacity-70');
    });

    it('无 dueDate 时 end = createdAt + 1', () => {
      const tasks = [
        makeTask({
          id: '1',
          archived: true,
          createdAt: '2026-06-15T00:00:00.000Z',
          dueDate: undefined,
        }),
      ];
      const events = buildCalendarEvents(tasks);
      expect(events[0].start).toBe('2026-06-15');
      expect(events[0].end).toBe('2026-06-16'); // start + 1
    });

    it('extendedProps 标记 archived: true', () => {
      const tasks = [makeTask({ id: '1', archived: true, createdAt: '2026-06-15T00:00:00.000Z' })];
      const events = buildCalendarEvents(tasks);
      expect(events[0].extendedProps).toEqual({ task: tasks[0], archived: true });
    });
  });

  describe('混合场景', () => {
    it('活跃 + 归档 + 已删除 混合正确', () => {
      const tasks = [
        makeTask({ id: 'active', createdAt: '2026-06-20T00:00:00.000Z', status: 'in-progress' }),
        makeTask({ id: 'archived', archived: true, createdAt: '2026-06-15T00:00:00.000Z' }),
        makeTask({ id: 'deleted', deleted: true, createdAt: '2026-06-10T00:00:00.000Z' }),
      ];
      const events = buildCalendarEvents(tasks);
      expect(events).toHaveLength(2);
      expect(events.map(e => e.id).sort()).toEqual(['active', 'archived']);
    });
  });

  it('memo 引用稳定性：相同输入返回新对象但内容一致', () => {
    const tasks = [
      makeTask({ id: '1', createdAt: '2026-06-20T00:00:00.000Z' }),
      makeTask({ id: '2', createdAt: '2026-06-21T00:00:00.000Z', archived: true }),
    ];
    const a = buildCalendarEvents(tasks);
    const b = buildCalendarEvents(tasks);
    expect(a).not.toBe(b);          // 新数组
    expect(a).toEqual(b);           // 内容一致
  });
});

// ========== clampPanelPosition ==========

describe('clampPanelPosition', () => {
  const defaultW = 360;
  const defaultH = 200;
  const vw = 1920;
  const vh = 1080;

  it('正常情况下贴锚点下方 4px', () => {
    const { left, top } = clampPanelPosition(500, 400, defaultW, defaultH, vw, vh);
    expect(left).toBe(500 - defaultW / 2);
    expect(top).toBe(404); // 400 + 4
  });

  it('X 左边界：不溢出左侧', () => {
    const { left } = clampPanelPosition(50, 400, defaultW, defaultH, vw, vh);
    expect(left).toBe(8);
  });

  it('X 右边界：不溢出右侧', () => {
    const { left } = clampPanelPosition(1900, 400, defaultW, defaultH, vw, vh);
    expect(left).toBe(vw - defaultW - 16);
  });

  it('下方溢出时上翻到事件条上方', () => {
    // anchorY=1000, estimatedH=200: 1000 + 4 + 200 = 1204 > 1080 → 上翻
    const { top } = clampPanelPosition(500, 1000, defaultW, defaultH, vw, vh);
    // aboveTop = 1000 - 200 - 4 = 796 ≥ 8 → 放上方
    expect(top).toBe(796);
    expect(top).toBeLessThan(1000); // 面板在锚点上方
  });

  it('下方未溢出时保持下方', () => {
    // anchorY=800, estimatedH=200: 800 + 4 + 200 = 1004 < 1080 → 下方
    const { top } = clampPanelPosition(500, 800, defaultW, defaultH, vw, vh);
    expect(top).toBe(804); // 800 + 4
  });

  it('两侧都溢出时 clamp 到视口边距', () => {
    // anchorY=500, estimatedPanelH=1080（巨大面板）:
    //   belowTop=504+1080>1072 → 下方溢出
    //   aboveTop=500-1080-4=-584<8 → 上方也不够
    //   → clamp: top = max(8, min(504, 1080-1080-8=-8)) = 8
    const { top } = clampPanelPosition(500, 500, defaultW, 1080, vw, vh);
    expect(top).toBe(8);
  });

  it('estimatedPanelH 越大越容易触发上翻', () => {
    // anchorY=950, estH=100: belowTop=954+100=1054<1080 → 下方
    const below = clampPanelPosition(500, 950, defaultW, 100, vw, vh);
    expect(below.top).toBe(954);

    // anchorY=950, estH=200: belowTop=954+200=1154>1080 → 上翻
    const above = clampPanelPosition(500, 950, defaultW, 200, vw, vh);
    expect(above.top).toBeLessThan(950);
  });

  it('面板宽度可自定义', () => {
    const { left } = clampPanelPosition(500, 400, 200, defaultH, vw, vh);
    expect(left).toBe(500 - 100);
  });

  it('无 viewport 参数时使用 window 尺寸', () => {
    const { left, top } = clampPanelPosition(500, 400);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBe(404);
  });
});
