import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
} from '../../types/shopping';
import { AppFormatters, COMMON_UNITS } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { ModalShell } from '../common/ModalShell';
import type { EditableReceiptItem } from './receiptImportTypes';

interface EditScannedItemModalProps {
  item: EditableReceiptItem;
  itemNumber: number;
  isNew?: boolean;
  onSave: (updated: EditableReceiptItem) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export function EditScannedItemModal({
  item,
  itemNumber,
  isNew = false,
  onSave,
  onRemove,
  onClose,
}: EditScannedItemModalProps) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<ProductCategoryId>(item.category);
  const [quantityStr, setQuantityStr] = useState(item.quantityStr);
  const [unit, setUnit] = useState(item.unit || 'un');
  const [priceStr, setPriceStr] = useState(item.priceStr);
  const [error, setError] = useState<string | null>(null);

  const availableUnits = Array.from(new Set([...COMMON_UNITS, unit || 'un']));

  const parsedPrice = AppFormatters.parsePrice(priceStr) ?? 0;
  const parsedQty = AppFormatters.parseQuantity(quantityStr, unit) ?? 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do produto');
      return;
    }

    const finalPrice = AppFormatters.parsePrice(priceStr) ?? item.price;
    const finalQty =
      AppFormatters.parseQuantity(quantityStr, unit) ??
      (item.quantity > 0 ? item.quantity : 1);
    const finalUnitPrice =
      finalQty > 0
        ? Number((finalPrice / finalQty).toFixed(2))
        : finalPrice;

    onSave({
      ...item,
      name: name.trim(),
      category,
      quantity: finalQty,
      quantityStr:
        finalQty === Math.round(finalQty)
          ? String(finalQty)
          : finalQty.toString().replace('.', ','),
      unit,
      price: finalPrice,
      priceStr: finalPrice > 0 ? AppFormatters.formatPriceInput(finalPrice) : '',
      unitPrice: finalUnitPrice,
    });
    onClose();
  };

  return (
    <ModalShell
      onClose={onClose}
      ariaLabel={
        isNew
          ? 'Adicionar item à nota'
          : `Editar item #${String(itemNumber).padStart(2, '0')}`
      }
      zIndexClass="z-[60]"
      panelClassName="max-h-[92vh] overflow-y-auto overscroll-contain p-6 pb-8"
    >
      <div
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)]">
              <CategoryIcon category={category} size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                {isNew
                  ? 'Adicionar item à nota'
                  : `Editar item #${String(itemNumber).padStart(2, '0')}`}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isNew
                  ? 'Informe os dados do produto'
                  : 'Ajuste nome, quantidade, unidade, categoria e preço'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar edição do item"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="animate-shake rounded-lg border border-[var(--negative)]/25 bg-[var(--negative-soft)] px-3 py-2 text-xs font-medium text-[var(--negative)]">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Nome do produto
            </label>
            <input
              type="text"
              autoFocus={isNew}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Ex: Leite Integral"
              className="h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-base sm:text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ProductCategoryId)
              }
              className="h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-base sm:text-sm font-medium text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Quantidade
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                className="font-mono-tabular h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-center text-base sm:text-sm font-medium text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Unidade
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-base sm:text-sm font-medium text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
              >
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Preço total na nota (R$)
            </label>
            <div className="flex h-11 items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 transition-colors focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-surface)] focus-within:ring-1 focus-within:ring-[var(--accent)]">
              <span className="select-none text-sm font-semibold text-[var(--text-muted)] mr-2">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="font-mono-tabular w-full bg-transparent text-right text-base sm:text-sm font-bold text-[var(--accent-fg)] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3.5">
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">
                Total deste item
              </p>
              {parsedQty > 0 && Math.abs(parsedQty - 1) > 0.001 && parsedPrice > 0 ? (
                <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
                  Preço unitário: {AppFormatters.formatCurrency(parsedPrice / parsedQty)} / {unit}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {parsedQty} {unit}
                </p>
              )}
            </div>
            <span className="font-mono-tabular text-base font-bold text-[var(--accent-fg)]">
              {AppFormatters.formatCurrency(parsedPrice)}
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="submit"
              className="btn-primary h-11 w-full text-sm"
            >
              <Check size={18} strokeWidth={2} />
              {isNew ? 'Adicionar à lista' : 'Salvar alterações'}
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={() => {
                  onRemove(item.id);
                  onClose();
                }}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border-hairline)] text-xs font-semibold text-[var(--negative)] transition-colors hover:bg-[var(--negative-soft)]"
              >
                <Trash2 size={15} strokeWidth={1.8} />
                Excluir item da lista
              </button>
            )}
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
