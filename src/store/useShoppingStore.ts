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
  loadPersistedState,
  savePersistedState,
} from '../services/storageService';

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

let cloudUnsubscribe: Unsubscribe | null = null;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastAppliedRemoteTimestampMs = 0;

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
): Partial<ShoppingState> {
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
    if (effectiveMarkets.some((m) => m.id === data.selectedMarketId)) {
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

  if (typeof data.showCheckedItems === 'boolean') {
    patch.showCheckedItems = data.showCheckedItems;
  }

  return patch;
}

async function persistAndPush(
  get: () => ShoppingState,
  set: (partial: Partial<ShoppingState>) => void,
  pushCloud: boolean,
) {
  const state = get();
  const stateMap = buildStateMap(state);
  const shouldQueuePush = pushCloud && Boolean(state.sharedSpaceCode);

  if (shouldQueuePush) {
    set({ hasPendingCloudPush: true });
  }

  await savePersistedState({
    ...stateMap,
    sharedSpaceCode: state.sharedSpaceCode,
    isDarkMode: state.isDarkMode,
    lastAppliedRemoteTimestampMs,
    hasPendingCloudPush: shouldQueuePush ? true : state.hasPendingCloudPush,
    lastSyncedAtIso: state.lastSyncedAtIso,
  });

  if (!shouldQueuePush || !state.sharedSpaceCode) return;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    set({
      hasPendingCloudPush: true,
      cloudError: null,
    });
    return;
  }

  try {
    if (!CloudSyncService.isFirebaseReady()) {
      CloudSyncService.initializeFirebase();
    }
    set({ isSyncingCloud: true });
    await CloudSyncService.pushStateToSharedSpace({
      spaceCode: state.sharedSpaceCode,
      stateMap,
      clientId: state.clientId,
    });
    const nowIso = new Date().toISOString();
    set({
      isSyncingCloud: false,
      hasPendingCloudPush: false,
      lastSyncedAtIso: nowIso,
      cloudError: null,
    });
    await savePersistedState({
      ...buildStateMap(get()),
      sharedSpaceCode: get().sharedSpaceCode,
      isDarkMode: get().isDarkMode,
      lastAppliedRemoteTimestampMs,
      hasPendingCloudPush: false,
      lastSyncedAtIso: nowIso,
    });
  } catch (err) {
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
  options?: { pushCloud?: boolean; immediate?: boolean },
) {
  const pushCloud = options?.pushCloud ?? true;

  if (options?.immediate) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    void persistAndPush(get, set, pushCloud);
    return;
  }

  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null;
    void persistAndPush(get, set, pushCloud);
  }, 300);
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

      const remoteTs =
        typeof data.updatedAtMs === 'number' ? data.updatedAtMs : null;
      if (remoteTs != null && remoteTs < lastAppliedRemoteTimestampMs) {
        return;
      }
      if (remoteTs != null) {
        lastAppliedRemoteTimestampMs = remoteTs;
      }

      const patch = parseRemoteState(data, state);
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

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  isHydrated: false,
  clientId: `client_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
  items: [],
  markets: createDefaultMarkets(),
  selectedMarketId: 'mercado_padrao',
  history: [],
  learnedCategories: {},
  categoryDictionary: CategoryClassifier.cloneDefaultDictionary(),
  categoryFilter: null,
  showCheckedItems: true,
  isDarkMode: false,
  sharedSpaceCode: null,
  isSyncingCloud: false,
  hasPendingCloudPush: false,
  lastSyncedAtIso: null,
  cloudError: null,

  async initializeApp() {
    if (get().isHydrated) return;

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
            : null,
        hasPendingCloudPush: Boolean(saved.hasPendingCloudPush),
        lastSyncedAtIso:
          typeof saved.lastSyncedAtIso === 'string'
            ? saved.lastSyncedAtIso
            : null,
        isDarkMode:
          typeof saved.isDarkMode === 'boolean'
            ? saved.isDarkMode
            : window.matchMedia?.('(prefers-color-scheme: dark)').matches ??
              false,
        isHydrated: true,
      });
    } else {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      set({ isDarkMode: Boolean(prefersDark), isHydrated: true });
    }

    const ready = CloudSyncService.initializeFirebase();
    const spaceCode = get().sharedSpaceCode;
    if (!ready && spaceCode) {
      set({
        cloudError:
          CloudSyncService.getInitializationError() ??
          'Não foi possível conectar ao Firebase.',
      });
      return;
    }

    if (ready && spaceCode) {
      if (get().hasPendingCloudPush) {
        await get().flushPendingSync();
      }
      startCloudListener(spaceCode, get, set);
      if (!get().hasPendingCloudPush) {
        await get().refreshCloudSync();
      }
    }
  },

  setCategoryFilter(category) {
    set({ categoryFilter: category });
  },

  setShowCheckedItems(value) {
    set({ showCheckedItems: value });
    scheduleSave(get, set);
  },

  toggleDarkMode() {
    set((s) => ({ isDarkMode: !s.isDarkMode }));
    scheduleSave(get, set, { pushCloud: false });
  },

  setDarkMode(value) {
    if (get().isDarkMode === value) return;
    set({ isDarkMode: value });
    scheduleSave(get, set, { pushCloud: false });
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
    scheduleSave(get, set);
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
      scheduleSave(get, set);
    }

    return { addedCount, skippedDuplicatesCount };
  },

  toggleItemChecked(id) {
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, isChecked: !item.isChecked } : item,
      ),
    }));
    scheduleSave(get, set);
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
    scheduleSave(get, set);
    return true;
  },

  updateItemQuantity(id, quantity) {
    if (quantity < 1) return;
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, quantity } : item,
      ),
    }));
    scheduleSave(get, set);
  },

  removeItem(id) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    scheduleSave(get, set);
  },

  clearCheckedItems() {
    set((s) => ({ items: s.items.filter((i) => !i.isChecked) }));
    scheduleSave(get, set);
  },

  clearAllItems() {
    set({ items: [] });
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
    return record;
  },

  deletePurchaseRecord(recordId) {
    set((s) => ({ history: s.history.filter((r) => r.id !== recordId) }));
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
  },

  selectMarket(marketId) {
    if (get().markets.some((m) => m.id === marketId)) {
      set({ selectedMarketId: marketId });
      // Local preference: choosing which market's aisles to view should not overwrite other devices
      scheduleSave(get, set, { pushCloud: false });
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
    scheduleSave(get, set);
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
        if (typeof existingData.updatedAtMs === 'number') {
          lastAppliedRemoteTimestampMs = existingData.updatedAtMs;
        }
        const patch = parseRemoteState(existingData, get());
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
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    if (get().hasPendingCloudPush) {
      await persistAndPush(get, set, true);
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
        const remoteTs =
          typeof data.updatedAtMs === 'number' ? data.updatedAtMs : null;
        if (remoteTs == null || remoteTs >= lastAppliedRemoteTimestampMs) {
          if (remoteTs != null) lastAppliedRemoteTimestampMs = remoteTs;
          const patch = parseRemoteState(data, get());
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

      if (!cloudUnsubscribe && CloudSyncService.isFirebaseReady()) {
        startCloudListener(code, get, set);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ cloudError: msg });
    } finally {
      set({ isSyncingCloud: false });
    }
  },
}));
