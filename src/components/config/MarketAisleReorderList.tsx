import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import {
  PRODUCT_CATEGORY_MAP,
  type ProductCategoryId,
} from '../../types/shopping';
import { CategoryDot, CategoryIcon } from '../common/CategoryIcon';

interface MarketAisleReorderListProps {
  categoryOrder: ProductCategoryId[];
  onMove: (fromIndex: number, toIndex: number) => void;
}

interface ActiveDrag {
  /** Touch identifier (touch) or pointerId (mouse) */
  idKey: number;
  inputType: 'touch' | 'mouse';
  id: ProductCategoryId;
  itemEl: HTMLLIElement;
  rows: HTMLLIElement[];
  from: number;
  to: number;
  startY: number;
  step: number;
}

interface PendingHold {
  idKey: number;
  inputType: 'touch' | 'mouse';
  id: ProductCategoryId;
  itemEl: HTMLLIElement;
  startX: number;
  startY: number;
  lastY: number;
  timer: ReturnType<typeof setTimeout> | null;
}

interface PendingSettle {
  timer: ReturnType<typeof setTimeout>;
  run: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readCssMs(varName: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    varName,
  );
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function findTouchById(list: TouchList, id: number): Touch | null {
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].identifier === id) return list[i];
  }
  return null;
}

export function MarketAisleReorderList({
  categoryOrder,
  onMove,
}: MarketAisleReorderListProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const rowRefs = useRef<Map<ProductCategoryId, HTMLLIElement>>(new Map());

  const dragRef = useRef<ActiveDrag | null>(null);
  const holdRef = useRef<PendingHold | null>(null);
  const settleRef = useRef<PendingSettle | null>(null);

  // FLIP animation state for arrow-button reordering
  const flipSnapshotsRef = useRef<Map<ProductCategoryId, number> | null>(null);
  const flipMovedIdRef = useRef<ProductCategoryId | null>(null);
  const arrowPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [holdingId, setHoldingId] = useState<ProductCategoryId | null>(null);
  const [draggingId, setDraggingId] = useState<ProductCategoryId | null>(null);
  const [settlingId, setSettlingId] = useState<ProductCategoryId | null>(null);
  const [arrowActiveId, setArrowActiveId] = useState<ProductCategoryId | null>(
    null,
  );

  // Keep latest callback/order accessible inside window event handlers
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const lockBodyScroll = useCallback((locked: boolean) => {
    if (typeof document === 'undefined') return;
    if (locked) {
      document.documentElement.style.overscrollBehaviorY = 'none';
    } else {
      document.documentElement.style.overscrollBehaviorY = '';
    }
  }, []);

  const clearHold = useCallback(() => {
    if (holdRef.current?.timer) {
      clearTimeout(holdRef.current.timer);
    }
    holdRef.current = null;
    setHoldingId(null);
  }, []);

  const flushPendingSettle = useCallback(() => {
    if (settleRef.current) {
      clearTimeout(settleRef.current.timer);
      settleRef.current.run();
    }
  }, []);

  const computeSlotStep = (listEl: HTMLUListElement, itemEl: HTMLLIElement) => {
    const gap = parseFloat(getComputedStyle(listEl).rowGap) || 8;
    const height = itemEl.getBoundingClientRect().height || 58;
    return height + gap;
  };

  const updateDragPosition = useCallback((clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dy = clientY - drag.startY;
    drag.itemEl.style.setProperty('--dy', `${dy}px`);

    const to = Math.max(
      0,
      Math.min(drag.rows.length - 1, drag.from + Math.round(dy / drag.step)),
    );
    if (to !== drag.to) {
      drag.to = to;
      drag.rows.forEach((row, i) => {
        if (row === drag.itemEl) return;
        let shift = 0;
        if (drag.from < to && i > drag.from && i <= to) shift = -drag.step;
        if (drag.from > to && i >= to && i < drag.from) shift = drag.step;
        row.style.transform =
          shift === 0 ? '' : `translate3d(0, ${shift}px, 0)`;
      });
    }
  }, []);

  const beginDrag = useCallback(
    (
      idKey: number,
      inputType: 'touch' | 'mouse',
      id: ProductCategoryId,
      itemEl: HTMLLIElement,
      startY: number,
    ) => {
      const listEl = listRef.current;
      if (!listEl) return;

      flushPendingSettle();
      clearHold();

      const rows = Array.from(listEl.children) as HTMLLIElement[];
      const from = rows.indexOf(itemEl);
      if (from === -1) return;

      const step = computeSlotStep(listEl, itemEl);

      dragRef.current = {
        idKey,
        inputType,
        id,
        itemEl,
        rows,
        from,
        to: from,
        startY,
        step,
      };

      setDraggingId(id);
      itemEl.classList.add('is-dragging');
      itemEl.style.setProperty('--dy', '0px');
      lockBodyScroll(true);

      if (inputType === 'mouse') {
        try {
          itemEl.setPointerCapture(idKey);
        } catch {
          // Ignore if capture is unavailable
        }
      }
    },
    [clearHold, flushPendingSettle, lockBodyScroll],
  );

  const finishDrag = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;

    lockBodyScroll(false);
    setDraggingId(null);

    if (d.inputType === 'mouse') {
      try {
        if (d.itemEl.hasPointerCapture?.(d.idKey)) {
          d.itemEl.releasePointerCapture(d.idKey);
        }
      } catch {
        // Ignore release errors
      }
    }

    const listEl = listRef.current;
    const restPx = (d.to - d.from) * d.step;

    d.itemEl.classList.remove('is-dragging');
    d.itemEl.style.setProperty('--rest', `${restPx}px`);

    const commit = () => {
      if (!settleRef.current) return;
      settleRef.current = null;

      d.rows.forEach((row) => {
        row.style.transition = 'none';
        row.style.transform = '';
        row.style.removeProperty('--dy');
        row.style.removeProperty('--rest');
      });
      d.itemEl.classList.remove('is-settling');
      setSettlingId(null);

      if (d.to !== d.from) {
        onMoveRef.current(d.from, d.to);
      }

      if (listEl) {
        void listEl.offsetHeight;
      }
      requestAnimationFrame(() => {
        d.rows.forEach((row) => {
          row.style.transition = '';
        });
      });
    };

    if (prefersReducedMotion()) {
      settleRef.current = { run: commit, timer: setTimeout(commit, 0) };
      commit();
      return;
    }

    setSettlingId(d.id);
    d.itemEl.classList.add('is-settling');
    const dropMs = readCssMs('--reorder-drop', 260);
    settleRef.current = {
      run: commit,
      timer: setTimeout(commit, dropMs),
    };
  }, [lockBodyScroll]);

  // Native non-passive Touch Listeners for rock-solid mobile drag (never hijacked by browser scroll!)
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('[data-no-drag="true"]')) return;

      const itemEl = target.closest<HTMLLIElement>('li[data-cat-id]');
      if (!itemEl) return;
      const catId = itemEl.dataset.catId as ProductCategoryId | undefined;
      if (!catId) return;

      const touch = e.touches[0];
      const isHandle = Boolean(target.closest('[data-drag-handle="true"]'));

      // 1. Grip handle: prevent native scroll immediately and start dragging at 0ms
      if (isHandle) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(14);
          } catch {
            // Ignore unsupported vibrate
          }
        }
        beginDrag(touch.identifier, 'touch', catId, itemEl, touch.clientY);
        return;
      }

      // 2. Row body: arm 180ms press-and-hold so vertical scrolling stays smooth when swiping immediately
      clearHold();
      const touchId = touch.identifier;
      const startX = touch.clientX;
      const startY = touch.clientY;
      setHoldingId(catId);

      const timer = setTimeout(() => {
        const currentHold = holdRef.current;
        if (!currentHold || currentHold.idKey !== touchId) return;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(18);
          } catch {
            // Ignore unsupported vibrate
          }
        }
        beginDrag(touchId, 'touch', catId, itemEl, currentHold.lastY);
      }, 180);

      holdRef.current = {
        idKey: touchId,
        inputType: 'touch',
        id: catId,
        itemEl,
        startX,
        startY,
        lastY: startY,
        timer,
      };
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      // Active touch drag: block native browser scroll & pull-to-refresh unconditionally
      const drag = dragRef.current;
      if (drag && drag.inputType === 'touch') {
        const touch = findTouchById(e.touches, drag.idKey);
        if (!touch) return;
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        updateDragPosition(touch.clientY);
        return;
      }

      // Pending touch hold: if user swipes > 10px before 180ms, cancel hold and allow normal scroll
      const hold = holdRef.current;
      if (hold && hold.inputType === 'touch') {
        const touch = findTouchById(e.touches, hold.idKey);
        if (!touch) return;
        hold.lastY = touch.clientY;
        const distX = Math.abs(touch.clientX - hold.startX);
        const distY = Math.abs(touch.clientY - hold.startY);
        if (distX > 10 || distY > 10) {
          clearHold();
        }
      }
    };

    const handleWindowTouchEnd = (e: TouchEvent) => {
      const hold = holdRef.current;
      if (hold && hold.inputType === 'touch') {
        if (findTouchById(e.changedTouches, hold.idKey)) {
          clearHold();
        }
      }

      const drag = dragRef.current;
      if (drag && drag.inputType === 'touch') {
        if (findTouchById(e.changedTouches, drag.idKey)) {
          finishDrag();
        }
      }
    };

    listEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleWindowTouchMove, {
      passive: false,
    });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleWindowTouchEnd, {
      passive: true,
    });

    return () => {
      listEl.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
    };
  }, [beginDrag, clearHold, finishDrag, updateDragPosition]);

  // Desktop Mouse Pointer Listeners (completely separate from mobile Touch Events)
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;

      const drag = dragRef.current;
      if (drag && drag.inputType === 'mouse' && e.pointerId === drag.idKey) {
        updateDragPosition(e.clientY);
        return;
      }

      const hold = holdRef.current;
      if (hold && hold.inputType === 'mouse' && e.pointerId === hold.idKey) {
        const distX = Math.abs(e.clientX - hold.startX);
        const distY = Math.abs(e.clientY - hold.startY);
        if (distY > 4 || distX > 4) {
          const { idKey, id, itemEl, startY } = hold;
          beginDrag(idKey, 'mouse', id, itemEl, startY);
        }
      }
    };

    const handleWindowPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;

      if (
        holdRef.current &&
        holdRef.current.inputType === 'mouse' &&
        e.pointerId === holdRef.current.idKey
      ) {
        clearHold();
      }
      if (
        dragRef.current &&
        dragRef.current.inputType === 'mouse' &&
        e.pointerId === dragRef.current.idKey
      ) {
        finishDrag();
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
    };
  }, [beginDrag, clearHold, finishDrag, updateDragPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHold();
      lockBodyScroll(false);
      if (settleRef.current) {
        clearTimeout(settleRef.current.timer);
        settleRef.current = null;
      }
      if (arrowPulseTimerRef.current) {
        clearTimeout(arrowPulseTimerRef.current);
      }
    };
  }, [clearHold, lockBodyScroll]);

  // FLIP animation after arrow-button reorder commits new categoryOrder
  useLayoutEffect(() => {
    const snapshots = flipSnapshotsRef.current;
    const movedId = flipMovedIdRef.current;
    if (!snapshots || snapshots.size === 0) return;

    flipSnapshotsRef.current = null;
    flipMovedIdRef.current = null;

    if (prefersReducedMotion()) return;

    const animatedEls: HTMLLIElement[] = [];

    for (const catId of categoryOrder) {
      const el = rowRefs.current.get(catId);
      const prevTop = snapshots.get(catId);
      if (!el || prevTop === undefined) continue;

      const nextTop = el.getBoundingClientRect().top;
      const deltaY = prevTop - nextTop;
      if (Math.abs(deltaY) < 0.5) continue;

      const isMoved = catId === movedId;
      el.style.transition = 'none';
      el.style.zIndex = isMoved ? '10' : '1';
      el.style.transform = isMoved
        ? `translate3d(0, ${deltaY}px, 0) scale(1.02)`
        : `translate3d(0, ${deltaY}px, 0)`;
      animatedEls.push(el);
    }

    if (animatedEls.length === 0) return;

    if (listRef.current) {
      void listRef.current.offsetHeight;
    }

    requestAnimationFrame(() => {
      for (const el of animatedEls) {
        el.style.transition = '';
        el.style.transform = '';
      }
    });

    const shiftMs = readCssMs('--reorder-shift', 220);
    const zTimer = setTimeout(() => {
      for (const el of animatedEls) {
        el.style.zIndex = '';
      }
    }, shiftMs + 30);

    return () => clearTimeout(zTimer);
  }, [categoryOrder]);

  const handleRowPointerDown = (
    e: React.PointerEvent<HTMLLIElement>,
    id: ProductCategoryId,
  ) => {
    // Touch is handled exclusively by native non-passive touch listeners above
    if (e.pointerType !== 'mouse') return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) return;

    const itemEl = e.currentTarget;
    const isHandle = Boolean(target?.closest('[data-drag-handle="true"]'));

    if (isHandle) {
      e.preventDefault();
      beginDrag(e.pointerId, 'mouse', id, itemEl, e.clientY);
      return;
    }

    holdRef.current = {
      idKey: e.pointerId,
      inputType: 'mouse',
      id,
      itemEl,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      timer: null,
    };
  };

  const handleArrowMove = (
    id: ProductCategoryId,
    fromIndex: number,
    toIndex: number,
  ) => {
    if (toIndex < 0 || toIndex >= categoryOrder.length) return;
    flushPendingSettle();

    const snapshots = new Map<ProductCategoryId, number>();
    for (const catId of categoryOrder) {
      const el = rowRefs.current.get(catId);
      if (el) {
        snapshots.set(catId, el.getBoundingClientRect().top);
      }
    }
    flipSnapshotsRef.current = snapshots;
    flipMovedIdRef.current = id;

    if (arrowPulseTimerRef.current) {
      clearTimeout(arrowPulseTimerRef.current);
    }
    setArrowActiveId(id);
    arrowPulseTimerRef.current = setTimeout(() => {
      setArrowActiveId(null);
    }, 320);

    onMove(fromIndex, toIndex);
  };

  return (
    <ul
      ref={listRef}
      className="t-reorder"
      data-disable-pull-to-refresh={draggingId ? 'true' : undefined}
    >
      {categoryOrder.map((catId, index) => {
        const info = PRODUCT_CATEGORY_MAP[catId];
        const isDragging = draggingId === catId;
        const isSettling = settlingId === catId;
        const isHolding = holdingId === catId && !isDragging;
        const isArrowActive = arrowActiveId === catId;

        return (
          <li
            key={catId}
            data-cat-id={catId}
            ref={(el) => {
              if (el) {
                rowRefs.current.set(catId, el);
              } else {
                rowRefs.current.delete(catId);
              }
            }}
            onPointerDown={(e) => handleRowPointerDown(e, catId)}
            onContextMenu={(e) => e.preventDefault()}
            className={`t-reorder-item flex cursor-grab items-center gap-3 rounded-2xl border px-3.5 py-3 ${
              isDragging
                ? 'is-dragging'
                : isSettling
                  ? 'is-settling border-[var(--border-hairline)] bg-[var(--bg-app)]'
                  : isHolding
                    ? 'is-holding'
                    : isArrowActive
                      ? 't-reorder-arrow-active'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-app)] hover:border-[var(--border-subtle)]'
            }`}
          >
            {/* Dedicated Touch-Ready Grip Handle (instant scroll-proof drag on mobile & desktop) */}
            <span
              data-drag-handle="true"
              data-disable-pull-to-refresh="true"
              aria-hidden="true"
              className="flex h-10 w-10 -ml-1 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] active:cursor-grabbing"
            >
              <GripVertical size={17} strokeWidth={1.8} />
            </span>

            <span className="font-mono-tabular w-6 text-center text-xs font-semibold text-[var(--text-muted)]">
              {String(index + 1).padStart(2, '0')}
            </span>

            <CategoryDot category={catId} />
            <CategoryIcon category={catId} size={17} />

            <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">
              {info.label}
            </span>

            <div
              data-no-drag="true"
              className="flex items-center gap-1"
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={index === 0}
                onClick={() => handleArrowMove(catId, index, index - 1)}
                aria-label={`Mover ${info.label} para cima`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-[background-color,color,transform] duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-90 disabled:opacity-25"
              >
                <ArrowUp size={15} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                disabled={index === categoryOrder.length - 1}
                onClick={() => handleArrowMove(catId, index, index + 1)}
                aria-label={`Mover ${info.label} para baixo`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-[background-color,color,transform] duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-90 disabled:opacity-25"
              >
                <ArrowDown size={15} strokeWidth={1.8} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
