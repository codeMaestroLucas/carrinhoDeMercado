import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncService } from '../src/services/cloudSyncService';
import { useShoppingStore } from '../src/store/useShoppingStore';

describe('Cross-device cloud synchronization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useShoppingStore.setState({
      isHydrated: true,
      clientId: 'device_a',
      items: [],
      history: [],
      selectedMarketId: 'atacadao',
      sharedSpaceCode: 'CASA-1234',
      hasPendingCloudPush: false,
      isSyncingCloud: false,
      lastSyncedAtIso: null,
      cloudError: null,
    });
  });

  it('prefers Firestore serverTimestamp over client updatedAtMs to avoid clock skew', () => {
    const serverMs = 1_750_000_050_000;
    const skewedClientMs = 1_750_000_000_000;

    expect(
      CloudSyncService.getRemoteTimestampMs({
        updatedAt: { toMillis: () => serverMs },
        updatedAtMs: skewedClientMs,
      }),
    ).toBe(serverMs);

    expect(
      CloudSyncService.getRemoteTimestampMs({
        updatedAt: { seconds: 1_750_000_050 },
        updatedAtMs: skewedClientMs,
      }),
    ).toBe(serverMs);

    expect(
      CloudSyncService.getRemoteTimestampMs({
        updatedAtMs: skewedClientMs,
      }),
    ).toBe(skewedClientMs);
  });

  it('does not overwrite pending local edits with pre-push server state in validateAndSyncInBackground', async () => {
    vi.spyOn(CloudSyncService, 'initializeFirebase').mockReturnValue(true);
    vi.spyOn(CloudSyncService, 'listenToSharedSpace').mockImplementation(
      () => () => {},
    );
    vi.spyOn(CloudSyncService, 'fetchSharedSpace').mockResolvedValue({
      items: [
        {
          id: 'old_item',
          name: 'Item Antigo',
          category: 'alimentos',
          quantity: 1,
          unit: 'un',
          isChecked: false,
        },
      ],
      updatedByClientId: 'device_b',
      updatedAtMs: Date.now() + 5000,
    });
    vi.spyOn(useShoppingStore.getState(), 'flushPendingSync').mockImplementation(
      async () => {
        useShoppingStore.setState({ hasPendingCloudPush: false });
      },
    );

    useShoppingStore.setState({
      items: [
        {
          id: 'local_new',
          name: 'Café Novo',
          category: 'alimentos',
          marketId: null,
          price: null,
          quantity: 1,
          unit: 'un',
          isPriceTotal: false,
          isChecked: false,
          createdAt: new Date().toISOString(),
        },
      ],
      hasPendingCloudPush: true,
    });

    await useShoppingStore
      .getState()
      .validateAndSyncInBackground('CASA-1234');

    const names = useShoppingStore.getState().items.map((i) => i.name);
    expect(names).toEqual(['Café Novo']);
  });

  it('preserves local selectedMarketId when applying remote updates and ignores remote snapshots while local edits are pending', async () => {
    let snapshotCallback: ((data: Record<string, unknown>) => void) | undefined;

    vi.spyOn(CloudSyncService, 'initializeFirebase').mockReturnValue(true);
    vi.spyOn(CloudSyncService, 'isFirebaseReady').mockReturnValue(true);
    vi.spyOn(CloudSyncService, 'fetchSharedSpace').mockResolvedValue({
      items: [
        {
          id: 'remote_1',
          name: 'Arroz',
          category: 'alimentos',
          quantity: 1,
          unit: 'un',
          isChecked: false,
        },
      ],
      selectedMarketId: 'mercado_padrao',
      updatedByClientId: 'device_b',
      updatedAt: { toMillis: () => Date.now() + 10_000 },
    });
    vi.spyOn(CloudSyncService, 'listenToSharedSpace').mockImplementation(
      ({ onData }) => {
        snapshotCallback = onData;
        return () => {};
      },
    );

    await useShoppingStore.getState().refreshCloudSync();

    expect(useShoppingStore.getState().items.map((i) => i.name)).toEqual([
      'Arroz',
    ]);
    // Local market selection should not be overwritten by another device
    expect(useShoppingStore.getState().selectedMarketId).toBe('atacadao');

    // Simulate local pending edit before debounce completes
    useShoppingStore.setState({ hasPendingCloudPush: true });
    (snapshotCallback as ((data: Record<string, unknown>) => void) | undefined)?.({
      items: [
        {
          id: 'remote_2',
          name: 'Feijão',
          category: 'alimentos',
          quantity: 1,
          unit: 'un',
          isChecked: false,
        },
      ],
      updatedByClientId: 'device_b',
      updatedAt: { toMillis: () => Date.now() + 20_000 },
    });

    // Pending local state must not be clobbered
    expect(useShoppingStore.getState().items.map((i) => i.name)).toEqual([
      'Arroz',
    ]);
  });

  it('pushes only dirty items slice when toggling items after debounce', async () => {
    vi.useFakeTimers();
    vi.spyOn(CloudSyncService, 'isFirebaseReady').mockReturnValue(true);
    const pushSpy = vi
      .spyOn(CloudSyncService, 'pushStateToSharedSpace')
      .mockResolvedValue(undefined);

    useShoppingStore.setState({
      items: [
        {
          id: 'item_toggle_1',
          name: 'Leite',
          category: 'alimentos',
          marketId: null,
          price: null,
          quantity: 1,
          unit: 'un',
          isPriceTotal: false,
          isChecked: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    useShoppingStore.getState().toggleItemChecked('item_toggle_1');
    useShoppingStore.getState().toggleItemChecked('item_toggle_1');
    useShoppingStore.getState().toggleItemChecked('item_toggle_1');

    // Before the 2.5s cloud debounce expires, no cloud push has been sent yet
    await vi.advanceTimersByTimeAsync(1000);
    expect(pushSpy).not.toHaveBeenCalled();

    // After the 2.5s debounce, a single partial push containing only `items` is sent
    await vi.advanceTimersByTimeAsync(2000);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const callArg = pushSpy.mock.calls[0][0];
    expect(callArg.partialStateMap).toBeDefined();
    expect(Object.keys(callArg.partialStateMap ?? {})).toEqual(['items']);
    expect(callArg.partialStateMap?.items?.[0]?.isChecked).toBe(true);

    vi.useRealTimers();
  });
});
