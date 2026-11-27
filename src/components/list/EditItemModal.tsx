import { useState } from 'react';
import { Trash2, TrendingDown, X } from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  getEffectiveTotalAmount,
  type ProductCategoryId,
  type ShoppingItem,
} from '../../types/shopping';
import { useShoppingStore } from '../../store/useShoppingStore';
import { AppFormatters, COMMON_UNITS } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { ModalShell } from '../common/ModalShell';

interface EditItemModalProps {
  item: ShoppingItem;
  onClose: () => void;
}

export function EditItemModal({ item, onClose }: EditItemModalProps) {
  const markets = useShoppingStore((s) => s.markets);
  const selectedMarketId = useShoppingStore((s) => s.selectedMarketId);
  const updateItem = useShoppingStore((s) => s.updateItem);
  const removeItem = useShoppingStore((s) => s.removeItem);
  const marketRecommendationsForProduct = useShoppingStore(
    (s) => s.marketRecommendationsForProduct,
  );
  const findLastHistoricalPrice = useShoppingStore(
    (s) => s.findLastHistoricalPrice,
  );

  const [name, setName] = useState(item.name);
  const [priceStr, setPriceStr] = useState(
    item.price != null ? AppFormatters.formatPriceInput(item.price) : '',
  );
  const [quantity, setQuantity] = useState(item.quantity);
  const [unit, setUnit] = useState(item.unit || 'un');
  const [isPriceTotal, setIsPriceTotal] = useState(item.isPriceTotal);
  const [category, setCategory] = useState<ProductCategoryId>(item.category);
  const [marketId, setMarketId] = useState<string>(item.marketId ?? '');
  const [error, setError] = useState<string | null>(null);

  const recommendations = marketRecommendationsForProduct(name || item.name);
  const lastPrice = findLastHistoricalPrice(
    name || item.name,
    marketId || selectedMarketId,
  );

  const parsedPrice = AppFormatters.parsePrice(priceStr);
  const previewTotal = getEffectiveTotalAmount({
    price: parsedPrice,
    quantity,
    isPriceTotal,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do produto');
      return;
    }
    const ok = updateItem(item.id, {
      name: name.trim(),
      category,
      marketId: marketId || null,
      price: parsedPrice,
      clearPrice: priceStr.trim() === '',
      quantity,
      unit,
      isPriceTotal,
    });
    if (!ok) {
      setError('Já existe outro item com este nome na lista');
      return;
    }
    onClose();
  };

  return (
    <ModalShell
      onClose={onClose}
      ariaLabel={`Editar ${item.name}`}
      panelClassName="max-h-[92vh] overflow-y-auto p-6 pb-8"
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)]">
              <CategoryIcon category={category} size={19} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                Configurar item
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Preço, quantidade, corredor e mercado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar edição"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="animate-shake rounded-2xl border border-[var(--negative)]/25 bg-[var(--negative-soft)] px-4 py-2.5 text-xs font-medium text-[var(--negative)]">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              Nome do produto
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="h-11 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                {isPriceTotal ? 'Preço total (R$)' : 'Preço unitário (R$)'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="font-mono-tabular h-11 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
              />
              {lastPrice != null && !priceStr && (
                <button
                  type="button"
                  onClick={() =>
                    setPriceStr(AppFormatters.formatPriceInput(lastPrice))
                  }
                  className="mt-1.5 text-xs font-semibold text-[var(--positive)] hover:underline"
                >
                  Usar último ({AppFormatters.formatCurrency(lastPrice)})
                </button>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                Quantidade e unidade
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="font-mono-tabular h-11 w-16 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-2 text-center text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="h-11 flex-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {isPriceTotal
                  ? 'Preço informado é o total do pacote'
                  : 'Multiplicar preço pela quantidade'}
              </p>
              <p className="font-mono-tabular mt-0.5 text-xs text-[var(--text-muted)]">
                Total efetivo:{' '}
                <strong className="text-[var(--text-primary)]">
                  {AppFormatters.formatCurrency(previewTotal)}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPriceTotal((v) => !v)}
              className={`h-9 rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 ease-ui ${
                isPriceTotal
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              {isPriceTotal ? 'Total' : 'Unitário'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                Categoria (corredor)
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ProductCategoryId)
                }
                className="h-11 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                Preferência de mercado
              </label>
              <select
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
              >
                <option value="">Qualquer mercado</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {recommendations.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-4">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--positive)]">
                <TrendingDown size={15} strokeWidth={1.9} />
                <span>Histórico de preços por mercado</span>
              </div>
              <div className="space-y-1.5">
                {recommendations.map((rec, idx) => (
                  <div
                    key={rec.market.id}
                    onClick={() => setMarketId(rec.market.id)}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs transition-colors duration-150 ease-ui hover:border-[var(--border-strong)]"
                  >
                    <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                      <span
                        className={`font-mono-tabular ${
                          idx === 0
                            ? 'text-[var(--positive)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {idx + 1}.
                      </span>
                      {rec.market.name}
                    </span>
                    <span className="font-mono-tabular text-[var(--text-muted)]">
                      Média {AppFormatters.formatCurrency(rec.averagePrice)} · Últ.{' '}
                      {AppFormatters.formatCurrency(rec.lastPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                removeItem(item.id);
                onClose();
              }}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-5 text-sm font-semibold text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
            >
              <Trash2 size={16} strokeWidth={1.8} />
              Remover
            </button>
            <button type="submit" className="btn-primary h-11 flex-1 text-sm">
              Salvar alterações
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
