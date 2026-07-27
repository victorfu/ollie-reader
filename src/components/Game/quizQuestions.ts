import type { GameWord } from "../../services/gameService";
import type {
  DefLanguage,
  QuizKind,
  QuizQuestion,
  OptionQuestion,
  SpellQuestion,
  Stage,
} from "../../types/game";
import { shuffleArray } from "../../utils/arrayUtils";

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
 * 英文釋義常常直接含有被考的單字（"Perseverance" → "the act of persevering"），
 * 拿來當 spell 的提示、reverse 的題幹或 meaning 的正解都會直接洩答案，改遮成 ____。
 * 全部釋義（含干擾項）一視同仁 — 只遮正解的話，____ 本身就變成答案標記。
 */
function redactHeadword(text: string, word: string): string {
  const stem = stemOf(word);
  if (stem.length < MIN_STEM_LENGTH) return text;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const redacted = text.replace(new RegExp(`\\b${escaped}\\w*`, "gi"), "____");
  // 整句被遮光的話反而無題可解，保留原文
  return redacted.replace(/[_\s]/g, "") ? redacted : text;
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
  return lang === "en" ? redactHeadword(value, word.word) : value;
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

  if (kind === "spell") {
    const q: SpellQuestion = {
      ...base,
      kind: "spell",
      letters: scrambleWord(word.word),
      hint: def,
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

/**
 * 決定每一題的題型。
 * - 關卡未宣告 questionKinds → 全部 meaning（維持第一章原行為）
 * - speechSupported=false → listen 退回 meaning
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
    k === "listen" && !speechSupported ? "meaning" : k,
  );
  const result: QuizKind[] = [];
  for (let i = 0; i < count; i++) result.push(usable[i % usable.length]);
  return result;
}

/**
 * 依關卡設定，從單字池建出一整份題目。
 * emoji 題若單字沒有可辨識的 emoji（或用了預設 ✨）自動退回 meaning，避免無解。
 * defLanguage 決定整輪釋義語言，單字池會先濾成只剩該語言可用的字。
 */
export function buildQuizQuestions(
  pool: GameWord[],
  stage: Stage,
  opts?: {
    speechSupported?: boolean;
    count?: number;
    defLanguage?: DefLanguage;
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
  return Array.from({ length: count }, (_, i) => {
    const word = usable[i % usable.length];
    let kind = kinds[i];
    if (kind === "emoji" && (!word.emoji || word.emoji === DEFAULT_EMOJI)) {
      kind = "meaning";
    }
    return buildOne(kind, word, usable, lang);
  });
}

/** 驗證作答是否正確（選項題用 index，拼字題用字串） */
export function isQuestionCorrect(
  question: QuizQuestion,
  answer: number | string,
): boolean {
  if (question.kind === "spell") {
    return (
      typeof answer === "string" &&
      normalizeSpell(answer) === normalizeSpell(question.word)
    );
  }
  return typeof answer === "number" && answer === question.correctIndex;
}
