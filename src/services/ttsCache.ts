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
const DB_VERSION = 2; // Bumped for index addition
const MAX_CACHE_SIZE = 50; // Maximum number of cached items in memory
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_DB_ENTRIES = 200; // Hard cap to avoid unbounded IndexedDB growth
const ENFORCE_LIMIT_DEBOUNCE_MS = 5000; // Debounce time for enforceDbLimit

class TTSCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private db: IDBDatabase | null = null;
  private pruneTimer: number | null = null;
  private enforceLimitTimer: number | null = null;
  private entryCount = 0; // Track entry count to avoid frequent limit checks

  constructor() {
    this.initDB()
      .then(() => {
        // Best-effort pruning at startup
        void this.prune();
        // Count entries on startup
        void this.countEntries();
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
   * Initialize IndexedDB with timestamp index for efficient sorting
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
        
        // Delete old store if exists and recreate with index
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        // Add index on timestamp for efficient sorting
        store.createIndex("timestamp", "timestamp", { unique: false });
      };
    });
  }

  /**
   * Count entries in IndexedDB (called once on startup)
   */
  private async countEntries(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        this.entryCount = request.result;
        resolve();
      };
      request.onerror = () => resolve();
    });
  }

  /**
   * Generate cache key from TTS parameters
   */
  getCacheKey(text: string, speakingRate: number): string {
    return JSON.stringify({ text, speakingRate });
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
        this.entryCount++;
        resolve();
        // Debounced limit enforcement - only check when near limit
        this.scheduleEnforceDbLimit();
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

      request.onsuccess = () => {
        this.entryCount = Math.max(0, this.entryCount - 1);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Prune expired entries from IndexedDB using timestamp index
   */
  async prune(): Promise<void> {
    if (!this.db) return;

    const expiredBefore = Date.now() - CACHE_EXPIRY_MS;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("timestamp");
      // Use index to efficiently find old entries
      const range = IDBKeyRange.upperBound(expiredBefore);
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          this.entryCount = Math.max(0, this.entryCount - deletedCount);
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Schedule debounced limit enforcement
   */
  private scheduleEnforceDbLimit(): void {
    // Only schedule if we're approaching the limit
    if (this.entryCount < MAX_DB_ENTRIES * 0.9) return;

    // Clear existing timer
    if (this.enforceLimitTimer !== null) {
      window.clearTimeout(this.enforceLimitTimer);
    }

    // Schedule new enforcement
    this.enforceLimitTimer = window.setTimeout(() => {
      this.enforceLimitTimer = null;
      void this.enforceDbLimit();
    }, ENFORCE_LIMIT_DEBOUNCE_MS);
  }

  /**
   * Ensure IndexedDB does not exceed hard cap. Uses timestamp index for efficient sorting.
   */
  private async enforceDbLimit(): Promise<void> {
    if (!this.db) return;
    if (this.entryCount <= MAX_DB_ENTRIES) return;

    const entriesToDelete = this.entryCount - MAX_DB_ENTRIES;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("timestamp");
      // Open cursor on timestamp index (already sorted by timestamp)
      const request = index.openCursor();
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;
        if (cursor && deletedCount < entriesToDelete) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          this.entryCount = Math.max(0, this.entryCount - deletedCount);
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
