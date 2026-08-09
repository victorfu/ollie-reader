import type { ExtractedPage, PdfWord } from "../types/pdf";

export type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SelectionRect = RectLike & {
  right: number;
  bottom: number;
};

export type PdfPoint = {
  x: number;
  y: number;
};

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export type PdfWordGeometry = ExtractedPage & {
  width: number;
  height: number;
  words: PdfWord[];
};

export function hasPdfWordGeometry(
  page: ExtractedPage | undefined,
): page is PdfWordGeometry {
  return (
    typeof page?.width === "number" &&
    typeof page.height === "number" &&
    isFinitePositive(page.width) &&
    isFinitePositive(page.height) &&
    Array.isArray(page.words) &&
    page.words.length > 0
  );
}

export function normalizePdfWords(
  words: PdfWord[],
  pageWidth: number,
  pageHeight: number,
): PdfWord[] {
  if (!isFinitePositive(pageWidth) || !isFinitePositive(pageHeight)) return [];

  const normalized: PdfWord[] = [];
  for (const word of words) {
    if (
      !word ||
      typeof word.text !== "string" ||
      !word.text.trim() ||
      ![word.x0, word.y0, word.x1, word.y1].every(Number.isFinite) ||
      word.x1 <= word.x0 ||
      word.y1 <= word.y0 ||
      word.x1 <= 0 ||
      word.y1 <= 0 ||
      word.x0 >= pageWidth ||
      word.y0 >= pageHeight
    ) {
      continue;
    }

    const x0 = Math.max(0, word.x0);
    const y0 = Math.max(0, word.y0);
    const x1 = Math.min(pageWidth, word.x1);
    const y1 = Math.min(pageHeight, word.y1);
    if (x1 <= x0 || y1 <= y0) continue;
    normalized.push({ ...word, text: word.text.trim(), x0, y0, x1, y1 });
  }
  return normalized;
}

export function clientPointToPdfPoint(
  clientX: number,
  clientY: number,
  rootRect: RectLike,
  pageWidth: number,
  pageHeight: number,
): PdfPoint | null {
  if (
    !isFinitePositive(rootRect.width) ||
    !isFinitePositive(rootRect.height) ||
    !isFinitePositive(pageWidth) ||
    !isFinitePositive(pageHeight)
  ) {
    return null;
  }

  return {
    x: ((clientX - rootRect.left) * pageWidth) / rootRect.width,
    y: ((clientY - rootRect.top) * pageHeight) / rootRect.height,
  };
}

export function findPdfWordAtPoint(
  words: PdfWord[],
  point: PdfPoint | null,
): number | null {
  if (!point) return null;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (
      point.x >= word.x0 &&
      point.x <= word.x1 &&
      point.y >= word.y0 &&
      point.y <= word.y1
    ) {
      return index;
    }
  }
  return null;
}

export function pdfWordToClientRect(
  word: PdfWord,
  rootRect: RectLike,
  pageWidth: number,
  pageHeight: number,
): SelectionRect | null {
  if (
    !isFinitePositive(rootRect.width) ||
    !isFinitePositive(rootRect.height) ||
    !isFinitePositive(pageWidth) ||
    !isFinitePositive(pageHeight)
  ) {
    return null;
  }
  const scaleX = rootRect.width / pageWidth;
  const scaleY = rootRect.height / pageHeight;
  const left = rootRect.left + word.x0 * scaleX;
  const top = rootRect.top + word.y0 * scaleY;
  const right = rootRect.left + word.x1 * scaleX;
  const bottom = rootRect.top + word.y1 * scaleY;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

const CJK_PATTERN =
  /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/u;
const CLOSING_PUNCTUATION = ",.;:!?%)]}，。；：！？％、”’》〉】）";
const OPENING_PUNCTUATION = "([{“‘《〈【（";
const LOWERCASE_LETTER = /^\p{Ll}/u;

function followsOnAnotherLine(previous: PdfWord, next: PdfWord): boolean {
  const previousHeight = previous.y1 - previous.y0;
  const nextHeight = next.y1 - next.y0;
  const overlap =
    Math.min(previous.y1, next.y1) - Math.max(previous.y0, next.y0);
  return (
    next.y0 > previous.y0 &&
    overlap <= Math.min(previousHeight, nextHeight) * 0.25
  );
}

function joinPair(
  text: string,
  previousWord: PdfWord,
  nextWord: PdfWord,
): string {
  const next = nextWord.text.trim();
  if (
    text.endsWith("-") &&
    LOWERCASE_LETTER.test(next) &&
    followsOnAnotherLine(previousWord, nextWord)
  ) {
    return `${text.slice(0, -1)}${next}`;
  }
  const previousCharacter = text.at(-1) || "";
  const nextCharacter = next[0] || "";
  if (
    (CJK_PATTERN.test(previousCharacter) && CJK_PATTERN.test(nextCharacter)) ||
    CLOSING_PUNCTUATION.includes(nextCharacter) ||
    OPENING_PUNCTUATION.includes(previousCharacter)
  ) {
    return `${text}${next}`;
  }
  return `${text} ${next}`;
}

export function joinPdfWords(
  words: PdfWord[],
  anchorIndex: number,
  focusIndex: number,
): string {
  if (words.length === 0) return "";
  const start = Math.max(0, Math.min(anchorIndex, focusIndex));
  const end = Math.min(words.length - 1, Math.max(anchorIndex, focusIndex));
  if (start > end) return "";

  let previousWord = words[start];
  let text = previousWord?.text.trim() || "";
  for (let index = start + 1; index <= end; index += 1) {
    const nextWord = words[index];
    const next = nextWord?.text.trim();
    if (!nextWord || !next) continue;
    text = text && previousWord ? joinPair(text, previousWord, nextWord) : next;
    previousWord = nextWord;
  }
  return text;
}

const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’\-‐-―][\p{L}\p{M}]+)*/u;

export function singlePdfWordText(word: PdfWord): string {
  return word.text.match(WORD_PATTERN)?.[0] || word.text.trim();
}
