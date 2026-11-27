import { useEffect, type ReactNode } from 'react';

interface ModalShellProps {
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  maxWidthClass?: string;
  zIndexClass?: string;
  panelClassName?: string;
  lockBodyScroll?: boolean;
}

export function ModalShell({
  onClose,
  children,
  ariaLabel,
  maxWidthClass = 'max-w-lg',
  zIndexClass = 'z-50',
  panelClassName = '',
  lockBodyScroll = false,
}: ModalShellProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!lockBodyScroll || typeof document === 'undefined') return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehaviorY;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'none';
    document.documentElement.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehaviorY = prevBodyOverscroll;
      document.documentElement.style.overscrollBehaviorY = prevHtmlOverscroll;
    };
  }, [lockBodyScroll]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-disable-pull-to-refresh="true"
      className={`fixed inset-0 ${zIndexClass} flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4 animate-fade-in`}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} bg-[var(--bg-surface)] rounded-t-[24px] sm:rounded-[24px] border border-[var(--border-subtle)] shadow-2xl overflow-hidden animate-modal-in ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
