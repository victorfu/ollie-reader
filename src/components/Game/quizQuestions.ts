import type { GameWord } from "../../services/gameService";
import type {
  ClozeQuestion,
  DefLanguage,
  OrderQuestion,
  PartOfSpeech,
  PosQuestion,
  QuizKind,
  QuizQuestion,
  OptionQuestion,
  SpellQuestion,
  Stage,
  SynonymQuestion,
  TypingQuestion,
} from "../../types/game";
import { shuffleArray } from "../../utils/arrayUtils";
import { redactWordForms, sentenceUsesWord } from "../../utils/wordForms";

// 選項不足時的中文/英文備援
const FALLBACK_DEFS = ["未知的意思", "一種動物", "一種食物", "一個動作"];
const FALLBACK_DEFS_EN = [
  "an unknown meaning",
  "a kind of animal",
  "a kind of food",
  "an action you can do",
];
const FALLBACK_WORDS = ["apple", "book", "cat", "dog"];
// prepareGamePool 對沒有 emoji 的字會塞這個預設值 → 拿它出 emoji 題會無解，故過濾
const DEFAULT_EMOJI = "✨";
// 四選一，單字池至少要湊得出 4 個同語言釋義才能用該語言出題
export const MIN_DEF_POOL = 4;
// 詞性題的選項固定這個順序
export const POS_OPTIONS: PartOfSpeech[] = ["noun", "verb", "adjective", "adverb"];
// 句子排序只用長度適中的例句：太短沒得排，太長在手機上排不完
export const ORDER_MIN_TOKENS = 4;
export const ORDER_MAX_TOKENS = 12;

const normOpt = (s: string) => s.trim().toLowerCase();

// 從單字砍掉常見字尾取出字根，讓 "Perseverance" 也能對上 "persevering"
const STEM_SUFFIXES = [
  "ance",
  "ence",
  "ment",
  "ness",
  "tion",
  "sion",
  "ing",
  "ed",
  "es",
  "ly",
  "s",
  "e",
];
const MIN_STEM_LENGTH = 4; // 太短的字根會誤傷句子裡的其他字

function stemOf(word: string): string {
  const lower = word.trim().toLowerCase();
  for (const suffix of STEM_SUFFIXES) {
    if (
      lower.endsWith(suffix) &&
      lower.length - suffix.length >= MIN_STEM_LENGTH
    ) {
      return lower.slice(0, -suffix.length);
    }
  }
  return lower;
}

/**
 * 釋義常常直接含有被考的單字 —— 英文的 "Perseverance" → "the act of
 * persevering"，中文的也會出現「「Sorts」表示許多不同類型的事物」——
 * 拿來當 spell 的提示、reverse 的題幹或 meaning 的正解都會直接洩答案，改遮成 ____。
 * 全部釋義（含干擾項）一視同仁 — 只遮正解的話，____ 本身就變成答案標記。
 * 只比對拉丁字母，純中文釋義不會被動到。
 */
function redactHeadword(text: string, word: string): string {
  const stem = stemOf(word);
  if (stem.length < MIN_STEM_LENGTH) return text;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const redacted = text.replace(new RegExp(`\\b${escaped}\\w*`, "gi"), "____");
  // 整句被遮光的話反而無題可解，保留原文
  return redacted.replace(/[_\s]/g, "") ? redacted : text;
}

/**
 * 例句能不能出句子填空：要認得出這個字，且挖空後不能再看到同字根的相關字
 * （"Good communication helps us communicate." 挖掉 communicate 仍留著 communication）。
 */
function hasUsableExample(word: GameWord): boolean {
  if (!word.example || !sentenceUsesWord(word.example, word.word)) return false;
  const stem = stemOf(word.word);
  if (stem.length < MIN_STEM_LENGTH) return true;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`\\b${escaped}`, "i").test(
    redactWordForms(word.example, word.word),
  );
}

/** 例句拆成單字塊（標點黏在字上，排序時也是線索） */
function sentenceTokens(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/** 例句能不能出句子排序：要用到這個字，且長度在範圍內 */
function hasOrderableExample(word: GameWord): boolean {
  if (!word.example || !sentenceUsesWord(word.example, word.word)) return false;
  const count = sentenceTokens(word.example).length;
  return count >= ORDER_MIN_TOKENS && count <= ORDER_MAX_TOKENS;
}

/** 把例句的單字塊打散（盡量與原句順序不同） */
export function scrambleTokens(tokens: string[]): string[] {
  if (tokens.length <= 1) return [...tokens];
  const original = tokens.join(" ");
  let scrambled = shuffleArray(tokens);
  let guard = 0;
  while (scrambled.join(" ") === original && guard < 12) {
    scrambled = shuffleArray(tokens);
    guard++;
  }
  return scrambled;
}

/** 同反義題可考的關係 */
function synonymRelations(word: GameWord): ("same" | "opposite")[] {
  const relations: ("same" | "opposite")[] = [];
  if (word.synonyms?.length) relations.push("same");
  if (word.antonyms?.length) relations.push("opposite");
  return relations;
}

/** 該語言是否有釋義可用（不做遮蔽，純粹判斷有無） */
function rawDef(word: GameWord, lang: DefLanguage): string | null {
  const value = lang === "en" ? word.defEn : word.def;
  return value?.trim() ? value.trim() : null;
}

/**
 * 取出該語言的釋義；沒有就回 null。
 * 刻意「不」跨語言退回 — 一個中文選項混在三個英文選項裡等於直接標出答案。
 */
function defOf(word: GameWord, lang: DefLanguage): string | null {
  const value = rawDef(word, lang);
  if (value === null) return null;
  return redactHeadword(value, word.word);
}

/**
 * 依單字池實際擁有的釋義決定本輪語言。
 * 英文釋義湊不到 MIN_DEF_POOL 個時整輪退回中文（呼叫端據此不發英文模式加成）。
 */
export function resolveDefLanguage(
  pool: GameWord[],
  preferred: DefLanguage,
): DefLanguage {
  if (preferred === "zh") return "zh";
  const usable = pool.filter((w) => rawDef(w, "en"));
  return usable.length >= MIN_DEF_POOL ? "en" : "zh";
}

/**
 * 從 correct + 干擾項組出 4 選 1。
 * 干擾項會去重（忽略大小寫/前後空白）並排除與正解相同者，避免出現重複選項、
 * 或與正解只差大小寫的「看起來一樣卻算錯」選項。
 */
function makeOptions(
  correct: string,
  distractors: string[],
  fallbacks: string[],
  padLabel: (n: number) => string,
): { options: string[]; correctIndex: number } {
  const seen = new Set<string>([normOpt(correct)]);
  const wrong: string[] = [];

  const tryPush = (candidate: string) => {
    if (wrong.length >= 3 || !candidate) return;
    const key = normOpt(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    wrong.push(candidate);
  };

  shuffleArray(distractors).forEach(tryPush);
  fallbacks.forEach(tryPush);
  // 極端情況（選項全被去重掉）用序號補滿，n 遞增保證終止
  let n = 1;
  while (wrong.length < 3) tryPush(padLabel(n++));

  const options = shuffleArray([correct, ...wrong]);
  return { options, correctIndex: options.indexOf(correct) };
}

/** 把單字字母打散成 chips（盡量與原字順序不同） */
export function scrambleWord(word: string): string[] {
  const letters = word.split("");
  if (letters.length <= 1) return letters;

  let scrambled = shuffleArray(letters);
  let guard = 0;
  while (scrambled.join("") === word && guard < 12) {
    scrambled = shuffleArray(letters);
    guard++;
  }
  return scrambled;
}

/** 一律用小寫、去空白比對拼字答案 */
function normalizeSpell(value: string): string {
  return value.trim().toLowerCase();
}

/** 句子排序比對：忽略大小寫與多餘空白 */
function normalizeSentence(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 建立單一題目（pool 已由 buildQuizQuestions 濾成 lang 可用的字） */
function buildOne(
  kind: QuizKind,
  word: GameWord,
  pool: GameWord[],
  lang: DefLanguage,
): QuizQuestion {
  const base = { word: word.word } as const;
  // pool 已濾過，?? 只是型別上的保險
  const def = defOf(word, lang) ?? word.def;
  const padLabel =
    lang === "en" ? (n: number) => `Option ${n}` : (n: number) => `選項 ${n}`;

  if (kind === "spell" || kind === "dictation") {
    const q: SpellQuestion = {
      ...base,
      kind,
      letters: scrambleWord(word.word),
      hint: def,
    };
    return q;
  }

  if (kind === "typing") {
    const q: TypingQuestion = { ...base, kind: "typing", hint: def };
    return q;
  }

  if (kind === "pos") {
    // 呼叫端已確認有詞性（?? 只是型別上的保險）
    const pos = word.pos ?? "noun";
    const q: PosQuestion = {
      ...base,
      kind: "pos",
      hint: def,
      options: [...POS_OPTIONS],
      correctIndex: POS_OPTIONS.indexOf(pos),
    };
    return q;
  }

  if (kind === "order") {
    const sentence = (word.example ?? "").trim().replace(/\s+/g, " ");
    const q: OrderQuestion = {
      ...base,
      kind: "order",
      tokens: scrambleTokens(sentenceTokens(sentence)),
      sentence,
      translation: word.exampleZh,
    };
    return q;
  }

  if (kind === "synonym") {
    // 呼叫端已確認至少有一種關係可考
    const relation = shuffleArray(synonymRelations(word))[0] ?? "same";
    const answers =
      (relation === "same" ? word.synonyms : word.antonyms) ?? [];
    const correct = shuffleArray(answers)[0] ?? word.word;
    // 同反義資料常常只記一個方向（happy 記了 sad，glad 卻沒記 happy），
    // 所以干擾項只取「另一種關係」的字：考同義就拿別的字的反義字，考反義就拿同義字；
    // 其他單字本身也可能是近義字，不拿來當干擾項。
    // 這個字本身、它的同反義字，以及把它列進清單的字（含同字重複的條目）都排除
    const related = new Set(
      [word.word, ...(word.synonyms ?? []), ...(word.antonyms ?? [])].map(
        normOpt,
      ),
    );
    const target = normOpt(word.word);
    const candidates = pool
      .filter(
        (w) =>
          normOpt(w.word) !== target &&
          ![...(w.synonyms ?? []), ...(w.antonyms ?? [])]
            .map(normOpt)
            .includes(target),
      )
      .flatMap((w) => (relation === "same" ? w.antonyms : w.synonyms) ?? [])
      .filter((c) => !related.has(normOpt(c)));
    const { options, correctIndex } = makeOptions(
      correct,
      candidates,
      FALLBACK_WORDS.filter((c) => !related.has(normOpt(c))),
      padLabel,
    );
    const q: SynonymQuestion = {
      ...base,
      kind: "synonym",
      relation,
      options,
      correctIndex,
    };
    return q;
  }

  if (kind === "cloze" || kind === "listenCloze") {
    // 呼叫端已確認例句用得到這個字（?? 只是型別上的保險）；選項是原形單字，不管句中字形
    const example = word.example ?? "";
    const { options, correctIndex } = makeOptions(
      word.word,
      pool.map((w) => w.word),
      FALLBACK_WORDS,
      padLabel,
    );
    const q: ClozeQuestion = {
      ...base,
      kind,
      prompt: redactWordForms(example, word.word),
      hint: def,
      options,
      correctIndex,
      sentence: example,
      translation: word.exampleZh,
    };
    return q;
  }

  if (kind === "reverse") {
    // 看釋義選英文單字
    const { options, correctIndex } = makeOptions(
      word.word,
      pool.map((w) => w.word),
      FALLBACK_WORDS,
      padLabel,
    );
    const q: OptionQuestion = {
      ...base,
      kind: "reverse",
      prompt: def,
      options,
      correctIndex,
    };
    return q;
  }

  // meaning / listen / emoji 都是「選釋義」
  const { options, correctIndex } = makeOptions(
    def,
    pool
      .map((w) => defOf(w, lang))
      .filter((d): d is string => d !== null),
    lang === "en" ? FALLBACK_DEFS_EN : FALLBACK_DEFS,
    padLabel,
  );
  const prompt =
    kind === "emoji" ? word.emoji : kind === "listen" ? "" : word.word;
  const q: OptionQuestion = {
    ...base,
    kind,
    prompt,
    options,
    correctIndex,
  };
  return q;
}

// 不支援語音時，要靠聽的題型改出不用聽的對應題型
const NO_SPEECH_FALLBACK: Partial<Record<QuizKind, QuizKind>> = {
  listen: "meaning",
  dictation: "spell",
  listenCloze: "cloze",
};

/**
 * 決定每一題的題型。
 * - 關卡未宣告 questionKinds → 全部 meaning（維持第一章原行為）
 * - speechSupported=false → 要聽的題型退回不用聽的（見 NO_SPEECH_FALLBACK）
 * - 循環套用宣告的題型清單，讓混合關卡分佈均勻
 */
function resolveKinds(
  stage: Stage,
  count: number,
  speechSupported: boolean,
): QuizKind[] {
  const declared =
    stage.questionKinds && stage.questionKinds.length > 0
      ? stage.questionKinds
      : (["meaning"] as QuizKind[]);
  const usable = declared.map((k) =>
    speechSupported ? k : (NO_SPEECH_FALLBACK[k] ?? k),
  );
  const result: QuizKind[] = [];
  for (let i = 0; i < count; i++) result.push(usable[i % usable.length]);
  return result;
}

/**
 * 這個字缺資料、出不了該題型時改出的題型（回傳原題型 = 可以出）。
 * 退回的題型都不需要額外資料（不會再遞迴退回），新增退回規則時要維持這點。
 */
function kindForWord(kind: QuizKind, word: GameWord): QuizKind {
  switch (kind) {
    // prepareGamePool 對沒有 emoji 的字塞了預設值，拿它出題無解
    case "emoji":
      return !word.emoji || word.emoji === DEFAULT_EMOJI ? "meaning" : kind;
    // 沒有例句、例句裡認不出這個字（如只有所有格）、或挖空後會洩答 → 改出反向選字
    case "cloze":
      return hasUsableExample(word) ? kind : "reverse";
    case "listenCloze":
      return hasUsableExample(word) ? kind : "listen";
    case "order":
      return hasOrderableExample(word) ? kind : "spell";
    case "synonym":
      return synonymRelations(word).length > 0 ? kind : "reverse";
    case "pos":
      return word.pos ? kind : "meaning";
    default:
      return kind;
  }
}

/**
 * 依關卡設定，從單字池建出一整份題目。
 * 單字缺該題型需要的資料（emoji、例句、同反義字、詞性）時改出其他題型，見 kindForWord。
 * defLanguage 決定整輪釋義語言，單字池會先濾成只剩該語言可用的字。
 * wordOffset 讓中途重建的題目（多階段魔王換階段）接著用後面的字，不從頭重複。
 */
export function buildQuizQuestions(
  pool: GameWord[],
  stage: Stage,
  opts?: {
    speechSupported?: boolean;
    count?: number;
    defLanguage?: DefLanguage;
    wordOffset?: number;
  },
): QuizQuestion[] {
  const speechSupported = opts?.speechSupported ?? true;
  const lang = opts?.defLanguage ?? "zh";
  // 整輪只用同一語言的釋義，避免選項語言混雜洩題
  const usable = pool.filter((w) => rawDef(w, lang));
  if (usable.length === 0) return [];

  const count = opts?.count ?? stage.questionCount;
  const kinds = resolveKinds(stage, count, speechSupported);

  // 單字池不足時循環取用，確保題數足夠
  // （魔王題數 = bossHp + 3，不能少於 bossHp，否則永遠打不倒）
  const offset = opts?.wordOffset ?? 0;
  return Array.from({ length: count }, (_, i) => {
    const word = usable[(i + offset) % usable.length];
    return buildOne(kindForWord(kinds[i], word), word, usable, lang);
  });
}

/** 驗證作答是否正確（選項題用 index，拼字／排序題用字串） */
export function isQuestionCorrect(
  question: QuizQuestion,
  answer: number | string,
): boolean {
  switch (question.kind) {
    case "spell":
    case "dictation":
    case "typing":
      return (
        typeof answer === "string" &&
        normalizeSpell(answer) === normalizeSpell(question.word)
      );
    case "order":
      return (
        typeof answer === "string" &&
        normalizeSentence(answer) === normalizeSentence(question.sentence)
      );
    default:
      return typeof answer === "number" && answer === question.correctIndex;
  }
}

/** 答完要停下來讓玩家讀完整句的題型 — 答對也不自動跳題 */
export function holdsAfterCorrect(kind: QuizKind): boolean {
  return kind === "cloze" || kind === "listenCloze" || kind === "order";
}
