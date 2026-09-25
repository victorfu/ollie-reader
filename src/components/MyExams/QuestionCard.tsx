import { Trash2 } from "lucide-react";
import {
  ANSWER_SPACES,
  ANSWER_SPACE_LABELS,
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  isAnswerSpace,
  isBankSubject,
  type BankQuestion,
  type SourcePage,
} from "../../types/questionBank";
import type { QuestionPatch } from "./cropEditorState";
import { QuestionCrop } from "./QuestionCrop";

interface QuestionCardProps {
  question: BankQuestion;
  number: number;
  isContinuation: boolean;
  pages: readonly SourcePage[];
  urls: Readonly<Record<string, string>>;
  selected: boolean;
  appending: boolean;
  onSelect: () => void;
  onUpdate: (patch: QuestionPatch) => void;
  onToggleAppend: () => void;
  onRemoveRegion: (regionIndex: number) => void;
  onDelete: () => void;
  onRetryImage: (storagePath: string) => void;
}

export function QuestionCard({
  question,
  number,
  isContinuation,
  pages,
  urls,
  selected,
  appending,
  onSelect,
  onUpdate,
  onToggleAppend,
  onRemoveRegion,
  onDelete,
  onRetryImage,
}: QuestionCardProps) {
  return (
    <article
      className={`card border bg-base-100 p-3 shadow-sm ${selected ? "border-primary" : "border-base-300"}`}
      onClick={onSelect}
    >
      <header className="flex items-center justify-between text-sm font-semibold">
        <span>
          第 {number} 題{isContinuation ? "（續）" : ""}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-xs text-error"
          aria-label={`刪除第 ${number} 題`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </header>

      <div className="mt-2 flex justify-center">
        <QuestionCrop
          regions={question.regions}
          pages={pages}
          urls={urls}
          loading="lazy"
          layout={{ kind: "thumbnail", maxHeightPx: 200 }}
          onRetry={onRetryImage}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2" onClick={(event) => event.stopPropagation()}>
        <label className="flex flex-col gap-1 text-xs">
          科目
          <select
            className="select select-xs w-full"
            value={question.subject}
            onChange={(event) => {
              if (isBankSubject(event.target.value)) onUpdate({ subject: event.target.value });
            }}
          >
            {BANK_SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {BANK_SUBJECT_LABELS[subject]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          作答留白
          <select
            className="select select-xs w-full"
            value={question.answerSpace}
            onChange={(event) => {
              if (isAnswerSpace(event.target.value)) onUpdate({ answerSpace: event.target.value });
            }}
          >
            {ANSWER_SPACES.map((space) => (
              <option key={space} value={space}>
                {ANSWER_SPACE_LABELS[space]}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs">
          答案（選填）
          <input
            className="input input-xs w-full"
            value={question.answer ?? ""}
            placeholder="例如：(3)、12 公分"
            onChange={(event) => onUpdate({ answer: event.target.value })}
          />
        </label>
      </div>

      {question.regions.length > 1 && (
        <ul className="mt-2 space-y-1 text-xs">
          {question.regions.map((region, regionIndex) => (
            <li key={regionIndex} className="flex items-center justify-between">
              <span>
                區塊 {regionIndex + 1}（第 {region.pageIndex + 1} 頁）
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveRegion(regionIndex);
                }}
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className={`btn btn-xs mt-2 ${appending ? "btn-primary" : "btn-outline"}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleAppend();
        }}
      >
        {appending ? "取消新增區塊" : "新增區塊"}
      </button>
    </article>
  );
}
