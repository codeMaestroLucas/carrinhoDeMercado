import { PiggyBank, X } from 'lucide-react';
import type { MarketBargainGroup } from '../../types/shopping';
import { AppFormatters } from '../../utils/formatters';
import { ModalShell } from '../common/ModalShell';

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
    <ModalShell
      onClose={onClose}
      ariaLabel="Guia de economia"
      panelClassName="max-h-[85vh] overflow-y-auto p-6 pb-8"
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
              <PiggyBank size={20} strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.market.id}
              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  {group.market.name}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMarket(group.market.id);
                    onClose();
                  }}
                  className="btn-primary h-8 px-3.5 text-xs"
                >
                  Organizar corredores
                </button>
              </div>
              <div className="space-y-2">
                {group.bargains.map((b) => (
                  <div
                    key={b.item.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-medium text-[var(--text-primary)]">
                      {b.item.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-semibold text-[var(--positive)]">
                        {AppFormatters.formatCurrency(b.cheapestPrice)}
                      </span>
                      {b.savingsPercent >= 1 && (
                        <span className="font-mono-tabular rounded-full bg-[var(--positive-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--positive)]">
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
    </ModalShell>
  );
}
