import React, { memo, useRef, useState } from 'react';
import { Check, Minus, Plus, Tag, Trash2 } from 'lucide-react';
import {
  PRODUCT_CATEGORY_MAP,
  getEffectiveTotalAmount,
  type ShoppingItem,
} from '../../types/shopping';
import { CategoryDot, CategoryIcon } from '../common/CategoryIcon';
import { AppFormatters } from '../../utils/formatters';

interface SwipeableShoppingItemRowProps {
  item: ShoppingItem;
  cheapestMarketName?: string | null;
  onToggleChecked: (id: string) => void;
  onOpenEdit: (item: ShoppingItem) => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
}

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

  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const currentDeltaXRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const isPressActiveRef = useRef(false);
  const lastPointerEventAtRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catInfo = PRODUCT_CATEGORY_MAP[item.category];
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
      Date.now() - lastPointerEventAtRef.current < 1000
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
      lastPointerEventAtRef.current = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    if (isDismissed || isPressActiveRef.current) return;
    isPressActiveRef.current = true;

    const { clientX, clientY } = getCoords(e);
    startXRef.current = clientX;
    startYRef.current = clientY;
    currentDeltaXRef.current = 0;
    isHorizontalSwipeRef.current = null;
    isLongPressTriggeredRef.current = false;
    clearLongPressTimer();

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
      onOpenEdit(item);
    }, 500);
  };

  const handlePressMove = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      lastPointerEventAtRef.current = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    if (isDismissed || !isPressActiveRef.current) return;
    const { clientX, clientY } = getCoords(e);
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
        if (isHorizontalSwipeRef.current) {
          clearLongPressTimer();
        }
      }
    }

    if (isHorizontalSwipeRef.current) {
      clearLongPressTimer();
      currentDeltaXRef.current = deltaX;
      if (deltaX < 0) {
        setIsSwiping(true);
        const damped = deltaX < -120 ? -120 + (deltaX + 120) * 0.25 : deltaX;
        setTranslateX(damped);
      } else {
        setTranslateX(0);
      }
    } else if (Math.abs(deltaY) > 8) {
      clearLongPressTimer();
    }
  };

  const handlePressEnd = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      lastPointerEventAtRef.current = Date.now();
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

    if (isSwiping || currentDeltaXRef.current < -15) {
      setIsSwiping(false);
      if (currentDeltaXRef.current < -85) {
        setIsDismissed(true);
        setTranslateX(-500);
        setTimeout(() => {
          onRemove(item.id);
        }, 220);
        return;
      }
      setTranslateX(0);
      currentDeltaXRef.current = 0;
      return;
    }

    onToggleChecked(item.id);
  };

  const handlePressCancel = () => {
    lastPointerEventAtRef.current = Date.now();
    isPressActiveRef.current = false;
    isLongPressTriggeredRef.current = false;
    clearLongPressTimer();
    setIsSwiping(false);
    setTranslateX(0);
    currentDeltaXRef.current = 0;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl select-none transition-[opacity,transform] duration-200 ease-ui ${
        isDismissed ? 'pointer-events-none h-0 opacity-0' : 'opacity-100'
      }`}
    >
      {/* Delete reveal layer */}
      <div
        className={`absolute inset-0 flex items-center justify-end rounded-xl bg-[var(--negative)] px-4 text-[#FDFBF7] transition-opacity duration-150 ease-ui ${
          translateX < -5 ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <span>Remover</span>
          <Trash2 size={16} strokeWidth={1.5} />
        </div>
      </div>

      {/* Foreground product card */}
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
          transition: isSwiping ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`relative flex cursor-pointer touch-pan-y items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-2xs transition-colors duration-150 ease-ui ${
          item.isChecked ? 'opacity-70' : ''
        }`}
      >
        {/* Status / Category Box */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 ease-ui ${
            item.isChecked
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
              : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]'
          }`}
        >
          {item.isChecked ? (
            <Check size={16} strokeWidth={2} />
          ) : (
            <CategoryIcon category={item.category} size={18} />
          )}
        </div>

        {/* Product Information */}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium leading-5 ${
              item.isChecked
                ? 'text-[var(--text-muted)] line-through'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {item.name}
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-4 text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
              <CategoryDot category={item.category} />
              {catInfo.label}
            </span>
            {total > 0 ? (
              <span className="font-mono-tabular font-medium text-[var(--accent-fg)]">
                {AppFormatters.formatCurrency(total)}
              </span>
            ) : (
              <span>Sem preço</span>
            )}
            {cheapestMarketName && (
              <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                Menor em {cheapestMarketName}
              </span>
            )}
          </div>
        </div>

        {/* Right Controls */}
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
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-[color,background-color,border-color,transform] duration-150 ease-ui active:scale-[0.98] ${
              hasPrice
                ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-fg)]'
                : 'border-[var(--border-hairline)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Tag size={15} strokeWidth={1.5} />
          </button>

          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-1"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateQuantity(item.id, Math.max(1, item.quantity - 1));
              }}
              aria-label="Diminuir quantidade"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-[0.98]"
            >
              <Minus size={14} strokeWidth={1.5} />
            </button>
            <span className="font-mono-tabular min-w-[40px] text-center text-xs font-medium text-[var(--text-primary)]">
              {item.quantity} {item.unit}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateQuantity(item.id, item.quantity + 1);
              }}
              aria-label="Aumentar quantidade"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-[0.98]"
            >
              <Plus size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
