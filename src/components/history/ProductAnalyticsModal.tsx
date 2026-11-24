import { ArrowDownRight, ArrowUpRight, Award, GitCompareArrows, X } from 'lucide-react';
import {
  findSimilarProducts,
  type ProductHistoryAggregate,
} from '../../services/productHistoryService';
import { AppFormatters } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { PriceTrendChart } from './PriceTrendChart';

interface ProductAnalyticsModalProps {
  aggregate: ProductHistoryAggregate;
  allAggregates: ProductHistoryAggregate[];
  onCompareWith?: (other: ProductHistoryAggregate) => void;
  onClose: () => void;
}

export function ProductAnalyticsModal({
  aggregate,
  allAggregates,
  onCompareWith,
  onClose,
}: ProductAnalyticsModalProps) {
  const similar = findSimilarProducts(aggregate, allAggregates, { limit: 4 });
  const variation = aggregate.variationPercentFromLastTime;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-5 pb-8 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <CategoryIcon category={aggregate.category} size={18} />
            </div>
            <div>
              <h2 className="text-base font-medium text-[var(--text-primary)]">
                {aggregate.displayName}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                <span className="font-mono-tabular">{aggregate.pricedOccurrences.length}</span>{' '}
                {aggregate.pricedOccurrences.length === 1
                  ? 'registro com preço'
                  : 'registros com preço'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar análise"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
              <p className="text-xs text-[var(--text-muted)]">Menor preço</p>
              <p className="font-mono-tabular mt-1 text-sm font-medium text-[var(--accent-fg)]">
                {aggregate.minPriceOccurrence
                  ? AppFormatters.formatCurrency(aggregate.minPriceOccurrence.price)
                  : '--'}
              </p>
              {aggregate.minPriceOccurrence && (
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  {aggregate.minPriceOccurrence.marketName}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
              <p className="text-xs text-[var(--text-muted)]">Preço médio</p>
              <p className="font-mono-tabular mt-1 text-sm font-medium text-[var(--text-primary)]">
                {AppFormatters.formatCurrency(aggregate.averagePrice)}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
              <p className="text-xs text-[var(--text-muted)]">Último pago</p>
              <p className="font-mono-tabular mt-1 text-sm font-medium text-[var(--text-primary)]">
                {AppFormatters.formatCurrency(aggregate.lastPrice)}
              </p>
              {variation != null && Math.abs(variation) >= 0.5 && (
                <span
                  className={`font-mono-tabular inline-flex items-center text-[11px] font-medium ${
                    variation < 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
                  }`}
                >
                  {variation < 0 ? (
                    <ArrowDownRight size={12} strokeWidth={1.5} />
                  ) : (
                    <ArrowUpRight size={12} strokeWidth={1.5} />
                  )}
                  {Math.abs(variation).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {aggregate.marketComparisonInsight && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 text-xs font-medium text-[var(--text-primary)]">
              <Award size={16} strokeWidth={1.5} className="shrink-0 text-[var(--accent-fg)]" />
              <span>{aggregate.marketComparisonInsight}</span>
            </div>
          )}

          {/* Price Trend Chart */}
          {aggregate.chronologicalPricedOccurrences.length >= 2 && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-xs font-medium text-[var(--text-primary)]">
                Evolução de preço
              </h3>
              <PriceTrendChart
                occurrences={aggregate.chronologicalPricedOccurrences}
              />
            </div>
          )}

          {/* Market Ranking */}
          {aggregate.marketRanking.length > 0 && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-xs font-medium text-[var(--text-primary)]">
                Ranking de mercados
              </h3>
              <div className="space-y-2">
                {aggregate.marketRanking.map((m, idx) => (
                  <div
                    key={m.marketName}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                      <span
                        className={`font-mono-tabular ${
                          idx === 0 ? 'text-[var(--accent-fg)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {idx + 1}.
                      </span>
                      {m.marketName}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Média{' '}
                      <strong className="font-mono-tabular font-medium text-[var(--accent-fg)]">
                        {AppFormatters.formatCurrency(m.averagePrice)}
                      </strong>{' '}
                      <span className="font-mono-tabular">({m.purchaseCount}x)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar products */}
          {similar.length > 0 && onCompareWith && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                <GitCompareArrows size={15} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                <span>Comparar com produto similar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {similar.map((s) => (
                  <button
                    key={s.product.normalizedKey}
                    type="button"
                    onClick={() => onCompareWith(s.product)}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 ease-ui hover:border-[var(--accent)] hover:bg-[var(--bg-subtle)]"
                  >
                    {s.product.displayName}{' '}
                    <span className="font-mono-tabular text-[var(--text-muted)]">
                      ({AppFormatters.formatCurrency(s.product.lastPrice)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All occurrences */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <h3 className="mb-2 text-xs font-medium text-[var(--text-primary)]">
              Registros no histórico
            </h3>
            <div className="space-y-2">
              {aggregate.occurrences.map((occ, idx) => (
                <div
                  key={`${occ.date}_${idx}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {occ.marketName}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      {AppFormatters.formatShortDate(occ.date)}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-medium text-[var(--accent-fg)]">
                    {AppFormatters.formatCurrency(occ.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
