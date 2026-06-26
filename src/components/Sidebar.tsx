// src/components/Sidebar.tsx — 侧边栏（标签树 + 人员树）

import { useState, Fragment } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Plus,
  X,
  GripVertical,
  FolderPlus,
  FilePlus,
  Edit2,
  AlertTriangle,
  Tags,
  Users,
} from 'lucide-react';
import { useTaskStore, Tag, Person } from '../store/useTaskStore';
import { motion, AnimatePresence } from 'framer-motion';
import { COLOR_OPTIONS } from '../constants/options';
import CreateTagModal from './CreateTagModal';
import CreatePersonModal from './CreatePersonModal';

interface SidebarProps {
  selectedTags: string[];
  onTagToggle: (tagId: string) => void;
  onClearTags: () => void;
  selectedPersons?: string[];
  onPersonToggle?: (personId: string) => void;
  onClearPersons?: () => void;
}

interface TagWithChildren extends Tag {
  children: TagWithChildren[];
  isExpanded?: boolean;
}

export default function Sidebar({ selectedTags, onTagToggle, onClearTags, selectedPersons = [], onPersonToggle, onClearPersons }: SidebarProps) {
  const { tasks, tags, people, sidebarOpen, toggleSidebar, addTag, updateTag, deleteTag, moveTag,
    addPerson, updatePerson, deletePerson, movePerson } = useTaskStore();

  const [activeTab, setActiveTab] = useState<'tags' | 'people'>('tags');

  // ===== 标签状态 =====
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [showAddTag, setShowAddTag] = useState(false);
  const [showEditTag, setShowEditTag] = useState<{ id: string; name: string; type: 'emoji' | 'color'; emoji?: string; color?: string } | null>(null);
  const [showDeleteTagConfirm, setShowDeleteTagConfirm] = useState<{ id: string; name: string; taskCount: number; subTagCount: number } | null>(null);
  const [newTagParentId, setNewTagParentId] = useState<string | null>(null);
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null);
  const [tagDropPosition, setTagDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  // ===== 人员状态 =====
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showEditPerson, setShowEditPerson] = useState<Person | null>(null);
  const [showDeletePersonConfirm, setShowDeletePersonConfirm] = useState<{ id: string; name: string; taskCount: number } | null>(null);
  const [dragOverPersonId, setDragOverPersonId] = useState<string | null>(null);
  const [personDropPosition, setPersonDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  // ========== 标签树 ==========

  const buildTagTree = (parentId: string | null = null): TagWithChildren[] => {
    return tags
      .filter(tag => tag.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(tag => ({
        ...tag,
        children: buildTagTree(tag.id),
        isExpanded: expandedTags.has(tag.id)
      }));
  };

  const tagTree = buildTagTree();

  const toggleExpandTag = (tagId: string) => {
    const newExpanded = new Set(expandedTags);
    newExpanded.has(tagId) ? newExpanded.delete(tagId) : newExpanded.add(tagId);
    setExpandedTags(newExpanded);
  };

  const getTagTaskCount = (tagId: string) => tasks.filter(task => task.tags?.includes(tagId) && !task.archived && !task.deleted).length;
  const getSubTagCount = (tagId: string) => tags.filter(t => t.parentId === tagId).length;
  const getPersonTaskCount = (person: Person) => tasks.filter(task =>
    !task.archived && !task.deleted &&
    (task.createdBy === person.name || task.createdBy === person.nickname ||
     task.assignedTo === person.name || task.assignedTo === person.nickname)
  ).length;

  const handleEditTag = (tag: Tag) => {
    setShowEditTag({ id: tag.id, name: tag.name, type: tag.colorType, emoji: tag.emoji, color: tag.color });
  };

  const handleDeleteTagClick = (tagId: string, tagName: string) => {
    setShowDeleteTagConfirm({ id: tagId, name: tagName, taskCount: getTagTaskCount(tagId), subTagCount: getSubTagCount(tagId) });
  };

  const handleAddSiblingTag = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (tag) { setNewTagParentId(tag.parentId); setShowAddTag(true); }
  };

  const handleAddChildTag = (tagId: string) => {
    setNewTagParentId(tagId);
    setShowAddTag(true);
    setExpandedTags(prev => { const n = new Set(prev); n.add(tagId); return n; });
  };

  // ========== 人员列表（扁平） ==========

  const sortedPeople = [...people].sort((a, b) => a.order - b.order);

  const handleEditPerson = (person: Person) => {
    setShowEditPerson(person);
  };

  const handleDeletePersonClick = (personId: string, name: string) => {
    const person = people.find(p => p.id === personId);
    const taskCount = person ? tasks.filter(task => !task.archived && !task.deleted &&
      (task.createdBy === person.name || task.createdBy === person.nickname ||
       task.assignedTo === person.name || task.assignedTo === person.nickname)
    ).length : 0;
    setShowDeletePersonConfirm({ id: personId, name, taskCount });
  };

  const handleAddPerson = () => {
    setShowAddPerson(true);
  };

  // ========== 通用拖拽处理 ==========

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (
    e: React.DragEvent,
    id: string,
    setDragOverId: (id: string | null) => void,
    setDropPos: (pos: 'before' | 'after' | 'inside' | null) => void,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dragId = e.dataTransfer.getData('text/plain');
    if (dragId === id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const height = rect.height;
    if (relativeY < height * 0.25) { setDropPos('before'); setDragOverId(id); }
    else if (relativeY > height * 0.75) { setDropPos('after'); setDragOverId(id); }
    else { setDropPos('inside'); setDragOverId(id); }
  };

  const handleDrop =
    (moveFn: (dragId: string, targetId: string, pos: 'before' | 'after' | 'inside') => void) =>
    (e: React.DragEvent, targetId: string, dragOverId: string | null, dropPosition: 'before' | 'after' | 'inside' | null,
     setDragOverId: (id: string | null) => void, setDropPos: (pos: null) => void) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('text/plain');
      if (dragId === targetId || !dropPosition) { setDragOverId(null); setDropPos(null); return; }
      moveFn(dragId, targetId, dropPosition);
      setDragOverId(null); setDropPos(null);
    };

  const getDropIndicatorClass = (id: string, position: 'before' | 'after' | 'inside', dragOverId: string | null, dropPosition: 'before' | 'after' | 'inside' | null) => {
    if (dragOverId !== id || dropPosition !== position) return '';
    if (position === 'before') return 'border-t-2 border-violet-500';
    if (position === 'after') return 'border-b-2 border-violet-500';
    return 'bg-violet-100/50 dark:bg-violet-900/30 ring-2 ring-violet-500';
  };

  // ========== 渲染 ==========

  if (!sidebarOpen) {
    return (
      <div className="fixed left-0 top-14 bottom-0 w-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 z-20">
        <button onClick={toggleSidebar} className="w-full p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <ChevronRight size={20} className="text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <Fragment>
    <div className="fixed left-0 top-14 bottom-0 w-72 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 z-20 overflow-y-auto">
      {/* 顶部 Logo */}
      <div className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐟</span>
          <span className="font-bold text-lg text-zinc-900 dark:text-white">FunFlow</span>
        </div>
        <button onClick={toggleSidebar} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('tags')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'tags'
              ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Tags size={14} /> 标签
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'people'
              ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Users size={14} /> 人员
        </button>
      </div>

      <div className="p-4">
        {/* ===== 标签面板 ===== */}
        {activeTab === 'tags' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">标签筛选</h3>
              <div className="flex gap-1">
                {selectedTags.length > 0 && (
                  <button onClick={onClearTags} className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20">
                    清除
                  </button>
                )}
                <button
                  onClick={() => { setNewTagParentId(null); setShowAddTag(true); }}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                  title="新建顶级标签"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              {tagTree.map(tag => renderTagItem(tag, 0))}
            </div>

            {tags.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-8">暂无标签，点击 + 创建</p>
            )}
          </>
        )}

        {/* ===== 人员面板 ===== */}
        {activeTab === 'people' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">人员管理</h3>
              <div className="flex gap-1">
                {selectedPersons.length > 0 && (
                  <button onClick={onClearPersons} className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20">
                    清除
                  </button>
                )}
                <button
                  onClick={handleAddPerson}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                  title="新建人员"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              {sortedPeople.map(person => renderPersonItem(person))}
            </div>

            {people.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-8">暂无人员，点击 + 创建</p>
            )}
          </>
        )}
      </div>

    </div>  {/* 关闭侧边栏容器 */}
    <CreateTagModal
      isOpen={showAddTag}
      onClose={() => setShowAddTag(false)}
      onCreate={(tag) => {
        addTag(tag);
        if (newTagParentId) {
          setExpandedTags(prev => { const n = new Set(prev); n.add(newTagParentId); return n; });
        }
        setNewTagParentId(null);
      }}
      parentTags={tags}
      initialParentId={newTagParentId}
      title={newTagParentId ? '新建子标签' : '新建标签'}
      animated={false}
    />
    <CreateTagModal
      isOpen={showEditTag !== null}
      onClose={() => setShowEditTag(null)}
      onCreate={(tag) => {
        if (showEditTag) updateTag(showEditTag.id, { name: tag.name, colorType: tag.colorType, emoji: tag.emoji, color: tag.color });
      }}
      mode="edit"
      initialData={showEditTag ? { name: showEditTag.name, type: showEditTag.type, emoji: showEditTag.emoji, color: showEditTag.color } : undefined}
      animated={false}
    />
    {showDeleteTagConfirm && <DeleteConfirmDialog {...showDeleteTagConfirm} onCancel={() => setShowDeleteTagConfirm(null)} onConfirm={() => { deleteTag(showDeleteTagConfirm.id); setShowDeleteTagConfirm(null); }} />}

    <CreatePersonModal
      isOpen={showAddPerson}
      onClose={() => setShowAddPerson(false)}
      onCreate={(person) => {
        addPerson(person);
      }}
    />
    <CreatePersonModal
      isOpen={showEditPerson !== null}
      onClose={() => setShowEditPerson(null)}
      onCreate={(data) => {
        if (showEditPerson) updatePerson(showEditPerson.id, { name: data.name, nickname: data.nickname, email: data.email });
      }}
      mode="edit"
      initialData={showEditPerson || undefined}
    />
    {showDeletePersonConfirm && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDeletePersonConfirm(null)}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">删除人员</h3>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            确定要删除 <span className="font-medium text-zinc-900 dark:text-white">"{showDeletePersonConfirm.name}"</span> 吗？
          </p>
          {showDeletePersonConfirm.taskCount > 0 && (
            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                ⚠️ 当前有 <strong>{showDeletePersonConfirm.taskCount}</strong> 个活跃任务引用了此人员，删除后这些任务中的引用将保留但不再关联此人员。
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setShowDeletePersonConfirm(null)} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">取消</button>
            <button onClick={() => { deletePerson(showDeletePersonConfirm.id); setShowDeletePersonConfirm(null); }} className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors">确认删除</button>
          </div>
        </div>
      </div>
    )}
    </Fragment>
  );

  // ========== 标签树节点渲染 ==========
  function renderTagItem(tag: TagWithChildren, level: number = 0) {
    const isSelected = selectedTags.includes(tag.id);
    const hasChildren = tag.children.length > 0;
    const isExpanded = tag.isExpanded;
    const taskCount = getTagTaskCount(tag.id);

    return (
      <div key={tag.id}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, tag.id)}
          onDragOver={(e) => handleDragOver(e, tag.id, setDragOverTagId, setTagDropPosition)}
          onDragLeave={() => { setDragOverTagId(null); setTagDropPosition(null); }}
          onDrop={(e) => {
            e.preventDefault();
            const dragId = e.dataTransfer.getData('text/plain');
            if (dragId === tag.id || !tagDropPosition) { setDragOverTagId(null); setTagDropPosition(null); return; }
            moveTag(dragId, tag.id, tagDropPosition);
            setDragOverTagId(null); setTagDropPosition(null);
          }}
          className={`group relative flex items-center justify-between py-1.5 rounded-lg cursor-move transition-all ${
            getDropIndicatorClass(tag.id, 'before', dragOverTagId, tagDropPosition)
          } ${getDropIndicatorClass(tag.id, 'after', dragOverTagId, tagDropPosition)}
            ${getDropIndicatorClass(tag.id, 'inside', dragOverTagId, tagDropPosition)} ${
            isSelected
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
          style={{ paddingLeft: level * 16 + 24 }}
        >
          {/* 拖拽把手 — 绝对定位不占空间 */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity px-1 z-10">
            <GripVertical size={12} className="text-zinc-400" />
          </div>
          {hasChildren ? (
            <button onClick={() => toggleExpandTag(tag.id)} className="flex-shrink-0 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded mr-1">
              {isExpanded ? <ChevronDown size={10} /> : <ChevronRightIcon size={10} />}
            </button>
          ) : <div className="w-3.5 mr-1 flex-shrink-0" />}
          <button onClick={() => onTagToggle(tag.id)} className="flex items-center gap-1 flex-1 min-w-0 text-left">
            {tag.colorType === 'emoji' ? <span className="text-sm flex-shrink-0">{tag.emoji}</span> : <div className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_OPTIONS.find(c => c.name === tag.color)?.class}`} />}
            <span className="text-sm leading-snug truncate">{tag.name}</span>
            {taskCount > 0 && <span className="text-xs text-zinc-400 ml-0.5 flex-shrink-0">({taskCount})</span>}
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => handleEditTag(tag)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded" title="重命名"><Edit2 size={12} /></button>
            <button onClick={() => handleAddSiblingTag(tag.id)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded" title="添加同级标签"><FilePlus size={12} /></button>
            <button onClick={() => handleAddChildTag(tag.id)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded" title="添加子标签"><FolderPlus size={12} /></button>
            <button onClick={() => handleDeleteTagClick(tag.id, tag.name)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 rounded transition-colors" title="删除标签"><X size={12} /></button>
          </div>
        </div>
        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {tag.children.map(child => renderTagItem(child, level + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ========== 人员列表节点渲染（扁平，无层级） ==========
  function renderPersonItem(person: Person) {
    const label = person.nickname ? `${person.name}（${person.nickname}）` : person.name;
    const personTaskCount = getPersonTaskCount(person);

    return (
      <div key={person.id}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, person.id)}
          onDragOver={(e) => handleDragOver(e, person.id, setDragOverPersonId, setPersonDropPosition)}
          onDragLeave={() => { setDragOverPersonId(null); setPersonDropPosition(null); }}
          onDrop={(e) => {
            e.preventDefault();
            const dragId = e.dataTransfer.getData('text/plain');
            if (dragId === person.id || !personDropPosition) { setDragOverPersonId(null); setPersonDropPosition(null); return; }
            movePerson(dragId, person.id, personDropPosition);
            setDragOverPersonId(null); setPersonDropPosition(null);
          }}
          className={(() => {
            const classes = `group relative flex items-center justify-between py-1.5 rounded-lg cursor-move transition-all ${getDropIndicatorClass(person.id, 'before', dragOverPersonId, personDropPosition)} ${getDropIndicatorClass(person.id, 'after', dragOverPersonId, personDropPosition)} ${getDropIndicatorClass(person.id, 'inside', dragOverPersonId, personDropPosition)} ${selectedPersons.includes(person.id) ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`;
            return classes;
          })()}
          style={{ paddingLeft: 24 }}
        >
          {/* 拖拽把手 — 绝对定位不占空间 */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity px-1 z-10">
            <GripVertical size={12} className="text-zinc-400" />
          </div>
          <button onClick={() => onPersonToggle?.(person.id)} className="flex items-center gap-1 flex-1 min-w-0 text-left">
            <span className="text-sm truncate">{label}</span>
            {personTaskCount > 0 && <span className="text-xs text-zinc-400 ml-0.5">({personTaskCount})</span>}
            {person.email && <span className="text-xs text-zinc-400 truncate hidden group-hover:inline">· {person.email}</span>}
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleEditPerson(person)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded" title="编辑"><Edit2 size={12} /></button>
            <button onClick={() => handleAddPerson()} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded" title="新增人员"><FilePlus size={12} /></button>
            <button onClick={() => handleDeletePersonClick(person.id, person.name)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 rounded transition-colors" title="删除"><X size={12} /></button>
          </div>
        </div>
      </div>
    );
  }
}

// ========== 删除确认弹窗（标签专用） ==========
function DeleteConfirmDialog({ id, name, taskCount, subTagCount, onCancel, onConfirm }: {
  id: string; name: string; taskCount: number; subTagCount: number; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white">删除标签</h3>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          确定要删除标签 <span className="font-medium text-zinc-900 dark:text-white">"{name}"</span> 吗？
        </p>
        {taskCount > 0 && (
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              ⚠️ 当前有 <strong>{taskCount}</strong> 个任务使用了此标签，删除后这些任务的标签也会被移除。
            </p>
          </div>
        )}
        {subTagCount > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              📁 此标签下还有 <strong>{subTagCount}</strong> 个子标签，将会一并删除。
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">取消</button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors">确认删除</button>
        </div>
      </div>
    </div>
  );
}
