import { memo, useEffect, useRef, useState } from 'react';
import { Minus, Plus, Store, Tag } from 'lucide-react';
import {
  getEffectiveTotalAmount,
  type ShoppingItem,
} from '../../types/shopping';
import { CategoryBadge } from '../common/CategoryIcon';
import { SwipeableRow } from '../common/SwipeableRow';
import { AppFormatters } from '../../utils/formatters';

interface SwipeableShoppingItemRowProps {
  item: ShoppingItem;
  cheapestMarketName?: string | null;
  onToggleChecked: (id: string) => void;
  onOpenEdit: (item: ShoppingItem) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

export const SwipeableShoppingItemRow = memo(function SwipeableShoppingItemRow({
  item,
  cheapestMarketName,
  onToggleChecked,
  onOpenEdit,
  onUpdateQuantity,
  onRemove,
}: SwipeableShoppingItemRowProps) {
  const [justChecked, setJustChecked] = useState(false);
  const prevCheckedRef = useRef(item.isChecked);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!prevCheckedRef.current && item.isChecked) {
      setJustChecked(true);
      t = setTimeout(() => setJustChecked(false), 380);
    }
    prevCheckedRef.current = item.isChecked;
    return () => {
      if (t) clearTimeout(t);
    };
  }, [item.isChecked]);

  const hasPrice = item.price != null && item.price > 0;
  const total = getEffectiveTotalAmount(item);

  return (
    <SwipeableRow
      onTap={() => onToggleChecked(item.id)}
      onLongPress={() => onOpenEdit(item)}
      onRemove={() => onRemove(item.id)}
      removeLabel={`Remover ${item.name}`}
      containerClassName="relative overflow-hidden rounded-2xl select-none touch-pan-y"
      revealClassName="absolute inset-0 flex items-center justify-end rounded-2xl bg-[var(--danger)] px-5"
      foregroundClassName={`card-interactive relative flex cursor-pointer touch-pan-y items-center gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-3 shadow-[var(--shadow-card)] sm:px-4 sm:py-3.5 ${
        item.isChecked ? 'opacity-65' : ''
      }`}
    >
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
          data-no-swipe="true"
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
    </SwipeableRow>
  );
});
