import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  GitCompareArrows,
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  PRODUCT_CATEGORY_MAP,
  getPurchaseRecordTotal,
} from '../types/shopping';
import { useShoppingStore } from '../store/useShoppingStore';
import {
  buildAllProductAggregates,
  calculateCategorySpending,
  calculatePriceIndex,
  matchesAggregateSearchQuery,
  type ProductHistoryAggregate,
} from '../services/productHistoryService';
import { AppFormatters } from '../utils/formatters';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { ThemeToggleButton } from '../components/layout/ThemeToggleButton';
import { ProductAnalyticsModal } from '../components/history/ProductAnalyticsModal';
import { ProductComparisonModal } from '../components/history/ProductComparisonModal';

export function HomePage() {
  const history = useShoppingStore((s) => s.history);
  const markets = useShoppingStore((s) => s.markets);

  const [searchQuery, setSearchQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [priceIndexDays, setPriceIndexDays] = useState(60);
  const [variationTab, setVariationTab] = useState<'up' | 'down'>('down');

  const [selectedAggregate, setSelectedAggregate] =
    useState<ProductHistoryAggregate | null>(null);
  const [compareState, setCompareState] = useState<{
    open: boolean;
    itemA?: ProductHistoryAggregate | null;
    itemB?: ProductHistoryAggregate | null;
  }>({ open: false });

  const allAggregates = useMemo(
    () =>
      buildAllProductAggregates(history, {
        marketFilter: marketFilter || null,
      }),
    [history, marketFilter],
  );

  const filteredAggregates = useMemo(() => {
    if (!searchQuery.trim()) return allAggregates;
    return allAggregates.filter((a) =>
      matchesAggregateSearchQuery(a, searchQuery),
    );
  }, [allAggregates, searchQuery]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    let currentMonthTotal = 0;
    let currentMonthCount = 0;
    let previousMonthTotal = 0;

    for (const rec of history) {
      const d = new Date(rec.date);
      const total = getPurchaseRecordTotal(rec);
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
        currentMonthTotal += total;
        currentMonthCount++;
      } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
        previousMonthTotal += total;
      }
    }

    const diffPercent =
      previousMonthTotal > 0
        ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
        : null;

    return {
      currentMonthTotal,
      currentMonthCount,
      previousMonthTotal,
      diffPercent,
    };
  }, [history]);

  const priceIndex = useMemo(
    () => calculatePriceIndex(history, priceIndexDays),
    [history, priceIndexDays],
  );

  const categorySpending = useMemo(
    () => calculateCategorySpending(history),
    [history],
  );

  const availableMarketNames = useMemo(() => {
    const set = new Set<string>();
    markets.forEach((m) => set.add(m.name));
    history.forEach((r) => set.add(r.marketName));
    return Array.from(set).sort();
  }, [markets, history]);

  const highlightedVariations =
    variationTab === 'up' ? priceIndex.topIncreases : priceIndex.topDecreases;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 pt-safe dark:bg-[#121417]">
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white/90 px-4 py-3.5 backdrop-blur-md dark:border-[#2E3440] dark:bg-[#1E2229]/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-[#111827] dark:text-[#F3F4F6]">
              Resumo &amp; Economia
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Acompanhe gastos, inflação e melhores preços
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allAggregates.length >= 2 && (
              <button
                type="button"
                onClick={() =>
                  setCompareState({
                    open: true,
                    itemA: allAggregates[0],
                    itemB: allAggregates[1],
                  })
                }
                className="flex h-9 items-center gap-1.5 rounded-full bg-[#00C853]/12 px-3 text-xs font-bold text-[#00C853]"
              >
                <GitCompareArrows size={15} />
                <span>Comparar</span>
              </button>
            )}
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {/* Monthly Spending Summary */}
        <section className="rounded-3xl bg-gradient-to-br from-[#00C853] to-[#059669] p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
              <Calendar size={12} />
              Gastos do Mês Atual
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/90">
              <ShoppingBag size={14} />
              {monthlyStats.currentMonthCount}{' '}
              {monthlyStats.currentMonthCount === 1 ? 'compra' : 'compras'}
            </span>
          </div>

          <p className="mt-3 text-3xl font-extrabold tracking-tight">
            {AppFormatters.formatCurrency(monthlyStats.currentMonthTotal)}
          </p>

          {monthlyStats.diffPercent != null ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-white/90">
              {monthlyStats.diffPercent <= 0 ? (
                <ArrowDownRight size={15} />
              ) : (
                <ArrowUpRight size={15} />
              )}
              {Math.abs(monthlyStats.diffPercent).toFixed(1)}%{' '}
              {monthlyStats.diffPercent <= 0 ? 'a menos' : 'a mais'} que no mês
              anterior ({AppFormatters.formatCurrency(monthlyStats.previousMonthTotal)})
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-white/80">
              Finalize compras ou importe cupons fiscais para acompanhar seu histórico mensal.
            </p>
          )}
        </section>

        {history.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-[#E5E7EB] bg-white p-8 text-center dark:border-[#2E3440] dark:bg-[#1E2229]">
            <BarChart3 size={34} className="mx-auto text-[#00C853]" />
            <h2 className="mt-3 text-base font-bold text-[#111827] dark:text-[#F3F4F6]">
              Nenhum histórico registrado ainda
            </h2>
            <p className="mt-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Finalize uma lista de compras ou importe uma NFC-e na aba{' '}
              <strong>Histórico</strong> para liberar gráficos de variação de preços e recomendações de mercado.
            </p>
          </section>
        ) : (
          <>
            {/* Personal Price Index / Inflation */}
            <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
                    Índice de Preços Pessoal
                  </h2>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                    {priceIndex.totalComparedItems} itens comparados ({priceIndex.periodLabel})
                  </p>
                </div>
                <select
                  value={priceIndexDays}
                  onChange={(e) => setPriceIndexDays(Number(e.target.value))}
                  className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-2.5 py-1 text-xs font-bold text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                >
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={90}>90 dias</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#F8F9FA] p-3 dark:bg-[#181B20]">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      priceIndex.overallVariationPercent <= 0
                        ? 'bg-[#00C853]/12 text-[#00C853]'
                        : 'bg-red-500/12 text-red-500'
                    }`}
                  >
                    {priceIndex.overallVariationPercent <= 0 ? (
                      <TrendingDown size={20} />
                    ) : (
                      <TrendingUp size={20} />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                      {priceIndex.overallVariationPercent > 0 ? '+' : ''}
                      {priceIndex.overallVariationPercent.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                      Variação média da sua cesta
                    </p>
                  </div>
                </div>
                <div className="text-right text-[11px] font-semibold">
                  <p className="text-[#00C853]">
                    {priceIndex.decreasedCount} caíram
                  </p>
                  <p className="text-red-500">
                    {priceIndex.increasedCount} subiram
                  </p>
                </div>
              </div>

              {(priceIndex.topDecreases.length > 0 ||
                priceIndex.topIncreases.length > 0) && (
                <div className="mt-3">
                  <div className="mb-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setVariationTab('down')}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        variationTab === 'down'
                          ? 'bg-[#00C853] text-white'
                          : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-[#181B20] dark:text-[#9CA3AF]'
                      }`}
                    >
                      Maiores Quedas ({priceIndex.topDecreases.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariationTab('up')}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        variationTab === 'up'
                          ? 'bg-red-500 text-white'
                          : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-[#181B20] dark:text-[#9CA3AF]'
                      }`}
                    >
                      Maiores Altas ({priceIndex.topIncreases.length})
                    </button>
                  </div>

                  {highlightedVariations.length > 0 && (
                    <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                      {highlightedVariations.map((v) => (
                        <div
                          key={`${v.productName}_${v.marketName}`}
                          className="w-44 shrink-0 rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-3 dark:border-[#2E3440] dark:bg-[#181B20]"
                        >
                          <p className="truncate text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                            {v.productName}
                          </p>
                          <p className="truncate text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                            {v.marketName}
                          </p>
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xs font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                              {AppFormatters.formatCurrency(v.currentPrice)}
                            </span>
                            <span
                              className={`text-[11px] font-extrabold ${
                                v.variationPercent < 0
                                  ? 'text-[#00C853]'
                                  : 'text-red-500'
                              }`}
                            >
                              {v.variationPercent > 0 ? '+' : ''}
                              {v.variationPercent.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Category Spending */}
            {categorySpending.length > 0 && (
              <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]">
                <h2 className="mb-3 text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
                  Gastos por Categoria
                </h2>
                <div className="space-y-2.5">
                  {categorySpending.slice(0, 6).map((cs) => {
                    const info = PRODUCT_CATEGORY_MAP[cs.category];
                    return (
                      <div key={cs.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-semibold text-[#111827] dark:text-[#F3F4F6]">
                            <CategoryIcon category={cs.category} size={14} />
                            {info.label}
                          </span>
                          <span className="font-bold text-[#111827] dark:text-[#F3F4F6]">
                            {AppFormatters.formatCurrency(cs.totalSpent)}{' '}
                            <span className="font-normal text-[#6B7280] dark:text-[#9CA3AF]">
                              ({cs.percentage.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6] dark:bg-[#181B20]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, cs.percentage)}%`,
                              backgroundColor: info.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Product Price Explorer */}
            <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]">
              <h2 className="mb-3 text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
                Análise por Produto ({filteredAggregates.length})
              </h2>

              <div className="mb-3 flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 dark:border-[#2E3440] dark:bg-[#181B20]">
                  <Search size={15} className="text-[#6B7280]" />
                  <input
                    type="text"
                    placeholder="Buscar produto comprado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-[#111827] outline-none dark:text-[#F3F4F6]"
                  />
                </div>
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  className="max-w-[130px] rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-2 text-xs font-semibold text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                >
                  <option value="">Todos mercados</option>
                  {availableMarketNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {filteredAggregates.slice(0, 30).map((agg) => (
                  <button
                    key={agg.normalizedKey}
                    type="button"
                    onClick={() => setSelectedAggregate(agg)}
                    className="flex w-full items-center justify-between rounded-2xl bg-[#F8F9FA] px-3.5 py-2.5 text-left transition hover:bg-[#F3F4F6] dark:bg-[#181B20] dark:hover:bg-[#181B20]/80"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CategoryIcon category={agg.category} size={17} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                          {agg.displayName}
                        </p>
                        <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                          Menor:{' '}
                          {agg.minPriceOccurrence
                            ? `${AppFormatters.formatCurrency(agg.minPriceOccurrence.price)} (${agg.minPriceOccurrence.marketName})`
                            : '--'}
                        </p>
                      </div>
                    </div>
                    <div className="ml-2 shrink-0 text-right">
                      <p className="text-xs font-extrabold text-[#00C853]">
                        {AppFormatters.formatCurrency(agg.lastPrice)}
                      </p>
                      <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                        Média {AppFormatters.formatCurrency(agg.averagePrice)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {selectedAggregate && (
        <ProductAnalyticsModal
          aggregate={selectedAggregate}
          allAggregates={allAggregates}
          onCompareWith={(other) => {
            const first = selectedAggregate;
            setSelectedAggregate(null);
            setCompareState({ open: true, itemA: first, itemB: other });
          }}
          onClose={() => setSelectedAggregate(null)}
        />
      )}

      {compareState.open && (
        <ProductComparisonModal
          allAggregates={allAggregates}
          initialItemA={compareState.itemA}
          initialItemB={compareState.itemB}
          onClose={() => setCompareState({ open: false })}
        />
      )}
    </div>
  );
}
