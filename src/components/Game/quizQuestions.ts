import type { GameWord } from "../../services/gameService";
import type {
  QuizKind,
  QuizQuestion,
  OptionQuestion,
  SpellQuestion,
  Stage,
} from "../../types/game";
import { shuffleArray } from "../../utils/arrayUtils";

// 選項不足時的中文/英文備援
const FALLBACK_DEFS = ["未知的意思", "一種動物", "一種食物", "一個動作"];
const FALLBACK_WORDS = ["apple", "book", "cat", "dog"];
// prepareGamePool 對沒有 emoji 的字會塞這個預設值 → 拿它出 emoji 題會無解，故過濾
const DEFAULT_EMOJI = "✨";

const normOpt = (s: string) => s.trim().toLowerCase();

/**
 * 從 correct + 干擾項組出 4 選 1。
 * 干擾項會去重（忽略大小寫/前後空白）並排除與正解相同者，避免出現重複選項、
 * 或與正解只差大小寫的「看起來一樣卻算錯」選項。
 */
function makeOptions(
  correct: string,
  distractors: string[],
  fallbacks: string[],
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
  while (wrong.length < 3) tryPush(`選項 ${n++}`);

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

/** 建立單一題目 */
function buildOne(
  kind: QuizKind,
  word: GameWord,
  pool: GameWord[],
): QuizQuestion {
  const base = { word: word.word } as const;

  if (kind === "spell") {
    const q: SpellQuestion = {
      ...base,
      kind: "spell",
      letters: scrambleWord(word.word),
      hint: word.def,
    };
    return q;
  }

  if (kind === "reverse") {
    // 看中文選英文
    const { options, correctIndex } = makeOptions(
      word.word,
      pool.map((w) => w.word),
      FALLBACK_WORDS,
    );
    const q: OptionQuestion = {
      ...base,
      kind: "reverse",
      prompt: word.def,
      options,
      correctIndex,
    };
    return q;
  }

  // meaning / listen / emoji 都是「選中文意思」
  const { options, correctIndex } = makeOptions(
    word.def,
    pool.map((w) => w.def),
    FALLBACK_DEFS,
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
 */
export function buildQuizQuestions(
  pool: GameWord[],
  stage: Stage,
  opts?: { speechSupported?: boolean; count?: number },
): QuizQuestion[] {
  const speechSupported = opts?.speechSupported ?? true;
  if (pool.length === 0) return [];

  const count = opts?.count ?? stage.questionCount;
  const kinds = resolveKinds(stage, count, speechSupported);

  // 單字池不足時循環取用，確保題數足夠
  // （魔王題數 = bossHp + 3，不能少於 bossHp，否則永遠打不倒）
  return Array.from({ length: count }, (_, i) => {
    const word = pool[i % pool.length];
    let kind = kinds[i];
    if (kind === "emoji" && (!word.emoji || word.emoji === DEFAULT_EMOJI)) {
      kind = "meaning";
    }
    return buildOne(kind, word, pool);
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
