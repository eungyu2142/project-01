import type { ReactNode } from 'react';

interface ModalSheetProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalSheet({
  open,
  title,
  description,
  onClose,
  children,
}: ModalSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 px-4 pb-4 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between border-b border-emerald-50 px-5 pb-4 pt-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
          >
            닫기
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
