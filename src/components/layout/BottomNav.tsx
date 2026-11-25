import { Home, ListTodo, ReceiptText, SlidersHorizontal } from 'lucide-react';
import { ThemeToggleButton } from './ThemeToggleButton';

export type AppTab = 'home' | 'list' | 'history' | 'config';

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  pendingCount: number;
}

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0 shadow-[0_2px_8px_rgba(25,128,66,0.28)] rounded-[9px]"
      >
        <defs>
          <linearGradient id="appleGreenAppIcon" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2CC567" />
            <stop offset="100%" stopColor="#167A3E" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#appleGreenAppIcon)" />
        <path
          d="M10 13.5H22L20.5 21.1C20.32 21.95 19.58 22.5 18.72 22.5H13.28C12.42 22.5 11.68 21.95 11.5 21.1L10 13.5Z"
          stroke="#FFFFFF"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M13 13.5V11.6C13 9.95 14.34 8.6 16 8.6C17.66 8.6 19 9.95 19 11.6V13.5"
          stroke="#FFFFFF"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
        Carrinho
      </span>
    </span>
  );
}

export function BottomNav({
  activeTab,
  onChangeTab,
  pendingCount,
}: BottomNavProps) {
  const tabs: Array<{
    id: AppTab;
    label: string;
    shortLabel: string;
    icon: typeof Home;
    badge?: number;
  }> = [
    { id: 'home', label: 'Início', shortLabel: 'Início', icon: Home },
    {
      id: 'list',
      label: 'Lista',
      shortLabel: 'Lista',
      icon: ListTodo,
      badge: pendingCount,
    },
    {
      id: 'history',
      label: 'Histórico',
      shortLabel: 'Histórico',
      icon: ReceiptText,
    },
    {
      id: 'config',
      label: 'Ajustes',
      shortLabel: 'Ajustes',
      icon: SlidersHorizontal,
    },
  ];

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab),
  );

  return (
    <>
      {/* Desktop Frosted Apple Top Navigation Bar (md+) */}
      <header className="apple-glass fixed inset-x-0 top-0 z-30 hidden h-[64px] border-b border-[var(--border-hairline)] md:block">
        <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-6 px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onChangeTab('list')}
            className="flex items-center rounded-xl py-1 text-left transition-opacity hover:opacity-85 active:scale-[0.98]"
            aria-label="Ir para Lista de Compras"
          >
            <BrandMark />
          </button>

          {/* Apple Segmented Navigation Pill with GPU-only transform sliding indicator */}
          <nav
            aria-label="Navegação principal desktop"
            className="segmented-track grid grid-cols-4"
            style={{ width: '408px' }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%-6px)/4)] rounded-full bg-[var(--bg-surface)] shadow-[var(--shadow-pill)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            />
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onChangeTab(tab.id)}
                  className={`segmented-item flex h-9 items-center justify-center gap-1.5 px-3 text-[13px] ${
                    active ? 'font-semibold text-[var(--accent-fg)]' : ''
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge != null && tab.badge > 0 && (
                    <span
                      className={`font-mono-tabular inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold transition-colors duration-150 ${
                        active
                          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                          : 'bg-[var(--accent-soft)] text-[var(--accent-fg)]'
                      }`}
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      {/* Mobile Frosted Apple Bottom Tab Bar (< md) */}
      <nav
        aria-label="Navegação principal"
        className="apple-glass-strong fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-hairline)] pb-safe md:hidden"
      >
        <div className="mx-auto flex h-[64px] max-w-xl items-center justify-around px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onChangeTab(tab.id)}
                className={`group relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 transition-[color,transform] duration-150 ease-ui active:scale-95 ${
                  active
                    ? 'text-[var(--accent-fg)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div
                  className={`relative flex h-7 w-13 items-center justify-center rounded-full transition-colors duration-150 ease-ui ${
                    active ? 'bg-[var(--accent-soft)]' : ''
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.1 : 1.7} />
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="font-mono-tabular absolute -top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold leading-none text-[var(--accent-ink)]">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] leading-4 ${
                    active
                      ? 'font-semibold text-[var(--accent-fg)]'
                      : 'font-medium text-[var(--text-muted)]'
                  }`}
                >
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
