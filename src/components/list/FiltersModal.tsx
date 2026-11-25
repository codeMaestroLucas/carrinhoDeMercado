import { X } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../../types/shopping';
import { useShoppingStore } from '../../store/useShoppingStore';
import { CategoryDot, CategoryIcon } from '../common/CategoryIcon';

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 pb-8 shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
            Filtros da lista
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar filtros"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Mostrar itens no carrinho
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Exibir itens já marcados durante a compra
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCheckedItems(!showCheckedItems)}
            aria-label="Alternar exibição de itens marcados"
            className={`relative h-7 w-12 rounded-full transition-colors duration-150 ease-ui ${
              showCheckedItems
                ? 'bg-[var(--positive)]'
                : 'bg-[var(--bg-subtle)] ring-1 ring-[var(--border-subtle)]'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-150 ease-ui ${
                showCheckedItems ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <p className="mb-2.5 text-xs font-semibold text-[var(--text-secondary)]">
          Filtrar por categoria
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(null);
              onClose();
            }}
            className={`flex h-11 items-center justify-between rounded-2xl border px-3.5 text-left text-xs font-semibold transition-colors duration-150 ease-ui ${
              categoryFilter === null
                ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_2px_8px_rgba(25,128,66,0.2)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-app)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            <span>Todas</span>
            <span className="font-mono-tabular opacity-75">{items.length}</span>
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
                className={`flex h-11 items-center justify-between rounded-2xl border px-3.5 text-left text-xs font-semibold transition-colors duration-150 ease-ui ${
                  active
                    ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent-fg)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-app)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <CategoryDot category={cat.id} />
                  <CategoryIcon category={cat.id} size={15} />
                  <span className="truncate">{cat.label}</span>
                </span>
                <span className="font-mono-tabular ml-1 opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
