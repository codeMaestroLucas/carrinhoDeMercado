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
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#F8F9FA] p-5 pb-8 shadow-2xl dark:bg-[#121417] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00C853]/12">
              <CategoryIcon category={aggregate.category} size={22} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                {aggregate.displayName}
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {aggregate.pricedOccurrences.length} registro(s) com preço
              </p>
            </div>
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
          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <p className="text-[10px] font-semibold uppercase text-[#6B7280] dark:text-[#9CA3AF]">
                Menor Preço
              </p>
              <p className="mt-1 text-sm font-extrabold text-[#00C853]">
                {aggregate.minPriceOccurrence
                  ? AppFormatters.formatCurrency(aggregate.minPriceOccurrence.price)
                  : '--'}
              </p>
              {aggregate.minPriceOccurrence && (
                <p className="truncate text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                  {aggregate.minPriceOccurrence.marketName}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <p className="text-[10px] font-semibold uppercase text-[#6B7280] dark:text-[#9CA3AF]">
                Preço Médio
              </p>
              <p className="mt-1 text-sm font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                {AppFormatters.formatCurrency(aggregate.averagePrice)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <p className="text-[10px] font-semibold uppercase text-[#6B7280] dark:text-[#9CA3AF]">
                Último Pago
              </p>
              <p className="mt-1 text-sm font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                {AppFormatters.formatCurrency(aggregate.lastPrice)}
              </p>
              {variation != null && Math.abs(variation) >= 0.5 && (
                <span
                  className={`inline-flex items-center text-[10px] font-bold ${
                    variation < 0 ? 'text-[#00C853]' : 'text-red-500'
                  }`}
                >
                  {variation < 0 ? (
                    <ArrowDownRight size={11} />
                  ) : (
                    <ArrowUpRight size={11} />
                  )}
                  {Math.abs(variation).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {aggregate.marketComparisonInsight && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-[#00C853]/30 bg-[#00C853]/10 p-3 text-xs font-semibold text-[#111827] dark:text-[#F3F4F6]">
              <Award size={17} className="shrink-0 text-[#00C853]" />
              <span>{aggregate.marketComparisonInsight}</span>
            </div>
          )}

          {/* Price Trend Chart */}
          {aggregate.chronologicalPricedOccurrences.length >= 2 && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <h3 className="mb-2 text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                Evolução de Preço
              </h3>
              <PriceTrendChart
                occurrences={aggregate.chronologicalPricedOccurrences}
              />
            </div>
          )}

          {/* Market Ranking */}
          {aggregate.marketRanking.length > 0 && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <h3 className="mb-2.5 text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                Ranking de Mercados
              </h3>
              <div className="space-y-2">
                {aggregate.marketRanking.map((m, idx) => (
                  <div
                    key={m.marketName}
                    className="flex items-center justify-between rounded-xl bg-[#F8F9FA] px-3 py-2 text-xs dark:bg-[#181B20]"
                  >
                    <span className="font-bold text-[#111827] dark:text-[#F3F4F6]">
                      {idx === 0 ? '🏆 ' : `${idx + 1}. `}
                      {m.marketName}
                    </span>
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                      Média{' '}
                      <strong className="text-[#00C853]">
                        {AppFormatters.formatCurrency(m.averagePrice)}
                      </strong>{' '}
                      ({m.purchaseCount}x)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar products to compare */}
          {similar.length > 0 && onCompareWith && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                <GitCompareArrows size={15} className="text-[#00C853]" />
                <span>Comparar com produto similar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {similar.map((s) => (
                  <button
                    key={s.product.normalizedKey}
                    type="button"
                    onClick={() => onCompareWith(s.product)}
                    className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 text-xs font-semibold text-[#111827] hover:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                  >
                    {s.product.displayName} (
                    {AppFormatters.formatCurrency(s.product.lastPrice)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All occurrences */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
            <h3 className="mb-2 text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
              Registros no Histórico
            </h3>
            <div className="space-y-1.5">
              {aggregate.occurrences.map((occ, idx) => (
                <div
                  key={`${occ.date}_${idx}`}
                  className="flex items-center justify-between rounded-xl bg-[#F8F9FA] px-3 py-2 text-xs dark:bg-[#181B20]"
                >
                  <div>
                    <p className="font-semibold text-[#111827] dark:text-[#F3F4F6]">
                      {occ.marketName}
                    </p>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                      {AppFormatters.formatShortDate(occ.date)}
                    </p>
                  </div>
                  <span className="font-bold text-[#00C853]">
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
