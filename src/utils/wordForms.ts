/**
 * Word form utilities for Word Practice: inflections, cloze blanks and
 * headword redaction.
 *
 * These helpers deliberately favour misses over false positives. A cloze that
 * blanks a different word ("now" inside "know", "run" inside "runner") is worse
 * than a sentence that is skipped, so forms are generated conservatively and
 * matched on whole-word boundaries only.
 *
 * `quizQuestions.ts` has its own `stemOf`, but it is intentionally aggressive
 * (it strips `-e`, `-ly`) to hide words; it is not suitable for finding forms
 * or looking words up, so it is not reused here.
 */

import type { Cloze } from "../types/wordPractice";

export const CLOZE_BLANK = "_____";

/**
 * Irregular inflections, keyed by base word. Only the non-regular forms need to
 * be listed, except for the very short words (`be`, `go`, `do`) which are never
 * inflected by rule and so list every form.
 */
export const IRREGULAR_FORMS: Record<string, string[]> = {
  // verbs
  be: ["am", "is", "are", "was", "were", "been", "being"],
  go: ["went", "gone", "goes", "going"],
  do: ["did", "done", "does", "doing"],
  have: ["has", "had", "having"],
  run: ["ran", "run"],
  eat: ["ate", "eaten"],
  see: ["saw", "seen"],
  take: ["took", "taken"],
  make: ["made"],
  come: ["came"],
  get: ["got", "gotten"],
  give: ["gave", "given"],
  write: ["wrote", "written"],
  swim: ["swam", "swum"],
  sing: ["sang", "sung"],
  begin: ["began", "begun"],
  break: ["broke", "broken"],
  buy: ["bought"],
  bring: ["brought"],
  think: ["thought"],
  teach: ["taught"],
  catch: ["caught"],
  fly: ["flew", "flown"],
  drive: ["drove", "driven"],
  ride: ["rode", "ridden"],
  speak: ["spoke", "spoken"],
  tell: ["told"],
  know: ["knew", "known"],
  grow: ["grew", "grown"],
  draw: ["drew", "drawn"],
  fall: ["fell", "fallen"],
  feel: ["felt"],
  find: ["found"],
  hold: ["held"],
  keep: ["kept"],
  leave: ["left"],
  lose: ["lost"],
  meet: ["met"],
  pay: ["paid"],
  read: ["read"],
  say: ["said"],
  sell: ["sold"],
  send: ["sent"],
  sit: ["sat"],
  sleep: ["slept"],
  stand: ["stood"],
  win: ["won"],
  wear: ["wore", "worn"],
  hear: ["heard"],
  build: ["built"],
  choose: ["chose", "chosen"],
  forget: ["forgot", "forgotten"],
  spend: ["spent"],
  throw: ["threw", "thrown"],
  hide: ["hid", "hidden"],
  wake: ["woke", "woken"],
  shake: ["shook", "shaken"],
  steal: ["stole", "stolen"],
  blow: ["blew", "blown"],
  fight: ["fought"],
  lend: ["lent"],
  drink: ["drank", "drunk"],
  show: ["shown"],
  mean: ["meant"],
  feed: ["fed"],
  dig: ["dug"],
  ring: ["rang", "rung"],
  light: ["lit"],
  learn: ["learnt"],
  dream: ["dreamt"],
  smell: ["smelt"],
  spell: ["spelt"],
  lead: ["led"],
  shoot: ["shot"],
  bite: ["bit", "bitten"],
  freeze: ["froze", "frozen"],
  understand: ["understood"],
  sink: ["sank", "sunk", "sunken"],
  shine: ["shone"],
  bend: ["bent"],
  burn: ["burnt"],
  tear: ["tore", "torn"],
  // nouns
  child: ["children"],
  man: ["men"],
  woman: ["women"],
  mouse: ["mice"],
  tooth: ["teeth"],
  foot: ["feet"],
  person: ["people"],
  goose: ["geese"],
  fish: ["fish"],
  sheep: ["sheep"],
  // -f/-fe -> -ves is listed word by word: a general rule would turn "safe"
  // into "saves" and "belief" into "believes".
  leaf: ["leaves"],
  life: ["lives"],
  knife: ["knives"],
  wife: ["wives"],
  half: ["halves"],
  shelf: ["shelves"],
  wolf: ["wolves"],
  thief: ["thieves"],
  loaf: ["loaves"],
  calf: ["calves"],
  scarf: ["scarves"],
};

// Maps are used instead of plain objects so that lookups of words such as
// "constructor" do not hit Object.prototype.
const IRREGULAR_BY_BASE = new Map<string, string[]>(Object.entries(IRREGULAR_FORMS));

/** Reverse table: inflected form -> base word(s). */
const IRREGULAR_BASES = new Map<string, string[]>();
for (const [base, forms] of IRREGULAR_BY_BASE) {
  for (const form of forms) {
    const bases = IRREGULAR_BASES.get(form) ?? [];
    if (!bases.includes(base)) bases.push(base);
    IRREGULAR_BASES.set(form, bases);
  }
}

/** Letters (and inner hyphens) only: the words regular suffix rules apply to. */
const INFLECTABLE = /^\p{L}[\p{L}-]*$/u;
/** Consonant-vowel-consonant ending whose last consonant is doubled (stop -> stopped). */
const CVC_ENDING = /(?:[b-df-hj-np-tv-z]|qu)[aeiou][bdfgjklmnpqrstvz]$/;
/** A doubled consonant that comes from the doubling rule, not from the word itself. */
const DOUBLED_CONSONANT = /([b-df-hj-np-tv-z])\1$/;

const isVowel = (char: string | undefined): boolean => char !== undefined && "aeiou".includes(char);

/** Lowercase, trim, collapse whitespace, curly apostrophe to straight. */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ");
}

/** Splits a phrase into its first word and the rest (with its leading space). */
function splitHead(phrase: string): [head: string, tail: string] {
  const index = phrase.indexOf(" ");
  return index < 0 ? [phrase, ""] : [phrase.slice(0, index), phrase.slice(index)];
}

function hasSingleVowelGroup(word: string): boolean {
  return (word.match(/[aeiouy]+/g)?.length ?? 0) <= 1;
}

/** `-s`, `-ed` and `-ing` forms produced by spelling rules alone. */
function regularForms(word: string): string[] {
  // 1-2 letter words ("be", "us", "a") would collide with real words
  // ("be" + "d" = "bed"), so they only get their irregular table entries.
  if (word.length < 3 || !INFLECTABLE.test(word)) return [];

  const forms: string[] = [];
  const last = word.at(-1);
  const consonantY = last === "y" && !isVowel(word.at(-2));

  if (consonantY) {
    forms.push(`${word.slice(0, -1)}ies`);
  } else if (/(?:s|x|z|ch|sh)$/.test(word)) {
    // quiz -> quizzes (never "quizes"); bus -> buses or busses.
    const doubles = (last === "s" || last === "z") && CVC_ENDING.test(word);
    if (!(last === "z" && doubles && hasSingleVowelGroup(word))) forms.push(`${word}es`);
    if (doubles) forms.push(`${word}${last}es`);
    // stomach is pronounced with /k/, so its plural is "stomachs".
    if (word.endsWith("ch")) forms.push(`${word}s`);
  } else if (last === "o") forms.push(`${word}es`, `${word}s`);
  else forms.push(`${word}s`);

  if (consonantY) {
    forms.push(`${word.slice(0, -1)}ied`, `${word}ing`);
  } else if (word.endsWith("ie")) {
    forms.push(`${word}d`, `${word.slice(0, -2)}ying`);
  } else if (last === "e") {
    // "fee" + "d" would blank the unrelated word "feed".
    if (!(word.length === 3 && word.endsWith("ee"))) forms.push(`${word}d`);
    // see -> seeing, dye -> dyeing, but make -> making.
    forms.push(/(?:ee|ye|oe)$/.test(word) ? `${word}ing` : `${word.slice(0, -1)}ing`);
  } else if (word.length >= 5 && word.endsWith("ic")) {
    // panic -> panicked, picnic -> picnicking. Longer than "pic"/"tic", whose
    // "k" forms would blank "picked" and "ticked".
    forms.push(`${word}ked`, `${word}king`);
  } else if (CVC_ENDING.test(word)) {
    // One-syllable words always double (stop -> stopped); "hop" + "ed" would
    // blank "hoped". Longer words may or may not (begin -> beginning,
    // visit -> visited), so both spellings are kept: the extra one is a
    // non-word.
    const doubled = `${word}${last}`;
    const stems = hasSingleVowelGroup(word) ? [doubled] : [doubled, word];
    for (const stem of stems) forms.push(`${stem}ed`, `${stem}ing`);
  } else {
    forms.push(`${word}ed`, `${word}ing`);
  }
  return forms;
}

/**
 * Every form of `word` that counts as a use of it in a sentence: lowercase,
 * deduplicated, longest first. For a phrase only the first word is inflected.
 */
export function formsOf(word: string): string[] {
  const phrase = normalize(word);
  if (!phrase) return [];
  const [head, tail] = splitHead(phrase);
  const forms = new Set<string>([head, ...regularForms(head), ...(IRREGULAR_BY_BASE.get(head) ?? [])]);
  return [...forms].map((form) => `${form}${tail}`).sort((a, b) => b.length - a.length);
}

/** Candidate base forms from the regular suffix rules alone, in priority order (unfiltered). */
function strippedBases(word: string): string[] {
  const candidates: string[] = [];
  if (word.endsWith("ies") || word.endsWith("ied")) candidates.push(`${word.slice(0, -3)}y`);
  // "-es" only follows s/x/z/ch/sh/o; otherwise "tapes" would give "tap" ahead of "tape".
  if (/(?:s|x|z|ch|sh|o)es$/.test(word)) {
    const stem = word.slice(0, -2);
    // quizzes -> quiz (zz only: "classes" must keep its natural "ss").
    if (/zz$/.test(stem)) candidates.push(stem.slice(0, -1));
    candidates.push(stem);
  }
  if (word.endsWith("s") && !word.endsWith("ss")) candidates.push(word.slice(0, -1));
  for (const suffix of ["ed", "ing"]) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    // dying -> die, lying -> lie, tying -> tie (ahead of the generic -ing -> e: "dye").
    if (suffix === "ing" && /[^aeiou]ying$/.test(word)) candidates.push(`${word.slice(0, -4)}ie`);
    // Not "ss": "hissed" must not give "his", "assessing" must not give "asses".
    if (DOUBLED_CONSONANT.test(stem) && !stem.endsWith("ss")) candidates.push(stem.slice(0, -1));
    candidates.push(`${stem}e`, stem);
    // panicked -> panic, picnicking -> picnic. After the generic candidates so
    // that "picked" stays "pick" ("pic" is too short to qualify anyway).
    if (/.{3}ick$/.test(stem)) candidates.push(stem.slice(0, -1));
  }
  return candidates;
}

/**
 * Base-form candidates for dictionary lookup, in priority order. Never includes
 * the word itself. Irregular forms come first and are trusted as they are
 * (including "went" -> "go"); candidates from suffix stripping shorter than
 * three letters are dropped.
 */
export function baseCandidatesOf(word: string): string[] {
  const phrase = normalize(word);
  if (!phrase) return [];
  const [head, tail] = splitHead(phrase);
  const candidates = [...(IRREGULAR_BASES.get(head) ?? [])];
  if (INFLECTABLE.test(head)) {
    candidates.push(...strippedBases(head).filter((candidate) => candidate.length >= 3));
  }
  return [...new Set(candidates)].filter((candidate) => candidate !== head).map((candidate) => `${candidate}${tail}`);
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One form as a regex source: either apostrophe accepted, runs of whitespace allowed. */
function formPattern(form: string): string {
  return form
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.split(/['’]/).map(escapeRegExp).join("['’]"))
    .join("\\s+");
}

/**
 * What may follow a form for it to count as a whole word: not another letter,
 * digit, apostrophe or hyphen. With `possessive`, a closing "'s", "’s" or "'"
 * may follow as well (the puppy's bed, the puppies' beds), so that a blank
 * hides the word there too. The suffix itself stays outside the match.
 */
const wordEnd = (possessive: boolean): string =>
  possessive ? "(?=(?:['’]s?)?(?![\\p{L}\\p{N}'’-]))" : "(?![\\p{L}\\p{N}'’-])";

/** A fresh matcher (the `g` flag makes regexes stateful, so none is shared) or null for an empty word. */
function matcherFor(word: string, possessive = false): RegExp | null {
  const forms = formsOf(word);
  if (forms.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}'’-])(?:${forms.map(formPattern).join("|")})${wordEnd(possessive)}`,
    "giu",
  );
}

/** The first form of `word` found in `text`, exactly as written there, or null. */
export function findWordForm(text: string, word: string): string | null {
  return matcherFor(word)?.exec(text)?.[0] ?? null;
}

/**
 * Replaces every form of `word` in `text` with `blank` and lists what was
 * replaced, as written. A possessive ("puppy's") is blanked too, so that the
 * visible text never contains the word; its "'s" stays.
 */
function redact(text: string, word: string, blank: string): { text: string; replaced: string[] } {
  const matcher = matcherFor(word, true);
  const replaced: string[] = [];
  if (!matcher) return { text, replaced };
  const redacted = text.replace(matcher, (found) => {
    replaced.push(found);
    return blank;
  });
  return { text: redacted, replaced };
}

/** Replaces every form of `word` in `text` with `blank`. */
export function redactWordForms(text: string, word: string, blank: string = CLOZE_BLANK): string {
  return redact(text, word, blank).text;
}

/**
 * Blanks every form of `word` in `sentence`. `answer` is the first blank as
 * written; `answers` lists every different form that was blanked, so that a
 * sentence with two ("Dogs love to run, and my dog runs fast.") accepts either,
 * and is left out when there is only one. Null when the sentence does not use
 * the word on its own (a use inside "puppy's" does not count).
 */
export function makeCloze(sentence: string, word: string): Cloze | null {
  if (findWordForm(sentence, word) === null) return null;
  const { text, replaced } = redact(sentence, word, CLOZE_BLANK);
  // The first spelling of each form, as written (a later "DOG" does not replace "Dog").
  const firstOfForm = new Map<string, string>();
  for (const found of replaced) {
    const form = normalize(found);
    if (!firstOfForm.has(form)) firstOfForm.set(form, found);
  }
  const answers = [...firstOfForm.values()];
  return answers.length > 1 ? { text, answer: answers[0], answers } : { text, answer: answers[0] };
}

export function sentenceUsesWord(sentence: string, word: string): boolean {
  return findWordForm(sentence, word) !== null;
}
