/**
 * Answer matching for Word Practice.
 *
 * Every typed answer (spelling practice, definition → word, spelling
 * test) is graded by `isAnswerCorrect`; `diffSpelling` shows the learner where
 * a misspelling went wrong, rendered against the expected word.
 */

/**
 * The one normalization rule shared by grading and diffing: compose accents
 * (so "é" typed as one character or as "e" plus a combining accent is the same
 * letter), trim, collapse whitespace runs to a single space, turn curly quotes
 * into straight quotes, then ignore case. Everything else (hyphens,
 * punctuation) must match exactly.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase();
}

export function isAnswerCorrect(input: string, expected: string): boolean {
  return normalizeAnswer(input) === normalizeAnswer(expected);
}

export type SpellingDiffPart = {
  text: string;
  kind: "same" | "wrong" | "missing" | "extra";
};

/**
 * Aligns the typed answer with the expected word (Levenshtein DP, backtraced
 * from the end) after normalizing both sides.
 *
 * - `same`: the character matches.
 * - `wrong`: a substitution; `text` is the expected character.
 * - `missing`: expected, but not typed; `text` is the expected character.
 * - `extra`: typed, but not expected; `text` is the typed character.
 *
 * When several alignments cost the same, the backtrace prefers the diagonal
 * (same or wrong), then `missing`, then `extra`. Adjacent parts of the same
 * kind are merged into one.
 */
export function diffSpelling(input: string, expected: string): SpellingDiffPart[] {
  const typed = normalizeAnswer(input);
  const target = normalizeAnswer(expected);

  // cost[i][j] = edit distance between typed[0..i) and target[0..j).
  const cost: number[][] = Array.from({ length: typed.length + 1 }, (_, i) => {
    const row = new Array<number>(target.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= target.length; j++) cost[0][j] = j;
  for (let i = 1; i <= typed.length; i++) {
    for (let j = 1; j <= target.length; j++) {
      const diagonal = cost[i - 1][j - 1] + (typed[i - 1] === target[j - 1] ? 0 : 1);
      cost[i][j] = Math.min(diagonal, cost[i][j - 1] + 1, cost[i - 1][j] + 1);
    }
  }

  const reversed: SpellingDiffPart[] = [];
  let i = typed.length;
  let j = target.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const matches = typed[i - 1] === target[j - 1];
      if (cost[i][j] === cost[i - 1][j - 1] + (matches ? 0 : 1)) {
        reversed.push({ text: target[j - 1], kind: matches ? "same" : "wrong" });
        i--;
        j--;
        continue;
      }
    }
    if (j > 0 && cost[i][j] === cost[i][j - 1] + 1) {
      reversed.push({ text: target[j - 1], kind: "missing" });
      j--;
    } else {
      reversed.push({ text: typed[i - 1], kind: "extra" });
      i--;
    }
  }

  const parts: SpellingDiffPart[] = [];
  for (let k = reversed.length - 1; k >= 0; k--) {
    const part = reversed[k];
    const last = parts[parts.length - 1];
    if (last && last.kind === part.kind) {
      last.text += part.text;
    } else {
      parts.push({ ...part });
    }
  }
  return parts;
}
