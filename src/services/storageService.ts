import { get, set } from 'idb-keyval';

const STORAGE_KEY = 'carrinhocompras_pwa_state_v1';
const PWA_INSTALL_BANNER_DISMISSED_KEY = 'pwa_install_banner_dismissed';

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
 * 1. Synchronously updates a lightweight localStorage mirror for instantaneous t=0 boot
 *    (capping old history so JSON.stringify stays fast on every list interaction).
 * 2. Asynchronously writes the full, unrestricted payload to IndexedDB.
 */
export async function savePersistedState(state: PersistedAppState): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const mirror: PersistedAppState =
        Array.isArray(state.history) && state.history.length > 25
          ? { ...state, history: state.history.slice(0, 25) }
          : state;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mirror));
    }
  } catch {
    // If state still exceeds localStorage quota, store mirror without history
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const lightweight: PersistedAppState = {
          ...state,
          history: [],
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
      }
    } catch {
      // Quota exceeded
    }
  }

  try {
    await set(STORAGE_KEY, state);
  } catch {
    // IndexedDB fallback handled
  }
}

/**
 * Updates only cloud sync metadata in persisted storage without rebuilding or
 * re-serializing the full state when nothing else changed.
 */
export async function updatePersistedSyncMetadata(meta: {
  hasPendingCloudPush?: boolean;
  lastSyncedAtIso?: string | null;
  lastAppliedRemoteTimestampMs?: number;
}): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = loadPersistedStateSync();
      if (current) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...current, ...meta }),
        );
      }
    }
  } catch {
    // Ignore localStorage metadata write failures
  }

  try {
    const existing = await get<PersistedAppState>(STORAGE_KEY);
    if (existing && typeof existing === 'object') {
      await set(STORAGE_KEY, { ...existing, ...meta });
    }
  } catch {
    // Ignore IndexedDB metadata write failures
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

export function isPwaInstallBannerDismissed(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.localStorage.getItem(PWA_INSTALL_BANNER_DISMISSED_KEY))
    );
  } catch {
    return false;
  }
}

export function dismissPwaInstallBanner(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PWA_INSTALL_BANNER_DISMISSED_KEY, '1');
    }
  } catch {
    // Ignore storage access restrictions
  }
}
