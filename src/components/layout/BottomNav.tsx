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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-md pb-safe dark:border-[#282D37] dark:bg-[#1E2229]/95"
    >
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                active
                  ? 'text-[#00C853]'
                  : 'text-[#6B7280] hover:text-[#111827] dark:text-[#9CA3AF] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <div
                className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? 'bg-[#00C853]/12' : ''
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                {tab.badge != null && tab.badge > 0 && (
                  <span className="absolute -top-0.5 right-2 flex min-w-[18px] items-center justify-center rounded-full bg-[#00C853] px-1 text-[10px] font-bold leading-4 text-white">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] ${
                  active ? 'font-bold' : 'font-medium'
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
