import { useMemo, useState } from 'react';
import { Award, GitCompareArrows, X } from 'lucide-react';
import {
  findSimilarProducts,
  type ProductHistoryAggregate,
} from '../../services/productHistoryService';
import { AppFormatters } from '../../utils/formatters';
import { ModalShell } from '../common/ModalShell';
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
    <ModalShell
      onClose={onClose}
      ariaLabel="Comparar produtos"
      maxWidthClass="max-w-xl"
      panelClassName="max-h-[92vh] overflow-y-auto bg-[var(--bg-app)] p-6 pb-8"
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--accent-fg)]">
              <GitCompareArrows size={19} strokeWidth={1.8} />
            </div>
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Comparar produtos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar comparação"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--accent-fg)]">
                Produto A
              </label>
              <select
                value={keyA}
                onChange={(e) => setKeyA(e.target.value)}
                className="h-10 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {allAggregates.map((agg) => (
                  <option key={agg.normalizedKey} value={agg.normalizedKey}>
                    {agg.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--blue)]">
                Produto B
              </label>
              <select
                value={keyB}
                onChange={(e) => setKeyB(e.target.value)}
                className="h-10 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--blue)]"
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
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150 ease-ui ${
                    keyB === s.product.normalizedKey
                      ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  {s.product.displayName}
                </button>
              ))}
            </div>
          )}

          {verdict && (
            <div className="surface-card flex items-center gap-2.5 p-3.5 text-xs font-medium text-[var(--text-primary)]">
              <Award
                size={16}
                strokeWidth={1.8}
                className="shrink-0 text-[var(--positive)]"
              />
              <span>{verdict}</span>
            </div>
          )}

          {itemA && itemB && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { item: itemA, colorClass: 'text-[var(--accent-fg)]' },
                  { item: itemB, colorClass: 'text-[var(--blue)]' },
                ].map(({ item, colorClass }) => (
                  <div key={item.normalizedKey} className="surface-card p-4">
                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {item.displayName}
                    </p>
                    <div className="mt-2.5 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Média</span>
                        <strong
                          className={`font-mono-tabular font-semibold ${colorClass}`}
                        >
                          {AppFormatters.formatCurrency(item.averagePrice)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Menor</span>
                        <strong className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                          {item.minPriceOccurrence
                            ? AppFormatters.formatCurrency(
                                item.minPriceOccurrence.price,
                              )
                            : '--'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Último</span>
                        <strong className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                          {AppFormatters.formatCurrency(item.lastPrice)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="surface-card p-4">
                <h3 className="font-display mb-3 text-sm font-semibold text-[var(--text-primary)]">
                  Evolução comparativa
                </h3>
                <DualPriceComparisonChart itemA={itemA} itemB={itemB} />
              </div>
            </>
          )}
        </div>
    </ModalShell>
  );
}
