import React, { useRef, useState } from 'react';
import { Check, Minus, Plus, Tag, Trash2 } from 'lucide-react';
import {
  PRODUCT_CATEGORY_MAP,
  getEffectiveTotalAmount,
  type ShoppingItem,
} from '../../types/shopping';
import { CategoryIcon } from '../common/CategoryIcon';
import { AppFormatters } from '../../utils/formatters';

interface SwipeableShoppingItemRowProps {
  item: ShoppingItem;
  cheapestMarketName?: string | null;
  onToggleChecked: (id: string) => void;
  onOpenEdit: (item: ShoppingItem) => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
}

export function SwipeableShoppingItemRow({
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

  const getCoords = (e: React.SyntheticEvent) => {
    const anyE = e as unknown as {
      clientX?: number;
      clientY?: number;
      touches?: Array<{ clientX: number; clientY: number }>;
    };
    if (anyE.touches && anyE.touches.length > 0) {
      return { clientX: anyE.touches[0].clientX, clientY: anyE.touches[0].clientY };
    }
    return {
      clientX: anyE.clientX ?? 0,
      clientY: anyE.clientY ?? 0,
    };
  };

  const handlePointerDown = (e: React.SyntheticEvent) => {
    if (isDismissed) return;
    const { clientX, clientY } = getCoords(e);
    startXRef.current = clientX;
    startYRef.current = clientY;
    currentDeltaXRef.current = 0;
    isHorizontalSwipeRef.current = null;
    isLongPressTriggeredRef.current = false;
    clearLongPressTimer();

    // Long press: 500ms opens product configuration
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

  const handlePointerMove = (e: React.SyntheticEvent) => {
    if (isDismissed) return;
    const { clientX, clientY } = getCoords(e);
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    // Detect direction if movement exceeds 8px
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
      // Only drag from right to left (deltaX < 0)
      if (deltaX < 0) {
        setIsSwiping(true);
        // Soft resistance damping past -120px
        const damped = deltaX < -120 ? -120 + (deltaX + 120) * 0.25 : deltaX;
        setTranslateX(damped);
      } else {
        setTranslateX(0);
      }
    } else if (Math.abs(deltaY) > 8) {
      clearLongPressTimer();
    }
  };

  const handlePointerUpOrCancel = () => {
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
      // Swipe threshold: past -85px removes item
      if (currentDeltaXRef.current < -85) {
        setIsDismissed(true);
        setTranslateX(-500);
        setTimeout(() => {
          onRemove(item.id);
        }, 220);
        return;
      }
      // Snap back if released before threshold
      setTranslateX(0);
      currentDeltaXRef.current = 0;
      return;
    }

    // Pure click/tap: toggle checked/unchecked
    onToggleChecked(item.id);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl select-none transition-all duration-200 ${
        isDismissed ? 'max-h-0 opacity-0 my-0 py-0' : 'max-h-32 my-1'
      }`}
    >
      {/* Background red delete container revealed ONLY when dragging left */}
      <div
        className={`absolute inset-0 flex items-center justify-end rounded-2xl bg-red-500 px-5 text-white transition-opacity ${
          translateX < -5 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span>Remover</span>
          <Trash2 size={18} />
        </div>
      </div>

      {/* Foreground product card */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUpOrCancel}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUpOrCancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.22s ease-out',
        }}
        className="relative flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-2xs cursor-pointer touch-pan-y transition-colors dark:border-[#2E3440] dark:bg-[#1E2229]"
      >
        {/* Category Icon Badge with Checkmark State */}
        <div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition"
          style={{
            backgroundColor: item.isChecked
              ? 'rgba(0, 200, 83, 0.16)'
              : `${catInfo.color}22`,
            color: item.isChecked ? '#00C853' : catInfo.color,
          }}
        >
          <CategoryIcon category={item.category} size={20} />
          {item.isChecked && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#00C853] text-white shadow-xs">
              <Check size={11} strokeWidth={3.5} />
            </span>
          )}
        </div>

        {/* Product Information */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`truncate text-sm font-bold ${
                item.isChecked
                  ? 'text-[#6B7280] line-through dark:text-[#9CA3AF]'
                  : 'text-[#111827] dark:text-[#F3F4F6]'
              }`}
            >
              {item.name}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
            <span className="font-semibold" style={{ color: catInfo.color }}>
              {catInfo.label}
            </span>
            {total > 0 ? (
              <span className="font-bold text-[#00C853]">
                · {AppFormatters.formatCurrency(total)}
              </span>
            ) : (
              <span className="text-[#10B981]">· Informar preço</span>
            )}
            {cheapestMarketName && (
              <span className="rounded-md bg-[#00C853]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#00C853]">
                + barato: {cheapestMarketName}
              </span>
            )}
          </div>
        </div>

        {/* Right side controls: Tag/price status icon & Quantity stepper */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Tag icon (quick edit button) */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenEdit(item);
            }}
            title={hasPrice ? 'Editar produto (precificado)' : 'Editar produto'}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition active:scale-90 ${
              hasPrice
                ? 'border-[#00C853]/40 bg-[#00C853]/10 text-[#00C853]'
                : 'border-[#E5E7EB] text-[#9CA3AF] hover:text-[#6B7280] dark:border-[#2E3440]'
            }`}
          >
            <Tag size={13} />
          </button>

          {/* Quantity stepper (stopPropagation to prevent toggling check) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-xl bg-[#F3F4F6] p-1 dark:bg-[#181B20]"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateQuantity(item.id, Math.max(1, item.quantity - 1));
              }}
              aria-label="Diminuir quantidade"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[#6B7280] hover:bg-white dark:text-[#9CA3AF] dark:hover:bg-[#1E2229] transition active:scale-90"
            >
              <Minus size={13} />
            </button>
            <span className="min-w-[34px] text-center text-[11px] font-bold text-[#111827] dark:text-[#F3F4F6]">
              {item.quantity} {item.unit}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateQuantity(item.id, item.quantity + 1);
              }}
              aria-label="Aumentar quantidade"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[#6B7280] hover:bg-white dark:text-[#9CA3AF] dark:hover:bg-[#1E2229] transition active:scale-90"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
