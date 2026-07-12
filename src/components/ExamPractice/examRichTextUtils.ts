export type ExamRichToken =
  | { type: "text"; value: string }
  | {
      type: "fraction";
      whole: string | null;
      numerator: string;
      denominator: string;
    }
  | { type: "break" };

const FRACTION_SPLIT = /(\d*\{\d+\/\d+\})/g;
const FRACTION_SHAPE = /^(\d*)\{(\d+)\/(\d+)\}$/;

function parseLine(line: string, tokens: ExamRichToken[]): void {
  for (const part of line.split(FRACTION_SPLIT)) {
    if (!part) continue;
    const match = FRACTION_SHAPE.exec(part);
    if (match) {
      tokens.push({
        type: "fraction",
        whole: match[1] || null,
        numerator: match[2],
        denominator: match[3],
      });
    } else {
      tokens.push({ type: "text", value: part });
    }
  }
}

export function parseExamRichText(text: string): ExamRichToken[] {
  const tokens: ExamRichToken[] = [];
  text.split("\n").forEach((line, index) => {
    if (index > 0) tokens.push({ type: "break" });
    parseLine(line, tokens);
  });
  return tokens;
}

/** 分數的口語描述，供無障礙標籤使用：2{1/5} →「2又5分之1」。 */
export function fractionLabel(
  whole: string | null,
  numerator: string,
  denominator: string,
): string {
  const base = `${denominator}分之${numerator}`;
  return whole ? `${whole}又${base}` : base;
}
