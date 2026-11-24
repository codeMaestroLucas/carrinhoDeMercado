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
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 pb-8 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PiggyBank size={18} strokeWidth={1.5} className="text-[var(--accent-fg)]" />
            <div>
              <h2 className="text-base font-medium text-[var(--text-primary)]">
                Guia de economia
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Onde cada item da sua lista sai mais barato
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar guia"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.market.id}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  {group.market.name}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMarket(group.market.id);
                    onClose();
                  }}
                  className="h-8 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors duration-150 ease-ui hover:bg-[var(--accent-hover)]"
                >
                  Organizar corredores
                </button>
              </div>
              <div className="space-y-1.5">
                {group.bargains.map((b) => (
                  <div
                    key={b.item.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-[var(--text-primary)]">
                      {b.item.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-medium text-[var(--accent-fg)]">
                        {AppFormatters.formatCurrency(b.cheapestPrice)}
                      </span>
                      {b.savingsPercent >= 1 && (
                        <span className="font-mono-tabular rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent-fg)]">
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
