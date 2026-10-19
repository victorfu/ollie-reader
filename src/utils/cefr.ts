import type { CefrInfo, CefrLevel } from "../types/wordPractice";
import { normalizeUniqueText } from "./firestoreIdentity";
import { baseCandidatesOf } from "./wordForms";

export const CEFR_LEVELS: readonly CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** A1 = 0 ... C2 = 5. */
export const cefrRank = (level: CefrLevel): number => CEFR_LEVELS.indexOf(level);

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const straightenApostrophes = (text: string): string => text.replace(/’/g, "'");

/**
 * The identity of a word across Word Practice (state, estimates, homework
 * words): trimmed, whitespace-collapsed, lowercase, straight apostrophes, no
 * leading or trailing punctuation.
 */
export const practiceKey = (word: string): string =>
  straightenApostrophes(normalizeUniqueText(word)).replace(EDGE_PUNCTUATION, "");

export type CefrTable = ReadonlyMap<string, CefrLevel>;

let tablePromise: Promise<CefrTable> | null = null;

/**
 * Loads the CEFR word list. The JSON is large, so it is imported dynamically
 * (it becomes its own chunk) and the same promise is reused. A failed load is
 * not cached, so a later call can retry.
 */
export function loadCefrTable(): Promise<CefrTable> {
  tablePromise ??= import("../data/cefr/cefrLevels.json")
    .then((module): CefrTable => new Map(Object.entries(module.default as Record<string, CefrLevel>)))
    .catch((error: unknown) => {
      tablePromise = null;
      throw error;
    });
  return tablePromise;
}

/**
 * The list level of `word`, or null. Tries, in order: the word as written
 * (normalized, so keys such as "a.m." or "'s" match), the practice key (so
 * "Run." finds "run"), then each base form candidate. Candidates can include
 * non-words ("studie" before "study"), hence the first one in the table wins.
 */
export function lookupCefrLevel(table: CefrTable, word: string): CefrLevel | null {
  const key = practiceKey(word);
  const direct = table.get(straightenApostrophes(normalizeUniqueText(word))) ?? table.get(key);
  if (direct) return direct;
  for (const candidate of baseCandidatesOf(key)) {
    const level = table.get(candidate);
    if (level) return level;
  }
  return null;
}

/** The list level when there is one, otherwise a stored AI estimate. */
export function resolveCefr(
  table: CefrTable,
  estimates: Record<string, CefrLevel>,
  word: string,
): CefrInfo | null {
  const listed = lookupCefrLevel(table, word);
  if (listed) return { level: listed, source: "list" };
  const key = practiceKey(word);
  return Object.hasOwn(estimates, key) ? { level: estimates[key], source: "ai" } : null;
}
