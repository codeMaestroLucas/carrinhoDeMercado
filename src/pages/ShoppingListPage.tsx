import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  ClipboardPaste,
  Cloud,
  CloudOff,
  History,
  MoreVertical,
  PiggyBank,
  Plus,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_MAP,
  getEffectiveTotalAmount,
  type MarketPriceRecommendation,
  type MarketProfile,
  type ProductCategoryId,
  type ShoppingItem,
} from '../types/shopping';
import { useShoppingStore } from '../store/useShoppingStore';
import { CategoryClassifier } from '../services/categoryClassifier';
import { buildAllProductAggregates } from '../services/productHistoryService';
import { AppFormatters } from '../utils/formatters';
import { CategoryDot } from '../components/common/CategoryIcon';
import { GooeyMarketSelector } from '../components/common/GooeyMarketSelector';
import { SmartTooltip } from '../components/common/SmartTooltip';
import { ThemeToggleButton } from '../components/layout/ThemeToggleButton';
import { PwaInstallBanner } from '../components/layout/PwaInstallBanner';
import { EditItemModal } from '../components/list/EditItemModal';
import { FiltersModal } from '../components/list/FiltersModal';
import { SwipeableShoppingItemRow } from '../components/list/SwipeableShoppingItemRow';
import {
  MarketSavingsModal,
  type MarketBargainGroup,
  type MarketBargainItem,
} from '../components/list/MarketSavingsModal';
import { FinishPurchaseModal } from '../components/list/FinishPurchaseModal';

interface ShoppingListPageProps {
  autoFocusQuickAdd?: boolean;
  onQuickAddConsumed?: () => void;
}

export function ShoppingListPage({
  autoFocusQuickAdd,
  onQuickAddConsumed,
}: ShoppingListPageProps) {
  const items = useShoppingStore((s) => s.items);
  const markets = useShoppingStore((s) => s.markets);
  const selectedMarketId = useShoppingStore((s) => s.selectedMarketId);
  const categoryFilter = useShoppingStore((s) => s.categoryFilter);
  const showCheckedItems = useShoppingStore((s) => s.showCheckedItems);
  const history = useShoppingStore((s) => s.history);
  const sharedSpaceCode = useShoppingStore((s) => s.sharedSpaceCode);
  const hasPendingCloudPush = useShoppingStore((s) => s.hasPendingCloudPush);
  const isSyncingCloud = useShoppingStore((s) => s.isSyncingCloud);

  const addSingleItem = useShoppingStore((s) => s.addSingleItem);
  const addItemsFromPastedTextWithReport = useShoppingStore(
    (s) => s.addItemsFromPastedTextWithReport,
  );
  const toggleItemChecked = useShoppingStore((s) => s.toggleItemChecked);
  const updateItemQuantity = useShoppingStore((s) => s.updateItemQuantity);
  const removeItem = useShoppingStore((s) => s.removeItem);
  const clearCheckedItems = useShoppingStore((s) => s.clearCheckedItems);
  const uncheckAllItems = useShoppingStore((s) => s.uncheckAllItems);
  const clearAllItems = useShoppingStore((s) => s.clearAllItems);
  const selectMarket = useShoppingStore((s) => s.selectMarket);

  const [inputText, setInputText] = useState('');
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSavings, setShowSavings] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [inputShake, setInputShake] = useState(false);
  const [marketDirection, setMarketDirection] = useState<'forward' | 'backward'>('forward');

  const handleSelectMarket = useCallback(
    (nextMarketId: string) => {
      if (nextMarketId === selectedMarketId) return;
      const curIdx = markets.findIndex((m) => m.id === selectedMarketId);
      const nextIdx = markets.findIndex((m) => m.id === nextMarketId);
      setMarketDirection(nextIdx >= curIdx ? 'forward' : 'backward');
      selectMarket(nextMarketId);
    },
    [markets, selectedMarketId, selectMarket],
  );

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoFocusQuickAdd) {
      inputRef.current?.focus();
      onQuickAddConsumed?.();
    }
  }, [autoFocusQuickAdd, onQuickAddConsumed]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
      toastTimerRef.current = null;
    }, 2800);
  }, []);

  const selectedMarket = useMemo(
    () => markets.find((m) => m.id === selectedMarketId) ?? markets[0],
    [markets, selectedMarketId],
  );

  const detectedBulkItems = useMemo(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return [];
    const hasDelimiter =
      trimmed.includes('\n') || trimmed.includes(';') || trimmed.includes(',');
    if (!hasDelimiter) return [];
    return CategoryClassifier.parsePastedList(trimmed);
  }, [inputText]);

  const allHistoryAggregates = useMemo(
    () => buildAllProductAggregates(history),
    [history],
  );

  const historicalSuggestions = useMemo(() => {
    const q = CategoryClassifier.normalize(inputText);
    if (q.length < 2 || detectedBulkItems.length > 1) return [];
    return allHistoryAggregates
      .filter((agg) => agg.normalizedKey.includes(q))
      .slice(0, 5);
  }, [allHistoryAggregates, inputText, detectedBulkItems.length]);

  const categoryOrderMap = useMemo(() => {
    const map = new Map<ProductCategoryId, number>();
    selectedMarket.categoryOrder.forEach((catId, idx) => map.set(catId, idx));
    return map;
  }, [selectedMarket]);

  const filteredAndSortedItems = useMemo(() => {
    return items
      .filter((item) => {
        if (!showCheckedItems && item.isChecked) return false;
        if (categoryFilter && item.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
        const catA = categoryOrderMap.get(a.category) ?? 999;
        const catB = categoryOrderMap.get(b.category) ?? 999;
        if (catA !== catB) return catA - catB;
        return a.name.localeCompare(b.name);
      });
  }, [items, showCheckedItems, categoryFilter, categoryOrderMap]);

  const recommendationsByProduct = useMemo(() => {
    const byId = new Map<string, MarketProfile>();
    const byNormName = new Map<string, MarketProfile>();
    for (const m of markets) {
      byId.set(m.id, m);
      byNormName.set(CategoryClassifier.normalize(m.name), m);
    }

    const pricesByProduct = new Map<string, Map<string, number[]>>();
    const fallbackMarketNames = new Map<string, string>();
    const allCategoryIds = PRODUCT_CATEGORIES.map((c) => c.id);

    for (const record of history) {
      const matchedMarket =
        byId.get(record.marketId) ??
        byNormName.get(CategoryClassifier.normalize(record.marketName));
      const marketKey = matchedMarket?.id ?? record.marketId;
      if (!fallbackMarketNames.has(marketKey)) {
        fallbackMarketNames.set(
          marketKey,
          matchedMarket?.name ?? record.marketName,
        );
      }

      for (const histItem of record.items) {
        if (histItem.price <= 0) continue;
        const prodKey = CategoryClassifier.normalize(histItem.name);
        if (!prodKey) continue;

        let marketPrices = pricesByProduct.get(prodKey);
        if (!marketPrices) {
          marketPrices = new Map<string, number[]>();
          pricesByProduct.set(prodKey, marketPrices);
        }
        const arr = marketPrices.get(marketKey);
        if (arr) {
          arr.push(histItem.price);
        } else {
          marketPrices.set(marketKey, [histItem.price]);
        }
      }
    }

    const result = new Map<string, MarketPriceRecommendation[]>();
    for (const [prodKey, marketPrices] of pricesByProduct.entries()) {
      const recs: MarketPriceRecommendation[] = [];
      for (const [marketId, prices] of marketPrices.entries()) {
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const market =
          byId.get(marketId) ??
          ({
            id: marketId,
            name: fallbackMarketNames.get(marketId) ?? 'Mercado',
            categoryOrder: allCategoryIds,
          } satisfies MarketProfile);
        recs.push({ market, averagePrice: avg, lastPrice: prices[0] });
      }
      recs.sort((a, b) => a.averagePrice - b.averagePrice);
      result.set(prodKey, recs);
    }
    return result;
  }, [history, markets]);

  const bargainGroups = useMemo<MarketBargainGroup[]>(() => {
    const groupsMap = new Map<string, MarketBargainGroup>();
    for (const item of items) {
      const recs = recommendationsByProduct.get(
        CategoryClassifier.normalize(item.name),
      );
      if (!recs || recs.length < 2) continue;
      const cheapest = recs[0];
      const highest = recs[recs.length - 1];
      if (highest.averagePrice <= cheapest.averagePrice) continue;
      const savingsPercent =
        ((highest.averagePrice - cheapest.averagePrice) /
          highest.averagePrice) *
        100;
      const bargain: MarketBargainItem = {
        item,
        cheapestPrice: cheapest.averagePrice,
        highestPrice: highest.averagePrice,
        savingsPercent,
      };
      const existing = groupsMap.get(cheapest.market.id);
      if (existing) {
        existing.bargains.push(bargain);
      } else {
        groupsMap.set(cheapest.market.id, {
          market: cheapest.market,
          bargains: [bargain],
        });
      }
    }
    return Array.from(groupsMap.values()).sort(
      (a, b) => b.bargains.length - a.bargains.length,
    );
  }, [items, recommendationsByProduct]);

  const activeMarketBargainGroup = useMemo(() => {
    return (
      bargainGroups.find((g) => g.market.id === selectedMarket.id) ?? null
    );
  }, [bargainGroups, selectedMarket.id]);

  const handleOpenEdit = useCallback((item: ShoppingItem) => {
    setEditingItem(item);
  }, []);

  const handleRemoveItem = useCallback(
    (id: string) => {
      removeItem(id);
      showToast('Item removido da lista');
    },
    [removeItem, showToast],
  );

  const { totalEstimated, checkedTotal, checkedCount } = useMemo(() => {
    let estimated = 0;
    let checkedSum = 0;
    let count = 0;
    for (const item of items) {
      const amount = getEffectiveTotalAmount(item);
      estimated += amount;
      if (item.isChecked) {
        checkedSum += amount;
        count++;
      }
    }
    return {
      totalEstimated: estimated,
      checkedTotal: checkedSum,
      checkedCount: count,
    };
  }, [items]);

  const triggerInputShake = () => {
    setInputShake(false);
    requestAnimationFrame(() => {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 380);
    });
  };

  const handleAddSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = inputText.trim();
    if (!raw) {
      triggerInputShake();
      return;
    }

    if (detectedBulkItems.length > 1) {
      const report = addItemsFromPastedTextWithReport(raw);
      setInputText('');
      if (report.addedCount > 0) {
        showToast(
          `${report.addedCount} ${report.addedCount === 1 ? 'item adicionado' : 'itens adicionados'}${
            report.skippedDuplicatesCount > 0
              ? ` (${report.skippedDuplicatesCount} já na lista)`
              : ''
          }`,
        );
      } else {
        triggerInputShake();
        showToast('Todos os itens colados já estavam na lista');
      }
      return;
    }

    const added = addSingleItem(raw);
    if (added) {
      setInputText('');
    } else {
      triggerInputShake();
      showToast('Este item já está na sua lista');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-44 pt-safe md:pb-28">
      {/* Editorial Top Hero Band with ListTop.jpg on BOTH Mobile & Desktop */}
      <section className="relative overflow-hidden border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        {/* Mobile atmospheric top-right photograph layer (restored per user request) */}
        <div className="pointer-events-none absolute inset-0 md:hidden">
          <img
            src="/assets/ListTop.jpg"
            alt=""
            className="animate-photo-settle h-full w-full object-cover object-right opacity-80 dark:opacity-28"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-surface)] via-[var(--bg-surface)]/86 to-[var(--bg-surface)]/15" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[var(--bg-surface)] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {/* Mobile Quiet Utility Row */}
          <div className="mb-4 flex items-center justify-between gap-2 md:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-surface)]/85 px-2.5 py-1 text-base font-semibold tracking-tight text-[var(--text-primary)] backdrop-blur-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                Carrinho
              </span>
              <div className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 px-2.5 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-sm">
                <ShoppingCart size={13} strokeWidth={1.8} className="text-[var(--accent-fg)]" />
                <span className="font-mono-tabular">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {sharedSpaceCode && (
                <div
                  title={
                    hasPendingCloudPush
                      ? 'Aguardando conexão para sincronizar'
                      : isSyncingCloud
                        ? 'Sincronizando com a família'
                        : `Sincronizado (${sharedSpaceCode})`
                  }
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 px-2.5 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-sm"
                >
                  {hasPendingCloudPush ? (
                    <CloudOff size={13} strokeWidth={1.8} className="text-[var(--amber)]" />
                  ) : (
                    <Cloud size={13} strokeWidth={1.8} className="text-[var(--positive)]" />
                  )}
                  <span className="font-mono-tabular">{sharedSpaceCode}</span>
                </div>
              )}
            </div>

            <ThemeToggleButton variant="glass" />
          </div>

          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12 lg:gap-8">
            {/* Left Column: Title & Quick-Add Command Bar */}
            <div className="md:col-span-7">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {sharedSpaceCode && (
                    <div className="mb-2 hidden items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] md:inline-flex">
                      {hasPendingCloudPush ? (
                        <CloudOff size={14} strokeWidth={1.8} className="text-[var(--amber)]" />
                      ) : (
                        <Cloud size={14} strokeWidth={1.8} className="text-[var(--positive)]" />
                      )}
                      <span>Espaço familiar</span>
                      <span className="font-mono-tabular rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-primary)]">
                        {sharedSpaceCode}
                      </span>
                    </div>
                  )}
                  <h1
                    key={selectedMarket.id}
                    className={`font-display truncate text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl lg:text-4xl ${
                      marketDirection === 'forward'
                        ? 'animate-slide-forward'
                        : 'animate-slide-backward'
                    }`}
                  >
                    Lista • {selectedMarket.name}
                  </h1>
                  <p className="sr-only">
                    Itens organizados na ordem de setores de {selectedMarket.name}
                  </p>
                </div>
              </div>

              {/* Apple Spotlight-style Quick-Add Bar */}
              <form onSubmit={handleAddSubmit} className="relative mt-4 sm:mt-5">
                <div
                  className={`flex items-center gap-2 rounded-2xl border bg-[var(--bg-surface)]/92 p-1.5 pl-4 shadow-[var(--shadow-card)] backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-150 ease-ui focus-within:border-[var(--accent)]/40 focus-within:bg-[var(--bg-surface)] focus-within:ring-4 focus-within:ring-[var(--accent-ring)] md:bg-[var(--bg-subtle)] md:shadow-none ${
                    inputShake
                      ? 'animate-shake border-[var(--negative)]/60 ring-2 ring-[var(--negative-soft)]'
                      : 'border-[var(--border-hairline)] md:border-transparent'
                  }`}
                >
                  <textarea
                    ref={inputRef}
                    rows={detectedBulkItems.length > 1 ? 3 : 1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        detectedBulkItems.length <= 1
                      ) {
                        e.preventDefault();
                        handleAddSubmit();
                      }
                    }}
                    placeholder="Adicionar item ou colar lista"
                    className="max-h-24 flex-1 resize-none bg-transparent py-2 text-sm leading-snug text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none sm:text-[15px]"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="btn-primary h-10 shrink-0 px-4 text-xs sm:px-5 sm:text-sm disabled:opacity-45"
                  >
                    {detectedBulkItems.length > 1 ? (
                      <>
                        <ClipboardPaste size={15} strokeWidth={1.9} />
                        <span className="font-mono-tabular">
                          Colar ({detectedBulkItems.length})
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} strokeWidth={2.2} />
                        <span>Adicionar</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Autocomplete Suggestions Dropdown (Origin-anchored below input) */}
                {historicalSuggestions.length > 0 && (
                  <div className="animate-popover-in origin-top absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-float)]">
                    <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
                      <History size={14} strokeWidth={1.75} />
                      <span>Do seu histórico de compras</span>
                    </div>
                    {historicalSuggestions.map((agg) => (
                      <button
                        key={agg.normalizedKey}
                        type="button"
                        onClick={() => {
                          addSingleItem(agg.displayName, {
                            category: agg.category,
                            price: agg.lastPrice > 0 ? agg.lastPrice : null,
                          });
                          setInputText('');
                        }}
                        className="flex w-full items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3 text-left text-sm transition-colors duration-150 ease-ui last:border-b-0 hover:bg-[var(--bg-app)]"
                      >
                        <span className="flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                          <CategoryDot category={agg.category} />
                          <span>{agg.displayName}</span>
                        </span>
                        <span className="font-mono-tabular text-xs font-medium text-[var(--positive)]">
                          {agg.lastPrice > 0
                            ? AppFormatters.formatCurrency(agg.lastPrice)
                            : 'Sem preço'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </div>

            {/* Right Column: Clean Editorial Produce Photograph (Desktop / Tablet) */}
            <div className="hidden md:col-span-5 md:block">
              <div className="photo-frame h-48 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] lg:h-52">
                <img
                  src="/assets/ListTop.jpg"
                  alt="Sacola kraft de compras com hortifrúti fresco"
                  className="animate-photo-settle h-full w-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <PwaInstallBanner />

      <div className="mx-auto max-w-5xl space-y-5 px-4 pt-5 animate-enter sm:px-6 lg:px-8">
        {/* Gooey Liquid Morph Market Aisle Rail + Actions */}
        <div className="flex items-center justify-between gap-2.5">
          <GooeyMarketSelector
            options={markets.map((m) => ({ id: m.id, label: m.name }))}
            selectedId={selectedMarket.id}
            onSelect={handleSelectMarket}
          />

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Desktop filter button; on mobile, Filters is consolidated into the 3-dots menu */}
            <div className="hidden md:inline-flex">
              <SmartTooltip label="Filtros da lista">
                <button
                  type="button"
                  onClick={() => setShowFilters(true)}
                  aria-label="Filtros"
                  className="btn-secondary relative h-11 w-11 p-0"
                >
                  <SlidersHorizontal size={17} strokeWidth={1.75} />
                  {(categoryFilter || !showCheckedItems) && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
              </SmartTooltip>
            </div>

            <div className="relative">
              <SmartTooltip label="Mais opções">
                <button
                  type="button"
                  onClick={() => setShowListMenu(!showListMenu)}
                  aria-label="Mais opções"
                  aria-expanded={showListMenu}
                  className="btn-secondary relative h-11 w-11 p-0"
                >
                  <MoreVertical size={17} strokeWidth={1.75} />
                  {(categoryFilter || !showCheckedItems) && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[var(--accent)] md:hidden" />
                  )}
                </button>
              </SmartTooltip>

              {showListMenu && (
                <div
                  className="fixed inset-0 z-30"
                  aria-hidden="true"
                  onClick={() => setShowListMenu(false)}
                />
              )}

              {/* Origin-anchored reversible menu expanding from/collapsing into trigger */}
              <div
                data-open={showListMenu}
                aria-hidden={!showListMenu}
                className="origin-menu origin-top-right absolute right-0 top-12 z-40 w-56 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-float)]"
              >
                <button
                  type="button"
                  tabIndex={showListMenu ? 0 : -1}
                  onClick={() => {
                    setShowListMenu(false);
                    setShowFilters(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] md:hidden"
                >
                  <span className="flex items-center gap-2.5">
                    <SlidersHorizontal size={15} strokeWidth={1.75} />
                    <span>Filtros da lista</span>
                  </span>
                  {(categoryFilter || !showCheckedItems) && (
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
                <div className="my-1 h-px bg-[var(--border-hairline)] md:hidden" />
                {checkedCount > 0 && (
                  <button
                    type="button"
                    tabIndex={showListMenu ? 0 : -1}
                    onClick={() => {
                      clearCheckedItems();
                      setShowListMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                    <span>Limpar marcados ({checkedCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  tabIndex={showListMenu ? 0 : -1}
                  onClick={() => {
                    uncheckAllItems();
                    setShowListMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                >
                  <RotateCcw size={15} strokeWidth={1.75} />
                  <span>Desmarcar todos</span>
                </button>
                <button
                  type="button"
                  tabIndex={showListMenu ? 0 : -1}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Tem certeza que deseja apagar todos os itens da lista?',
                      )
                    ) {
                      clearAllItems();
                      setShowListMenu(false);
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                  <span>Limpar toda a lista</span>
                </button>
                <div className="my-1 h-px bg-[var(--border-hairline)]" />
                <button
                  type="button"
                  tabIndex={showListMenu ? 0 : -1}
                  onClick={() => {
                    setShowFinish(true);
                    setShowListMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-[var(--accent-fg)] transition-colors duration-150 ease-ui hover:bg-[var(--accent-soft)]"
                >
                  <ShoppingBag size={15} strokeWidth={1.8} />
                  <span>Finalizar compra</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Market Bargain Banner */}
        {bargainGroups.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSavings(true)}
            className="surface-card card-interactive flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
              {activeMarketBargainGroup ? (
                <Tag size={18} strokeWidth={1.8} />
              ) : (
                <PiggyBank size={18} strokeWidth={1.8} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {activeMarketBargainGroup ? (
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  Mais baratos no {activeMarketBargainGroup.market.name}:{' '}
                  <span className="text-[var(--text-secondary)]">
                    {activeMarketBargainGroup.bargains
                      .map((b) => b.item.name)
                      .join(', ')}
                  </span>
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Economia identificada no seu histórico
                  </p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">
                    {bargainGroups[0].market.name}:{' '}
                    {bargainGroups[0].bargains
                      .slice(0, 3)
                      .map((b) => b.item.name)
                      .join(', ')}
                  </p>
                </>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]">
              Ver <ChevronRight size={14} strokeWidth={2} />
            </span>
          </button>
        )}

        {/* Active Category Filter Strip */}
        {categoryFilter && (
          <div className="surface-card flex items-center justify-between px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
              <CategoryDot category={categoryFilter} />
              <span>Filtrando: {PRODUCT_CATEGORY_MAP[categoryFilter].label}</span>
            </span>
            <button
              type="button"
              onClick={() => useShoppingStore.getState().setCategoryFilter(null)}
              className="text-xs font-semibold text-[var(--accent-fg)] hover:underline"
            >
              Limpar filtro
            </button>
          </div>
        )}

        {/* Shopping Items Grouped by Market Aisle */}
        {filteredAndSortedItems.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <ShoppingCart size={24} strokeWidth={1.6} />
            </div>
            <h2 className="font-display mt-5 text-xl font-semibold text-[var(--text-primary)]">
              Sua lista está vazia
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
              Digite um item acima ou cole uma lista inteira de supermercado, como{' '}
              <span className="font-mono-tabular text-[var(--text-primary)]">
                2kg Arroz, 3x Leite, Tomate
              </span>
            </p>
          </div>
        ) : (
          <div
            key={`list-${selectedMarket.id}`}
            className={`space-y-2 ${
              marketDirection === 'forward'
                ? 'animate-slide-forward'
                : 'animate-slide-backward'
            }`}
          >
            {filteredAndSortedItems.map((item) => {
              const bestRec = !item.isChecked
                ? recommendationsByProduct.get(
                    CategoryClassifier.normalize(item.name),
                  )?.[0] ?? null
                : null;

              return (
                <SwipeableShoppingItemRow
                  key={item.id}
                  item={item}
                  cheapestMarketName={bestRec ? bestRec.market.name : null}
                  onToggleChecked={toggleItemChecked}
                  onOpenEdit={handleOpenEdit}
                  onRemove={handleRemoveItem}
                  onUpdateQuantity={updateItemQuantity}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Apple Frosted-Glass Floating Checkout Bar */}
      {items.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[74px] z-20 px-4 md:bottom-6">
          <div className="apple-glass-strong pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-4 rounded-full border border-[var(--border-subtle)] py-2 pr-2 pl-5 text-[var(--text-primary)] shadow-[var(--shadow-float)]">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">
                {checkedCount > 0 ? 'No carrinho' : 'Total estimado'}
              </p>
              <p className="font-mono-tabular truncate text-base font-semibold leading-tight text-[var(--text-primary)]">
                {AppFormatters.formatCurrency(
                  checkedCount > 0 ? checkedTotal : totalEstimated,
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFinish(true)}
              title={`Total no carrinho: ${AppFormatters.formatCurrency(checkedTotal)} | Estimado: ${AppFormatters.formatCurrency(totalEstimated)}`}
              className={`btn-primary h-11 shrink-0 px-5 text-sm ${
                checkedCount === items.length && items.length > 0
                  ? 'animate-goal-ready'
                  : ''
              }`}
            >
              <ShoppingBag size={17} strokeWidth={2} />
              <span>
                {checkedCount > 0
                  ? `Finalizar (${checkedCount})`
                  : 'Finalizar compra'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Apple Frosted HUD Toast Feedback */}
      {toastMsg && (
        <div className="apple-glass-strong fixed bottom-36 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-float)] md:bottom-24">
          {toastMsg}
        </div>
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}
      {showFilters && <FiltersModal onClose={() => setShowFilters(false)} />}
      {showSavings && (
        <MarketSavingsModal
          groups={bargainGroups}
          onSelectMarket={(id) => handleSelectMarket(id)}
          onClose={() => setShowSavings(false)}
        />
      )}
      {showFinish && (
        <FinishPurchaseModal
          onClose={() => setShowFinish(false)}
          onFinished={(mkt, count) =>
            showToast(`Compra em ${mkt} (${count} itens) salva no histórico`)
          }
        />
      )}
    </div>
  );
}
