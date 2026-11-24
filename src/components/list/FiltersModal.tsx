import { X } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../../types/shopping';
import { useShoppingStore } from '../../store/useShoppingStore';
import { CategoryIcon } from '../common/CategoryIcon';

interface FiltersModalProps {
  onClose: () => void;
}

export function FiltersModal({ onClose }: FiltersModalProps) {
  const categoryFilter = useShoppingStore((s) => s.categoryFilter);
  const setCategoryFilter = useShoppingStore((s) => s.setCategoryFilter);
  const showCheckedItems = useShoppingStore((s) => s.showCheckedItems);
  const setShowCheckedItems = useShoppingStore((s) => s.setShowCheckedItems);
  const items = useShoppingStore((s) => s.items);

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
          <h2 className="text-base font-bold text-[#111827] dark:text-[#F3F4F6]">
            Filtros da Lista
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#F3F4F6] px-4 py-3 dark:bg-[#181B20]">
          <div>
            <p className="text-sm font-semibold text-[#111827] dark:text-[#F3F4F6]">
              Mostrar itens no carrinho
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Exibir itens já marcados durante a compra
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCheckedItems(!showCheckedItems)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              showCheckedItems
                ? 'bg-[#00C853]'
                : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
                showCheckedItems ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
          Filtrar por categoria
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(null);
              onClose();
            }}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
              categoryFilter === null
                ? 'border-[#00C853] bg-[#00C853]/12 text-[#00C853]'
                : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#111827] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]'
            }`}
          >
            <span>Todas</span>
            <span className="opacity-70">{items.length}</span>
          </button>

          {PRODUCT_CATEGORIES.map((cat) => {
            const count = items.filter((i) => i.category === cat.id).length;
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(active ? null : cat.id);
                  onClose();
                }}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                  active
                    ? 'border-[#00C853] bg-[#00C853]/12 text-[#00C853]'
                    : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#111827] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <CategoryIcon category={cat.id} size={15} />
                  <span className="truncate">{cat.label}</span>
                </span>
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
