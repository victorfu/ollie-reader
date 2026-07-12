/**
 * 打字答案的寬鬆批改(英文卷句子練習)。
 *
 * 政策(與資料編寫約定配套,見 ExamTextQuestion.acceptedAnswers):
 * - 忽略大小寫、標點(含連字號:yo-yo ≡ yo yo)、多餘空白
 * - 縮寫 ≡ 展開(I'm = I am),且撇號可省略(im / dont / cant 也接受)
 * - 數字 1–12 ≡ 英文數字(I'm 8 = I'm eight)
 *
 * 縮寫表只收講義素材出現過的形式(封閉內容假設——講義上沒有
 * 會與規則衝突的一般單字,如複數 "times");新增素材時同步擴表。
 */

const CURLY_APOSTROPHES = /[‘’`´]/g;

/** 轉空格的標點(保留撇號;涵蓋小朋友可能打出的全形標點)。 */
const PUNCTUATION = /[.,!?;:"()[\]\-—…。，！？；：、「」『』（）]/g;

/** 縮寫展開:word-boundary、撇號 optional。 */
const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bo\s*'?\s*clock\b/g, "oclock"],
  [/\bi'?m\b/g, "i am"],
  [/\bisn'?t\b/g, "is not"],
  [/\baren'?t\b/g, "are not"],
  [/\bdon'?t\b/g, "do not"],
  [/\bdoesn'?t\b/g, "does not"],
  [/\bcan'?t\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/\bit'?s\b/g, "it is"],
  [/\bhe'?s\b/g, "he is"],
  [/\bshe'?s\b/g, "she is"],
  [/\bwhat'?s\b/g, "what is"],
  [/\bwhere'?s\b/g, "where is"],
  [/\bhow'?s\b/g, "how is"],
  [/\bwho'?s\b/g, "who is"],
  [/\bthere'?s\b/g, "there is"],
  [/\bthere'?re\b/g, "there are"],
  [/\btime'?s\b/g, "time is"],
  [/\bthey'?re\b/g, "they are"],
  [/\bwe'?re\b/g, "we are"],
  [/\byou'?re\b/g, "you are"],
  [/\blet'?s\b/g, "let us"],
];

/** 講義數字範圍 one~twelve。 */
const NUMBER_WORDS: Record<string, string> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  "11": "eleven",
  "12": "twelve",
};

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 批改用正規化;acceptedAnswers 與使用者輸入都經過同一條管線。 */
export function normalizeAnswer(raw: string): string {
  let text = raw.normalize("NFKC").replace(CURLY_APOSTROPHES, "'");
  text = text.toLowerCase();
  text = text.replace(PUNCTUATION, " ");
  text = collapseWhitespace(text);
  for (const [pattern, replacement] of CONTRACTIONS) {
    text = text.replace(pattern, replacement);
  }
  // 殘餘撇號剝除(未列表的 's 等的安全網)。
  text = text.replace(/'/g, "");
  text = collapseWhitespace(text);
  // 數字 ≡ 英文數字(逐 token)。
  text = text
    .split(" ")
    .map((token) => NUMBER_WORDS[token] ?? token)
    .join(" ");
  return text;
}

export function isAcceptedAnswer(
  accepted: readonly string[],
  input: string,
): boolean {
  const normalizedInput = normalizeAnswer(input);
  if (!normalizedInput) return false;
  return accepted.some((answer) => normalizeAnswer(answer) === normalizedInput);
}

/**
 * 輕量斷詞(小寫、去標點、保留撇號)。
 * 供 unscramble 的「字卡多重集 = 答案多重集」資料不變式檢查。
 */
export function answerWords(text: string): string[] {
  const cleaned = collapseWhitespace(
    text
      .normalize("NFKC")
      .replace(CURLY_APOSTROPHES, "'")
      .toLowerCase()
      .replace(PUNCTUATION, " "),
  );
  return cleaned ? cleaned.split(" ") : [];
}
