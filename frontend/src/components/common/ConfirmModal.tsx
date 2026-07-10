import React from 'react';
import { useModalDialog } from '../../hooks/useModalDialog';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, confirmLabel = '确认删除', onCancel, onConfirm }) => {
  const dialogRef = useModalDialog(onCancel);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"><div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" tabIndex={-1} className="glass-panel p-5 w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in duration-200"><h3 id="confirm-title" className="text-lg font-semibold text-white">{title}</h3><p className="text-sm text-gray-400 mt-2">{message}</p><div className="flex gap-2 pt-5"><button onClick={onCancel} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2.5 rounded-xl">取消</button><button onClick={onConfirm} className="flex-1 semantic-red-button text-sm py-2.5 rounded-xl">{confirmLabel}</button></div></div></div>;
};
