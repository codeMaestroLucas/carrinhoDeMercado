import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  ClipboardPaste,
  Cloud,
  CloudOff,
  Minus,
  PiggyBank,
  Plus,
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
  const clearCheckedItems = useShoppingStore((s) => s.clearCheckedItems);
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
      {/* Stylized Top Banner */}
      <div className="relative h-52 w-full overflow-hidden pt-safe">
        <img
          src="/assets/ListTop.jpg"
          alt="Mercado"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-[#F8F9FA] dark:to-[#121417]" />

        {/* Top action buttons */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4 pt-safe">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
              <ShoppingCart size={14} className="text-[#00C853]" />
              <span>{items.length} itens</span>
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
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md"
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
                className="flex h-10 items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-3 text-xs font-semibold text-white backdrop-blur-md transition active:scale-95"
              >
                <Trash2 size={14} />
                <span>Limpar ({checkedCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label="Filtros"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md transition active:scale-95"
            >
              <SlidersHorizontal size={17} />
              {(categoryFilter || !showCheckedItems) && (
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#00C853]" />
              )}
            </button>
            <ThemeToggleButton variant="glass" />
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Lista de Compras
          </h1>
          <p className="text-xs font-medium text-white/85 drop-shadow-xs">
            Itens organizados na ordem de setores de {selectedMarket.name}
          </p>
        </div>
      </div>

      <PwaInstallBanner />

      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-3">
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
                <Store size={13} />
                <span>{m.name}</span>
              </button>
            );
          })}
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

        {/* Quick Add / Paste List Bar */}
        <form onSubmit={handleAddSubmit} className="relative">
          <div className="flex items-end gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-xs focus-within:border-[#00C853] dark:border-[#2E3440] dark:bg-[#1E2229]">
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
              placeholder="Adicionar item (ex: 2kg Arroz) ou colar lista..."
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[#111827] placeholder-[#6B7280] outline-none dark:text-[#F3F4F6] dark:placeholder-[#9CA3AF]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#00C853] px-3.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40"
            >
              {detectedBulkItems.length > 1 ? (
                <>
                  <ClipboardPaste size={15} />
                  <span>Colar ({detectedBulkItems.length})</span>
                </>
              ) : (
                <>
                  <Plus size={17} />
                  <span>Adicionar</span>
                </>
              )}
            </button>
          </div>

          {/* Autocomplete suggestions */}
          {historicalSuggestions.length > 0 && (
            <div className="mt-1.5 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-lg dark:border-[#2E3440] dark:bg-[#1E2229]">
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
          <div className="space-y-2">
            {filteredAndSortedItems.map((item) => {
              const catInfo = PRODUCT_CATEGORY_MAP[item.category];
              const total = getEffectiveTotalAmount(item);
              const bestRec = recommendCheapestMarketForProduct(item.name);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                    item.isChecked
                      ? 'border-[#E5E7EB]/70 bg-white/60 opacity-65 dark:border-[#2E3440]/60 dark:bg-[#1E2229]/60'
                      : 'border-[#E5E7EB] bg-white shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleItemChecked(item.id)}
                    aria-label={
                      item.isChecked
                        ? `Desmarcar ${item.name}`
                        : `Marcar ${item.name}`
                    }
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                      item.isChecked
                        ? 'border-[#00C853] bg-[#00C853] text-white'
                        : 'border-[#D1D5DB] dark:border-[#4B5563]'
                    }`}
                  >
                    {item.isChecked && <Check size={14} strokeWidth={3} />}
                  </button>

                  {/* Item Info (tappable to edit) */}
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: catInfo.color }}
                      />
                      <span
                        className={`truncate text-sm font-bold ${
                          item.isChecked
                            ? 'text-[#6B7280] line-through dark:text-[#9CA3AF]'
                            : 'text-[#111827] dark:text-[#F3F4F6]'
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                      <span>{catInfo.label}</span>
                      {total > 0 ? (
                        <span className="font-bold text-[#00C853]">
                          · {AppFormatters.formatCurrency(total)}
                        </span>
                      ) : (
                        <span className="text-[#10B981]">· Informar preço</span>
                      )}
                      {bestRec && (
                        <span className="rounded-md bg-[#00C853]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#00C853]">
                          + barato: {bestRec.market.name}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Quantity Stepper */}
                  <div className="flex shrink-0 items-center gap-1 rounded-xl bg-[#F3F4F6] p-1 dark:bg-[#181B20]">
                    <button
                      type="button"
                      onClick={() =>
                        updateItemQuantity(
                          item.id,
                          Math.max(1, item.quantity - 1),
                        )
                      }
                      aria-label="Diminuir quantidade"
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[#6B7280] hover:bg-white dark:text-[#9CA3AF] dark:hover:bg-[#1E2229]"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="min-w-[36px] text-center text-[11px] font-bold text-[#111827] dark:text-[#F3F4F6]">
                      {item.quantity} {item.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateItemQuantity(item.id, item.quantity + 1)
                      }
                      aria-label="Aumentar quantidade"
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[#6B7280] hover:bg-white dark:text-[#9CA3AF] dark:hover:bg-[#1E2229]"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Summary & Finish Purchase Bar */}
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-2xl px-4 pb-safe">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-md dark:border-[#2E3440] dark:bg-[#1E2229]/95">
            <div>
              <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                No carrinho:{' '}
                <strong className="text-[#00C853]">
                  {AppFormatters.formatCurrency(checkedTotal)}
                </strong>
              </p>
              <p className="text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                Total estimado: {AppFormatters.formatCurrency(totalEstimated)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFinish(true)}
              className="rounded-xl bg-[#00C853] px-4 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95"
            >
              Finalizar Compra
            </button>
          </div>
        </div>
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
