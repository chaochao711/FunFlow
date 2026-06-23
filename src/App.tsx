// src/App.tsx — 应用根组件（认证守卫 + 云同步 + 三视图路由）

import { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import Auth from './components/Auth';
import { useTaskStore } from './store/useTaskStore';
import { useEventStore } from './store/useEventStore';
import { loadTasksFromCloud, loadTagsFromCloud, syncTasksToCloud, syncTagsToCloud } from './services/syncService';
import { loadEventsFromCloud, syncEventsToCloud } from './services/eventSyncService';
import { recoverInvalidTags } from './utils/recoverInvalidTags';
import { subscribeToRealtime } from './services/realtimeSync';
import { purgeExpiredTrash } from './services/syncService';
import MainPage from './views/MainPage';
import ArchivePage from './views/ArchivePage';
import TrashPage from './views/TrashPage';

function App() {
  const {
    tasks,
    tags,
    showArchived,
    showTrash,
    setTasks,
    setTags,
  } = useTaskStore();
  const { events, setEvents } = useEventStore();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);

  // ========== 认证 + 数据加载 ==========
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        loadUserData(session.user.id);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    if (!userId) return;
    try {
      const [cloudTasks, cloudTags] = await Promise.all([
        loadTasksFromCloud(userId),
        loadTagsFromCloud(userId),
      ]);

      // 合并：云端数据为主，但保留本地有而云端没有的任务（离线创建等）
      const localTasks = useTaskStore.getState().tasks;
      const mergedMap = new Map(localTasks.map(t => [t.id, t]));
      for (const ct of cloudTasks || []) {
        mergedMap.set(ct.id, ct); // 云端版本优先（覆盖同 ID 的旧本地数据）
      }
      const mergedTasks = Array.from(mergedMap.values());
      const finalTags = recoverInvalidTags(mergedTasks, cloudTags);
      setTasks(mergedTasks);
      setTags(finalTags);

      // 页面加载时清理云端已过期回收站任务（7 天）
      purgeExpiredTrash(userId);

      // 事件加载：与本地合并，保留本地有而云端没有的事件
      loadEventsFromCloud(userId)
        .then(data => {
          if (data && data.length > 0) {
            const localEvents = useEventStore.getState().events;
            const mergedMap = new Map(localEvents.map(e => [e.id, e]));
            for (const ce of data) {
              mergedMap.set(ce.id, ce);
            }
            setEvents(Array.from(mergedMap.values()));
          }
        })
        .catch(err => console.warn('事件加载失败，使用本地数据'));
    } catch (error) {
      console.error('加载云端数据失败:', error);
    }
  };

  // ========== 云同步（300ms 防抖，增量发送脏数据） ==========
  useEffect(() => {
    if (!session?.user?.id) return;
    const timer = setTimeout(async () => {
      try {
        await Promise.all([
          syncTasksToCloud(session.user.id, tasks),
          syncTagsToCloud(session.user.id, tags),
          syncEventsToCloud(session.user.id, events),
        ]);
      } catch (err) {
        console.error('同步失败:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tasks, tags, events, session]);

  // ========== Realtime 多标签页/多设备实时同步 ==========
  useEffect(() => {
    if (!session?.user?.id) return;
    const unsubscribe = subscribeToRealtime(session.user.id);
    return unsubscribe;
  }, [session?.user?.id]);

  // ========== 主题初始化 ==========
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // ========== 加载中 ==========
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐟</div>
          <p className="text-zinc-500 dark:text-zinc-400">加载中...</p>
        </div>
      </div>
    );
  }

  // ========== 未登录 ==========
  if (!session) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  // ========== 三视图路由 ==========
  if (showTrash) {
    return <TrashPage isDark={isDark} onToggleTheme={toggleTheme} />;
  }

  if (showArchived) {
    return <ArchivePage isDark={isDark} onToggleTheme={toggleTheme} />;
  }

  return <MainPage isDark={isDark} onToggleTheme={toggleTheme} />;
}

export default App;
