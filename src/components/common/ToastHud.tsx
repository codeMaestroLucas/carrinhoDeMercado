interface ToastHudProps {
  message: string | null;
  className?: string;
}

export function ToastHud({ message, className }: ToastHudProps) {
  if (!message) return null;

  return (
    <div
      className={
        className ??
        'fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[var(--text-primary)] text-[var(--bg-surface)] px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl animate-fade-in whitespace-nowrap'
      }
    >
      {message}
    </div>
  );
}
