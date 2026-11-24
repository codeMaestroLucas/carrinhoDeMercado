import { Home, ListTodo, ReceiptText, SlidersHorizontal } from 'lucide-react';

export type AppTab = 'home' | 'list' | 'history' | 'config';

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  pendingCount: number;
}

export function BottomNav({
  activeTab,
  onChangeTab,
  pendingCount,
}: BottomNavProps) {
  const tabs: Array<{
    id: AppTab;
    label: string;
    icon: typeof Home;
    badge?: number;
  }> = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'list', label: 'Lista', icon: ListTodo, badge: pendingCount },
    { id: 'history', label: 'Histórico', icon: ReceiptText },
    { id: 'config', label: 'Configurações', icon: SlidersHorizontal },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md pb-safe"
    >
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-[color,background-color] duration-150 ease-ui focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                active
                  ? 'text-[var(--accent-fg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div
                className={`relative flex h-7 w-12 items-center justify-center rounded-lg transition-[background-color] duration-150 ease-ui ${
                  active ? 'bg-[var(--accent-soft)]' : ''
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
                {tab.badge != null && tab.badge > 0 && (
                  <span className="font-mono-tabular absolute -top-1 right-0.5 rounded bg-[var(--bg-subtle)] px-1 text-[10px] font-medium leading-4 text-[var(--text-primary)] ring-1 ring-[var(--border-hairline)]">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-xs leading-4 ${
                  active ? 'font-medium' : 'font-normal'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
