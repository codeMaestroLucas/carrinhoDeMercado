import { PiggyBank, X } from 'lucide-react';
import type { MarketProfile, ShoppingItem } from '../../types/shopping';
import { AppFormatters } from '../../utils/formatters';

export interface MarketBargainItem {
  item: ShoppingItem;
  cheapestPrice: number;
  highestPrice: number;
  savingsPercent: number;
}

export interface MarketBargainGroup {
  market: MarketProfile;
  bargains: MarketBargainItem[];
}

interface MarketSavingsModalProps {
  groups: MarketBargainGroup[];
  onSelectMarket: (marketId: string) => void;
  onClose: () => void;
}

export function MarketSavingsModal({
  groups,
  onSelectMarket,
  onClose,
}: MarketSavingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl dark:bg-[#1E2229] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853]/12 text-[#00C853]">
              <PiggyBank size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827] dark:text-[#F3F4F6]">
                Guia de Economia
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Onde cada item da sua lista sai mais barato
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.market.id}
              className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 dark:border-[#2E3440] dark:bg-[#181B20]"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
                  {group.market.name}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMarket(group.market.id);
                    onClose();
                  }}
                  className="rounded-lg bg-[#00C853] px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  Organizar corredores
                </button>
              </div>
              <div className="space-y-1.5">
                {group.bargains.map((b) => (
                  <div
                    key={b.item.id}
                    className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs dark:bg-[#1E2229]"
                  >
                    <span className="font-semibold text-[#111827] dark:text-[#F3F4F6]">
                      {b.item.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#00C853]">
                        {AppFormatters.formatCurrency(b.cheapestPrice)}
                      </span>
                      {b.savingsPercent >= 1 && (
                        <span className="rounded-md bg-[#00C853]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#00C853]">
                          -{b.savingsPercent.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
