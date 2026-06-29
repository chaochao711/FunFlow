// src/App.tsx — 应用根组件（认证守卫 + 云同步 + 三视图路由）

import { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import Auth from './components/Auth';
import { useTaskStore, Person } from './store/useTaskStore';
import { useEventStore } from './store/useEventStore';
import { useSyncStore } from './store/useSyncStore';
import { setPersistUserId } from './store/persistStorage';
import { loadTasksFromCloud, loadTagsFromCloud, loadPeopleFromCloud, loadTrashFromCloud, syncTasksToCloud, syncTagsToCloud, syncPeopleToCloud } from './services/syncService';
import { loadEventsFromCloud, syncEventsToCloud } from './services/eventSyncService';
import { recoverInvalidTags } from './utils/recoverInvalidTags';
import { subscribeToRealtime } from './services/realtimeSync';
import { purgeExpiredTrash, TRASH_RETENTION_DAYS } from './services/syncService';
import MainPage from './views/MainPage';
import ArchivePage from './views/ArchivePage';
import TrashPage from './views/TrashPage';

function App() {
  const {
    tasks,
    tags,
    people,
    showArchived,
    showTrash,
    setTasks,
    setTags,
    setPeople,
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

      if (_event === 'SIGNED_OUT') {
        // 用户登出：先切 persist scope 到 unscoped，再清内存
        // ⚠️ 顺序必须如此：先切 scope，清内存的 setXxx([]) 就不会
        //    覆盖当前用户的 scoped persist 数据
        setPersistUserId(null);
        useTaskStore.getState().setTasks([]);
        useTaskStore.getState().setTags([]);
        useTaskStore.getState().setPeople([]);
        useEventStore.getState().setEvents([]);
        useSyncStore.getState().clearDirtyTasks();
        useSyncStore.getState().clearDirtyTags();
        useSyncStore.getState().clearDirtyPeople();
        useSyncStore.getState().clearDirtyEvents();
      }

      if (session) {
        loadUserData(session.user.id);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  /** 从当前用户的 scoped persist key 中加载本地数据到内存 */
  const rehydrateFromScopedKey = (userId: string) => {
    // ── 任务 / 标签 / 联系人 ──
    const taskRaw = localStorage.getItem(`funflow-storage-${userId}`);
    if (taskRaw) {
      try {
        const parsed = JSON.parse(taskRaw);
        if (parsed?.state) {
          useTaskStore.getState().setTasks(parsed.state.tasks || []);
          useTaskStore.getState().setTags(parsed.state.tags || []);
          useTaskStore.getState().setPeople(parsed.state.people || []);
        } else {
          useTaskStore.getState().setTasks([]);
          useTaskStore.getState().setTags([]);
          useTaskStore.getState().setPeople([]);
        }
      } catch {
        useTaskStore.getState().setTasks([]);
        useTaskStore.getState().setTags([]);
        useTaskStore.getState().setPeople([]);
      }
    } else {
      useTaskStore.getState().setTasks([]);
      useTaskStore.getState().setTags([]);
      useTaskStore.getState().setPeople([]);
    }

    // ── 事件 ──
    const eventRaw = localStorage.getItem(`funflow-events-storage-${userId}`);
    if (eventRaw) {
      try {
        const parsed = JSON.parse(eventRaw);
        useEventStore.getState().setEvents(parsed?.state?.events || []);
      } catch {
        useEventStore.getState().setEvents([]);
      }
    } else {
      useEventStore.getState().setEvents([]);
    }
  };

  /** 清理本地超过 7 天的已删除任务（防止 localStorage 无限增长） */
  const purgeLocalExpiredTrash = () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);
    const cutoffStr = cutoffDate.toISOString();

    // 清理过期已删除任务
    const { tasks, setTasks } = useTaskStore.getState();
    const keptTasks = tasks.filter(t => !(t.deleted && t.deletedAt && t.deletedAt < cutoffStr));
    if (keptTasks.length !== tasks.length) {
      setTasks(keptTasks);
      console.log(`🧹 本地清理 ${tasks.length - keptTasks.length} 个过期已删除任务`);
    }
  };

  const loadUserData = async (userId: string) => {
    if (!userId) return;

    // 切到当前用户的 persist scope，从 scoped key 重新加载本地数据
    setPersistUserId(userId);
    rehydrateFromScopedKey(userId);

    // 本地过期回收站清理（超过 7 天的软删除数据）
    purgeLocalExpiredTrash();

    try {
      const [cloudTasks, cloudTags, cloudPeople] = await Promise.all([
        loadTasksFromCloud(userId),
        loadTagsFromCloud(userId),
        loadPeopleFromCloud(userId).catch(() => [] as Person[]),
      ]);

      // 合并：以 updatedAt 为仲裁依据，保留 updatedAt 更新的版本
      const localTasks = useTaskStore.getState().tasks;
      const mergedMap = new Map(localTasks.map(t => [t.id, t]));
      for (const ct of cloudTasks || []) {
        const local = mergedMap.get(ct.id);
        if (!local || ct.updatedAt >= local.updatedAt) {
          mergedMap.set(ct.id, ct); // 云端更新或本地不存在 → 用云端
        }
        // else: 本地更新 → 保留本地（不执行 set，因为本地已在 map 中）
      }
      const mergedTasks = Array.from(mergedMap.values());
      const finalTags = recoverInvalidTags(mergedTasks, cloudTags);
      setTasks(mergedTasks);
      setTags(finalTags);

      // 加载云端回收站任务，标记本地的已删除状态
      try {
        const cloudTrash = await loadTrashFromCloud(userId);
        if (cloudTrash.length > 0) {
          useTaskStore.getState().mergeTrashTasks(cloudTrash);
        }
      } catch (err) {
        console.warn('加载云端回收站失败:', err);
      }

      // People 合并：同 updatedAt 仲裁
      const localPeople = useTaskStore.getState().people;
      const peopleMap = new Map(localPeople.map(p => [p.id, p]));
      for (const cp of cloudPeople || []) {
        const local = peopleMap.get(cp.id);
        if (!local || cp.updatedAt >= local.updatedAt) {
          peopleMap.set(cp.id, cp);
        }
      }
      setPeople(Array.from(peopleMap.values()));

      // 全量迁移：扫描所有任务，确保人员树中包含所有 createdBy/assignedTo
      useTaskStore.getState().syncPeopleFromTasks();

      // 页面加载时清理云端已过期回收站任务（7 天）
      purgeExpiredTrash(userId);

      // 事件加载：与本地合并，以 updatedAt 为仲裁依据
      loadEventsFromCloud(userId)
        .then(data => {
          const localEvents = useEventStore.getState().events;
          const mergedMap = new Map(localEvents.map(e => [e.id, e]));
          for (const ce of data || []) {
            const local = mergedMap.get(ce.id);
            const incomingTime = ce.updatedAt || ce.createdAt;
            const localTime = local && (local.updatedAt || local.createdAt);
            if (!local || !localTime || incomingTime >= localTime) {
              mergedMap.set(ce.id, ce); // 云端更新或本地不存在 → 用云端
            }
            // else: 本地更新 → 保留本地
          }
          setEvents(Array.from(mergedMap.values()));
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
          syncPeopleToCloud(session.user.id, people),
          syncEventsToCloud(session.user.id, events),
        ]);
      } catch (err) {
        console.error('同步失败:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tasks, tags, people, events, session]);

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
