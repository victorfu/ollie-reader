import type { TravelMissionStepKind } from "../components/TravelEnglish/travelMissionUtils";

const TRAVEL_PROGRESS_COLLECTION = "travelProgress";

export interface TravelPassportStamp {
  completedAt: number;
  stars: number;
  attempts: number;
}

export interface TravelMissionProgressEntry {
  step: TravelMissionStepKind;
  updatedAt: number;
}

export interface TravelProgress {
  uid: string;
  stamps: Record<string, TravelPassportStamp>;
  inProgress: Partial<Record<string, TravelMissionProgressEntry>>;
  totalCompleted: number;
  createdAt: number;
  updatedAt: number;
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return Date.now();
}

export function createDefaultTravelProgress(
  uid: string,
  now = Date.now(),
): TravelProgress {
  return {
    uid,
    stamps: {},
    inProgress: {},
    totalCompleted: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function markTravelMissionInProgress(
  progress: TravelProgress,
  topicId: string,
  step: TravelMissionStepKind,
  now = Date.now(),
): TravelProgress {
  return {
    ...progress,
    inProgress: {
      ...progress.inProgress,
      [topicId]: { step, updatedAt: now },
    },
    updatedAt: now,
  };
}

export function completeTravelMission(
  progress: TravelProgress,
  topicId: string,
  now = Date.now(),
  stars = 3,
): TravelProgress {
  const previousStamp = progress.stamps[topicId];
  const inProgress = { ...progress.inProgress };
  delete inProgress[topicId];

  const stamps = {
    ...progress.stamps,
    [topicId]: {
      completedAt: now,
      stars,
      attempts: (previousStamp?.attempts ?? 0) + 1,
    },
  };

  return {
    ...progress,
    stamps,
    inProgress,
    totalCompleted: Object.keys(stamps).length,
    updatedAt: now,
  };
}

function normalizeTravelProgress(uid: string, data: Record<string, unknown>): TravelProgress {
  return {
    uid,
    stamps: (data.stamps as Record<string, TravelPassportStamp> | undefined) ?? {},
    inProgress:
      (data.inProgress as Partial<Record<string, TravelMissionProgressEntry>> | undefined) ??
      {},
    totalCompleted:
      typeof data.totalCompleted === "number"
        ? data.totalCompleted
        : Object.keys((data.stamps as Record<string, unknown> | undefined) ?? {}).length,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

async function loadFirestore() {
  const [{ doc, getDoc, serverTimestamp, setDoc }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../utils/firebaseUtil"),
  ]);

  return { doc, getDoc, serverTimestamp, setDoc, db };
}

export async function fetchTravelProgress(uid: string): Promise<TravelProgress | null> {
  const { doc, getDoc, db } = await loadFirestore();
  const docRef = doc(db, TRAVEL_PROGRESS_COLLECTION, uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return normalizeTravelProgress(uid, docSnap.data());
}

export async function saveTravelProgress(progress: TravelProgress): Promise<void> {
  const { doc, serverTimestamp, setDoc, db } = await loadFirestore();
  const docRef = doc(db, TRAVEL_PROGRESS_COLLECTION, progress.uid);

  await setDoc(
    docRef,
    {
      uid: progress.uid,
      stamps: progress.stamps,
      inProgress: progress.inProgress,
      totalCompleted: progress.totalCompleted,
      createdAt: progress.createdAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getOrCreateTravelProgress(uid: string): Promise<TravelProgress> {
  const existing = await fetchTravelProgress(uid);
  if (existing) return existing;

  const progress = createDefaultTravelProgress(uid);
  await saveTravelProgress(progress);
  return progress;
}
