import type { TravelMissionStepKind } from "../components/TravelEnglish/travelMissionUtils";
import {
  deleteField,
  doc,
  FieldPath,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";

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
    // Derive this value from the topic-keyed stamps. Older clients wrote the
    // aggregate independently, so it can be stale after concurrent tabs.
    totalCompleted: Object.keys(
      (data.stamps as Record<string, unknown> | undefined) ?? {},
    ).length,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

export async function fetchTravelProgress(uid: string): Promise<TravelProgress | null> {
  const docRef = doc(db, TRAVEL_PROGRESS_COLLECTION, uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return normalizeTravelProgress(uid, docSnap.data());
}

export async function getOrCreateTravelProgress(uid: string): Promise<TravelProgress> {
  const existing = await fetchTravelProgress(uid);
  if (existing) return existing;

  const progress = createDefaultTravelProgress(uid);
  const docRef = doc(db, TRAVEL_PROGRESS_COLLECTION, uid);
  // Only create identity/timestamps. Empty map fields would erase another
  // tab's progress if that tab wins the race after our initial read.
  await setDoc(
    docRef,
    {
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return progress;
}

export async function saveTravelMissionStep(
  uid: string,
  topicId: string,
  step: TravelMissionStepKind,
  now = Date.now(),
): Promise<void> {
  const docRef = doc(db, TRAVEL_PROGRESS_COLLECTION, uid);
  await updateDoc(
    docRef,
    new FieldPath("inProgress", topicId),
    { step, updatedAt: now },
    "updatedAt",
    serverTimestamp(),
  );
}

export async function saveTravelMissionCompletion(
  uid: string,
  topicId: string,
  now = Date.now(),
  stars = 3,
): Promise<void> {
  const docRef = doc(db, TRAVEL_PROGRESS_COLLECTION, uid);
  await updateDoc(
    docRef,
    new FieldPath("stamps", topicId, "completedAt"),
    now,
    new FieldPath("stamps", topicId, "stars"),
    stars,
    new FieldPath("stamps", topicId, "attempts"),
    increment(1),
    new FieldPath("inProgress", topicId),
    deleteField(),
    "updatedAt",
    serverTimestamp(),
  );
}
