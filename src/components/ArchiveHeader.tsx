// src/components/ArchiveHeader.tsx
// 已弃用
import { motion } from 'framer-motion';
import { Archive, ArrowLeft, Settings, Trash2 } from 'lucide-react';
import { useTaskStore } from '../store/useTaskStore';

interface ArchiveHeaderProps {
  onBack: () => void;
  onGoToTrash?: () => void;
}

export default function ArchiveHeader({ onBack, onGoToTrash }: ArchiveHeaderProps) {
  const { tasks, archiveSettings, updateArchiveSettings } = useTaskStore();
  
  const archivedTasks = tasks.filter(t => t.archived && !t.deleted);
  const trashedTasks = tasks.filter(t => t.deleted);
  
  const handleAutoArchiveToggle = () => {
    updateArchiveSettings({ enabled: !archiveSettings.enabled });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <Archive size={24} className="text-violet-500" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">归档</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={onGoToTrash}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <Trash2 size={16} />
            回收站 ({trashedTasks.length})
          </button>
          
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            已归档: {archivedTasks.length}
          </div>
          
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-zinc-400" />
            <label className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <input
                type="checkbox"
                checked={archiveSettings.enabled}
                onChange={handleAutoArchiveToggle}
                className="rounded"
              />
              自动归档（{archiveSettings.autoArchiveDays}天前完成的任务）
            </label>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          📌 归档说明：已完成且超过 {archiveSettings.autoArchiveDays} 天的任务会自动归档。
          归档的任务不计入总任务统计，可在归档中查看、恢复或删除（移至回收站）。
        </p>
      </div>
    </div>
  );
}