// src/components/ConfirmDialog.tsx — 通用确认弹窗

import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  destructive = true,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${destructive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
            <AlertTriangle size={20} className={destructive ? 'text-red-500' : 'text-amber-500'} />
          </div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{title}</h3>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 text-white rounded-xl font-medium transition-colors ${destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-violet-500 hover:bg-violet-600'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
