// src/components/UserMenu.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User, LogOut, Settings, ChevronDown, Mail, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    // 刷新页面
    window.location.reload();
  };

  if (!user) return null;

  // 获取用户邮箱的显示名
  const displayName = user.email?.split('@')[0] || '用户';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
          {userInitial}
        </div>
        <span className="hidden sm:inline text-sm text-zinc-700 dark:text-zinc-300">
          {displayName}
        </span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-12 w-64 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-white font-medium">
                    {userInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                      <Mail size={10} />
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <div className="px-3 py-2 text-xs text-zinc-400 flex items-center gap-2">
                  <Clock size={12} />
                  注册时间: {new Date(user.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800 p-2">
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )}
                  退出登录
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}