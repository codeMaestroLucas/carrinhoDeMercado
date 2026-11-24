import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
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
    <div className="min-h-screen bg-[var(--bg-app)] pb-24 pt-safe">
      <header className="sticky top-0 z-20 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
              Histórico &amp; Notas
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
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
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--text-primary)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--bg-app)] active:scale-[0.98]"
              >
                <GitCompareArrows size={17} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              <QrCode size={16} strokeWidth={1.5} />
              <span>Ler cupom</span>
            </button>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4 animate-enter">
        {marketNames.length > 1 && (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMarketFilter('')}
              className={`h-8 shrink-0 rounded-lg border px-3 text-xs font-medium transition-[background-color,color,border-color] duration-150 ease-ui ${
                !marketFilter
                  ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-app)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              Todos
            </button>
            {marketNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setMarketFilter(name)}
                className={`h-8 shrink-0 rounded-lg border px-3 text-xs font-medium transition-[background-color,color,border-color] duration-150 ease-ui ${
                  marketFilter === name
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-app)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
              <ReceiptText size={22} strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-base font-medium text-[var(--text-primary)]">
              Nenhuma compra no histórico
            </h2>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--text-secondary)]">
              Importe seu cupom fiscal via QR Code da NFC-e, foto ou finalize uma lista de compras
            </p>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-xs font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              <QrCode size={16} strokeWidth={1.5} />
              Importar cupom fiscal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
              const isOpen = expandedId === record.id;
              const total = getPurchaseRecordTotal(record);

              return (
                <div
                  key={record.id}
                  className="overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : record.id)}
                    className="flex w-full items-center justify-between p-4 text-left transition-colors duration-150 ease-ui hover:bg-[var(--bg-app)]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {record.marketName}
                      </p>
                      <p className="mt-0.5 font-mono-tabular text-xs text-[var(--text-muted)]">
                        {AppFormatters.formatDate(record.date)} ·{' '}
                        {record.items.length}{' '}
                        {record.items.length === 1 ? 'item' : 'itens'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-sm font-medium text-[var(--accent-fg)]">
                        {AppFormatters.formatCurrency(total)}
                      </span>
                      {isOpen ? (
                        <ChevronUp size={18} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown size={18} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-app)] p-4">
                      <div className="space-y-2">
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
                              className="flex w-full items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2.5 text-left text-xs transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
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
                              <span className="font-mono-tabular ml-2 shrink-0 font-medium text-[var(--text-primary)]">
                                {AppFormatters.formatCurrency(item.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReusePurchase(record)}
                          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--accent-fg)] transition-colors duration-150 ease-ui hover:bg-[var(--accent-soft)]"
                        >
                          <RotateCcw size={15} strokeWidth={1.5} />
                          Reaproveitar na lista
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deletePurchaseRecord(record.id);
                            showToast('Compra removida do histórico');
                          }}
                          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--border-hairline)] bg-[var(--text-primary)] px-4 py-2 text-xs font-medium text-[var(--bg-app)] shadow-lg">
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
