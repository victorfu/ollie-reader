import type { PartOfSpeech } from "../types/game";

// 生字本與 AI 寫詞性的方式很多種（"n."、"Noun"、"adj"…），統一成四種
const POS_ALIASES: Record<string, PartOfSpeech> = {
  n: "noun",
  noun: "noun",
  v: "verb",
  vt: "verb",
  vi: "verb",
  verb: "verb",
  adj: "adjective",
  adjective: "adjective",
  adv: "adverb",
  adverb: "adverb",
};

/** 認不出的詞性（片語、介系詞…）回 undefined */
export function normalizePartOfSpeech(value: unknown): PartOfSpeech | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/\.$/, "");
  return POS_ALIASES[key];
}

/**
 * 從多個釋義推出唯一詞性。
 * 釋義橫跨多種詞性（如 run 同時是 noun 和 verb）時回 undefined —
 * 詞性題只考答案無爭議的字。
 */
export function singlePartOfSpeech(
  values: readonly unknown[],
): PartOfSpeech | undefined {
  const found = new Set<PartOfSpeech>();
  for (const value of values) {
    const pos = normalizePartOfSpeech(value);
    if (pos) found.add(pos);
  }
  return found.size === 1 ? [...found][0] : undefined;
}
