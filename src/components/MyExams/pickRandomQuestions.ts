import type { BankQuestion } from "../../types/questionBank";

export type Rng = () => number;

/**
 * 從 pool 排除 excludeIds 後，不放回地抽 min(count, 剩餘數) 題；
 * 回傳順序即隨機順序（部分 Fisher–Yates，做法同 src/data/exams/mixed.ts）。
 * 之後要加錯題權重，只改這個函式（spec §11.2）。
 */
export function pickRandomQuestions(
  pool: readonly BankQuestion[],
  count: number,
  rng: Rng = Math.random,
  excludeIds: ReadonlySet<string> = new Set(),
): BankQuestion[] {
  const candidates = pool.filter((question) => !excludeIds.has(question.id));
  const size = Math.max(0, Math.min(Math.floor(count), candidates.length));
  for (let index = 0; index < size; index += 1) {
    const swap = index + Math.floor(rng() * (candidates.length - index));
    [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
  }
  return candidates.slice(0, size);
}
