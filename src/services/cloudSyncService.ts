import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { SharedSpaceStatePayload } from '../types/shopping';

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyCIYnU_4dW56K3xjJ_2DAw0UpMn2h8sJvE',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'carrinho-de-compras-35ded.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || 'carrinho-de-compras-35ded',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'carrinho-de-compras-35ded.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123154169081',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:123154169081:android:9f4760cdc6befe5e47f628',
};

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let initError: string | null = null;

/**
 * Recursively removes `undefined` values because Firestore JS SDK rejects any
 * payload containing `undefined` fields.
 */
export function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out as T;
  }
  return value;
}

function ensureFirebase(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  try {
    if (getApps().length === 0) {
      appInstance = initializeApp(firebaseConfig);
    } else {
      appInstance = getApps()[0];
    }

    try {
      firestoreInstance = initializeFirestore(appInstance, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      firestoreInstance = getFirestore(appInstance);
    }

    initError = null;
    return firestoreInstance;
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
    throw new Error(`Não foi possível inicializar o Firebase: ${initError}`);
  }
}

export const CloudSyncService = {
  isFirebaseReady(): boolean {
    return firestoreInstance !== null;
  },

  getInitializationError(): string | null {
    return initError;
  },

  initializeFirebase(): boolean {
    try {
      ensureFirebase();
      return true;
    } catch {
      return false;
    }
  },

  generateSpaceCode(): string {
    const prefixes = ['CASA', 'LISTA', 'FAMILIA', 'MERCADO'];
    const arr = new Uint32Array(2);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      arr[0] = Math.floor(Math.random() * 10000);
      arr[1] = Math.floor(Math.random() * prefixes.length);
    }
    const digits = 1000 + (arr[0] % 9000);
    const prefix = prefixes[arr[1] % prefixes.length];
    return `${prefix}-${digits}`;
  },

  normalizeSpaceCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
  },

  async fetchSharedSpace(
    spaceCode: string,
  ): Promise<Record<string, unknown> | null> {
    const db = ensureFirebase();
    try {
      await enableNetwork(db).catch(() => {});
      const ref = doc(
        collection(db, 'shared_spaces'),
        this.normalizeSpaceCode(spaceCode),
      );
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
    } catch (err) {
      throw new Error(this.formatFirestoreError(err));
    }
  },

  async pushStateToSharedSpace(params: {
    spaceCode: string;
    stateMap: SharedSpaceStatePayload;
    clientId: string;
    verifyServer?: boolean;
  }): Promise<void> {
    const db = ensureFirebase();
    const normalizedCode = this.normalizeSpaceCode(params.spaceCode);
    const sanitizedState = sanitizeForFirestore(params.stateMap);
    const payload = {
      ...sanitizedState,
      spaceCode: normalizedCode,
      updatedByClientId: params.clientId,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
      updatedAtIso: new Date().toISOString(),
    };

    try {
      if (params.verifyServer) {
        await disableNetwork(db).catch(() => {});
        await enableNetwork(db).catch(() => {});
      }
      const ref = doc(collection(db, 'shared_spaces'), normalizedCode);
      await setDoc(ref, payload, { merge: true });
    } catch (err) {
      throw new Error(this.formatFirestoreError(err));
    }
  },

  listenToSharedSpace(params: {
    spaceCode: string;
    onData: (data: Record<string, unknown>) => void;
    onError?: (err: Error) => void;
  }): Unsubscribe {
    const db = ensureFirebase();
    const ref = doc(
      collection(db, 'shared_spaces'),
      this.normalizeSpaceCode(params.spaceCode),
    );
    return onSnapshot(
      ref,
      (snapshot) => {
        const data = snapshot.data();
        if (data) {
          params.onData(data as Record<string, unknown>);
        }
      },
      (error) => {
        params.onError?.(new Error(this.formatFirestoreError(error)));
      },
    );
  },

  formatFirestoreError(err: unknown): string {
    const e = err as { code?: string; message?: string };
    const msg = e?.message ?? String(err);
    if (msg.includes('firestore.googleapis.com') || msg.includes('has not been used')) {
      return 'A API do Cloud Firestore está desativada no projeto Firebase (carrinho-de-compras-35ded).';
    }
    if (e?.code === 'permission-denied') {
      return 'Permissão negada no Firestore. Verifique as Regras de segurança em shared_spaces.';
    }
    if (e?.code === 'unavailable') {
      return 'Servidor do Firestore indisponível no momento. Verifique sua conexão.';
    }
    return `Erro no Firestore${e?.code ? ` (${e.code})` : ''}: ${msg}`;
  },
};
