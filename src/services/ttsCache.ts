/**
 * TTS Cache Service
 * Provides in-memory and IndexedDB caching for TTS audio blobs
 */

interface CacheEntry {
  blob: Blob;
  timestamp: number;
  key: string;
}

interface PendingRequest {
  promise: Promise<Blob>;
}

const DB_NAME = "ollie-tts-cache";
const STORE_NAME = "audio-blobs";
const DB_VERSION = 1;
const MAX_CACHE_SIZE = 50; // Maximum number of cached items in memory
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_DB_ENTRIES = 200; // Hard cap to avoid unbounded IndexedDB growth

class TTSCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private db: IDBDatabase | null = null;
  private pruneTimer: number | null = null;

  constructor() {
    this.initDB()
      .then(() => {
        // Best-effort pruning at startup
        void this.prune();
        // Periodic pruning to keep storage bounded
        if (this.pruneTimer === null) {
          this.pruneTimer = window.setInterval(() => {
            void this.prune();
          }, PRUNE_INTERVAL_MS);
        }
      })
      .catch((err) => {
        console.warn("Failed to initialize TTS cache DB:", err);
      });
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<void> {
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
   * Generate cache key from TTS parameters
   */
  getCacheKey(text: string, speechRate: number, speaker: string = "0"): string {
    return JSON.stringify({ text, speechRate, speaker });
  }

  /**
   * Get cached blob from memory or IndexedDB
   */
  async get(key: string): Promise<Blob | null> {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      // Check if expired
      if (Date.now() - memEntry.timestamp > CACHE_EXPIRY_MS) {
        this.memoryCache.delete(key);
        await this.deleteFromDB(key);
        return null;
      }
      return memEntry.blob;
    }

    // Check IndexedDB
    if (!this.db) return null;

    try {
      const dbEntry = await this.getFromDB(key);
      if (dbEntry) {
        // Check if expired
        if (Date.now() - dbEntry.timestamp > CACHE_EXPIRY_MS) {
          await this.deleteFromDB(key);
          return null;
        }

        // Load into memory cache
        this.memoryCache.set(key, dbEntry);
        this.enforceCacheSize();
        return dbEntry.blob;
      }
    } catch (err) {
      console.warn("Failed to get from IndexedDB:", err);
    }

    return null;
  }

  /**
   * Set cache entry in memory and IndexedDB
   */
  async set(key: string, blob: Blob): Promise<void> {
    const entry: CacheEntry = {
      blob,
      timestamp: Date.now(),
      key,
    };

    // Save to memory
    this.memoryCache.set(key, entry);
    this.enforceCacheSize();

    // Save to IndexedDB
    try {
      await this.saveToDB(entry);
    } catch (err) {
      console.warn("Failed to save to IndexedDB:", err);
    }
  }

  /**
   * Get or create a pending request to avoid duplicate API calls
   */
  getPendingRequest(key: string): Promise<Blob> | null {
    return this.pendingRequests.get(key)?.promise || null;
  }

  /**
   * Register a pending request
   */
  setPendingRequest(key: string, promise: Promise<Blob>): void {
    this.pendingRequests.set(key, { promise });

    // Clean up after the request completes
    promise
      .finally(() => {
        this.pendingRequests.delete(key);
      })
      .catch(() => {
        // Error already handled by caller
      });
  }

  /**
   * Enforce maximum cache size (FIFO)
   */
  private enforceCacheSize(): void {
    if (this.memoryCache.size <= MAX_CACHE_SIZE) return;

    // Find oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * Get entry from IndexedDB
   */
  private async getFromDB(key: string): Promise<CacheEntry | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CacheEntry | undefined;
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save entry to IndexedDB
   */
  private async saveToDB(entry: CacheEntry): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => {
        resolve();
        // Best-effort trim after writing
        void this.enforceDbLimit();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete entry from IndexedDB
   */
  private async deleteFromDB(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Prune expired entries from IndexedDB
   */
  async prune(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      const now = Date.now();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;
        if (cursor) {
          const entry = cursor.value as CacheEntry;
          if (now - entry.timestamp > CACHE_EXPIRY_MS) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Ensure IndexedDB does not exceed hard cap. Deletes oldest entries when necessary.
   */
  private async enforceDbLimit(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      const entries: CacheEntry[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;
        if (cursor) {
          entries.push(cursor.value as CacheEntry);
          cursor.continue();
        } else {
          if (entries.length > MAX_DB_ENTRIES) {
            entries
              .sort((a, b) => a.timestamp - b.timestamp)
              .slice(0, entries.length - MAX_DB_ENTRIES)
              .forEach((entry) => {
                void this.deleteFromDB(entry.key);
              });
          }
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.pendingRequests.clear();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const ttsCache = new TTSCacheService();
