import { useState } from 'react';
import { Trash2, TrendingDown, X } from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  getEffectiveTotalAmount,
  type ProductCategoryId,
  type ShoppingItem,
} from '../../types/shopping';
import { useShoppingStore } from '../../store/useShoppingStore';
import { AppFormatters } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'dz', 'cx', 'pct'];

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
    item.price != null ? item.price.toFixed(2).replace('.', ',') : '',
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
      setError('Informe o nome do produto.');
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
      setError('Já existe outro item com este nome na lista.');
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl dark:bg-[#1E2229] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853]/12">
              <CategoryIcon category={category} size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827] dark:text-[#F3F4F6]">
                Configurar Item
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Preço, quantidade, categoria e mercado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF] dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
              Nome do produto
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3.5 py-2.5 text-sm font-medium text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                {isPriceTotal ? 'Preço Total (R$)' : 'Preço Unitário (R$)'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3.5 py-2.5 text-sm font-bold text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
              />
              {lastPrice != null && !priceStr && (
                <button
                  type="button"
                  onClick={() =>
                    setPriceStr(lastPrice.toFixed(2).replace('.', ','))
                  }
                  className="mt-1 text-[11px] font-semibold text-[#00C853] hover:underline"
                >
                  Usar último preço ({AppFormatters.formatCurrency(lastPrice)})
                </button>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                Quantidade e Unidade
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-16 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-2.5 text-center text-sm font-bold text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-2.5 text-sm font-medium text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#F3F4F6] px-3.5 py-2.5 dark:bg-[#181B20]">
            <div>
              <p className="text-xs font-semibold text-[#111827] dark:text-[#F3F4F6]">
                {isPriceTotal
                  ? 'Preço informado é o total do pacote'
                  : 'Multiplicar preço pela quantidade'}
              </p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                Total efetivo: {AppFormatters.formatCurrency(previewTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPriceTotal((v) => !v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                isPriceTotal
                  ? 'bg-[#00C853] text-white'
                  : 'bg-black/10 text-[#111827] dark:bg-white/10 dark:text-[#F3F4F6]'
              }`}
            >
              {isPriceTotal ? 'Total' : 'Unitário'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                Categoria (corredor)
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ProductCategoryId)
                }
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2.5 text-sm font-medium text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                Preferência de mercado (opcional)
              </label>
              <select
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2.5 text-sm font-medium text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
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
            <div className="rounded-2xl border border-[#00C853]/25 bg-[#00C853]/8 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#00C853]">
                <TrendingDown size={15} />
                <span>Histórico de Preços por Mercado</span>
              </div>
              <div className="space-y-1.5">
                {recommendations.map((rec, idx) => (
                  <div
                    key={rec.market.id}
                    onClick={() => setMarketId(rec.market.id)}
                    className="flex cursor-pointer items-center justify-between rounded-lg bg-white/80 px-2.5 py-1.5 text-xs dark:bg-[#121417]/60"
                  >
                    <span className="font-semibold text-[#111827] dark:text-[#F3F4F6]">
                      {idx === 0 ? '🏆 ' : ''}
                      {rec.market.name}
                    </span>
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                      Média {AppFormatters.formatCurrency(rec.averagePrice)} · Últ.{' '}
                      {AppFormatters.formatCurrency(rec.lastPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                removeItem(item.id);
                onClose();
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-600 transition active:scale-95 dark:text-red-400"
            >
              <Trash2 size={16} />
              Remover
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-[#00C853] py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-98"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
