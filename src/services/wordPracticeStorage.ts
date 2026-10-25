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
  type DocumentSnapshot,
} from "firebase/firestore";
import type {
  CefrLevel,
  Homework,
  HistoryHomework,
  HomeworkProgress,
  PracticeSettings,
  ReviewStage,
  WordPracticeState,
  WordPracticeWordState,
} from "../types/wordPractice";
import { CEFR_LEVELS } from "../utils/cefr";
import { db } from "../utils/firebaseUtil";
import { currentPosition, gradeDictation, wordForKey } from "../utils/homeworkFlow";
import {
  applyDictationOutcome,
  DEFAULT_SETTINGS,
  migrateWordState,
} from "../utils/reviewSchedule";

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

const clampInt = (value: unknown, min: number, max: number, fallback: number): number =>
  isNumber(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export function normalizeSettings(raw: unknown): PracticeSettings {
  const data = isRecord(raw) ? raw : {};
  return {
    newWordCount: clampInt(data.newWordCount, 3, 10, DEFAULT_SETTINGS.newWordCount),
    reviewLimit: clampInt(data.reviewLimit, 0, 20, DEFAULT_SETTINGS.reviewLimit),
    startLevel: isCefrLevel(data.startLevel) ? data.startLevel : DEFAULT_SETTINGS.startLevel,
  };
}

function normalizeWordState(raw: unknown): WordPracticeWordState | null {
  if (!isRecord(raw)) return null;
  const stage = (
    typeof raw.stage === "number" && Number.isInteger(raw.stage) && raw.stage >= 0 && raw.stage <= 5
      ? raw.stage
      : 0
  ) as ReviewStage;
  return {
    stage,
    missCount: isNumber(raw.missCount) ? raw.missCount : 0,
    ...(isNumber(raw.dueAt) && { dueAt: raw.dueAt }),
    ...(raw.needsPractice === true && { needsPractice: true }),
    ...((raw.lastResult === "correct" || raw.lastResult === "wrong") && { lastResult: raw.lastResult }),
    ...(typeof raw.sentence === "string" && raw.sentence && { sentence: raw.sentence }),
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

function normalizeActiveId(raw: unknown): string | null {
  return typeof raw === "string" && raw ? raw : null;
}

/** Turns a stored v2 state document into a valid state; unusable parts get defaults. */
function normalizeState(raw: unknown): WordPracticeState {
  const data = isRecord(raw) ? raw : {};
  return {
    schemaVersion: 2,
    activeHomeworkId: normalizeActiveId(data.activeHomeworkId),
    words: normalizeWords(data.words),
    cefrEstimates: normalizeCefrEstimates(data.cefrEstimates),
    settings: normalizeSettings(data.settings),
  };
}

const isV2 = (raw: unknown): boolean => isRecord(raw) && raw.schemaVersion === 2;

/**
 * Converts whatever the state document holds to the v2 shape. Legacy words
 * (no `schemaVersion: 2`) go through `migrateWordState`; a v2 document is only
 * normalized. Every transaction that reads the state goes through this, so the
 * old format is never written back.
 */
function toV2State(raw: unknown, now: number): WordPracticeState {
  if (isV2(raw)) return normalizeState(raw);
  const data = isRecord(raw) ? raw : {};
  const words = isRecord(data.words) ? data.words : {};
  return {
    schemaVersion: 2,
    activeHomeworkId: normalizeActiveId(data.activeHomeworkId),
    words: Object.fromEntries(
      Object.entries(words).flatMap(([key, value]) =>
        isRecord(value)
          ? [
              [
                key,
                migrateWordState(
                  {
                    ...(isNumber(value.learnedAt) && { learnedAt: value.learnedAt }),
                    ...(isNumber(value.missCount) && { missCount: value.missCount }),
                    ...(isNumber(value.lastMissedAt) && { lastMissedAt: value.lastMissedAt }),
                  },
                  now,
                ),
              ],
            ]
          : [],
      ),
    ),
    cefrEstimates: normalizeCefrEstimates(data.cefrEstimates),
    settings: normalizeSettings(data.settings),
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

/**
 * Reads the practice state. A document without `schemaVersion: 2` is converted
 * and written back in one transaction, which also abandons an active homework
 * that is not a v2 homework and clears the pointer to it.
 */
export async function loadPracticeState(
  uid: string,
  now: number = Date.now(),
): Promise<WordPracticeState> {
  const snapshot = await getDoc(stateRef(uid));
  if (isV2(snapshot.data())) return normalizeState(snapshot.data());

  return runTransaction(db, async (tx) => {
    const raw = (await tx.get(stateRef(uid))).data();
    if (isV2(raw)) return normalizeState(raw);

    const state = toV2State(raw, now);
    const activeId = state.activeHomeworkId;
    let abandonId: string | null = null;
    if (activeId) {
      const homework = (await tx.get(homeworkRef(uid, activeId))).data();
      if (homework?.version !== 2) {
        if (homework?.status === "active") abandonId = activeId;
        state.activeHomeworkId = null;
      }
    }
    if (abandonId) tx.update(homeworkRef(uid, abandonId), { status: "abandoned" });
    tx.set(stateRef(uid), state);
    return state;
  });
}

/** Saves the parent settings (clamped), leaving the rest of the state alone. */
export async function saveSettings(uid: string, settings: PracticeSettings): Promise<void> {
  await runTransaction(db, async (tx) => {
    const state = toV2State((await tx.get(stateRef(uid))).data(), Date.now());
    tx.set(stateRef(uid), { ...state, settings: normalizeSettings(settings) });
  });
}

/**
 * The active homework, or null. A pointer to a legacy or finished homework counts as none.
 * Pass the practice state when it was just loaded, to avoid reading it again.
 */
export async function getActiveHomework(
  uid: string,
  state?: WordPracticeState,
): Promise<Homework | null> {
  const { activeHomeworkId } = state ?? (await loadPracticeState(uid));
  if (!activeHomeworkId) return null;
  const homework = toHomework(await getDoc(homeworkRef(uid, activeHomeworkId)));
  return homework?.version === 2 && homework.status === "active" ? homework : null;
}

/**
 * Saves a new active homework and makes it the active one. A previous active
 * homework is marked abandoned in the same transaction.
 */
export async function createHomework(uid: string, homework: Homework): Promise<void> {
  await runTransaction(db, async (tx) => {
    const state = toV2State((await tx.get(stateRef(uid))).data(), Date.now());
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

/**
 * Replaces the three progress fields of an active homework; fails when it does
 * not exist and does nothing once it is completed or abandoned, so a stale tab
 * cannot overwrite a finished homework.
 */
export async function saveHomeworkProgress(
  uid: string,
  id: string,
  progress: HomeworkProgress,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(homeworkRef(uid, id));
    if (!snapshot.exists()) throw new Error(`No homework to save: ${id}`);
    if (snapshot.data()?.status !== "active") return;
    tx.update(
      homeworkRef(uid, id),
      withoutUndefined({
        pages: progress.pages,
        dictation: progress.dictation,
        corrections: progress.corrections,
      }),
    );
  });
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
    const state = toV2State(stateSnapshot.data(), Date.now());
    if (state.activeHomeworkId === id) {
      tx.set(stateRef(uid), { ...state, activeHomeworkId: null });
    }
  });
}

export interface ReviewUpdate {
  vocabularyId: string;
  remembered: boolean;
}

/**
 * Grades the finished dictation and, in one transaction, completes the homework
 * and schedules every dictated word. Skipped items change nothing. Only a
 * homework whose position is "submit" can be completed. Completing an already
 * completed homework returns it as stored, with no review updates, so a retry
 * never counts a word twice.
 */
export async function completeHomework(
  uid: string,
  id: string,
  now: number,
): Promise<{ homework: Homework; reviewUpdates: ReviewUpdate[] }> {
  return runTransaction(db, async (tx) => {
    const [homeworkSnapshot, stateSnapshot] = await Promise.all([
      tx.get(homeworkRef(uid, id)),
      tx.get(stateRef(uid)),
    ]);
    const homework = toHomework(homeworkSnapshot);
    if (!homework || homework.version !== 2) throw new Error(`No v2 homework to complete: ${id}`);
    if (homework.status === "completed") return { homework, reviewUpdates: [] };
    if (homework.status !== "active") throw new Error(`Homework is not active: ${id}`);
    if (currentPosition(homework).phase !== "submit") {
      throw new Error(`Homework still has unfinished work: ${id}`);
    }

    const result = gradeDictation(homework);
    const state = toV2State(stateSnapshot.data(), now);
    const words = { ...state.words };
    const reviewUpdates: ReviewUpdate[] = [];
    for (const item of homework.dictation) {
      if (item.skipped) continue;
      const word = wordForKey(homework, item.key);
      const remembered = result.correctKeys.includes(item.key);
      const previous = Object.hasOwn(words, item.key) ? words[item.key] : undefined;
      const next = applyDictationOutcome(previous, remembered ? "correct" : "wrong", now);
      words[item.key] = remembered && word.sentence ? { ...next, sentence: word.sentence } : next;
      if (word.vocabularyId) reviewUpdates.push({ vocabularyId: word.vocabularyId, remembered });
    }

    const completed: Homework = { ...homework, status: "completed", completedAt: now, result };
    tx.update(homeworkRef(uid, id), { status: "completed", completedAt: now, result });
    tx.set(stateRef(uid), {
      ...state,
      words,
      activeHomeworkId: state.activeHomeworkId === id ? null : state.activeHomeworkId,
    });
    return { homework: completed, reviewUpdates };
  });
}

/**
 * Completed homeworks of either version, newest first. Only completed
 * homeworks have a `completedAt`, so ordering by it needs no filter and no
 * composite index.
 */
export async function listCompletedHomeworks(
  uid: string,
  max: number = DEFAULT_COMPLETED_LIMIT,
): Promise<HistoryHomework[]> {
  const snapshot = await getDocs(
    query(homeworksCollection(uid), orderBy("completedAt", "desc"), limit(max)),
  );
  return snapshot.docs.flatMap((document) => {
    const data = document.data();
    return data ? [{ ...data, id: document.id } as HistoryHomework] : [];
  });
}
