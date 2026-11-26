import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const TRIGGER_THRESHOLD = 58;
const MAX_PULL = 86;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    if (typeof window !== 'undefined' && window.scrollY > 2) return;
    // Do not initiate pull-to-refresh if touching an open dialog/editor (e.g. ReceiptImageEditor)
    const target = e.target as HTMLElement | null;
    if (target?.closest('[role="dialog"], [data-disable-pull-to-refresh="true"]')) {
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    isPullingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing || startYRef.current === null || startXRef.current === null) {
      return;
    }
    if (typeof window !== 'undefined' && window.scrollY > 2) {
      startYRef.current = null;
      setPullDistance(0);
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;

    if (!isPullingRef.current) {
      if (deltaY > 10 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
        isPullingRef.current = true;
      } else if (Math.abs(deltaX) > 10 || deltaY < -5) {
        startYRef.current = null;
        return;
      }
    }

    if (isPullingRef.current && deltaY > 0) {
      // Progressive rubber-banding pull feel
      const damped = Math.min(MAX_PULL, deltaY * 0.45);
      setPullDistance(damped);
    }
  };

  const handleTouchEnd = async () => {
    startYRef.current = null;
    startXRef.current = null;

    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= TRIGGER_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(54);
      const startedAt = Date.now();
      try {
        await onRefresh();
      } catch {
        // Ignore refresh errors and gracefully restore UI
      } finally {
        // Ensure spinner stays visible long enough for crisp feedback (Doherty polish)
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, 520 - elapsed);
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, remaining);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / TRIGGER_THRESHOLD);
  const isReady = pullDistance >= TRIGGER_THRESHOLD;
  const visible = pullDistance > 6 || isRefreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => void handleTouchEnd()}
      onTouchCancel={() => {
        startYRef.current = null;
        isPullingRef.current = false;
        if (!isRefreshing) setPullDistance(0);
      }}
      className="relative"
    >
      {/* Apple-style Floating Pull-to-Refresh Spinner Pill */}
      <div
        aria-live="polite"
        aria-label={isRefreshing ? 'Recarregando página' : undefined}
        className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center md:top-[76px]"
        style={{
          opacity: visible ? Math.min(1, progress * 1.25) : 0,
          transform: `translateY(${visible ? Math.min(pullDistance * 0.55, 40) : -20}px) scale(${
            visible ? 0.78 + progress * 0.22 : 0.75
          })`,
          transition: isPullingRef.current
            ? 'none'
            : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease',
        }}
      >
        <div
          className={`apple-glass-strong flex h-10 w-10 items-center justify-center rounded-full border shadow-[var(--shadow-float)] transition-colors duration-150 ${
            isReady || isRefreshing
              ? 'border-[var(--accent)]/35 text-[var(--accent-fg)]'
              : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
          }`}
        >
          <RefreshCw
            size={18}
            strokeWidth={2.2}
            className={isRefreshing ? 'animate-spin' : ''}
            style={
              isRefreshing
                ? undefined
                : { transform: `rotate(${Math.round(pullDistance * 4.2)}deg)` }
            }
          />
        </div>
      </div>

      {/* Content gently shifts down while pulling */}
      <div
        style={{
          transform:
            pullDistance > 0 ? `translateY(${Math.round(pullDistance * 0.45)}px)` : undefined,
          transition: isPullingRef.current
            ? 'none'
            : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
