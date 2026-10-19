/** The first index from `start` on that satisfies `test`, or -1 when none does. */
export function findIndexFrom(start: number, count: number, test: (index: number) => boolean): number {
  for (let i = start; i < count; i++) {
    if (test(i)) return i;
  }
  return -1;
}

/**
 * The word to show after `from`, or -1 when the step is finished.
 *
 * It is the next `upcoming` word in order. When none is left it loops back to
 * the first word that is still `pending`, so a word skipped earlier (for
 * example one that only got its example sentence later) is not forgotten.
 * `upcoming` defaults to `pending`; the two differ when a step shows words it
 * cannot ask about, such as a word without a sentence in the cloze exercise.
 */
export function nextWordIndex(
  from: number,
  count: number,
  pending: (index: number) => boolean,
  upcoming: (index: number) => boolean = pending,
): number {
  const ahead = findIndexFrom(from + 1, count, upcoming);
  return ahead !== -1 ? ahead : findIndexFrom(0, count, pending);
}
