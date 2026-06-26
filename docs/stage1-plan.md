# FunFlow 阶段一改造技术方案

## P0：事件软删除 + 任务级联 + 脏标记修复

---

## 1. 事件软删除

### 1.1 数据模型变更

**文件**: `src/store/useEventStore.ts`

```typescript
interface TaskEvent {
  // ... 现有字段不变
  updatedAt: string;          // 改为必填（去掉 ?）
  deleted: boolean;           // 新增：软删除标记
  deletedAt?: string;         // 新增：删除时间
  metadata?: Record<string, any>; // 新增：扩展字段预留
}
```

### 1.2 操作行为变更

| 操作 | 当前行为 | 改造后行为 |
|------|---------|-----------|
| `deleteEvent(id)` | 从数组移除 + 标记 dirty → 云端 DELETE | 设 `deleted=true, deletedAt=now` + 标记 dirty → 云端 upsert 同步 deleted 字段 |
| `toggleEventComplete(id)` | 更新 `completed`，不设 `updatedAt` | 新增：自动设 `updatedAt: now` |
| `updateEvent(id, updates)` | 不自动更新 `updatedAt` | 新增：自动设 `updatedAt: now`，和 `updateTask` 保持一致 |
| `addEvent(event)` | 不校验 `updatedAt` | 新增：自动设 `updatedAt = createdAt` |

### 1.3 同步变更

**文件**: `src/services/eventSyncService.ts`

- `syncEventsToCloud` 不再需要"dirty 但本地不存在 → 云端 DELETE"的逻辑
- 改为：脏事件中 `deleted=true` 的，upsert 到云端（带 `deleted` 字段）
- 新增 7 天过期清理：同任务一样的 `purgeExpiredTrash` 逻辑

```typescript
// syncEventsToCloud 改造要点：
// 1. 删除 toDelete 逻辑（不再硬删除）
// 2. 所有脏事件统一 upsert（包括 deleted=true 的事件）
// 3. 同步完成后新增：清理云端 deleted=true 超过 7 天的事件
```

### 1.4 视图过滤

所有事件展示处加 `deleted === false` 过滤：

- `EventTimeline.tsx` — `getEventsByTask` 调用处
- `TaskDetailDrawer.tsx` — 事件时间列表
- 其他读取 events 的组件

**修改 `getEventsByTask`** 自动过滤：

```typescript
getEventsByTask: (taskId) => {
  return get().events
    .filter((e) => e.taskId === taskId && !e.deleted)  // 新增 !e.deleted
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
},
```

### 1.5 数据迁移（新增字段的旧数据处理）

首次加载时，现有事件没有 `deleted` 字段 → 默认 `false`：

```typescript
// dbEventToApp 中：
deleted: item.deleted ?? false,
deletedAt: item.deleted_at ?? undefined,
metadata: item.metadata ?? undefined,
```

---

## 2. 任务删除/恢复级联事件

### 2.1 级联规则

| 任务操作 | 事件行为 |
|---------|---------|
| `deleteTask(id)` 软删除 | 该任务所有事件设 `deleted=true` |
| `restoreTask(id)` 从回收站恢复 | 该任务所有事件恢复 `deleted=false` |
| `restoreToArchive(id)` 从回收站恢复到归档 | 该任务所有事件恢复 `deleted=false` |
| `permanentDeleteTask(id)` 永久删除 | 该任务所有事件标记 dirty，等待 7 天后云端清理 |
| `emptyTrash()` 清空回收站 | 所有已删任务的 events 标记 dirty，等待过期清理 |

### 2.2 具体实现

**文件**: `src/store/useTaskStore.ts`

```typescript
// 改造 deleteTask：
deleteTask: (id) => {
  useSyncStore.getState().markTaskDirty(id);
  // 级联：该任务的所有事件标记为已删除
  const taskEvents = useEventStore.getState().events.filter(e => e.taskId === id);
  const eventIds = taskEvents.map(e => e.id);
  useSyncStore.getState().markEventsDirty(eventIds);
  return set((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === id
        ? { ...task, deleted: true, deletedAt: new Date().toISOString() }
        : task
    ),
    // 事件不在这里直接改（EventStore 是独立 store），通过 dirty 标记联动
  }));
},
```

**问题**：级联需要连动 `useEventStore`，但在 `useTaskStore` 中直接调用外部 store 的 setter 会制造依赖循环，且两个 store 的 `set()` 不在同一个事务中。

**方案 A（推荐）**：在 `App.tsx` 或独立 hook 中用 `useEffect` 监听任务删除/恢复状态变化，联动操作事件。

```typescript
// App.tsx 新增级联 effect
useEffect(() => {
  // 找出所有被删除/恢复的任务
  // 级联更新对应事件的 deleted 状态
}, [tasks]);
```

**方案 B**：在 `useTaskStore` 中直接调 `useEventStore.getState()` 做联动。简单直接但耦合两个 store。

我推荐**方案 B**，原因：
- 改动量最小
- `useTaskStore` 已经依赖了 `useSyncStore`，多一个 `useEventStore` 同样模式
- 不需要新增 effect 增加复杂度

```typescript
// useTaskStore.ts
import { useEventStore } from './useEventStore';

// deleteTask 内加级联
const taskEvents = useEventStore.getState().events.filter(e => e.taskId === id);
const eventIds = taskEvents.map(e => e.id);
if (eventIds.length > 0) {
  useSyncStore.getState().markEventsDirty(eventIds);
  // 当前不直接 setEventStore，等 sync 推上云后下次加载自然同步
}
```

但这样 events 在本地不会立即标记为 `deleted=true`，要等下次从云端加载。体验不好。

**更好的方案 B+**：直接改 EventStore：

```typescript
deleteTask: (id) => {
  useSyncStore.getState().markTaskDirty(id);
  
  // 级联：立即将关联事件标记为已删除
  const { events, setEvents } = useEventStore.getState();
  const updatedEvents = events.map(e =>
    e.taskId === id && !e.deleted
      ? { ...e, deleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : e
  );
  if (updatedEvents !== events) {
    useSyncStore.getState().markEventsDirty(
      updatedEvents.filter(e => e.deleted && !e.deletedAt).map(e => e.id)
    );
    setEvents(updatedEvents);
  }
  
  return set((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === id
        ? { ...task, deleted: true, deletedAt: new Date().toISOString() }
        : task
    ),
  }));
},
```

---

## 3. 脏标记清除修复

### 3.1 问题

当前所有三个 sync service 在 sync 完成后**无条件清除全部脏标记**：

```typescript
clearDirtyEvents();  // ← 不管个别事件是否失败
```

如果某个 upsert 失败，它的 dirty ID 也被清掉了 → **静默丢失**。

### 3.2 修复方案

改为**逐个确认**，只清除成功同步的 ID：

**文件**: `src/services/eventSyncService.ts`

```typescript
export async function syncEventsToCloud(userId: string, events: TaskEvent[]) {
  try {
    const { dirtyEventIds, clearDirtyEvents } = useSyncStore.getState();
    if (dirtyEventIds.length === 0) return;

    const eventMap = new Map(events.map(e => [e.id, e]));
    const syncedIds: string[] = [];

    // 只处理 dirty 且本地存在的事件（不再处理删除）
    for (const event of events) {
      if (!dirtyEventIds.includes(event.id)) continue;
      if (event.deleted && event.deletedAt) {
        // 检查是否超过 7 天 — 7 天清理走额外的 purge 逻辑
      }
      const { error } = await supabase
        .from('task_events')
        .upsert(eventData, { onConflict: 'user_id, event_id' });
      
      if (error) {
        console.warn('同步事件失败，保留脏标记:', event.id, error);
        // 失败 → 不加入 syncedIds，脏标记保留等下次重试
      } else {
        syncedIds.push(event.id);
      }
    }

    // 更新脏标记：只移除成功同步的
    if (syncedIds.length > 0) {
      const remaining = useSyncStore.getState().dirtyEventIds.filter(
        id => !syncedIds.includes(id)
      );
      // 直接通过 set 更新（不通过 clearDirtyEvents）
      useSyncStore.setState({ dirtyEventIds: remaining });
    }
    
    // 7天清理：同任务逻辑
    await purgeExpiredTrashEvents(userId);
    
    if (syncedIds.length > 0) {
      console.log(`✅ 事件同步完成: 更新 ${syncedIds.length} 个`);
    }
  } catch (error) {
    console.warn('事件同步跳过:', error);
    // 异常时不清除任何脏标记
  }
}
```

**文件**: `src/services/syncService.ts`

同样改造 `syncTasksToCloud`、`syncTagsToCloud`、`syncPeopleToCloud`。

### 3.3 7 天过期清理（新增）

```typescript
// eventSyncService.ts
export async function purgeExpiredTrashEvents(userId: string): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  
  await supabase
    .from('task_events')
    .delete()
    .eq('user_id', userId)
    .eq('deleted', true)
    .lt('deleted_at', cutoff.toISOString());
}
```

---

## 4. 涉及的完整文件清单

| 文件 | 改动类型 | 变更内容 |
|------|---------|---------|
| `src/store/useEventStore.ts` | 修改 | TaskEvent 加 `deleted`/`deletedAt`/`metadata`；`updatedAt` 改必填；`deleteEvent` 改软删除；`addEvent`/`updateEvent` 自动设 updatedAt；`getEventsByTask` 过滤 deleted |
| `src/store/useTaskStore.ts` | 修改 | `deleteTask` 级联事件；`restoreTask` 级联恢复；`restoreToArchive` 级联；`permanentDeleteTask`/`emptyTrash` 级联标记 |
| `src/services/eventSyncService.ts` | 修改 | 删除硬删除逻辑；改为 upsert deleted 字段；逐个确认成功清除脏标记；新增 7 天清理 |
| `src/services/syncService.ts` | 修改 | `syncTasksToCloud` 逐个确认清除脏标记（同 events 模式） |
| `src/App.tsx` | 小改 | `loadUserData` 中 events 加载：不再依赖 `if (data.length > 0)` 判断（软删除后事件永远存在） |

---

## 5. 不影响的部分

以下模块不需要改动：

- `src/store/persistStorage.ts` — 已有正确隔离
- `src/store/useSyncStore.ts` — 只提供 API，业务逻辑在 service 层
- `src/services/realtimeSync.ts` — Realtime 订阅不受事件软删除影响（deleted 字段会正常推送）
- 各个视图组件 — 除 `getEventsByTask` 内部过滤外，外部调用者不需改（过滤在 store 层）
- `src/services/supabase.ts` — 不变

---

## 6. 风险与注意事项

### 6.1 数据库约束
Supabase `task_events` 表需要新增 `deleted`（boolean）和 `deleted_at`（timestamptz）列。没有 migration 工具，需手动在 Supabase 控制台执行：

```sql
ALTER TABLE task_events ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;
ALTER TABLE task_events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE task_events ADD COLUMN IF NOT EXISTS metadata jsonb;
```

### 6.2 旧数据兼容
现有云端事件没有 `deleted` 字段 → `dbEventToApp` 映射时默认 `false`，不触发误删。

### 6.3 级联的事务性
`useTaskStore.deleteTask` 和 `useEventStore.setEvents` 是两个独立 Zustand store 的操作，不在同一个事务中。如果 `setEvents` 成功但 `set`(tasks) 失败（极端情况），会出现事件已删但任务未删的不一致状态。这是 Zustand 多 store 的固有限制。可接受，后续升级到单个 store 可解决。

---

## 7. 验收标准

| # | 验收点 | 操作步骤 | 预期结果 |
|---|-------|---------|---------|
| 1 | 事件软删除 | 删除一个事件 | 事件在 UI 消失，数据库 `deleted=true` |
| 2 | 事件恢复 | 直接 setEvents 手动把 deleted 改回 false | 事件恢复显示 |
| 3 | 任务级联删除 | 删除一个含事件的任务 | 任务 + 所有关联事件 `deleted=true` |
| 4 | 任务级联恢复 | 从回收站恢复该任务 | 任务 + 所有事件 `deleted=false` |
| 5 | 脏标记持久 | 创建事件后刷新页面（300ms 内） | 事件不丢，sync 继续 |
| 6 | 脏标记清除安全 | 模拟一个 upsert 失败 | 失败的 ID 保留脏标记，下次重试 |
| 7 | 7天清理 | `deletedAt` 超过 7 天的 deleted 事件 | 从数据库物理删除 |
