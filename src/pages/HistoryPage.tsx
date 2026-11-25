import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  GitCompareArrows,
  QrCode,
  ReceiptText,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  getPurchaseRecordTotal,
  type PurchaseRecord,
} from '../types/shopping';
import { useShoppingStore } from '../store/useShoppingStore';
import {
  buildAllProductAggregates,
  type ProductHistoryAggregate,
} from '../services/productHistoryService';
import { AppFormatters } from '../utils/formatters';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { ThemeToggleButton } from '../components/layout/ThemeToggleButton';
import { ReceiptImportModal } from '../components/history/ReceiptImportModal';
import { ProductAnalyticsModal } from '../components/history/ProductAnalyticsModal';
import { ProductComparisonModal } from '../components/history/ProductComparisonModal';

interface HistoryPageProps {
  autoOpenScanner?: boolean;
  onScannerOpened?: () => void;
  onNavigateToList?: () => void;
}

export function HistoryPage({
  autoOpenScanner,
  onScannerOpened,
  onNavigateToList,
}: HistoryPageProps) {
  const history = useShoppingStore((s) => s.history);
  const deletePurchaseRecord = useShoppingStore((s) => s.deletePurchaseRecord);
  const addSingleItem = useShoppingStore((s) => s.addSingleItem);

  const [marketFilter, setMarketFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedAggregate, setSelectedAggregate] =
    useState<ProductHistoryAggregate | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenScanner) {
      setShowImportModal(true);
      onScannerOpened?.();
    }
  }, [autoOpenScanner, onScannerOpened]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const marketNames = useMemo(() => {
    const names = new Set<string>();
    history.forEach((r) => names.add(r.marketName));
    return Array.from(names).sort();
  }, [history]);

  const filteredRecords = useMemo(() => {
    if (!marketFilter) return history;
    return history.filter((r) => r.marketName === marketFilter);
  }, [history, marketFilter]);

  const summaryStats = useMemo(() => {
    const totalSpent = filteredRecords.reduce(
      (sum, rec) => sum + getPurchaseRecordTotal(rec),
      0,
    );
    const avgTicket =
      filteredRecords.length > 0 ? totalSpent / filteredRecords.length : 0;
    return {
      totalSpent,
      avgTicket,
      count: filteredRecords.length,
    };
  }, [filteredRecords]);

  const allAggregates = useMemo(
    () => buildAllProductAggregates(history),
    [history],
  );

  const handleReusePurchase = (record: PurchaseRecord) => {
    let added = 0;
    for (const item of record.items) {
      const res = addSingleItem(item.name, {
        category: item.category,
        marketId: record.marketId,
        price: item.unitPrice ?? item.price,
        quantity: Math.max(1, Math.round(item.quantity)),
        unit: item.unit,
      });
      if (res) added++;
    }
    showToast(
      added > 0
        ? `${added} ${added === 1 ? 'item adicionado' : 'itens adicionados'} à lista`
        : 'Todos os itens desta compra já estavam na lista',
    );
    if (added > 0 && onNavigateToList) {
      setTimeout(onNavigateToList, 700);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-28 pt-safe md:pb-16">
      {/* Page Header Band */}
      <section className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Histórico &amp; Notas
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              <span className="font-mono-tabular">{history.length}</span>{' '}
              {history.length === 1
                ? 'compra registrada'
                : 'compras registradas'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allAggregates.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                aria-label="Comparar produtos"
                className="btn-secondary h-10 w-10 p-0 sm:w-auto sm:px-4 text-xs sm:text-sm"
              >
                <GitCompareArrows size={16} strokeWidth={1.8} />
                <span className="hidden sm:inline">Comparar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="btn-primary h-10 px-4 text-xs sm:px-5 sm:text-sm"
            >
              <QrCode size={16} strokeWidth={1.9} />
              <span>Ler cupom</span>
            </button>
            <div className="md:hidden">
              <ThemeToggleButton />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-5 px-4 pt-6 animate-enter sm:px-6 lg:px-8">
        {/* Market Filter Rail */}
        {marketNames.length > 1 && (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMarketFilter('')}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-[background-color,color,border-color,box-shadow] duration-150 ease-ui ${
                !marketFilter
                  ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_2px_10px_rgba(25,128,66,0.22)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              Todos
            </button>
            {marketNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setMarketFilter(name)}
                className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-[background-color,color,border-color,box-shadow] duration-150 ease-ui ${
                  marketFilter === name
                    ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_2px_10px_rgba(25,128,66,0.22)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Summary KPI Strip */}
        {filteredRecords.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="surface-card p-4 sm:p-5">
              <p className="text-xs text-[var(--text-muted)]">Total acumulado</p>
              <p className="font-mono-tabular mt-1 text-lg font-semibold text-[var(--text-primary)] sm:text-2xl">
                {AppFormatters.formatCurrency(summaryStats.totalSpent)}
              </p>
            </div>
            <div className="surface-card p-4 sm:p-5">
              <p className="text-xs text-[var(--text-muted)]">Ticket médio</p>
              <p className="font-mono-tabular mt-1 text-lg font-semibold text-[var(--text-primary)] sm:text-2xl">
                {AppFormatters.formatCurrency(summaryStats.avgTicket)}
              </p>
            </div>
            <div className="surface-card p-4 sm:p-5">
              <p className="text-xs text-[var(--text-muted)]">Notas salvas</p>
              <p className="font-mono-tabular mt-1 text-lg font-semibold text-[var(--accent-fg)] sm:text-2xl">
                {summaryStats.count}
              </p>
            </div>
          </div>
        )}

        {/* Receipt Ledger List */}
        {filteredRecords.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <ReceiptText size={24} strokeWidth={1.6} />
            </div>
            <h2 className="font-display mt-5 text-xl font-semibold text-[var(--text-primary)]">
              Nenhuma compra registrada
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
              Finalize uma lista ou escaneie o QR Code de uma nota fiscal (NFC-e)
              para alimentar seu histórico de preços
            </p>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="btn-primary mt-5 h-11 px-5 text-sm"
            >
              <QrCode size={17} strokeWidth={1.9} />
              Importar cupom fiscal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
              const isOpen = expandedId === record.id;
              const total = getPurchaseRecordTotal(record);

              return (
                <article
                  key={record.id}
                  className="surface-card card-interactive overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : record.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 ease-ui hover:bg-[var(--bg-app)]/60"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] text-[var(--text-secondary)]">
                        <ReceiptText size={19} strokeWidth={1.7} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display truncate text-base font-semibold text-[var(--text-primary)]">
                          {record.marketName}
                        </p>
                        <p className="font-mono-tabular mt-0.5 text-xs text-[var(--text-muted)]">
                          {AppFormatters.formatDate(record.date)} ·{' '}
                          {record.items.length}{' '}
                          {record.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono-tabular text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                        {AppFormatters.formatCurrency(total)}
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]">
                        <ChevronDown
                          size={17}
                          strokeWidth={1.9}
                          className={`transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </div>
                  </button>

                  <div className="accordion-grid" data-open={isOpen}>
                    <div className="accordion-inner">
                      <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-app)] px-5 py-4">
                        <div className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                          {record.items.map((item, idx) => {
                            const matchingAgg = allAggregates.find((agg) =>
                              agg.occurrences.some(
                                (occ) => occ.productName === item.name,
                              ),
                            );
                            return (
                              <button
                                key={`${item.name}_${idx}`}
                                type="button"
                                onClick={() => {
                                  if (matchingAgg) {
                                    setSelectedAggregate(matchingAgg);
                                  }
                                }}
                                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors duration-150 ease-ui first:rounded-t-2xl last:rounded-b-2xl hover:bg-[var(--bg-app)]"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <CategoryIcon category={item.category} size={16} />
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-[var(--text-primary)]">
                                      {item.name}
                                    </p>
                                    <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
                                      {AppFormatters.formatQuantity(
                                        item.quantity,
                                        item.unit,
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <span className="font-mono-tabular ml-3 shrink-0 font-semibold text-[var(--text-primary)]">
                                  {AppFormatters.formatCurrency(item.price)}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleReusePurchase(record)}
                            className="btn-secondary h-11 flex-1 text-xs font-semibold text-[var(--positive)]"
                          >
                            <RotateCcw size={15} strokeWidth={1.8} />
                            Reaproveitar na lista
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deletePurchaseRecord(record.id);
                              showToast('Compra removida do histórico');
                            }}
                            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 text-xs font-semibold text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)] active:scale-[0.97]"
                          >
                            <Trash2 size={15} strokeWidth={1.8} />
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {toastMsg && (
        <div className="apple-glass-strong fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-float)] md:bottom-8">
          {toastMsg}
        </div>
      )}

      {showImportModal && (
        <ReceiptImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(mkt, count) =>
            showToast(`Compra em ${mkt} (${count} itens) importada`)
          }
        />
      )}

      {selectedAggregate && (
        <ProductAnalyticsModal
          aggregate={selectedAggregate}
          allAggregates={allAggregates}
          onClose={() => setSelectedAggregate(null)}
        />
      )}

      {showCompare && (
        <ProductComparisonModal
          allAggregates={allAggregates}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
