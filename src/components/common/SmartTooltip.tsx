import React, { useEffect, useRef, useState } from 'react';

/**
 * Shared warm-window state for `skipDelay` behavior:
 * - First tooltip waits `delayMs` (360ms) to avoid accidental hover noise.
 * - Moving between adjacent tooltips within `skipDelayMs` (550ms) opens immediately (0ms).
 */
let lastClosedAt = 0;

interface SmartTooltipProps {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
  delayMs?: number;
  skipDelayMs?: number;
}

export function SmartTooltip({
  label,
  children,
  side = 'bottom',
  delayMs = 360,
  skipDelayMs = 550,
}: SmartTooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleEnter = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    const isWarm = Date.now() - lastClosedAt < skipDelayMs;
    if (isWarm) {
      setOpen(true);
    } else {
      timerRef.current = setTimeout(() => {
        setOpen(true);
        timerRef.current = null;
      }, delayMs);
    }
  };

  const handleLeave = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (open) {
      lastClosedAt = Date.now();
    }
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`animate-popover-in pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-pill)] ${
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
