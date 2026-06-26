// src/utils/dateUtils.ts — 相对时间格式化

/** 获取本地日期字符串 YYYY-MM-DD（避免 UTC 时区偏差） */
function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 获取本地时间字符串 HH:mm（24 小时制） */
function localTimeStr(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 获取本地时间字符串 HH:mm:ss（含秒） */
function localTimeStrWithSeconds(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

/** 获取完整本地日期时间（含秒） */
function localFullStr(date: Date): string {
  return `${localDateStr(date)} ${localTimeStrWithSeconds(date)}`;
}

/**
 * 格式化日期为相对时间（不含秒，用于列表视图）
 * - 当天 → "14:30"
 * - 昨天 → "昨天 14:30"
 * - 7天内 → "3天前 14:30"
 * - 更早 → "06-15 14:30"
 */
export function formatRelativeTime(dateStr: string): { display: string; full: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const full = localFullStr(date);

  const todayStr = localDateStr(now);
  const targetStr = localDateStr(date);
  const time = localTimeStr(date);

  if (targetStr === todayStr) {
    return { display: time, full };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays === 1) {
    return { display: `昨天 ${time}`, full };
  } else if (diffDays < 7) {
    return { display: `${diffDays}天前 ${time}`, full };
  } else {
    const d = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { display: `${d} ${time}`, full };
  }
}

/**
 * 格式化日期为相对时间（含秒，用于时间线视图）
 */
export function formatRelativeTimeWithSeconds(dateStr: string): { display: string; full: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const full = localFullStr(date);

  const todayStr = localDateStr(now);
  const targetStr = localDateStr(date);
  const time = localTimeStrWithSeconds(date);

  if (targetStr === todayStr) {
    return { display: time, full };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays === 1) {
    return { display: `昨天 ${time}`, full };
  } else if (diffDays < 7) {
    return { display: `${diffDays}天前 ${time}`, full };
  } else {
    const d = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { display: `${d} ${time}`, full };
  }
}

/**
 * 格式化日期仅为日（用于列表视图展示创建时间）
 * - 明天 → "明天"
 * - 今天 → "今天"
 * - 昨天 → "昨天"
 * - 7天内 → "3天前"
 * - 更早 → "06-15" 或 "2024-06-15"
 */
export function formatDateOnly(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = localDateStr(now);
  const targetStr = localDateStr(date);

  if (targetStr === todayStr) return '今天';

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays === 1) return '昨天';
  if (diffDays === -1) return '明天';
  if (diffDays > 0 && diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)}天后`;

  const sameYear = date.getFullYear() === now.getFullYear();
  const d = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (sameYear) return d;
  return `${date.getFullYear()}-${d}`;
}

/**
 * 按日期分组（基于指定时间字段）
 */
export function groupByDate<T>(items: T[], getTimestamp: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  const sorted = [...items].sort((a, b) =>
    new Date(getTimestamp(b)).getTime() - new Date(getTimestamp(a)).getTime()
  );

  for (const item of sorted) {
    const key = localDateStr(new Date(getTimestamp(item)));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return groups;
}

/**
 * 按指定日期字段分组任务
 */
export function groupTasksByDate<T>(
  items: T[],
  getDate: (item: T) => string | undefined
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  const sorted = [...items].sort((a, b) => {
    const aDate = getDate(a);
    const bDate = getDate(b);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  for (const item of sorted) {
    const date = getDate(item);
    const key = date ? localDateStr(new Date(date)) : 'nodate';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return groups;
}

/**
 * 获取日期分组标签
 */
export function getDateGroupLabel(dateKey: string): string {
  const now = new Date();
  const todayStr = localDateStr(now);
  const yesterdayStr = localDateStr(new Date(now.getTime() - 86400000));

  if (dateKey === todayStr) return '今天';
  if (dateKey === yesterdayStr) return '昨天';

  const targetDate = new Date(dateKey);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 14) return '上周';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;

  return `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
}

// ---- 时间桶分组（今天/昨天/本周/本月/更早） ----

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTimeBucketKey(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = localDateStr(now);
  const targetStr = localDateStr(date);

  if (targetStr === todayStr) return 'today';
  const yesterdayStr = localDateStr(new Date(now.getTime() - 86400000));
  if (targetStr === yesterdayStr) return 'yesterday';

  const monday = getMonday(now);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  if (date >= monday && date <= sunday) return 'thisWeek';

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (date >= firstOfMonth) return 'thisMonth';

  return 'earlier';
}

export const TIME_BUCKET_LABELS: Record<string, string> = {
  today: '今天',
  yesterday: '昨天',
  thisWeek: '本周',
  thisMonth: '本月',
  earlier: '更早',
};

export const TIME_BUCKET_ORDER = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'earlier'] as const;

export function groupByTimeBucket<T>(items: T[], getTimestamp: (item: T) => string | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const key of TIME_BUCKET_ORDER) groups.set(key, []);
  for (const item of items) {
    const ts = getTimestamp(item);
    const key = ts ? getTimeBucketKey(ts) : 'earlier';
    groups.get(key)!.push(item);
  }
  return groups;
}

export function getRemainingDayBucket(remainingDays: number): string {
  if (remainingDays <= 1) return '1天内';
  if (remainingDays <= 3) return '3天内';
  if (remainingDays <= 7) return '7天内';
  return '7天以上';
}

export const REMAINING_BUCKET_ORDER = ['1天内', '3天内', '7天内', '7天以上'];

