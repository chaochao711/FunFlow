// src/utils/tagUtils.ts — 标签相关的共享工具函数

import type { Tag } from '../store/useTaskStore';

/**
 * 获取标签的显示内容（emoji 或颜色圆点）
 */
export function getTagDisplay(tag: Tag): string {
  if (tag.colorType === 'emoji') {
    return tag.emoji || '📌';
  }
  return '●';
}

/**
 * 获取标签的颜色 CSS 类名
 */
export function getTagColorClass(tag: Tag): string {
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
}

/**
 * 获取标签的完整路径名（如 "工作 / 开发"）
 */
export function getTagDisplayName(tagId: string, tags: Tag[]): string {
  const tag = tags.find(t => t.id === tagId);
  if (!tag) return tagId;

  const getPath = (t: Tag): string[] => {
    if (!t.parentId) return [t.name];
    const parent = tags.find(p => p.id === t.parentId);
    return parent ? [...getPath(parent), t.name] : [t.name];
  };

  return getPath(tag).join(' / ');
}
