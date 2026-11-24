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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 pb-8 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-[var(--text-primary)]">
            Filtros da lista
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar filtros"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-3">
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
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--bg-subtle)] ring-1 ring-[var(--border-hairline)]'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-[var(--bg-surface)] shadow-2xs transition-transform duration-150 ease-ui ${
                showCheckedItems ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
          Filtrar por categoria
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(null);
              onClose();
            }}
            className={`flex h-10 items-center justify-between rounded-lg border px-3 text-left text-xs font-medium transition-colors duration-150 ease-ui ${
              categoryFilter === null
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-fg)]'
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
                className={`flex h-10 items-center justify-between rounded-lg border px-3 text-left text-xs font-medium transition-colors duration-150 ease-ui ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-fg)]'
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
