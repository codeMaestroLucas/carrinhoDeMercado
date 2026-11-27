import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPersistedSessionSync,
  loadPersistedStateSync,
  type PersistedAppState,
} from '../src/services/storageService';
import {
  buildHomeSnapshot,
  loadHomeSnapshotSync,
  saveHomeSnapshot,
} from '../src/services/homeSnapshotService';
import { useShoppingStore } from '../src/store/useShoppingStore';
import { CloudSyncService } from '../src/services/cloudSyncService';
import type { PurchaseRecord, MarketProfile } from '../src/types/shopping';

describe('PWA Performance & High-Speed Initialization Architecture', () => {
  const storeMap = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storeMap.get(key) ?? null,
    setItem: (key: string, val: string) => {
      storeMap.set(key, String(val));
    },
    removeItem: (key: string) => {
      storeMap.delete(key);
    },
    clear: () => {
      storeMap.clear();
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storeMap.clear();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  });

  describe('1. Optimistic Auth & Boot (t=0 render)', () => {
    it('synchronously reads cached session and state from localStorage at t=0', () => {
      const mockState: PersistedAppState = {
        clientId: 'client_perf_test',
        sharedSpaceCode: 'CASA-9999',
        isDarkMode: true,
        items: [{ id: 'item_1', name: 'Leite', isChecked: false, category: 'alimentos', quantity: 1, unit: 'un' }],
        hasPendingCloudPush: false,
      };

      window.localStorage.setItem('carrinhocompras_pwa_state_v1', JSON.stringify(mockState));

      const syncLoaded = loadPersistedStateSync();
      expect(syncLoaded).not.toBeNull();
      expect(syncLoaded?.sharedSpaceCode).toBe('CASA-9999');
      expect(syncLoaded?.isDarkMode).toBe(true);
      expect(syncLoaded?.items?.length).toBe(1);
    });

    it('clears invalid credentials and reverts to local mode when session expires or 401 occurs', () => {
      const mockState: PersistedAppState = {
        clientId: 'client_perf_test',
        sharedSpaceCode: 'EXPIRED-SESSION',
        hasPendingCloudPush: true,
      };
      window.localStorage.setItem('carrinhocompras_pwa_state_v1', JSON.stringify(mockState));

      clearPersistedSessionSync();

      const updated = loadPersistedStateSync();
      expect(updated?.sharedSpaceCode).toBeNull();
      expect(updated?.hasPendingCloudPush).toBe(false);
    });

    it('handles background 401 / permission-denied without crashing or blocking the UI', async () => {
      vi.spyOn(CloudSyncService, 'initializeFirebase').mockReturnValue(true);
      vi.spyOn(CloudSyncService, 'fetchSharedSpace').mockRejectedValue(
        new Error('permission-denied: Usuário não tem permissão de leitura.'),
      );

      useShoppingStore.setState({
        sharedSpaceCode: 'INV-401',
        isSyncingCloud: false,
        cloudError: null,
      });

      await useShoppingStore.getState().validateAndSyncInBackground('INV-401');

      // State should be smoothly reset to local mode with a clear user notice
      expect(useShoppingStore.getState().sharedSpaceCode).toBeNull();
      expect(useShoppingStore.getState().cloudError).toContain('Sessão expirada ou sem permissão');
      expect(useShoppingStore.getState().isSyncingCloud).toBe(false);
    });
  });

  describe('2. Stale-While-Revalidate Home Snapshot', () => {
    it('creates and saves a lightweight home snapshot correctly', () => {
      const mockHistory: PurchaseRecord[] = [
        {
          id: 'rec_1',
          marketId: 'mercado_padrao',
          marketName: 'Supermercado Central',
          date: new Date().toISOString(),
          items: [
            {
              name: 'Arroz 5kg',
              price: 25.0,
              quantity: 1,
              category: 'alimentos',
              unit: 'un',
            },
            {
              name: 'Detergente Ypê',
              price: 3.5,
              quantity: 2,
              category: 'limpeza',
              unit: 'un',
            },
          ],
        },
      ];

      const mockMarkets: MarketProfile[] = [
        { id: 'mercado_padrao', name: 'Supermercado Central', categoryOrder: ['alimentos', 'limpeza'] },
      ];

      const snapshot = buildHomeSnapshot(mockHistory, mockMarkets, 3, 60);

      expect(snapshot.monthlyStats.currentMonthCount).toBe(1);
      expect(snapshot.monthlyStats.currentMonthTotal).toBe(28.5);
      expect(snapshot.pendingItemsCount).toBe(3);
      expect(snapshot.availableMarketNames).toContain('Supermercado Central');

      saveHomeSnapshot(snapshot);

      const loaded = loadHomeSnapshotSync();
      expect(loaded).not.toBeNull();
      expect(loaded?.monthlyStats.currentMonthTotal).toBe(28.5);
    });

    it('returns null safely when no snapshot is stored yet', () => {
      window.localStorage.removeItem('carrinhocompras_home_snapshot_v1');
      expect(loadHomeSnapshotSync()).toBeNull();
    });
  });

  describe('3. Parallel Execution & Elimination of Cascading Waterfalls', () => {
    it('executes remote fetch and pending push simultaneously via Promise.allSettled', async () => {
      let resolveFetch!: (val: Record<string, unknown>) => void;
      let pushStartedWhileFetchPending = false;
      let fetchPending = true;

      vi.spyOn(CloudSyncService, 'initializeFirebase').mockReturnValue(true);
      vi.spyOn(CloudSyncService, 'fetchSharedSpace').mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = (val) => {
              fetchPending = false;
              resolve(val);
            };
          }),
      );

      const pushSpy = vi
        .spyOn(useShoppingStore.getState(), 'flushPendingSync')
        .mockImplementation(async () => {
          pushStartedWhileFetchPending = fetchPending;
          resolveFetch({ items: [], spaceCode: 'PARALLEL-123' });
        });

      useShoppingStore.setState({
        sharedSpaceCode: 'PARALLEL-123',
        hasPendingCloudPush: true,
      });

      await useShoppingStore.getState().validateAndSyncInBackground('PARALLEL-123');

      expect(pushSpy).toHaveBeenCalled();
      expect(pushStartedWhileFetchPending).toBe(true);
    });

    it('tolerates secondary push failure without blocking data hydration', async () => {
      vi.spyOn(CloudSyncService, 'initializeFirebase').mockReturnValue(true);
      vi.spyOn(CloudSyncService, 'fetchSharedSpace').mockResolvedValue({
        items: [{ id: 'cloud_item_1', name: 'Café', isChecked: false, category: 'alimentos', quantity: 1, unit: 'un' }],
        updatedAtMs: Date.now() + 1000,
      });
      vi.spyOn(useShoppingStore.getState(), 'flushPendingSync').mockRejectedValue(
        new Error('Network push failed temporarily'),
      );

      useShoppingStore.setState({
        sharedSpaceCode: 'RESILIENT-SPACE',
        hasPendingCloudPush: true,
        items: [],
      });

      await useShoppingStore.getState().validateAndSyncInBackground('RESILIENT-SPACE');

      // The primary data fetch should still succeed even though secondary push failed
      expect(useShoppingStore.getState().items.some((i) => i.name === 'Café')).toBe(true);
      expect(useShoppingStore.getState().hasPendingCloudPush).toBe(true);
    });
  });
});
