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
        ? `${added} item(ns) adicionado(s) à sua lista!`
        : 'Todos os itens desta compra já estavam na lista.',
    );
    if (added > 0 && onNavigateToList) {
      setTimeout(onNavigateToList, 700);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 pt-safe dark:bg-[#121417]">
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white/90 px-4 py-3.5 backdrop-blur-md dark:border-[#2E3440] dark:bg-[#1E2229]/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-[#111827] dark:text-[#F3F4F6]">
              Histórico &amp; Notas
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {history.length}{' '}
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] dark:border-[#2E3440] dark:bg-[#1E2229] dark:text-[#F3F4F6]"
              >
                <GitCompareArrows size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#00C853] px-3.5 text-xs font-bold text-white shadow-xs transition active:scale-95"
            >
              <QrCode size={15} />
              <span>Ler Cupom</span>
            </button>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {marketNames.length > 1 && (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMarketFilter('')}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                !marketFilter
                  ? 'bg-[#00C853] text-white'
                  : 'border border-[#E5E7EB] bg-white text-[#6B7280] dark:border-[#2E3440] dark:bg-[#1E2229] dark:text-[#9CA3AF]'
              }`}
            >
              Todos
            </button>
            {marketNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setMarketFilter(name)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                  marketFilter === name
                    ? 'bg-[#00C853] text-white'
                    : 'border border-[#E5E7EB] bg-white text-[#6B7280] dark:border-[#2E3440] dark:bg-[#1E2229] dark:text-[#9CA3AF]'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center dark:border-[#2E3440] dark:bg-[#1E2229]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00C853]/12 text-[#00C853]">
              <ReceiptText size={32} />
            </div>
            <h2 className="mt-4 text-base font-bold text-[#111827] dark:text-[#F3F4F6]">
              Nenhuma compra no histórico
            </h2>
            <p className="mt-1 max-w-xs text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Importe seu cupom fiscal via QR Code da NFC-e, foto ou finalize
              uma lista de compras.
            </p>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-[#00C853] px-4 py-2.5 text-xs font-bold text-white"
            >
              <QrCode size={16} />
              Importar Cupom Fiscal
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
                  className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : record.id)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                        {record.marketName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                        {AppFormatters.formatDate(record.date)} ·{' '}
                        {record.items.length}{' '}
                        {record.items.length === 1 ? 'item' : 'itens'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[#00C853]">
                        {AppFormatters.formatCurrency(total)}
                      </span>
                      {isOpen ? (
                        <ChevronUp size={18} className="text-[#6B7280]" />
                      ) : (
                        <ChevronDown size={18} className="text-[#6B7280]" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#E5E7EB] bg-[#F8F9FA] p-4 dark:border-[#2E3440] dark:bg-[#181B20]">
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
                              className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-xs transition hover:bg-black/[0.02] dark:bg-[#1E2229]"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <CategoryIcon category={item.category} size={14} />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-[#111827] dark:text-[#F3F4F6]">
                                    {item.name}
                                  </p>
                                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                                    {AppFormatters.formatQuantity(
                                      item.quantity,
                                      item.unit,
                                    )}
                                  </p>
                                </div>
                              </div>
                              <span className="ml-2 shrink-0 font-bold text-[#111827] dark:text-[#F3F4F6]">
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
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#00C853]/12 py-2 text-xs font-bold text-[#00C853]"
                        >
                          <RotateCcw size={14} />
                          Reaproveitar na Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deletePurchaseRecord(record.id);
                            showToast('Compra removida do histórico.');
                          }}
                          className="flex items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={14} />
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
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#111827] px-4 py-2 text-xs font-semibold text-white shadow-xl dark:bg-[#F3F4F6] dark:text-[#111827]">
          {toastMsg}
        </div>
      )}

      {showImportModal && (
        <ReceiptImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(mkt, count) =>
            showToast(`Compra em ${mkt} (${count} itens) importada!`)
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
