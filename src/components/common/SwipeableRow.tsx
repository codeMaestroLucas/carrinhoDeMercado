import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/browser';

// Shared across instances because mobile browsers can synthesize mouse events
// on a newly shifted row after a pointer tap moves the list layout.
let lastGlobalPointerTapAt = 0;

function getEventCoords(e: React.SyntheticEvent): { x: number; y: number } {
  const evt = e as unknown as { clientX?: number; clientY?: number };
  return { x: evt.clientX ?? 0, y: evt.clientY ?? 0 };
}

interface SwipeableRowProps {
  onTap?: () => void;
  onLongPress?: () => void;
  onRemove: () => void;
  removeLabel: string;
  longPressHapticMs?: number;
  peekOnMount?: boolean;
  containerClassName?: string;
  revealClassName?: string;
  foregroundClassName?: string;
  children: ReactNode;
}

export function SwipeableRow({
  onTap,
  onLongPress,
  onRemove,
  removeLabel,
  longPressHapticMs = 25,
  peekOnMount = false,
  containerClassName = 'relative overflow-hidden rounded-[20px] select-none touch-pan-y',
  revealClassName = 'absolute inset-0 bg-[var(--danger)] flex items-center justify-end px-6 rounded-[20px]',
  foregroundClassName = 'relative border transition-colors',
  children,
}: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const dragAxisRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const didSwipeRef = useRef(false);
  const didLongPressRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointerEventAtRef = useRef<number>(0);

  const isMouseDuplicateAfterPointer = (e: React.SyntheticEvent): boolean => {
    if (!e.type.startsWith('mouse')) return false;
    const now = Date.now();
    return (
      now - lastPointerEventAtRef.current < 1000 ||
      now - lastGlobalPointerTapAt < 1000
    );
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!peekOnMount) return;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const startTimer = setTimeout(() => {
      setTranslateX(-36);
      resetTimer = setTimeout(() => {
        setTranslateX(0);
      }, 420);
    }, 600);
    return () => {
      clearTimeout(startTimer);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [peekOnMount]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleStart = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      lastPointerEventAtRef.current = Date.now();
      const pe = e as React.PointerEvent;
      if (pe.pointerType === 'mouse' && pe.button !== 0) return;
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target.closest('button, input, a, select, textarea, [data-no-swipe="true"]')
    ) {
      return;
    }

    const { x, y } = getEventCoords(e);
    startXRef.current = x;
    startYRef.current = y;
    startTimeRef.current = Date.now();
    currentXRef.current = 0;
    dragAxisRef.current = 'none';
    didSwipeRef.current = false;
    didLongPressRef.current = false;
    setIsDragging(true);

    clearLongPressTimer();
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        if (
          startXRef.current !== null &&
          Math.abs(currentXRef.current) < 10 &&
          dragAxisRef.current !== 'vertical'
        ) {
          didLongPressRef.current = true;
          triggerHaptic(longPressHapticMs);
          onLongPress();
          startXRef.current = null;
          startYRef.current = null;
          setIsDragging(false);
          setTranslateX(0);
        }
      }, 500);
    }
  };

  const handleMove = (e: React.SyntheticEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    if (isMouseDuplicateAfterPointer(e)) return;

    const { x, y } = getEventCoords(e);
    const dx = x - startXRef.current;
    const dy = y - startYRef.current;

    if (dragAxisRef.current === 'none') {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        dragAxisRef.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        clearLongPressTimer();
      }
    }

    if (dragAxisRef.current === 'horizontal') {
      didSwipeRef.current = true;
      let clamped: number;
      if (dx < 0) {
        clamped =
          dx < -140
            ? -140 + (dx + 140) * 0.25
            : dx;
        clamped = Math.max(-185, clamped);
      } else {
        clamped = Math.min(24, dx * 0.22);
      }
      currentXRef.current = clamped;
      setTranslateX(clamped);
    }
  };

  const handleEnd = (e: React.SyntheticEvent) => {
    clearLongPressTimer();

    if (e.type.startsWith('pointer')) {
      lastPointerEventAtRef.current = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      startXRef.current = null;
      startYRef.current = null;
      setIsDragging(false);
      return;
    }

    if (startXRef.current === null) {
      setIsDragging(false);
      return;
    }

    const wasHorizontal = dragAxisRef.current === 'horizontal';
    const wasVertical = dragAxisRef.current === 'vertical';
    const finalX = currentXRef.current;
    const elapsedMs = Math.max(1, Date.now() - startTimeRef.current);
    const velocityX = finalX / elapsedMs;

    startXRef.current = null;
    startYRef.current = null;
    dragAxisRef.current = 'none';
    setIsDragging(false);

    if (wasHorizontal && (finalX < -85 || (velocityX < -0.55 && finalX < -45))) {
      setTranslateX(-400);
      removeTimerRef.current = setTimeout(() => {
        onRemove();
      }, 180);
      return;
    }

    setTranslateX(0);

    if (
      !wasHorizontal &&
      !wasVertical &&
      !didSwipeRef.current &&
      !didLongPressRef.current
    ) {
      if (e.type.startsWith('pointer')) {
        lastGlobalPointerTapAt = Date.now();
      }
      onTap?.();
    }
  };

  const handleCancel = (e: React.SyntheticEvent) => {
    clearLongPressTimer();
    if (e.type.startsWith('pointer')) {
      lastPointerEventAtRef.current = Date.now();
    }
    startXRef.current = null;
    startYRef.current = null;
    dragAxisRef.current = 'none';
    setIsDragging(false);
    setTranslateX(0);
  };

  const showDeleteReveal = translateX < -12;

  return (
    <div className={containerClassName}>
      <div
        className={`${revealClassName} transition-opacity duration-150 ${
          showDeleteReveal ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!showDeleteReveal}
      >
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onRemove();
          }}
          className="flex items-center gap-1.5 text-white font-semibold text-sm"
          aria-label={removeLabel}
        >
          <Trash2 className="w-4 h-4" />
          Remover
        </button>
      </div>

      <div
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleCancel}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: isDragging
            ? 'none'
            : 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        className={foregroundClassName}
      >
        {children}
      </div>
    </div>
  );
}
