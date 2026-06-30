import type { DailyProgress } from "./logic/dailyTasks";
import type { Wonderdex } from "./logic/wonderdex";
import type { WonderAcademyAudioSettings, WonderAcademyElement } from "../../../types/wonderAcademy";
import { normalizeAudioSettings } from "./wonderAcademyAudio";
import {
  fieldSkillForElements,
  type CreatureSpecies,
  type OwnedCreature,
} from "./wonderAcademyCreatures";

export const WONDER_ACADEMY_SCHEMA_VERSION = 2;
export const WONDER_ACADEMY_CLOUD_DOC = "wonderAcademy";
const LEGACY_CLOUD_DOC = "wonderAcademyCollector";
const LOCAL_CACHE_PREFIX = "wonder-academy-game-v3";
const LEGACY_LOCAL_CACHE_PREFIX = "wonder-academy-game-v2";
const PENDING_PREFIX = "wonder-academy-pending-v1";

export type WonderAcademyProgressData = {
  playerName: string;
  team: OwnedCreature[];
  dex: Wonderdex;
  stardust: number;
  snacks: Record<string, number>;
  customCreatures: CreatureSpecies[];
  wardensDefeated: string[];
  clearedNodes: string[];
  shinyDex: string[];
  dexRewardsClaimed: number[];
  lastDailyReward: string | null;
  daily: DailyProgress | null;
  audioSettings: WonderAcademyAudioSettings;
};

export type WonderAcademySaveStatus =
  | "idle"
  | "loading"
  | "saving"
  | "saved"
  | "pending"
  | "failed";

export type WonderAcademySaveRecord = {
  schemaVersion: typeof WONDER_ACADEMY_SCHEMA_VERSION;
  updatedAt: number;
  data: WonderAcademyProgressData;
};

export type WonderAcademyCachedSave = WonderAcademySaveRecord & {
  source: "local" | "legacy-local" | "pending";
};

export type WonderAcademyLoadResult = {
  data: WonderAcademyProgressData | null;
  source: "cloud" | "local" | "legacy-local" | "pending" | "empty";
  status: WonderAcademySaveStatus;
  hasUnsyncedLocalProgress: boolean;
};

export type WonderAcademySaveResult = {
  status: "saved" | "pending";
  updatedAt: number;
};

export type WonderAcademyPendingSyncResult =
  | WonderAcademySaveResult
  | { status: "idle"; updatedAt: null };

export type WonderAcademyCloudAdapter = {
  load: (uid: string) => Promise<WonderAcademySaveRecord | null>;
  save: (uid: string, record: WonderAcademySaveRecord) => Promise<void>;
};

type FreshSaveSource = Exclude<WonderAcademyLoadResult["source"], "empty">;
type FreshSaveRecord = WonderAcademySaveRecord & { source: FreshSaveSource };

type LoadOptions = {
  uid: string;
  cloud?: WonderAcademyCloudAdapter;
  storage?: Storage | null;
};

type SaveOptions = {
  uid: string;
  data: WonderAcademyProgressData;
  cloud?: WonderAcademyCloudAdapter;
  storage?: Storage | null;
  now?: () => number;
};

type CheckpointOptions = {
  uid: string;
  data: WonderAcademyProgressData;
  storage?: Storage | null;
  now?: () => number;
  queuePending?: boolean;
};

type PendingSyncOptions = {
  uid: string;
  cloud?: WonderAcademyCloudAdapter;
  storage?: Storage | null;
};

const keyFor = (prefix: string, uid: string): string => `${prefix}-${uid}`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function numberRecord(value: unknown): Record<string, number> {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => (
      typeof entry[1] === "number" && Number.isFinite(entry[1])
    )),
  );
}

function defaultStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readStorage(storage: Storage | null | undefined, key: string): unknown {
  if (!storage) return null;
  try {
    return parseJson(storage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | null | undefined, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota and privacy-mode failures should not break gameplay.
  }
}

function removeStorage(storage: Storage | null | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage unavailability.
  }
}

function normalizeCustomCreatures(value: unknown): CreatureSpecies[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const elements = Array.isArray(record.elements)
      ? (record.elements as WonderAcademyElement[])
      : [];
    const fieldSkillId =
      typeof record.fieldSkillId === "string" && record.fieldSkillId.trim().length > 0
        ? record.fieldSkillId
        : fieldSkillForElements(elements);
    return [{ ...(record as unknown as CreatureSpecies), fieldSkillId }];
  });
}

export function normalizeWonderAcademySave(input: unknown): WonderAcademyProgressData | null {
  const parsed = asRecord(input);
  if (!parsed || !Array.isArray(parsed.team)) return null;

  return {
    playerName: typeof parsed.playerName === "string" ? parsed.playerName : "",
    team: parsed.team as OwnedCreature[],
    dex: (asRecord(parsed.dex) ?? {}) as Wonderdex,
    stardust: typeof parsed.stardust === "number" && Number.isFinite(parsed.stardust)
      ? parsed.stardust
      : 0,
    snacks: numberRecord(parsed.snacks),
    customCreatures: normalizeCustomCreatures(parsed.customCreatures),
    wardensDefeated: stringArray(parsed.wardensDefeated),
    clearedNodes: stringArray(parsed.clearedNodes),
    shinyDex: stringArray(parsed.shinyDex),
    dexRewardsClaimed: Array.isArray(parsed.dexRewardsClaimed)
      ? parsed.dexRewardsClaimed.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      : [],
    lastDailyReward: typeof parsed.lastDailyReward === "string" ? parsed.lastDailyReward : null,
    daily: asRecord(parsed.daily) ? (parsed.daily as DailyProgress) : null,
    audioSettings: normalizeAudioSettings(asRecord(parsed.audioSettings)),
  };
}

function normalizeRecord(input: unknown): WonderAcademySaveRecord | null {
  const parsed = asRecord(input);
  if (!parsed) return null;
  const data = normalizeWonderAcademySave(asRecord(parsed.data) ? parsed.data : input);
  if (!data) return null;
  const updatedAt =
    typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
      ? parsed.updatedAt
      : 0;
  return {
    schemaVersion: WONDER_ACADEMY_SCHEMA_VERSION,
    updatedAt,
    data,
  };
}

export function readWonderAcademyCache(
  uid: string,
  storage: Storage | null = defaultStorage(),
): WonderAcademyCachedSave | null {
  const modern = normalizeRecord(readStorage(storage, keyFor(LOCAL_CACHE_PREFIX, uid)));
  if (modern) return { ...modern, source: "local" };

  const legacy = normalizeRecord(readStorage(storage, keyFor(LEGACY_LOCAL_CACHE_PREFIX, uid)));
  if (legacy) return { ...legacy, updatedAt: 0, source: "legacy-local" };

  return null;
}

export function writeWonderAcademyCache(
  uid: string,
  data: WonderAcademyProgressData,
  updatedAt: number,
  storage: Storage | null = defaultStorage(),
): void {
  writeStorage(storage, keyFor(LOCAL_CACHE_PREFIX, uid), {
    schemaVersion: WONDER_ACADEMY_SCHEMA_VERSION,
    updatedAt,
    data,
  });
}

export function readWonderAcademyPending(
  uid: string,
  storage: Storage | null = defaultStorage(),
): WonderAcademyCachedSave | null {
  const pending = normalizeRecord(readStorage(storage, keyFor(PENDING_PREFIX, uid)));
  return pending ? { ...pending, source: "pending" } : null;
}

export function writeWonderAcademyPending(
  uid: string,
  data: WonderAcademyProgressData,
  updatedAt: number,
  storage: Storage | null = defaultStorage(),
): void {
  writeStorage(storage, keyFor(PENDING_PREFIX, uid), {
    schemaVersion: WONDER_ACADEMY_SCHEMA_VERSION,
    updatedAt,
    data,
  });
}

export function clearWonderAcademyPending(
  uid: string,
  storage: Storage | null = defaultStorage(),
): void {
  removeStorage(storage, keyFor(PENDING_PREFIX, uid));
}

function chooseFreshest(
  cloud: (WonderAcademySaveRecord & { source: "cloud" }) | null,
  pending: WonderAcademyCachedSave | null,
  local: WonderAcademyCachedSave | null,
): FreshSaveRecord | null {
  const candidates: FreshSaveRecord[] = [];
  if (cloud) candidates.push(cloud);
  if (pending) candidates.push(pending);
  if (local) candidates.push(local);
  const [first, ...rest] = candidates;
  if (!first) return null;
  return rest.reduce((freshest, candidate) =>
    candidate.updatedAt > freshest.updatedAt ? candidate : freshest,
    first,
  );
}

export async function loadWonderAcademySave({
  uid,
  cloud = firestoreWonderAcademyCloudAdapter,
  storage = defaultStorage(),
}: LoadOptions): Promise<WonderAcademyLoadResult> {
  const local = readWonderAcademyCache(uid, storage);
  const pending = readWonderAcademyPending(uid, storage);
  let cloudRecord: (WonderAcademySaveRecord & { source: "cloud" }) | null = null;
  let cloudFailed = false;

  try {
    const loaded = await cloud.load(uid);
    cloudRecord = loaded ? { ...loaded, source: "cloud" } : null;
  } catch {
    cloudFailed = true;
  }

  const selected = chooseFreshest(cloudRecord, pending, local);
  if (!selected) {
    return {
      data: null,
      source: "empty",
      status: cloudFailed ? "failed" : "idle",
      hasUnsyncedLocalProgress: false,
    };
  }

  if (selected.source === "cloud") {
    writeWonderAcademyCache(uid, selected.data, selected.updatedAt, storage);
    if (pending && pending.updatedAt <= selected.updatedAt) {
      clearWonderAcademyPending(uid, storage);
    }
    return {
      data: selected.data,
      source: "cloud",
      status: "saved",
      hasUnsyncedLocalProgress: false,
    };
  }

  const hasUnsyncedLocalProgress =
    selected.source === "pending"
    || (!cloudFailed && (selected.source === "local" || selected.source === "legacy-local"));

  return {
    data: selected.data,
    source: selected.source,
    status: hasUnsyncedLocalProgress ? "pending" : cloudFailed ? "failed" : "saved",
    hasUnsyncedLocalProgress,
  };
}

export async function saveWonderAcademyProgress({
  uid,
  data,
  cloud = firestoreWonderAcademyCloudAdapter,
  storage = defaultStorage(),
  now = Date.now,
}: SaveOptions): Promise<WonderAcademySaveResult> {
  const updatedAt = now();
  const record: WonderAcademySaveRecord = {
    schemaVersion: WONDER_ACADEMY_SCHEMA_VERSION,
    updatedAt,
    data,
  };

  writeWonderAcademyCache(uid, data, updatedAt, storage);

  try {
    await cloud.save(uid, record);
    clearWonderAcademyPending(uid, storage);
    return { status: "saved", updatedAt };
  } catch {
    writeWonderAcademyPending(uid, data, updatedAt, storage);
    return { status: "pending", updatedAt };
  }
}

export function checkpointWonderAcademyProgress({
  uid,
  data,
  storage = defaultStorage(),
  now = Date.now,
  queuePending = true,
}: CheckpointOptions): WonderAcademySaveRecord {
  const updatedAt = now();
  const record: WonderAcademySaveRecord = {
    schemaVersion: WONDER_ACADEMY_SCHEMA_VERSION,
    updatedAt,
    data,
  };

  writeWonderAcademyCache(uid, data, updatedAt, storage);
  if (queuePending) {
    writeWonderAcademyPending(uid, data, updatedAt, storage);
  }

  return record;
}

export async function syncWonderAcademyPendingSave({
  uid,
  cloud = firestoreWonderAcademyCloudAdapter,
  storage = defaultStorage(),
}: PendingSyncOptions): Promise<WonderAcademyPendingSyncResult> {
  const pending = readWonderAcademyPending(uid, storage);
  if (!pending) return { status: "idle", updatedAt: null };

  const record: WonderAcademySaveRecord = {
    schemaVersion: WONDER_ACADEMY_SCHEMA_VERSION,
    updatedAt: pending.updatedAt,
    data: pending.data,
  };

  try {
    await cloud.save(uid, record);
    writeWonderAcademyCache(uid, pending.data, pending.updatedAt, storage);
    clearWonderAcademyPending(uid, storage);
    return { status: "saved", updatedAt: pending.updatedAt };
  } catch {
    return { status: "pending", updatedAt: pending.updatedAt };
  }
}

async function readCloudDoc(uid: string, docId: string): Promise<WonderAcademySaveRecord | null> {
  const [{ doc, getDoc }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid, "littleGames", docId);
  const snap = await getDoc(ref);
  return snap.exists() ? normalizeRecord(snap.data()) : null;
}

export const firestoreWonderAcademyCloudAdapter: WonderAcademyCloudAdapter = {
  async load(uid) {
    return (await readCloudDoc(uid, WONDER_ACADEMY_CLOUD_DOC))
      ?? (await readCloudDoc(uid, LEGACY_CLOUD_DOC));
  },
  async save(uid, record) {
    const [{ doc, setDoc }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("../../../utils/firebaseUtil"),
    ]);
    const ref = doc(db, "gameProgress", uid, "littleGames", WONDER_ACADEMY_CLOUD_DOC);
    await setDoc(ref, record);
  },
};

export const localOnlyWonderAcademyCloudAdapter: WonderAcademyCloudAdapter = {
  async load() {
    return null;
  },
  async save() {
    return undefined;
  },
};
