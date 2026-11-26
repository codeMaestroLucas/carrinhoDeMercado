import React, { memo, useEffect, useRef, useState } from 'react';
import { Minus, Plus, Store, Tag, Trash2 } from 'lucide-react';
import {
  getEffectiveTotalAmount,
  type ShoppingItem,
} from '../../types/shopping';
import { CategoryBadge } from '../common/CategoryIcon';
import { AppFormatters } from '../../utils/formatters';

interface SwipeableShoppingItemRowProps {
  item: ShoppingItem;
  cheapestMarketName?: string | null;
  onToggleChecked: (id: string) => void;
  onOpenEdit: (item: ShoppingItem) => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
}

/**
 * Shared across all list rows so that when tapping Item A moves it to the
 * checked section and Item B shifts upward under the user's finger, the
 * browser's delayed compatibility mouse events cannot ghost-click Item B.
 */
let lastGlobalPointerEventAt = 0;

export const SwipeableShoppingItemRow = memo(function SwipeableShoppingItemRow({
  item,
  cheapestMarketName,
  onToggleChecked,
  onOpenEdit,
  onRemove,
  onUpdateQuantity,
}: SwipeableShoppingItemRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const currentDeltaXRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const isPressActiveRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCheckedRef = useRef(item.isChecked);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!prevCheckedRef.current && item.isChecked) {
      setJustChecked(true);
      const t = setTimeout(() => setJustChecked(false), 380);
      prevCheckedRef.current = item.isChecked;
      return () => clearTimeout(t);
    }
    prevCheckedRef.current = item.isChecked;
  }, [item.isChecked]);

  const total = getEffectiveTotalAmount(item);
  const hasPrice = item.price != null && item.price > 0;

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const isMouseDuplicateAfterPointer = (e: React.SyntheticEvent): boolean => {
    return (
      e.type.startsWith('mouse') &&
      Date.now() - lastGlobalPointerEventAt < 1000
    );
  };

  const getCoords = (e: React.SyntheticEvent) => {
    const anyE = e as unknown as {
      clientX?: number;
      clientY?: number;
    };
    return {
      clientX: anyE.clientX ?? 0,
      clientY: anyE.clientY ?? 0,
    };
  };

  const handlePressStart = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      const pe = e as React.PointerEvent;
      if (pe.pointerType === 'mouse' && pe.button !== 0) return;
      lastGlobalPointerEventAt = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    if (isDismissed || isPressActiveRef.current) return;
    isPressActiveRef.current = true;

    const { clientX, clientY } = getCoords(e);
    startXRef.current = clientX;
    startYRef.current = clientY;
    startTimeRef.current = Date.now();
    currentDeltaXRef.current = 0;
    isHorizontalSwipeRef.current = null;
    isLongPressTriggeredRef.current = false;
    clearLongPressTimer();

    longPressTimerRef.current = setTimeout(() => {
      if (
        isPressActiveRef.current &&
        Math.abs(currentDeltaXRef.current) < 10 &&
        isHorizontalSwipeRef.current !== true
      ) {
        isLongPressTriggeredRef.current = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(25);
          } catch {
            // Ignore vibration failures
          }
        }
        onOpenEdit(item);
      }
    }, 500);
  };

  const handlePressMove = (e: React.SyntheticEvent) => {
    if (isMouseDuplicateAfterPointer(e)) return;
    if (!isPressActiveRef.current || isDismissed) return;

    const { clientX, clientY } = getCoords(e);
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
        clearLongPressTimer();
      }
    }

    if (isHorizontalSwipeRef.current) {
      setIsSwiping(true);
      if (deltaX < 0) {
        // Elastic rubber-banding resistance past -140px
        const damped =
          deltaX < -140 ? -140 + (deltaX + 140) * 0.25 : deltaX;
        const clamped = Math.max(-185, damped);
        currentDeltaXRef.current = clamped;
        setTranslateX(clamped);
      } else {
        // Progressive rubber-banding when pulling beyond left edge (0)
        const elasticRight = Math.min(24, deltaX * 0.22);
        currentDeltaXRef.current = elasticRight;
        setTranslateX(elasticRight);
      }
    }
  };

  const handlePressEnd = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      lastGlobalPointerEventAt = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    if (!isPressActiveRef.current) return;
    isPressActiveRef.current = false;
    clearLongPressTimer();

    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      setIsSwiping(false);
      setTranslateX(0);
      currentDeltaXRef.current = 0;
      return;
    }

    const finalDeltaX = currentDeltaXRef.current;
    const wasHorizontal = isHorizontalSwipeRef.current === true;
    const elapsedMs = Math.max(16, Date.now() - startTimeRef.current);
    const velocityPxPerMs = finalDeltaX / elapsedMs;
    setIsSwiping(false);

    if (wasHorizontal) {
      // Velocity-aware dismissal: fast flick OR crossing the -85px threshold
      const shouldDismiss =
        finalDeltaX <= -85 || (velocityPxPerMs < -0.55 && finalDeltaX <= -45);

      if (shouldDismiss) {
        setIsDismissed(true);
        setTranslateX(-400);
        setTimeout(() => {
          onRemove(item.id);
        }, 180);
      } else {
        setTranslateX(0);
        currentDeltaXRef.current = 0;
      }
      return;
    }

    // Prevent any lingering synthetic click from landing on a row that shifts up
    if (e.type.startsWith('pointer')) {
      e.preventDefault();
    }
    onToggleChecked(item.id);
  };

  const handlePressCancel = () => {
    lastGlobalPointerEventAt = Date.now();
    isPressActiveRef.current = false;
    isLongPressTriggeredRef.current = false;
    clearLongPressTimer();
    setIsSwiping(false);
    setTranslateX(0);
    currentDeltaXRef.current = 0;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl select-none transition-[opacity,transform] duration-200 ease-ui ${
        isDismissed ? 'pointer-events-none h-0 opacity-0' : 'opacity-100'
      }`}
    >
      {/* Delete reveal layer */}
      <div
        className={`absolute inset-0 flex items-center justify-end rounded-2xl bg-[var(--negative)] px-5 text-white transition-opacity duration-150 ease-ui ${
          translateX < -5 ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>Remover</span>
          <Trash2 size={16} strokeWidth={1.8} />
        </div>
      </div>

      {/* Foreground product row */}
      <div
        onPointerDown={handlePressStart}
        onPointerMove={handlePressMove}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressCancel}
        onMouseDown={handlePressStart}
        onMouseMove={handlePressMove}
        onMouseUp={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping
            ? 'none'
            : 'transform 260ms cubic-bezier(0.34, 1.24, 0.64, 1)',
        }}
        className={`card-interactive relative flex cursor-pointer touch-pan-y items-center gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-3 shadow-[var(--shadow-card)] sm:px-4 sm:py-3.5 ${
          item.isChecked ? 'opacity-65' : ''
        }`}
      >
        {/* Bright Apple Pastel Category Icon Tile (clean, no checkbox) */}
        <div className="relative shrink-0">
          {justChecked && (
            <span
              aria-hidden="true"
              className="animate-check-halo pointer-events-none absolute inset-0 rounded-xl bg-[var(--accent)]"
            />
          )}
          <CategoryBadge
            category={item.category}
            size={18}
            className={`h-10 w-10 rounded-xl transition-transform duration-150 ${
              justChecked ? 'animate-check-pop' : ''
            }`}
          />
        </div>

        {/* Product Info */}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[15px] font-medium leading-snug transition-colors duration-150 ${
              item.isChecked
                ? 'text-[var(--text-muted)] line-through'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {item.name}
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
            {hasPrice && item.quantity > 1 && !item.isPriceTotal && (
              <span className="font-mono-tabular">
                {AppFormatters.formatCurrency(item.price!)}/{item.unit}
              </span>
            )}

            {cheapestMarketName && !item.isChecked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-fg)]">
                <Store size={11} strokeWidth={2} />
                <span className="max-w-[140px] truncate">{cheapestMarketName}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Price trigger + Tactile Quantity stepper */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenEdit(item);
            }}
            title={hasPrice ? 'Editar produto e preço' : 'Informar preço'}
            aria-label={`Editar ${item.name}`}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-[background-color,color,transform] duration-100 ease-ui active:scale-[0.97] ${
              hasPrice
                ? 'bg-[var(--accent-soft)] text-[var(--accent-fg)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {hasPrice ? (
              <span className="font-mono-tabular font-semibold">
                {AppFormatters.formatCurrency(total)}
              </span>
            ) : (
              <>
                <Tag size={13} strokeWidth={1.8} />
                <span className="hidden sm:inline">Preço</span>
              </>
            )}
          </button>

          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex h-9 items-center gap-0.5 rounded-full bg-[var(--bg-subtle)] p-0.5"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateQuantity(item.id, Math.max(1, item.quantity - 1));
              }}
              aria-label="Diminuir quantidade"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition-[background-color,color,transform] duration-100 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <Minus size={13} strokeWidth={2.1} />
            </button>
            <span
              key={`${item.quantity}-${item.unit}`}
              className="animate-qty-bump font-mono-tabular min-w-[36px] text-center text-xs font-semibold text-[var(--text-primary)]"
            >
              {item.quantity}
              <span className="ml-0.5 font-normal text-[var(--text-muted)]">
                {item.unit}
              </span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateQuantity(item.id, item.quantity + 1);
              }}
              aria-label="Aumentar quantidade"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition-[background-color,color,transform] duration-100 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <Plus size={13} strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
