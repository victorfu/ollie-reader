import { logger } from "../utils/logger";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface PendingChanges {
  upsertIds: string[];
  deleteIds: string[];
  sourceDirty: boolean;
}

export interface AutosaveQueueOptions {
  commit: (changes: PendingChanges) => Promise<void>;
  /** 已存在 Firestore 的題目 id（刪除時才需要送 delete）。 */
  persistedIds: Iterable<string>;
  delayMs: number;
  onStatusChange: (status: AutosaveStatus) => void;
}

interface InFlight {
  upserts: ReadonlyMap<string, number>;
  promise: Promise<void>;
}

/**
 * 裁題畫面的自動儲存佇列（spec §8.4）。每個變更帶遞增版本號：
 * 成功後只移除「版本沒變」的項目，送出期間又被修改的 id 會留到下一批。
 */
export class AutosaveQueue {
  private commit: (changes: PendingChanges) => Promise<void>;
  private readonly delayMs: number;
  private readonly onStatusChange: (status: AutosaveStatus) => void;
  private readonly persisted: Set<string>;
  private readonly upserts = new Map<string, number>();
  private readonly deletes = new Set<string>();
  private sourceVersion: number | null = null;
  private version = 0;
  private inFlight: InFlight | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = true;

  constructor(options: AutosaveQueueOptions) {
    this.commit = options.commit;
    this.delayMs = options.delayMs;
    this.onStatusChange = options.onStatusChange;
    this.persisted = new Set(options.persistedIds);
  }

  setCommit(commit: (changes: PendingChanges) => Promise<void>): void {
    this.commit = commit;
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.clearTimer();
  }

  hasPending(): boolean {
    return this.upserts.size > 0 || this.deletes.size > 0 || this.sourceVersion !== null;
  }

  markUpsert = (id: string): void => {
    this.version += 1;
    this.upserts.set(id, this.version);
    this.deletes.delete(id);
    this.schedule();
  };

  markDelete = (id: string): void => {
    this.upserts.delete(id);
    if (this.persisted.has(id) || this.inFlight?.upserts.has(id)) {
      this.deletes.add(id);
    }
    this.schedule();
  };

  markSourceDirty = (): void => {
    this.version += 1;
    this.sourceVersion = this.version;
    this.schedule();
  };

  flush = async (): Promise<void> => {
    this.clearTimer();
    while (this.inFlight) {
      try {
        await this.inFlight.promise;
      } catch {
        // 失敗由原本那次 flush 處理
      }
    }
    if (!this.hasPending()) return;

    const upserts = new Map(this.upserts);
    const deletes = new Set(this.deletes);
    const sourceVersion = this.sourceVersion;
    const promise = (async () =>
      this.commit({
        upsertIds: [...upserts.keys()],
        deleteIds: [...deletes],
        sourceDirty: sourceVersion !== null,
      }))();
    this.inFlight = { upserts, promise };
    this.onStatusChange("saving");

    try {
      await promise;
      for (const [id, version] of upserts) {
        this.persisted.add(id);
        if (this.upserts.get(id) === version) this.upserts.delete(id);
      }
      for (const id of deletes) {
        this.persisted.delete(id);
        this.deletes.delete(id);
      }
      if (this.sourceVersion === sourceVersion) this.sourceVersion = null;
      this.inFlight = null;
      this.onStatusChange(this.hasPending() ? "saving" : "saved");
    } catch (error) {
      this.inFlight = null;
      // 這批送出失敗，代表這些 id 都沒有真的寫進 Firestore：
      // 不是「已存在」的題目就不該排入刪除（該題的 upsert 已被 markDelete 移除，
      // 送出不存在的文件的刪除，Firestore 規則會擋下並讓整個 batch 失敗，見 I1）。
      for (const id of [...this.deletes]) {
        if (!this.persisted.has(id)) this.deletes.delete(id);
      }
      logger.warn("[autosave] commit failed", error);
      this.onStatusChange("error");
    }
  };

  private schedule(): void {
    if (!this.active) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
