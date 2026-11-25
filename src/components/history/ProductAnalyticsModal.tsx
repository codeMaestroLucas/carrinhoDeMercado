import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  GitCompareArrows,
  X,
} from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-6 pb-8 shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <CategoryIcon category={aggregate.category} size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                {aggregate.displayName}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                <span className="font-mono-tabular">
                  {aggregate.pricedOccurrences.length}
                </span>{' '}
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="surface-card p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Menor preço</p>
              <p className="font-mono-tabular mt-1 text-base font-semibold text-[var(--positive)]">
                {aggregate.minPriceOccurrence
                  ? AppFormatters.formatCurrency(
                      aggregate.minPriceOccurrence.price,
                    )
                  : '--'}
              </p>
              {aggregate.minPriceOccurrence && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                  {aggregate.minPriceOccurrence.marketName}
                </p>
              )}
            </div>

            <div className="surface-card p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Preço médio</p>
              <p className="font-mono-tabular mt-1 text-base font-semibold text-[var(--text-primary)]">
                {AppFormatters.formatCurrency(aggregate.averagePrice)}
              </p>
            </div>

            <div className="surface-card p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Último pago</p>
              <p className="font-mono-tabular mt-1 text-base font-semibold text-[var(--text-primary)]">
                {AppFormatters.formatCurrency(aggregate.lastPrice)}
              </p>
              {variation != null && Math.abs(variation) >= 0.5 && (
                <span
                  className={`font-mono-tabular mt-0.5 inline-flex items-center text-[11px] font-semibold ${
                    variation < 0
                      ? 'text-[var(--positive)]'
                      : 'text-[var(--negative)]'
                  }`}
                >
                  {variation < 0 ? (
                    <ArrowDownRight size={12} strokeWidth={2} />
                  ) : (
                    <ArrowUpRight size={12} strokeWidth={2} />
                  )}
                  {Math.abs(variation).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {aggregate.marketComparisonInsight && (
            <div className="surface-card flex items-center gap-2.5 p-3.5 text-xs font-medium text-[var(--text-primary)]">
              <Award
                size={16}
                strokeWidth={1.8}
                className="shrink-0 text-[var(--positive)]"
              />
              <span>{aggregate.marketComparisonInsight}</span>
            </div>
          )}

          {/* Price Trend Chart */}
          {aggregate.chronologicalPricedOccurrences.length >= 2 && (
            <div className="surface-card p-4">
              <h3 className="font-display mb-3 text-sm font-semibold text-[var(--text-primary)]">
                Evolução de preço
              </h3>
              <PriceTrendChart
                occurrences={aggregate.chronologicalPricedOccurrences}
              />
            </div>
          )}

          {/* Market Ranking */}
          {aggregate.marketRanking.length > 0 && (
            <div className="surface-card p-4">
              <h3 className="font-display mb-3 text-sm font-semibold text-[var(--text-primary)]">
                Ranking de mercados
              </h3>
              <div className="space-y-2">
                {aggregate.marketRanking.map((m, idx) => (
                  <div
                    key={m.marketName}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 py-2.5 text-xs"
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
                      {m.marketName}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Média{' '}
                      <strong className="font-mono-tabular font-semibold text-[var(--positive)]">
                        {AppFormatters.formatCurrency(m.averagePrice)}
                      </strong>{' '}
                      <span className="font-mono-tabular">
                        ({m.purchaseCount}x)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar products */}
          {similar.length > 0 && onCompareWith && (
            <div className="surface-card p-4">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <GitCompareArrows
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--accent-fg)]"
                />
                <span>Comparar com produto similar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {similar.map((s) => (
                  <button
                    key={s.product.normalizedKey}
                    type="button"
                    onClick={() => onCompareWith(s.product)}
                    className="btn-secondary h-8 px-3 text-xs"
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
          <div className="surface-card p-4">
            <h3 className="font-display mb-2.5 text-sm font-semibold text-[var(--text-primary)]">
              Registros no histórico
            </h3>
            <div className="divide-y divide-[var(--border-hairline)]">
              {aggregate.occurrences.map((occ, idx) => (
                <div
                  key={`${occ.date}_${idx}`}
                  className="flex items-center justify-between py-2.5 text-xs first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {occ.marketName}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      {AppFormatters.formatShortDate(occ.date)}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
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
