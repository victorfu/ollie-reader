import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import {
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  type BankQuestion,
  type BankSubject,
  type QuestionSource,
} from "../../types/questionBank";
import { orderBankQuestions } from "./questionOrdering";
import { QuestionCrop } from "./QuestionCrop";

interface QuestionBankGridProps {
  sources: readonly QuestionSource[];
  questions: readonly BankQuestion[];
  onUpload: () => void;
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`btn btn-sm rounded-full ${active ? "btn-primary" : "btn-ghost border border-base-300"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function QuestionBankGrid({ sources, questions, onUpload }: QuestionBankGridProps) {
  const [filter, setFilter] = useState<BankSubject | "all">("all");
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const ordered = useMemo(
    () => orderBankQuestions(questions, sources).filter((question) => sourceById.has(question.sourceId)),
    [questions, sources, sourceById],
  );
  const visible = useMemo(
    () => (filter === "all" ? ordered : ordered.filter((question) => question.subject === filter)),
    [ordered, filter],
  );
  const paths = useMemo(
    () =>
      visible.flatMap((question) => {
        const source = sourceById.get(question.sourceId);
        return question.regions.flatMap((region) => {
          const page = source?.pages[region.pageIndex];
          return page ? [page.storagePath] : [];
        });
      }),
    [visible, sourceById],
  );
  const { urls, refresh } = useSignedPageUrls(paths);

  if (ordered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 p-10 text-center">
        <p className="text-base-content/70">題庫還是空的。先上傳一份考卷或講義，把題目框出來。</p>
        <button type="button" className="btn btn-primary btn-sm mt-4" onClick={onUpload}>
          上傳題目
        </button>
      </div>
    );
  }

  const countOf = (subject: BankSubject) =>
    ordered.filter((question) => question.subject === subject).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} label={`全部 ${ordered.length}`} onClick={() => setFilter("all")} />
        {BANK_SUBJECTS.map((subject) => (
          <FilterChip
            key={subject}
            active={filter === subject}
            label={`${BANK_SUBJECT_LABELS[subject]} ${countOf(subject)}`}
            onClick={() => setFilter(subject)}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((question) => {
          const source = sourceById.get(question.sourceId);
          if (!source) return null;
          return (
            <li key={question.id}>
              <Link
                to={`/my-exams/sources/${source.id}?q=${question.id}`}
                className="card h-full border border-base-300 bg-base-100 p-2 shadow-sm transition-colors hover:border-primary"
              >
                <div className="flex justify-center">
                  <QuestionCrop
                    regions={question.regions}
                    pages={source.pages}
                    urls={urls}
                    loading="lazy"
                    layout={{ kind: "thumbnail", maxHeightPx: 160 }}
                    onRetry={(path) => void refresh(path)}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="badge badge-ghost badge-sm">{BANK_SUBJECT_LABELS[question.subject]}</span>
                  <span className="truncate text-base-content/60">{source.title}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
