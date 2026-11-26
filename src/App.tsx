import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useShoppingStore } from './store/useShoppingStore';
import { BottomNav, type AppTab } from './components/layout/BottomNav';
import { PullToRefresh } from './components/layout/PullToRefresh';
import { SplashScreen } from './components/layout/SplashScreen';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { MarketConfigPage } from './pages/MarketConfigPage';

export function App() {
  const isHydrated = useShoppingStore((s) => s.isHydrated);
  const isDarkMode = useShoppingStore((s) => s.isDarkMode);
  const items = useShoppingStore((s) => s.items);
  const initializeApp = useShoppingStore((s) => s.initializeApp);
  const refreshCloudSync = useShoppingStore((s) => s.refreshCloudSync);
  const flushPendingSync = useShoppingStore((s) => s.flushPendingSync);

  const [activeTab, setActiveTab] = useState<AppTab>('list');
  // Optimistic boot: if cached local state is present, skip splash completely (t=0 render)
  const [showSplash, setShowSplash] = useState(() => !isHydrated);
  const [autoFocusQuickAdd, setAutoFocusQuickAdd] = useState(false);
  const [autoOpenScanner, setAutoOpenScanner] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    void initializeApp();

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (isHydrated) {
      setShowSplash(false);
    } else {
      fallbackTimer = setTimeout(() => setShowSplash(false), 450);
    }

    // Handle PWA app shortcuts (?action=quick-add or ?action=scan-receipt)
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'quick-add') {
      setActiveTab('list');
      setAutoFocusQuickAdd(true);
      setShowSplash(false);
    } else if (action === 'scan-receipt') {
      setActiveTab('history');
      setAutoOpenScanner(true);
      setShowSplash(false);
    }

    const onOnline = () => {
      setIsOffline(false);
      void flushPendingSync().then(() => refreshCloudSync());
    };
    const onOffline = () => setIsOffline(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushPendingSync();
      } else if (document.visibilityState === 'visible') {
        void flushPendingSync().then(() => refreshCloudSync());
      }
    };
    const onPageHide = () => {
      void flushPendingSync();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [initializeApp, refreshCloudSync, flushPendingSync]);

  useEffect(() => {
    const root = document.documentElement;
    // Prevent cascading transition glitches across unrelated elements during theme swap
    root.classList.add('theme-switching');
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Force style recalculation while transitions are paused
    void root.offsetHeight;
    const raf = requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDarkMode ? '#0B0B0D' : '#F5F5F7');
    }

    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove('theme-switching');
    };
  }, [isDarkMode]);

  const pendingCount = items.filter((i) => !i.isChecked).length;

  const handlePullRefresh = async () => {
    if (needRefresh) {
      await updateServiceWorker(true);
      return;
    }
    await flushPendingSync();
    await refreshCloudSync();
  };

  return (
    <>
      {showSplash && (
        <SplashScreen onDismiss={() => setShowSplash(false)} />
      )}

      {isOffline && (
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--amber-soft)] px-4 py-1.5 text-xs font-medium text-[var(--amber)] md:top-[64px]">
          <WifiOff size={14} strokeWidth={1.8} />
          <span>Modo offline ativo — alterações salvas localmente</span>
        </div>
      )}

      {needRefresh && (
        <div className="apple-glass-strong fixed inset-x-4 top-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-primary)] shadow-[var(--shadow-float)] md:top-20">
          <span className="pl-1 font-medium">Nova versão disponível</span>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="btn-primary h-8 px-3.5 text-xs"
          >
            <RefreshCw size={13} strokeWidth={1.9} />
            Atualizar
          </button>
        </div>
      )}

      <main className="min-h-screen md:pt-[64px]">
        <PullToRefresh onRefresh={handlePullRefresh}>
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'list' && (
            <ShoppingListPage
              autoFocusQuickAdd={autoFocusQuickAdd}
              onQuickAddConsumed={() => setAutoFocusQuickAdd(false)}
            />
          )}
          {activeTab === 'history' && (
            <HistoryPage
              autoOpenScanner={autoOpenScanner}
              onScannerOpened={() => setAutoOpenScanner(false)}
              onNavigateToList={() => setActiveTab('list')}
            />
          )}
          {activeTab === 'config' && <MarketConfigPage />}
        </PullToRefresh>
      </main>

      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingCount={pendingCount}
      />
    </>
  );
}

export default App;
