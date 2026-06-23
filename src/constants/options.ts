// src/constants/options.ts — 标签颜色和 Emoji 选项常量

export const COLOR_OPTIONS = [
  { name: 'red', class: 'bg-red-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'amber', class: 'bg-amber-500' },
  { name: 'yellow', class: 'bg-yellow-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'emerald', class: 'bg-emerald-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'indigo', class: 'bg-indigo-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'pink', class: 'bg-pink-500' },
] as const;

export const EMOJI_OPTIONS = ['📁', '💼', '🏠', '📚', '💪', '🎨', '💻', '📅', '⚡', '🎯', '🌟', '❤️'] as const;
