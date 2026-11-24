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

/**
 * Synchronous local reader for optimistic t=0 boot.
 * Allows Zustand and UI to hydrate with real cached data immediately
 * without waiting for asynchronous IndexedDB transactions.
 */
export function loadPersistedStateSync(): PersistedAppState | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as PersistedAppState)
      : null;
  } catch {
    return null;
  }
}

/**
 * Asynchronous reader for IndexedDB.
 * Loads full, unrestricted state in background and updates synchronous mirror.
 */
export async function loadPersistedState(): Promise<PersistedAppState | null> {
  try {
    const data = await get<PersistedAppState>(STORAGE_KEY);
    if (data && typeof data === 'object') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      } catch {
        // Ignore quota limits in localStorage mirror
      }
      return data;
    }
  } catch {
    // If IndexedDB fails or is blocked, fall back to sync localStorage
  }
  return loadPersistedStateSync();
}

/**
 * Dual persistence strategy:
 * 1. Synchronously updates localStorage mirror for instantaneous zero-latency boot.
 * 2. Asynchronously writes full payload to IndexedDB.
 */
export async function savePersistedState(state: PersistedAppState): Promise<void> {
  // 1. Immediate mirror update for t=0 next boot
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // If state exceeds 5MB localStorage quota, store lightweight mirror without old history
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const lightweight: PersistedAppState = {
          ...state,
          history: Array.isArray(state.history)
            ? state.history.slice(0, 25)
            : state.history,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
      }
    } catch {
      // Quota exceeded
    }
  }

  // 2. Persist full state into IndexedDB
  try {
    await set(STORAGE_KEY, state);
  } catch {
    // IndexedDB fallback handled
  }
}

/**
 * Immediately clears cloud credentials from local state upon 401/unauthorized.
 */
export function clearPersistedSessionSync(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = loadPersistedStateSync();
      if (current) {
        current.sharedSpaceCode = null;
        current.hasPendingCloudPush = false;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      }
    }
  } catch {
    // Ignore
  }
}
