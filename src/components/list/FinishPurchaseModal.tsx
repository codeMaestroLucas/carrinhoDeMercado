import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useShoppingStore } from '../../store/useShoppingStore';
import { AppFormatters } from '../../utils/formatters';
import { getEffectiveTotalAmount } from '../../types/shopping';

interface FinishPurchaseModalProps {
  onClose: () => void;
  onFinished: (marketName: string, count: number) => void;
}

export function FinishPurchaseModal({
  onClose,
  onFinished,
}: FinishPurchaseModalProps) {
  const markets = useShoppingStore((s) => s.markets);
  const selectedMarketId = useShoppingStore((s) => s.selectedMarketId);
  const items = useShoppingStore((s) => s.items);
  const finishPurchase = useShoppingStore((s) => s.finishPurchase);

  const checkedItems = items.filter((i) => i.isChecked);
  const [marketId, setMarketId] = useState(selectedMarketId);
  const [onlyChecked, setOnlyChecked] = useState(checkedItems.length > 0);

  const targetItems = onlyChecked ? checkedItems : items;
  const total = targetItems.reduce(
    (sum, item) => sum + getEffectiveTotalAmount(item),
    0,
  );

  const handleConfirm = () => {
    const rec = finishPurchase({ marketId, onlyChecked });
    if (rec) {
      onFinished(rec.marketName, rec.items.length);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 pb-8 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} strokeWidth={1.5} className="text-[var(--accent-fg)]" />
            <h2 className="text-base font-medium text-[var(--text-primary)]">
              Finalizar compra
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Onde você realizou esta compra?
            </label>
            <select
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={checkedItems.length === 0}
              onClick={() => setOnlyChecked(true)}
              className={`h-9 flex-1 rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ease-ui disabled:opacity-40 ${
                onlyChecked
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-fg)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-app)] text-[var(--text-secondary)]'
              }`}
            >
              Só no carrinho (<span className="font-mono-tabular">{checkedItems.length}</span>)
            </button>
            <button
              type="button"
              onClick={() => setOnlyChecked(false)}
              className={`h-9 flex-1 rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ease-ui ${
                !onlyChecked
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-fg)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-app)] text-[var(--text-secondary)]'
              }`}
            >
              Lista inteira (<span className="font-mono-tabular">{items.length}</span>)
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Itens salvos no histórico</span>
              <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                {targetItems.length}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm font-medium text-[var(--text-primary)]">
              <span>Total da compra</span>
              <span className="font-mono-tabular text-[var(--accent-fg)]">
                {AppFormatters.formatCurrency(total)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={targetItems.length === 0}
            onClick={handleConfirm}
            className="h-10 w-full rounded-lg bg-[var(--accent)] text-sm font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-40"
          >
            Salvar no histórico
          </button>
        </div>
      </div>
    </div>
  );
}
