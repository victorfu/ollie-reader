/**
 * Inflected forms in Word Practice. A word saved from a book can be a form of
 * another word ("ran", "children"); the homework then teaches the base form
 * first and the saved form after it. Everything here is offline: the base must
 * be a CEFR list headword, and the vocabulary entry's parts of speech decide
 * whether a form is read as a verb form or a plural.
 */
import type { CefrTable } from "./cefr";
import { practiceKey } from "./cefr";
import { baseCandidatesOf, formsOf, IRREGULAR_FORMS } from "./wordForms";

export type InflectionKind =
  | "present"
  | "past"
  | "pastParticiple"
  | "pastAndParticiple"
  | "ing"
  | "thirdPerson"
  | "plural";

export interface Inflection {
  base: string;
  /** The form as saved, lowercase. */
  form: string;
  kind: InflectionKind;
}

export const INFLECTION_LABEL: Record<InflectionKind, string> = {
  present: "現在式",
  past: "過去式",
  pastParticiple: "過去分詞",
  pastAndParticiple: "過去式和過去分詞",
  ing: "現在分詞（-ing 形）",
  thirdPerson: "第三人稱單數",
  plural: "複數",
};

/** When the form is used, in a sentence a fifth grader can follow. */
export const INFLECTION_USE: Record<InflectionKind, string> = {
  present: "主詞不同，要用不同的形：I am、he is、you are。",
  past: "說已經發生的事，例如 yesterday、last week。",
  pastParticiple: "用在 have / has 後面（I have eaten），或是被動句（be + 過去分詞）。",
  pastAndParticiple: "過去式和過去分詞長得一樣：說已經發生的事，也用在 have / has 後面。",
  ing: "和 be 動詞一起表示正在做（I am running），也可以當成「做這件事」（Running is fun）。",
  thirdPerson: "主詞是 he、she、it 或一個人、一件東西時，現在式的動詞要用這個形。",
  plural: "兩個或更多的時候用。",
};

const IRREGULAR_PLURAL_BASES = new Set([
  "child", "man", "woman", "mouse", "tooth", "foot", "person", "goose", "fish", "sheep",
  "leaf", "life", "knife", "wife", "half", "shelf", "wolf", "thief", "loaf", "calf", "scarf",
]);

/** Irregular verbs whose listed forms are not simply [past, past participle]. */
const SPECIAL_VERB_FORMS: Record<string, Record<string, InflectionKind>> = {
  be: { am: "present", is: "present", are: "present", was: "past", were: "past", been: "pastParticiple", being: "ing" },
  go: { went: "past", gone: "pastParticiple", goes: "thirdPerson", going: "ing" },
  do: { did: "past", done: "pastParticiple", does: "thirdPerson", doing: "ing" },
  have: { has: "thirdPerson", had: "pastAndParticiple", having: "ing" },
  run: { ran: "past" },
  show: { shown: "pastParticiple" },
  sink: { sank: "past", sunk: "pastParticiple", sunken: "pastParticiple" },
};

const irregularFormsOf = (base: string): string[] =>
  Object.hasOwn(IRREGULAR_FORMS, base) ? IRREGULAR_FORMS[base] : [];

const isIrregular = (base: string, form: string): boolean => irregularFormsOf(base).includes(form);

function irregularKind(base: string, form: string): InflectionKind {
  if (IRREGULAR_PLURAL_BASES.has(base)) return "plural";
  const special = Object.hasOwn(SPECIAL_VERB_FORMS, base) ? SPECIAL_VERB_FORMS[base] : undefined;
  if (special && Object.hasOwn(special, form)) return special[form];
  const forms = irregularFormsOf(base);
  if (forms.length === 1) return "pastAndParticiple";
  return forms.indexOf(form) === 0 ? "past" : "pastParticiple";
}

function regularKind(form: string, asNoun: boolean): InflectionKind {
  if (form.endsWith("ing")) return "ing";
  if (form.endsWith("d")) return "pastAndParticiple";
  return asNoun ? "plural" : "thirdPerson";
}

const VERB = /\bverb\b/i; // not "adverb"
const NOUN = /\bnoun\b/i; // not "pronoun"

/**
 * The base form `word` is an inflection of, or null when it is a base form
 * itself or cannot be told apart from one. With parts of speech, a verb form
 * needs a "verb" definition and a plural a "noun" one; a word list headword
 * ("news", "swimming" as a noun) is only read as a verb form. Without them,
 * only a word that is not a headword is read as an inflection.
 */
export function inflectionOf(
  table: CefrTable,
  word: string,
  partsOfSpeech: readonly string[] = [],
): Inflection | null {
  const form = practiceKey(word);
  if (!form || form.includes(" ")) return null;
  const headword = table.has(form);
  const known = partsOfSpeech.filter((pos) => pos.trim() !== "");
  const verb = known.some((pos) => VERB.test(pos));
  const noun = known.some((pos) => NOUN.test(pos));
  if (known.length === 0 && headword) return null;

  for (const base of baseCandidatesOf(form)) {
    if (!table.has(base) || !formsOf(base).includes(form)) continue;
    const asNoun = known.length === 0 || (noun && !verb);
    const kind = isIrregular(base, form) ? irregularKind(base, form) : regularKind(form, asNoun);
    const fits =
      kind === "plural" ? !headword && (known.length === 0 || noun) : known.length === 0 || verb;
    if (fits) return { base, form, kind };
  }
  return null;
}

/** How `form` is made from `base`, in Chinese. */
export function inflectionRule(base: string, form: string): string {
  const b = base.toLowerCase();
  const f = form.toLowerCase();
  if (isIrregular(b, f)) return "這是不規則變化，沒有固定的規則，要把它背起來。";
  const last = b.at(-1) ?? "";
  for (const [suffix, name] of [["ing", "-ing"], ["ed", "-ed"], ["es", "-es"], ["s", "-s"]] as const) {
    if (!f.endsWith(suffix)) continue;
    const stem = f.slice(0, -suffix.length);
    if (stem === b) {
      return suffix === "es" ? "字尾是 s、x、z、ch、sh 或 o，要加 -es。" : `直接加 ${name}。`;
    }
    if (stem === `${b}${last}`) return `重複字尾的子音字母 ${last}，再加 ${name}。`;
    if (stem === `${b}k`) return `字尾先加 k，再加 ${name}。`;
    if (suffix === "ing" && b.endsWith("ie") && stem === `${b.slice(0, -2)}y`) return "字尾的 ie 改成 y，再加 -ing。";
    if (suffix === "ing" && last === "e" && stem === b.slice(0, -1)) return "去掉字尾的 e，再加 -ing。";
    if ((suffix === "ed" || suffix === "es") && last === "y" && stem === `${b.slice(0, -1)}i`) {
      return `字尾的 y 改成 i，再加 ${name}。`;
    }
  }
  if (last === "e" && f === `${b}d`) return "字尾已經有 e，只要加 -d。";
  return "這是不規則變化，沒有固定的規則，要把它背起來。";
}
