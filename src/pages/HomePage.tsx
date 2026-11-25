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
import { CategoryClassifier } from '../services/categoryClassifier';
import { AppFormatters } from '../utils/formatters';
import { CategoryBadge, CategoryDot } from '../components/common/CategoryIcon';
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

  const fullAggregates = useMemo(
    () => (marketFilter ? buildAllProductAggregates(history) : allAggregates),
    [history, marketFilter, allAggregates],
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
    <div className="min-h-screen bg-[var(--bg-app)] pb-28 pt-safe md:pb-16">
      {/* Page Header Band */}
      <section className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Início &amp; Análises
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Gastos mensais, inflação pessoal e comparativo real por mercado
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
                className="btn-secondary h-10 px-4 text-xs sm:text-sm"
              >
                <GitCompareArrows
                  size={16}
                  strokeWidth={1.8}
                  className="text-[var(--accent-fg)]"
                />
                <span>Comparar</span>
              </button>
            )}
            <div className="md:hidden">
              <ThemeToggleButton />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-6 px-4 pt-6 animate-enter sm:px-6 lg:px-8">
        {/* Hero Financial Split */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
          {/* Monthly Spending Card */}
          <div className="surface-card flex flex-col justify-between p-6 sm:p-7 md:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Gastos em {currentMonthName}
              </span>
              <span className="font-mono-tabular rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {monthlyStats.currentMonthCount}{' '}
                {monthlyStats.currentMonthCount === 1 ? 'compra' : 'compras'}
              </span>
            </div>

            <div className="mt-5">
              <p className="font-mono-tabular text-4xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl">
                {AppFormatters.formatCurrency(monthlyStats.currentMonthTotal)}
              </p>

              {monthlyStats.diffPercent != null ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span
                    className={`font-mono-tabular inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      monthlyStats.diffPercent <= 0
                        ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                        : 'bg-[var(--negative-soft)] text-[var(--negative)]'
                    }`}
                  >
                    {monthlyStats.diffPercent <= 0 ? (
                      <ArrowDownRight size={14} strokeWidth={2} />
                    ) : (
                      <ArrowUpRight size={14} strokeWidth={2} />
                    )}
                    {Math.abs(monthlyStats.diffPercent).toFixed(1)}%
                  </span>
                  <span>
                    {monthlyStats.diffPercent <= 0 ? 'a menos' : 'a mais'} vs mês
                    anterior (
                    <span className="font-mono-tabular text-[var(--text-primary)]">
                      {AppFormatters.formatCurrency(monthlyStats.previousMonthTotal)}
                    </span>
                    )
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  Finalize compras ou importe cupons fiscais para comparar com o mês
                  anterior
                </p>
              )}
            </div>
          </div>

          {/* Editorial Produce Photograph Frame (no caption per taste-skill house rule 1) */}
          <div className="photo-frame hidden h-full min-h-[210px] rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] md:col-span-5 md:block">
            <img
              src="/assets/gocery.jpg"
              alt="Prateleira de hortifrúti fresco em supermercado"
              className="animate-photo-settle h-full w-full object-cover object-center"
            />
          </div>
        </section>

        {history.length === 0 ? (
          <section className="surface-card border-dashed px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <BarChart3 size={24} strokeWidth={1.6} />
            </div>
            <h2 className="font-display mt-5 text-xl font-semibold text-[var(--text-primary)]">
              Suas análises aparecerão aqui
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              Finalize uma lista ou importe uma NFC-e na aba{' '}
              <strong className="font-semibold text-[var(--text-primary)]">
                Histórico
              </strong>{' '}
              para acompanhar variação de preços e recomendações de mercado
            </p>
          </section>
        ) : (
          <>
            {/* Bento Analytics Row: Inflation Index + Category Spending */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
              {/* Personal Price Index */}
              <section className="surface-card flex flex-col justify-between p-5 sm:p-6 md:col-span-7">
                <div>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                        Índice de preços pessoal
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        <span className="font-mono-tabular">
                          {priceIndex.totalComparedItems}
                        </span>{' '}
                        itens comparados ({priceIndex.periodLabel})
                      </p>
                    </div>
                    <select
                      value={priceIndexDays}
                      onChange={(e) => setPriceIndexDays(Number(e.target.value))}
                      aria-label="Período do índice de preços"
                      className="h-9 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 text-xs font-medium text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent)]"
                    >
                      <option value={30}>30 dias</option>
                      <option value={60}>60 dias</option>
                      <option value={90}>90 dias</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                          priceIndex.overallVariationPercent <= 0
                            ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                            : 'bg-[var(--negative-soft)] text-[var(--negative)]'
                        }`}
                      >
                        {priceIndex.overallVariationPercent <= 0 ? (
                          <TrendingDown size={20} strokeWidth={1.9} />
                        ) : (
                          <TrendingUp size={20} strokeWidth={1.9} />
                        )}
                      </div>
                      <div>
                        <p className="font-mono-tabular text-2xl font-semibold leading-tight text-[var(--text-primary)]">
                          {priceIndex.overallVariationPercent > 0 ? '+' : ''}
                          {priceIndex.overallVariationPercent.toFixed(1)}%
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Variação média da cesta
                        </p>
                      </div>
                    </div>
                    <div className="font-mono-tabular text-right text-xs font-semibold">
                      <p className="text-[var(--positive)]">
                        {priceIndex.decreasedCount} caíram
                      </p>
                      <p className="mt-0.5 text-[var(--negative)]">
                        {priceIndex.increasedCount} subiram
                      </p>
                    </div>
                  </div>
                </div>

                {(priceIndex.topDecreases.length > 0 ||
                  priceIndex.topIncreases.length > 0) && (
                  <div className="mt-5">
                    <div className="segmented-track mb-3">
                      <button
                        type="button"
                        onClick={() => setVariationTab('down')}
                        className={`segmented-item px-4 py-1.5 text-xs ${
                          variationTab === 'down'
                            ? 'segmented-item-active text-[var(--accent-fg)]'
                            : ''
                        }`}
                      >
                        Quedas (
                        <span className="font-mono-tabular">
                          {priceIndex.topDecreases.length}
                        </span>
                        )
                      </button>
                      <button
                        type="button"
                        onClick={() => setVariationTab('up')}
                        className={`segmented-item px-4 py-1.5 text-xs ${
                          variationTab === 'up' ? 'segmented-item-active' : ''
                        }`}
                      >
                        Altas (
                        <span className="font-mono-tabular">
                          {priceIndex.topIncreases.length}
                        </span>
                        )
                      </button>
                    </div>

                    {highlightedVariations.length > 0 && (
                      <div
                        key={variationTab}
                        className={`no-scrollbar flex gap-3 overflow-x-auto pb-1 ${
                          variationTab === 'up'
                            ? 'animate-slide-forward'
                            : 'animate-slide-backward'
                        }`}
                      >
                        {highlightedVariations.map((v) => {
                          const targetAgg =
                            fullAggregates.find((agg) =>
                              agg.occurrences.some(
                                (occ) => occ.productName === v.productName,
                              ),
                            ) ??
                            fullAggregates.find(
                              (agg) =>
                                agg.normalizedKey ===
                                CategoryClassifier.normalizeForComparison(
                                  v.productName,
                                ),
                            ) ??
                            null;

                          return (
                            <button
                              key={`${v.productName}_${v.marketName}`}
                              type="button"
                              disabled={!targetAgg}
                              onClick={() => {
                                if (targetAgg) {
                                  setSelectedAggregate(targetAgg);
                                }
                              }}
                              className="card-interactive w-48 shrink-0 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3.5 text-left disabled:cursor-default disabled:opacity-80"
                            >
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                                {v.productName}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                {v.marketName}
                              </p>
                              <div className="mt-3 flex items-baseline justify-between gap-2">
                                <span className="font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
                                  {AppFormatters.formatCurrency(v.currentPrice)}
                                </span>
                                <span
                                  className={`font-mono-tabular rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    v.variationPercent < 0
                                      ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                                      : 'bg-[var(--negative-soft)] text-[var(--negative)]'
                                  }`}
                                >
                                  {v.variationPercent > 0 ? '+' : ''}
                                  {v.variationPercent.toFixed(0)}%
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Category Spending Ledger */}
              {categorySpending.length > 0 && (
                <section className="surface-card p-5 sm:p-6 md:col-span-5">
                  <h2 className="font-display mb-4 text-lg font-semibold text-[var(--text-primary)]">
                    Gastos por categoria
                  </h2>
                  <div className="space-y-4">
                    {categorySpending.slice(0, 6).map((cs) => {
                      const info = PRODUCT_CATEGORY_MAP[cs.category];
                      return (
                        <div key={cs.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                              <CategoryDot category={cs.category} />
                              <span>{info.label}</span>
                            </span>
                            <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                              {AppFormatters.formatCurrency(cs.totalSpent)}{' '}
                              <span className="font-normal text-[var(--text-muted)]">
                                ({cs.percentage.toFixed(0)}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                            <div
                              className="h-full rounded-full transition-[width] duration-300 ease-ui"
                              style={{
                                width: `${Math.max(4, Math.min(100, cs.percentage))}%`,
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
            </div>

            {/* Product Price Explorer */}
            <section className="surface-card p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                    Análise por produto{' '}
                    <span className="font-mono-tabular text-sm font-normal text-[var(--text-muted)]">
                      ({filteredAggregates.length})
                    </span>
                  </h2>
                </div>

                <div className="flex flex-1 gap-2 sm:max-w-md">
                  <div className="flex h-10 flex-1 items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 transition-colors focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-surface)]">
                    <Search
                      size={16}
                      strokeWidth={1.75}
                      className="text-[var(--text-muted)]"
                    />
                    <input
                      type="text"
                      placeholder="Buscar produto"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                    />
                  </div>
                  <select
                    value={marketFilter}
                    onChange={(e) => setMarketFilter(e.target.value)}
                    aria-label="Filtrar por mercado"
                    className="h-10 max-w-[155px] rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 text-xs font-medium text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent)]"
                  >
                    <option value="">Todos mercados</option>
                    {availableMarketNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {filteredAggregates.slice(0, 30).map((agg) => (
                  <button
                    key={agg.normalizedKey}
                    type="button"
                    onClick={() => setSelectedAggregate(agg)}
                    className="card-interactive flex w-full items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-3 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryBadge
                        category={agg.category}
                        size={17}
                        className="h-9 w-9 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
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
                      <p className="font-mono-tabular text-sm font-semibold text-[var(--positive)]">
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
          allAggregates={fullAggregates}
          onCompareWith={(other) => {
            setCompareState({
              open: true,
              itemA: selectedAggregate,
              itemB: other,
            });
            setSelectedAggregate(null);
          }}
          onClose={() => setSelectedAggregate(null)}
        />
      )}

      {compareState.open && (
        <ProductComparisonModal
          allAggregates={fullAggregates}
          initialItemA={compareState.itemA}
          initialItemB={compareState.itemB}
          onClose={() => setCompareState({ open: false })}
        />
      )}
    </div>
  );
}
