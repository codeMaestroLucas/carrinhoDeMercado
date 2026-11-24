import { get, set } from 'idb-keyval';

const STORAGE_KEY = 'carrinhocompras_pwa_state_v1';

export interface PersistedAppState {
  clientId?: string;
  sharedSpaceCode?: string | null;
  isDarkMode?: boolean;
  items?: unknown[];
  markets?: unknown[];
  selectedMarketId?: string;
  history?: unknown[];
  learnedCategories?: Record<string, string>;
  categoryDictionary?: Record<string, string[]>;
  showCheckedItems?: boolean;
  lastAppliedRemoteTimestampMs?: number;
  hasPendingCloudPush?: boolean;
  lastSyncedAtIso?: string | null;
}

export async function loadPersistedState(): Promise<PersistedAppState | null> {
  try {
    const data = await get<PersistedAppState>(STORAGE_KEY);
    if (data && typeof data === 'object') {
      return data;
    }
    return null;
  } catch {
    try {
      const raw = window.localStorage?.getItem?.(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PersistedAppState) : null;
    } catch {
      return null;
    }
  }
}

export async function savePersistedState(state: PersistedAppState): Promise<void> {
  try {
    await set(STORAGE_KEY, state);
  } catch {
    try {
      window.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors on restricted environments
    }
  }
}
