/**
 * PDF Session Cache Service
 * Provides IndexedDB caching for PDF blob and extracted text data.
 * Cache is only valid for the current browser session (tab).
 */

import type { ExtractResponse } from "../types/pdf";
import {
  choosePdfSessionId,
  claimPdfSessionId,
} from "../utils/pdfSessionIdentity";

const DB_NAME = "ollie-pdf-session-cache";
const DB_VERSION = 1;
const STORE_NAME = "pdf-cache";
const SESSION_ID_KEY = "ollie-pdf-session-id";
const LEGACY_CACHE_KEY = "last-pdf";
const CACHE_KEY_PREFIX = "pdf";
const OWNERSHIP_CHANNEL_NAME = "ollie-pdf-session-ownership-v1";
const OWNERSHIP_PROBE_TIMEOUT_MS = 50;
const OWNERSHIP_LOCK_PREFIX = "ollie-pdf-session:";

let inMemorySessionId: string | null = null;
let sessionIdPromise: Promise<string> | null = null;
let claimedSessionId: string | null = null;
let ownershipChannel: BroadcastChannel | null | undefined;
const ownershipProbeResolvers = new Map<
  string,
  (claimed: boolean | null) => void
>();
const heldSessionLocks = new Set<string>();
const pendingSessionLockClaims = new Map<string, Promise<boolean>>();

type OwnershipMessage =
  | {
      type: "probe";
      probeId: string;
      sessionId: string;
    }
  | {
      type: "owned";
      probeId: string;
      sessionId: string;
    };

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOwnershipChannel(): BroadcastChannel | null {
  if (ownershipChannel !== undefined) return ownershipChannel;
  if (typeof BroadcastChannel === "undefined") {
    ownershipChannel = null;
    return ownershipChannel;
  }

  try {
    ownershipChannel = new BroadcastChannel(OWNERSHIP_CHANNEL_NAME);
    ownershipChannel.onmessage = (event: MessageEvent<OwnershipMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;

      if (
        message.type === "probe" &&
        claimedSessionId === message.sessionId
      ) {
        ownershipChannel?.postMessage({
          type: "owned",
          probeId: message.probeId,
          sessionId: message.sessionId,
        } satisfies OwnershipMessage);
        return;
      }

      if (message.type === "owned") {
        ownershipProbeResolvers.get(message.probeId)?.(true);
      }
    };
  } catch {
    ownershipChannel = null;
  }

  return ownershipChannel;
}

async function isSessionClaimedByAnotherTab(
  sessionId: string,
): Promise<boolean | null> {
  const channel = getOwnershipChannel();
  if (!channel) {
    // Without any cross-tab primitive we cannot distinguish a refresh from a
    // cloned sessionStorage snapshot. Rekey conservatively so one tab can
    // never read or overwrite another tab's PDF cache.
    return null;
  }

  const probeId = createSessionId();
  return new Promise<boolean | null>((resolve) => {
    let settled = false;
    const finish = (claimed: boolean | null) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeoutId);
      ownershipProbeResolvers.delete(probeId);
      resolve(claimed);
    };
    const timeoutId = globalThis.setTimeout(
      // Silence is ambiguous: the owner can be frozen or busy. Return an
      // indeterminate result so the chooser rekeys instead of reusing a copied
      // sessionStorage id.
      // Browsers without Web Locks therefore trade refresh restoration for
      // strict tab isolation when no timely ownership acknowledgement exists.
      () => finish(null),
      OWNERSHIP_PROBE_TIMEOUT_MS,
    );

    ownershipProbeResolvers.set(probeId, finish);
    channel.postMessage({
      type: "probe",
      probeId,
      sessionId,
    } satisfies OwnershipMessage);
  });
}

function getSessionLockManager(): LockManager | null {
  if (typeof navigator === "undefined") return null;
  return navigator.locks ?? null;
}

function tryClaimSessionLock(
  lockManager: LockManager,
  sessionId: string,
): Promise<boolean> {
  if (heldSessionLocks.has(sessionId)) return Promise.resolve(true);

  const pendingClaim = pendingSessionLockClaims.get(sessionId);
  if (pendingClaim) return pendingClaim;

  const claim = new Promise<boolean>((resolve, reject) => {
    let outcomeSettled = false;
    const settle = (claimed: boolean) => {
      if (outcomeSettled) return;
      outcomeSettled = true;
      resolve(claimed);
    };

    void lockManager
      .request(
        `${OWNERSHIP_LOCK_PREFIX}${sessionId}`,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock) {
            settle(false);
            return;
          }

          heldSessionLocks.add(sessionId);
          settle(true);

          // The browser releases this exclusive lock automatically when the
          // document is destroyed. Keeping it for the document lifetime makes
          // ownership observable even while a background tab is frozen.
          await new Promise<void>(() => undefined);
        },
      )
      .catch((error: unknown) => {
        if (!outcomeSettled) reject(error);
      });
  }).finally(() => {
    pendingSessionLockClaims.delete(sessionId);
  });

  pendingSessionLockClaims.set(sessionId, claim);
  return claim;
}

async function resolveSessionId(): Promise<string> {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    const lockManager = getSessionLockManager();
    let selected: string;

    if (lockManager) {
      try {
        selected = await claimPdfSessionId(
          existing,
          (sessionId) => tryClaimSessionLock(lockManager, sessionId),
          createSessionId,
        );
      } catch {
        // If a browser exposes Web Locks but rejects the request, ownership is
        // ambiguous. Rekey conservatively instead of risking a copied tab id.
        selected = createSessionId();
      }
    } else {
      selected = await choosePdfSessionId(
        existing,
        isSessionClaimedByAnotherTab,
        createSessionId,
      );
    }

    sessionStorage.setItem(SESSION_ID_KEY, selected);
    claimedSessionId = selected;
    return selected;
  } catch {
    inMemorySessionId ??= createSessionId();
    claimedSessionId = inMemorySessionId;
    return inMemorySessionId;
  }
}

function getSessionId(): Promise<string> {
  sessionIdPromise ??= resolveSessionId();
  return sessionIdPromise;
}

export function createPdfSessionCacheKey(
  ownerUid: string,
  sessionId: string,
): string {
  return `${CACHE_KEY_PREFIX}:${encodeURIComponent(ownerUid)}:${sessionId}`;
}

async function currentCacheKey(ownerUid: string): Promise<string> {
  return createPdfSessionCacheKey(ownerUid, await getSessionId());
}

interface CachedPdfData {
  key: string;
  ownerUid: string;
  blob: Blob;
  result: ExtractResponse | null;
  filename: string;
  documentId?: string;
  timestamp: number;
  scrollPosition?: number;
}

class PdfSessionCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB().catch((err) => {
      console.warn("Failed to initialize PDF session cache DB:", err);
    });
  }

  /**
   * Initialize IndexedDB
   */
  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
    });
  }

  /**
   * Save PDF blob and extracted result to IndexedDB cache.
   * Automatically overwrites any existing cached PDF.
   */
  async savePdfToCache(
    ownerUid: string,
    blob: Blob,
    result: ExtractResponse | null,
    filename: string,
    documentId: string,
    migratedScrollPosition?: number,
  ): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    const cacheKey = await currentCacheKey(ownerUid);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(cacheKey);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as CachedPdfData | undefined;
        const isSameDocument = existing?.documentId === documentId;
        const data: CachedPdfData = {
          key: cacheKey,
          ownerUid,
          blob,
          result:
            result ?? (isSameDocument ? (existing?.result ?? null) : null),
          filename,
          documentId,
          timestamp: isSameDocument
            ? (existing?.timestamp ?? Date.now())
            : Date.now(),
          scrollPosition: isSameDocument
            ? existing?.scrollPosition
            : migratedScrollPosition,
        };

        const putRequest = store.put(data);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  /**
   * Load cached PDF data from IndexedDB.
   * Returns null if no cache exists or session is invalid.
   */
  async loadPdfFromCache(ownerUid: string): Promise<{
    blob: Blob;
    result: ExtractResponse | null;
    filename: string;
    documentId?: string;
    scrollPosition?: number;
  } | null> {
    await this.initPromise;
    if (!this.db) return null;

    const cacheKey = await currentCacheKey(ownerUid);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const data = request.result as CachedPdfData | undefined;
        if (data?.ownerUid === ownerUid) {
          resolve({
            blob: data.blob,
            result: data.result ?? null,
            filename: data.filename,
            documentId: data.documentId,
            scrollPosition: data.scrollPosition,
          });
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Save scroll position to the existing cached PDF data.
   */
  async saveScrollPosition(
    ownerUid: string,
    scrollPosition: number,
    documentId?: string,
  ): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    const cacheKey = await currentCacheKey(ownerUid);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(cacheKey);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existingData = getRequest.result as CachedPdfData | undefined;
        if (
          !existingData ||
          existingData.ownerUid !== ownerUid ||
          (documentId !== undefined &&
            existingData.documentId !== documentId)
        ) {
          resolve();
          return;
        }

        const putRequest = store.put({
          ...existingData,
          scrollPosition,
        } satisfies CachedPdfData);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  /**
   * Clear all cached PDF data from IndexedDB.
   */
  async clearPdfCache(ownerUid: string): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    const cacheKey = await currentCacheKey(ownerUid);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(cacheKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /** Remove the pre-owner cache left by versions that used a global key. */
  async clearLegacyPdfCache(): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(LEGACY_CACHE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Export singleton instance
export const pdfSessionCache = new PdfSessionCacheService();
