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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in w-full max-w-md rounded-t-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 pb-8 shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
              <CheckCircle2 size={20} strokeWidth={1.9} />
            </div>
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Finalizar compra
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              Onde você realizou esta compra?
            </label>
            <select
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="segmented-track grid w-full grid-cols-2">
            <button
              type="button"
              disabled={checkedItems.length === 0}
              onClick={() => setOnlyChecked(true)}
              className={`segmented-item h-9 px-3 text-xs disabled:opacity-40 ${
                onlyChecked
                  ? 'segmented-item-active text-[var(--accent-fg)]'
                  : ''
              }`}
            >
              Só no carrinho (
              <span className="font-mono-tabular">{checkedItems.length}</span>)
            </button>
            <button
              type="button"
              onClick={() => setOnlyChecked(false)}
              className={`segmented-item h-9 px-3 text-xs ${
                !onlyChecked
                  ? 'segmented-item-active text-[var(--accent-fg)]'
                  : ''
              }`}
            >
              Lista inteira (
              <span className="font-mono-tabular">{items.length}</span>)
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Itens salvos no histórico</span>
              <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                {targetItems.length}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5 text-sm font-semibold text-[var(--text-primary)]">
              <span>Total da compra</span>
              <span className="font-mono-tabular text-lg text-[var(--positive)]">
                {AppFormatters.formatCurrency(total)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={targetItems.length === 0}
            onClick={handleConfirm}
            className="btn-primary h-11 w-full text-sm disabled:opacity-40"
          >
            Salvar no histórico
          </button>
        </div>
      </div>
    </div>
  );
}
