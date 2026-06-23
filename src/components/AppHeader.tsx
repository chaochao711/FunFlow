// src/components/AppHeader.tsx — 共享顶部导航栏（菜单 + Logo + 主题切换）

import { Menu, Sun, Moon } from 'lucide-react';

interface AppHeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
}

export default function AppHeader({ isDark, onToggleTheme, onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <Menu size={20} className="text-zinc-600 dark:text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐟</span>
            <span className="font-bold text-xl text-zinc-900 dark:text-white hidden sm:block">FunFlow</span>
          </div>
        </div>

        <button
          onClick={onToggleTheme}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          {isDark ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-zinc-700" />}
        </button>
      </div>
    </header>
  );
}
