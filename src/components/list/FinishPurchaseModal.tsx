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
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl dark:bg-[#1E2229] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853]/12 text-[#00C853]">
              <CheckCircle2 size={20} />
            </div>
            <h2 className="text-base font-bold text-[#111827] dark:text-[#F3F4F6]">
              Finalizar Compra
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
              Onde você realizou esta compra?
            </label>
            <select
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3.5 py-2.5 text-sm font-medium text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
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
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-40 ${
                onlyChecked
                  ? 'border-[#00C853] bg-[#00C853]/12 text-[#00C853]'
                  : 'border-[#E5E7EB] text-[#6B7280] dark:border-[#2E3440] dark:text-[#9CA3AF]'
              }`}
            >
              Só no carrinho ({checkedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyChecked(false)}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                !onlyChecked
                  ? 'border-[#00C853] bg-[#00C853]/12 text-[#00C853]'
                  : 'border-[#E5E7EB] text-[#6B7280] dark:border-[#2E3440] dark:text-[#9CA3AF]'
              }`}
            >
              Lista inteira ({items.length})
            </button>
          </div>

          <div className="rounded-2xl bg-[#F3F4F6] p-3.5 dark:bg-[#181B20]">
            <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              <span>Itens salvos no histórico</span>
              <span className="font-bold text-[#111827] dark:text-[#F3F4F6]">
                {targetItems.length}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
              <span>Total da compra</span>
              <span className="text-[#00C853]">
                {AppFormatters.formatCurrency(total)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={targetItems.length === 0}
            onClick={handleConfirm}
            className="w-full rounded-xl bg-[#00C853] py-3 text-sm font-bold text-white shadow-sm transition active:scale-98 disabled:opacity-40"
          >
            Salvar no Histórico
          </button>
        </div>
      </div>
    </div>
  );
}
