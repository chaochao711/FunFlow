# FunFlow 🐟 — 任务管理工具

## 项目概览

FunFlow 是一个全栈任务管理 Web 应用，支持任务 CRUD、多级标签、日历视图、归档/回收站、云同步等功能。

- **本地启动**: `npm run dev`（Vite dev server）
- **构建**: `npm run build`（tsc + vite build）
- **预览构建产物**: `npm run preview`
- **测试**: `npm test`（vitest run）/ `npm run test:watch`（watch 模式）

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript 6 |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS 3 |
| 状态管理 | Zustand 5（persist 到 localStorage，key: `funflow-storage`） |
| 后端/数据库 | Supabase（PostgreSQL + Auth） |
| 日历 | FullCalendar 6 |
| 动画 | Framer Motion 12 |
| 图标 | Lucide React |
| 测试 | Vitest + @testing-library/react |

## 项目结构

```
src/
├── App.tsx                    # 根组件（认证守卫 + 云同步 + 三视图路由，~120行）
├── main.tsx                   # React 入口
├── index.css                  # Tailwind 全局样式
├── test-setup.ts              # Vitest 测试环境初始化
├── components/
│   ├── Auth.tsx               # 登录/注册页（Supabase email/password）
│   ├── UserMenu.tsx           # 用户头像下拉菜单 + 登出
│   ├── AppHeader.tsx          # 共享顶部导航栏（归档/回收站视图使用）
│   ├── Sidebar.tsx            # 侧边栏标签树（拖拽排序、CRUD、展开折叠）
│   ├── TaskCard.tsx           # 任务卡片（状态切换、完成节点、修改指示器、2秒悬停展开事件时间线）
│   ├── TaskFormModal.tsx      # 新建任务弹窗（含发起人/执行者）
│   ├── TaskDetailDrawer.tsx   # 任务详情抽屉（直接编辑、自动保存、事件时间线）
│   ├── CreateTagModal.tsx     # 统一标签创建/编辑弹窗
│   ├── CreateEventModal.tsx   # 新建事件/节点弹窗
│   ├── EventTimeline.tsx      # 可复用的时间线渲染组件
│   ├── TimelineView.tsx       # 任务时间线视图（按时间排列任务，支持活跃+归档）
│   ├── ConfirmDialog.tsx      # 通用确认弹窗
│   ├── QuickStats.tsx         # 快捷统计面板（按状态/日期/逾期筛选）
│   └── CalendarView.tsx       # 日历视图（月/周/日，显示活跃+归档任务，归档不可拖拽）
├── views/
│   ├── MainPage.tsx           # 主视图（列表/日历/时间线 + 搜索 + 筛选排序）
│   ├── ArchivePage.tsx        # 归档视图
│   └── TrashPage.tsx          # 回收站视图
├── store/
│   ├── useTaskStore.ts        # 主 Store（任务、标签、归档设置、UI 状态）
│   └── useEventStore.ts       # 事件/节点 Store
├── services/
│   ├── supabase.ts            # Supabase 客户端初始化
│   ├── syncService.ts         # 云同步（任务/标签的 upsert + delete）
│   └── eventSyncService.ts    # 事件云同步（task_events 表）
├── constants/
│   └── options.ts             # 共享常量（COLOR_OPTIONS / EMOJI_OPTIONS）
└── utils/
    ├── tagUtils.ts            # 共享标签工具函数
    ├── dateUtils.ts           # 相对时间格式化 + 按日期分组
    ├── cleanInvalidTags.ts    # 清理任务中引用的无效标签 ID
    └── recoverInvalidTags.ts  # 修复异常标签（孤儿标签、自引用、level 修复）
```

## 核心数据模型

### Task（定义于 useTaskStore.ts）
```ts
interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;          // ISO date string
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  tags: string[];            // tag IDs
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archived: boolean;
  archivedAt?: string;
  deleted: boolean;
  deletedAt?: string;
  history: TaskHistory[];    // 编辑历史
  createdBy?: string;        // 发起人
  assignedTo?: string;       // 作用对象
}
```

### TaskEvent（定义于 useEventStore.ts，同步到 Supabase `task_events` 表）
```ts
interface TaskEvent {
  id: string;
  taskId: string;            // 关联任务
  type: 'completion' | 'idea' | 'note' | 'milestone';
  content: string;           // 事件内容
  timestamp: string;         // 事件发生时间
  createdAt: string;         // 创建时间
  userId: string;            // 所属用户
}
```

### Tag（支持多级树、emoji/颜色两种类型）
```ts
interface Tag {
  id: string;
  name: string;
  parentId: string | null;   // null = 根标签
  colorType: 'emoji' | 'color';
  emoji?: string;            // colorType=emoji 时使用
  color?: string;            // colorType=color 时使用（red/orange/.../pink）
  level: number;             // 层级深度
  order: number;             // 同级排序
}
```

### 任务生命周期
```
创建 → 活跃（主列表）→ 归档（手动/自动）→ 删除 → 回收站 → 彻底删除
                ↕                        ↕           ↕
              主列表                  恢复→归档    恢复→归档
```

关键规则：
- `restoreTask()` 从回收站恢复时直接进入**归档**（`archived: true`），而不是回到主列表
- `unarchiveTask()` 从归档恢复到主列表
- 归档任务不计入主列表统计
- 已完成 N 天的任务可自动归档（默认 7 天，可配置）

## 最近迭代记录

| Date | Content |
|------|---------|
| 2026-06-22 | ★ 阶段三：TaskCard 内联事件时间线悬停展示、日历/时间线显示归档任务、时间线重写为任务视图 |
| 2026-06-22 | ★ 阶段二：事件节点系统、时间线视图、编辑模式改进、发起人/执行者、状态提示 |
| 2026-06-22 | ★ 阶段一重构：删除弃用文件、提取共享工具函数和组件、拆分 App.tsx、搭建测试框架 |
| 最近 | 回收站恢复任务卡时加入归档中，不再直接回到任务卡片列表 |
| 最近 | 修复孤儿标签；默认展开标签树 |
| — | 修复删除失败问题 |
| — | 优化快捷卡片筛选时页面抖动 + 账号数据未隔离问题 |
| — | 优化总是显示默认标签问题 |
| — | 添加用户菜单和登录优化 |
| — | Initial commit |

### 2026-06-22 阶段一：技术债清理

**删除的弃用文件**：
- `src/store/useAppStore.ts`、`src/components/TrashView.tsx`、`src/components/ArchiveHeader.tsx`、`src/types/task.ts`

**新增文件**：`tagUtils.ts`、`constants/options.ts`、`CreateTagModal.tsx`、`AppHeader.tsx`、`ConfirmDialog.tsx`、`views/` 目录下三个视图页面

**指标**：App.tsx 1121→120行，测试 0→33 tests

### 2026-06-22 阶段二：新功能开发

**新增文件**：
- `src/utils/dateUtils.ts` — 相对时间格式化
- `src/store/useEventStore.ts` — 事件/节点状态管理
- `src/services/eventSyncService.ts` — 事件云同步（`task_events` 表）
- `src/components/CreateEventModal.tsx` — 新建事件弹窗（支持4种类型）
- `src/components/EventTimeline.tsx` — 可复用的时间线渲染组件
- `src/components/TimelineView.tsx` — 全局时间线视图

**功能变更**：
- Task 新增 `createdBy` / `assignedTo` 字段
- TaskDetailDrawer：直接编辑模式、退出自动保存、编辑历史折叠、事件时间线标签
- TaskCard：完成节点按钮、状态修改指示器（🟢绿=状态变更 / 🟠橙=内容修改）
- MainPage：新增时间线视图模式（📊），搜索扩展到发起人和执行者
- App.tsx：新增事件云同步

## 已知问题 / 技术债

1. **无离线支持**: 数据完全依赖 Supabase 云端同步，无离线缓存策略
2. **日历视图**: 日期选择快速创建任务功能有 TODO 标记未实现
3. **无 E2E 测试**: 仅有单元测试，缺少端到端集成测试

## 开发约定

- 组件使用默认导出 (`export default`)
- 状态管理通过 Zustand store，不直接操作 localStorage
- 云同步使用 800ms 防抖，避免频繁请求
- 标签树通过 `parentId` + `level` + `order` 三个字段维护层级关系
- 拖拽排序使用原生 HTML5 Drag & Drop API
- 暗色模式通过 `dark` class 在 `<html>` 标签上切换，由 Tailwind 的 `dark:` 前缀驱动
- Supabase 环境变量: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`（.env 中配置）
- 页面级视图组件放在 `src/views/`，通用组件放在 `src/components/`
- 共享工具函数放在 `src/utils/`，共享常量放在 `src/constants/`
- 测试文件与被测模块放在同一目录（`*.test.ts` 后缀）
