import { Fragment } from "react";
import { fractionLabel, parseExamRichText } from "./examRichTextUtils";

/**
 * 考卷文字的輕量標記:
 * - `{3/8}` → 直式分數;`2{51/100}` → 帶分數
 * - `\n` → 換行
 * 不合法的 `{...}` 原樣輸出為文字(資料完整性測試會攔截,渲染端永不失敗)。
 */

interface ExamRichTextProps {
  text: string;
  className?: string;
}

/** 渲染含分數標記與換行的考卷文字(題幹、選項、解析共用)。 */
export function ExamRichText({ text, className }: ExamRichTextProps) {
  const tokens = parseExamRichText(text);
  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type === "break") return <br key={index} />;
        if (token.type === "text") {
          return <Fragment key={index}>{token.value}</Fragment>;
        }
        return (
          <span
            key={index}
            className="mx-0.5 inline-flex items-center align-middle"
            aria-label={fractionLabel(token.whole, token.numerator, token.denominator)}
          >
            {token.whole && <span>{token.whole}</span>}
            <span
              aria-hidden="true"
              className="inline-flex flex-col items-center px-0.5 text-[0.72em] leading-[1.15]"
            >
              <span>{token.numerator}</span>
              <span className="h-px w-full min-w-3 bg-current" />
              <span>{token.denominator}</span>
            </span>
          </span>
        );
      })}
    </span>
  );
}
