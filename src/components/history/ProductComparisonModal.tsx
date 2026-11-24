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
      return 'Ambos possuem praticamente o mesmo preço médio histórico';
    }
    const cheaper = itemA.averagePrice < itemB.averagePrice ? itemA : itemB;
    const expensive = cheaper === itemA ? itemB : itemA;
    const pct =
      ((expensive.averagePrice - cheaper.averagePrice) /
        expensive.averagePrice) *
      100;
    return `${cheaper.displayName} costuma ser ${pct.toFixed(0)}% mais barato na média do que ${expensive.displayName}`;
  }, [itemA, itemB]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-5 pb-8 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GitCompareArrows size={18} strokeWidth={1.5} className="text-[var(--text-muted)]" />
            <h2 className="text-base font-medium text-[var(--text-primary)]">
              Comparar produtos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar comparação"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--accent-fg)]">
                Produto A
              </label>
              <select
                value={keyA}
                onChange={(e) => setKeyA(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {allAggregates.map((agg) => (
                  <option key={agg.normalizedKey} value={agg.normalizedKey}>
                    {agg.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#B45309] dark:text-[#FBBF24]">
                Produto B
              </label>
              <select
                value={keyB}
                onChange={(e) => setKeyB(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] outline-none focus:border-[#B45309]"
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">
                Similares a {itemA?.displayName}:
              </span>
              {similarSuggestions.map((s) => (
                <button
                  key={s.product.normalizedKey}
                  type="button"
                  onClick={() => setKeyB(s.product.normalizedKey)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-ui ${
                    keyB === s.product.normalizedKey
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-app)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  {s.product.displayName}
                </button>
              ))}
            </div>
          )}

          {verdict && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 text-xs font-medium text-[var(--text-primary)]">
              <Award size={16} strokeWidth={1.5} className="shrink-0 text-[var(--accent-fg)]" />
              <span>{verdict}</span>
            </div>
          )}

          {itemA && itemB && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { item: itemA, colorClass: 'text-[var(--accent-fg)]' },
                  { item: itemB, colorClass: 'text-[#B45309] dark:text-[#FBBF24]' },
                ].map(({ item, colorClass }) => (
                  <div
                    key={item.normalizedKey}
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5"
                  >
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                      {item.displayName}
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Média</span>
                        <strong className={`font-mono-tabular font-medium ${colorClass}`}>
                          {AppFormatters.formatCurrency(item.averagePrice)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Menor</span>
                        <strong className="font-mono-tabular font-medium text-[var(--text-primary)]">
                          {item.minPriceOccurrence
                            ? AppFormatters.formatCurrency(
                                item.minPriceOccurrence.price,
                              )
                            : '--'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Último</span>
                        <strong className="font-mono-tabular font-medium text-[var(--text-primary)]">
                          {AppFormatters.formatCurrency(item.lastPrice)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
                <h3 className="mb-3 text-xs font-medium text-[var(--text-primary)]">
                  Evolução comparativa
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
