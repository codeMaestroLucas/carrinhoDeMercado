import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  ClipboardPaste,
  Cloud,
  CloudOff,
  MoreVertical,
  PiggyBank,
  Plus,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  PRODUCT_CATEGORY_MAP,
  getEffectiveTotalAmount,
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
  const marketRecommendationsForProduct = useShoppingStore(
    (s) => s.marketRecommendationsForProduct,
  );
  const recommendCheapestMarketForProduct = useShoppingStore(
    (s) => s.recommendCheapestMarketForProduct,
  );

  const [inputText, setInputText] = useState('');
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSavings, setShowSavings] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocusQuickAdd) {
      inputRef.current?.focus();
      onQuickAddConsumed?.();
    }
  }, [autoFocusQuickAdd, onQuickAddConsumed]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  };

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

  // All items are ALWAYS displayed (unless filtered by category or checked status),
  // organized according to the selected market's aisle/corridor order.
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

  const bargainGroups = useMemo<MarketBargainGroup[]>(() => {
    const groupsMap = new Map<string, MarketBargainGroup>();
    for (const item of items) {
      const recs = marketRecommendationsForProduct(item.name);
      if (recs.length < 2) continue;
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
  }, [items, marketRecommendationsForProduct]);

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
              ? ` (${report.skippedDuplicatesCount} duplicado(s) ignorado(s))`
              : ''
          }`,
        );
      } else {
        showToast('Todos os itens colados já estavam na lista.');
      }
      return;
    }

    const added = addSingleItem(raw);
    if (added) {
      setInputText('');
    } else {
      showToast('Este item já está na sua lista.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-36 dark:bg-[#121417]">
      {/* Stylized Top Banner with Wave Cut */}
      <div className="relative w-full pt-safe">
        <div className="relative h-56 w-full overflow-hidden sm:h-60">
          <img
            src="/assets/ListTop.jpg"
            alt="Mercado"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />

          {/* Top action buttons */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-3 pt-safe">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <ShoppingCart size={14} className="text-[#00C853]" />
                <span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
              </div>
              {sharedSpaceCode && (
                <div
                  title={
                    hasPendingCloudPush
                      ? 'Aguardando conexão para sincronizar'
                      : isSyncingCloud
                        ? 'Sincronizando com a família...'
                        : `Sincronizado (${sharedSpaceCode})`
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md"
                >
                  {hasPendingCloudPush ? (
                    <CloudOff size={13} className="text-amber-400" />
                  ) : (
                    <Cloud
                      size={13}
                      className={`text-[#00C853] ${isSyncingCloud ? 'animate-pulse' : ''}`}
                    />
                  )}
                  <span>{sharedSpaceCode}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={clearCheckedItems}
                  title="Remover itens marcados"
                  className="flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 text-xs font-semibold text-white backdrop-blur-md transition active:scale-95"
                >
                  <Trash2 size={13} />
                  <span>Limpar ({checkedCount})</span>
                </button>
              )}
              <ThemeToggleButton variant="glass" />
            </div>
          </div>

          {/* Frosted Glass "Add Items" Pill inside the image (as in image 1) */}
          <div className="absolute inset-x-4 top-16 z-20">
            <form onSubmit={handleAddSubmit} className="relative">
              <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/50 p-1.5 pl-3.5 shadow-2xl backdrop-blur-md focus-within:border-[#00C853] dark:bg-[#1E2229]/85">
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
                  placeholder="Adicionar itens (digite ou cole vários)..."
                  className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm text-white placeholder-white/70 outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-[#00C853] px-3.5 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-40"
                >
                  {detectedBulkItems.length > 1 ? (
                    <>
                      <ClipboardPaste size={14} />
                      <span>Colar ({detectedBulkItems.length})</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Adicionar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Autocomplete suggestions dropdown */}
              {historicalSuggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl dark:border-[#2E3440] dark:bg-[#1E2229]">
                  <div className="flex items-center gap-1.5 border-b border-[#E5E7EB] px-3 py-1.5 text-[11px] font-semibold text-[#6B7280] dark:border-[#2E3440] dark:text-[#9CA3AF]">
                    <Sparkles size={12} className="text-[#00C853]" />
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
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-[#F3F4F6] dark:hover:bg-[#181B20]"
                    >
                      <span className="flex items-center gap-2 font-semibold text-[#111827] dark:text-[#F3F4F6]">
                        <CategoryIcon category={agg.category} size={14} />
                        {agg.displayName}
                      </span>
                      <span className="font-bold text-[#00C853]">
                        {AppFormatters.formatCurrency(agg.lastPrice)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

          {/* Organic Wave Cut at the bottom of the image */}
          <div className="pointer-events-none absolute -bottom-1 left-0 right-0 z-10 w-full overflow-hidden leading-none">
            <svg
              viewBox="0 0 1000 60"
              preserveAspectRatio="none"
              className="h-10 w-full fill-[#F8F9FA] transition-colors sm:h-12 dark:fill-[#121417]"
            >
              <path d="M 0 60 L 0 32 Q 260 12, 540 38 Q 800 64, 1000 42 L 1000 60 Z" />
            </svg>
          </div>
        </div>
      </div>

      <PwaInstallBanner />

      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-1">
        {/* Market Aisle Order Selector Chips */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {markets.map((m) => {
            const active = selectedMarket.id === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMarket(m.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-[#00C853] text-white shadow-xs'
                    : 'border border-[#E5E7EB] bg-white text-[#6B7280] dark:border-[#2E3440] dark:bg-[#1E2229] dark:text-[#9CA3AF]'
                }`}
              >
                {active ? <Check size={13} className="stroke-[3]" /> : <Store size={13} />}
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>

        {/* List Title Row (matching image 1) */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827] dark:text-[#F3F4F6]">
              Lista • {selectedMarket.name}
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Itens organizados na ordem de setores de {selectedMarket.name}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label="Filtros"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-black/5 dark:text-[#9CA3AF] dark:hover:bg-white/5 active:scale-95"
            >
              <SlidersHorizontal size={18} />
              {(categoryFilter || !showCheckedItems) && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#00C853]" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowListMenu(!showListMenu)}
                aria-label="Mais opções"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-black/5 dark:text-[#9CA3AF] dark:hover:bg-white/5 active:scale-95"
              >
                <MoreVertical size={18} />
              </button>

              {showListMenu && (
                <div className="absolute right-0 top-10 z-40 w-48 rounded-2xl border border-[#E5E7EB] bg-white p-1.5 shadow-xl dark:border-[#2E3440] dark:bg-[#1E2229]">
                  {checkedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearCheckedItems();
                        setShowListMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 size={14} />
                      <span>Limpar marcados ({checkedCount})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      uncheckAllItems();
                      setShowListMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/5 dark:text-[#F3F4F6] dark:hover:bg-white/5"
                  >
                    <RotateCcw size={14} />
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
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                    <span>Limpar toda a lista</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFinish(true);
                      setShowListMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#00C853] hover:bg-[#00C853]/10"
                  >
                    <ShoppingBag size={14} />
                    <span>Finalizar Compra</span>
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
            className="flex w-full items-center gap-3 rounded-2xl border border-[#00C853]/30 bg-[#00C853]/10 px-3.5 py-2.5 text-left transition active:scale-99"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00C853]/15 text-[#00C853]">
              {activeMarketBargainGroup ? (
                <Tag size={16} />
              ) : (
                <PiggyBank size={17} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {activeMarketBargainGroup ? (
                <p className="truncate text-xs font-semibold text-[#111827] dark:text-[#F3F4F6]">
                  Mais baratos no {activeMarketBargainGroup.market.name}:{' '}
                  {activeMarketBargainGroup.bargains
                    .map((b) => b.item.name)
                    .join(', ')}
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                    Veja onde seus itens estão mais baratos
                  </p>
                  <p className="truncate text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                    {bargainGroups[0].market.name}:{' '}
                    {bargainGroups[0].bargains
                      .slice(0, 3)
                      .map((b) => b.item.name)
                      .join(', ')}
                  </p>
                </>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#00C853] px-2.5 py-1 text-[11px] font-bold text-white">
              Ver <ChevronRight size={13} />
            </span>
          </button>
        )}



        {/* Active category filter pill */}
        {categoryFilter && (
          <div className="flex items-center justify-between rounded-xl bg-[#00C853]/10 px-3 py-2 text-xs">
            <span className="font-semibold text-[#111827] dark:text-[#F3F4F6]">
              Categoria: {PRODUCT_CATEGORY_MAP[categoryFilter].label}
            </span>
            <button
              type="button"
              onClick={() => useShoppingStore.getState().setCategoryFilter(null)}
              className="font-bold text-[#00C853]"
            >
              Limpar filtro
            </button>
          </div>
        )}

        {/* Shopping Items List */}
        {filteredAndSortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center dark:border-[#2E3440] dark:bg-[#1E2229]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00C853]/12 text-[#00C853]">
              <ShoppingCart size={32} />
            </div>
            <h2 className="mt-4 text-base font-bold text-[#111827] dark:text-[#F3F4F6]">
              Sua lista está vazia
            </h2>
            <p className="mt-1 max-w-xs text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Digite um item acima ou cole uma lista inteira de supermercado (ex.:{' '}
              <em>2kg Arroz, 3x Leite, Tomate</em>).
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredAndSortedItems.map((item) => {
              const bestRec = recommendCheapestMarketForProduct(item.name);

              return (
                <SwipeableShoppingItemRow
                  key={item.id}
                  item={item}
                  cheapestMarketName={bestRec ? bestRec.market.name : null}
                  onToggleChecked={toggleItemChecked}
                  onOpenEdit={(it) => setEditingItem(it)}
                  onRemove={(id) => {
                    removeItem(id);
                    showToast('Item removido da lista');
                  }}
                  onUpdateQuantity={updateItemQuantity}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Finalizar Compra Pill Button (matching Flutter UI) */}
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setShowFinish(true)}
          title={`Total no carrinho: ${AppFormatters.formatCurrency(checkedTotal)} | Estimado: ${AppFormatters.formatCurrency(totalEstimated)}`}
          className="fixed right-4 bottom-20 z-30 flex items-center gap-2.5 rounded-2xl bg-[#00C853] px-5 py-3.5 text-sm font-bold text-white shadow-xl transition active:scale-95 hover:bg-[#00b34a]"
        >
          <ShoppingBag size={18} />
          <span>
            {checkedCount > 0
              ? `Finalizar (${checkedCount})`
              : 'Finalizar Compra'}
          </span>
        </button>
      )}

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-36 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#111827] px-4 py-2 text-xs font-semibold text-white shadow-xl dark:bg-[#F3F4F6] dark:text-[#111827]">
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
            showToast(`Compra em ${mkt} (${count} itens) salva no histórico!`)
          }
        />
      )}
    </div>
  );
}
