/**
 * Firestore storage for Word Practice, all under `users/{uid}`:
 * - `wordPractice/state`: the per-word practice state and AI CEFR estimates.
 * - `wordHomeworks/{id}`: one document per homework.
 *
 * At most one homework is active at a time; `state.activeHomeworkId` points at
 * it. Anything that changes both documents runs in a transaction. The `words`
 * and `cefrEstimates` maps are keyed by `practiceKey`, which can contain `.`,
 * so they are always written as whole maps, never through dotted field paths.
 * Timestamps are plain millisecond numbers.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  type DocumentSnapshot,
} from "firebase/firestore";
import type {
  CefrLevel,
  Homework,
  HomeworkWord,
  HomeworkWordProgress,
  WordPracticeState,
  WordPracticeWordState,
} from "../types/wordPractice";
import { CEFR_LEVELS } from "../utils/cefr";
import { db } from "../utils/firebaseUtil";
import { gradeTest } from "../utils/homeworkProgress";

export const EMPTY_PRACTICE_STATE: WordPracticeState = {
  activeHomeworkId: null,
  words: {},
  cefrEstimates: {},
};

const DEFAULT_COMPLETED_LIMIT = 20;

const stateRef = (uid: string) => doc(db, "users", uid, "wordPractice", "state");
const homeworkRef = (uid: string, id: string) => doc(db, "users", uid, "wordHomeworks", id);
const homeworksCollection = (uid: string) => collection(db, "users", uid, "wordHomeworks");

export const newHomeworkId = (uid: string): string => doc(homeworksCollection(uid)).id;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isCefrLevel = (value: unknown): value is CefrLevel =>
  CEFR_LEVELS.includes(value as CefrLevel);

function normalizeCefrEstimates(raw: unknown): Record<string, CefrLevel> {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, CefrLevel] => isCefrLevel(entry[1])),
  );
}

function normalizeWordState(raw: unknown): WordPracticeWordState | null {
  if (!isRecord(raw)) return null;
  return {
    missCount: isNumber(raw.missCount) ? raw.missCount : 0,
    ...(isNumber(raw.learnedAt) && { learnedAt: raw.learnedAt }),
    ...(isNumber(raw.lastMissedAt) && { lastMissedAt: raw.lastMissedAt }),
  };
}

function normalizeWords(raw: unknown): Record<string, WordPracticeWordState> {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) => {
      const wordState = normalizeWordState(value);
      return wordState ? [[key, wordState]] : [];
    }),
  );
}

/**
 * Turns whatever the state document holds into a valid state: missing or
 * malformed parts get their defaults and unusable entries are dropped. Every
 * read of the state document goes through this.
 */
function normalizeState(raw: unknown): WordPracticeState {
  const data = isRecord(raw) ? raw : {};
  return {
    activeHomeworkId:
      typeof data.activeHomeworkId === "string" && data.activeHomeworkId
        ? data.activeHomeworkId
        : null,
    words: normalizeWords(data.words),
    cefrEstimates: normalizeCefrEstimates(data.cefrEstimates),
  };
}

/** Firestore rejects `undefined` field values, so optional fields must be absent instead. */
function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withoutUndefined(item)) as T;
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== undefined)
        .map(([key, field]) => [key, withoutUndefined(field)]),
    ) as T;
  }
  return value;
}

function toHomework(snapshot: DocumentSnapshot): Homework | null {
  const data = snapshot.data();
  return data ? ({ ...data, id: snapshot.id } as Homework) : null;
}

export async function loadPracticeState(uid: string): Promise<WordPracticeState> {
  return normalizeState((await getDoc(stateRef(uid))).data());
}

/** Merges new estimates into the stored ones, leaving the rest of the state alone. */
export async function saveCefrEstimates(
  uid: string,
  estimates: Record<string, CefrLevel>,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const state = normalizeState((await tx.get(stateRef(uid))).data());
    tx.set(stateRef(uid), {
      ...state,
      cefrEstimates: normalizeCefrEstimates({ ...state.cefrEstimates, ...estimates }),
    });
  });
}

export async function getActiveHomework(uid: string): Promise<Homework | null> {
  const { activeHomeworkId } = await loadPracticeState(uid);
  if (!activeHomeworkId) return null;
  const homework = toHomework(await getDoc(homeworkRef(uid, activeHomeworkId)));
  return homework?.status === "active" ? homework : null;
}

/**
 * Saves a new active homework and makes it the active one. A previous active
 * homework is marked abandoned in the same transaction.
 */
export async function createHomework(uid: string, homework: Homework): Promise<void> {
  await runTransaction(db, async (tx) => {
    const state = normalizeState((await tx.get(stateRef(uid))).data());
    const previousId = state.activeHomeworkId;
    const previous =
      previousId && previousId !== homework.id
        ? toHomework(await tx.get(homeworkRef(uid, previousId)))
        : null;

    if (previousId && previous?.status === "active") {
      tx.update(homeworkRef(uid, previousId), { status: "abandoned" });
    }
    tx.set(homeworkRef(uid, homework.id), withoutUndefined(homework));
    tx.set(stateRef(uid), { ...state, activeHomeworkId: homework.id });
  });
}

export async function saveHomeworkProgress(
  uid: string,
  id: string,
  progress: HomeworkWordProgress[],
): Promise<void> {
  await updateDoc(homeworkRef(uid, id), { progress: withoutUndefined(progress) });
}

export async function saveHomeworkWords(
  uid: string,
  id: string,
  words: HomeworkWord[],
): Promise<void> {
  await updateDoc(homeworkRef(uid, id), { words: withoutUndefined(words) });
}

/**
 * Marks an active homework abandoned and clears the active pointer if it still
 * points at it. Words keep their learned state. Does nothing for a homework
 * that is not active.
 */
export async function abandonHomework(uid: string, id: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const [homeworkSnapshot, stateSnapshot] = await Promise.all([
      tx.get(homeworkRef(uid, id)),
      tx.get(stateRef(uid)),
    ]);
    if (toHomework(homeworkSnapshot)?.status !== "active") return;

    tx.update(homeworkRef(uid, id), { status: "abandoned" });
    const state = normalizeState(stateSnapshot.data());
    if (state.activeHomeworkId === id) {
      tx.set(stateRef(uid), { ...state, activeHomeworkId: null });
    }
  });
}

/**
 * Grades the finished test and, in one transaction, completes the homework and
 * updates the practice state: correct words are learned at `now`, missed words
 * get one more miss. Completing an already completed homework changes nothing
 * and returns it as it is stored, so a retry never counts a miss twice.
 */
export async function completeHomework(uid: string, id: string, now: number): Promise<Homework> {
  return runTransaction(db, async (tx) => {
    const [homeworkSnapshot, stateSnapshot] = await Promise.all([
      tx.get(homeworkRef(uid, id)),
      tx.get(stateRef(uid)),
    ]);
    const homework = toHomework(homeworkSnapshot);
    if (!homework) throw new Error(`Homework ${id} does not exist`);
    if (homework.status === "completed") return homework;
    if (homework.status !== "active") {
      throw new Error(`Homework ${id} is ${homework.status} and cannot be completed`);
    }

    const result = gradeTest(homework);
    const state = normalizeState(stateSnapshot.data());
    // A Map, so keys such as "constructor" are never mistaken for inherited properties.
    const words = new Map(Object.entries(state.words));
    for (const key of result.correctKeys) {
      words.set(key, { missCount: 0, ...words.get(key), learnedAt: now });
    }
    for (const key of result.missedKeys) {
      const missCount = (words.get(key)?.missCount ?? 0) + 1;
      words.set(key, { ...words.get(key), missCount, lastMissedAt: now });
    }

    tx.update(homeworkRef(uid, id), { status: "completed", completedAt: now, result });
    tx.set(stateRef(uid), {
      ...state,
      activeHomeworkId: state.activeHomeworkId === id ? null : state.activeHomeworkId,
      words: Object.fromEntries(words),
    });
    return { ...homework, status: "completed", completedAt: now, result };
  });
}

/**
 * Completed homeworks, newest first. Only completed homeworks have a
 * `completedAt`, so ordering by it needs no filter and no composite index.
 */
export async function listCompletedHomeworks(
  uid: string,
  max: number = DEFAULT_COMPLETED_LIMIT,
): Promise<Homework[]> {
  const snapshot = await getDocs(
    query(homeworksCollection(uid), orderBy("completedAt", "desc"), limit(max)),
  );
  return snapshot.docs.flatMap((document) => toHomework(document) ?? []);
}
