import { useMemo, useState } from 'react';
import { Award, GitCompareArrows, X } from 'lucide-react';
import {
  findSimilarProducts,
  type ProductHistoryAggregate,
} from '../../services/productHistoryService';
import { AppFormatters } from '../../utils/formatters';
import { DualPriceComparisonChart } from './DualPriceComparisonChart';

interface ProductComparisonModalProps {
  allAggregates: ProductHistoryAggregate[];
  initialItemA?: ProductHistoryAggregate | null;
  initialItemB?: ProductHistoryAggregate | null;
  onClose: () => void;
}

export function ProductComparisonModal({
  allAggregates,
  initialItemA,
  initialItemB,
  onClose,
}: ProductComparisonModalProps) {
  const [keyA, setKeyA] = useState(
    initialItemA?.normalizedKey ?? allAggregates[0]?.normalizedKey ?? '',
  );
  const [keyB, setKeyB] = useState(
    initialItemB?.normalizedKey ?? allAggregates[1]?.normalizedKey ?? '',
  );

  const itemA = useMemo(
    () => allAggregates.find((a) => a.normalizedKey === keyA) ?? null,
    [allAggregates, keyA],
  );
  const itemB = useMemo(
    () => allAggregates.find((a) => a.normalizedKey === keyB) ?? null,
    [allAggregates, keyB],
  );

  const similarSuggestions = useMemo(() => {
    if (!itemA) return [];
    return findSimilarProducts(itemA, allAggregates, { limit: 5 });
  }, [itemA, allAggregates]);

  const verdict = useMemo(() => {
    if (!itemA || !itemB || itemA.averagePrice <= 0 || itemB.averagePrice <= 0)
      return null;
    if (Math.abs(itemA.averagePrice - itemB.averagePrice) < 0.05) {
      return 'Ambos possuem praticamente o mesmo preço médio histórico.';
    }
    const cheaper = itemA.averagePrice < itemB.averagePrice ? itemA : itemB;
    const expensive = cheaper === itemA ? itemB : itemA;
    const pct =
      ((expensive.averagePrice - cheaper.averagePrice) /
        expensive.averagePrice) *
      100;
    return `${cheaper.displayName} costuma ser ${pct.toFixed(0)}% mais barato na média do que ${expensive.displayName}.`;
  }, [itemA, itemB]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#F8F9FA] p-5 pb-8 shadow-2xl dark:bg-[#121417] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853]/12 text-[#00C853]">
              <GitCompareArrows size={19} />
            </div>
            <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F3F4F6]">
              Comparar Produtos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#00C853]">
                Produto A
              </label>
              <select
                value={keyA}
                onChange={(e) => setKeyA(e.target.value)}
                className="w-full rounded-xl border border-[#00C853]/40 bg-white px-3 py-2 text-xs font-semibold text-[#111827] outline-none dark:bg-[#1E2229] dark:text-[#F3F4F6]"
              >
                {allAggregates.map((agg) => (
                  <option key={agg.normalizedKey} value={agg.normalizedKey}>
                    {agg.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-blue-500">
                Produto B
              </label>
              <select
                value={keyB}
                onChange={(e) => setKeyB(e.target.value)}
                className="w-full rounded-xl border border-blue-500/40 bg-white px-3 py-2 text-xs font-semibold text-[#111827] outline-none dark:bg-[#1E2229] dark:text-[#F3F4F6]"
              >
                {allAggregates.map((agg) => (
                  <option key={agg.normalizedKey} value={agg.normalizedKey}>
                    {agg.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {similarSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                Similares a {itemA?.displayName}:
              </span>
              {similarSuggestions.map((s) => (
                <button
                  key={s.product.normalizedKey}
                  type="button"
                  onClick={() => setKeyB(s.product.normalizedKey)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    keyB === s.product.normalizedKey
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-[#111827] dark:bg-[#1E2229] dark:text-[#F3F4F6]'
                  }`}
                >
                  {s.product.displayName}
                </button>
              ))}
            </div>
          )}

          {verdict && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-[#00C853]/30 bg-[#00C853]/10 p-3 text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
              <Award size={18} className="shrink-0 text-[#00C853]" />
              <span>{verdict}</span>
            </div>
          )}

          {itemA && itemB && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { item: itemA, accent: 'border-[#00C853]/40 text-[#00C853]' },
                  { item: itemB, accent: 'border-blue-500/40 text-blue-500' },
                ].map(({ item, accent }) => (
                  <div
                    key={item.normalizedKey}
                    className={`rounded-2xl border bg-white p-3.5 dark:bg-[#1E2229] ${accent.split(' ')[0]}`}
                  >
                    <p className="truncate text-xs font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                      {item.displayName}
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                          Média:
                        </span>
                        <strong className={accent.split(' ')[1]}>
                          {AppFormatters.formatCurrency(item.averagePrice)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                          Menor:
                        </span>
                        <strong className="text-[#111827] dark:text-[#F3F4F6]">
                          {item.minPriceOccurrence
                            ? AppFormatters.formatCurrency(
                                item.minPriceOccurrence.price,
                              )
                            : '--'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                          Último:
                        </span>
                        <strong className="text-[#111827] dark:text-[#F3F4F6]">
                          {AppFormatters.formatCurrency(item.lastPrice)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
                <h3 className="mb-2 text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                  Evolução Comparativa
                </h3>
                <DualPriceComparisonChart itemA={itemA} itemB={itemB} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
