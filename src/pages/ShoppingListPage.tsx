import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
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
  Store,
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
import { CategoryIcon } from '../components/common/CategoryIcon';
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
      toastTimerRef.current = null;
      setToastMsg(null);
    }, 2800);
  }, []);

  const handleOpenEdit = useCallback((it: ShoppingItem) => {
    setEditingItem(it);
  }, []);

  const handleRemoveItem = useCallback(
    (id: string) => {
      removeItem(id);
      showToast('Item removido da lista');
    },
    [removeItem, showToast],
  );

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

  const historicalSuggestions = useMemo(() => {
    const q = inputText.trim();
    if (q.length < 2 || detectedBulkItems.length > 1) return [];
    const normQ = CategoryClassifier.normalize(q);
    if (!normQ) return [];
    const allAggs = buildAllProductAggregates(history);
    return allAggs
      .filter((agg) =>
        CategoryClassifier.normalize(agg.displayName).includes(normQ),
      )
      .slice(0, 5);
  }, [inputText, detectedBulkItems.length, history]);

  const filteredAndSortedItems = useMemo(() => {
    const orderMap = new Map<ProductCategoryId, number>();
    selectedMarket.categoryOrder.forEach((cat, idx) => orderMap.set(cat, idx));

    return items
      .filter((item) => {
        if (!showCheckedItems && item.isChecked) return false;
        if (categoryFilter && item.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const idxA = orderMap.get(a.category) ?? 999;
        const idxB = orderMap.get(b.category) ?? 999;
        if (idxA !== idxB) return idxA - idxB;
        if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
  }, [items, selectedMarket, showCheckedItems, categoryFilter]);

  // Precompute market price recommendations once per history/markets change
  // so checking/unchecking items never re-scans the entire purchase history.
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
      if (savingsPercent < 1) continue;

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
    return bargainGroups.find((g) => g.market.id === selectedMarketId) ?? null;
  }, [bargainGroups, selectedMarketId]);

  const totalEstimated = useMemo(
    () => items.reduce((sum, item) => sum + getEffectiveTotalAmount(item), 0),
    [items],
  );
  const checkedTotal = useMemo(
    () =>
      items
        .filter((i) => i.isChecked)
        .reduce((sum, item) => sum + getEffectiveTotalAmount(item), 0),
    [items],
  );
  const checkedCount = items.filter((i) => i.isChecked).length;

  const handleAddSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = inputText.trim();
    if (!raw) return;

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
        showToast('Todos os itens colados já estavam na lista');
      }
      return;
    }

    const added = addSingleItem(raw);
    if (added) {
      setInputText('');
    } else {
      showToast('Este item já está na sua lista');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-36 pt-safe">
      {/* Top Hero Moment: natural kraft bag photograph blended seamlessly into warm surface */}
      <div className="relative overflow-hidden border-b border-[var(--border-hairline)]">
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/assets/ListTop.jpg"
            alt="Sacola de compras com hortifrúti"
            className="h-full w-full object-cover object-right opacity-85 dark:opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-app)] via-[var(--bg-app)]/85 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--bg-app)] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl px-4 pt-3 pb-4">
          {/* Top quiet utility bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-3 text-xs font-medium text-[var(--text-primary)] shadow-2xs backdrop-blur-sm">
                <ShoppingCart size={16} strokeWidth={1.5} className="text-[var(--accent-fg)]" />
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-2.5 text-xs font-medium text-[var(--text-secondary)] shadow-2xs backdrop-blur-sm"
                >
                  {hasPendingCloudPush ? (
                    <CloudOff size={14} strokeWidth={1.5} className="text-[#B45309] dark:text-[#FBBF24]" />
                  ) : (
                    <Cloud size={14} strokeWidth={1.5} className="text-[var(--accent-fg)]" />
                  )}
                  <span className="font-mono-tabular">{sharedSpaceCode}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={clearCheckedItems}
                  title="Remover itens marcados"
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-3 text-xs font-medium text-[var(--text-primary)] shadow-2xs backdrop-blur-sm transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--bg-subtle)] active:scale-[0.98]"
                >
                  <Trash2 size={15} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                  <span className="font-mono-tabular">Limpar ({checkedCount})</span>
                </button>
              )}
              <ThemeToggleButton variant="glass" />
            </div>
          </div>

          {/* Quick-add bar anchored in the calm left space */}
          <form onSubmit={handleAddSubmit} className="relative mt-6">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1.5 pl-3.5 shadow-sm transition-colors duration-150 ease-ui focus-within:border-[var(--accent)]">
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
                className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-xs font-medium text-[var(--accent-ink)] transition-[background-color,opacity,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-40"
              >
                {detectedBulkItems.length > 1 ? (
                  <>
                    <ClipboardPaste size={15} strokeWidth={1.5} />
                    <span className="font-mono-tabular">Colar ({detectedBulkItems.length})</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} strokeWidth={1.5} />
                    <span>Adicionar</span>
                  </>
                )}
              </button>
            </div>

            {/* Autocomplete suggestions dropdown */}
            {historicalSuggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-lg">
                <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
                  <History size={14} strokeWidth={1.5} />
                  <span>Sugestões do seu histórico</span>
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
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                  >
                    <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                      <CategoryIcon category={agg.category} size={16} />
                      {agg.displayName}
                    </span>
                    <span className="font-mono-tabular font-medium text-[var(--accent-fg)]">
                      {AppFormatters.formatCurrency(agg.lastPrice)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>

      <PwaInstallBanner />

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4 animate-enter">
        {/* Market Aisle Order Selector */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {markets.map((m) => {
            const active = selectedMarket.id === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMarket(m.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-[color,background-color,border-color,transform] duration-150 ease-ui active:scale-[0.98] ${
                  active
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-app)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {active ? (
                  <Check size={14} strokeWidth={1.75} />
                ) : (
                  <Store size={14} strokeWidth={1.5} />
                )}
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>

        {/* List Title Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-medium tracking-tight text-[var(--text-primary)]">
              Lista • {selectedMarket.name}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Itens organizados na ordem de setores de {selectedMarket.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label="Filtros"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              <SlidersHorizontal size={18} strokeWidth={1.5} />
              {(categoryFilter || !showCheckedItems) && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--accent)]" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowListMenu(!showListMenu)}
                aria-label="Mais opções"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                <MoreVertical size={18} strokeWidth={1.5} />
              </button>

              {showListMenu && (
                <div className="absolute right-0 top-10 z-40 w-52 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1.5 shadow-lg">
                  {checkedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearCheckedItems();
                        setShowListMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                    >
                      <Trash2 size={15} strokeWidth={1.5} />
                      <span>Limpar marcados ({checkedCount})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      uncheckAllItems();
                      setShowListMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                  >
                    <RotateCcw size={15} strokeWidth={1.5} />
                    <span>Desmarcar todos</span>
                  </button>
                  <button
                    type="button"
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
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                    <span>Limpar toda a lista</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFinish(true);
                      setShowListMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--accent-fg)] transition-colors duration-150 ease-ui hover:bg-[var(--accent-soft)]"
                  >
                    <ShoppingBag size={15} strokeWidth={1.5} />
                    <span>Finalizar compra</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Market Bargain Banner */}
        {bargainGroups.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSavings(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-3 text-left shadow-2xs transition-[background-color,border-color,transform] duration-150 ease-ui hover:bg-[var(--bg-subtle)] active:scale-[0.99]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-fg)]">
              {activeMarketBargainGroup ? (
                <Tag size={16} strokeWidth={1.5} />
              ) : (
                <PiggyBank size={16} strokeWidth={1.5} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {activeMarketBargainGroup ? (
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                  Mais baratos no {activeMarketBargainGroup.market.name}:{' '}
                  {activeMarketBargainGroup.bargains
                    .map((b) => b.item.name)
                    .join(', ')}
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    Economia identificada no seu histórico
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {bargainGroups[0].market.name}:{' '}
                    {bargainGroups[0].bargains
                      .slice(0, 3)
                      .map((b) => b.item.name)
                      .join(', ')}
                  </p>
                </>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]">
              Ver <ChevronRight size={14} strokeWidth={1.5} />
            </span>
          </button>
        )}

        {/* Active category filter strip */}
        {categoryFilter && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs">
            <span className="font-medium text-[var(--text-primary)]">
              Categoria: {PRODUCT_CATEGORY_MAP[categoryFilter].label}
            </span>
            <button
              type="button"
              onClick={() => useShoppingStore.getState().setCategoryFilter(null)}
              className="font-medium text-[var(--accent-fg)] hover:underline"
            >
              Limpar filtro
            </button>
          </div>
        )}

        {/* Shopping Items List */}
        {filteredAndSortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
              <ShoppingCart size={22} strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-base font-medium text-[var(--text-primary)]">
              Sua lista está vazia
            </h2>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--text-secondary)]">
              Digite um item acima ou cole uma lista inteira de supermercado, como 2kg Arroz, 3x Leite, Tomate
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedItems.map((item) => {
              const bestRec =
                recommendationsByProduct.get(
                  CategoryClassifier.normalize(item.name),
                )?.[0] ?? null;

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

      {/* Finish Purchase Action */}
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setShowFinish(true)}
          title={`Total no carrinho: ${AppFormatters.formatCurrency(checkedTotal)} | Estimado: ${AppFormatters.formatCurrency(totalEstimated)}`}
          className="fixed right-4 bottom-20 z-30 flex h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] shadow-lg transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98]"
        >
          <ShoppingBag size={18} strokeWidth={1.5} />
          <span>
            {checkedCount > 0
              ? `Finalizar (${checkedCount})`
              : 'Finalizar compra'}
          </span>
        </button>
      )}

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-36 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--border-hairline)] bg-[var(--text-primary)] px-4 py-2 text-xs font-medium text-[var(--bg-app)] shadow-lg">
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
          onSelectMarket={(id) => selectMarket(id)}
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
