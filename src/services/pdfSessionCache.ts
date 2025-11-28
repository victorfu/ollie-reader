/**
 * PDF Session Cache Service
 * Provides IndexedDB caching for PDF blob and extracted text data.
 * Cache is only valid for the current browser session (tab).
 */

import type { ExtractResponse } from "../types/pdf";

const DB_NAME = "ollie-pdf-session-cache";
const DB_VERSION = 1;
const STORE_NAME = "pdf-cache";
const SESSION_FLAG_KEY = "ollie-pdf-session-active";
const CACHE_KEY = "last-pdf";

interface CachedPdfData {
  key: string;
  blob: Blob;
  result: ExtractResponse;
  filename: string;
  timestamp: number;
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
   * Check if the current session is still valid.
   * Returns true if sessionStorage flag exists, false otherwise.
   */
  isSessionValid(): boolean {
    try {
      return sessionStorage.getItem(SESSION_FLAG_KEY) === "true";
    } catch {
      return false;
    }
  }

  /**
   * Mark the current session as active.
   */
  markSessionActive(): void {
    try {
      sessionStorage.setItem(SESSION_FLAG_KEY, "true");
    } catch (err) {
      console.warn("Failed to set session flag:", err);
    }
  }

  /**
   * Save PDF blob and extracted result to IndexedDB cache.
   * Automatically overwrites any existing cached PDF.
   */
  async savePdfToCache(
    blob: Blob,
    result: ExtractResponse,
    filename: string,
  ): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    // Mark session as active when saving
    this.markSessionActive();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const data: CachedPdfData = {
        key: CACHE_KEY,
        blob,
        result,
        filename,
        timestamp: Date.now(),
      };

      const request = store.put(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Load cached PDF data from IndexedDB.
   * Returns null if no cache exists or session is invalid.
   */
  async loadPdfFromCache(): Promise<{
    blob: Blob;
    result: ExtractResponse;
    filename: string;
  } | null> {
    // Check session validity first
    if (!this.isSessionValid()) {
      // Session expired (new tab/browser session), clear old cache
      await this.clearPdfCache();
      return null;
    }

    await this.initPromise;
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const data = request.result as CachedPdfData | undefined;
        if (data) {
          resolve({
            blob: data.blob,
            result: data.result,
            filename: data.filename,
          });
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Clear all cached PDF data from IndexedDB.
   */
  async clearPdfCache(): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Export singleton instance
export const pdfSessionCache = new PdfSessionCacheService();
