import { create } from 'zustand';
import type { Unsubscribe } from 'firebase/firestore';
import {
  PRODUCT_CATEGORIES,
  categoryFromId,
  getEffectiveTotalAmount,
  marketProfileFromJson,
  purchaseRecordFromJson,
  shoppingItemFromJson,
  type MarketPriceRecommendation,
  type MarketProfile,
  type PasteListResult,
  type ProductCategoryId,
  type PurchaseHistoryItem,
  type PurchaseRecord,
  type SharedSpaceStatePayload,
  type ShoppingItem,
} from '../types/shopping';
import { CategoryClassifier } from '../services/categoryClassifier';
import { CloudSyncService } from '../services/cloudSyncService';
import {
  clearPersistedSessionSync,
  loadPersistedState,
  loadPersistedStateSync,
  savePersistedState,
  updatePersistedSyncMetadata,
} from '../services/storageService';
import {
  buildHomeSnapshot,
  loadHomeSnapshotSync,
  saveHomeSnapshot,
} from '../services/homeSnapshotService';

function createDefaultMarkets(): MarketProfile[] {
  const allIds = PRODUCT_CATEGORIES.map((c) => c.id);
  return [
    {
      id: 'mercado_padrao',
      name: 'Supermercado Padrão',
      categoryOrder: allIds,
    },
    {
      id: 'atacadao',
      name: 'Atacadão',
      categoryOrder: [
        'limpeza',
        'descartaveis',
        'perfumaria_higiene',
        'bebidas',
        'alimentos',
        'hortifruti',
        'congelados',
        'bebe_crianca',
        'pet_shop',
        'bazar',
        'diversos',
      ],
    },
    {
      id: 'mercado_bairro',
      name: 'Mercado do Bairro',
      categoryOrder: [
        'hortifruti',
        'alimentos',
        'congelados',
        'bebidas',
        'perfumaria_higiene',
        'limpeza',
        'bebe_crianca',
        'descartaveis',
        'pet_shop',
        'bazar',
        'diversos',
      ],
    },
  ];
}

const LOCAL_SAVE_DEBOUNCE_MS = 400;
const CLOUD_PUSH_DEBOUNCE_MS = 2500;

let cloudUnsubscribe: Unsubscribe | null = null;
let localSaveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudPushTimer: ReturnType<typeof setTimeout> | null = null;
let lastAppliedRemoteTimestampMs = 0;
let dirtyCloudFields = new Set<keyof SharedSpaceStatePayload>();
let forceFullCloudPush = false;
let needsSnapshotRebuild = true;

export interface ShoppingState {
  isHydrated: boolean;
  clientId: string;
  items: ShoppingItem[];
  markets: MarketProfile[];
  selectedMarketId: string;
  history: PurchaseRecord[];
  learnedCategories: Record<string, ProductCategoryId>;
  categoryDictionary: Record<ProductCategoryId, string[]>;
  categoryFilter: ProductCategoryId | null;
  showCheckedItems: boolean;
  isDarkMode: boolean;
  sharedSpaceCode: string | null;
  isSyncingCloud: boolean;
  hasPendingCloudPush: boolean;
  lastSyncedAtIso: string | null;
  cloudError: string | null;

  initializeApp: () => Promise<void>;
  validateAndSyncInBackground: (spaceCode: string) => Promise<void>;
  setCategoryFilter: (category: ProductCategoryId | null) => void;
  setShowCheckedItems: (value: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;

  predictCategory: (name: string) => ProductCategoryId;
  isDuplicateItemName: (name: string, excludeItemId?: string) => boolean;
  findLastHistoricalPrice: (itemName: string, marketId?: string) => number | null;
  marketRecommendationsForProduct: (itemName: string) => MarketPriceRecommendation[];
  recommendCheapestMarketForProduct: (
    itemName: string,
  ) => MarketPriceRecommendation | null;

  addSingleItem: (
    name: string,
    options?: {
      category?: ProductCategoryId;
      marketId?: string | null;
      price?: number | null;
      quantity?: number;
      unit?: string;
      isPriceTotal?: boolean;
    },
  ) => ShoppingItem | null;
  addItemsFromPastedTextWithReport: (rawText: string) => PasteListResult;
  toggleItemChecked: (id: string) => void;
  updateItem: (
    id: string,
    updates: {
      name?: string;
      category?: ProductCategoryId;
      marketId?: string | null;
      price?: number | null;
      quantity?: number;
      unit?: string;
      isPriceTotal?: boolean;
      clearPrice?: boolean;
    },
  ) => boolean;
  updateItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCheckedItems: () => void;
  uncheckAllItems: () => void;
  clearAllItems: () => void;

  addKeywordToCategory: (category: ProductCategoryId, rawKeyword: string) => boolean;
  removeKeywordFromCategory: (category: ProductCategoryId, keyword: string) => void;
  editKeywordInCategory: (
    category: ProductCategoryId,
    oldKeyword: string,
    newKeyword: string,
  ) => boolean;
  resetCategoryDictionary: (onlyCategory?: ProductCategoryId) => void;

  finishPurchase: (options?: {
    marketId?: string;
    date?: Date;
    onlyChecked?: boolean;
  }) => PurchaseRecord | null;
  addPurchaseFromItems: (params: {
    marketId: string;
    items: PurchaseHistoryItem[];
    date?: Date;
  }) => PurchaseRecord | null;
  deletePurchaseRecord: (recordId: string) => void;
  restorePurchaseRecord: (record: PurchaseRecord, atIndex?: number) => void;
  updatePurchaseRecordItem: (
    recordId: string,
    itemIndex: number,
    updatedItem: PurchaseHistoryItem,
  ) => void;

  selectMarket: (marketId: string) => void;
  addMarket: (
    name: string,
    initialOrder?: ProductCategoryId[],
  ) => MarketProfile;
  renameMarket: (marketId: string, newName: string) => void;
  deleteMarket: (marketId: string) => boolean;
  moveMarketCategory: (
    marketId: string,
    oldIndex: number,
    newIndex: number,
  ) => void;

  createNewSharedSpace: () => Promise<string>;
  joinExistingSharedSpace: (rawCode: string) => Promise<void>;
  disconnectSharedSpace: () => Promise<void>;
  refreshCloudSync: () => Promise<void>;
  flushPendingSync: () => Promise<void>;
}

function buildStateMap(state: ShoppingState): SharedSpaceStatePayload {
  return {
    clientId: state.clientId,
    items: state.items,
    markets: state.markets,
    selectedMarketId: state.selectedMarketId,
    history: state.history,
    learnedCategories: state.learnedCategories,
    categoryDictionary: state.categoryDictionary,
    showCheckedItems: state.showCheckedItems,
  };
}

function parseRemoteState(
  data: Record<string, unknown>,
  current: ShoppingState,
  options?: { isRemoteSync?: boolean },
): Partial<ShoppingState> {
  const isRemoteSync = options?.isRemoteSync ?? false;
  const patch: Partial<ShoppingState> = {};

  if (Array.isArray(data.items)) {
    const loaded = data.items
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map(shoppingItemFromJson);
    const seen = new Set<string>();
    patch.items = loaded.filter((item) => {
      const k = CategoryClassifier.normalize(item.name);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  let effectiveMarkets = current.markets;
  if (Array.isArray(data.markets)) {
    const loadedMarkets = data.markets
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map(marketProfileFromJson);
    if (loadedMarkets.length > 0) {
      patch.markets = loadedMarkets;
      effectiveMarkets = loadedMarkets;
    }
  }

  if (typeof data.selectedMarketId === 'string') {
    const currentStillValid = effectiveMarkets.some(
      (m) => m.id === current.selectedMarketId,
    );
    if (
      (!isRemoteSync || !currentStillValid) &&
      effectiveMarkets.some((m) => m.id === data.selectedMarketId)
    ) {
      patch.selectedMarketId = data.selectedMarketId;
    }
  }

  if (Array.isArray(data.history)) {
    patch.history = data.history
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map(purchaseRecordFromJson);
  }

  if (
    typeof data.learnedCategories === 'object' &&
    data.learnedCategories !== null
  ) {
    const learned: Record<string, ProductCategoryId> = {};
    for (const [k, v] of Object.entries(
      data.learnedCategories as Record<string, unknown>,
    )) {
      if (typeof v === 'string') {
        learned[k] = categoryFromId(v);
      }
    }
    patch.learnedCategories = learned;
  }

  if (
    typeof data.categoryDictionary === 'object' &&
    data.categoryDictionary !== null
  ) {
    const dict = { ...current.categoryDictionary };
    for (const [k, v] of Object.entries(
      data.categoryDictionary as Record<string, unknown>,
    )) {
      const cat = categoryFromId(k);
      if (Array.isArray(v)) {
        dict[cat] = v.map((e) => String(e));
      }
    }
    patch.categoryDictionary = dict;
  }

  if (!isRemoteSync && typeof data.showCheckedItems === 'boolean') {
    patch.showCheckedItems = data.showCheckedItems;
  }

  return patch;
}

async function persistLocalState(get: () => ShoppingState) {
  const state = get();
  const stateMap = buildStateMap(state);

  await savePersistedState({
    ...stateMap,
    sharedSpaceCode: state.sharedSpaceCode,
    isDarkMode: state.isDarkMode,
    lastAppliedRemoteTimestampMs,
    hasPendingCloudPush: state.hasPendingCloudPush,
    lastSyncedAtIso: state.lastSyncedAtIso,
  });

  try {
    const pendingCount = state.items.filter((i) => !i.isChecked).length;
    const existingSnapshot = !needsSnapshotRebuild ? loadHomeSnapshotSync() : null;
    if (existingSnapshot) {
      if (existingSnapshot.pendingItemsCount !== pendingCount) {
        saveHomeSnapshot({
          ...existingSnapshot,
          pendingItemsCount: pendingCount,
          updatedAtMs: Date.now(),
        });
      }
    } else {
      needsSnapshotRebuild = false;
      const snapshot = buildHomeSnapshot(
        state.history,
        state.markets,
        pendingCount,
      );
      saveHomeSnapshot(snapshot);
    }
  } catch {
    // Ignore snapshot write failures
  }
}

async function pushCloudState(
  get: () => ShoppingState,
  set: (partial: Partial<ShoppingState>) => void,
) {
  const state = get();
  if (!state.sharedSpaceCode) return;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (!state.hasPendingCloudPush) {
      set({ hasPendingCloudPush: true, cloudError: null });
    }
    return;
  }

  const fieldsToSync = new Set(dirtyCloudFields);
  const isFullPush = forceFullCloudPush || fieldsToSync.size === 0;
  dirtyCloudFields.clear();
  forceFullCloudPush = false;

  const stateMap = buildStateMap(state);
  let partialStateMap: Partial<SharedSpaceStatePayload> | undefined;
  if (!isFullPush) {
    partialStateMap = {};
    for (const field of fieldsToSync) {
      (partialStateMap as Record<string, unknown>)[field] = stateMap[field];
    }
  }

  try {
    if (!CloudSyncService.isFirebaseReady()) {
      CloudSyncService.initializeFirebase();
    }
    set({ isSyncingCloud: true });
    await CloudSyncService.pushStateToSharedSpace({
      spaceCode: state.sharedSpaceCode,
      stateMap,
      partialStateMap,
      clientId: state.clientId,
    });
    const nowIso = new Date().toISOString();
    const stillHasQueuedPush =
      cloudPushTimer !== null ||
      dirtyCloudFields.size > 0 ||
      forceFullCloudPush;
    set({
      isSyncingCloud: false,
      hasPendingCloudPush: stillHasQueuedPush,
      lastSyncedAtIso: nowIso,
      cloudError: null,
    });
    await updatePersistedSyncMetadata({
      lastAppliedRemoteTimestampMs,
      hasPendingCloudPush: stillHasQueuedPush,
      lastSyncedAtIso: nowIso,
    });
  } catch (err) {
    if (isFullPush) {
      forceFullCloudPush = true;
    } else {
      for (const field of fieldsToSync) {
        dirtyCloudFields.add(field);
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    set({
      isSyncingCloud: false,
      hasPendingCloudPush: true,
      cloudError: msg,
    });
  }
}

function scheduleSave(
  get: () => ShoppingState,
  set: (partial: Partial<ShoppingState>) => void,
  options?: {
    pushCloud?: boolean;
    immediate?: boolean;
    changedFields?: Array<keyof SharedSpaceStatePayload>;
    rebuildSnapshot?: boolean;
  },
) {
  const pushCloud = options?.pushCloud ?? true;
  const changedFields = options?.changedFields;

  const shouldRebuildSnapshot =
    options?.rebuildSnapshot ??
    (!changedFields ||
      changedFields.length === 0 ||
      changedFields.includes('history') ||
      changedFields.includes('markets'));
  if (shouldRebuildSnapshot) {
    needsSnapshotRebuild = true;
  }

  if (pushCloud) {
    if (changedFields && changedFields.length > 0) {
      for (const field of changedFields) {
        dirtyCloudFields.add(field);
      }
    } else {
      forceFullCloudPush = true;
    }
  }

  if (options?.immediate) {
    if (localSaveTimer) {
      clearTimeout(localSaveTimer);
      localSaveTimer = null;
    }
    if (pushCloud && cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (pushCloud && get().sharedSpaceCode && !get().hasPendingCloudPush) {
      set({ hasPendingCloudPush: true });
    }
    void persistLocalState(get).then(() => {
      if (pushCloud && get().sharedSpaceCode) {
        return pushCloudState(get, set);
      }
    });
    return;
  }

  if (pushCloud && get().sharedSpaceCode && !get().hasPendingCloudPush) {
    set({ hasPendingCloudPush: true });
  }

  if (localSaveTimer) clearTimeout(localSaveTimer);
  localSaveTimer = setTimeout(() => {
    localSaveTimer = null;
    void persistLocalState(get);
  }, LOCAL_SAVE_DEBOUNCE_MS);

  if (pushCloud && get().sharedSpaceCode) {
    if (cloudPushTimer) clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(() => {
      cloudPushTimer = null;
      void pushCloudState(get, set);
    }, CLOUD_PUSH_DEBOUNCE_MS);
  }
}

function startCloudListener(
  spaceCode: string,
  get: () => ShoppingState,
  set: (partial: Partial<ShoppingState>) => void,
) {
  cloudUnsubscribe?.();
  cloudUnsubscribe = null;
  if (!CloudSyncService.isFirebaseReady()) return;

  cloudUnsubscribe = CloudSyncService.listenToSharedSpace({
    spaceCode,
    onData: (data) => {
      const state = get();
      if (data.updatedByClientId === state.clientId) return;
      if (cloudPushTimer !== null || state.hasPendingCloudPush) return;

      const remoteTs = CloudSyncService.getRemoteTimestampMs(data);
      if (remoteTs != null && remoteTs < lastAppliedRemoteTimestampMs) {
        return;
      }
      if (remoteTs != null) {
        lastAppliedRemoteTimestampMs = remoteTs;
      }

      const patch = parseRemoteState(data, state, { isRemoteSync: true });
      set({
        ...patch,
        lastSyncedAtIso: new Date().toISOString(),
        hasPendingCloudPush: false,
        cloudError: null,
      });
      scheduleSave(get, set, { pushCloud: false, immediate: true });
    },
    onError: (err) => {
      set({ cloudError: err.message });
    },
  });
}

function getInitialSynchronousState(): Partial<ShoppingState> {
  const sync = loadPersistedStateSync();
  if (!sync) return {};

  const dummyCurrent = {
    categoryDictionary: CategoryClassifier.cloneDefaultDictionary(),
    markets: createDefaultMarkets(),
    history: [],
  } as unknown as ShoppingState;

  if (typeof sync.lastAppliedRemoteTimestampMs === 'number') {
    lastAppliedRemoteTimestampMs = sync.lastAppliedRemoteTimestampMs;
  }

  const patch = parseRemoteState(sync as Record<string, unknown>, dummyCurrent);
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  return {
    ...patch,
    clientId:
      typeof sync.clientId === 'string' && sync.clientId
        ? sync.clientId
        : undefined,
    sharedSpaceCode:
      typeof sync.sharedSpaceCode === 'string' && sync.sharedSpaceCode
        ? sync.sharedSpaceCode
        : null,
    hasPendingCloudPush: Boolean(sync.hasPendingCloudPush),
    lastSyncedAtIso:
      typeof sync.lastSyncedAtIso === 'string' ? sync.lastSyncedAtIso : null,
    isDarkMode:
      typeof sync.isDarkMode === 'boolean'
        ? sync.isDarkMode
        : Boolean(prefersDark),
    isHydrated: true,
  };
}

export const useShoppingStore = create<ShoppingState>((set, get) => {
  const syncInitial = getInitialSynchronousState();

  return {
    isHydrated: Boolean(syncInitial.isHydrated),
    clientId:
      syncInitial.clientId ??
      `client_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    items: syncInitial.items ?? [],
    markets: syncInitial.markets ?? createDefaultMarkets(),
    selectedMarketId: syncInitial.selectedMarketId ?? 'mercado_padrao',
    history: syncInitial.history ?? [],
    learnedCategories: syncInitial.learnedCategories ?? {},
    categoryDictionary:
      syncInitial.categoryDictionary ??
      CategoryClassifier.cloneDefaultDictionary(),
    categoryFilter: null,
    showCheckedItems: syncInitial.showCheckedItems ?? true,
    isDarkMode: syncInitial.isDarkMode ?? false,
    sharedSpaceCode: syncInitial.sharedSpaceCode ?? null,
    isSyncingCloud: false,
    hasPendingCloudPush: syncInitial.hasPendingCloudPush ?? false,
    lastSyncedAtIso: syncInitial.lastSyncedAtIso ?? null,
    cloudError: null,

    async initializeApp() {
      // 1. Asynchronously reconcile with IndexedDB in background without blocking UI
      try {
        const saved = await loadPersistedState();
        if (saved) {
          if (typeof saved.lastAppliedRemoteTimestampMs === 'number') {
            lastAppliedRemoteTimestampMs = saved.lastAppliedRemoteTimestampMs;
          }
          const patch = parseRemoteState(saved as Record<string, unknown>, get());
          set({
            ...patch,
            clientId:
              typeof saved.clientId === 'string' && saved.clientId
                ? saved.clientId
                : get().clientId,
            sharedSpaceCode:
              typeof saved.sharedSpaceCode === 'string' && saved.sharedSpaceCode
                ? saved.sharedSpaceCode
                : get().sharedSpaceCode,
            hasPendingCloudPush: Boolean(saved.hasPendingCloudPush),
            lastSyncedAtIso:
              typeof saved.lastSyncedAtIso === 'string'
                ? saved.lastSyncedAtIso
                : get().lastSyncedAtIso,
            isDarkMode:
              typeof saved.isDarkMode === 'boolean'
                ? saved.isDarkMode
                : get().isDarkMode,
            isHydrated: true,
          });
        } else {
          set({ isHydrated: true });
        }
      } catch {
        set({ isHydrated: true });
      }

      // 2. Refresh local home snapshot in background
      try {
        const snapshot = buildHomeSnapshot(
          get().history,
          get().markets,
          get().items.filter((i) => !i.isChecked).length,
        );
        saveHomeSnapshot(snapshot);
      } catch {
        // Ignore snapshot generation failure
      }

      // 3. Optimistic session validation & parallel sync in background
      const spaceCode = get().sharedSpaceCode;
      if (spaceCode) {
        void get().validateAndSyncInBackground(spaceCode);
      }
    },

    async validateAndSyncInBackground(spaceCode: string) {
      if (!spaceCode) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      const ready = CloudSyncService.initializeFirebase();
      if (!ready) {
        set({
          cloudError:
            CloudSyncService.getInitializationError() ??
            'Não foi possível conectar ao Firebase.',
        });
        return;
      }

      startCloudListener(spaceCode, get, set);

      // Strategy 3: Parallelize space fetch and pending push using Promise.allSettled
      set({ isSyncingCloud: true });
      const hadPendingPush = get().hasPendingCloudPush;

      const tasks: [Promise<Record<string, unknown> | null>, Promise<void> | null] = [
        CloudSyncService.fetchSharedSpace(spaceCode),
        hadPendingPush ? get().flushPendingSync() : null,
      ];

      const [fetchResult, pushResult] = await Promise.allSettled([
        tasks[0],
        tasks[1] ?? Promise.resolve(),
      ]);

      set({ isSyncingCloud: false });

      // Strategy 1: Check for 401 / permission-denied / unauthenticated
      if (fetchResult.status === 'rejected') {
        const errorMsg =
          fetchResult.reason instanceof Error
            ? fetchResult.reason.message
            : String(fetchResult.reason);
        const isAuthError =
          errorMsg.includes('permission-denied') ||
          errorMsg.includes('unauthenticated') ||
          errorMsg.includes('401') ||
          errorMsg.includes('403') ||
          errorMsg.includes('Permissão negada');

        if (isAuthError) {
          clearPersistedSessionSync();
          cloudUnsubscribe?.();
          cloudUnsubscribe = null;
          set({
            sharedSpaceCode: null,
            hasPendingCloudPush: false,
            cloudError:
              'Sessão expirada ou sem permissão de acesso ao espaço. O app continuará em modo local.',
          });
          scheduleSave(get, set, { pushCloud: false, immediate: true });
          return;
        }

        set({ cloudError: errorMsg });
        return;
      }

      if (fetchResult.status === 'fulfilled') {
        const data = fetchResult.value;
        if (!data) {
          if (!hadPendingPush || pushResult.status !== 'fulfilled') {
            clearPersistedSessionSync();
            cloudUnsubscribe?.();
            cloudUnsubscribe = null;
            set({
              sharedSpaceCode: null,
              hasPendingCloudPush: false,
              cloudError: `O espaço "${spaceCode}" não foi encontrado no servidor. Conectando em modo local.`,
            });
            scheduleSave(get, set, { pushCloud: false, immediate: true });
            return;
          }
        } else if (hadPendingPush && pushResult.status === 'fulfilled') {
          // Local pending changes were just pushed; do not overwrite them with the pre-push fetch
          set({
            lastSyncedAtIso: new Date().toISOString(),
            cloudError: null,
          });
        } else if (
          !hadPendingPush ||
          get().items.length === 0
        ) {
          // Stale-While-Revalidate: Reconcile fresh server data with local state
          const remoteTs = CloudSyncService.getRemoteTimestampMs(data);
          if (remoteTs == null || remoteTs >= lastAppliedRemoteTimestampMs) {
            if (remoteTs != null) lastAppliedRemoteTimestampMs = remoteTs;
            const patch = parseRemoteState(data, get(), { isRemoteSync: true });
            set({
              ...patch,
              lastSyncedAtIso: new Date().toISOString(),
              cloudError: null,
            });
            scheduleSave(get, set, { pushCloud: false, immediate: true });
          }
        }
      }

      if (pushResult.status === 'rejected') {
        set({
          hasPendingCloudPush: true,
          cloudError:
            pushResult.reason instanceof Error
              ? pushResult.reason.message
              : String(pushResult.reason),
        });
      }
    },

  setCategoryFilter(category) {
    set({ categoryFilter: category });
  },

  setShowCheckedItems(value) {
    set({ showCheckedItems: value });
    scheduleSave(get, set, { changedFields: ['showCheckedItems'] });
  },

  toggleDarkMode() {
    set((s) => ({ isDarkMode: !s.isDarkMode }));
    scheduleSave(get, set, { pushCloud: false, rebuildSnapshot: false });
  },

  setDarkMode(value) {
    if (get().isDarkMode === value) return;
    set({ isDarkMode: value });
    scheduleSave(get, set, { pushCloud: false, rebuildSnapshot: false });
  },

  predictCategory(name) {
    return CategoryClassifier.classify(name, {
      customMemory: get().learnedCategories,
      customDictionary: get().categoryDictionary,
    });
  },

  isDuplicateItemName(name, excludeItemId) {
    const normalizedTarget = CategoryClassifier.normalize(name);
    if (!normalizedTarget) return false;
    return get().items.some((existing) => {
      if (excludeItemId && existing.id === excludeItemId) return false;
      return CategoryClassifier.normalize(existing.name) === normalizedTarget;
    });
  },

  findLastHistoricalPrice(itemName, marketId) {
    const normalized = CategoryClassifier.normalize(itemName);
    if (!normalized) return null;
    const history = get().history;

    if (marketId) {
      for (const record of history) {
        if (record.marketId !== marketId) continue;
        for (const item of record.items) {
          if (
            CategoryClassifier.normalize(item.name) === normalized &&
            item.price > 0
          ) {
            return item.price;
          }
        }
      }
    }

    for (const record of history) {
      for (const item of record.items) {
        if (
          CategoryClassifier.normalize(item.name) === normalized &&
          item.price > 0
        ) {
          return item.price;
        }
      }
    }
    return null;
  },

  marketRecommendationsForProduct(itemName) {
    const normalized = CategoryClassifier.normalize(itemName);
    if (!normalized) return [];
    const { history, markets } = get();
    const pricesByMarketId = new Map<string, number[]>();
    const marketNameFallback = new Map<string, string>();

    for (const record of history) {
      for (const item of record.items) {
        if (item.price <= 0) continue;
        if (CategoryClassifier.normalize(item.name) === normalized) {
          const matchedMarket = markets.find(
            (m) =>
              m.id === record.marketId ||
              CategoryClassifier.normalize(m.name) ===
                CategoryClassifier.normalize(record.marketName),
          );
          const key = matchedMarket?.id ?? record.marketId;
          marketNameFallback.set(key, matchedMarket?.name ?? record.marketName);
          const arr = pricesByMarketId.get(key) ?? [];
          arr.push(item.price);
          pricesByMarketId.set(key, arr);
        }
      }
    }

    const recs: MarketPriceRecommendation[] = [];
    for (const [marketId, prices] of pricesByMarketId.entries()) {
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const last = prices[0];
      const market =
        markets.find((m) => m.id === marketId) ??
        ({
          id: marketId,
          name: marketNameFallback.get(marketId) ?? 'Mercado',
          categoryOrder: PRODUCT_CATEGORIES.map((c) => c.id),
        } satisfies MarketProfile);

      recs.push({ market, averagePrice: avg, lastPrice: last });
    }

    recs.sort((a, b) => a.averagePrice - b.averagePrice);
    return recs;
  },

  recommendCheapestMarketForProduct(itemName) {
    const recs = get().marketRecommendationsForProduct(itemName);
    return recs[0] ?? null;
  },

  addSingleItem(name, options) {
    const cleanInput = name.trim();
    if (!cleanInput) return null;

    const parsed = CategoryClassifier.extractQuantityAndName(cleanInput);
    let cleanName = parsed.name || cleanInput;
    cleanName = CategoryClassifier.singularize(cleanName.toLowerCase());
    if (!cleanName) return null;

    const formattedName = cleanName[0].toUpperCase() + cleanName.slice(1);
    if (get().isDuplicateItemName(formattedName)) {
      return null;
    }

    const assignedQuantity =
      options?.quantity && options.quantity > 0
        ? options.quantity
        : parsed.quantity > 0
          ? parsed.quantity
          : 1;
    const assignedUnit =
      options?.unit && options.unit.length > 0 ? options.unit : parsed.unit;
    const assignedIsPriceTotal =
      options?.isPriceTotal ?? parsed.isPriceTotalByDefault;

    const assignedCategory =
      options?.category ?? get().predictCategory(formattedName);
    const nextLearned = { ...get().learnedCategories };
    if (options?.category) {
      nextLearned[CategoryClassifier.normalize(formattedName)] =
        options.category;
    }

    const item: ShoppingItem = {
      id: `${Date.now()}_${Math.floor(Math.random() * 10000)}_${get().items.length}`,
      name: formattedName,
      category: assignedCategory,
      marketId: options?.marketId ?? null,
      price: options?.price ?? null,
      quantity: assignedQuantity,
      unit: assignedUnit,
      isPriceTotal: assignedIsPriceTotal,
      isChecked: false,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      items: [...s.items, item],
      learnedCategories: nextLearned,
    }));
    scheduleSave(get, set, {
      changedFields: options?.category
        ? ['items', 'learnedCategories']
        : ['items'],
    });
    return item;
  },

  addItemsFromPastedTextWithReport(rawText) {
    let rawSegments = rawText.split(/[\r\n;]+/);
    if (rawSegments.length === 1 && rawText.includes(',')) {
      rawSegments = rawText.split(',');
    }

    const prefixRegex =
      /^(\s*[-*•◦▪▫▸▹▻✓✔✗✘☐☑☒]\s*|\s*\[[ xX]?\]\s*|\s*\d+[.)-]\s*)+/;

    let addedCount = 0;
    let skippedDuplicatesCount = 0;
    const newItems: ShoppingItem[] = [];
    const existingNames = new Set(
      get().items.map((i) => CategoryClassifier.normalize(i.name)),
    );
    const now = Date.now();

    for (let i = 0; i < rawSegments.length; i++) {
      const rawCandidate = rawSegments[i].replace(prefixRegex, '').trim();
      if (!rawCandidate) continue;

      const parsed = CategoryClassifier.extractQuantityAndName(rawCandidate);
      let cleaned = parsed.name || rawCandidate;
      cleaned = CategoryClassifier.singularize(cleaned.toLowerCase());
      if (!cleaned) continue;

      const norm = CategoryClassifier.normalize(cleaned);
      if (!norm || existingNames.has(norm)) {
        skippedDuplicatesCount++;
        continue;
      }
      existingNames.add(norm);

      cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
      const category = get().predictCategory(cleaned);

      newItems.push({
        id: `${now}_${get().items.length + i}_${Math.floor(Math.random() * 1000)}`,
        name: cleaned,
        category,
        marketId: null,
        price: null,
        quantity: parsed.quantity > 0 ? parsed.quantity : 1,
        unit: parsed.unit,
        isPriceTotal: parsed.isPriceTotalByDefault,
        isChecked: false,
        createdAt: new Date().toISOString(),
      });
      addedCount++;
    }

    if (addedCount > 0) {
      set((s) => ({ items: [...s.items, ...newItems] }));
      scheduleSave(get, set, { changedFields: ['items'] });
    }

    return { addedCount, skippedDuplicatesCount };
  },

  toggleItemChecked(id) {
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, isChecked: !item.isChecked } : item,
      ),
    }));
    scheduleSave(get, set, { changedFields: ['items'] });
  },

  updateItem(id, updates) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return false;

    const updatedName =
      updates.name && updates.name.trim().length > 0
        ? updates.name.trim()
        : current.name;

    if (get().isDuplicateItemName(updatedName, id)) {
      return false;
    }

    const updatedCategory = updates.category ?? current.category;
    const nextDict = { ...get().categoryDictionary };
    const nextLearned = { ...get().learnedCategories };

    if (updates.category) {
      const cleanKeyword = updatedName.trim().toLowerCase();
      const normalizedNew = CategoryClassifier.normalize(cleanKeyword);
      if (normalizedNew) {
        for (const cat of PRODUCT_CATEGORIES) {
          nextDict[cat.id] = (nextDict[cat.id] ?? []).filter(
            (existing) =>
              CategoryClassifier.normalize(existing) !== normalizedNew,
          );
        }
        nextDict[updatedCategory] = [
          cleanKeyword,
          ...(nextDict[updatedCategory] ?? []),
        ];
        nextLearned[normalizedNew] = updatedCategory;
      }
    }

    set((s) => ({
      categoryDictionary: nextDict,
      learnedCategories: nextLearned,
      items: s.items.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          name: updatedName,
          category: updatedCategory,
          marketId:
            updates.marketId !== undefined ? updates.marketId : item.marketId,
          price: updates.clearPrice
            ? null
            : updates.price !== undefined
              ? updates.price
              : item.price,
          quantity:
            updates.quantity && updates.quantity > 0
              ? updates.quantity
              : item.quantity,
          unit:
            updates.unit && updates.unit.length > 0 ? updates.unit : item.unit,
          isPriceTotal:
            updates.isPriceTotal !== undefined
              ? updates.isPriceTotal
              : item.isPriceTotal,
        };
      }),
    }));
    scheduleSave(get, set, {
      changedFields: updates.category
        ? ['items', 'categoryDictionary', 'learnedCategories']
        : ['items'],
    });
    return true;
  },

  updateItemQuantity(id, quantity) {
    if (quantity < 1) return;
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, quantity } : item,
      ),
    }));
    scheduleSave(get, set, { changedFields: ['items'] });
  },

  removeItem(id) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    scheduleSave(get, set, { changedFields: ['items'] });
  },

  clearCheckedItems() {
    set((s) => ({ items: s.items.filter((i) => !i.isChecked) }));
    scheduleSave(get, set, { changedFields: ['items'] });
  },

  uncheckAllItems() {
    set((s) => ({
      items: s.items.map((i) => ({ ...i, isChecked: false })),
    }));
    scheduleSave(get, set, { changedFields: ['items'] });
  },

  clearAllItems() {
    set({ items: [] });
    scheduleSave(get, set, { changedFields: ['items'] });
  },

  addKeywordToCategory(category, rawKeyword) {
    const clean = rawKeyword.trim().toLowerCase();
    const normalizedNew = CategoryClassifier.normalize(clean);
    if (!normalizedNew) return false;

    const nextDict = { ...get().categoryDictionary };
    for (const cat of PRODUCT_CATEGORIES) {
      nextDict[cat.id] = (nextDict[cat.id] ?? []).filter(
        (existing) => CategoryClassifier.normalize(existing) !== normalizedNew,
      );
    }
    nextDict[category] = [clean, ...(nextDict[category] ?? [])];

    const nextLearned = {
      ...get().learnedCategories,
      [normalizedNew]: category,
    };

    const nextItems = get().items.map((item) =>
      CategoryClassifier.normalize(item.name) === normalizedNew
        ? { ...item, category }
        : item,
    );

    set({
      categoryDictionary: nextDict,
      learnedCategories: nextLearned,
      items: nextItems,
    });
    scheduleSave(get, set, {
      changedFields: ['categoryDictionary', 'learnedCategories', 'items'],
    });
    return true;
  },

  removeKeywordFromCategory(category, keyword) {
    const normalizedTarget = CategoryClassifier.normalize(keyword);
    const nextDict = {
      ...get().categoryDictionary,
      [category]: (get().categoryDictionary[category] ?? []).filter(
        (k) => CategoryClassifier.normalize(k) !== normalizedTarget,
      ),
    };
    const nextLearned = { ...get().learnedCategories };
    delete nextLearned[normalizedTarget];

    set({ categoryDictionary: nextDict, learnedCategories: nextLearned });
    scheduleSave(get, set, {
      changedFields: ['categoryDictionary', 'learnedCategories'],
    });
  },

  editKeywordInCategory(category, oldKeyword, newKeyword) {
    const cleanNew = newKeyword.trim().toLowerCase();
    const normalizedNew = CategoryClassifier.normalize(cleanNew);
    const normalizedOld = CategoryClassifier.normalize(oldKeyword);
    if (!normalizedNew) return false;

    const list = [...(get().categoryDictionary[category] ?? [])];
    const index = list.findIndex(
      (item) => CategoryClassifier.normalize(item) === normalizedOld,
    );
    if (index === -1) return false;

    const duplicateIndex = list.findIndex(
      (item) => CategoryClassifier.normalize(item) === normalizedNew,
    );
    if (duplicateIndex !== -1 && duplicateIndex !== index) return false;

    list[index] = cleanNew;
    const nextLearned = { ...get().learnedCategories };
    delete nextLearned[normalizedOld];
    nextLearned[normalizedNew] = category;

    set({
      categoryDictionary: {
        ...get().categoryDictionary,
        [category]: list,
      },
      learnedCategories: nextLearned,
    });
    scheduleSave(get, set, {
      changedFields: ['categoryDictionary', 'learnedCategories'],
    });
    return true;
  },

  resetCategoryDictionary(onlyCategory) {
    const defaults = CategoryClassifier.cloneDefaultDictionary();
    if (onlyCategory) {
      set((s) => ({
        categoryDictionary: {
          ...s.categoryDictionary,
          [onlyCategory]: defaults[onlyCategory] ?? [],
        },
      }));
    } else {
      set({ categoryDictionary: defaults, learnedCategories: {} });
    }
    scheduleSave(get, set, {
      changedFields: ['categoryDictionary', 'learnedCategories'],
    });
  },

  finishPurchase(options) {
    const onlyChecked = options?.onlyChecked ?? true;
    const items = get().items;
    const itemsToSave = onlyChecked
      ? items.filter((e) => e.isChecked)
      : [...items];
    if (itemsToSave.length === 0) return null;

    const markets = get().markets;
    const targetMarketId = options?.marketId ?? get().selectedMarketId;
    const targetMarket =
      markets.find((m) => m.id === targetMarketId) ?? markets[0];

    const record: PurchaseRecord = {
      id: `purchase_${Date.now()}`,
      marketId: targetMarket.id,
      marketName: targetMarket.name,
      date: (options?.date ?? new Date()).toISOString(),
      items: itemsToSave.map((e) => ({
        name: e.name,
        category: e.category,
        price: getEffectiveTotalAmount(e),
        quantity: e.quantity > 0 ? e.quantity : 1,
        unit: e.unit || 'un',
      })),
    };

    set((s) => ({
      history: [record, ...s.history],
      items: onlyChecked ? s.items.filter((e) => !e.isChecked) : [],
    }));
    scheduleSave(get, set, { changedFields: ['history', 'items'] });
    return record;
  },

  addPurchaseFromItems({ marketId, items, date }) {
    if (items.length === 0) return null;
    const markets = get().markets;
    const targetMarket = markets.find((m) => m.id === marketId) ?? markets[0];

    const record: PurchaseRecord = {
      id: `purchase_${Date.now()}`,
      marketId: targetMarket.id,
      marketName: targetMarket.name,
      date: (date ?? new Date()).toISOString(),
      items,
    };

    set((s) => ({ history: [record, ...s.history] }));
    scheduleSave(get, set, { changedFields: ['history'] });
    return record;
  },

  deletePurchaseRecord(recordId) {
    set((s) => ({ history: s.history.filter((r) => r.id !== recordId) }));
    scheduleSave(get, set, { changedFields: ['history'] });
  },

  restorePurchaseRecord(record, atIndex) {
    set((s) => {
      const next = [...s.history];
      if (atIndex != null && atIndex >= 0 && atIndex <= next.length) {
        next.splice(atIndex, 0, record);
      } else {
        next.unshift(record);
      }
      return { history: next };
    });
    scheduleSave(get, set, { changedFields: ['history'] });
  },

  updatePurchaseRecordItem(recordId, itemIndex, updatedItem) {
    set((s) => ({
      history: s.history.map((r) => {
        if (r.id !== recordId) return r;
        if (itemIndex < 0 || itemIndex >= r.items.length) return r;
        const nextItems = [...r.items];
        nextItems[itemIndex] = updatedItem;
        return { ...r, items: nextItems };
      }),
    }));
    scheduleSave(get, set, { changedFields: ['history'] });
  },

  selectMarket(marketId) {
    if (get().markets.some((m) => m.id === marketId)) {
      set({ selectedMarketId: marketId });
      // Local preference: choosing which market's aisles to view should not overwrite other devices
      scheduleSave(get, set, { pushCloud: false, rebuildSnapshot: false });
    }
  },

  addMarket(name, initialOrder) {
    const cleanName = name.trim();
    const currentMarket =
      get().markets.find((m) => m.id === get().selectedMarketId) ??
      get().markets[0];
    const market: MarketProfile = {
      id: `market_${Date.now()}`,
      name: cleanName,
      categoryOrder: initialOrder ?? [...currentMarket.categoryOrder],
    };
    set((s) => ({
      markets: [...s.markets, market],
      selectedMarketId: market.id,
    }));
    scheduleSave(get, set, { changedFields: ['markets', 'selectedMarketId'] });
    return market;
  },

  renameMarket(marketId, newName) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    set((s) => ({
      markets: s.markets.map((m) =>
        m.id === marketId ? { ...m, name: trimmed } : m,
      ),
    }));
    scheduleSave(get, set, { changedFields: ['markets'] });
  },

  deleteMarket(marketId) {
    const markets = get().markets;
    if (markets.length <= 1) return false;
    const nextMarkets = markets.filter((m) => m.id !== marketId);
    const nextSelectedId =
      get().selectedMarketId === marketId
        ? nextMarkets[0].id
        : get().selectedMarketId;

    set((s) => ({
      markets: nextMarkets,
      selectedMarketId: nextSelectedId,
      items: s.items.map((item) =>
        item.marketId === marketId ? { ...item, marketId: null } : item,
      ),
    }));
    scheduleSave(get, set, { changedFields: ['markets', 'items'] });
    return true;
  },

  moveMarketCategory(marketId, oldIndex, newIndex) {
    set((s) => ({
      markets: s.markets.map((m) => {
        if (m.id !== marketId) return m;
        const order = [...m.categoryOrder];
        if (
          oldIndex < 0 ||
          oldIndex >= order.length ||
          newIndex < 0 ||
          newIndex >= order.length
        ) {
          return m;
        }
        const [moved] = order.splice(oldIndex, 1);
        order.splice(newIndex, 0, moved);
        return { ...m, categoryOrder: order };
      }),
    }));
    scheduleSave(get, set, { changedFields: ['markets'] });
  },

  async createNewSharedSpace() {
    set({ isSyncingCloud: true, cloudError: null });
    try {
      CloudSyncService.initializeFirebase();
      const code = CloudSyncService.generateSpaceCode();
      await CloudSyncService.pushStateToSharedSpace({
        spaceCode: code,
        stateMap: buildStateMap(get()),
        clientId: get().clientId,
        verifyServer: true,
      });
      set({
        sharedSpaceCode: code,
        isSyncingCloud: false,
        hasPendingCloudPush: false,
        lastSyncedAtIso: new Date().toISOString(),
      });
      startCloudListener(code, get, set);
      scheduleSave(get, set, { pushCloud: false, immediate: true });
      return code;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isSyncingCloud: false, cloudError: msg });
      throw err;
    }
  },

  async joinExistingSharedSpace(rawCode) {
    const code = CloudSyncService.normalizeSpaceCode(rawCode);
    if (!code) throw new Error('Informe um código válido.');

    set({ isSyncingCloud: true, cloudError: null });
    try {
      CloudSyncService.initializeFirebase();
      const existingData = await CloudSyncService.fetchSharedSpace(code);
      if (existingData) {
        const remoteTs = CloudSyncService.getRemoteTimestampMs(existingData);
        if (remoteTs != null) {
          lastAppliedRemoteTimestampMs = remoteTs;
        }
        const patch = parseRemoteState(existingData, get(), {
          isRemoteSync: true,
        });
        set({
          ...patch,
          sharedSpaceCode: code,
          isSyncingCloud: false,
          hasPendingCloudPush: false,
          lastSyncedAtIso: new Date().toISOString(),
        });
      } else {
        await CloudSyncService.pushStateToSharedSpace({
          spaceCode: code,
          stateMap: buildStateMap(get()),
          clientId: get().clientId,
        });
        set({
          sharedSpaceCode: code,
          isSyncingCloud: false,
          hasPendingCloudPush: false,
          lastSyncedAtIso: new Date().toISOString(),
        });
      }
      startCloudListener(code, get, set);
      scheduleSave(get, set, { pushCloud: false, immediate: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isSyncingCloud: false, cloudError: msg });
      throw err;
    }
  },

  async disconnectSharedSpace() {
    cloudUnsubscribe?.();
    cloudUnsubscribe = null;
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    dirtyCloudFields.clear();
    forceFullCloudPush = false;
    lastAppliedRemoteTimestampMs = 0;
    set({
      sharedSpaceCode: null,
      hasPendingCloudPush: false,
      lastSyncedAtIso: null,
      cloudError: null,
    });
    scheduleSave(get, set, { pushCloud: false, immediate: true });
  },

  async flushPendingSync() {
    const code = get().sharedSpaceCode;
    if (!code) return;
    if (localSaveTimer) {
      clearTimeout(localSaveTimer);
      localSaveTimer = null;
      await persistLocalState(get);
    }
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (get().hasPendingCloudPush) {
      await pushCloudState(get, set);
    }
  },

  async refreshCloudSync() {
    const code = get().sharedSpaceCode;
    if (!code) return;

    if (get().hasPendingCloudPush) {
      await get().flushPendingSync();
      if (get().hasPendingCloudPush) return;
    }

    set({ isSyncingCloud: true });
    try {
      if (!CloudSyncService.isFirebaseReady()) {
        CloudSyncService.initializeFirebase();
      }
      const data = await CloudSyncService.fetchSharedSpace(code);
      if (data && data.updatedByClientId !== get().clientId) {
        const remoteTs = CloudSyncService.getRemoteTimestampMs(data);
        if (remoteTs == null || remoteTs >= lastAppliedRemoteTimestampMs) {
          if (remoteTs != null) lastAppliedRemoteTimestampMs = remoteTs;
          const patch = parseRemoteState(data, get(), { isRemoteSync: true });
          set({
            ...patch,
            lastSyncedAtIso: new Date().toISOString(),
            cloudError: null,
          });
          scheduleSave(get, set, { pushCloud: false, immediate: true });
        }
      } else {
        set({ lastSyncedAtIso: new Date().toISOString(), cloudError: null });
      }

      if (CloudSyncService.isFirebaseReady()) {
        startCloudListener(code, get, set);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ cloudError: msg });
    } finally {
      set({ isSyncingCloud: false });
    }
  },
  };
});
