import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  GitCompareArrows,
  Search,
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
import {
  buildHomeSnapshot,
  loadHomeSnapshotSync,
  saveHomeSnapshot,
} from '../services/homeSnapshotService';
import { AppFormatters } from '../utils/formatters';
import { CategoryDot, CategoryIcon } from '../components/common/CategoryIcon';
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

  const cachedSnapshot = useMemo(() => loadHomeSnapshotSync(), []);

  const monthlyStats = useMemo(() => {
    if (history.length === 0 && cachedSnapshot?.monthlyStats) {
      return cachedSnapshot.monthlyStats;
    }
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
  }, [history, cachedSnapshot]);

  const priceIndex = useMemo(() => {
    if (history.length === 0 && cachedSnapshot?.priceIndex) {
      return cachedSnapshot.priceIndex;
    }
    return calculatePriceIndex(history, priceIndexDays);
  }, [history, priceIndexDays, cachedSnapshot]);

  const categorySpending = useMemo(() => {
    if (history.length === 0 && cachedSnapshot?.categorySpending) {
      return cachedSnapshot.categorySpending;
    }
    return calculateCategorySpending(history);
  }, [history, cachedSnapshot]);

  const availableMarketNames = useMemo(() => {
    if (history.length === 0 && cachedSnapshot?.availableMarketNames) {
      return cachedSnapshot.availableMarketNames;
    }
    const set = new Set<string>();
    markets.forEach((m) => set.add(m.name));
    history.forEach((r) => set.add(r.marketName));
    return Array.from(set).sort();
  }, [markets, history, cachedSnapshot]);

  useEffect(() => {
    if (history.length > 0) {
      const timer = setTimeout(() => {
        const snap = buildHomeSnapshot(history, markets, 0, priceIndexDays);
        saveHomeSnapshot(snap);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [history, markets, priceIndexDays]);

  const highlightedVariations =
    variationTab === 'up' ? priceIndex.topIncreases : priceIndex.topDecreases;

  const currentMonthName = useMemo(() => {
    const raw = new Date().toLocaleDateString('pt-BR', { month: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24 pt-safe">
      <header className="sticky top-0 z-20 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
              Início &amp; Análises
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Gastos mensais, inflação pessoal e comparativo por mercado
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
                className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--bg-app)] active:scale-[0.98]"
              >
                <GitCompareArrows size={16} strokeWidth={1.5} className="text-[var(--accent-fg)]" />
                <span>Comparar</span>
              </button>
            )}
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4 animate-enter">
        {/* Monthly Spending Summary */}
        <section className="relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-2xs">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-36 overflow-hidden sm:w-48">
            <img
              src="/assets/gocery.jpg"
              alt=""
              className="h-full w-full object-cover object-center opacity-15 dark:opacity-10 [mask-image:linear-gradient(to_right,transparent,black)] [-webkit-mask-image:linear-gradient(to_right,transparent,black)]"
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Gastos em {currentMonthName}
              </span>
              <span className="font-mono-tabular rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                {monthlyStats.currentMonthCount}{' '}
                {monthlyStats.currentMonthCount === 1 ? 'compra' : 'compras'}
              </span>
            </div>

            <p className="font-mono-tabular mt-3 text-3xl font-medium tracking-tight text-[var(--text-primary)]">
              {AppFormatters.formatCurrency(monthlyStats.currentMonthTotal)}
            </p>

            {monthlyStats.diffPercent != null ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                {monthlyStats.diffPercent <= 0 ? (
                  <ArrowDownRight size={15} strokeWidth={1.5} className="text-[var(--positive)]" />
                ) : (
                  <ArrowUpRight size={15} strokeWidth={1.5} className="text-[var(--negative)]" />
                )}
                <span
                  className={`font-mono-tabular font-medium ${
                    monthlyStats.diffPercent <= 0
                      ? 'text-[var(--positive)]'
                      : 'text-[var(--negative)]'
                  }`}
                >
                  {Math.abs(monthlyStats.diffPercent).toFixed(1)}%
                </span>
                <span>
                  {monthlyStats.diffPercent <= 0 ? 'a menos' : 'a mais'} vs mês anterior (
                  <span className="font-mono-tabular">
                    {AppFormatters.formatCurrency(monthlyStats.previousMonthTotal)}
                  </span>
                  )
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Finalize compras ou importe cupons fiscais para comparar com o mês anterior
              </p>
            )}
          </div>
        </section>

        {history.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
              <BarChart3 size={22} strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-base font-medium text-[var(--text-primary)]">
              Suas análises aparecerão aqui
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--text-secondary)]">
              Finalize uma lista ou importe uma NFC-e na aba{' '}
              <strong className="font-medium text-[var(--text-primary)]">Histórico</strong> para acompanhar variação de preços e recomendações de mercado
            </p>
          </section>
        ) : (
          <>
            {/* Personal Price Index */}
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-2xs">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-primary)]">
                    Índice de preços pessoal
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    <span className="font-mono-tabular">{priceIndex.totalComparedItems}</span> itens comparados ({priceIndex.periodLabel})
                  </p>
                </div>
                <select
                  value={priceIndexDays}
                  onChange={(e) => setPriceIndexDays(Number(e.target.value))}
                  aria-label="Período do índice de preços"
                  className="h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 text-xs font-medium text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent)]"
                >
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={90}>90 dias</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      priceIndex.overallVariationPercent <= 0
                        ? 'bg-[var(--accent-soft)] text-[var(--positive)]'
                        : 'bg-[var(--negative-soft)] text-[var(--negative)]'
                    }`}
                  >
                    {priceIndex.overallVariationPercent <= 0 ? (
                      <TrendingDown size={18} strokeWidth={1.5} />
                    ) : (
                      <TrendingUp size={18} strokeWidth={1.5} />
                    )}
                  </div>
                  <div>
                    <p className="font-mono-tabular text-xl font-medium leading-tight text-[var(--text-primary)]">
                      {priceIndex.overallVariationPercent > 0 ? '+' : ''}
                      {priceIndex.overallVariationPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Variação média da cesta
                    </p>
                  </div>
                </div>
                <div className="font-mono-tabular text-right text-xs font-medium">
                  <p className="text-[var(--positive)]">
                    {priceIndex.decreasedCount} caíram
                  </p>
                  <p className="text-[var(--negative)]">
                    {priceIndex.increasedCount} subiram
                  </p>
                </div>
              </div>

              {(priceIndex.topDecreases.length > 0 ||
                priceIndex.topIncreases.length > 0) && (
                <div className="mt-3">
                  <div className="mb-3 inline-flex rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-1">
                    <button
                      type="button"
                      onClick={() => setVariationTab('down')}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-[background-color,color] duration-150 ease-ui ${
                        variationTab === 'down'
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Quedas (<span className="font-mono-tabular">{priceIndex.topDecreases.length}</span>)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariationTab('up')}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-[background-color,color] duration-150 ease-ui ${
                        variationTab === 'up'
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Altas (<span className="font-mono-tabular">{priceIndex.topIncreases.length}</span>)
                    </button>
                  </div>

                  {highlightedVariations.length > 0 && (
                    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                      {highlightedVariations.map((v) => (
                        <div
                          key={`${v.productName}_${v.marketName}`}
                          className="w-44 shrink-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3"
                        >
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {v.productName}
                          </p>
                          <p className="truncate text-xs text-[var(--text-muted)]">
                            {v.marketName}
                          </p>
                          <div className="mt-2 flex items-baseline justify-between gap-2">
                            <span className="font-mono-tabular text-xs font-medium text-[var(--text-primary)]">
                              {AppFormatters.formatCurrency(v.currentPrice)}
                            </span>
                            <span
                              className={`font-mono-tabular text-xs font-medium ${
                                v.variationPercent < 0
                                  ? 'text-[var(--positive)]'
                                  : 'text-[var(--negative)]'
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
              <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-2xs">
                <h2 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
                  Gastos por categoria
                </h2>
                <div className="space-y-3">
                  {categorySpending.slice(0, 6).map((cs, idx) => {
                    const info = PRODUCT_CATEGORY_MAP[cs.category];
                    return (
                      <div key={cs.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                            <CategoryDot category={cs.category} />
                            {info.label}
                          </span>
                          <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                            {AppFormatters.formatCurrency(cs.totalSpent)}{' '}
                            <span className="font-normal text-[var(--text-muted)]">
                              ({cs.percentage.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                          <div
                            className={`h-full rounded-full ${
                              idx === 0
                                ? 'bg-[var(--accent)]'
                                : 'bg-[var(--text-primary)]/25'
                            }`}
                            style={{
                              width: `${Math.min(100, cs.percentage)}%`,
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
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-2xs">
              <h2 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
                Análise por produto (<span className="font-mono-tabular">{filteredAggregates.length}</span>)
              </h2>

              <div className="mb-3 flex gap-2">
                <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 focus-within:border-[var(--accent)]">
                  <Search size={16} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Buscar produto"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                  />
                </div>
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  aria-label="Filtrar por mercado"
                  className="h-9 max-w-[140px] rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 text-xs font-medium text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent)]"
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
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3 py-2.5 text-left transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CategoryIcon category={agg.category} size={18} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {agg.displayName}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          Menor:{' '}
                          <span className="font-mono-tabular">
                            {agg.minPriceOccurrence
                              ? `${AppFormatters.formatCurrency(agg.minPriceOccurrence.price)} (${agg.minPriceOccurrence.marketName})`
                              : '--'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="font-mono-tabular text-xs font-medium text-[var(--accent-fg)]">
                        {AppFormatters.formatCurrency(agg.lastPrice)}
                      </p>
                      <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
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
