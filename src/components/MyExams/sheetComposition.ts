import {
  BANK_SUBJECTS,
  type BankQuestion,
  type BankSubject,
} from "../../types/questionBank";
import { pickRandomQuestions, type Rng } from "./pickRandomQuestions";

export type SubjectCounts = Partial<Record<BankSubject, number>>;

/** 勾選科目時的預設題數（實際取 min(這個值, 該科題數)）。 */
export const DEFAULT_SUBJECT_COUNT = 10;

export function countBySubject(bank: readonly BankQuestion[]): Record<BankSubject, number> {
  const counts = Object.fromEntries(BANK_SUBJECTS.map((subject) => [subject, 0])) as Record<
    BankSubject,
    number
  >;
  for (const question of bank) counts[question.subject] += 1;
  return counts;
}

/** 每科各自不放回抽題，依 BANK_SUBJECTS 順序串接（spec §11.2）。 */
export function buildSheetQuestions(
  bank: readonly BankQuestion[],
  counts: SubjectCounts,
  rng: Rng = Math.random,
): BankQuestion[] {
  return BANK_SUBJECTS.flatMap((subject) => {
    const count = counts[subject] ?? 0;
    if (count <= 0) return [];
    return pickRandomQuestions(
      bank.filter((question) => question.subject === subject),
      count,
      rng,
    );
  });
}

function unusedSameSubject(
  list: readonly BankQuestion[],
  index: number,
  bank: readonly BankQuestion[],
): BankQuestion[] {
  const target = list[index];
  if (!target) return [];
  const used = new Set(list.map((question) => question.id));
  return bank.filter((question) => question.subject === target.subject && !used.has(question.id));
}

export function canReplaceAt(
  list: readonly BankQuestion[],
  index: number,
  bank: readonly BankQuestion[],
): boolean {
  return unusedSameSubject(list, index, bank).length > 0;
}

/** 換成同科、還不在卷裡的隨機一題；沒有可換的就原樣回傳。 */
export function replaceAt(
  list: readonly BankQuestion[],
  index: number,
  bank: readonly BankQuestion[],
  rng: Rng = Math.random,
): BankQuestion[] {
  const [replacement] = pickRandomQuestions(unusedSameSubject(list, index, bank), 1, rng);
  if (!replacement) return [...list];
  return list.map((question, position) => (position === index ? replacement : question));
}

export function moveAt<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const next = [...list];
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, position) => position !== index);
}

export function appendUnique(
  list: readonly BankQuestion[],
  additions: readonly BankQuestion[],
): BankQuestion[] {
  const used = new Set(list.map((question) => question.id));
  return [...list, ...additions.filter((question) => !used.has(question.id))];
}

/** 依考卷存的 id 順序找回題目；找不到的（已刪除）只計數。 */
export function resolveSheetQuestions(
  ids: readonly string[],
  bank: readonly BankQuestion[],
): { questions: BankQuestion[]; missingCount: number } {
  const byId = new Map(bank.map((question) => [question.id, question]));
  const questions: BankQuestion[] = [];
  let missingCount = 0;
  for (const id of ids) {
    const question = byId.get(id);
    if (question) questions.push(question);
    else missingCount += 1;
  }
  return { questions, missingCount };
}

export function defaultSheetTitle(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `自製考卷 ${date.getFullYear()}/${month}/${day}`;
}
