import type { BankQuestion, SourcePage } from "../../types/questionBank";
import { ANSWER_SPACE_CM } from "./printSettings";
import { QuestionCrop } from "./QuestionCrop";

export interface PrintItem {
  question: BankQuestion;
  pages: readonly SourcePage[];
}

interface PrintPaperProps {
  title: string;
  items: readonly PrintItem[];
  urls: Readonly<Record<string, string>>;
  scale: number;
  enhance: boolean;
  includeAnswers: boolean;
  onImageLoad: (key: string) => void;
}

/**
 * 紙張一律固定白底黑字：ThemeContext 深色模式會在 <html> 加 .dark，
 * 用主題 token 會讓卷頭印成白字（spec §12.2）。
 */
export function PrintPaper({ title, items, urls, scale, enhance, includeAnswers, onImageLoad }: PrintPaperProps) {
  return (
    <div className="mx-auto w-[186mm] max-w-full bg-white text-black print:w-full">
      <header className="border-b border-black pb-2">
        <h1 className="text-center text-xl font-semibold">{title}</h1>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <span>姓名＿＿＿＿＿＿</span>
          <span>日期＿＿＿＿＿＿</span>
          <span>分數＿＿＿＿＿＿</span>
        </div>
      </header>

      <ol className="mt-3">
        {items.map(({ question, pages }, index) => {
          const spaceCm = ANSWER_SPACE_CM[question.answerSpace];
          return (
            <li key={question.id} data-question-id={question.id} className="flex gap-2 py-2 break-inside-avoid">
              <span className="w-8 shrink-0 text-right font-semibold">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <QuestionCrop
                  regions={question.regions}
                  pages={pages}
                  urls={urls}
                  loading="eager"
                  layout={{ kind: "print", scale }}
                  enhance={enhance}
                  onImageLoad={(regionIndex) => onImageLoad(`${question.id}:${regionIndex}`)}
                />
                {spaceCm > 0 && (
                  <div aria-hidden="true" data-testid="answer-space" style={{ height: `${spaceCm}cm` }} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {includeAnswers && (
        <section data-testid="answer-page" className="break-before-page pt-2">
          <h2 className="border-b border-black pb-1 text-lg font-semibold">答案</h2>
          <ol className="mt-2 columns-3 gap-6 text-sm">
            {items.map(({ question }, index) => (
              <li key={question.id} className="break-inside-avoid py-0.5">
                {index + 1}. {question.answer ?? "—"}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
